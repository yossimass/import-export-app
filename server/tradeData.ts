/**
 * Deterministic trade calculations that replace LLM calls.
 * - HTS lookups and duty rates come from a bundled copy of the USITC schedule
 *   (server/htsIndex.ts), falling back to the USITC HTS REST API.
 * - Exchange rates come from open.er-api.com (free, no key, daily updates).
 * - Shipping estimates and certificate validation are rule-based.
 */

import type { TradeAgreement } from "../shared/tradeAgreements";
import { linesByPrefix } from "./htsIndex";
import type { AdditionalDuty, TariffResult } from "../shared/tradeTypes";

const USITC_SEARCH = "https://hts.usitc.gov/reststop/search";
const FETCH_TIMEOUT_MS = 6000;

// CBP Merchandise Processing Fee, FY2026 (effective Oct 1, 2025).
// Update every October from the CBP user fee notice.
export const MPF_RATE = 0.003464;
export const MPF_MIN = 33.58;
export const MPF_MAX = 651.5;
// Harbor Maintenance Fee applies to ocean shipments only
export const HMF_RATE = 0.00125;
const OCEAN_INCOTERMS = new Set(["FAS", "FOB", "CFR", "CIF"]);

// USITC "Special" column program codes → ISO-3 origin countries (FTAs only)
const SPECIAL_PROGRAMS: Record<string, { name: string; countries: string[] }> = {
  S: { name: "USMCA", countries: ["CAN", "MEX"] },
  AU: { name: "US–Australia FTA", countries: ["AUS"] },
  BH: { name: "US–Bahrain FTA", countries: ["BHR"] },
  CL: { name: "US–Chile FTA", countries: ["CHL"] },
  CO: { name: "US–Colombia TPA", countries: ["COL"] },
  IL: { name: "US–Israel FTA", countries: ["ISR"] },
  JO: { name: "US–Jordan FTA", countries: ["JOR"] },
  KR: { name: "KORUS", countries: ["KOR"] },
  MA: { name: "US–Morocco FTA", countries: ["MAR"] },
  OM: { name: "US–Oman FTA", countries: ["OMN"] },
  P: { name: "CAFTA-DR", countries: ["CRI", "SLV", "GTM", "HND", "NIC", "DOM"] },
  PA: { name: "US–Panama TPA", countries: ["PAN"] },
  PE: { name: "US–Peru TPA", countries: ["PER"] },
  SG: { name: "US–Singapore FTA", countries: ["SGP"] },
};

// Countries subject to HTS Column 2 ("Other") rates
const COLUMN_2_COUNTRIES = new Set(["CUB", "PRK", "RUS", "BLR"]);

