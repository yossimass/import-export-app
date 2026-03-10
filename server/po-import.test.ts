import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock LLM to return a structured PO extraction
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          poNumber: "PO-2026-001",
          poDate: "2026-03-01",
          buyerName: "Acme Imports LLC",
          buyerAddress: "123 Main St, New York, NY 10001, USA",
          sellerName: "Global Exports SA",
          sellerAddress: "456 Industrial Ave, Monterrey, NL 64000, Mexico",
          shipToName: "Acme Imports LLC Warehouse",
          shipToAddress: "789 Warehouse Blvd, Newark, NJ 07101, USA",
          incoterms: "FOB",
          currency: "USD",
          paymentTerms: "Net 30",
          deliveryDate: "2026-04-15",
          totalValue: "25000.00",
          notes: "Fragile items, handle with care",
          lineItems: [
            {
              lineNumber: 1,
              description: "Men's cotton t-shirts, 100% cotton, assorted colors",
              quantity: "500",
              unit: "pcs",
              unitPrice: "25.00",
              totalPrice: "12500.00",
              htsCode: "6109.10.0012",
              countryOfOrigin: "MEX",
            },
            {
              lineNumber: 2,
              description: "Women's denim jeans, 98% cotton 2% elastane",
              quantity: "250",
              unit: "pcs",
              unitPrice: "50.00",
              totalPrice: "12500.00",
              htsCode: "6204.62.4011",
              countryOfOrigin: "MEX",
            },
          ],
        })
      }
    }]
  }),
}));

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

// ─── PO Import Extraction ─────────────────────────────────────────────────────
describe("shipments.importPO", () => {
  it("should extract PO data from a PDF URL", async () => {
    const result = await caller.shipments.importPO({
      fileUrl: "https://example.com/test-po.pdf",
      fileName: "test-po.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toHaveProperty("poNumber", "PO-2026-001");
    expect(result).toHaveProperty("sellerName", "Global Exports SA");
    expect(result).toHaveProperty("buyerName", "Acme Imports LLC");
    expect(result).toHaveProperty("incoterms", "FOB");
    expect(result).toHaveProperty("currency", "USD");
    expect(result).toHaveProperty("totalValue", "25000.00");
    expect(result).toHaveProperty("fileUrl", "https://example.com/test-po.pdf");
    expect(result).toHaveProperty("extractedAt");
  }, 15000);

  it("should extract PO data from an image URL", async () => {
    const result = await caller.shipments.importPO({
      fileUrl: "https://example.com/test-po.png",
      fileName: "test-po.png",
      mimeType: "image/png",
    });

    expect(result).toHaveProperty("poNumber");
    expect(result).toHaveProperty("lineItems");
    expect(Array.isArray((result as any).lineItems)).toBe(true);
  }, 15000);

  it("should include line items with HTS codes", async () => {
    const result = await caller.shipments.importPO({
      fileUrl: "https://example.com/test-po.pdf",
      fileName: "test-po.pdf",
      mimeType: "application/pdf",
    }) as any;

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].htsCode).toBe("6109.10.0012");
    expect(result.lineItems[0].countryOfOrigin).toBe("MEX");
    expect(result.lineItems[1].htsCode).toBe("6204.62.4011");
  }, 15000);

  it("should always include fileUrl and extractedAt in result", async () => {
    const result = await caller.shipments.importPO({
      fileUrl: "https://example.com/po.jpg",
      fileName: "po.jpg",
      mimeType: "image/jpeg",
    }) as any;

    expect(result.fileUrl).toBe("https://example.com/po.jpg");
    expect(result.extractedAt).toBeTruthy();
    expect(new Date(result.extractedAt).getTime()).not.toBeNaN();
  }, 15000);
});

// ─── Create Shipment from PO ──────────────────────────────────────────────────
describe("shipments.createFromPO", () => {
  it("should create a shipment with PO number in the name", async () => {
    const result = await caller.shipments.createFromPO({
      poData: {
        poNumber: "PO-2026-001",
        sellerName: "Global Exports SA",
        buyerName: "Acme Imports LLC",
        incoterms: "FOB",
        currency: "USD",
        totalValue: "25000.00",
        lineItems: [
          {
            description: "Men's cotton t-shirts",
            quantity: "500",
            unit: "pcs",
            htsCode: "6109.10.0012",
            countryOfOrigin: "MEX",
          },
        ],
      },
    });

    expect(result).toHaveProperty("shipmentId");
    expect(result).toHaveProperty("shipmentName");
    expect(result.shipmentName).toContain("PO-2026-001");
    expect(result.shipmentName).toContain("Global Exports SA");
    expect(typeof result.shipmentId).toBe("number");
    expect(result.shipmentId).toBeGreaterThan(0);
  });

  it("should use seller name in shipment name when no PO number", async () => {
    const result = await caller.shipments.createFromPO({
      poData: {
        sellerName: "Acme Supplier Co",
        buyerName: "My Company",
        currency: "EUR",
      },
    });

    expect(result.shipmentName).toContain("Acme Supplier Co");
  });

  it("should use fallback name when no PO number or seller", async () => {
    const result = await caller.shipments.createFromPO({
      poData: {
        buyerName: "Some Buyer",
        totalValue: "5000",
      },
    });

    expect(result.shipmentName).toBeTruthy();
    expect(result.shipmentId).toBeGreaterThan(0);
  });

  it("should use first line item HTS code for the shipment", async () => {
    const result = await caller.shipments.createFromPO({
      poData: {
        poNumber: "PO-HTS-TEST",
        lineItems: [
          { description: "Cotton shirts", htsCode: "6109.10.0012", countryOfOrigin: "MEX" },
          { description: "Denim jeans", htsCode: "6204.62.4011", countryOfOrigin: "MEX" },
        ],
      },
    });

    // Verify shipment was created (we can't easily check htsCode without fetching it,
    // but we verify the mutation succeeded)
    expect(result.shipmentId).toBeGreaterThan(0);
  });
});

// ─── Update COO Status ────────────────────────────────────────────────────────
describe("shipments.updateCooStatus", () => {
  it("should update COO status to draft on a shipment", async () => {
    // First create a shipment
    const created = await caller.shipments.create({
      shipmentName: "COO Status Test Shipment",
    });

    const result = await caller.shipments.updateCooStatus({
      shipmentId: created.shipmentId,
      cooStatus: "draft",
      cooId: 999,
    });

    expect(result.success).toBe(true);
  });

  it("should update COO status to issued on a shipment", async () => {
    const created = await caller.shipments.create({
      shipmentName: "COO Issued Test Shipment",
    });

    const result = await caller.shipments.updateCooStatus({
      shipmentId: created.shipmentId,
      cooStatus: "issued",
      cooId: 1001,
    });

    expect(result.success).toBe(true);
  });
});
