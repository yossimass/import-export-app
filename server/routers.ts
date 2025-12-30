import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: protectedProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // SHIPMENT WORKFLOW - Central entity connecting all steps
  // ============================================================================
  shipments: router({
    create: protectedProcedure
      .input(z.object({
        shipmentName: z.string(),
        productDescription: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const shipmentId = await db.createShipment({
          userId: ctx.user.id,
          shipmentName: input.shipmentName,
          productDescription: input.productDescription,
          status: "draft",
          workflowStep: 1,
        });
        return { shipmentId };
      }),

    get: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getShipmentById(input.shipmentId);
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
      .mutation(async ({ input }) => {
        await db.updateShipment(input.shipmentId, input.data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ shipmentId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteShipment(input.shipmentId);
        return { success: true };
      }),
  }),

  // ============================================================================
  // HTS SEARCH - AI-powered, evergreen
  // ============================================================================
  hts: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional(),
        shipmentId: z.number().optional(), // Link to workflow
      }))
      .query(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an HTS code expert. Provide accurate HTS codes with descriptions and risk assessments. Always include reasoning for your recommendations."
            },
            {
              role: "user",
              content: `Find HTS codes for: "${input.query}". Return ${input.limit || 10} results with code, description, duty rate estimate, and risk level (low/medium/high). Also explain why each code matches and provide alternatives if applicable.`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return [];

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        const results = parsed.results || parsed.codes || [];

        return results.map((item: any) => ({
          code: item.code || item.htsCode || "",
          description: item.description || "",
          dutyRate: item.dutyRate || item.rate || "varies",
          riskLevel: item.riskLevel || item.risk || "medium",
          reasoning: item.reasoning || item.rationale || "AI-generated match",
          alternatives: item.alternatives || [],
          confidence: item.confidence || 0.85,
        }));
      }),

    recommend: protectedProcedure
      .input(z.object({
        productDescription: z.string(),
        shipmentId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an HTS classification expert. Analyze product descriptions and recommend the most appropriate HTS code with detailed reasoning."
            },
            {
              role: "user",
              content: `Product: "${input.productDescription}". Recommend the best HTS code with: 1) Primary recommendation with confidence score, 2) Detailed reasoning, 3) Alternative codes with pros/cons, 4) Risk factors, 5) Classification tips.`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No recommendation generated");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return {
          primaryCode: parsed.primaryCode || parsed.recommended || "",
          confidence: parsed.confidence || 0.85,
          reasoning: parsed.reasoning || parsed.rationale || "",
          alternatives: parsed.alternatives || [],
          riskFactors: parsed.riskFactors || parsed.risks || [],
          classificationTips: parsed.classificationTips || parsed.tips || [],
        };
      }),
  }),

  // ============================================================================
  // TARIFF CALCULATOR - Enhanced with trade agreements and breakdowns
  // ============================================================================
  tariff: router({
    calculate: protectedProcedure
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
        shipmentId: z.number().optional(), // Link to workflow
      }))
      .mutation(async ({ input }) => {
        const prompt = `Calculate comprehensive tariff for:
HTS Code: ${input.htsCode}
Origin: ${input.originCountry}
Destination: ${input.destinationCountry}
Value: $${input.value}
${input.quantity ? `Quantity: ${input.quantity}` : ''}
${input.weight ? `Weight: ${input.weight} kg` : ''}
${input.incoterm ? `Incoterm: ${input.incoterm}` : ''}
${input.freightCost ? `Freight: $${input.freightCost}` : ''}
${input.insuranceCost ? `Insurance: $${input.insuranceCost}` : ''}

Provide:
1. MFN (Most Favored Nation) rate
2. Preferential rate (if applicable trade agreement exists)
3. Additional duties (Section 301, antidumping, etc.)
4. Applied rate (final rate used)
5. Trade agreement name (USMCA, GSP, etc.)
6. Exclusion status
7. Duty amount breakdown
8. Merchandise Processing Fee (MPF)
9. Harbor Maintenance Fee (HMF) if applicable
10. Total duties and fees
11. Landed cost
12. Rate source and citation
13. Detailed rationale for rate determination
14. Alternative scenarios (different trade agreements, different classifications)
15. Effective date of rates

Return as JSON with all fields.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a customs duty calculation expert with knowledge of current tariff rates, trade agreements, and additional duties. Provide accurate, detailed calculations with full explainability."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No calculation generated");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        // Save calculation to shipment if linked
        if (input.shipmentId) {
          await db.updateShipment(input.shipmentId, {
            lastCalculation: {
              appliedRate: parsed.appliedRate || parsed.rate || 0,
              dutyAmount: parsed.dutyAmount || 0,
              landedCost: parsed.landedCost || input.value,
              tradeAgreement: parsed.tradeAgreement,
              rationale: parsed.rationale,
              calculatedAt: new Date().toISOString(),
            },
            workflowStep: 2,
            status: "calculating",
          });
        }

        return {
          mfnRate: parsed.mfnRate || parsed.mfn || 0,
          preferentialRate: parsed.preferentialRate || parsed.preferential,
          additionalDuties: parsed.additionalDuties || 0,
          appliedRate: parsed.appliedRate || parsed.rate || 0,
          tradeAgreement: parsed.tradeAgreement || parsed.agreement,
          exclusionStatus: parsed.exclusionStatus || "none",
          exclusionExpiration: parsed.exclusionExpiration,
          dutyAmount: parsed.dutyAmount || 0,
          mpf: parsed.mpf || parsed.merchandiseProcessingFee || 0,
          hmf: parsed.hmf || parsed.harborMaintenanceFee || 0,
          totalDuties: parsed.totalDuties || parsed.dutyAmount || 0,
          landedCost: parsed.landedCost || input.value,
          rateSource: parsed.rateSource || "CBP HTS 2025",
          rationale: parsed.rationale || "AI-generated calculation",
          alternatives: parsed.alternatives || [],
          effectiveDate: parsed.effectiveDate || new Date().toISOString(),
        };
      }),
  }),

  // ============================================================================
  // REGULATIONS - AI-powered, evergreen
  // ============================================================================
  regulations: router({
    search: protectedProcedure
      .input(z.object({
        countryCode: z.string(),
        regulationType: z.enum(["all", "import", "export", "licensing", "restrictions"]),
        htsCode: z.string().optional(),
        shipmentId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const prompt = `Find current trade regulations for:
Country: ${input.countryCode}
Type: ${input.regulationType}
${input.htsCode ? `HTS Code: ${input.htsCode}` : ''}

Provide comprehensive regulations including:
1. Import/export requirements
2. Licensing requirements
3. Restrictions and prohibitions
4. Documentation requirements
5. Compliance standards (FDA, FCC, CPSC, etc.)
6. Effective dates
7. Citation sources
8. Risk level for each regulation

Return as JSON array.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a trade regulations expert with current knowledge of import/export requirements, licensing, and compliance standards."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return [];

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return parsed.regulations || parsed.results || [];
      }),
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
        const buffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `${ctx.user.id}/documents/${Date.now()}-${input.fileName}`;
        
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
          return await db.getShipmentDocuments(input.shipmentId);
        }
        return await db.getUserDocuments(ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDocument(input.documentId);
        return { success: true };
      }),
  }),

  // ============================================================================
  // CHECKLISTS - AI-generated compliance requirements
  // ============================================================================
  checklists: router({
    generate: protectedProcedure
      .input(z.object({
        shipmentId: z.number(),
        shipmentType: z.enum(["import", "export"]),
        originCountry: z.string(),
        destinationCountry: z.string(),
        productCategory: z.string(),
        htsCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Generate comprehensive compliance checklist for:
Type: ${input.shipmentType}
From: ${input.originCountry}
To: ${input.destinationCountry}
Product: ${input.productCategory}
${input.htsCode ? `HTS: ${input.htsCode}` : ''}

Create detailed checklist with:
1. Task name
2. Description
3. Required/Optional/Conditional
4. Document type needed
5. Completion status (false by default)
6. Risk level if not completed
7. Regulatory authority
8. Deadline/timing

Return as JSON with items array.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a trade compliance expert who creates comprehensive, actionable checklists for import/export operations."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No checklist generated");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        const items = (parsed.items || parsed.checklist || []).map((item: any) => ({
          ...item,
          completed: false,
        }));

        // Update shipment
        await db.updateShipment(input.shipmentId, {
          workflowStep: 4,
          status: "reviewing",
        });

        return {
          checklistId: input.shipmentId,
          items,
        };
      }),
  }),

  // ============================================================================
  // UTILITIES - Currency, shipping estimates
  // ============================================================================
  utilities: router({
    convertCurrency: protectedProcedure
      .input(z.object({
        amount: z.number(),
        from: z.string(),
        to: z.string(),
      }))
      .query(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a currency exchange expert with current market rates."
            },
            {
              role: "user",
              content: `Convert ${input.amount} ${input.from} to ${input.to}. Provide exchange rate and converted amount as JSON.`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Conversion failed");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return {
          convertedAmount: parsed.convertedAmount || parsed.amount || 0,
          exchangeRate: parsed.exchangeRate || parsed.rate || 1,
          timestamp: new Date().toISOString(),
        };
      }),

    estimateShipping: protectedProcedure
      .input(z.object({
        originCountry: z.string(),
        destinationCountry: z.string(),
        weight: z.number(),
        dimensions: z.object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
        }).optional(),
      }))
      .query(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a logistics expert who estimates shipping costs."
            },
            {
              role: "user",
              content: `Estimate shipping cost from ${input.originCountry} to ${input.destinationCountry} for ${input.weight}kg. Provide estimates for air, sea, and express as JSON.`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Estimation failed");

        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),
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
      .mutation(async ({ input }) => {
        await db.deleteAlert(input.alertId);
        return { success: true };
      }),
  }),

  // ============================================================================
  // CHAT ASSISTANT
  // ============================================================================
  chat: router({
    send: protectedProcedure
      .input(z.object({
        message: z.string(),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const conversationId = input.conversationId || `conv-${Date.now()}`;

        // Save user message
        await db.saveChatMessage(ctx.user.id, conversationId, "user" as const, input.message);

        // Get AI response
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a trade compliance expert assistant. Help users with HTS codes, tariff calculations, regulations, and documentation requirements. Always provide detailed, accurate information with sources."
            },
            {
              role: "user",
              content: input.message
            }
          ],
        });

        const content = response.choices[0]?.message?.content;
        const aiMessage = typeof content === 'string' ? content : "I apologize, I couldn't generate a response.";

        // Save AI response
        await db.saveChatMessage(ctx.user.id, conversationId, "assistant" as const, aiMessage);

        return {
          message: aiMessage,
          conversationId,
        };
      }),

    getHistory: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        return await db.getChatHistory(ctx.user.id, input.conversationId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