async function fetchJson<T>(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

// ============================================================================
// HTS LOOKUP
// ============================================================================

type UsitcRow = {
  htsno: string;
  indent: string;
  description: string;
  general: string;
  special: string;
  other: string;
  units: string[];
};

export type HtsLine = {
  code: string;
  description: string;
  general: string;
  special: string;
  other: string;
  units: string[];
};

const digitsOf = (code: string) => code.replace(/\D/g, "");
const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

/** True if the query looks like an HTS code rather than a product description. */
export function looksLikeHtsCode(query: string) {
  return /^\s*\d{4}(\.?\d{2}){0,3}\s*$/.test(query);
}

/** Look up an HTS code; rates are inherited from the 8-digit tariff line. */
export async function lookupHts(code: string, timeoutMs?: number): Promise<HtsLine | null> {
  const digits = digitsOf(code);
  if (digits.length < 4) return null;

  const local = linesByPrefix(digits)[0];
  if (local) {
    return {
      code: local.code,
      description: local.path,
      general: local.general,
      special: local.special,
      other: local.other,
      units: local.units,
    };
  }

  // Not in the bundled copy (e.g. a code added since it was built): ask USITC
  const searchKey = digits.length >= 8
    ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
    : digits;
  const rows = await fetchJson<UsitcRow[]>(`${USITC_SEARCH}?keyword=${encodeURIComponent(searchKey)}`, timeoutMs);
  const candidates = rows.filter(r => {
    const rowDigits = digitsOf(r.htsno || "");
    return rowDigits.length > 0 && (digits.startsWith(rowDigits) || rowDigits.startsWith(digits));
  });
  if (candidates.length === 0) return null;

  // Most specific line for the description, nearest ancestor with a rate for duties
  const byLength = [...candidates].sort((a, b) => digitsOf(b.htsno).length - digitsOf(a.htsno).length);
  const exact = byLength.find(r => digits.startsWith(digitsOf(r.htsno))) ?? byLength[byLength.length - 1];
  const rated = byLength.find(r => r.general && digits.startsWith(digitsOf(r.htsno)))
    ?? candidates.find(r => r.general);
  if (!rated) return null;

  return {
    code: exact.htsno,
    description: stripTags(exact.description),
    general: rated.general,
    special: rated.special || "",
    other: rated.other || "",
    units: rated.units || exact.units || [],
  };
}

// ============================================================================
// RATE PARSING & TARIFF CALCULATION
// ============================================================================

type ParsedRate = { adValorem: number; perKgUsd: number; perUnitUsd: number; unsupported: string[] };

/** Parse a USITC rate string like "Free", "16.5%", "4.4¢/kg + 6%", "$1.24/t". */
export function parseRate(rate: string): ParsedRate {
  const out: ParsedRate = { adValorem: 0, perKgUsd: 0, perUnitUsd: 0, unsupported: [] };
  const text = stripTags(rate).trim();
  if (!text || /^free$/i.test(text)) return out;
  for (const part of text.split("+").map(p => p.trim()).filter(Boolean)) {
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^([\d.]+)%/))) {
      out.adValorem += parseFloat(m[1]) / 100;
    } else if ((m = part.match(/^([\d.]+)¢\/(kg|t|No\.|doz\.|pr\.)/i)) || (m = part.match(/^\$([\d.]+)\/(kg|t|No\.|doz\.|pr\.)/i))) {
      const usd = part.includes("¢") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      if (unit === "kg") out.perKgUsd += usd;
      else if (unit === "t") out.perKgUsd += usd / 1000;
      else if (unit === "no.") out.perUnitUsd += usd;
      else out.unsupported.push(part);
    } else if (/^free/i.test(part)) {
      // e.g. "Free (A,AU,...)" fragments already stripped by caller
    } else {
      out.unsupported.push(part);
    }
  }
  return out;
}

/** Find the preferential rate (and program) that applies to an origin country. */
function findPreferential(special: string, origin: string): { rate: string; program: string } | null {
  for (const m of Array.from(special.matchAll(/([^()]+?)\s*\(([^)]+)\)/g))) {
    const rate = m[1].trim();
    const codes = m[2].split(",").map((c: string) => c.trim().replace(/[+*]$/, ""));
    for (const code of codes) {
      const program = SPECIAL_PROGRAMS[code];
      if (program?.countries.includes(origin)) return { rate, program: program.name };
    }
  }
  return null;
}

const pct = (r: number) => `${+(r * 100).toFixed(3)}%`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type TariffInput = {
  htsCode: string;
  originCountry: string;
  value: number;
  quantity?: number;
  weight?: number;
  incoterm?: string;
  freightCost?: number;
  insuranceCost?: number;
  additionalDutyRate?: number; // percent, e.g. 25 for Section 301 List 3
};

