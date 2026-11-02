import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import { searchByKeywords } from "./htsIndex";
import * as trade from "./tradeData";
import * as compliance from "./compliance";

// No workspace: the lookup tools must work without a database
const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any } as Context);

describe("HTS search (bundled schedule)", () => {
  it.each([
    ["cotton t-shirts", "6109.10.00"],
    ["laptop", "8471.30.01"],
    ["smartphone", "8517.13.00"],
    ["toys", "9503.00.00"],
  ])("%s → %s", (query, code) => {
    expect(searchByKeywords(query, 3)[0]?.code).toBe(code);
  });

  it("looks up codes offline with inherited rates", async () => {
    const line = await trade.lookupHts("6109.10.0012");
    expect(line?.code).toBe("6109.10.00");
    expect(line?.general).toBe("16.5%");
  });

  it("hts.search works without a workspace", async () => {
    const results = await caller.hts.search({ query: "frozen shrimp", limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toMatch(/^0306\./);
    expect(results[0].confidence).toBeLessThanOrEqual(0.9);
  });
});

describe("Tariff calculation", () => {
  it("US: MFN, USMCA preference, MPF and HMF", async () => {
    const mfn = await caller.tariff.calculate({ htsCode: "6109.10.00", originCountry: "CHN", destinationCountry: "USA", value: 10000, incoterm: "FOB" });
    expect(mfn.dutyAmount).toBe(1650);
    expect(mfn.mpf).toBe(34.64);
    expect(mfn.hmf).toBe(12.5);
    const usmca = await caller.tariff.calculate({ htsCode: "6109.10.00", originCountry: "MEX", destinationCountry: "USA", value: 10000 });
    expect(usmca.dutyAmount).toBe(0);
    expect(usmca.tradeAgreement).toBe("USMCA");
  });

  it("non-US: uses the entered duty rate", async () => {
    const r = await caller.tariff.calculate({ htsCode: "6109.10", originCountry: "CHN", destinationCountry: "GBR", value: 1000, dutyRate: 12, freightCost: 100 });
    expect(r.dutyAmount).toBe(120);
    expect(r.landedCost).toBe(1220);
  });
});

describe("Regulations and checklists", () => {
  it("adds product rules by HTS chapter", async () => {
    const regs = await caller.regulations.search({ countryCode: "United States", regulationType: "all", htsCode: "9503.00.00" });
    expect(regs.some(r => r.authority.includes("CPSC"))).toBe(true);
  });

  it("maps EU members to EU rules and filters by type", () => {
    const regs = compliance.regulationsFor("Germany", "import");
    expect(regs.length).toBeGreaterThan(0);
    expect(regs.every(r => r.category === "import")).toBe(true);
    expect(regs.some(r => r.title.includes("EORI"))).toBe(true);
  });

  it("checklist covers route, product and agreements without a shipment", async () => {
    const { items } = await caller.checklists.generate({ shipmentType: "import", originCountry: "Mexico", destinationCountry: "United States", productCategory: "General", htsCode: "0306.17.00" });
    const tasks = items.map(i => i.task);
    expect(tasks).toContain("Arrange customs bond and broker");
    expect(tasks.some(t => t.includes("FDA"))).toBe(true);
    expect(tasks.some(t => t.includes("USMCA"))).toBe(true);
    expect(items.every(i => i.completed === false)).toBe(true);
  });
});

describe("Certificate of origin guidance", () => {
  it("suggests wholly obtained for raw goods and tariff shift for manufactured goods", async () => {
    const raw = await caller.certificate.assist({ tradeAgreement: "USMCA", exporterCountry: "MEX", destinationCountry: "USA", htsCode: "0306.17.00" });
    expect(raw.recommendedCriterion).toBe("A");
    const made = await caller.certificate.assist({ tradeAgreement: "USMCA", exporterCountry: "MEX", destinationCountry: "USA", htsCode: "6109.10.00" });
    expect(made.recommendedCriterion).toBe("B");
    expect(made.warnings.some(w => w.includes("Textiles"))).toBe(true);
  });

  it("warns when the country is not a party", () => {
    const g = compliance.originGuidance({ tradeAgreement: "US_KOREA", exporterCountry: "CHN", destinationCountry: "USA", htsCode: "8471.30.01" });
    expect(g.warnings.some(w => w.includes("China"))).toBe(true);
  });
});

describe("Purchase order parsing", () => {
  const text = [
    "PURCHASE ORDER",
    "PO Number: PO-2026-001",
    "Date: 03/01/2026",
    "Buyer:",
    "Acme Imports LLC",
    "123 Main St, New York, NY 10001",
    "Vendor: Global Exports SA",
    "456 Industrial Ave, Monterrey, Mexico",
    "Incoterms: FOB Manzanillo   Currency: USD",
    "Payment Terms: Net 30",
    "Delivery Date: 2026-04-15",
    "1 Men's cotton t-shirts HTS 6109.10.0012 Origin: MEX 500 pcs $25.00 $12,500.00",
    "2 Women's denim jeans HTS 6204.62.4011 Origin: MEX 250 pcs $50.00 $12,500.00",
    "Grand Total: $25,000.00",
  ].join("\n");

  it("extracts header fields and line items from text", () => {
    const po = compliance.parsePurchaseOrder(text);
    expect(po).toMatchObject({
      poNumber: "PO-2026-001",
      poDate: "2026-03-01",
      buyerName: "Acme Imports LLC",
      sellerName: "Global Exports SA",
      incoterms: "FOB",
      currency: "USD",
      paymentTerms: "Net 30",
      deliveryDate: "2026-04-15",
      totalValue: "25000.00",
    });
    expect(po.lineItems).toHaveLength(2);
    expect(po.lineItems[0]).toMatchObject({ description: "Men's cotton t-shirts", quantity: "500", unit: "pcs", unitPrice: "25.00", totalPrice: "12500.00", htsCode: "6109.10.0012", countryOfOrigin: "MEX" });
  });

  it("reads text from a PDF", async () => {
    const { jsPDF } = await import("jspdf");
    const { getDocumentProxy, extractText } = await import("unpdf");
    const doc = new jsPDF();
    text.split("\n").forEach((l, i) => doc.text(l, 10, 10 + i * 7));
    const pdf = await getDocumentProxy(new Uint8Array(doc.output("arraybuffer")));
    const po = compliance.parsePurchaseOrder((await extractText(pdf, { mergePages: true })).text);
    expect(po.poNumber).toBe("PO-2026-001");
    expect(po.lineItems).toHaveLength(2);
  });

  it("parses CSV line items", () => {
    const po = compliance.parsePurchaseOrder("Description,Qty,Unit Price,Total,HTS Code,Origin\nCotton t-shirts,500,25.00,12500.00,6109.10.00,Mexico\n\"Jeans, denim\",250,50,12500,6204.62.40,MEX", true);
    expect(po.lineItems).toHaveLength(2);
    expect(po.lineItems[1]).toMatchObject({ description: "Jeans, denim", quantity: "250", htsCode: "6204.62.40", countryOfOrigin: "MEX" });
    expect(po.totalValue).toBe("25000.00");
  });
});
