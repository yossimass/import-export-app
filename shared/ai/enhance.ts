/**
 * AI enhancement of rule-based results. Each feature always has a baseline
 * answer from official data / rules; when a model is available these functions
 * improve it. Model output is validated (zod + official HTS lookups) and merged,
 * and every addition is tagged `ai`. Any failure throws, and callers keep the
 * baseline. Runs unchanged on the server (hosted provider) and in the browser
 * (local Ollama).
 */
import { z } from "zod";
import type { ChatFn, ChatMessage } from "./chat";
import { parseJsonReply } from "./chat";
import type {
  AdditionalDuty, ChecklistItem, HtsResult, OfficialLine, OriginGuidance,
  ParsedPO, Regulation, TariffInput, TariffResult,
} from "../tradeTypes";

export type EnhanceDeps = {
  chat: ChatFn;
  /** Official schedule lookup used to reject invented HTS codes. */
  lookupCodes: (codes: string[]) => Promise<Record<string, OfficialLine | null>>;
};

async function askJson<T>(deps: EnhanceDeps, schema: z.ZodType<T>, messages: ChatMessage[], maxTokens = 1500): Promise<T> {
  try {
    return schema.parse(parseJsonReply(await deps.chat(messages, { json: true, maxTokens })));
  } catch (first) {
    // Strict JSON mode makes some small local models loop; retry once without it
    try {
      return schema.parse(parseJsonReply(await deps.chat(messages, { maxTokens })));
    } catch {
      throw first;
    }
  }
}

