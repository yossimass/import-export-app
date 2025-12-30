import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, shipments, documents, alerts, chatMessages, InsertShipment, Shipment, InsertDocument, Document } from "../drizzle/schema";
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

// ============================================================================
// USER MANAGEMENT
// ============================================================================

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

// ============================================================================
// SHIPMENT WORKFLOW
// ============================================================================

export async function createShipment(data: InsertShipment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(shipments).values(data);
  return Number(result[0].insertId);
}

export async function getShipmentById(id: number): Promise<Shipment | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  return result[0];
}

export async function getUserShipments(userId: number): Promise<Shipment[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(shipments)
    .where(eq(shipments.userId, userId))
    .orderBy(desc(shipments.updatedAt));
}

export async function getRecentShipments(userId: number, limit: number = 5): Promise<Shipment[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(shipments)
    .where(eq(shipments.userId, userId))
    .orderBy(desc(shipments.updatedAt))
    .limit(limit);
}

export async function updateShipment(id: number, data: Partial<Shipment>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(shipments).set(data).where(eq(shipments.id, id));
}

export async function deleteShipment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(shipments).where(eq(shipments.id, id));
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(data);
  return Number(result[0].insertId);
}

export async function getShipmentDocuments(shipmentId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(documents)
    .where(eq(documents.shipmentId, shipmentId))
    .orderBy(desc(documents.uploadedAt));
}

export async function getUserDocuments(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.uploadedAt));
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(documents).where(eq(documents.id, id));
}

// ============================================================================
// ALERTS
// ============================================================================

export async function createAlert(userId: number, data: {
  alertType: "tariff_change" | "regulation_update" | "license_renewal" | "shipment_status";
  title: string;
  message: string;
  htsCode?: string;
  countryCode?: string;
  shipmentId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(alerts).values({
    userId,
    ...data,
  });
  return Number(result[0].insertId);
}

export async function getUserAlerts(userId: number): Promise<typeof alerts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt));
}

export async function deleteAlert(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(alerts).where(eq(alerts.id, id));
}

// ============================================================================
// CHAT HISTORY
// ============================================================================

export async function saveChatMessage(userId: number, conversationId: string, role: "user" | "assistant", content: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatMessages).values({
    userId,
    conversationId,
    role,
    content,
  });
}

export async function getChatHistory(userId: number, conversationId: string): Promise<typeof chatMessages.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(chatMessages.createdAt);
}
