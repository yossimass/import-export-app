import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("AI-Powered Trade Compliance Features", () => {
  it("HTS search returns AI-generated results", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const results = await caller.hts.search({ query: "electronics", limit: 5 });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // AI should return some results for a common query
    expect(results.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for AI call

  it("Tariff calculator returns AI-generated rates", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tariff.calculate({
      htsCode: "8517.12.00",
      originCountry: "CHN",
      destinationCountry: "USA",
      value: 1000,
    });

    expect(result).toBeDefined();
    expect(result.rate).toBeDefined();
    // AI may return rate as string ("5.5%") or number
    expect(['string', 'number']).toContain(typeof result.rate);
    expect(result.dutyAmount).toBeDefined();
    expect(result.totalCost).toBeDefined();
  }, 30000);

  it("Regulations search returns AI-generated current regulations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const results = await caller.regulations.search({
      countryCode: "USA",
      regulationType: "all",
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // AI should return regulations for USA
    expect(results.length).toBeGreaterThan(0);
  }, 30000);

  it("Currency converter returns AI-generated exchange rates", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.utilities.convertCurrency({
      amount: 100,
      from: "USD",
      to: "EUR",
    });

    expect(result).toBeDefined();
    expect(result.convertedAmount).toBeDefined();
    expect(typeof result.convertedAmount).toBe("number");
    expect(result.exchangeRate).toBeDefined();
    expect(result.convertedAmount).toBeGreaterThan(0);
  }, 30000);

  it("Checklist generator creates AI-generated compliance items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.checklists.generate({
      shipmentType: "import",
      originCountry: "CHN",
      destinationCountry: "USA",
      productCategory: "Electronics",
    });

    expect(result).toBeDefined();
    expect(result.checklistId).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  }, 30000);

  it("Chat assistant responds with AI-generated trade advice", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chat.send({
      message: "What documents do I need to import electronics from China to USA?",
    });

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.conversationId).toBeDefined();
  }, 30000);
});