const clampPct = (n: number) => Math.min(500, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const htsDigits = (s: string) => s.replace(/\D/g, "");

// ============================================================================
// HTS CLASSIFICATION
// ============================================================================

const HtsReply = z.object({
  results: z.array(z.object({
    code: z.string(),
    reasoning: z.string().default(""),
    confidence: z.coerce.number().min(0).max(1).catch(0.6),
  })).max(10),
});

export async function enhanceHts(deps: EnhanceDeps, input: { query: string; candidates: HtsResult[] }): Promise<HtsResult[]> {
  const candidateList = input.candidates
    .slice(0, 15)
    .map(c => `${c.code} — ${c.description.slice(-180)} — duty ${c.dutyRate}`)
    .join("\n");
  const example = input.candidates[0]?.code ?? "6109.10.00";
  const reply = await askJson(deps, HtsReply, [
    {
      role: "system",
      content: `You are a US customs classification specialist. Pick the HTSUS 8-digit codes that best classify the product, applying the General Rules of Interpretation. Prefer codes from the candidate list; you may add other real HTSUS codes if none fit. Reply with JSON only, best first, at most 5, for example: {"results":[{"code":"${example}","reasoning":"one or two sentences","confidence":0.8}]}`,
    },
    { role: "user", content: `Product: ${input.query}\n\nCandidates from the tariff schedule (code — description — general duty):\n${candidateList || "(none)"}` },
  ]);

  // Small models sometimes put the code only in the reasoning; recover it from there
  const CODE = /\b\d{4}\.\d{2}(?:\.\d{2,4})?\b/;
  const picks = reply.results.map(r => ({ ...r, code: CODE.test(r.code) ? r.code.match(CODE)![0] : r.reasoning.match(CODE)?.[0] ?? r.code }));
  const official = await deps.lookupCodes(picks.map(r => r.code));
  const seen = new Set<string>();
  const aiResults: HtsResult[] = [];
  for (const r of picks) {
    const line = official[r.code];
    if (!line || seen.has(htsDigits(line.code))) continue; // invented or duplicate code
    seen.add(htsDigits(line.code));
    const confidence = round2(Math.min(0.85, r.confidence)); // models are overconfident
    aiResults.push({
      code: line.code,
      description: line.description,
      dutyRate: line.general || "varies",
      riskLevel: confidence >= 0.75 ? "low" : confidence >= 0.5 ? "medium" : "high",
      reasoning: r.reasoning || "Selected by the AI classifier; rate from the official schedule.",
      alternatives: [],
      confidence,
      source: "ai",
    });
  }
  if (aiResults.length === 0) throw new Error("AI suggested no valid HTS codes");

  const rest = input.candidates.filter(c => !seen.has(htsDigits(c.code)));
  return [...aiResults, ...rest].map((r, i, all) => ({
    ...r,
    alternatives: all.filter((_, j) => j !== i).slice(0, 2).map(a => ({ code: a.code, reason: a.description.split(" > ").pop() })),
  }));
}

// ============================================================================
// TARIFF
// ============================================================================

const TariffReply = z.object({
  additionalDuties: z.array(z.object({
    name: z.string(),
    ratePercent: z.coerce.number(),
    basis: z.string().default(""),
  })).max(6).default([]),
  baseRatePercent: z.coerce.number().nullable().optional(),
  notes: z.array(z.string()).max(6).default([]),
});

const RECOGNISED_DUTY = /\b(301|232|201|9903\.\d|IEEPA|reciprocal|fentanyl|anti-?dumping|countervailing|AD\/CVD|safeguard|retaliatory|surtax|surcharge on imports)\b/i;

export async function enhanceTariff(deps: EnhanceDeps, input: { input: TariffInput; base: TariffResult }): Promise<TariffResult> {
  const { input: t, base } = input;
  // US results come from the official schedule; other destinations from an entered rate
  const isUS = base.source === "official" || /^(usa?|united states)/i.test(t.destinationCountry.trim());
  const reply = await askJson(deps, TariffReply, [
    {
      role: "system",
      content: "You are a customs duty specialist. For the import described, list additional duties that apply on top of the base tariff (for US imports e.g. Section 301, Section 232, IEEPA/reciprocal tariffs, antidumping/countervailing duties), with the ad valorem rate in percent. Only include duties you are reasonably confident apply to this HTS code and origin today. For non-US destinations also estimate the base MFN duty rate in percent as baseRatePercent (null for US). Reply with JSON only, with keys additionalDuties (array of objects with name, ratePercent and basis — the legal basis or HTS chapter 99 heading; use an empty array if none apply), baseRatePercent (number, or null for US imports) and notes (array of short caveats; may be empty). Do not copy these instructions as values.",
    },
    {
      role: "user",
      content: `HTS ${t.htsCode}, origin ${t.originCountry}, destination ${t.destinationCountry}, customs value ${t.value}${t.incoterm ? `, incoterm ${t.incoterm}` : ""}.\nOfficial base result: applied rate ${base.appliedRate} (${base.tradeAgreement}), duty ${base.dutyAmount}.`,
    },
  ], 800);

  const lines: AdditionalDuty[] = [...(base.additionalDutyLines ?? [])];
  const userEnteredAdditional = t.additionalDutyRate !== undefined;
  // Drop template echoes like "short caveats" from small models
  const notes = reply.notes.filter(n => n.trim() && !/^(short )?caveats?\.?$|^(none|n\/a)\.?$/i.test(n.trim()));
  for (const d of reply.additionalDuties) {
    const rate = clampPct(d.ratePercent);
    if (!rate) continue;
    // Only recognised trade-remedy measures change the totals; anything else becomes a note
    if (!RECOGNISED_DUTY.test(`${d.name} ${d.basis}`) || rate > 200) {
      notes.push(`AI mentioned "${d.name}" at ${rate}% — not a recognised additional duty, so it was not added to the total.`);
      continue;
    }
    if (userEnteredAdditional) {
      notes.push(`AI suggests ${d.name} at ${rate}% (${d.basis}); not applied because you entered your own additional duty rate.`);
    } else {
      lines.push({ name: d.name, ratePercent: rate, amount: round2(t.value * rate / 100), basis: d.basis, source: "ai" });
    }
  }

  let dutyAmount = base.dutyAmount;
  let appliedRate = base.appliedRate;
  let mfnRate = base.mfnRate;
  let source = base.source;
  if (!isUS && t.dutyRate === undefined && reply.baseRatePercent != null) {
    const rate = clampPct(reply.baseRatePercent);
    dutyAmount = round2(t.value * rate / 100);
    appliedRate = mfnRate = `${rate}% (AI estimate)`;
    source = "ai";
  }

  const additionalDuties = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const totalDuties = round2(dutyAmount + additionalDuties + base.mpf + base.hmf);
  const landedCost = round2(t.value + (t.freightCost || 0) + (t.insuranceCost || 0) + totalDuties);
  return {
    ...base,
    mfnRate,
    appliedRate,
    dutyAmount,
    additionalDuties,
    additionalDutyLines: lines,
    totalDuties,
    landedCost,
    aiNotes: notes,
    source,
  };
}

// ============================================================================
// REGULATIONS & CHECKLISTS
// ============================================================================

const RegulationReply = z.object({
  regulations: z.array(z.object({
    title: z.string(),
    category: z.enum(["import", "export", "licensing", "restriction"]).catch("import"),
    description: z.string(),
    authority: z.string().default(""),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).catch("medium"),
    requirements: z.array(z.string()).default([]),
    documentation: z.array(z.string()).default([]),
    source: z.string().default(""),
    penalties: z.string().optional(),
  })).max(8),
});

