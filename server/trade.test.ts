import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("HTS Code Features", () => {
  it("should search HTS codes with valid query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This will return empty array since database is empty, but tests the flow
    const result = await caller.hts.search({ query: "cotton", limit: 10 });
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get HTS code by code", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.hts.getByCode({ code: "6109.10.00" });
    
    // Will be undefined since database is empty, but tests the flow
    expect(result === undefined || typeof result === 'object').toBe(true);
  });
});

describe("Tariff Calculator", () => {
  it("should calculate tariff with valid inputs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create an HTS code
    await db.createHtsCode({
      code: "6109.10.00",
      description: "T-shirts, singlets and other vests, knitted or crocheted, of cotton",
      category: "Textiles",
      unit: "dozen",
    });

    // Now calculate tariff
    const result = await caller.tariff.calculate({
      htsCode: "6109.10.00",
      originCountry: "CHN",
      destinationCountry: "USA",
      value: 10000,
    });

    expect(result).toHaveProperty("htsCode");
    expect(result).toHaveProperty("rate");
    expect(result).toHaveProperty("dutyAmount");
    expect(result).toHaveProperty("totalValue");
    expect(result.totalValue).toBeGreaterThanOrEqual(result.dutyAmount);
  });

  it("should throw error for invalid HTS code", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tariff.calculate({
        htsCode: "invalid-code",
        originCountry: "CHN",
        destinationCountry: "USA",
        value: 10000,
      })
    ).rejects.toThrow();
  });
});

describe("Trade Regulations", () => {
  it("should get regulations by country", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.regulations.getByCountry({
      countryCode: "USA",
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter regulations by type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.regulations.getByCountry({
      countryCode: "USA",
      regulationType: "import_restriction",
    });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Document Management", () => {
  it("should list user documents", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.list({});

    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter documents by type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.list({
      documentType: "commercial_invoice",
    });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Compliance Checklists", () => {
  it("should list user checklists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.checklists.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Alert System", () => {
  it("should get user alert preferences", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alerts.getPreferences();

    expect(result).toHaveProperty("tariffChanges");
    expect(result).toHaveProperty("regulationUpdates");
    expect(result).toHaveProperty("licenseRenewals");
    expect(result).toHaveProperty("shipmentUpdates");
    expect(result).toHaveProperty("emailNotifications");
  });

  it("should update alert preferences", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alerts.updatePreferences({
      tariffChanges: false,
      regulationUpdates: true,
    });

    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });

  it("should list user alerts", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alerts.list({ unreadOnly: false });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Utility Functions", () => {
  it("should convert currency", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.utils.convertCurrency({
      amount: 100,
      from: "USD",
      to: "EUR",
    });

    expect(result).toHaveProperty("amount");
    expect(result).toHaveProperty("from");
    expect(result).toHaveProperty("to");
    expect(result).toHaveProperty("converted");
    expect(result).toHaveProperty("rate");
    expect(result.amount).toBe(100);
    expect(result.from).toBe("USD");
    expect(result.to).toBe("EUR");
  });

  it("should estimate shipping cost", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.utils.estimateShipping({
      weight: 10,
      length: 50,
      width: 40,
      height: 30,
      originCountry: "CHN",
      destinationCountry: "USA",
    });

    expect(result).toHaveProperty("chargeableWeight");
    expect(result).toHaveProperty("estimatedCost");
    expect(result).toHaveProperty("currency");
    expect(result.chargeableWeight).toBeGreaterThan(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
  });
});

describe("Chat Assistant", () => {
  it("should get chat history", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chat.history({
      sessionId: "test-session",
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
