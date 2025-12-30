import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tradeDocuments, complianceChecklists, alerts, chatMessages } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

// Documents
export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tradeDocuments).where(eq(tradeDocuments.userId, userId)).orderBy(desc(tradeDocuments.createdAt));
}

export async function createDocument(data: {
  userId: number;
  filename: string;
  fileUrl: string;
  fileKey: string;
  documentType: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tradeDocuments).values({
    userId: data.userId,
    documentType: data.documentType as any,
    title: data.filename,
    description: data.description || null,
    fileKey: data.fileKey,
    fileUrl: data.fileUrl,
    fileName: data.filename,
  });
  return { id: Number((result as any).insertId), ...data };
}

export async function deleteDocument(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tradeDocuments).where(and(eq(tradeDocuments.id, documentId), eq(tradeDocuments.userId, userId)));
  return { success: true };
}

// Checklists
export async function createChecklist(data: {
  userId: number;
  title: string;
  shipmentType: string;
  originCountry: string;
  destinationCountry: string;
  items: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(complianceChecklists).values({
    userId: data.userId,
    title: data.title,
    originCountry: data.originCountry,
    destinationCountry: data.destinationCountry,
    checklistItems: JSON.stringify(data.items),
  });
  return Number((result as any).insertId);
}

export async function getUserChecklists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select().from(complianceChecklists).where(eq(complianceChecklists.userId, userId)).orderBy(desc(complianceChecklists.createdAt));
  return results.map(r => ({
    ...r,
    items: JSON.parse(r.checklistItems as string),
  }));
}

export async function getChecklist(checklistId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db.select().from(complianceChecklists).where(and(eq(complianceChecklists.id, checklistId), eq(complianceChecklists.userId, userId))).limit(1);
  if (results.length === 0) return null;
  
  return {
    ...results[0],
    items: JSON.parse(results[0].checklistItems as string),
  };
}

export async function updateChecklistItem(checklistId: number, userId: number, itemIndex: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const checklist = await getChecklist(checklistId, userId);
  if (!checklist) throw new Error("Checklist not found");
  
  const items = checklist.items;
  if (itemIndex < 0 || itemIndex >= items.length) throw new Error("Invalid item index");
  
  items[itemIndex].completed = completed;
  
  await db.update(complianceChecklists)
    .set({ checklistItems: JSON.stringify(items) })
    .where(and(eq(complianceChecklists.id, checklistId), eq(complianceChecklists.userId, userId)));
  
  return { success: true };
}

export async function deleteChecklist(checklistId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(complianceChecklists).where(and(eq(complianceChecklists.id, checklistId), eq(complianceChecklists.userId, userId)));
  return { success: true };
}

// Alerts
export async function createAlert(data: {
  userId: number;
  alertType: string;
  htsCode?: string;
  countryCode?: string;
  email: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(alerts).values({
    userId: data.userId,
    alertType: data.alertType as any,
    title: `Alert for ${data.alertType}`,
    message: `Monitoring ${data.alertType} for ${data.htsCode || data.countryCode || 'all'}`,
  });
  return { id: Number((result as any).insertId), ...data };
}

export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt));
}

export async function deleteAlert(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(alerts).where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
  return { success: true };
}

// Chat
export async function createConversation(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate unique session ID
  const sessionId = `session_${userId}_${Date.now()}`;
  return sessionId;
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get unique sessions for this user
  const messages = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt));
  const sessions = new Map();
  
  messages.forEach(msg => {
    if (!sessions.has(msg.sessionId)) {
      sessions.set(msg.sessionId, {
        id: msg.sessionId,
        userId: msg.userId,
        createdAt: msg.createdAt,
      });
    }
  });
  
  return Array.from(sessions.values());
}

export async function saveChatMessage(sessionId: string, role: string, content: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(chatMessages).values({
    userId,
    sessionId,
    role: role as any,
    content,
  });
}

export async function getChatHistory(sessionId: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(chatMessages)
    .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt);
}