function isNew(title: string, existing: string[]) {
  const t = norm(title);
  return !existing.some(e => {
    const n = norm(e);
    return n === t || n.includes(t) || t.includes(n);
  });
}

export async function enhanceRegulations(deps: EnhanceDeps, input: { country: string; htsCode?: string; productDescription?: string; base: Regulation[] }): Promise<Regulation[]> {
  const reply = await askJson(deps, RegulationReply, [
    {
      role: "system",
      content: "You are a trade compliance specialist. Add regulations that are specific to this product and country and are missing from the existing list: agency permits, product standards, labelling, restrictions, sanctions, quotas. Be concrete and cite the legal source. Do not repeat existing items. Reply with JSON only: {\"regulations\":[{\"title\":\"\",\"category\":\"import|export|licensing|restriction\",\"description\":\"\",\"authority\":\"\",\"riskLevel\":\"low|medium|high|critical\",\"requirements\":[\"\"],\"documentation\":[\"\"],\"source\":\"\",\"penalties\":\"\"}]} with at most 5 items.",
    },
    {
      role: "user",
      content: `Country: ${input.country}\nHTS code: ${input.htsCode || "not given"}${input.productDescription ? `\nProduct: ${input.productDescription}` : ""}\nExisting items:\n${input.base.map(r => `- ${r.title}`).join("\n")}`,
    },
  ]);
  const titles = input.base.map(r => r.title);
  const added: Regulation[] = [];
  for (const r of reply.regulations) {
    if (!isNew(r.title, titles)) continue;
    titles.push(r.title);
    added.push({ ...r, origin: "ai" });
  }
  return [...input.base, ...added];
}

const ChecklistReply = z.object({
  items: z.array(z.object({
    task: z.string(),
    description: z.string(),
    priority: z.enum(["required", "optional", "conditional"]).catch("conditional"),
    category: z.enum(["documentation", "compliance", "inspection", "payment"]).catch("compliance"),
    authority: z.string().optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).catch("medium"),
    deadline: z.string().default("Before shipment"),
  })).max(8),
});

export async function enhanceChecklist(deps: EnhanceDeps, input: { shipmentType: string; originCountry: string; destinationCountry: string; htsCode?: string; base: ChecklistItem[] }): Promise<ChecklistItem[]> {
  const reply = await askJson(deps, ChecklistReply, [
    {
      role: "system",
      content: "You are a trade compliance specialist. Add checklist tasks specific to this product and route that are missing from the existing checklist (permits, testing, product-specific documents, origin rules, duties). Do not repeat existing tasks. Reply with JSON only: {\"items\":[{\"task\":\"\",\"description\":\"\",\"priority\":\"required|optional|conditional\",\"category\":\"documentation|compliance|inspection|payment\",\"authority\":\"\",\"riskLevel\":\"low|medium|high|critical\",\"deadline\":\"\"}]} with at most 6 items.",
    },
    {
      role: "user",
      content: `${input.shipmentType} from ${input.originCountry} to ${input.destinationCountry}, HTS ${input.htsCode || "not given"}.\nExisting tasks:\n${input.base.map(i => `- ${i.task}`).join("\n")}`,
    },
  ]);
  const tasks = input.base.map(i => i.task);
  const added: ChecklistItem[] = [];
  for (const item of reply.items) {
    if (!isNew(item.task, tasks)) continue;
    tasks.push(item.task);
    added.push({ ...item, completed: false, origin: "ai" });
  }
  return [...input.base, ...added];
}

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

