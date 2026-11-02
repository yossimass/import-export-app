import { describe, it, expect } from "vitest";
import * as ai from "../shared/ai/enhance";
import { parseJsonReply } from "../shared/ai/chat";
import { lookupCodes } from "./ai";
import * as compliance from "./compliance";
import * as trade from "./tradeData";
import type { HtsResult } from "../shared/tradeTypes";

/** Deps whose model always replies with `reply`; lookups use the real bundled schedule. */
const fake = (reply: unknown): ai.EnhanceDeps => ({
  chat: async () => (typeof reply === "string" ? reply : "```json\n" + JSON.stringify(reply) + "\n```"),
  lookupCodes,
});

const candidates: HtsResult[] = [
  { code: "6109.90.10", description: "T-shirts > Of man-made fibers", dutyRate: "32%", riskLevel: "medium", reasoning: "", alternatives: [], confidence: 0.6, source: "rules" },
  { code: "6109.10.00", description: "T-shirts > Of cotton", dutyRate: "16.5%", riskLevel: "medium", reasoning: "", alternatives: [], confidence: 0.6, source: "rules" },
];

describe("parseJsonReply", () => {
  it("handles fences and chatter", () => {
    expect(parseJsonReply('Sure! ```json\n{"a":1}\n``` hope that helps')).toEqual({ a: 1 });
    expect(parseJsonReply('Here: {"b": [1,2]} done')).toEqual({ b: [1, 2] });
    expect(() => parseJsonReply("no json here")).toThrow();
  });
});

describe("HTS enhancement", () => {
  it("re-ranks, rejects invented codes and keeps official rates", async () => {
    const out = await ai.enhanceHts(fake({ results: [
      { code: "6109.10.00", reasoning: "Knitted cotton T-shirt", confidence: 0.9 },
      { code: "9999.99.99", reasoning: "invented", confidence: 0.99 },
    ] }), { query: "cotton t-shirt", candidates });
    expect(out[0]).toMatchObject({ code: "6109.10.00", dutyRate: "16.5%", source: "ai", confidence: 0.85 });
    expect(out.some(r => r.code.startsWith("9999"))).toBe(false);
    expect(out[1].code).toBe("6109.90.10"); // remaining rule results follow
  });

  it("fails (so the caller keeps rule results) when nothing valid comes back", async () => {
    await expect(ai.enhanceHts(fake({ results: [{ code: "0000.00.00" }] }), { query: "x", candidates })).rejects.toThrow();
    await expect(ai.enhanceHts(fake("I cannot help with that"), { query: "x", candidates })).rejects.toThrow();
  });
});

describe("Tariff enhancement", () => {
  const input = { htsCode: "8471.30.01", originCountry: "CHN", destinationCountry: "USA", value: 10000 };

  it("adds AI duties on top of official figures and recomputes totals", async () => {
    const base = (await trade.calculateUsTariff(input))!;
    const out = await ai.enhanceTariff(fake({ additionalDuties: [{ name: "Section 301", ratePercent: 25, basis: "9903.88.03" }], baseRatePercent: null, notes: ["Check exclusions"] }), { input, base });
    expect(out.additionalDutyLines).toEqual([expect.objectContaining({ name: "Section 301", amount: 2500, source: "ai" })]);
    expect(out.totalDuties).toBe(Math.round((base.totalDuties + 2500) * 100) / 100);
    expect(out.dutyAmount).toBe(base.dutyAmount); // official base duty untouched
    expect(out.aiNotes).toContain("Check exclusions");
  });

  it("does not override a rate the user entered", async () => {
    const withUser = { ...input, additionalDutyRate: 10 };
    const base = (await trade.calculateUsTariff(withUser))!;
    const out = await ai.enhanceTariff(fake({ additionalDuties: [{ name: "Section 301", ratePercent: 25, basis: "" }] }), { input: withUser, base });
    expect(out.additionalDuties).toBe(1000);
    expect(out.aiNotes?.[0]).toMatch(/not applied/);
  });
});

