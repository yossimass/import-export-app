import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp as pgTimestamp, varchar } from "drizzle-orm/pg-core";

// All timestamps are stored as timestamptz (UTC-safe across environments)
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true });

// Postgres enums are named types shared across tables, so each needs a unique name
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const shipmentStatus = pgEnum("shipment_status", ["draft", "calculating", "documenting", "reviewing", "complete"]);
export const riskLevel = pgEnum("risk_level", ["low", "medium", "high"]);
export const cooStatus = pgEnum("coo_status", ["none", "draft", "issued"]);
export const documentStatus = pgEnum("document_status", ["uploaded", "verified", "rejected"]);
export const alertType = pgEnum("alert_type", ["tariff_change", "regulation_update", "license_renewal", "shipment_status"]);
export const chatRole = pgEnum("chat_role", ["user", "assistant"]);
export const creditTransactionType = pgEnum("credit_transaction_type", ["purchase", "subscription_refill", "usage", "refund", "admin_adjustment"]);
export const subscriptionInterval = pgEnum("subscription_interval", ["month", "year"]);
export const subscriptionStatus = pgEnum("subscription_status", ["active", "cancelled", "past_due", "unpaid"]);
export const certificateStatus = pgEnum("certificate_status", ["draft", "issued", "revoked"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(), // Clerk user id
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  
  // Credits system
  credits: numeric("credits", { precision: 15, scale: 4 }).default("0").notNull(),
  initialSearchesUsed: integer("initialSearchesUsed").default(0).notNull(), // Free tier: 5 initial searches
  monthlySearchesUsed: integer("monthlySearchesUsed").default(0).notNull(), // Free tier: 1 search/month
  lastMonthlyReset: timestamp("lastMonthlyReset").defaultNow().notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Shipments - The central workflow entity
 * Stores user's shipment workflow state and decisions
 * All trade data (HTS, tariffs, regulations) is fetched from AI in real-time
 */
export const shipments = pgTable("shipments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  
  // Workflow state
  status: shipmentStatus("status").default("draft").notNull(),
  workflowStep: integer("workflowStep").default(1).notNull(), // 1=HTS, 2=Tariff, 3=Docs, 4=Compliance
  
  // User inputs (saved for continuity)
  shipmentName: varchar("shipmentName", { length: 255 }).notNull(),
  productDescription: text("productDescription"),
  htsCode: varchar("htsCode", { length: 20 }),
  originCountry: varchar("originCountry", { length: 3 }),
  destinationCountry: varchar("destinationCountry", { length: 3 }),
  quantity: numeric("quantity", { precision: 15, scale: 4 }),
  weight: numeric("weight", { precision: 15, scale: 4 }),
  weightUnit: varchar("weightUnit", { length: 10 }),
  value: numeric("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  incoterm: varchar("incoterm", { length: 10 }),
  freightCost: numeric("freightCost", { precision: 15, scale: 2 }),
  insuranceCost: numeric("insuranceCost", { precision: 15, scale: 2 }),
  
  // Cached AI results (for display continuity, not source of truth)
  lastCalculation: jsonb("lastCalculation").$type<{
    appliedRate: number | string; // e.g. "16.5%" from the HTS schedule
    dutyAmount: number;
    landedCost: number;
    tradeAgreement?: string;
    rationale?: string;
    calculatedAt: string;
  }>(),
  
  // Compliance checklist (cached AI-generated checklist)
  complianceChecklist: jsonb("complianceChecklist").$type<{
    items: Array<{
      task: string;
      description: string;
      priority: string;
      category: string;
      riskLevel: string;
      deadline?: string;
      consequences?: string;
      completed: boolean;
    }>;
    generatedAt: string;
  }>(),
  
  // User decisions and overrides
  userOverrides: jsonb("userOverrides").$type<Array<{
    field: string;
    originalValue: any;
    newValue: any;
    rationale: string;
    timestamp: string;
  }>>(),
  
  // Risk assessment (AI-generated, cached)
  riskScore: integer("riskScore"),
  riskLevel: riskLevel("riskLevel"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  completedAt: timestamp("completedAt"),

  // Certificate of Origin linkage
  cooStatus: cooStatus("cooStatus").default("none").notNull(),
  cooId: integer("cooId"),

  // Purchase Order import data (extracted from uploaded PO)
  poData: jsonb("poData").$type<{
    poNumber?: string;
    poDate?: string;
    buyerName?: string;
    buyerAddress?: string;
    sellerName?: string;
    sellerAddress?: string;
    shipToName?: string;
    shipToAddress?: string;
    incoterms?: string;
    currency?: string;
    paymentTerms?: string;
    deliveryDate?: string;
    lineItems?: Array<{
      lineNumber?: number;
      description: string;
      quantity?: string;
      unit?: string;
      unitPrice?: string;
      totalPrice?: string;
      htsCode?: string;
      countryOfOrigin?: string;
    }>;
    totalValue?: string;
    notes?: string;
    fileUrl?: string;
    extractedAt?: string;
  }>(),
}, t => [index("shipments_user_idx").on(t.userId, t.updatedAt)]);

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

/**
 * Documents - User-uploaded files linked to shipments
 */
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shipmentId: integer("shipmentId"),
  userId: integer("userId").notNull(),
  
  documentType: varchar("documentType", { length: 100 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  
  status: documentStatus("status").default("uploaded"),
  
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, t => [index("documents_user_idx").on(t.userId), index("documents_shipment_idx").on(t.shipmentId)]);

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Alerts - User notification subscriptions
 */
export const alerts = pgTable("alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  
  alertType: alertType("alertType").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  
  htsCode: varchar("htsCode", { length: 20 }),
  countryCode: varchar("countryCode", { length: 3 }),
  shipmentId: integer("shipmentId"),
  
  read: boolean("read").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, t => [index("alerts_user_idx").on(t.userId)]);

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Chat Messages - AI assistant conversation history
 */
export const chatMessages = pgTable("chatMessages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  conversationId: varchar("conversationId", { length: 100 }).notNull(),
  
  role: chatRole("role").notNull(),
  content: text("content").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, t => [index("chat_messages_conversation_idx").on(t.userId, t.conversationId)]);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Checklists - Generated compliance checklists for shipments
 */
export const checklists = pgTable("checklists", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shipmentId: integer("shipmentId").notNull(),
  userId: integer("userId").notNull(),
  
  htsCode: varchar("htsCode", { length: 20 }),
  originCountry: varchar("originCountry", { length: 3 }),
  destinationCountry: varchar("destinationCountry", { length: 3 }),
  
  // Checklist items stored as JSON array
  items: jsonb("items").$type<Array<{
    task: string;
    description: string;
    priority: string;
    category: string;
    riskLevel: string;
    deadline?: string;
    consequences?: string;
    completed: boolean;
  }>>().notNull(),
  
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, t => [index("checklists_shipment_idx").on(t.shipmentId)]);

export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = typeof checklists.$inferInsert;

/**
 * Credit Transactions - Track all credit additions and deductions
 */
export const creditTransactions = pgTable("creditTransactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  
  amount: numeric("amount", { precision: 15, scale: 4 }).notNull(), // Positive for additions, negative for deductions
  balanceAfter: numeric("balanceAfter", { precision: 15, scale: 4 }).notNull(),
  
  type: creditTransactionType("type").notNull(),
  description: text("description").notNull(),
  
  // LLM usage tracking (for usage transactions)
  llmCost: numeric("llmCost", { precision: 15, scale: 6 }), // Actual LLM cost in USD
  markupRate: numeric("markupRate", { precision: 5, scale: 2 }), // e.g., 7.00 for 700%
  
  // Related entities
  featureUsed: varchar("featureUsed", { length: 100 }), // "hts_search", "tariff_calc", etc.
  shipmentId: integer("shipmentId"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, t => [index("credit_transactions_user_idx").on(t.userId, t.createdAt)]);

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

/**
 * Subscriptions - Track recurring credit subscriptions
 */
export const subscriptions = pgTable("subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }).notNull(),
  
  tier: varchar("tier", { length: 50 }).notNull(), // "$10", "$20", "$50", etc.
  interval: subscriptionInterval("interval").notNull(),
  creditsPerPeriod: numeric("creditsPerPeriod", { precision: 15, scale: 4 }).notNull(),
  
  status: subscriptionStatus("status").notNull(),
  
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, t => [index("subscriptions_user_idx").on(t.userId)]);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Certificates of Origin
 * Stores generated certificates linked to shipments
 */
export const certificates = pgTable("certificates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").notNull(),
  shipmentId: integer("shipmentId"),

  // Certificate metadata
  certificateNumber: varchar("certificateNumber", { length: 50 }).notNull(),
  status: certificateStatus("status").default("draft").notNull(),
  tradeAgreement: varchar("tradeAgreement", { length: 50 }).default("GENERIC"),
  agreementFields: jsonb("agreementFields").$type<Record<string, string>>(),

  // Exporter info
  exporterName: varchar("exporterName", { length: 255 }).notNull(),
  exporterAddress: text("exporterAddress"),
  exporterCountry: varchar("exporterCountry", { length: 3 }),
  exporterSignatory: varchar("exporterSignatory", { length: 255 }),

  // Consignee info
  consigneeName: varchar("consigneeName", { length: 255 }).notNull(),
  consigneeAddress: text("consigneeAddress"),
  consigneeCountry: varchar("consigneeCountry", { length: 3 }),

  // Goods description
  htsCode: varchar("htsCode", { length: 20 }),
  goodsDescription: text("goodsDescription"),
  quantity: varchar("quantity", { length: 100 }),
  quantityUnit: varchar("quantityUnit", { length: 50 }),
  grossWeight: varchar("grossWeight", { length: 100 }),
  netWeight: varchar("netWeight", { length: 100 }),
  marksNumbers: text("marksNumbers"),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),

  // Origin details
  countryOfOrigin: varchar("countryOfOrigin", { length: 3 }).notNull(),
  originCriterion: varchar("originCriterion", { length: 10 }), // A, B, C, D, E, F
  producerDeclaration: text("producerDeclaration"),

  // Transport details
  departureDate: varchar("departureDate", { length: 20 }),
  vessel: varchar("vessel", { length: 255 }),
  portOfLoading: varchar("portOfLoading", { length: 255 }),
  portOfDischarge: varchar("portOfDischarge", { length: 255 }),
  destinationCountry: varchar("destinationCountry", { length: 3 }),

  // Certifying body
  chamberName: varchar("chamberName", { length: 255 }),
  issueDate: varchar("issueDate", { length: 20 }),
  issuePlace: varchar("issuePlace", { length: 255 }),

  // AI validation results
  validationResult: jsonb("validationResult").$type<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
    originCriterionExplanation: string;
  }>(),

  // PDF storage
  pdfUrl: text("pdfUrl"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, t => [index("certificates_user_idx").on(t.userId), index("certificates_shipment_idx").on(t.shipmentId)]);

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;