/** US import duty calculation from official HTS rates. Returns null if the code isn't found. */
export async function calculateUsTariff(input: TariffInput): Promise<TariffResult | null> {
  const line = await lookupHts(input.htsCode);
  if (!line) return null;

  const origin = input.originCountry.toUpperCase();
  const notes: string[] = [];
  let rateText = line.general;
  let tradeAgreement = "MFN (Normal Trade Relations)";
  let preferentialRate: string | null = null;

  if (COLUMN_2_COUNTRIES.has(origin)) {
    rateText = line.other;
    tradeAgreement = "Column 2 (non-NTR)";
  } else {
    const pref = findPreferential(line.special, origin);
    if (pref) {
      preferentialRate = pref.rate;
      rateText = pref.rate;
      tradeAgreement = pref.program;
      notes.push(`${pref.program} preference requires a valid certification of origin.`);
    }
  }

  const rate = parseRate(rateText);
  let dutyAmount = input.value * rate.adValorem;
  if (rate.perKgUsd) {
    if (input.weight) dutyAmount += rate.perKgUsd * input.weight;
    else notes.push("Specific (per-kg) duty applies but no weight was given.");
  }
  if (rate.perUnitUsd) {
    if (input.quantity) dutyAmount += rate.perUnitUsd * input.quantity;
    else notes.push("Specific (per-unit) duty applies but no quantity was given.");
  }
  if (rate.unsupported.length) {
    notes.push(`Rate component(s) not auto-calculated: ${rate.unsupported.join(", ")}.`);
  }

  const additionalDuties = input.value * ((input.additionalDutyRate ?? 0) / 100);
  const additionalDutyLines: AdditionalDuty[] = input.additionalDutyRate
    ? [{ name: "Additional duty (entered)", ratePercent: input.additionalDutyRate, amount: round2(additionalDuties), basis: "Entered by you", source: "user" }]
    : [];
  if (origin === "CHN" && !input.additionalDutyRate) {
    notes.push("Goods of Chinese origin may be subject to Section 301 and other additional duties — enter them as an additional duty %.");
  }

  const mpf = Math.min(Math.max(input.value * MPF_RATE, MPF_MIN), MPF_MAX);
  const isOcean = OCEAN_INCOTERMS.has((input.incoterm || "").toUpperCase());
  const hmf = isOcean ? input.value * HMF_RATE : 0;
  const totalDuties = dutyAmount + additionalDuties + mpf + hmf;
  const landedCost = input.value + (input.freightCost || 0) + (input.insuranceCost || 0) + totalDuties;

  const explanation = [
    `HTS ${line.code} — ${line.description}.`,
    `General (MFN) rate: ${line.general || "n/a"}. Applied: ${rateText || "n/a"} under ${tradeAgreement}.`,
    `MPF ${pct(MPF_RATE)} (min $${MPF_MIN}, max $${MPF_MAX})${isOcean ? `, HMF ${pct(HMF_RATE)} (ocean freight)` : ""}.`,
    ...notes,
  ].join("\n");

  return {
    mfnRate: line.general,
    preferentialRate,
    additionalDuties: round2(additionalDuties),
    appliedRate: rateText,
    tradeAgreement,
    exclusionStatus: "none",
    dutyAmount: round2(dutyAmount),
    mpf: round2(mpf),
    hmf: round2(hmf),
    totalDuties: round2(totalDuties),
    landedCost: round2(landedCost),
    rateSource: "USITC HTS (hts.usitc.gov)",
    rationale: explanation,
    explanation,
    alternatives: [] as Array<{ scenario: string; impact: string }>,
    effectiveDate: new Date().toISOString(),
    additionalDutyLines,
    source: "official",
  };
}

// ============================================================================
// CURRENCY
// ============================================================================

const fxCache = new Map<string, { expires: number; rates: Record<string, number> }>();

