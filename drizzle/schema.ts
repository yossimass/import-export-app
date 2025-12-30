import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * HTS codes database for product classification
 */
export const htsCodes = mysqlTable("hts_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description").notNull(),
  unit: varchar("unit", { length: 50 }),
  category: varchar("category", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: index("code_idx").on(table.code),
  categoryIdx: index("category_idx").on(table.category),
}));

export type HtsCode = typeof htsCodes.$inferSelect;
export type InsertHtsCode = typeof htsCodes.$inferInsert;

/**
 * Tariff rates between countries
 */
export const tariffRates = mysqlTable("tariff_rates", {
  id: int("id").autoincrement().primaryKey(),
  htsCodeId: int("hts_code_id").notNull(),
  originCountry: varchar("origin_country", { length: 3 }).notNull(), // ISO 3166-1 alpha-3
  destinationCountry: varchar("destination_country", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 4 }).notNull(), // percentage
  additionalDuties: text("additional_duties"), // JSON string for complex duty structures
  effectiveDate: timestamp("effective_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  tradeAgreement: varchar("trade_agreement", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  htsCodeIdx: index("hts_code_idx").on(table.htsCodeId),
  countriesIdx: index("countries_idx").on(table.originCountry, table.destinationCountry),
}));

export type TariffRate = typeof tariffRates.$inferSelect;
export type InsertTariffRate = typeof tariffRates.$inferInsert;

/**
 * Country-specific trade regulations
 */
export const tradeRegulations = mysqlTable("trade_regulations", {
  id: int("id").autoincrement().primaryKey(),
  countryCode: varchar("country_code", { length: 3 }).notNull(),
  regulationType: varchar("regulation_type", { length: 100 }).notNull(), // e.g., "import_restriction", "export_control"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  applicableProducts: text("applicable_products"), // JSON array of HTS codes or categories
  requirements: text("requirements").notNull(),
  documentationNeeded: text("documentation_needed"),
  effectiveDate: timestamp("effective_date").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().onUpdateNow().notNull(),
  sourceUrl: text("source_url"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  countryIdx: index("country_idx").on(table.countryCode),
  typeIdx: index("type_idx").on(table.regulationType),
}));

export type TradeRegulation = typeof tradeRegulations.$inferSelect;
export type InsertTradeRegulation = typeof tradeRegulations.$inferInsert;

/**
 * Trade documents stored in S3
 */
export const tradeDocuments = mysqlTable("trade_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  documentType: mysqlEnum("document_type", [
    "certificate_of_origin",
    "commercial_invoice",
    "packing_list",
    "customs_declaration",
    "bill_of_lading",
    "export_license",
    "import_license",
    "other"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: int("file_size"), // bytes
  shipmentReference: varchar("shipment_reference", { length: 100 }),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  typeIdx: index("type_idx").on(table.documentType),
}));

export type TradeDocument = typeof tradeDocuments.$inferSelect;
export type InsertTradeDocument = typeof tradeDocuments.$inferInsert;

/**
 * User alert preferences and history
 */
export const alertPreferences = mysqlTable("alert_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  tariffChanges: boolean("tariff_changes").default(true).notNull(),
  regulationUpdates: boolean("regulation_updates").default(true).notNull(),
  licenseRenewals: boolean("license_renewals").default(true).notNull(),
  shipmentUpdates: boolean("shipment_updates").default(true).notNull(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertPreference = typeof alertPreferences.$inferSelect;
export type InsertAlertPreference = typeof alertPreferences.$inferInsert;

/**
 * Alert history
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  alertType: mysqlEnum("alert_type", [
    "tariff_change",
    "regulation_update",
    "license_renewal",
    "shipment_update"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedEntityId: int("related_entity_id"), // ID of related tariff, regulation, etc.
  isRead: boolean("is_read").default(false).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  typeIdx: index("type_idx").on(table.alertType),
}));

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Saved compliance checklists
 */
export const complianceChecklists = mysqlTable("compliance_checklists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  originCountry: varchar("origin_country", { length: 3 }).notNull(),
  destinationCountry: varchar("destination_country", { length: 3 }).notNull(),
  htsCode: varchar("hts_code", { length: 20 }),
  productDescription: text("product_description"),
  checklistItems: text("checklist_items").notNull(), // JSON array of checklist items
  completedItems: text("completed_items"), // JSON array of completed item IDs
  status: mysqlEnum("status", ["draft", "in_progress", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
}));

export type ComplianceChecklist = typeof complianceChecklists.$inferSelect;
export type InsertComplianceChecklist = typeof complianceChecklists.$inferInsert;

/**
 * Chat history for AI assistant
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON for additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userSessionIdx: index("user_session_idx").on(table.userId, table.sessionId),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
