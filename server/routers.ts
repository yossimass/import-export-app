import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // HTS Code Search and Lookup
  hts: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        return db.searchHtsCodes(input.query, input.limit);
      }),

    getByCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return db.getHtsCodeByCode(input.code);
      }),

    recommendCode: protectedProcedure
      .input(z.object({
        productDescription: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an expert in HTS (Harmonized Tariff Schedule) codes. Based on product descriptions, recommend the most appropriate HTS codes with explanations. Return a JSON array of recommendations."
            },
            {
              role: "user",
              content: `Product description: ${input.productDescription}\n\nProvide 3-5 most relevant HTS code recommendations with brief explanations.`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hts_recommendations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code: { type: "string", description: "HTS code" },
                        description: { type: "string", description: "What this code covers" },
                        relevance: { type: "string", description: "Why this code matches the product" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] }
                      },
                      required: ["code", "description", "relevance", "confidence"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["recommendations"],
                additionalProperties: false
              }
            }
          }
        });

        const content = typeof response.choices[0].message.content === 'string'
          ? response.choices[0].message.content
          : JSON.stringify(response.choices[0].message.content);
        const result = JSON.parse(content);
        return result.recommendations;
      }),
  }),

  // Tariff Calculator
  tariff: router({
    calculate: protectedProcedure
      .input(z.object({
        htsCode: z.string(),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
        value: z.number().positive(),
      }))
      .mutation(async ({ input }) => {
        const htsRecord = await db.getHtsCodeByCode(input.htsCode);
        if (!htsRecord) {
          throw new Error("HTS code not found");
        }

        const tariffRate = await db.getTariffRate(
          htsRecord.id,
          input.originCountry,
          input.destinationCountry
        );

        if (!tariffRate) {
          return {
            htsCode: input.htsCode,
            rate: 0,
            dutyAmount: 0,
            totalValue: input.value,
            message: "No tariff rate found for this route. Using 0% default.",
          };
        }

        const rateDecimal = parseFloat(tariffRate.rate) / 100;
        const dutyAmount = input.value * rateDecimal;
        const totalValue = input.value + dutyAmount;

        return {
          htsCode: input.htsCode,
          rate: parseFloat(tariffRate.rate),
          dutyAmount,
          totalValue,
          tradeAgreement: tariffRate.tradeAgreement,
          effectiveDate: tariffRate.effectiveDate,
        };
      }),
  }),

  // Trade Regulations
  regulations: router({
    getByCountry: protectedProcedure
      .input(z.object({
        countryCode: z.string().length(3),
        regulationType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getTradeRegulations(input.countryCode, input.regulationType);
      }),
  }),

  // Document Management
  documents: router({
    list: protectedProcedure
      .input(z.object({
        documentType: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return db.getUserDocuments(ctx.user.id, input.documentType);
      }),

    upload: protectedProcedure
      .input(z.object({
        documentType: z.enum([
          "certificate_of_origin",
          "commercial_invoice",
          "packing_list",
          "customs_declaration",
          "bill_of_lading",
          "export_license",
          "import_license",
          "other"
        ]),
        title: z.string().min(1),
        description: z.string().optional(),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
        shipmentReference: z.string().optional(),
        expiryDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `users/${ctx.user.id}/documents/${nanoid()}-${input.fileName}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        await db.createTradeDocument({
          userId: ctx.user.id,
          documentType: input.documentType,
          title: input.title,
          description: input.description || null,
          fileKey,
          fileUrl: url,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          shipmentReference: input.shipmentReference || null,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        });

        return { success: true, url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTradeDocument(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Compliance Checklists
  checklists: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserChecklists(ctx.user.id);
    }),

    generate: protectedProcedure
      .input(z.object({
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
        htsCode: z.string().optional(),
        productDescription: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are an international trade compliance expert. Generate comprehensive import/export compliance checklists based on country routes and product information."
            },
            {
              role: "user",
              content: `Generate a compliance checklist for:\n- Origin: ${input.originCountry}\n- Destination: ${input.destinationCountry}\n- Product: ${input.productDescription}\n${input.htsCode ? `- HTS Code: ${input.htsCode}` : ''}\n\nInclude all required documents, certifications, licenses, and compliance steps.`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "compliance_checklist",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        category: { type: "string" },
                        item: { type: "string" },
                        description: { type: "string" },
                        required: { type: "boolean" }
                      },
                      required: ["id", "category", "item", "description", "required"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["items"],
                additionalProperties: false
              }
            }
          }
        });

        const content = typeof response.choices[0].message.content === 'string'
          ? response.choices[0].message.content
          : JSON.stringify(response.choices[0].message.content);
        const result = JSON.parse(content);
        
        await db.createChecklist({
          userId: ctx.user.id,
          title: `${input.originCountry} → ${input.destinationCountry}: ${input.productDescription}`,
          originCountry: input.originCountry,
          destinationCountry: input.destinationCountry,
          htsCode: input.htsCode || null,
          productDescription: input.productDescription,
          checklistItems: JSON.stringify(result.items),
          completedItems: JSON.stringify([]),
          status: "draft",
        });

        return result.items;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        completedItems: z.array(z.string()).optional(),
        status: z.enum(["draft", "in_progress", "completed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updates: any = {};
        if (input.completedItems) {
          updates.completedItems = JSON.stringify(input.completedItems);
        }
        if (input.status) {
          updates.status = input.status;
        }
        
        await db.updateChecklist(input.id, ctx.user.id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteChecklist(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // AI Chatbot
  chat: router({
    send: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        sessionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await db.saveChatMessage({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          role: "user",
          content: input.message,
        });

        // Get chat history
        const history = await db.getChatHistory(ctx.user.id, input.sessionId, 20);

        // Build messages for LLM
        const messages = [
          {
            role: "system" as const,
            content: "You are an expert international trade compliance assistant. Help users with:\n- HTS code identification and classification\n- Import/export regulations and requirements\n- Tariff calculations and trade agreements\n- Documentation requirements\n- Customs procedures\n- Compliance best practices\n\nProvide accurate, actionable guidance based on international trade regulations."
          },
          ...history.slice(-10).map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
          }))
        ];

        const response = await invokeLLM({ messages });
        const assistantMessage = typeof response.choices[0].message.content === 'string' 
          ? response.choices[0].message.content 
          : JSON.stringify(response.choices[0].message.content);

        // Save assistant response
        await db.saveChatMessage({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          role: "assistant",
          content: assistantMessage,
        });

        return { message: assistantMessage };
      }),

    history: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return db.getChatHistory(ctx.user.id, input.sessionId);
      }),
  }),

  // Alerts
  alerts: router({
    list: protectedProcedure
      .input(z.object({
        unreadOnly: z.boolean().optional().default(false),
      }))
      .query(async ({ ctx, input }) => {
        return db.getUserAlerts(ctx.user.id, input.unreadOnly);
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markAlertAsRead(input.id, ctx.user.id);
        return { success: true };
      }),

    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getAlertPreferences(ctx.user.id);
      if (!prefs) {
        // Return defaults
        return {
          tariffChanges: true,
          regulationUpdates: true,
          licenseRenewals: true,
          shipmentUpdates: true,
          emailNotifications: true,
        };
      }
      return prefs;
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        tariffChanges: z.boolean().optional(),
        regulationUpdates: z.boolean().optional(),
        licenseRenewals: z.boolean().optional(),
        shipmentUpdates: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getAlertPreferences(ctx.user.id);
        
        await db.upsertAlertPreferences({
          userId: ctx.user.id,
          tariffChanges: input.tariffChanges ?? existing?.tariffChanges ?? true,
          regulationUpdates: input.regulationUpdates ?? existing?.regulationUpdates ?? true,
          licenseRenewals: input.licenseRenewals ?? existing?.licenseRenewals ?? true,
          shipmentUpdates: input.shipmentUpdates ?? existing?.shipmentUpdates ?? true,
          emailNotifications: input.emailNotifications ?? existing?.emailNotifications ?? true,
        });

        return { success: true };
      }),
  }),

  // Utilities
  utils: router({
    convertCurrency: protectedProcedure
      .input(z.object({
        amount: z.number(),
        from: z.string().length(3),
        to: z.string().length(3),
      }))
      .mutation(async ({ input }) => {
        // Use a simple exchange rate API or mock data
        // For demo, using approximate rates
        const rates: Record<string, number> = {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          JPY: 149.50,
          CNY: 7.24,
          CAD: 1.35,
          AUD: 1.52,
          INR: 83.12,
        };

        const fromRate = rates[input.from] || 1;
        const toRate = rates[input.to] || 1;
        const converted = (input.amount / fromRate) * toRate;

        return {
          amount: input.amount,
          from: input.from,
          to: input.to,
          converted: Math.round(converted * 100) / 100,
          rate: toRate / fromRate,
        };
      }),

    estimateShipping: protectedProcedure
      .input(z.object({
        weight: z.number().positive(), // kg
        length: z.number().positive(), // cm
        width: z.number().positive(),
        height: z.number().positive(),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
      }))
      .mutation(async ({ input }) => {
        // Simplified shipping cost estimation
        const volumetricWeight = (input.length * input.width * input.height) / 5000;
        const chargeableWeight = Math.max(input.weight, volumetricWeight);
        
        // Base rate per kg (simplified)
        const baseRate = 15;
        const estimatedCost = chargeableWeight * baseRate;

        return {
          chargeableWeight: Math.round(chargeableWeight * 100) / 100,
          estimatedCost: Math.round(estimatedCost * 100) / 100,
          currency: "USD",
          note: "This is an estimate. Actual costs may vary based on carrier and service level.",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