describe("Regulations, checklist, origin, PO", () => {
  it("appends only new regulations, tagged ai", async () => {
    const base = compliance.regulationsFor("USA", "all", "8517.13.00");
    const out = await ai.enhanceRegulations(fake({ regulations: [
      { title: base[0].title, category: "import", description: "dup" },
      { title: "FCC RF exposure (SAR) limits", category: "import", description: "Phones must meet SAR limits.", riskLevel: "bogus" },
    ] }), { country: "USA", htsCode: "8517.13.00", base });
    expect(out.length).toBe(base.length + 1);
    expect(out[out.length - 1]).toMatchObject({ title: "FCC RF exposure (SAR) limits", origin: "ai", riskLevel: "medium" });
  });

  it("appends checklist tasks unchecked", async () => {
    const base = compliance.checklistFor({ shipmentType: "import", originCountry: "VNM", destinationCountry: "USA", htsCode: "6109.10.00" });
    const out = await ai.enhanceChecklist(fake({ items: [{ task: "Obtain mill certificates for cotton", description: "Prove cotton origin." }] }), { shipmentType: "import", originCountry: "VNM", destinationCountry: "USA", base });
    expect(out[out.length - 1]).toMatchObject({ completed: false, origin: "ai" });
  });

  it("keeps the rule-based criterion when the AI picks an invalid one", async () => {
    const base = compliance.originGuidance({ tradeAgreement: "USMCA", exporterCountry: "MEX", destinationCountry: "USA", htsCode: "6109.10.00" });
    const criteria = [{ value: "A", label: "A", description: "" }, { value: "B", label: "B", description: "" }];
    const out = await ai.enhanceOrigin(fake({ recommendedCriterion: "Z", eligibilityAssessment: "Likely yes", warnings: ["Yarn-forward rule"] }), { agreementName: "USMCA", criteria, base });
    expect(out.recommendedCriterion).toBe(base.recommendedCriterion);
    expect(out.eligibilityAssessment).toBe("Likely yes");
    expect(out.warnings).toContain("Yarn-forward rule");
  });

  it("fills only missing PO fields and records them", async () => {
    const text = "PURCHASE ORDER\nPO Number: PO-9\nGoods from Acme Ltd, terms FOB\n1 Widgets 10 pcs $1.00 $10.00";
    const base = compliance.parsePurchaseOrder(text);
    const out = await ai.enhancePO(fake({
      poNumber: "WRONG", sellerName: "Acme Ltd", incoterms: "fob", shipToName: "Invented Warehouse",
      lineItems: [{ description: "Widgets", htsCode: "8481.80.90", countryOfOrigin: "ISO-3 code" }],
    }), { base, text });
    expect(out.poNumber).toBe("PO-9"); // rule value kept
    expect(out.sellerName).toBe("Acme Ltd");
    expect(out.shipToName).toBeUndefined(); // not in the document
    expect(out.lineItems[0].htsCode).toBe("8481.80.90");
    expect(out.lineItems[0].countryOfOrigin).toBeUndefined(); // template echo dropped
    expect(out.aiFields).toEqual(expect.arrayContaining(["sellerName", "lineItems.0"]));
  });
});

describe("Tariff enhancement guards", () => {
  it("keeps unrecognised AI duties out of the totals", async () => {
    const input = { htsCode: "6402.12.00", originCountry: "CHN", destinationCountry: "USA", value: 10000 };
    const base = (await trade.calculateUsTariff(input))!;
    const out = await ai.enhanceTariff(fake({ additionalDuties: [
      { name: "Trade Preference Agreement (TPA)", ratePercent: 10, basis: "" },
      { name: "Section 301", ratePercent: 25, basis: "9903.88.03" },
    ] }), { input, base });
    expect(out.additionalDutyLines?.map(l => l.name)).toEqual(["Section 301"]);
    expect(out.aiNotes?.some(n => n.includes("Trade Preference Agreement"))).toBe(true);
  });
});
