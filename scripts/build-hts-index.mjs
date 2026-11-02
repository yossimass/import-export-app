// Builds server/data/hts-index.json from the official USITC HTS export.
// Run when a new HTS revision is published:  node scripts/build-hts-index.mjs
// Each entry is one 8-digit tariff line with its full description path,
// statistical-suffix descriptions (for search) and its rates, so search and
// duty lookups work without any external API.
import { writeFileSync } from "node:fs";

const SOURCE = "https://hts.usitc.gov/reststop/exportList?from=0100&to=9999&format=JSON&styles=false";
const strip = s => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().replace(/:$/, "");
const fmt8 = d => `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;

const rows = await (await fetch(SOURCE)).json();
const stack = []; // description of each ancestor by indent
const byCode = new Map();
for (const r of rows) {
  const indent = parseInt(r.indent, 10) || 0;
  stack.length = indent;
  stack[indent] = strip(r.description);
  const digits = (r.htsno || "").replace(/\D/g, "");
  // Chapters 98/99 are special provisions, not product classifications
  if (digits.length < 8 || digits.startsWith("98") || digits.startsWith("99")) continue;
  const code = fmt8(digits);
  const entry = byCode.get(code);
  if (!entry) {
    if (!r.general) continue; // statistical line whose rate line we haven't seen
    byCode.set(code, [code, stack.filter(Boolean).join(" > "), r.general, r.special || "", r.other || "", (r.units || []).join(","), ""]);
  } else if (digits.length > 8) {
    // Statistical suffix: keep its words for search ("Men's", "Boys'", ...)
    const extra = stack[indent];
    if (extra && extra !== "Other" && !entry[6].includes(extra)) entry[6] += (entry[6] ? "; " : "") + extra;
    if (!entry[5] && r.units?.length) entry[5] = r.units.join(",");
  }
}
const lines = [...byCode.values()];
writeFileSync(new URL("../server/data/hts-index.json", import.meta.url), JSON.stringify({
  source: "USITC Harmonized Tariff Schedule",
  builtAt: new Date().toISOString().slice(0, 10),
  fields: ["code", "path", "general", "special", "other", "units", "detail"],
  lines,
}));
console.log(`${lines.length} tariff lines written`);
