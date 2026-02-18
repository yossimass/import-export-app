import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

describe("Credits Dashboard", () => {
  // Mock context with authenticated user
  const mockContext: Context = {
    user: {
      id: 1,
      openId: "test-user-123",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      credits: "10.5000",
      stripeCustomerId: null,
      initialSearchesUsed: 2,
      monthlySearchesUsed: 0,
      lastMonthlyReset: new Date(),
      createdAt: new Date(),
      lastSignedIn: new Date(),
      loginMethod: null,
    },
    req: {} as any,
    res: {} as any,
  };

  const caller = appRouter.createCaller(mockContext);

  it("should get credit balance and free tier status", async () => {
    const result = await caller.credits.getBalance();

    expect(result).toBeDefined();
    expect(result.balance).toBeDefined();
    expect(typeof result.balance).toBe("number");
    expect(result.freeTier).toBeDefined();
    expect(result.freeTier).toHaveProperty("initialSearchesUsed");
    expect(result.freeTier).toHaveProperty("initialSearchesRemaining");
    expect(result.freeTier).toHaveProperty("monthlySearchesUsed");
    expect(result.freeTier).toHaveProperty("monthlySearchesRemaining");
  });

  it("should get credit transactions with pagination", async () => {
    const result = await caller.credits.getTransactions({ limit: 10, offset: 0 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // Transactions may be empty for new users
    if (result.length > 0) {
      const tx = result[0];
      expect(tx).toHaveProperty("id");
      expect(tx).toHaveProperty("userId");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("type");
      expect(tx).toHaveProperty("description");
      expect(tx).toHaveProperty("createdAt");
    }
  });

  it("should get usage statistics for last 30 days", async () => {
    const result = await caller.credits.getUsageStats({ days: 30 });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalSpent");
    expect(typeof result.totalSpent).toBe("number");
    expect(result).toHaveProperty("byFeature");
    expect(typeof result.byFeature).toBe("object");
    expect(result).toHaveProperty("byDay");
    expect(Array.isArray(result.byDay)).toBe(true);
  });

  it("should calculate free tier status correctly", async () => {
    const result = await caller.credits.getBalance();

    expect(result.freeTier).toBeDefined();
    
    // Free tier status should have all required fields
    expect(result.freeTier).toHaveProperty("initialSearchesUsed");
    expect(result.freeTier).toHaveProperty("initialSearchesRemaining");
    expect(result.freeTier).toHaveProperty("monthlySearchesUsed");
    expect(result.freeTier).toHaveProperty("monthlySearchesRemaining");
    
    // Values should be non-negative
    expect(result.freeTier!.initialSearchesUsed).toBeGreaterThanOrEqual(0);
    expect(result.freeTier!.initialSearchesRemaining).toBeGreaterThanOrEqual(0);
    expect(result.freeTier!.monthlySearchesUsed).toBeGreaterThanOrEqual(0);
    expect(result.freeTier!.monthlySearchesRemaining).toBeGreaterThanOrEqual(0);
    
    // Total should equal 5 for initial searches
    const totalInitial = result.freeTier!.initialSearchesUsed + result.freeTier!.initialSearchesRemaining;
    expect(totalInitial).toBe(5);
    
    // Total should equal 1 for monthly searches
    const totalMonthly = result.freeTier!.monthlySearchesUsed + result.freeTier!.monthlySearchesRemaining;
    expect(totalMonthly).toBe(1);
  });

  it("should handle pagination correctly for transactions", async () => {
    const page1 = await caller.credits.getTransactions({ limit: 5, offset: 0 });
    const page2 = await caller.credits.getTransactions({ limit: 5, offset: 5 });

    expect(Array.isArray(page1)).toBe(true);
    expect(Array.isArray(page2)).toBe(true);
    
    // If there are transactions, ensure pagination doesn't return duplicates
    if (page1.length > 0 && page2.length > 0) {
      const page1Ids = page1.map(tx => tx.id);
      const page2Ids = page2.map(tx => tx.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
  });
});
