import { eq, and, like, or, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  htsCodes, 
  InsertHtsCode,
  tariffRates,
  InsertTariffRate,
  tradeRegulations,
  InsertTradeRegulation,
  tradeDocuments,
  InsertTradeDocument,
  alertPreferences,
  InsertAlertPreference,
  alerts,
  InsertAlert,
  complianceChecklists,
  InsertComplianceChecklist,
  chatMessages,
  InsertChatMessage
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Management ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== HTS Codes ====================

export async function searchHtsCodes(query: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const searchPattern = `%${query}%`;
  return db.select()
    .from(htsCodes)
    .where(
      or(
        like(htsCodes.code, searchPattern),
        like(htsCodes.description, searchPattern),
        like(htsCodes.category, searchPattern)
      )
    )
    .limit(limit);
}

export async function getHtsCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(htsCodes).where(eq(htsCodes.code, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createHtsCode(data: InsertHtsCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(htsCodes).values(data);
  return result;
}

// ==================== Tariff Rates ====================

export async function getTariffRate(htsCodeId: number, originCountry: string, destinationCountry: string) {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const result = await db.select()
    .from(tariffRates)
    .where(
      and(
        eq(tariffRates.htsCodeId, htsCodeId),
        eq(tariffRates.originCountry, originCountry),
        eq(tariffRates.destinationCountry, destinationCountry),
        lte(tariffRates.effectiveDate, now),
        or(
          sql`${tariffRates.expiryDate} IS NULL`,
          gte(tariffRates.expiryDate, now)
        )
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createTariffRate(data: InsertTariffRate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(tariffRates).values(data);
}

// ==================== Trade Regulations ====================

export async function getTradeRegulations(countryCode: string, regulationType?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(tradeRegulations.countryCode, countryCode)];
  if (regulationType) {
    conditions.push(eq(tradeRegulations.regulationType, regulationType));
  }

  return db.select()
    .from(tradeRegulations)
    .where(and(...conditions))
    .orderBy(desc(tradeRegulations.effectiveDate));
}

export async function createTradeRegulation(data: InsertTradeRegulation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(tradeRegulations).values(data);
}

// ==================== Trade Documents ====================

export async function getUserDocuments(userId: number, documentType?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(tradeDocuments.userId, userId)];
  if (documentType) {
    conditions.push(eq(tradeDocuments.documentType, documentType as any));
  }

  return db.select()
    .from(tradeDocuments)
    .where(and(...conditions))
    .orderBy(desc(tradeDocuments.createdAt));
}

export async function createTradeDocument(data: InsertTradeDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tradeDocuments).values(data);
  return result;
}

export async function deleteTradeDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(tradeDocuments)
    .where(and(eq(tradeDocuments.id, id), eq(tradeDocuments.userId, userId)));
}

// ==================== Alert Preferences ====================

export async function getAlertPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(alertPreferences)
    .where(eq(alertPreferences.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertAlertPreferences(data: InsertAlertPreference) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(alertPreferences).values(data).onDuplicateKeyUpdate({
    set: {
      tariffChanges: data.tariffChanges,
      regulationUpdates: data.regulationUpdates,
      licenseRenewals: data.licenseRenewals,
      shipmentUpdates: data.shipmentUpdates,
      emailNotifications: data.emailNotifications,
      updatedAt: new Date(),
    },
  });
}

// ==================== Alerts ====================

export async function getUserAlerts(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(alerts.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(alerts.isRead, false));
  }

  return db.select()
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.sentAt));
}

export async function createAlert(data: InsertAlert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(alerts).values(data);
}

export async function markAlertAsRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(alerts)
    .set({ isRead: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

// ==================== Compliance Checklists ====================

export async function getUserChecklists(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(complianceChecklists)
    .where(eq(complianceChecklists.userId, userId))
    .orderBy(desc(complianceChecklists.updatedAt));
}

export async function createChecklist(data: InsertComplianceChecklist) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(complianceChecklists).values(data);
}

export async function updateChecklist(id: number, userId: number, updates: Partial<InsertComplianceChecklist>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(complianceChecklists)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(complianceChecklists.id, id), eq(complianceChecklists.userId, userId)));
}

export async function deleteChecklist(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(complianceChecklists)
    .where(and(eq(complianceChecklists.id, id), eq(complianceChecklists.userId, userId)));
}

// ==================== Chat Messages ====================

export async function getChatHistory(userId: number, sessionId: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.sessionId, sessionId)))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

export async function saveChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(chatMessages).values(data);
}
