import { describe, it, expect } from "vitest";
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

describe("Certificate of Origin", () => {
  it("should list certificates for a user (empty initially)", async () => {
    const result = await caller.certificate.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should generate a certificate with a valid certificate number", async () => {
    const result = await caller.certificate.generate({
      exporterName: "Acme Corp",
      exporterCountry: "USA",
      consigneeName: "Global Imports Ltd",
      consigneeCountry: "DEU",
      goodsDescription: "Men's cotton t-shirts, 100% cotton",
      htsCode: "6109.10.0012",
      countryOfOrigin: "USA",
      originCriterion: "A",
      quantity: "500",
      quantityUnit: "units",
      destinationCountry: "DEU",
    });

    expect(result).toHaveProperty("certificateId");
    expect(result).toHaveProperty("certificateNumber");
    expect(result).toHaveProperty("validationResult");

    // Certificate number format: COO-YYYYMMDD-XXXX
    expect(result.certificateNumber).toMatch(/^COO-\d{8}-\d{4}$/);
    expect(typeof result.certificateId).toBe("number");
    expect(result.certificateId).toBeGreaterThan(0);
  }, 30000);

  it("should retrieve a certificate by ID", async () => {
    // First generate one
    const generated = await caller.certificate.generate({
      exporterName: "Test Exporter",
      consigneeName: "Test Consignee",
      goodsDescription: "Electronic components",
      countryOfOrigin: "JPN",
    });

    const cert = await caller.certificate.get({ certificateId: generated.certificateId });
    expect(cert).toBeDefined();
    expect(cert?.exporterName).toBe("Test Exporter");
    expect(cert?.consigneeName).toBe("Test Consignee");
    expect(cert?.countryOfOrigin).toBe("JPN");
    expect(cert?.status).toBe("draft");
  }, 30000);

  it("should issue a certificate (change status to issued)", async () => {
    const generated = await caller.certificate.generate({
      exporterName: "Issuer Corp",
      consigneeName: "Receiver Ltd",
      goodsDescription: "Industrial machinery parts",
      countryOfOrigin: "USA",
    });

    const issueResult = await caller.certificate.issue({ certificateId: generated.certificateId });
    expect(issueResult.success).toBe(true);

    // Verify status changed
    const cert = await caller.certificate.get({ certificateId: generated.certificateId });
    expect(cert?.status).toBe("issued");
  }, 30000);

  it("should list certificates after generating some", async () => {
    const before = await caller.certificate.list();
    const initialCount = before.length;

    await caller.certificate.generate({
      exporterName: "List Test Corp",
      consigneeName: "List Test Buyer",
      goodsDescription: "Test goods for list",
      countryOfOrigin: "CAN",
    });

    const after = await caller.certificate.list();
    expect(after.length).toBeGreaterThan(initialCount);
  }, 30000);

  it("should delete a certificate", async () => {
    const generated = await caller.certificate.generate({
      exporterName: "Delete Test Corp",
      consigneeName: "Delete Test Buyer",
      goodsDescription: "Goods to be deleted",
      countryOfOrigin: "GBR",
    });

    const deleteResult = await caller.certificate.delete({ certificateId: generated.certificateId });
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const cert = await caller.certificate.get({ certificateId: generated.certificateId });
    expect(cert).toBeUndefined();
  }, 30000);

  it("should return validation result with required fields", async () => {
    const result = await caller.certificate.generate({
      exporterName: "Validation Test Corp",
      exporterCountry: "USA",
      consigneeName: "Validation Buyer",
      consigneeCountry: "MEX",
      goodsDescription: "Automotive parts, steel components",
      htsCode: "8708.99.8180",
      countryOfOrigin: "USA",
      originCriterion: "D",
      destinationCountry: "MEX",
    });

    expect(result.validationResult).toBeDefined();
    expect(result.validationResult).toHaveProperty("isValid");
    expect(result.validationResult).toHaveProperty("warnings");
    expect(result.validationResult).toHaveProperty("suggestions");
    expect(result.validationResult).toHaveProperty("originCriterionExplanation");
    expect(Array.isArray(result.validationResult.warnings)).toBe(true);
    expect(Array.isArray(result.validationResult.suggestions)).toBe(true);
  }, 30000);
});