const opt = z.string().nullish().transform(v => (v && v.trim() ? v.trim() : undefined));
const PoReply = z.object({
  poNumber: opt, poDate: opt, buyerName: opt, buyerAddress: opt, sellerName: opt, sellerAddress: opt,
  shipToName: opt, shipToAddress: opt, incoterms: opt, currency: opt, paymentTerms: opt,
  deliveryDate: opt, totalValue: z.union([z.string(), z.number()]).nullish().transform(v => (v == null || v === "" ? undefined : String(v))), notes: opt,
  lineItems: z.array(z.object({
    lineNumber: z.coerce.number().optional().catch(undefined),
    description: z.string(),
    quantity: z.union([z.string(), z.number()]).nullish().transform(v => (v == null ? undefined : String(v))),
    unit: opt,
    unitPrice: z.union([z.string(), z.number()]).nullish().transform(v => (v == null ? undefined : String(v))),
    totalPrice: z.union([z.string(), z.number()]).nullish().transform(v => (v == null ? undefined : String(v))),
    htsCode: opt,
    countryOfOrigin: opt,
  })).default([]),
});

const PO_FIELDS = ["poNumber", "poDate", "buyerName", "buyerAddress", "sellerName", "sellerAddress", "shipToName", "shipToAddress", "incoterms", "currency", "paymentTerms", "deliveryDate", "totalValue", "notes"] as const;

const PLACEHOLDER = /^(null|none|n\/?a|unknown|string|number|iso[- ]?\d? ?code|yyyy-mm-dd|\.\.\.)$/i;
const DATE_FIELDS = new Set(["poDate", "deliveryDate"]);

/** Reject template echoes and values that aren't in the source document (text mode). */
function makeGroundCheck(text?: string) {
  const haystack = text ? text.toLowerCase().replace(/(\d),(\d)/g, "$1$2") : null;
  return (field: string, value: string | undefined): string | undefined => {
    if (!value || PLACEHOLDER.test(value.trim())) return undefined;
    if (DATE_FIELDS.has(field)) return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
    if (!haystack) return value; // image mode: nothing to compare against
    if (field === "totalValue" || field === "unitPrice" || field === "totalPrice" || field === "quantity") {
      const n = value.replace(/[^\d.]/g, "");
      const num = parseFloat(n);
      if (!n || isNaN(num)) return undefined;
      const forms = [n, String(num), num.toFixed(2)];
      return forms.some(f => haystack.includes(f)) ? value : undefined;
    }
    if (field === "currency" || field === "incoterms" || field === "countryOfOrigin") return /^[A-Z]{2,3}$/.test(value) ? value : undefined;
    const words = value.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    return words.length > 0 && words.every(w => haystack.includes(w)) ? value : undefined;
  };
}

/** Fill gaps in a rule-parsed PO from the document text, or read an image of it. */
export async function enhancePO(deps: EnhanceDeps, input: { base: ParsedPO; text?: string; imageDataUrl?: string }): Promise<ParsedPO> {
  const instructions = "Extract the purchase order. Reply with JSON only, using exactly these keys and null for anything not written in the document (never guess): poNumber, poDate (YYYY-MM-DD), buyerName, buyerAddress, sellerName, sellerAddress, shipToName, shipToAddress, incoterms (3-letter Incoterm), currency (3-letter ISO code), paymentTerms, deliveryDate (YYYY-MM-DD), totalValue, notes, lineItems (array of objects with lineNumber, description, quantity, unit, unitPrice, totalPrice, htsCode, countryOfOrigin as a 3-letter ISO code).";
  const content: ChatMessage["content"] = input.imageDataUrl
    ? [{ type: "text", text: instructions }, { type: "image_url", image_url: { url: input.imageDataUrl } }]
    : `${instructions}\n\nDocument:\n${(input.text || "").slice(0, 15000)}`;
  const ai = await askJson(deps, PoReply, [
    { role: "system", content: "You read trade documents and extract data exactly as written." },
    { role: "user", content },
  ], 2500);

  const check = makeGroundCheck(input.imageDataUrl ? undefined : input.text);
  // AI-suggested HTS codes must exist in the official schedule
  const official = await deps.lookupCodes(ai.lineItems.map(li => li.htsCode).filter((c): c is string => !!c));
  const aiLines = ai.lineItems
    .map(li => ({
      lineNumber: li.lineNumber,
      description: check("description", li.description) ?? li.description,
      quantity: check("quantity", li.quantity),
      unit: li.unit,
      unitPrice: check("unitPrice", li.unitPrice),
      totalPrice: check("totalPrice", li.totalPrice),
      htsCode: li.htsCode && official[li.htsCode] ? li.htsCode : undefined,
      countryOfOrigin: check("countryOfOrigin", li.countryOfOrigin?.toUpperCase()),
    }))
    .filter(li => li.description && !PLACEHOLDER.test(li.description));

  const merged: ParsedPO = { ...input.base, lineItems: input.base.lineItems };
  const aiFields: string[] = [];
  for (const field of PO_FIELDS) {
    const value = check(field, field === "currency" || field === "incoterms" ? ai[field]?.toUpperCase() : ai[field]);
    if (!merged[field] && value) {
      merged[field] = value;
      aiFields.push(field);
    }
  }
  if (merged.lineItems.length === 0 && aiLines.length > 0) {
    merged.lineItems = aiLines;
    aiFields.push("lineItems");
  } else {
    // Same rows: fill missing values per line
    merged.lineItems = merged.lineItems.map((li, i) => {
      const a = aiLines[i];
      if (!a) return li;
      const filled = {
        ...li,
        quantity: li.quantity || a.quantity,
        unitPrice: li.unitPrice || a.unitPrice,
        htsCode: li.htsCode || a.htsCode,
        countryOfOrigin: li.countryOfOrigin || a.countryOfOrigin,
      };
      if (JSON.stringify(filled) !== JSON.stringify(li)) aiFields.push(`lineItems.${i}`);
      return filled;
    });
  }
  return { ...merged, aiFields };
}

