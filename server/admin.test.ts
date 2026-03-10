import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Admin user context
const adminCtx: Context = {
  user: {
    id: 1,
    openId: "admin-open-id",
    role: "admin" as const,
    name: "Admin Josef",
    email: "josefmass@gmail.com",
    credits: "100.0000",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionTier: null,
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    initialSearchesUsed: 0,
    lastMonthlySearchReset: null,
    createdAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: { origin: "http://localhost:3000" } } as any,
  res: {} as any,
};

// Regular user context
const userCtx: Context = {
  user: {
    id: 9999,
    openId: "user-open-id",
    role: "user" as const,
    name: "Test User",
    email: "testuser@example.com",
    credits: "5.0000",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionTier: null,
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    initialSearchesUsed: 0,
    lastMonthlySearchReset: null,
    createdAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: { origin: "http://localhost:3000" } } as any,
  res: {} as any,
};

describe("Admin Panel Procedures", () => {
  describe("admin.getStats", () => {
    it("returns platform stats for admin", async () => {
      const caller = appRouter.createCaller(adminCtx);
      const stats = await caller.admin.getStats();
      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("totalShipments");
      expect(stats).toHaveProperty("totalCertificates");
      expect(stats).toHaveProperty("totalCreditsIssued");
      expect(stats).toHaveProperty("adminCount");
      expect(typeof stats.totalUsers).toBe("number");
      expect(stats.adminCount).toBeGreaterThanOrEqual(1);
    });

    it("throws FORBIDDEN for non-admin", async () => {
      const caller = appRouter.createCaller(userCtx);
      await expect(caller.admin.getStats()).rejects.toThrow("Admin access required");
    });
  });

  describe("admin.listUsers", () => {
    it("returns user list for admin", async () => {
      const caller = appRouter.createCaller(adminCtx);
      const users = await caller.admin.listUsers({ limit: 10, offset: 0 });
      expect(Array.isArray(users)).toBe(true);
    });

    it("filters users by search query", async () => {
      const caller = appRouter.createCaller(adminCtx);
      const results = await caller.admin.listUsers({ limit: 10, offset: 0, search: "josefmass" });
      expect(Array.isArray(results)).toBe(true);
      // If the user exists, they should be in results
      if (results.length > 0) {
        expect(results[0].email).toContain("josefmass");
      }
    });

    it("throws FORBIDDEN for non-admin", async () => {
      const caller = appRouter.createCaller(userCtx);
      await expect(caller.admin.listUsers({ limit: 10, offset: 0 })).rejects.toThrow("Admin access required");
    });
  });

  describe("admin.adjustCredits", () => {
    it("throws FORBIDDEN for non-admin", async () => {
      const caller = appRouter.createCaller(userCtx);
      await expect(
        caller.admin.adjustCredits({ userId: 1, amount: 10, direction: "add", reason: "test" })
      ).rejects.toThrow("Admin access required");
    });

    it("throws NOT_FOUND for non-existent user", async () => {
      const caller = appRouter.createCaller(adminCtx);
      await expect(
        caller.admin.adjustCredits({ userId: 999999, amount: 10, direction: "add", reason: "test" })
      ).rejects.toThrow("User not found");
    });

    it("throws BAD_REQUEST for zero/negative amount (zod validation)", async () => {
      const caller = appRouter.createCaller(adminCtx);
      await expect(
        caller.admin.adjustCredits({ userId: 1, amount: -5, direction: "add", reason: "test" })
      ).rejects.toThrow();
    });
  });

  describe("admin.updateRole", () => {
    it("throws FORBIDDEN for non-admin", async () => {
      const caller = appRouter.createCaller(userCtx);
      await expect(
        caller.admin.updateRole({ userId: 1, role: "admin" })
      ).rejects.toThrow("Admin access required");
    });

    it("throws BAD_REQUEST when admin tries to change their own role", async () => {
      const caller = appRouter.createCaller(adminCtx);
      await expect(
        caller.admin.updateRole({ userId: 1, role: "user" })
      ).rejects.toThrow("Cannot change your own role");
    });
  });

  describe("admin.getUserTransactions", () => {
    it("returns transactions for a user", async () => {
      const caller = appRouter.createCaller(adminCtx);
      const txns = await caller.admin.getUserTransactions({ userId: 1, limit: 10 });
      expect(Array.isArray(txns)).toBe(true);
    });

    it("throws FORBIDDEN for non-admin", async () => {
      const caller = appRouter.createCaller(userCtx);
      await expect(
        caller.admin.getUserTransactions({ userId: 1, limit: 10 })
      ).rejects.toThrow("Admin access required");
    });
  });
});
