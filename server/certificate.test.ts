import { describe, it, expect } from "vitest";
import { TRADE_AGREEMENTS, getAgreementById, getApplicableAgreements } from "../shared/tradeAgreements";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock context with authenticated user
const mockContext: Context = {
  user: {
    id: 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    role: "user",
    credits: "100.0000",
    initialSearchesUsed: 0,
    monthlySearchesUsed: 0,
    lastMonthlyReset: new Date(),
    stripeCustomerId: null,
    createdAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: null,
  },
  req: {} as any,
  res: {} as any,
};

const caller = appRouter.createCaller(mockContext);

// ─── Trade Agreement Definitions (no DB/LLM needed) ──────────────────────────
describe("Trade Agreement Definitions", () => {
  it("should have all 6 trade agreements defined", () => {
    expect(TRADE_AGREEMENTS).toHaveLength(6);
    const ids = TRADE_AGREEMENTS.map(a => a.id);
    expect(ids).toContain("USMCA");
    expect(ids).toContain("CAFTA-DR");
    expect(ids).toContain("EU_GSP");
    expect(ids).toContain("AGOA");
    expect(ids).toContain("US_KOREA");
    expect(ids).toContain("GENERIC");
  });

  it("should return USMCA agreement by ID with correct countries", () => {
    const usmca = getAgreementById("USMCA");
    expect(usmca).toBeDefined();
    expect(usmca!.name).toBe("United States–Mexico–Canada Agreement");
    expect(usmca!.eligibleCountries).toContain("USA");
    expect(usmca!.eligibleCountries).toContain("MEX");
    expect(usmca!.eligibleCountries).toContain("CAN");
  });

  it("should return undefined for unknown agreement ID", () => {
    expect(getAgreementById("UNKNOWN")).toBeUndefined();
  });

  it("should detect USMCA as applicable for USA → Mexico trade", () => {
    const agreements = getApplicableAgreements("USA", "MEX");
    const ids = agreements.map(a => a.id);
    expect(ids).toContain("USMCA");
    expect(ids).toContain("GENERIC");
  });

  it("should detect CAFTA-DR for USA → Guatemala trade", () => {
    const agreements = getApplicableAgreements("USA", "GTM");
    const ids = agreements.map(a => a.id);
    expect(ids).toContain("CAFTA-DR");
  });

  it("should detect KORUS for USA → Korea trade", () => {
    const agreements = getApplicableAgreements("USA", "KOR");
    const ids = agreements.map(a => a.id);
    expect(ids).toContain("US_KOREA");
  });

  it("should return only GENERIC for non-FTA country pair", () => {
    const agreements = getApplicableAgreements("AUS", "BRA");
    const ids = agreements.map(a => a.id);
    expect(ids).toContain("GENERIC");
    expect(ids).not.toContain("USMCA");
    expect(ids).not.toContain("CAFTA-DR");
  });

  it("should have origin criteria with value, label, and description for each agreement", () => {
    TRADE_AGREEMENTS.forEach(agreement => {
      expect(agreement.originCriteria.length).toBeGreaterThan(0);
      agreement.originCriteria.forEach(criterion => {
        expect(criterion.value).toBeTruthy();
        expect(criterion.label).toBeTruthy();
        expect(criterion.description).toBeTruthy();
      });
    });
  });

  it("should have certification language for each agreement", () => {
    TRADE_AGREEMENTS.forEach(agreement => {
      expect(agreement.certificationLanguage).toBeTruthy();
      expect(agreement.certificationLanguage.length).toBeGreaterThan(20);
    });
  });

  it("USMCA should have blanket period and certifier role fields", () => {
    const usmca = getAgreementById("USMCA")!;
    const fieldKeys = usmca.additionalFields.map(f => f.key);
    expect(fieldKeys).toContain("blanketPeriodFrom");
    expect(fieldKeys).toContain("blanketPeriodTo");
    expect(fieldKeys).toContain("certifierRole");
    expect(fieldKeys).toContain("netCostMethod");
  });

  it("EU_GSP should have REX number and statement on origin fields", () => {
    const gsp = getAgreementById("EU_GSP")!;
    const fieldKeys = gsp.additionalFields.map(f => f.key);
    expect(fieldKeys).toContain("rexNumber");
    expect(fieldKeys).toContain("statementOnOrigin");
    expect(fieldKeys).toContain("cumulationType");
  });

  it("AGOA should have beneficiary country and value-added fields", () => {
    const agoa = getAgreementById("AGOA")!;
    const fieldKeys = agoa.additionalFields.map(f => f.key);
    expect(fieldKeys).toContain("beneficiaryCountry");
    expect(fieldKeys).toContain("valueAddedPercentage");
  });
});

