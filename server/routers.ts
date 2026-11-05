import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import * as compliance from "./compliance";
import * as ai from "../shared/ai/enhance";
import { AiUnavailableError, lookupCodes, runServerAi, serverAiStatus } from "./ai";
import { searchByKeywords } from "./htsIndex";
import type { HtsResult, TariffResult } from "../shared/tradeTypes";
import { storageDelete, storagePut, storageRead } from "./storage";
import * as trade from "./tradeData";
import type { User } from "../drizzle/schema";
import { googleConfigured } from "./_core/googleAuth";

function requireUser(user: User | null): User {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Workspace unavailable" });
  return user;
}

/** Load a shipment and verify the caller owns it (admins may access any). */
async function getOwnedShipment(user: User, shipmentId: number) {
  const shipment = await db.getShipmentById(shipmentId);
  if (!shipment || (shipment.userId !== user.id && user.role !== "admin")) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
  }
  return shipment;
}

async function getOwnedCertificate(user: User, certificateId: number) {
  const cert = await db.getCertificateById(certificateId);
  if (!cert || (cert.userId !== user.id && user.role !== "admin")) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
  }
  return cert;
}

/** Read a file the caller uploaded (via its /api/files/<key> URL). */
async function readOwnedFile(user: User, fileUrl: string) {
  const key = decodeURIComponent(fileUrl.replace(/^\/api\/files\//, ""));
  if (!fileUrl.startsWith("/api/files/") || !key.startsWith(`${user.id}/`)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "File not accessible" });
  }
  const file = await storageRead(key);
  if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
  return file;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    providers: publicProcedure.query(() => ({ google: googleConfigured() })),
  }),

  // ============================================================================
  // SHIPMENT WORKFLOW - Central entity connecting all steps
  // ============================================================================
  shipments: router({
    create: protectedProcedure
      .input(z.object({
        shipmentName: z.string(),
        productDescription: z.string().optional(),
        htsCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const shipmentId = await db.createShipment({
          userId: ctx.user.id,
          shipmentName: input.shipmentName,
          productDescription: input.productDescription,
          htsCode: input.htsCode,
          status: "draft",
          workflowStep: 1,
        });
        return { shipmentId };
      }),

    get: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getOwnedShipment(ctx.user, input.shipmentId);
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserShipments(ctx.user.id);
      }),

    recent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getRecentShipments(ctx.user.id, input.limit);
      }),

    update: protectedProcedure
      .input(z.object({
        shipmentId: z.number(),
        data: z.object({
          shipmentName: z.string().optional(),
          productDescription: z.string().optional(),
          htsCode: z.string().optional(),
          originCountry: z.string().optional(),
          destinationCountry: z.string().optional(),
          quantity: z.number().optional(),
          weight: z.number().optional(),
          weightUnit: z.string().optional(),
          value: z.number().optional(),
          currency: z.string().optional(),
          incoterm: z.string().optional(),
          freightCost: z.number().optional(),
          insuranceCost: z.number().optional(),
          status: z.enum(["draft", "calculating", "documenting", "reviewing", "complete"]).optional(),
          workflowStep: z.number().optional(),
          lastCalculation: z.any().optional(),
          userOverrides: z.any().optional(),
          riskScore: z.number().optional(),
          riskLevel: z.enum(["low", "medium", "high"]).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        await getOwnedShipment(ctx.user, input.shipmentId);
        await db.updateShipment(input.shipmentId, input.data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteShipment(input.shipmentId, ctx.user.id);
        return { success: true };
      }),

    // ── Import Purchase Order: parse the uploaded file's text ─────────────────
    importPO: protectedProcedure
      .input(z.object({
        fileUrl: z.string().min(1), // /api/files/<key>
        fileName: z.string(),
        mimeType: z.string(), // application/pdf, text/csv, text/plain
      }))
      .mutation(async ({ ctx, input }) => {
        const file = await readOwnedFile(ctx.user, input.fileUrl);
        const isCsv = input.mimeType === "text/csv" || /\.csv$/i.test(input.fileName);
        const base = { fileUrl: input.fileUrl, extractedAt: new Date().toISOString() };

        // Images (and scanned PDFs) can only be read by an AI vision model;
        // the client runs that step when AI is available.
        if (input.mimeType.startsWith("image/")) {
          return { ...base, lineItems: [], text: "", needsVision: true };
        }
        let text: string;
        if (input.mimeType === "application/pdf") {
          const { getDocumentProxy, extractText } = await import("unpdf");
          const pdf = await getDocumentProxy(new Uint8Array(file.data));
          text = (await extractText(pdf, { mergePages: true })).text;
        } else if (isCsv || input.mimeType.startsWith("text/")) {
          text = Buffer.from(file.data).toString("utf8");
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PDF, CSV or image of the purchase order." });
        }
        if (!text.trim()) {
          return { ...base, lineItems: [], text: "", needsVision: true, scannedPdf: true };
        }

        return {
          ...compliance.parsePurchaseOrder(text, isCsv),
          ...base,
          // Sent back so an AI (server or local) can fill gaps without re-reading the file
          text: text.slice(0, 15000),
          needsVision: false,
        };
      }),

    // ── Create shipment pre-filled from PO extraction ─────────────────────────
    createFromPO: protectedProcedure
      .input(z.object({
        poData: z.object({
          poNumber: z.string().optional(),
          poDate: z.string().optional(),
          buyerName: z.string().optional(),
          buyerAddress: z.string().optional(),
          sellerName: z.string().optional(),
          sellerAddress: z.string().optional(),
          shipToName: z.string().optional(),
          shipToAddress: z.string().optional(),
          incoterms: z.string().optional(),
          currency: z.string().optional(),
          paymentTerms: z.string().optional(),
          deliveryDate: z.string().optional(),
          totalValue: z.string().optional(),
          notes: z.string().optional(),
          fileUrl: z.string().optional(),
          extractedAt: z.string().optional(),
          lineItems: z.array(z.object({
            lineNumber: z.number().optional(),
            description: z.string(),
            quantity: z.string().optional(),
            unit: z.string().optional(),
            unitPrice: z.string().optional(),
            totalPrice: z.string().optional(),
            htsCode: z.string().optional(),
            countryOfOrigin: z.string().optional(),
          })).optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const po = input.poData;
        // Derive shipment name from PO number or seller
        const shipmentName = po.poNumber
          ? `PO #${po.poNumber}${po.sellerName ? ` – ${po.sellerName}` : ''}`
          : po.sellerName ? `Shipment from ${po.sellerName}` : 'Imported from PO';

        // Use first line item for product description and HTS
        const firstItem = po.lineItems?.[0];
        const productDescription = po.lineItems
          ? po.lineItems.map(li => li.description).join('; ')
          : undefined;

        const shipmentId = await db.createShipment({
          userId: ctx.user.id,
          shipmentName,
          productDescription,
          htsCode: firstItem?.htsCode,
          originCountry: firstItem?.countryOfOrigin,
          currency: po.currency || 'USD',
          incoterm: po.incoterms,
          value: po.totalValue ? (parseFloat(po.totalValue.replace(/[^0-9.]/g, '')) || undefined)?.toString() : undefined,
          status: 'draft',
          workflowStep: 1,
          poData: {
            ...po,
            extractedAt: po.extractedAt || new Date().toISOString(),
          },
        });

        return { shipmentId, shipmentName };
      }),

    // ── Update COO status on a shipment ───────────────────────────────────────
    updateCooStatus: protectedProcedure
      .input(z.object({
        shipmentId: z.number(),
        cooStatus: z.enum(['none', 'draft', 'issued']),
        cooId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await getOwnedShipment(ctx.user, input.shipmentId);
        await db.updateShipment(input.shipmentId, {
          cooStatus: input.cooStatus,
          cooId: input.cooId,
        } as any);
        return { success: true };
      }),
  }),

  // ============================================================================
  // HTS SEARCH - bundled USITC schedule, no LLM
  // ============================================================================
  hts: router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional(),
        shipmentId: z.number().optional(), // Link to workflow
      }))
      .query(async ({ input }): Promise<HtsResult[]> => {
        const limit = Math.min(input.limit || 8, 25);
        if (trade.looksLikeHtsCode(input.query)) {
          const line = await trade.lookupHts(input.query).catch(() => null);
          if (!line) return [];
          return [{
            code: line.code,
            description: line.description,
            dutyRate: line.general || "varies",
            riskLevel: "low",
            reasoning: "Exact match from the USITC Harmonized Tariff Schedule.",
            alternatives: [],
            confidence: 1,
            source: "official",
          }];
        }

        const hits = searchByKeywords(input.query, limit);
        const best = hits[0]?.score || 1;
        return hits.map((hit, i) => {
          const confidence = Math.round(Math.min(0.9, (hit.matched / hit.total) * (hit.score / best) * 0.9) * 100) / 100;
          return {
            code: hit.code,
            description: hit.path,
            dutyRate: hit.general || "varies",
            riskLevel: confidence >= 0.75 ? "low" : confidence >= 0.5 ? "medium" : "high",
            reasoning: `Keyword match on the official schedule (${hit.matched} of ${hit.total} terms). Confirm the full description and chapter notes before using this code.`,
            alternatives: hits
              .filter((_, j) => j !== i && j < 4)
              .slice(0, 2)
              .map(alt => ({ code: alt.code, reason: alt.path.split(" > ").pop() })),
            confidence,
            source: "rules",
          };
        });
      }),
  }),

  // ============================================================================
  // TARIFF CALCULATOR - Enhanced with trade agreements and breakdowns
  // ============================================================================
  tariff: router({
    calculate: publicProcedure
      .input(z.object({
        htsCode: z.string(),
        originCountry: z.string(),
        destinationCountry: z.string(),
        value: z.number(),
        quantity: z.number().optional(),
        weight: z.number().optional(),
        incoterm: z.string().optional(),
        freightCost: z.number().optional(),
        insuranceCost: z.number().optional(),
        additionalDutyRate: z.number().min(0).max(500).optional(), // % (Section 301/232 etc.)
        dutyRate: z.number().min(0).max(500).optional(), // % base rate for non-US destinations
        shipmentId: z.number().optional(), // Link to workflow
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.shipmentId) await getOwnedShipment(requireUser(ctx.user), input.shipmentId);
        // Accept country names as well as ISO codes
        input = {
          ...input,
          originCountry: compliance.resolveCountry(input.originCountry),
          destinationCountry: compliance.resolveCountry(input.destinationCountry),
        };

        // US imports: compute from official HTS rates, no LLM
        if (input.destinationCountry.toUpperCase() === "USA") {
          let result;
          try {
            result = await trade.calculateUsTariff(input);
          } catch (error) {
            console.error("[Tariff] USITC lookup failed", error);
            throw new TRPCError({ code: "BAD_GATEWAY", message: "Tariff schedule service is unavailable. Please try again." });
          }
          if (!result) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `HTS code ${input.htsCode} was not found in the US tariff schedule` });
          }
          if (input.shipmentId) {
            await db.updateShipment(input.shipmentId, {
              lastCalculation: {
                appliedRate: result.appliedRate,
                dutyAmount: result.dutyAmount,
                landedCost: result.landedCost,
                tradeAgreement: result.tradeAgreement,
                rationale: result.rationale,
                calculatedAt: new Date().toISOString(),
              },
              workflowStep: 2,
              status: "calculating",
            });
          }
          return result;
        }

        // Other destinations: no bundled tariff, so use the duty rate the user enters
        const baseRate = (input.dutyRate ?? 0) / 100;
        const dutyAmount = input.value * baseRate;
        const additionalDuties = input.value * ((input.additionalDutyRate ?? 0) / 100);
        const totalDuties = dutyAmount + additionalDuties;
        const landedCost = input.value + (input.freightCost || 0) + (input.insuranceCost || 0) + totalDuties;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const agreements = compliance.agreementsFor(input.originCountry, input.destinationCountry);
        const explanation = [
          input.dutyRate === undefined
            ? `Automatic duty rates are only available for US imports. Enter the ${compliance.countryName(compliance.resolveCountry(input.destinationCountry))} duty rate for HTS ${input.htsCode} to calculate duty.`
            : `Duty at the entered rate of ${input.dutyRate}% on a value of ${input.value}.`,
          agreements.length ? `A preferential rate may apply under ${agreements.join(", ")} if the goods qualify.` : "",
          "Import VAT/GST and local fees are not included.",
        ].filter(Boolean).join("\n");
        const result: TariffResult = {
          mfnRate: input.dutyRate !== undefined ? `${input.dutyRate}%` : "Not available",
          preferentialRate: null,
          additionalDuties: round2(additionalDuties),
          appliedRate: input.dutyRate !== undefined ? `${input.dutyRate}%` : "not entered",
          tradeAgreement: `${compliance.countryName(input.destinationCountry)} tariff`,
          exclusionStatus: "none",
          dutyAmount: round2(dutyAmount),
          mpf: 0,
          hmf: 0,
          totalDuties: round2(totalDuties),
          landedCost: round2(landedCost),
          rateSource: "User-entered rate",
          rationale: explanation,
          explanation,
          alternatives: [],
          effectiveDate: new Date().toISOString(),
          additionalDutyLines: input.additionalDutyRate
            ? [{ name: "Additional duty (entered)", ratePercent: input.additionalDutyRate, amount: round2(additionalDuties), basis: "Entered by you", source: "user" }]
            : [],
          source: input.dutyRate !== undefined ? "user" : "rules",
        };

        if (input.shipmentId) {
          await db.updateShipment(input.shipmentId, {
            lastCalculation: {
              appliedRate: result.appliedRate,
              dutyAmount: result.dutyAmount,
              landedCost: result.landedCost,
              tradeAgreement: result.tradeAgreement,
              rationale: result.rationale,
              calculatedAt: new Date().toISOString(),
            },
            workflowStep: 2,
            status: "calculating",
          });
        }
        return result;
      }),
  }),

  // ============================================================================
  // REGULATIONS - curated rules by country and HTS chapter
  // ============================================================================
  regulations: router({
    search: publicProcedure
      .input(z.object({
        countryCode: z.string(),
        regulationType: z.enum(["all", "import", "export", "licensing", "restrictions"]),
        htsCode: z.string().optional(),
        shipmentId: z.number().optional(),
      }))
      .query(({ input }) => compliance.regulationsFor(input.countryCode, input.regulationType, input.htsCode)),
  }),

  // ============================================================================
  // DOCUMENTS - S3 storage with shipment linking
  // ============================================================================
  documents: router({
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
        documentType: z.string(),
        shipmentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.shipmentId) await getOwnedShipment(ctx.user, input.shipmentId);
        const buffer = Buffer.from(input.fileData, 'base64');
        const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
        const fileKey = `${ctx.user.id}/documents/${Date.now()}-${safeName}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const docId = await db.createDocument({
          userId: ctx.user.id,
          shipmentId: input.shipmentId,
          documentType: input.documentType,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          status: "uploaded",
        });

        // Update shipment workflow if linked
        if (input.shipmentId) {
          await db.updateShipment(input.shipmentId, {
            workflowStep: 3,
            status: "documenting",
          });
        }

        return { documentId: docId, url };
      }),

    list: protectedProcedure
      .input(z.object({ shipmentId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.shipmentId) {
          await getOwnedShipment(ctx.user, input.shipmentId);
          return await db.getShipmentDocuments(input.shipmentId);
        }
        return await db.getUserDocuments(ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.deleteDocument(input.documentId, ctx.user.id);
        if (doc) await storageDelete(doc.fileKey).catch(err => console.warn("[Documents] Blob delete failed", err));
        return { success: true };
      }),
  }),

  // ============================================================================
  // CHECKLISTS - AI-generated compliance requirements
  // ============================================================================
  checklists: router({
    generate: publicProcedure
      .input(z.object({
        shipmentId: z.number().optional(),
        shipmentType: z.enum(["import", "export"]),
        originCountry: z.string(),
        destinationCountry: z.string(),
        productCategory: z.string().optional(),
        htsCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const items = compliance.checklistFor(input);

        // Save checklist to the shipment when generated from the workflow
        if (input.shipmentId) {
          await getOwnedShipment(requireUser(ctx.user), input.shipmentId);
          await db.updateShipment(input.shipmentId, {
            workflowStep: 4,
            status: "reviewing",
            complianceChecklist: {
              items,
              generatedAt: new Date().toISOString(),
            },
          });
        }

        return {
          checklistId: input.shipmentId ?? null,
          items,
        };
      }),
    
    get: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const shipment = await getOwnedShipment(ctx.user, input.shipmentId);
        if (!shipment.complianceChecklist) {
          return null;
        }
        return {
          checklistId: shipment.id,
          items: shipment.complianceChecklist.items,
          generatedAt: shipment.complianceChecklist.generatedAt,
        };
      }),
    
    // Store the checklist after the client merged AI additions into it
    save: protectedProcedure
      .input(z.object({ shipmentId: z.number(), items: z.array(z.any()).max(100) }))
      .mutation(async ({ ctx, input }) => {
        await getOwnedShipment(ctx.user, input.shipmentId);
        await db.updateShipment(input.shipmentId, {
          workflowStep: 4,
          status: "reviewing",
          complianceChecklist: { items: input.items, generatedAt: new Date().toISOString() },
        });
        return { success: true };
      }),

    toggleItem: protectedProcedure
      .input(z.object({
        shipmentId: z.number(),
        itemIndex: z.number(),
        completed: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const shipment = await getOwnedShipment(ctx.user, input.shipmentId);
        if (!shipment.complianceChecklist) {
          throw new Error("Checklist not found");
        }
        
        const items = [...shipment.complianceChecklist.items];
        if (input.itemIndex >= 0 && input.itemIndex < items.length) {
          items[input.itemIndex].completed = input.completed;
        }
        
        await db.updateShipment(input.shipmentId, {
          complianceChecklist: {
            ...shipment.complianceChecklist,
            items,
          },
        });
        
        return { success: true, items };
      }),
  }),

  // ============================================================================
  // UTILITIES - Currency, shipping estimates
  // ============================================================================
  utilities: router({
    convertCurrency: publicProcedure
      .input(z.object({
        amount: z.number(),
        from: z.string().length(3),
        to: z.string().length(3),
      }))
      .query(async ({ input }) => {
        try {
          return await trade.convertCurrency(input.amount, input.from, input.to);
        } catch (error: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error?.message || "Conversion failed" });
        }
      }),

    estimateShipping: publicProcedure
      .input(z.object({
        originCountry: z.string(),
        destinationCountry: z.string(),
        weight: z.number().positive(),
        dimensions: z.object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
        }).optional(),
      }))
      .query(({ input }) => trade.estimateShipping(input)),
  }),

  // ============================================================================
  // ALERTS
  // ============================================================================
  alerts: router({
    subscribe: protectedProcedure
      .input(z.object({
        alertType: z.enum(["tariff_change", "regulation_update", "license_renewal", "shipment_status"]),
        email: z.string().email(),
        htsCode: z.string().optional(),
        countryCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const alertId = await db.createAlert(ctx.user.id, {
          alertType: input.alertType,
          title: `Alert: ${input.alertType}`,
          message: `Subscribed to ${input.alertType} notifications`,
          htsCode: input.htsCode,
          countryCode: input.countryCode,
        });
        return { alertId };
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserAlerts(ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAlert(input.alertId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // CREDITS SYSTEM
  // ============================================================================
  credits: router({
    getBalance: protectedProcedure
      .query(async ({ ctx }) => {
        const { getCreditBalance, getFreeTierStatus } = await import("./credits");
        const balance = await getCreditBalance(ctx.user.id);
        const freeTier = await getFreeTierStatus(ctx.user.id);
        return {
          balance,
          freeTier,
        };
      }),

    getTransactions: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const transactions = await db.getCreditTransactions(ctx.user.id, input.limit, input.offset);
        return transactions;
      }),

    getUsageStats: protectedProcedure
      .input(z.object({
        days: z.number().optional().default(30),
      }))
      .query(async ({ ctx, input }) => {
        const stats = await db.getCreditUsageStats(ctx.user.id, input.days);
        return stats;
      }),
  }),

  // ============================================================================
  // CERTIFICATE OF ORIGIN
  // ============================================================================
  certificate: router({

    // ── Assist: rule-based suggestions for a given trade agreement ──────────
    assist: publicProcedure
      .input(z.object({
        tradeAgreement: z.string(),
        exporterCountry: z.string().optional(),
        destinationCountry: z.string().optional(),
        goodsDescription: z.string().optional(),
        htsCode: z.string().optional(),
      }))
      .mutation(({ input }) => compliance.originGuidance(input)),

    // ── Get applicable agreements for a country pair ─────────────────────────
    getApplicableAgreements: publicProcedure
      .input(z.object({
        exporterCountry: z.string(),
        destinationCountry: z.string(),
      }))
      .query(async ({ input }) => {
        const { getApplicableAgreements } = await import("../shared/tradeAgreements.js");
        const agreements = getApplicableAgreements(input.exporterCountry, input.destinationCountry);
        return agreements.map(a => ({
          id: a.id,
          name: a.name,
          shortName: a.shortName,
          description: a.description,
          officialFormName: a.officialFormName,
        }));
      }),

    // ── Get full agreement definition (fields, criteria, etc.) ───────────────
    getAgreementDefinition: publicProcedure
      .input(z.object({ agreementId: z.string() }))
      .query(async ({ input }) => {
        const { getAgreementById } = await import("../shared/tradeAgreements.js");
        return getAgreementById(input.agreementId) || null;
      }),

    // ── Generate certificate with trade agreement support ────────────────────
    generate: protectedProcedure
      .input(z.object({
        tradeAgreement: z.string().default("GENERIC"),
        exporterName: z.string(),
        exporterAddress: z.string().optional(),
        exporterCountry: z.string().optional(),
        exporterSignatory: z.string().optional(),
        consigneeName: z.string(),
        consigneeAddress: z.string().optional(),
        consigneeCountry: z.string().optional(),
        htsCode: z.string().optional(),
        goodsDescription: z.string(),
        quantity: z.string().optional(),
        quantityUnit: z.string().optional(),
        grossWeight: z.string().optional(),
        netWeight: z.string().optional(),
        marksNumbers: z.string().optional(),
        invoiceNumber: z.string().optional(),
        countryOfOrigin: z.string(),
        originCriterion: z.string().optional(),
        producerDeclaration: z.string().optional(),
        departureDate: z.string().optional(),
        vessel: z.string().optional(),
        portOfLoading: z.string().optional(),
        portOfDischarge: z.string().optional(),
        destinationCountry: z.string().optional(),
        chamberName: z.string().optional(),
        issueDate: z.string().optional(),
        issuePlace: z.string().optional(),
        shipmentId: z.number().optional(),
        // Trade-agreement-specific additional fields (stored as JSON)
        agreementFields: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.shipmentId) await getOwnedShipment(ctx.user, input.shipmentId);
        const { getAgreementById } = await import("../shared/tradeAgreements.js");
        const agreement = getAgreementById(input.tradeAgreement);

        // Rule-based validation against the agreement definition (no LLM).
        // Users can still ask for AI guidance via certificate.aiAssist.
        const validationResult = trade.validateCertificate(input, agreement);

        // Generate certificate number with agreement prefix
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const seq = String(Math.floor(Math.random() * 9000) + 1000);
        const prefix = input.tradeAgreement === "GENERIC" ? "COO" : input.tradeAgreement.replace(/[^A-Z]/g, "").slice(0, 6);
        const certificateNumber = `${prefix}-${dateStr}-${seq}`;

        // Save to database
        const certId = await db.createCertificate({
          userId: ctx.user.id,
          shipmentId: input.shipmentId,
          certificateNumber,
          status: "draft",
          tradeAgreement: input.tradeAgreement,
          agreementFields: input.agreementFields || undefined,
          exporterName: input.exporterName,
          exporterAddress: input.exporterAddress,
          exporterCountry: input.exporterCountry,
          exporterSignatory: input.exporterSignatory,
          consigneeName: input.consigneeName,
          consigneeAddress: input.consigneeAddress,
          consigneeCountry: input.consigneeCountry,
          htsCode: input.htsCode,
          goodsDescription: input.goodsDescription,
          quantity: input.quantity,
          quantityUnit: input.quantityUnit,
          grossWeight: input.grossWeight,
          netWeight: input.netWeight,
          marksNumbers: input.marksNumbers,
          invoiceNumber: input.invoiceNumber,
          countryOfOrigin: input.countryOfOrigin,
          originCriterion: input.originCriterion,
          producerDeclaration: input.producerDeclaration,
          departureDate: input.departureDate,
          vessel: input.vessel,
          portOfLoading: input.portOfLoading,
          portOfDischarge: input.portOfDischarge,
          destinationCountry: input.destinationCountry,
          chamberName: input.chamberName,
          issueDate: input.issueDate || now.toISOString().slice(0, 10),
          issuePlace: input.issuePlace,
          validationResult,
        });

        return {
          certificateId: certId,
          certificateNumber,
          validationResult,
          agreement: agreement ? {
            id: agreement.id,
            name: agreement.name,
            shortName: agreement.shortName,
            certificationLanguage: agreement.certificationLanguage,
            requiredDocuments: agreement.requiredDocuments,
            notes: agreement.notes,
          } : null,
        };
      }),

    get: protectedProcedure
      .input(z.object({ certificateId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getOwnedCertificate(ctx.user, input.certificateId);
      }),

    getByShipment: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await getOwnedShipment(ctx.user, input.shipmentId);
        return await db.getCertificateByShipmentId(input.shipmentId);
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserCertificates(ctx.user.id);
      }),

    issue: protectedProcedure
      .input(z.object({ certificateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await getOwnedCertificate(ctx.user, input.certificateId);
        await db.updateCertificate(input.certificateId, { status: "issued" });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ certificateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCertificate(input.certificateId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // ADMIN PANEL
  // ============================================================================
  // ============================================================================
  // AI ENHANCEMENT - optional; every feature works without it
  // ============================================================================
  ai: router({
    status: publicProcedure.query(() => ({ server: serverAiStatus() })),

    // Validates codes suggested by an AI running in the browser (local Ollama)
    lookupCodes: publicProcedure
      .input(z.object({ codes: z.array(z.string().max(20)).max(20) }))
      .query(({ input }) => lookupCodes(input.codes)),

    enhance: protectedProcedure
      .input(z.discriminatedUnion("feature", [
        z.object({ feature: z.literal("hts"), query: z.string().max(500), candidates: z.array(z.any()).max(25) }),
        z.object({ feature: z.literal("tariff"), input: z.any(), base: z.any() }),
        z.object({ feature: z.literal("regulations"), country: z.string().max(100), htsCode: z.string().max(20).optional(), productDescription: z.string().max(500).optional(), base: z.array(z.any()).max(60) }),
        z.object({ feature: z.literal("checklist"), shipmentType: z.string().max(20), originCountry: z.string().max(100), destinationCountry: z.string().max(100), htsCode: z.string().max(20).optional(), base: z.array(z.any()).max(80) }),
        z.object({ feature: z.literal("po"), base: z.any(), text: z.string().max(20000).optional(), fileUrl: z.string().optional() }),
        z.object({ feature: z.literal("origin"), tradeAgreement: z.string(), exporterCountry: z.string().optional(), destinationCountry: z.string().optional(), goodsDescription: z.string().max(2000).optional(), htsCode: z.string().optional(), base: z.any() }),
        z.object({ feature: z.literal("assistant"), question: z.string().min(1).max(4000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(12).optional(), context: z.string().max(12000).optional() }),
      ]))
      .mutation(async ({ ctx, input }) => {
        const cacheable = input.feature !== "assistant" && input.feature !== "po";
        try {
          return await runServerAi(ctx.user.id, input, cacheable, async deps => {
            switch (input.feature) {
              case "hts":
                return { hts: await ai.enhanceHts(deps, { query: input.query, candidates: input.candidates }) };
              case "tariff":
                return { tariff: await ai.enhanceTariff(deps, { input: input.input, base: input.base }) };
              case "regulations":
                return { regulations: await ai.enhanceRegulations(deps, input) };
              case "checklist":
                return { checklist: await ai.enhanceChecklist(deps, input) };
              case "po": {
                let imageDataUrl: string | undefined;
                if (!input.text && input.fileUrl) {
                  const file = await readOwnedFile(ctx.user, input.fileUrl);
                  if (!file.contentType.startsWith("image/")) throw new Error("Only images can be read without a text layer");
                  imageDataUrl = `data:${file.contentType};base64,${Buffer.from(file.data).toString("base64")}`;
                }
                return { po: await ai.enhancePO(deps, { base: input.base, text: input.text, imageDataUrl }) };
              }
              case "origin": {
                const { getAgreementById } = await import("../shared/tradeAgreements");
                const agreement = getAgreementById(input.tradeAgreement);
                return {
                  origin: await ai.enhanceOrigin(deps, {
                    ...input,
                    agreementName: agreement?.name ?? input.tradeAgreement,
                    criteria: agreement?.originCriteria ?? [],
                  }),
                };
              }
              case "assistant":
                return { answer: await ai.askAssistant(deps, input) };
            }
          });
        } catch (error: any) {
          if (error instanceof AiUnavailableError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
          }
          console.warn(`[AI] ${input.feature} enhancement failed:`, error?.message);
          throw new TRPCError({ code: "BAD_GATEWAY", message: error?.message || "AI request failed" });
        }
      }),
  }),

  admin: router({
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        return await db.getAdminStats();
      }),

    listUsers: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        const allUsers = await db.getAllUsers(input.limit, input.offset);
        if (input.search) {
          const q = input.search.toLowerCase();
          return allUsers.filter(u =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            String(u.id).includes(q)
          );
        }
        return allUsers;
      }),

    getUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        const [userShipments, userCerts, userTxns] = await Promise.all([
          db.getUserShipments(input.userId),
          db.getUserCertificates(input.userId),
          db.getCreditTransactions(input.userId, 20, 0),
        ]);
        return {
          ...user,
          shipmentCount: userShipments.length,
          certificateCount: userCerts.length,
          recentTransactions: userTxns,
        };
      }),

    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin']),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change your own role' });
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    adjustCredits: protectedProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().positive(),
        direction: z.enum(['add', 'deduct']),
        reason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        const { addCredits } = await import('./credits');
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        if (input.direction === 'add') {
          await addCredits(input.userId, input.amount, 'admin_adjustment', input.reason);
        } else {
          const currentBalance = parseFloat(targetUser.credits || '0');
          if (currentBalance < input.amount) throw new TRPCError({ code: 'BAD_REQUEST', message: 'User has insufficient credits' });
          // addCredits with a negative amount both updates the balance and logs the transaction
          await addCredits(input.userId, -input.amount, 'admin_adjustment', `[DEDUCT] ${input.reason}`);
        }
        const updated = await db.getUserById(input.userId);
        return { success: true, newBalance: updated?.credits || '0' };
      }),

    getUserTransactions: protectedProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        return await db.getCreditTransactions(input.userId, input.limit, input.offset);
      }),
  }),
});

export type AppRouter = typeof appRouter;