// ============================================================================
// CERTIFICATE OF ORIGIN
// ============================================================================

const OriginReply = z.object({
  recommendedCriterion: z.string(),
  criterionExplanation: z.string().default(""),
  eligibilityAssessment: z.string().default(""),
  warnings: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

export async function enhanceOrigin(deps: EnhanceDeps, input: {
  agreementName: string;
  criteria: Array<{ value: string; label: string; description: string }>;
  exporterCountry?: string;
  destinationCountry?: string;
  goodsDescription?: string;
  htsCode?: string;
  base: OriginGuidance;
}): Promise<OriginGuidance> {
  const reply = await askJson(deps, OriginReply, [
    {
      role: "system",
      content: "You are a rules-of-origin specialist. Judge which origin criterion applies and whether the goods likely qualify, considering the product-specific rule for the HS heading. Reply with JSON only: {\"recommendedCriterion\":\"one of the listed values\",\"criterionExplanation\":\"\",\"eligibilityAssessment\":\"\",\"warnings\":[\"\"],\"suggestions\":[\"\"]}",
    },
    {
      role: "user",
      content: `Agreement: ${input.agreementName}\nExporter: ${input.exporterCountry || "?"}, destination: ${input.destinationCountry || "?"}\nGoods: ${input.goodsDescription || "not described"}, HS ${input.htsCode || "?"}\nCriteria:\n${input.criteria.map(c => `${c.value}: ${c.label} — ${c.description}`).join("\n")}\nRule-based suggestion: ${input.base.recommendedCriterion}`,
    },
  ], 900);
  const valid = input.criteria.some(c => c.value === reply.recommendedCriterion);
  const union = (a: string[], b: string[]) => [...a, ...b.filter(x => isNew(x, a))];
  return {
    ...input.base,
    recommendedCriterion: valid ? reply.recommendedCriterion : input.base.recommendedCriterion,
    criterionExplanation: valid && reply.criterionExplanation ? reply.criterionExplanation : input.base.criterionExplanation,
    eligibilityAssessment: reply.eligibilityAssessment || input.base.eligibilityAssessment,
    warnings: union(input.base.warnings, reply.warnings),
    suggestions: union(input.base.suggestions, reply.suggestions),
    source: "ai",
  };
}

// ============================================================================
// ASSISTANT (AI only)
// ============================================================================

export async function askAssistant(deps: EnhanceDeps, input: {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: string;
}): Promise<string> {
  return deps.chat([
    {
      role: "system",
      content: `You are a trade compliance assistant for importers and exporters. Answer concisely and practically. Say when something must be verified with a customs broker or the official source, and never invent HTS codes or rates — if unsure, say so.${input.context ? `\n\nThe user's current shipment data (official rates and rule-based results):\n${input.context}` : ""}`,
    },
    ...(input.history ?? []).slice(-8),
    { role: "user", content: input.question },
  ], { maxTokens: 900 });
}
