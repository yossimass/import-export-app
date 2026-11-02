import { and, count, desc, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConnectionString } from "@netlify/database";
import { InsertUser, users, shipments, documents, alerts, chatMessages, InsertShipment, Shipment, InsertDocument, Document, certificates, InsertCertificate, Certificate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _dbUrl = "";

function connectionString(): string {
  if (ENV.databaseUrl) return ENV.databaseUrl;
  try {
    return getConnectionString(); // Netlify Database, provisioned automatically on deploy
  } catch {
    return "";
  }
}

export async function getDb() {
  // Re-read each time: Netlify may rotate the database credentials
  const url = connectionString();
  if (url && url !== _dbUrl) {
    try {
      // Small pool per serverless instance; prepare:false keeps it compatible
      // with transaction-mode poolers (Netlify Database/Neon pooled URLs, PgBouncer)
      _db = drizzle(postgres(url, { max: 3, prepare: false }));
      _dbUrl = url;
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

/** Point an existing user row at a new identity-provider id (used when migrating logins). */
export async function relinkUserOpenId(userId: number, openId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ openId }).where(eq(users.id, userId));
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

  const [row] = await db.insert(shipments).values(data).returning({ id: shipments.id });
  return row.id;
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

export async function deleteShipment(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(shipments).where(and(eq(shipments.id, id), eq(shipments.userId, userId)));
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db.insert(documents).values(data).returning({ id: documents.id });
  return row.id;
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

export async function deleteDocument(id: number, userId: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const where = and(eq(documents.id, id), eq(documents.userId, userId));
  const [doc] = await db.select().from(documents).where(where).limit(1);
  if (doc) await db.delete(documents).where(where);
  return doc;
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

  const [row] = await db.insert(alerts).values({
    userId,
    ...data,
  }).returning({ id: alerts.id });
  return row.id;
}

export async function getUserAlerts(userId: number): Promise<typeof alerts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt));
}

export async function deleteAlert(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
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
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId)))
    .orderBy(chatMessages.createdAt);
}

// ============================================================================
// CREDITS & TRANSACTIONS
// ============================================================================

export async function getCreditTransactions(userId: number, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  const { creditTransactions } = await import("../drizzle/schema");
  
  return await db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getCreditUsageStats(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return { totalSpent: 0, byFeature: {}, byDay: [] };

  const { creditTransactions } = await import("../drizzle/schema");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get all usage transactions in the time period
  const transactions = await db.select().from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.type, "usage"),
      gte(creditTransactions.createdAt, cutoffDate),
    ))
    .orderBy(creditTransactions.createdAt);

  // Calculate total spent
  const totalSpent = transactions.reduce((sum, tx) => {
    return sum + Math.abs(parseFloat(tx.amount as any) || 0);
  }, 0);

  // Group by feature
  const byFeature: Record<string, number> = {};
  transactions.forEach(tx => {
    if (tx.featureUsed) {
      byFeature[tx.featureUsed] = (byFeature[tx.featureUsed] || 0) + Math.abs(parseFloat(tx.amount as any) || 0);
    }
  });

  // Group by day
  const byDay: Array<{ date: string; amount: number }> = [];
  const dayMap: Record<string, number> = {};
  
  transactions.forEach(tx => {
    const date = new Date(tx.createdAt).toISOString().split('T')[0];
    dayMap[date] = (dayMap[date] || 0) + Math.abs(parseFloat(tx.amount as any) || 0);
  });

  Object.entries(dayMap).forEach(([date, amount]) => {
    byDay.push({ date, amount });
  });

  return {
    totalSpent,
    byFeature,
    byDay: byDay.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ============================================================================
// CERTIFICATES OF ORIGIN
// ============================================================================

export async function createCertificate(data: InsertCertificate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(certificates).values(data).returning({ id: certificates.id });
  return row.id;
}

export async function getCertificateById(id: number): Promise<Certificate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return result[0];
}

export async function getCertificateByShipmentId(shipmentId: number): Promise<Certificate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates)
    .where(eq(certificates.shipmentId, shipmentId))
    .orderBy(desc(certificates.createdAt))
    .limit(1);
  return result[0];
}

export async function getUserCertificates(userId: number): Promise<Certificate[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(certificates)
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.createdAt));
}

export async function updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(certificates).set(data as any).where(eq(certificates.id, id));
}

export async function deleteCertificate(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(certificates).where(and(eq(certificates.id, id), eq(certificates.userId, userId)));
}

// ============================================================================
// ADMIN - USER MANAGEMENT
// ============================================================================

export async function getAllUsers(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserCredits(userId: number, credits: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ credits }).where(eq(users.id, userId));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalShipments: 0, totalCertificates: 0, totalCreditsIssued: 0, adminCount: 0 };
  const { sql } = await import("drizzle-orm");
  // Aggregate in SQL instead of loading every row into memory
  const [[userAgg], [shipmentAgg], [certAgg]] = await Promise.all([
    db.select({
      total: count(),
      admins: count(sql`CASE WHEN ${users.role} = 'admin' THEN 1 END`),
      credits: sql<string>`COALESCE(SUM(${users.credits}), 0)`,
    }).from(users),
    db.select({ total: count() }).from(shipments),
    db.select({ total: count() }).from(certificates),
  ]);
  return {
    totalUsers: Number(userAgg?.total ?? 0),
    totalShipments: Number(shipmentAgg?.total ?? 0),
    totalCertificates: Number(certAgg?.total ?? 0),
    totalCreditsIssued: parseFloat(userAgg?.credits ?? "0"),
    adminCount: Number(userAgg?.admins ?? 0),
  };
}
