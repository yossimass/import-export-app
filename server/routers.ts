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
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // HTS Code Search and Lookup - AI-powered real-time
  hts: router({
    search: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().optional().default(20) }))
      .query(async ({ input }) => {
        // Use AI to look up HTS codes in real-time from current database
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to the current Harmonized Tariff Schedule (HTS) database. Provide accurate, up-to-date HTS codes based on the official 2025 HTS.'
            },
            {
              role: 'user',
              content: `Search for HTS codes matching: "${input.query}". Return up to ${input.limit} results. For each result provide: code (10-digit HTS code), description (official product description), category (product category), unit (unit of measure like kg, dozen, number). Return as JSON with "results" array.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(response.choices[0].message.content as string);
        return parsed.results || [];
      }),

    getByCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        // Use AI to look up specific HTS code with current information
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to the current Harmonized Tariff Schedule (HTS) database.'
            },
            {
              role: 'user',
              content: `Look up HTS code: ${input.code}. Provide complete details: code, description, category, unit, notes (additional classification information). Return as JSON object.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        return JSON.parse(response.choices[0].message.content as string);
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
              content: "You are an expert in HTS (Harmonized Tariff Schedule) codes. Based on product descriptions, recommend the most appropriate current HTS codes with explanations."
            },
            {
              role: "user",
              content: `Recommend HTS codes for: "${input.productDescription}". Provide 3-5 recommendations with code, description, relevance explanation, and confidence level (high/medium/low).`
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

  // Tariff Calculator - AI-powered with current rates
  tariff: router({
    calculate: protectedProcedure
      .input(z.object({
        htsCode: z.string(),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
        value: z.number().positive(),
      }))
      .mutation(async ({ input }) => {
        // Use AI to calculate current tariff rates
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to current tariff rates, trade agreements, and duty calculations. Provide accurate, up-to-date tariff information.'
            },
            {
              role: 'user',
              content: `Calculate tariff for HTS code ${input.htsCode} from ${input.originCountry} to ${input.destinationCountry}, value $${input.value}. Provide: rate (tariff percentage), dutyAmount (calculated duty in USD), tradeAgreement (applicable trade agreement or null), effectiveDate (current date), additionalFees (array of {name, amount} or empty), totalCost (value + duty + fees). Return as JSON object.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        return JSON.parse(response.choices[0].message.content as string);
      }),

    getRates: publicProcedure
      .input(z.object({
        htsCode: z.string(),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
      }))
      .query(async ({ input }) => {
        // Get current tariff rate without calculation
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to current tariff rates and trade agreements.'
            },
            {
              role: 'user',
              content: `What is the current tariff rate for HTS code ${input.htsCode} from ${input.originCountry} to ${input.destinationCountry}? Provide: rate (percentage), tradeAgreement (applicable agreement or null), effectiveDate. Return as JSON object.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        return JSON.parse(response.choices[0].message.content as string);
      }),
  }),

  // Trade Regulations - AI-powered with current laws
  regulations: router({
    search: publicProcedure
      .input(z.object({
        countryCode: z.string().length(3).optional(),
        regulationType: z.enum(['import_restriction', 'export_control', 'licensing_requirement', 'documentation_requirement', 'prohibited_goods', 'all']).optional(),
        query: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // Use AI to search current trade regulations
        let prompt = 'List current trade regulations';
        if (input.countryCode) prompt += ` for ${input.countryCode}`;
        if (input.regulationType && input.regulationType !== 'all') prompt += ` of type ${input.regulationType}`;
        if (input.query) prompt += ` matching: "${input.query}"`;
        
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to current international trade regulations, import/export restrictions, and licensing requirements.'
            },
            {
              role: 'user',
              content: `${prompt}. Provide up to 20 regulations with: title, description, requirements, regulationType, countryCode, effectiveDate, documentationNeeded, sourceUrl (official government URL). Return as JSON with "regulations" array.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(response.choices[0].message.content as string);
        return parsed.regulations || [];
      }),

    getByCountry: publicProcedure
      .input(z.object({ countryCode: z.string().length(3) }))
      .query(async ({ input }) => {
        // Get all current regulations for a specific country
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert with access to current international trade regulations.'
            },
            {
              role: 'user',
              content: `List all current major trade regulations for ${input.countryCode}. Include import restrictions, export controls, licensing requirements, documentation requirements, and prohibited goods. Provide: title, description, requirements, regulationType, effectiveDate, documentationNeeded, sourceUrl. Return as JSON with "regulations" array.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(response.choices[0].message.content as string);
        return parsed.regulations || [];
      }),
  }),

  // Documents - User-generated content (still uses database)
  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserDocuments(ctx.user.id);
    }),

    upload: protectedProcedure
      .input(z.object({
        filename: z.string(),
        fileData: z.string(), // base64 encoded
        documentType: z.enum(['certificate_of_origin', 'commercial_invoice', 'packing_list', 'customs_declaration', 'other']),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `documents/${ctx.user.id}/${Date.now()}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, 'application/octet-stream');
        
        return await db.createDocument({
          userId: ctx.user.id,
          filename: input.filename,
          fileUrl: url,
          fileKey,
          documentType: input.documentType,
          description: input.description,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.deleteDocument(input.documentId, ctx.user.id);
      }),
  }),

  // Checklists - User-generated content
  checklists: router({
    generate: protectedProcedure
      .input(z.object({
        shipmentType: z.enum(['import', 'export']),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
        productCategory: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Use AI to generate current compliance checklist
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a trade compliance expert. Generate comprehensive, current compliance checklists for import/export operations.'
            },
            {
              role: 'user',
              content: `Generate a compliance checklist for ${input.shipmentType} of ${input.productCategory} from ${input.originCountry} to ${input.destinationCountry}. Include all current required documents, permits, inspections, and compliance steps. Return as JSON with "items" array containing {task, description, required, documentType}.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        const parsed = JSON.parse(response.choices[0].message.content as string);
        const checklistId = await db.createChecklist({
          userId: ctx.user.id,
          title: `${input.shipmentType.toUpperCase()}: ${input.productCategory} (${input.originCountry} → ${input.destinationCountry})`,
          shipmentType: input.shipmentType,
          originCountry: input.originCountry,
          destinationCountry: input.destinationCountry,
          items: parsed.items,
        });
        
        return { checklistId, items: parsed.items };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserChecklists(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getChecklist(input.checklistId, ctx.user.id);
      }),

    updateItem: protectedProcedure
      .input(z.object({
        checklistId: z.number(),
        itemIndex: z.number(),
        completed: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateChecklistItem(input.checklistId, ctx.user.id, input.itemIndex, input.completed);
      }),

    delete: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.deleteChecklist(input.checklistId, ctx.user.id);
      }),
  }),

  // Utilities - AI-powered real-time calculations
  utilities: router({
    convertCurrency: publicProcedure
      .input(z.object({
        amount: z.number(),
        from: z.string().length(3),
        to: z.string().length(3),
      }))
      .query(async ({ input }) => {
        // Use AI to get current exchange rates
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a financial expert with access to current exchange rates.'
            },
            {
              role: 'user',
              content: `Convert ${input.amount} ${input.from} to ${input.to} using current exchange rates. Provide: convertedAmount, exchangeRate, timestamp. Return as JSON object.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        return JSON.parse(response.choices[0].message.content as string);
      }),

    estimateShipping: publicProcedure
      .input(z.object({
        weight: z.number().positive(),
        dimensions: z.object({
          length: z.number().positive(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
        originCountry: z.string().length(3),
        destinationCountry: z.string().length(3),
        shippingMethod: z.enum(['air', 'sea', 'ground']),
      }))
      .query(async ({ input }) => {
        // Use AI to estimate current shipping costs
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a logistics expert with knowledge of current shipping rates and transit times.'
            },
            {
              role: 'user',
              content: `Estimate shipping cost for ${input.weight}kg package (${input.dimensions.length}x${input.dimensions.width}x${input.dimensions.height}cm) from ${input.originCountry} to ${input.destinationCountry} via ${input.shippingMethod}. Provide: estimatedCost (USD), transitDays, carrier (typical carrier name). Return as JSON object.`
            }
          ],
          response_format: { type: 'json_object' }
        });
        
        return JSON.parse(response.choices[0].message.content as string);
      }),
  }),

  // Alerts - User preferences stored in database
  alerts: router({
    subscribe: protectedProcedure
      .input(z.object({
        alertType: z.enum(['tariff_change', 'regulation_update', 'license_renewal', 'shipment_status']),
        htsCode: z.string().optional(),
        countryCode: z.string().length(3).optional(),
        email: z.string().email(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createAlert({
          userId: ctx.user.id,
          alertType: input.alertType,
          htsCode: input.htsCode,
          countryCode: input.countryCode,
          email: input.email,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAlerts(ctx.user.id);
    }),

    delete: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.deleteAlert(input.alertId, ctx.user.id);
      }),
  }),

  // Chat Assistant - AI-powered trade compliance chatbot
  chat: router({
    send: protectedProcedure
      .input(z.object({
        message: z.string(),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get conversation history if exists
        const history = input.conversationId 
          ? await db.getChatHistory(input.conversationId, ctx.user.id)
          : [];

        // Build messages array
        const messages = [
          {
            role: 'system' as const,
            content: 'You are a trade compliance expert assistant. Help users with HTS code lookups, tariff calculations, trade regulations, documentation requirements, and general import/export questions. Provide accurate, current information based on 2025 trade regulations.'
          },
          ...history.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          {
            role: 'user' as const,
            content: input.message
          }
        ];

        // Get AI response
        const response = await invokeLLM({ messages });
        const assistantMessage = typeof response.choices[0].message.content === 'string'
          ? response.choices[0].message.content
          : JSON.stringify(response.choices[0].message.content);

        // Save conversation
        const sessionId = input.conversationId ? String(input.conversationId) : await db.createConversation(ctx.user.id);
        await db.saveChatMessage(sessionId, 'user', input.message, ctx.user.id);
        await db.saveChatMessage(sessionId, 'assistant', assistantMessage, ctx.user.id);

        return {
          conversationId: sessionId,
          message: assistantMessage,
        };
      }),

    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserConversations(ctx.user.id);
    }),

    getHistory: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ input, ctx }) => {
        return await db.getChatHistory(input.conversationId, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
