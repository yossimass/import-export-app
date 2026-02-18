import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Credits system
  credits: decimal("credits", { precision: 15, scale: 4 }).default("0").notNull(),
  initialSearchesUsed: int("initialSearchesUsed").default(0).notNull(), // Free tier: 5 initial searches
  monthlySearchesUsed: int("monthlySearchesUsed").default(0).notNull(), // Free tier: 1 search/month
  lastMonthlyReset: timestamp("lastMonthlyReset").defaultNow().notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Shipments - The central workflow entity
 * Stores user's shipment workflow state and decisions
 * All trade data (HTS, tariffs, regulations) is fetched from AI in real-time
 */
export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Workflow state
  status: mysqlEnum("status", ["draft", "calculating", "documenting", "reviewing", "complete"]).default("draft").notNull(),
  workflowStep: int("workflowStep").default(1).notNull(), // 1=HTS, 2=Tariff, 3=Docs, 4=Compliance
  
  // User inputs (saved for continuity)
  shipmentName: varchar("shipmentName", { length: 255 }).notNull(),
  productDescription: text("productDescription"),
  htsCode: varchar("htsCode", { length: 20 }),
  originCountry: varchar("originCountry", { length: 3 }),
  destinationCountry: varchar("destinationCountry", { length: 3 }),
  quantity: decimal("quantity", { precision: 15, scale: 4 }),
  weight: decimal("weight", { precision: 15, scale: 4 }),
  weightUnit: varchar("weightUnit", { length: 10 }),
  value: decimal("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  incoterm: varchar("incoterm", { length: 10 }),
  freightCost: decimal("freightCost", { precision: 15, scale: 2 }),
  insuranceCost: decimal("insuranceCost", { precision: 15, scale: 2 }),
  
  // Cached AI results (for display continuity, not source of truth)
  lastCalculation: json("lastCalculation").$type<{
    appliedRate: number;
    dutyAmount: number;
    landedCost: number;
    tradeAgreement?: string;
    rationale?: string;
    calculatedAt: string;
  }>(),
  
  // Compliance checklist (cached AI-generated checklist)
  complianceChecklist: json("complianceChecklist").$type<{
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
  userOverrides: json("userOverrides").$type<Array<{
    field: string;
    originalValue: any;
    newValue: any;
    rationale: string;
    timestamp: string;
  }>>(),
  
  // Risk assessment (AI-generated, cached)
  riskScore: int("riskScore"),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

/**
 * Documents - User-uploaded files linked to shipments
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId"),
  userId: int("userId").notNull(),
  
  documentType: varchar("documentType", { length: 100 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  
  status: mysqlEnum("status", ["uploaded", "verified", "rejected"]).default("uploaded"),
  
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Alerts - User notification subscriptions
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  alertType: mysqlEnum("alertType", ["tariff_change", "regulation_update", "license_renewal", "shipment_status"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  
  htsCode: varchar("htsCode", { length: 20 }),
  countryCode: varchar("countryCode", { length: 3 }),
  shipmentId: int("shipmentId"),
  
  read: boolean("read").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Chat Messages - AI assistant conversation history
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: varchar("conversationId", { length: 100 }).notNull(),
  
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Checklists - Generated compliance checklists for shipments
 */
export const checklists = mysqlTable("checklists", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  userId: int("userId").notNull(),
  
  htsCode: varchar("htsCode", { length: 20 }),
  originCountry: varchar("originCountry", { length: 3 }),
  destinationCountry: varchar("destinationCountry", { length: 3 }),
  
  // Checklist items stored as JSON array
  items: json("items").$type<Array<{
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = typeof checklists.$inferInsert;

/**
 * Credit Transactions - Track all credit additions and deductions
 */
export const creditTransactions = mysqlTable("creditTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  amount: decimal("amount", { precision: 15, scale: 4 }).notNull(), // Positive for additions, negative for deductions
  balanceAfter: decimal("balanceAfter", { precision: 15, scale: 4 }).notNull(),
  
  type: mysqlEnum("type", ["purchase", "subscription_refill", "usage", "refund", "admin_adjustment"]).notNull(),
  description: text("description").notNull(),
  
  // LLM usage tracking (for usage transactions)
  llmCost: decimal("llmCost", { precision: 15, scale: 6 }), // Actual LLM cost in USD
  markupRate: decimal("markupRate", { precision: 5, scale: 2 }), // e.g., 7.00 for 700%
  
  // Related entities
  featureUsed: varchar("featureUsed", { length: 100 }), // "hts_search", "tariff_calc", etc.
  shipmentId: int("shipmentId"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

/**
 * Subscriptions - Track recurring credit subscriptions
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }).notNull(),
  
  tier: varchar("tier", { length: 50 }).notNull(), // "$10", "$20", "$50", etc.
  interval: mysqlEnum("interval", ["month", "year"]).notNull(),
  creditsPerPeriod: decimal("creditsPerPeriod", { precision: 15, scale: 4 }).notNull(),
  
  status: mysqlEnum("status", ["active", "cancelled", "past_due", "unpaid"]).notNull(),
  
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
