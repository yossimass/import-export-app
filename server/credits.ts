/**
 * Credits Service
 * Handles all credit-related operations: deduction, addition, balance checks
 */

import { getDb } from "./db";
import { users, creditTransactions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { calculateCreditCost, LLM_COSTS, BASE_MARKUP, FREE_TIER } from "../shared/products";

/**
 * Check if user has sufficient credits for a feature
 * Returns { allowed: boolean, reason?: string }
 */
export async function checkCredits(
  userId: number,
  featureName: keyof typeof LLM_COSTS
): Promise<{ allowed: boolean; reason?: string; isFree?: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user.length) {
    return { allowed: false, reason: "User not found" };
  }

  const userData = user[0];
  const creditCost = calculateCreditCost(featureName);

  // Check free tier for HTS search only
  if (featureName === "hts_search") {
    // Check initial 5 searches
    if (userData.initialSearchesUsed < FREE_TIER.initialSearches) {
      return { allowed: true, isFree: true };
    }

    // Check monthly search (reset monthly)
    const now = new Date();
    const lastReset = new Date(userData.lastMonthlyReset);
    const monthsSinceReset = 
      (now.getFullYear() - lastReset.getFullYear()) * 12 + 
      (now.getMonth() - lastReset.getMonth());

    if (monthsSinceReset >= 1) {
      // Reset monthly counter
      const db2 = await getDb();
      if (db2) {
        await db2
          .update(users)
          .set({
            monthlySearchesUsed: 0,
            lastMonthlyReset: now,
          })
          .where(eq(users.id, userId));
      }
      
      return { allowed: true, isFree: true };
    }

    // Check if monthly search is available
    if (userData.monthlySearchesUsed < FREE_TIER.monthlySearches) {
      return { allowed: true, isFree: true };
    }
  }

  // Check paid credits
  const currentCredits = parseFloat(userData.credits as any) || 0;
  
  if (currentCredits < creditCost) {
    return {
      allowed: false,
      reason: `Insufficient credits. Need ${creditCost.toFixed(4)} credits, have ${currentCredits.toFixed(4)}`,
    };
  }

  return { allowed: true };
}

/**
 * Deduct credits for feature usage
 * Returns new balance or throws error
 */
export async function deductCredits(
  userId: number,
  featureName: keyof typeof LLM_COSTS,
  shipmentId?: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const check = await checkCredits(userId, featureName);
  
  if (!check.allowed) {
    throw new Error(check.reason || "Insufficient credits");
  }

  // Handle free tier usage
  if (check.isFree && featureName === "hts_search") {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userData = user[0];

    if (userData.initialSearchesUsed < FREE_TIER.initialSearches) {
      // Deduct from initial searches
      await db
        .update(users)
        .set({
          initialSearchesUsed: userData.initialSearchesUsed + 1,
        })
        .where(eq(users.id, userId));
      
      // Log free usage
      await db.insert(creditTransactions).values({
        userId,
        amount: "0",
        balanceAfter: userData.credits,
        type: "usage",
        description: `Free HTS search (${userData.initialSearchesUsed + 1}/${FREE_TIER.initialSearches} initial)`,
        featureUsed: featureName,
        shipmentId,
        llmCost: LLM_COSTS[featureName].toString(),
        markupRate: "0",
      });

      return parseFloat(userData.credits as any) || 0;
    } else {
      // Deduct from monthly search
      await db
        .update(users)
        .set({
          monthlySearchesUsed: userData.monthlySearchesUsed + 1,
        })
        .where(eq(users.id, userId));
      
      // Log free usage
      await db.insert(creditTransactions).values({
        userId,
        amount: "0",
        balanceAfter: userData.credits,
        type: "usage",
        description: "Free monthly HTS search",
        featureUsed: featureName,
        shipmentId,
        llmCost: LLM_COSTS[featureName].toString(),
        markupRate: "0",
      });

      return parseFloat(userData.credits as any) || 0;
    }
  }

  // Deduct paid credits
  const creditCost = calculateCreditCost(featureName);
  const llmCost = LLM_COSTS[featureName];

  // Atomic credit deduction
  const result = await db
    .update(users)
    .set({
      credits: sql`credits - ${creditCost}`,
    })
    .where(eq(users.id, userId));

  // Get new balance
  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const newBalance = parseFloat(updatedUser[0].credits as any) || 0;

  // Log transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: (-creditCost).toString(),
    balanceAfter: newBalance.toString(),
    type: "usage",
    description: `Used ${featureName.replace("_", " ")}`,
    featureUsed: featureName,
    shipmentId,
    llmCost: llmCost.toString(),
    markupRate: BASE_MARKUP.toString(),
  });

  return newBalance;
}

/**
 * Add credits to user account
 */
export async function addCredits(
  userId: number,
  amount: number,
  type: "purchase" | "subscription_refill" | "refund" | "admin_adjustment",
  description: string,
  stripePaymentIntentId?: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Atomic credit addition
  await db
    .update(users)
    .set({
      credits: sql`credits + ${amount}`,
    })
    .where(eq(users.id, userId));

  // Get new balance
  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const newBalance = parseFloat(updatedUser[0].credits as any) || 0;

  // Log transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: amount.toString(),
    balanceAfter: newBalance.toString(),
    type,
    description,
    stripePaymentIntentId,
  });

  return newBalance;
}

/**
 * Get user's current credit balance
 */
export async function getCreditBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user.length) {
    return 0;
  }

  return parseFloat(user[0].credits as any) || 0;
}

/**
 * Get user's free tier status
 */
export async function getFreeTierStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user.length) {
    return null;
  }

  const userData = user[0];
  const now = new Date();
  const lastReset = new Date(userData.lastMonthlyReset);
  const monthsSinceReset = 
    (now.getFullYear() - lastReset.getFullYear()) * 12 + 
    (now.getMonth() - lastReset.getMonth());

  return {
    initialSearchesUsed: userData.initialSearchesUsed,
    initialSearchesRemaining: Math.max(0, FREE_TIER.initialSearches - userData.initialSearchesUsed),
    monthlySearchesUsed: monthsSinceReset >= 1 ? 0 : userData.monthlySearchesUsed,
    monthlySearchesRemaining: monthsSinceReset >= 1 ? FREE_TIER.monthlySearches : Math.max(0, FREE_TIER.monthlySearches - userData.monthlySearchesUsed),
    needsMonthlyReset: monthsSinceReset >= 1,
  };
}