// ─── tRPC: getApplicableAgreements (public, no LLM) ──────────────────────────
describe("certificate.getApplicableAgreements", () => {
  it("should return USMCA and GENERIC for USA → CAN", async () => {
    const result = await caller.certificate.getApplicableAgreements({
      exporterCountry: "USA",
      destinationCountry: "CAN",
    });
    const ids = result.map(a => a.id);
    expect(ids).toContain("USMCA");
    expect(ids).toContain("GENERIC");
  });

  it("should return only GENERIC for non-FTA pair", async () => {
    const result = await caller.certificate.getApplicableAgreements({
      exporterCountry: "AUS",
      destinationCountry: "BRA",
    });
    const ids = result.map(a => a.id);
    expect(ids).toContain("GENERIC");
    expect(ids).not.toContain("USMCA");
  });
});

// ─── tRPC: getAgreementDefinition (public, no LLM) ───────────────────────────
describe("certificate.getAgreementDefinition", () => {
  it("should return full USMCA definition with fields and criteria", async () => {
    const result = await caller.certificate.getAgreementDefinition({ agreementId: "USMCA" });
    expect(result).toBeDefined();
    expect(result!.id).toBe("USMCA");
    expect(result!.originCriteria.length).toBeGreaterThan(0);
    expect(result!.additionalFields.length).toBeGreaterThan(0);
    expect(result!.certificationLanguage).toBeTruthy();
  });

  it("should return null for unknown agreement", async () => {
    const result = await caller.certificate.getAgreementDefinition({ agreementId: "UNKNOWN" });
    expect(result).toBeNull();
  });
});

// ─── tRPC: generate + list (requires LLM + DB, extended timeout) ─────────────
describe("certificate.generate with trade agreement", () => {
  it("should generate a USMCA certificate with correct number format", async () => {
    const result = await caller.certificate.generate({
      tradeAgreement: "USMCA",
      exporterName: "Acme Corp",
      exporterCountry: "USA",
      consigneeName: "Global Imports Ltd",
      consigneeCountry: "MEX",
      goodsDescription: "Men's cotton t-shirts, 100% cotton",
      htsCode: "6109.10.0012",
      countryOfOrigin: "USA",
      originCriterion: "A",
      quantity: "500",
      quantityUnit: "units",
      destinationCountry: "MEX",
      agreementFields: {
        certifierRole: "Exporter",
        blanketPeriodFrom: "2026-01-01",
        blanketPeriodTo: "2026-12-31",
      },
    });

    expect(result).toHaveProperty("certificateId");
    expect(result).toHaveProperty("certificateNumber");
    expect(result).toHaveProperty("validationResult");
    expect(result).toHaveProperty("agreement");
    // USMCA prefix in cert number
    expect(result.certificateNumber).toMatch(/^USMCA-\d{8}-\d{4}$/);
    expect(result.agreement?.id).toBe("USMCA");
    expect(result.validationResult).toHaveProperty("isValid");
    expect(result.validationResult).toHaveProperty("complianceScore");
  }, 30000);

  it("should list certificates for a user", async () => {
    const result = await caller.certificate.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