export async function convertCurrency(amount: number, from: string, to: string) {
  const base = from.toUpperCase();
  const target = to.toUpperCase();
  let entry = fxCache.get(base);
  if (!entry || entry.expires < Date.now()) {
    const data = await fetchJson<{ result: string; rates: Record<string, number> }>(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`
    );
    if (data.result !== "success") throw new Error(`Unsupported currency: ${base}`);
    entry = { expires: Date.now() + 60 * 60 * 1000, rates: data.rates };
    fxCache.set(base, entry);
  }
  const rate = entry.rates[target];
  if (!rate) throw new Error(`Unsupported currency: ${target}`);
  return {
    convertedAmount: round2(amount * rate),
    exchangeRate: rate,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// SHIPPING ESTIMATE (rough industry rate bands, USD)
// ============================================================================

const SHIPPING_BANDS = {
  express: { perKg: [7, 12], minimum: 60, transit: "2-5 days" },
  air: { perKg: [3.5, 6], minimum: 150, transit: "5-10 days" },
  sea: { perKg: [0.25, 0.6], minimum: 250, transit: "20-45 days" },
} as const;

export function estimateShipping(input: {
  weight: number;
  dimensions?: { length: number; width: number; height: number };
}) {
  // Air/express charge the greater of actual and volumetric weight (cm³ / 5000)
  const volumetric = input.dimensions
    ? (input.dimensions.length * input.dimensions.width * input.dimensions.height) / 5000
    : 0;
  const chargeable = Math.max(input.weight, volumetric);
  const band = (mode: keyof typeof SHIPPING_BANDS, kg: number) => {
    const b = SHIPPING_BANDS[mode];
    return {
      low: Math.round(Math.max(b.minimum, kg * b.perKg[0])),
      high: Math.round(Math.max(b.minimum, kg * b.perKg[1])),
      transitTime: b.transit,
    };
  };
  const air = band("air", chargeable);
  return {
    chargeableWeightKg: round2(chargeable),
    estimatedCost: Math.round((air.low + air.high) / 2),
    express: band("express", chargeable),
    air,
    sea: band("sea", input.weight),
    note: "Indicative ranges only. Get carrier/forwarder quotes for actual pricing.",
  };
}

// ============================================================================
// CERTIFICATE OF ORIGIN VALIDATION
// ============================================================================

export function validateCertificate(
  input: {
    exporterAddress?: string;
    consigneeAddress?: string;
    htsCode?: string;
    countryOfOrigin: string;
    destinationCountry?: string;
    originCriterion?: string;
    agreementFields?: Record<string, string>;
  },
  agreement: TradeAgreement | undefined
) {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!input.exporterAddress) missingFields.push("Exporter address");
  if (!input.consigneeAddress) missingFields.push("Consignee address");
  if (!input.htsCode) suggestions.push("Add an HS/HTS code — most customs authorities expect one.");
  else if (!looksLikeHtsCode(input.htsCode)) warnings.push(`HS code "${input.htsCode}" is not in a recognized format (e.g. 6109.10.00).`);

  let criterion: TradeAgreement["originCriteria"][number] | undefined;
  if (agreement) {
    for (const field of agreement.additionalFields) {
      if (field.required && !input.agreementFields?.[field.key]) missingFields.push(field.label);
    }
    if (agreement.originCriteria.length > 0) {
      if (!input.originCriterion) {
        missingFields.push("Origin criterion");
      } else {
        criterion = agreement.originCriteria.find(c => c.value === input.originCriterion);
        if (!criterion) warnings.push(`Origin criterion "${input.originCriterion}" is not defined for ${agreement.shortName}.`);
      }
    }
    if (agreement.eligibleCountries.length > 0) {
      if (!agreement.eligibleCountries.includes(input.countryOfOrigin)) {
        warnings.push(`${input.countryOfOrigin} is not a party to ${agreement.shortName}; goods may not qualify for preference.`);
      }
      if (input.destinationCountry && !agreement.eligibleCountries.includes(input.destinationCountry)) {
        warnings.push(`Destination ${input.destinationCountry} is not covered by ${agreement.shortName}.`);
      }
    }
    suggestions.push(...agreement.requiredDocuments.map(d => `Keep on file: ${d}`));
  }

  return {
    isValid: missingFields.length === 0 && warnings.length === 0,
    warnings,
    suggestions,
    originCriterionExplanation: criterion?.description ?? "",
    recommendedCriterion: criterion?.value ?? "",
    tradeAgreements: agreement ? [agreement.id] : [],
    complianceScore: Math.max(0, 100 - missingFields.length * 15 - warnings.length * 10),
    missingFields,
  };
}
