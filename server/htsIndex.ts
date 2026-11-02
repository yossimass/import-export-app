/**
 * Local copy of the USITC Harmonized Tariff Schedule (8-digit tariff lines).
 * Built by scripts/build-hts-index.mjs; bundled with the function so HTS search
 * and duty lookups need no network calls or LLM.
 */
import index from "./data/hts-index.json";

export type IndexedLine = {
  code: string;
  path: string;
  general: string;
  special: string;
  other: string;
  units: string[];
  detail: string;
};

export const HTS_INDEX_DATE: string = index.builtAt;

const lines: IndexedLine[] = (index.lines as string[][]).map(([code, path, general, special, other, units, detail]) => ({
  code, path, general, special, other, units: units ? units.split(",") : [], detail,
}));

const digitsOf = (code: string) => code.replace(/\D/g, "");

/** Tariff lines whose code starts with the given digits (4+ digits). */
export function linesByPrefix(code: string): IndexedLine[] {
  const digits = digitsOf(code).slice(0, 8);
  if (digits.length < 4) return [];
  return lines.filter(l => digitsOf(l.code).startsWith(digits));
}

// ── Keyword search ───────────────────────────────────────────────────────────

// Everyday words → the wording the tariff schedule uses
const SYNONYMS: Record<string, string[]> = {
  laptop: ["portable", "automatic", "data", "processing"],
  notebook: ["portable", "automatic", "data", "processing"],
  computer: ["automatic", "data", "processing"],
  pc: ["automatic", "data", "processing"],
  tablet: ["portable", "automatic", "data", "processing"],
  phone: ["telephone"],
  cellphone: ["smartphones"],
  smartphone: ["smartphones"],
  mobile: ["smartphones"],
  tv: ["television"],
  tee: ["tshirts"],
  tshirt: ["tshirts"],
  shoe: ["footwear"],
  sneaker: ["footwear", "sports"],
  boot: ["footwear"],
  sandal: ["footwear"],
  bike: ["bicycles"],
  bicycle: ["bicycles"],
  car: ["motor", "cars", "vehicles"],
  truck: ["motor", "vehicles", "goods"],
  sofa: ["seats"],
  couch: ["seats"],
  chair: ["seats"],
  headphone: ["headphones"],
  earbud: ["earphones"],
  speaker: ["loudspeakers"],
  battery: ["batteries"],
  charger: ["static", "converters"],
  cable: ["conductors"],
  bulb: ["lamps"],
  led: ["lightemitting", "diodes"],
  solar: ["photovoltaic"],
  toy: ["toys"],
  doll: ["dolls"],
  jacket: ["anoraks", "jackets"],
  coat: ["overcoats"],
  jeans: ["trousers", "denim"],
  pants: ["trousers"],
  dress: ["dresses"],
  sweater: ["sweaters", "pullovers"],
  hoodie: ["sweatshirts"],
  sock: ["socks", "hosiery"],
  bag: ["handbags", "bags"],
  backpack: ["backpacks"],
  wallet: ["wallets"],
  watch: ["wristwatches"],
  glasses: ["spectacles"],
  sunglasses: ["sunglasses"],
  coffee: ["coffee"],
  tea: ["tea"],
  wine: ["wine", "grapes"],
  beer: ["beer", "malt"],
  steel: ["steel"],
  pipe: ["tubes", "pipes"],
  screw: ["screws"],
  bolt: ["bolts"],
  plastic: ["plastics"],
  vitamin: ["vitamins"],
  medicine: ["medicaments"],
  drug: ["medicaments"],
  cosmetic: ["beauty", "makeup"],
  perfume: ["perfumes"],
  furniture: ["furniture"],
  mattress: ["mattresses"],
};

const STOP_WORDS = new Set(["a", "an", "and", "the", "of", "for", "with", "in", "on", "or", "to", "made", "new", "used"]);

const normalize = (s: string) =>
  s.toLowerCase().replace(/[’'ʼ]/g, "").replace(/-/g, "").replace(/[^a-z0-9]+/g, " ");

/** Crude stemmer so "shirts"/"shirt" and "batteries"/"battery" match. */
const stem = (w: string) =>
  w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
    : w.length > 4 && /(ches|shes|sses|xes)$/.test(w) ? w.slice(0, -2)
      : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1)
        : w;

type Prepared = { line: IndexedLine; heading: Set<string>; leaf: Set<string>; path: Set<string>; detail: Set<string> };
let prepared: Prepared[] | null = null;

function prepare(): Prepared[] {
  if (!prepared) {
    const words = (s: string) => new Set(normalize(s).split(" ").filter(Boolean).map(stem));
    prepared = lines.map(line => {
      const segments = line.path.split(" > ");
      return {
        line,
        heading: words(segments[0]),
        leaf: words(segments[segments.length - 1]),
        path: words(line.path),
        detail: words(line.detail),
      };
    });
  }
  return prepared;
}

export type SearchHit = IndexedLine & { score: number; matched: number; total: number };

/** Rank tariff lines against a free-text product description. */
export function searchByKeywords(query: string, limit = 10): SearchHit[] {
  const raw = normalize(query).split(" ").filter(w => w && !STOP_WORDS.has(w));
  if (raw.length === 0) return [];

  // Each query term is satisfied by itself or by its synonym phrase (all words)
  const terms = raw.map(w => {
    const s = stem(w);
    const synonym = SYNONYMS[s] ?? SYNONYMS[w];
    return synonym ? [[s], synonym.map(stem)] : [[s]];
  });

  const wordScore = (p: Prepared, t: string) =>
    p.leaf.has(t) ? 3 : p.path.has(t) ? 2 : p.detail.has(t) ? 1 : 0;

  const hits: SearchHit[] = [];
  for (const p of prepare()) {
    let score = 0;
    let matched = 0;
    for (const alternatives of terms) {
      let best = 0;
      let inHeading = false;
      for (const group of alternatives) {
        const groupScore = Math.min(...group.map(t => wordScore(p, t)));
        if (groupScore > best) {
          best = groupScore;
          inHeading = group.every(t => p.heading.has(t));
        }
      }
      if (best) matched++;
      // A match in the heading means the product category itself matches
      score += best + (inHeading ? 1 : 0);
    }
    if (matched === 0) continue;
    // Prefer lines matching every term, then specific leaves over "Other" buckets
    score += matched === terms.length ? 4 : 0;
    if (/>\s*Other$/.test(p.line.path)) score -= 0.5;
    hits.push({ ...p.line, score, matched, total: terms.length });
  }

  hits.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  // Require most terms to match so single common words don't flood the list
  const minMatched = Math.max(1, Math.ceil(terms.length * 0.5));
  return hits.filter(h => h.matched >= minMatched).slice(0, limit);
}
