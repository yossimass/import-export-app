import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Workflow Integration Tests", () => {
  it("HTS search returns results with explainability", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const results = await caller.hts.search({ query: "laptop computer", limit: 5 });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    if (results.length > 0) {
      const firstResult = results[0];
      expect(firstResult).toHaveProperty("code");
      expect(firstResult).toHaveProperty("description");
      expect(firstResult).toHaveProperty("reasoning");
      expect(firstResult).toHaveProperty("riskLevel");
    }
  }, 60000);

  it("Tariff calculation includes full breakdown and explainability", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tariff.calculate({
      htsCode: "8471.30.01",
      originCountry: "CHN",
      destinationCountry: "USA",
      value: 10000,
      quantity: 100,
      weight: 500,
      incoterm: "FOB",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("mfnRate");
    expect(result).toHaveProperty("appliedRate");
    expect(result).toHaveProperty("dutyAmount");
    expect(result).toHaveProperty("landedCost");
    expect(result).toHaveProperty("rationale");
    expect(result).toHaveProperty("rateSource");
    
    // Verify explainability
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(0);
  }, 60000);

  it("Shipment workflow creates and tracks state", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.shipments.create({
      shipmentName: "Test Shipment",
      productDescription: "Electronic devices",
    });

    expect(created).toHaveProperty("shipmentId");
    expect(typeof created.shipmentId).toBe("number");

    const shipment = await caller.shipments.get({ shipmentId: created.shipmentId });
    expect(shipment).toBeDefined();
    expect(shipment?.shipmentName).toBe("Test Shipment");
    expect(shipment?.status).toBe("draft");
  }, 30000);

  it("Currency conversion works with real-time rates", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.utilities.convertCurrency({
      amount: 1000,
      from: "USD",
      to: "EUR",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("convertedAmount");
    expect(result).toHaveProperty("exchangeRate");
    expect(typeof result.convertedAmount).toBe("number");
    expect(result.convertedAmount).toBeGreaterThanOrEqual(0);
  }, 30000);

  it("Compliance checklist generates actionable items", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const checklist = await caller.checklists.generate({
      htsCode: "8471.30.01",
      originCountry: "CHN",
      destinationCountry: "USA",
      shipmentType: "import",
    });

    expect(checklist).toBeDefined();
    expect(Array.isArray(checklist)).toBe(true);
    expect(checklist.length).toBeGreaterThan(0);
    
    const firstItem = checklist[0];
    expect(firstItem).toHaveProperty("item");
    expect(firstItem).toHaveProperty("required");
    expect(firstItem).toHaveProperty("category");
  }, 60000);
});
