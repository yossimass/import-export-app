/**
 * Rule-based compliance content (no LLM): country regulations, shipment
 * checklists, certificate-of-origin guidance and purchase-order parsing.
 * Content is general guidance curated from the agencies' public requirements;
 * every item names its authority/source so users can verify specifics.
 */
import { COUNTRIES } from "../shared/countries";
import { getAgreementById, getApplicableAgreements } from "../shared/tradeAgreements";
import type { ChecklistItem, OriginGuidance, ParsedPO, Regulation } from "../shared/tradeTypes";
export type { ChecklistItem, ParsedPO, Regulation };

// ============================================================================
// COUNTRIES
// ============================================================================

const EU_MEMBERS = new Set([
  "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL",
  "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
]);

const ALIASES: Record<string, string> = {
  US: "USA", "UNITED STATES": "USA", "UNITED STATES OF AMERICA": "USA", AMERICA: "USA",
  UK: "GBR", GB: "GBR", "UNITED KINGDOM": "GBR", BRITAIN: "GBR", "GREAT BRITAIN": "GBR", ENGLAND: "GBR",
  CN: "CHN", PRC: "CHN", MX: "MEX", CA: "CAN", DE: "DEU", FR: "FRA", JP: "JPN", KR: "KOR",
  "SOUTH KOREA": "KOR", KOREA: "KOR", IN: "IND", VN: "VNM", VIETNAM: "VNM", "VIET NAM": "VNM",
  AU: "AUS", BR: "BRA", IT: "ITA", ES: "ESP", NL: "NLD", TW: "TWN", HK: "HKG", RUSSIA: "RUS",
  EU: "EU", "EUROPEAN UNION": "EU", HOLLAND: "NLD", TURKEY: "TUR", TURKIYE: "TUR",
};

/** Resolve a country name, ISO-2/ISO-3 code or common alias to ISO-3 ("EU" for the union). */
export function resolveCountry(input: string | undefined | null): string {
  const q = (input || "").trim().toUpperCase().replace(/\./g, "");
  if (!q) return "";
  if (ALIASES[q]) return ALIASES[q];
  const byCode = COUNTRIES.find(c => c.code === q);
  if (byCode) return byCode.code;
  const byName = COUNTRIES.find(c => c.name.toUpperCase() === q)
    ?? COUNTRIES.find(c => c.name.toUpperCase().startsWith(q) && q.length >= 4);
  return byName?.code ?? q;
}

export function countryName(code: string): string {
  if (code === "EU") return "European Union";
  return COUNTRIES.find(c => c.code === code)?.name ?? code;
}

const chapterOf = (hts?: string) => {
  const d = (hts || "").replace(/\D/g, "");
  return d.length >= 2 ? parseInt(d.slice(0, 2), 10) : 0;
};
const headingOf = (hts?: string) => (hts || "").replace(/\D/g, "").slice(0, 4);
const inChapters = (ch: number, ...ranges: Array<number | [number, number]>) =>
  ranges.some(r => (Array.isArray(r) ? ch >= r[0] && ch <= r[1] : ch === r));

// ============================================================================
// REGULATIONS
// ============================================================================

const COUNTRY_REGULATIONS: Record<string, Regulation[]> = {
  USA: [
    {
      title: "Customs entry and Importer of Record",
      category: "import",
      description: "Commercial shipments must be entered with CBP by the importer of record or a licensed customs broker. Formal entry is required for shipments valued over $2,500.",
      authority: "U.S. Customs and Border Protection (CBP)",
      riskLevel: "high",
      requirements: ["File entry (CBP Form 3461) and entry summary (CBP Form 7501) within 10 working days", "Post a customs bond for formal entries", "Use reasonable care in classification and valuation"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading / air waybill", "Customs bond"],
      source: "19 CFR Parts 141–143",
      penalties: "Penalties under 19 U.S.C. 1592 for negligence, gross negligence or fraud",
    },
    {
      title: "Importer Security Filing (ISF 10+2)",
      category: "import",
      description: "Ocean shipments require an Importer Security Filing with 10 data elements from the importer and 2 from the carrier.",
      authority: "CBP",
      riskLevel: "high",
      requirements: ["Submit ISF at least 24 hours before cargo is loaded on the vessel abroad", "Update the filing if information changes"],
      documentation: ["ISF filing confirmation"],
      source: "19 CFR Part 149",
      penalties: "Liquidated damages of $5,000 per violation",
    },
    {
      title: "Country of origin marking",
      category: "import",
      description: "Imported articles must be legibly and permanently marked with their English-language country of origin so the ultimate purchaser can see it.",
      authority: "CBP",
      riskLevel: "medium",
      requirements: ["Mark goods or their containers conspicuously", "Use the English name of the country (e.g. 'Made in China')"],
      documentation: [],
      source: "19 U.S.C. 1304; 19 CFR Part 134",
      penalties: "10% marking duty; re-marking or export under supervision",
    },
    {
      title: "Section 301, 232 and other additional duties",
      category: "restriction",
      description: "Additional ad valorem duties apply to many goods, notably Section 301 duties on goods of Chinese origin and Section 232 duties on steel, aluminum and derivatives. Rates change frequently.",
      authority: "USTR / CBP",
      riskLevel: "high",
      requirements: ["Check Chapter 99 of the HTS for your 8-digit code and origin", "Report the Chapter 99 number alongside the base HTS code on entry"],
      documentation: [],
      source: "HTSUS Chapter 99; ustr.gov",
      penalties: "Duty underpayment, interest and penalties",
    },
    {
      title: "Uyghur Forced Labor Prevention Act (UFLPA)",
      category: "restriction",
      description: "Goods mined, produced or manufactured wholly or in part in Xinjiang, or by entities on the UFLPA Entity List, are presumed to be made with forced labor and barred from entry.",
      authority: "CBP / DHS",
      riskLevel: "critical",
      requirements: ["Map your supply chain to raw materials", "Screen suppliers against the UFLPA Entity List"],
      documentation: ["Supply-chain tracing documentation"],
      source: "Public Law 117-78; 19 U.S.C. 1307",
      penalties: "Detention, exclusion or seizure of goods",
    },
    {
      title: "Export Administration Regulations (EAR)",
      category: "export",
      description: "US-origin goods, software and technology may need an export license depending on their ECCN, destination, end use and end user.",
      authority: "Bureau of Industry and Security (BIS)",
      riskLevel: "high",
      requirements: ["Classify the item (ECCN or EAR99)", "Screen parties against the Consolidated Screening List", "File EEI in AES when value per Schedule B line exceeds $2,500 or a license is required"],
      documentation: ["Electronic Export Information (EEI)", "Export license if required"],
      source: "15 CFR Parts 730–774; 15 CFR Part 30",
      penalties: "Civil penalties over $300,000 per violation; criminal penalties",
    },
    {
      title: "OFAC sanctions",
      category: "restriction",
      description: "Transactions with sanctioned countries, regions and listed persons are prohibited without OFAC authorization.",
      authority: "Treasury — Office of Foreign Assets Control",
      riskLevel: "critical",
      requirements: ["Screen all parties against the SDN List", "Check country-based sanctions programs"],
      documentation: [],
      source: "31 CFR Chapter V",
      penalties: "Strict-liability civil penalties; criminal prosecution",
    },
  ],
  CAN: [
    {
      title: "CARM registration and release",
      category: "import",
      description: "Commercial importers need a Business Number with an import/export account and must use the CBSA Assessment and Revenue Management (CARM) portal to account for goods and pay duties.",
      authority: "Canada Border Services Agency (CBSA)",
      riskLevel: "high",
      requirements: ["Register in the CARM Client Portal", "Post financial security for release prior to payment"],
      documentation: ["Commercial invoice or Canada Customs Invoice", "Bill of lading", "Commercial Accounting Declaration"],
      source: "Customs Act; CBSA D-Memoranda",
      penalties: "Administrative Monetary Penalty System (AMPS)",
    },
    {
      title: "CFIA import requirements",
      category: "licensing",
      description: "Food, plants and animals and their products must meet Canadian Food Inspection Agency requirements; many food importers need a Safe Food for Canadians licence.",
      authority: "Canadian Food Inspection Agency (CFIA)",
      riskLevel: "medium",
      requirements: ["Check the Automated Import Reference System (AIRS)", "Obtain an SFC licence where required"],
      documentation: ["Permits and certificates listed in AIRS"],
      source: "Safe Food for Canadians Regulations",
    },
    {
      title: "Bilingual labelling",
      category: "import",
      description: "Most consumer products must carry mandatory label information in both English and French.",
      authority: "Competition Bureau / Health Canada",
      riskLevel: "medium",
      requirements: ["Provide product identity, net quantity and dealer identity in English and French"],
      documentation: [],
      source: "Consumer Packaging and Labelling Act",
    },
  ],
  MEX: [
    {
      title: "Importer registry (Padrón de Importadores)",
      category: "licensing",
      description: "Importers must be registered in the general importer registry with SAT, and some sectors require the sector-specific registry.",
      authority: "SAT (Servicio de Administración Tributaria)",
      riskLevel: "high",
      requirements: ["Register in the Padrón de Importadores", "Use a licensed customs broker (agente aduanal)"],
      documentation: ["Pedimento (customs declaration)", "Commercial invoice", "Bill of lading"],
      source: "Ley Aduanera",
      penalties: "Seizure and fines",
    },
    {
      title: "NOM compliance",
      category: "import",
      description: "Many products must meet Mexican Official Standards (NOMs) for safety and labelling in Spanish before customs clearance.",
      authority: "Secretaría de Economía",
      riskLevel: "medium",
      requirements: ["Identify applicable NOMs by tariff fraction", "Label in Spanish before or at import"],
      documentation: ["NOM certificate or conformity evidence"],
      source: "Ley de Infraestructura de la Calidad",
    },
  ],
  EU: [
    {
      title: "EORI number and customs declaration",
      category: "import",
      description: "Businesses importing into the EU need an EORI number and must lodge a customs declaration; goods arriving by sea or air also require an entry summary declaration under ICS2.",
      authority: "National customs authority (Union Customs Code)",
      riskLevel: "high",
      requirements: ["Obtain an EORI number", "Ensure the carrier files the ICS2 entry summary declaration", "Pay customs duty and import VAT"],
      documentation: ["Commercial invoice", "Transport document", "Customs declaration (SAD/H1)"],
      source: "Regulation (EU) No 952/2013 (Union Customs Code)",
    },
    {
      title: "CE marking and product safety",
      category: "import",
      description: "Products covered by EU harmonisation legislation (electrical equipment, machinery, toys, PPE and more) must carry CE marking and have an EU-based responsible economic operator.",
      authority: "Market surveillance authorities",
      riskLevel: "high",
      requirements: ["Complete conformity assessment and an EU Declaration of Conformity", "Name an EU responsible person on the product or packaging"],
      documentation: ["EU Declaration of Conformity", "Technical file"],
      source: "Regulation (EU) 2019/1020; General Product Safety Regulation (EU) 2023/988",
    },
    {
      title: "REACH chemical restrictions",
      category: "restriction",
      description: "Substances imported over 1 tonne per year must be registered, and restricted substances in articles are limited under REACH Annex XVII.",
      authority: "European Chemicals Agency (ECHA)",
      riskLevel: "medium",
      requirements: ["Check SVHC content above 0.1% w/w", "Register substances where volume thresholds apply"],
      documentation: ["Safety data sheets"],
      source: "Regulation (EC) No 1907/2006",
    },
    {
      title: "Carbon Border Adjustment Mechanism (CBAM)",
      category: "import",
      description: "Imports of iron and steel, aluminium, cement, fertilisers, hydrogen and electricity are subject to CBAM reporting and, from 2026, certificate obligations.",
      authority: "European Commission / national CBAM authorities",
      riskLevel: "medium",
      requirements: ["Register as an authorised CBAM declarant if you import covered goods", "Collect embedded emissions data from producers"],
      documentation: ["CBAM declaration"],
      source: "Regulation (EU) 2023/956",
    },
  ],
  GBR: [
    {
      title: "UK customs declarations",
      category: "import",
      description: "Goods imported into Great Britain need an EORI number starting with GB and a customs declaration in the Customs Declaration Service.",
      authority: "HM Revenue & Customs (HMRC)",
      riskLevel: "high",
      requirements: ["Get a GB EORI number", "Classify goods with the UK Global Tariff", "Account for import VAT (postponed VAT accounting available)"],
      documentation: ["Commercial invoice", "Transport document", "Customs declaration"],
      source: "Taxation (Cross-border Trade) Act 2018",
    },
    {
      title: "UKCA / CE marking",
      category: "import",
      description: "Products such as electrical equipment, machinery and toys must meet GB product safety rules and carry UKCA or, for most product types, CE marking.",
      authority: "Office for Product Safety and Standards",
      riskLevel: "medium",
      requirements: ["Hold a declaration of conformity", "Show a UK importer's name and address on the product or packaging"],
      documentation: ["UK or EU Declaration of Conformity"],
      source: "Product safety regulations (GB)",
    },
  ],
  CHN: [
    {
      title: "Customs registration and declaration",
      category: "import",
      description: "Consignees must be registered with China Customs and declare goods through the Single Window, using China's 10-digit HS codes.",
      authority: "General Administration of Customs (GACC)",
      riskLevel: "high",
      requirements: ["Register with GACC", "Declare via the China International Trade Single Window"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading", "Sales contract"],
      source: "Customs Law of the PRC",
    },
    {
      title: "China Compulsory Certification (CCC)",
      category: "licensing",
      description: "Products in the CCC catalogue — including many electrical products, vehicle parts and toys — must be certified and marked before import or sale.",
      authority: "SAMR / CNCA",
      riskLevel: "high",
      requirements: ["Check whether the product is in the CCC catalogue", "Obtain certification and apply the CCC mark"],
      documentation: ["CCC certificate"],
      source: "Regulations on Compulsory Product Certification",
      penalties: "Detention, return or destruction of goods",
    },
    {
      title: "Overseas food manufacturer registration",
      category: "licensing",
      description: "Overseas manufacturers of food products exported to China must be registered with GACC.",
      authority: "GACC",
      riskLevel: "high",
      requirements: ["Register the foreign manufacturer (CIFER)", "Print the registration number on packaging"],
      documentation: ["Health certificate where required"],
      source: "GACC Decree 248",
    },
  ],
  JPN: [
    {
      title: "Import declaration",
      category: "import",
      description: "Imports are declared to Japan Customs through NACCS, normally by a licensed customs broker, and consumption tax is collected at import.",
      authority: "Japan Customs",
      riskLevel: "medium",
      requirements: ["Declare via NACCS", "Pay customs duty and consumption tax"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading / air waybill"],
      source: "Customs Act of Japan",
    },
    {
      title: "Food Sanitation Act notification",
      category: "licensing",
      description: "Food, food additives, utensils and food-contact packaging require an import notification to MHLW quarantine stations.",
      authority: "Ministry of Health, Labour and Welfare (MHLW)",
      riskLevel: "medium",
      requirements: ["Submit the import notification before clearance"],
      documentation: ["Notification form", "Ingredient and manufacturing information"],
      source: "Food Sanitation Act",
    },
    {
      title: "PSE mark for electrical products",
      category: "import",
      description: "Electrical appliances and materials covered by the DENAN law must meet technical standards and bear the PSE mark.",
      authority: "Ministry of Economy, Trade and Industry (METI)",
      riskLevel: "medium",
      requirements: ["Notify METI as an importer", "Confirm conformity and apply the PSE mark"],
      documentation: ["Conformity records"],
      source: "Electrical Appliances and Materials Safety Act",
    },
  ],
  KOR: [
    {
      title: "Import declaration and KC certification",
      category: "import",
      description: "Imports are declared to Korea Customs Service via UNI-PASS; electrical, telecom and children's products generally need KC certification.",
      authority: "Korea Customs Service / KATS",
      riskLevel: "medium",
      requirements: ["Declare via UNI-PASS", "Obtain KC certification where required"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading", "KC certificate"],
      source: "Customs Act; Electrical Appliances and Consumer Products Safety Control Act",
    },
  ],
  AUS: [
    {
      title: "Import declaration and biosecurity",
      category: "import",
      description: "Goods over AUD 1,000 need a full import declaration, and all imports are subject to biosecurity controls including packaging and dunnage rules.",
      authority: "Australian Border Force / Department of Agriculture (DAFF)",
      riskLevel: "high",
      requirements: ["Lodge an import declaration via the Integrated Cargo System", "Check BICON for import conditions", "Treat or certify timber packaging"],
      documentation: ["Commercial invoice", "Packing declaration", "Bill of lading"],
      source: "Customs Act 1901; Biosecurity Act 2015",
      penalties: "Fines, treatment, re-export or destruction",
    },
  ],
  IND: [
    {
      title: "Importer-Exporter Code (IEC) and Bill of Entry",
      category: "licensing",
      description: "Importers need an IEC from DGFT and file a Bill of Entry on ICEGATE; certain products require BIS certification.",
      authority: "DGFT / CBIC",
      riskLevel: "high",
      requirements: ["Obtain an IEC", "File the Bill of Entry on ICEGATE", "Check BIS Compulsory Registration for electronics"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading", "Bill of Entry"],
      source: "Foreign Trade (Development and Regulation) Act; Customs Act 1962",
    },
  ],
  BRA: [
    {
      title: "RADAR registration and import licensing",
      category: "licensing",
      description: "Importers must be enabled in Siscomex (RADAR), and many products need an import licence (LI/LPCO) before shipment.",
      authority: "Receita Federal / SECEX",
      riskLevel: "high",
      requirements: ["Obtain RADAR enablement", "Check licensing requirements before shipment", "File the import declaration (DUIMP)"],
      documentation: ["Commercial invoice", "Packing list", "Bill of lading", "Import licence where required"],
      source: "Siscomex regulations",
    },
  ],
};

const GENERIC_REGULATIONS: Regulation[] = [
  {
    title: "Customs declaration and duties",
    category: "import",
    description: "Imports must be declared to the national customs authority with the HS classification, customs value and origin, and duties and taxes paid before release.",
    authority: "National customs authority",
    riskLevel: "high",
    requirements: ["Classify goods with the destination's national tariff", "Declare transaction value per the WTO Valuation Agreement"],
    documentation: ["Commercial invoice", "Packing list", "Transport document"],
    source: "WTO Customs Valuation Agreement; national customs law",
  },
  {
    title: "Product standards and labelling",
    category: "import",
    description: "Most countries apply technical regulations and labelling rules to consumer goods; check the destination's standards body for your product.",
    authority: "National standards / consumer protection authority",
    riskLevel: "medium",
    requirements: ["Confirm applicable technical regulations", "Label in the local language where required"],
    documentation: ["Conformity certificates where required"],
    source: "WTO TBT Agreement notifications",
  },
];

/** Regulations triggered by the product's HTS chapter/heading. */
function productRegulations(country: string, hts?: string): Regulation[] {
  const ch = chapterOf(hts);
  const heading = headingOf(hts);
  if (!ch) return [];
  const out: Regulation[] = [];
  const isUS = country === "USA";

  if (inChapters(ch, [1, 24], 30, 33)) {
    out.push(isUS ? {
      title: "FDA food, drug and cosmetic requirements",
      category: "import",
      description: "FDA-regulated products (food, beverages, drugs, cosmetics, medical devices) must meet FDA requirements; food shipments need Prior Notice and food facilities must be registered.",
      authority: "U.S. Food and Drug Administration (FDA)",
      riskLevel: "high",
      requirements: ["Submit FDA Prior Notice for food before arrival", "Register food facilities with FDA", "Meet FSVP requirements as the importer of food"],
      documentation: ["Prior Notice confirmation", "FDA product codes on entry"],
      source: "21 CFR Part 1 Subpart I; FSMA",
      penalties: "Refusal of admission, detention",
    } : {
      title: "Sanitary and health requirements",
      category: "import",
      description: "Food, agricultural, pharmaceutical and cosmetic products are subject to health and sanitary controls, often including registration and a health certificate.",
      authority: "National food / health authority",
      riskLevel: "high",
      requirements: ["Check registration requirements for the producer and product", "Obtain health or sanitary certificates from the exporting country"],
      documentation: ["Health certificate", "Certificate of analysis"],
      source: "WTO SPS Agreement",
    });
  }
  if (inChapters(ch, [1, 14], 44)) {
    out.push(isUS ? {
      title: "USDA APHIS plant and animal health",
      category: "licensing",
      description: "Live animals, animal products, plants, seeds, fruits, vegetables and some wood products may need APHIS permits and phytosanitary or veterinary certificates.",
      authority: "USDA Animal and Plant Health Inspection Service (APHIS)",
      riskLevel: "high",
      requirements: ["Check APHIS import requirements (ACIR)", "Obtain import permits where required", "Comply with ISPM 15 for wood packaging"],
      documentation: ["Phytosanitary or veterinary certificate", "APHIS import permit"],
      source: "7 CFR Parts 319, 330; 9 CFR Parts 92–98",
      penalties: "Refusal, treatment or destruction",
    } : {
      title: "Phytosanitary and veterinary controls",
      category: "licensing",
      description: "Plants, plant products and animal products generally need phytosanitary or veterinary certificates and may require import permits.",
      authority: "National plant and animal health authority",
      riskLevel: "high",
      requirements: ["Obtain certificates from the exporting country's authority", "Check import permit requirements"],
      documentation: ["Phytosanitary certificate", "Veterinary health certificate"],
      source: "IPPC / WOAH standards",
    });
  }
  if (isUS && inChapters(ch, 2, 16) ) {
    out.push({
      title: "USDA FSIS meat and poultry inspection",
      category: "restriction",
      description: "Meat, poultry and egg products may only be imported from FSIS-eligible countries and establishments and are re-inspected on arrival.",
      authority: "USDA Food Safety and Inspection Service (FSIS)",
      riskLevel: "high",
      requirements: ["Confirm the country and establishment are FSIS-eligible", "Schedule re-inspection at an official import establishment"],
      documentation: ["Foreign inspection certificate"],
      source: "9 CFR Part 327",
    });
  }
  if (isUS && inChapters(ch, 22, 24)) {
    out.push({
      title: "TTB alcohol and tobacco permits",
      category: "licensing",
      description: "Importers of alcoholic beverages and tobacco need a TTB importer permit, label approval (COLA) for alcohol, and must pay federal excise tax.",
      authority: "Alcohol and Tobacco Tax and Trade Bureau (TTB)",
      riskLevel: "high",
      requirements: ["Obtain a TTB importer's basic permit", "Get Certificates of Label Approval (COLA)"],
      documentation: ["TTB permit", "COLA"],
      source: "27 CFR Parts 1, 4, 5, 7, 27",
    });
  }
  if (inChapters(ch, 28, 29, 38, 39) || heading === "3808") {
    out.push(isUS ? {
      title: "TSCA chemical certification",
      category: "import",
      description: "Chemical substances, mixtures and some articles require a TSCA positive or negative certification at import; pesticides fall under FIFRA.",
      authority: "U.S. Environmental Protection Agency (EPA)",
      riskLevel: "medium",
      requirements: ["Certify TSCA compliance on entry", "File EPA Form 3540-1 for pesticides"],
      documentation: ["TSCA certification", "Safety data sheets"],
      source: "40 CFR Part 707; 19 CFR 12.118–12.127",
    } : {
      title: "Chemical registration and safety data",
      category: "import",
      description: "Chemicals and pesticides are usually subject to registration, classification and labelling rules (GHS) in the destination country.",
      authority: "National chemicals authority",
      riskLevel: "medium",
      requirements: ["Check registration requirements", "Provide GHS-compliant labels and safety data sheets"],
      documentation: ["Safety data sheets"],
      source: "UN GHS",
    });
  }
  if (inChapters(ch, 84, 85, 90)) {
    if (isUS && ch === 85) {
      out.push({
        title: "FCC equipment authorization",
        category: "import",
        description: "Devices that emit radio-frequency energy (wireless, Bluetooth, most digital electronics) must be FCC authorized before import for sale.",
        authority: "Federal Communications Commission (FCC)",
        riskLevel: "medium",
        requirements: ["Confirm Certification or Supplier's Declaration of Conformity", "Label devices with the FCC ID where required"],
        documentation: ["FCC Form 740 declaration where applicable"],
        source: "47 CFR Part 2 Subpart J",
      });
    }
    if (headingOf(hts) === "8506" || headingOf(hts) === "8507") {
      out.push({
        title: "Lithium battery dangerous-goods rules",
        category: "restriction",
        description: "Lithium cells and batteries are dangerous goods in transport and must be tested to UN 38.3, packed and labelled for the transport mode.",
        authority: isUS ? "PHMSA / IATA / IMO" : "IATA / IMO",
        riskLevel: "high",
        requirements: ["Obtain the UN 38.3 test summary", "Ship under the correct UN number with DG declaration"],
        documentation: ["UN 38.3 test summary", "Dangerous goods declaration"],
        source: "49 CFR 173.185; IATA DGR; IMDG Code",
      });
    }
    if (!isUS && ch === 85) {
      out.push({
        title: "Electrical safety and EMC certification",
        category: "import",
        description: "Electrical and electronic products generally require safety and electromagnetic-compatibility certification and marking in the destination market.",
        authority: "National product safety / telecom authority",
        riskLevel: "medium",
        requirements: ["Identify the local mark (CE, UKCA, CCC, PSE, KC, RCM…)", "Test to the applicable standards"],
        documentation: ["Test reports", "Declaration of conformity"],
        source: "IEC standards adopted nationally",
      });
    }
  }
  if (ch === 95 || heading === "9503") {
    out.push(isUS ? {
      title: "CPSC children's product certification",
      category: "import",
      description: "Toys and other children's products must be third-party tested by a CPSC-accepted lab and certified with a Children's Product Certificate, and carry tracking labels.",
      authority: "Consumer Product Safety Commission (CPSC)",
      riskLevel: "high",
      requirements: ["Test to ASTM F963 and lead/phthalate limits", "Issue a Children's Product Certificate", "Add permanent tracking labels"],
      documentation: ["Children's Product Certificate", "Third-party test reports"],
      source: "Consumer Product Safety Improvement Act; 16 CFR Part 1107",
      penalties: "Seizure, recall, civil penalties",
    } : {
      title: "Toy safety requirements",
      category: "import",
      description: "Toys are subject to specific safety standards (e.g. EN 71 in Europe), chemical limits and age labelling.",
      authority: "National product safety authority",
      riskLevel: "high",
      requirements: ["Test to the local toy safety standard", "Apply required markings and warnings"],
      documentation: ["Test reports", "Declaration of conformity"],
      source: "e.g. Directive 2009/48/EC",
    });
  }
  if (inChapters(ch, [50, 63])) {
    if (isUS) {
      out.push({
        title: "Textile labelling and fiber content",
        category: "import",
        description: "Textile apparel and home textiles must be labelled with fiber content, country of origin and manufacturer identity; entries require textile-specific invoice details.",
        authority: "Federal Trade Commission (FTC) / CBP",
        riskLevel: "medium",
        requirements: ["Label fiber content and origin", "Include manufacturer ID (MID) on the entry", "Provide fiber and construction details on the invoice"],
        documentation: ["Commercial invoice with textile details"],
        source: "Textile Fiber Products Identification Act; 16 CFR Part 303; 19 CFR 102.21",
      });
    }
  }
  if (inChapters(ch, 64)) {
    out.push({
      title: "Footwear invoice and labelling details",
      category: "import",
      description: "Footwear classification depends on upper and outer-sole materials, construction and use, so invoices must describe them in detail.",
      authority: isUS ? "CBP" : "National customs authority",
      riskLevel: "medium",
      requirements: ["Describe upper/sole materials by percentage", "State gender, construction and intended use"],
      documentation: ["Detailed commercial invoice"],
      source: isUS ? "CBP Informed Compliance: Footwear" : "HS Chapter 64 notes",
    });
  }
  if (inChapters(ch, 72, 73, 76)) {
    out.push(isUS ? {
      title: "Section 232 steel and aluminum duties",
      category: "restriction",
      description: "Steel and aluminum products and many derivatives are subject to Section 232 duties; aluminum imports also need an import license, and steel licensing applies.",
      authority: "Department of Commerce / CBP",
      riskLevel: "high",
      requirements: ["Check the Chapter 99 heading for your product", "Obtain steel/aluminum import licenses from the Commerce licensing system", "Report melt-and-pour / smelt-and-cast country"],
      documentation: ["Steel or aluminum import license"],
      source: "Proclamations under Section 232; 19 CFR Part 360",
    } : {
      title: "Trade remedies on metals",
      category: "restriction",
      description: "Many countries apply safeguard, anti-dumping or countervailing duties to steel and aluminium products.",
      authority: "National trade remedies authority",
      riskLevel: "medium",
      requirements: ["Check for safeguard and anti-dumping measures on your product and origin"],
      documentation: ["Mill certificates"],
      source: "WTO Safeguards / Anti-Dumping Agreements",
    });
  }
  if (inChapters(ch, 87)) {
    if (isUS) {
      out.push({
        title: "DOT/NHTSA and EPA vehicle standards",
        category: "import",
        description: "Motor vehicles and equipment must meet Federal Motor Vehicle Safety Standards and EPA emissions rules; HS-7 and EPA 3520-1 declarations are filed at entry.",
        authority: "NHTSA / EPA",
        riskLevel: "high",
        requirements: ["File DOT HS-7 declaration", "File EPA Form 3520-1 for engines/vehicles"],
        documentation: ["HS-7", "EPA 3520-1"],
        source: "49 CFR Part 591; 40 CFR Part 85",
      });
    }
  }
  if (ch === 93) {
    out.push({
      title: "Arms and munitions controls",
      category: "licensing",
      description: "Firearms, ammunition and parts require import permits and may be prohibited or controlled under arms-control regimes.",
      authority: isUS ? "ATF / State Department (DDTC)" : "National arms control authority",
      riskLevel: "critical",
      requirements: ["Obtain import permits before shipment"],
      documentation: ["Import permit (e.g. ATF Form 6)"],
      source: isUS ? "27 CFR Part 447; ITAR" : "Wassenaar Arrangement",
    });
  }
  return out;
}

export function regulationsFor(countryInput: string, regulationType: string, htsCode?: string): Regulation[] {
  const country = resolveCountry(countryInput);
  const base = COUNTRY_REGULATIONS[country]
    ?? (EU_MEMBERS.has(country) ? COUNTRY_REGULATIONS.EU : GENERIC_REGULATIONS);
  const all = [...base, ...productRegulations(country, htsCode)].map(r => ({ ...r, origin: "rules" as const }));
  if (regulationType === "all") return all;
  const wanted = regulationType === "restrictions" ? "restriction" : regulationType;
  return all.filter(r => r.category === wanted);
}

// ============================================================================
// CHECKLIST
// ============================================================================

export function checklistFor(input: {
  shipmentType: "import" | "export";
  originCountry: string;
  destinationCountry: string;
  htsCode?: string;
}): ChecklistItem[] {
  const origin = resolveCountry(input.originCountry);
  const dest = resolveCountry(input.destinationCountry);
  const items: ChecklistItem[] = [];
  const add = (item: Omit<ChecklistItem, "completed">) => items.push({ ...item, completed: false, origin: "rules" });

  add({ task: "Confirm HS/HTS classification", description: `Verify the ${input.htsCode ? `code ${input.htsCode}` : "tariff code"} against the destination tariff; it drives duty rates, permits and admissibility.`, priority: "required", category: "compliance", riskLevel: "high", deadline: "Before quoting / ordering" });
  add({ task: "Screen all parties", description: "Check buyer, seller, consignee and freight parties against sanctions and denied-party lists (e.g. OFAC SDN, BIS Entity List, EU/UN lists).", priority: "required", category: "compliance", riskLevel: "critical", deadline: "Before accepting the order" });
  add({ task: "Prepare commercial invoice", description: "Include seller, buyer, full goods description, HTS code, quantity, unit and total value, currency, Incoterm and country of origin.", priority: "required", category: "documentation", riskLevel: "high", deadline: "Before shipment" });
  add({ task: "Prepare packing list", description: "List packages, contents, net/gross weights and dimensions so customs can examine efficiently.", priority: "required", category: "documentation", riskLevel: "medium", deadline: "Before shipment" });
  add({ task: "Obtain transport document", description: "Bill of lading (ocean) or air waybill (air) issued by the carrier or forwarder.", priority: "required", category: "documentation", riskLevel: "medium", deadline: "At departure" });
  add({ task: "Confirm Incoterm and insurance", description: "Agree who pays freight, insurance, duties and taxes, and where risk transfers.", priority: "required", category: "payment", riskLevel: "medium", deadline: "At contract" });
  add({ task: "Check origin marking and labelling", description: "Make sure goods and packaging carry the country of origin and any language or safety labels the destination requires.", priority: "required", category: "compliance", riskLevel: "medium", deadline: "Before production finishes" });
  add({ task: "Wood packaging (ISPM 15)", description: "Pallets and crates of solid wood must be heat-treated or fumigated and stamped with the ISPM 15 mark.", priority: "conditional", category: "inspection", riskLevel: "medium", deadline: "Before packing" });

  if (input.shipmentType === "export") {
    add({ task: "Determine export control classification", description: origin === "USA" ? "Classify under the EAR (ECCN or EAR99) and check whether a license is needed for the destination and end use." : "Check the exporting country's dual-use and export control lists for licensing needs.", priority: "required", category: "compliance", riskLevel: "high", deadline: "Before shipment" });
    if (origin === "USA") add({ task: "File EEI in AES", description: "File Electronic Export Information when a Schedule B line exceeds $2,500 or a license is required.", priority: "conditional", category: "documentation", authority: "U.S. Census Bureau", riskLevel: "high", deadline: "Before export (ocean: 24h before loading)" });
  }

  if (dest === "USA") {
    add({ task: "Arrange customs bond and broker", description: "Formal entries (over $2,500) require a customs bond; most importers use a licensed customs broker.", priority: "required", category: "payment", authority: "CBP", riskLevel: "high", deadline: "Before arrival" });
    add({ task: "File ISF (ocean only)", description: "Importer Security Filing at least 24 hours before loading at the foreign port.", priority: "conditional", category: "documentation", authority: "CBP", riskLevel: "high", deadline: "24h before vessel loading" });
    add({ task: "Check additional duties (Chapter 99)", description: "Look up Section 301, 232 and other additional duties for your HTS code and origin.", priority: "required", category: "payment", authority: "CBP / USTR", riskLevel: "high", deadline: "Before quoting landed cost" });
    if (origin === "CHN") add({ task: "UFLPA supply-chain documentation", description: "Keep tracing documents showing no inputs come from Xinjiang or UFLPA-listed entities.", priority: "required", category: "compliance", authority: "CBP", riskLevel: "critical", deadline: "Before shipment" });
  } else if (dest === "EU" || EU_MEMBERS.has(dest)) {
    add({ task: "Get an EORI number", description: "Required for any business lodging customs declarations in the EU.", priority: "required", category: "documentation", riskLevel: "high", deadline: "Before arrival" });
  } else if (dest === "GBR") {
    add({ task: "Get a GB EORI number", description: "Required to import into Great Britain.", priority: "required", category: "documentation", riskLevel: "high", deadline: "Before arrival" });
  }

  // Product-specific permits from the regulation rules
  for (const reg of productRegulations(dest, input.htsCode)) {
    add({
      task: reg.title,
      description: reg.requirements.length ? reg.requirements.join("; ") + "." : reg.description,
      priority: "required",
      category: reg.category === "licensing" ? "documentation" : "compliance",
      authority: reg.authority,
      riskLevel: reg.riskLevel,
      deadline: "Before shipment",
    });
  }

  // Preferential origin
  const agreements = getApplicableAgreements(origin, dest).filter(a => a.id !== "GENERIC");
  if (agreements.length) {
    add({
      task: `Claim ${agreements.map(a => a.shortName).join(" / ")} preference`,
      description: "Goods that meet the rules of origin can enter duty-free or at reduced rates. Prepare the certification of origin and keep supporting records.",
      priority: "optional",
      category: "documentation",
      riskLevel: "low",
      deadline: "At entry",
    });
  } else {
    add({ task: "Certificate of origin (if requested)", description: "Some buyers, banks or destinations require a chamber-of-commerce certificate of origin even without a trade agreement.", priority: "conditional", category: "documentation", riskLevel: "low", deadline: "Before shipment" });
  }

  add({ task: "Pay duties, taxes and fees", description: "Budget for customs duty, import VAT/GST where applicable, and processing fees (e.g. US MPF/HMF).", priority: "required", category: "payment", riskLevel: "medium", deadline: "At clearance" });
  add({ task: "Retain records", description: "Keep entry and supporting records (invoices, certificates, payments) for at least five years.", priority: "required", category: "compliance", riskLevel: "medium", deadline: "After clearance" });
  return items;
}

// ============================================================================
// CERTIFICATE OF ORIGIN GUIDANCE
// ============================================================================

export function originGuidance(input: {
  tradeAgreement: string;
  exporterCountry?: string;
  destinationCountry?: string;
  goodsDescription?: string;
  htsCode?: string;
}): OriginGuidance {
  const agreement = getAgreementById(input.tradeAgreement);
  const criteria = agreement?.originCriteria ?? [];
  const ch = chapterOf(input.htsCode);
  const heading = headingOf(input.htsCode);
  const text = (input.goodsDescription || "").toLowerCase();
  const exporter = resolveCountry(input.exporterCountry);
  const dest = resolveCountry(input.destinationCountry);

  // Raw agricultural, fishery and mineral goods are usually "wholly obtained";
  // manufactured goods usually qualify through tariff shift / substantial transformation.
  const likelyWhollyObtained = inChapters(ch, [1, 14], [25, 27]) || /\b(fresh|raw|live|mined|harvested|unprocessed)\b/.test(text);
  const pick = (pattern: RegExp) => criteria.find(c => pattern.test(c.label));
  let criterion = likelyWhollyObtained
    ? pick(/wholly/i)
    : pick(/tariff (classification )?(change|shift)|substantial|sufficiently|processed/i);
  if (agreement?.id === "USMCA" && (heading === "8471" || heading === "8473")) criterion = pick(/data processing/i) ?? criterion;
  criterion ??= criteria[0];

  const warnings: string[] = [];
  if (agreement && agreement.eligibleCountries.length) {
    if (exporter && !agreement.eligibleCountries.includes(exporter)) warnings.push(`${countryName(exporter)} is not a beneficiary of ${agreement.shortName}.`);
    if (dest && !agreement.eligibleCountries.includes(dest) && agreement.id !== "EU_GSP") warnings.push(`${countryName(dest)} is not a party to ${agreement.shortName}.`);
  }
  if (!input.htsCode) warnings.push("Add an HS code — product-specific rules of origin depend on it.");
  if (inChapters(ch, [50, 63])) warnings.push("Textiles and apparel often have strict yarn-forward or fabric-forward rules; check the product-specific rule.");
  if (ch === 87) warnings.push("Automotive goods usually have high regional value content thresholds.");

  const suggestions = [
    likelyWhollyObtained
      ? "Keep records showing where the goods were grown, raised, harvested or extracted."
      : "Prepare a bill of materials with the HS code and origin of each input to show the required tariff shift or value content.",
    "Collect supplier declarations for originating materials.",
    "Check the product-specific rule for your HS heading in the agreement's annex.",
  ];

  return {
    recommendedCriterion: criterion?.value ?? "",
    criterionExplanation: criterion
      ? `${criterion.label}: ${criterion.description} ${likelyWhollyObtained ? "Raw agricultural, fishery and mineral products typically qualify this way." : "Manufactured goods that use imported materials typically qualify this way."}`
      : "",
    producerDeclaration: agreement?.certificationLanguage ?? "",
    warnings,
    suggestions,
    requiredDocuments: agreement?.requiredDocuments ?? [],
    tradeAgreementNotes: agreement?.notes ?? [],
    eligibilityAssessment: warnings.some(w => w.includes("not a"))
      ? "The country pair does not appear to be covered by this agreement, so preference is unlikely."
      : `Likely eligible under ${agreement?.shortName ?? input.tradeAgreement} if the goods meet ${criterion ? `criterion ${criterion.value}` : "the rules of origin"}. Confirm against the product-specific rule.`,
  };
}

// ============================================================================
// PURCHASE ORDER PARSING
// ============================================================================

const INCOTERMS = /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/;
const CURRENCY_CODES = /\b(USD|EUR|GBP|CNY|RMB|JPY|CAD|MXN|INR|KRW|AUD|CHF|HKD|SGD|TWD|VND|BRL)\b/;
const HTS_IN_TEXT = /\b(\d{4}\.\d{2}(?:\.\d{2,4}(?:\.\d{2})?)?)\b/;
const MONEY = /[$€£¥]?\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|[$€£¥]?\s?\d+(?:\.\d{2})/g;

function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; // US order (MM/DD)
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

const cleanMoney = (s?: string) => s?.replace(/[^\d.]/g, "") || undefined;

/** Value after "Label:" on the same line, or the following line(s) when blank. */
function labelled(lines: string[], label: RegExp, take = 1): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (!m) continue;
    const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:#.-]+/, "").trim();
    if (rest) return rest;
    const next = lines.slice(i + 1, i + 1 + take).map(l => l.trim()).filter(Boolean);
    if (next.length) return next.join(", ");
  }
  return undefined;
}

function partyBlock(lines: string[], label: RegExp) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label);
    if (!m) continue;
    const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:]+/, "").trim();
    const following: string[] = [];
    for (const l of lines.slice(i + 1, i + 5)) {
      const t = l.trim();
      if (!t || /:\s*$/.test(t) || /^(ship|bill|buyer|seller|vendor|supplier|sold|item|line|qty|description)\b/i.test(t)) break;
      following.push(t);
    }
    const name = rest || following.shift();
    return { name, address: following.join(", ") || undefined };
  }
  return { name: undefined, address: undefined };
}

/** Parse a line item row: "<n> <description> [HTS] <qty> [unit] <unit price> <total>". */
function parseItemLine(line: string, lineNumber: number): ParsedPO["lineItems"][number] | null {
  const amounts = Array.from(line.matchAll(MONEY)).map(m => m[0]);
  if (amounts.length < 2) return null;
  const hts = line.match(HTS_IN_TEXT)?.[1];
  const qtyMatch = line.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(pcs|pc|units?|ea|each|sets?|pairs?|prs|dozen|doz|kg|kgs|lbs?|m|meters?|cartons?|ctns?|boxes)\b/i)
    // "10,000 plush bears @ 2.10": a large leading number is a quantity, not a line number
    ?? line.match(/^\s*(\d{1,3}(?:,\d{3})+|\d{3,})()\s+(?=[A-Za-z])/);
  const total = amounts[amounts.length - 1];
  const unitPrice = amounts[amounts.length - 2];
  const origin = line.match(/\b(?:origin|coo|made in)\s*[:\-]?\s*([A-Za-z]{2,}(?: [A-Za-z]+)?)/i)?.[1];

  let description = line
    .replace(/^\s*\d{1,3}[.)]?\s+/, "")
    .replace(HTS_IN_TEXT, "")
    .replace(/\bHTS(?:US)?\b\s*:?/i, "")
    .replace(/\b(?:origin|coo|made in)\s*[:\-]?\s*[A-Za-z]{2,}(?: [A-Za-z]+)?/i, "");
  for (const a of [total, unitPrice]) description = description.replace(a, "");
  if (qtyMatch) description = description.replace(qtyMatch[0], "");
  description = description
    .replace(CURRENCY_CODES, "")
    .replace(/[@=]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s|,;-]+$/, "")
    .trim();
  if (!description || /^(sub)?total|^tax|^shipping|^freight/i.test(description)) return null;

  return {
    lineNumber,
    description,
    quantity: qtyMatch?.[1].replace(/,/g, ""),
    unit: qtyMatch?.[2] || undefined,
    unitPrice: cleanMoney(unitPrice),
    totalPrice: cleanMoney(total),
    htsCode: hts,
    countryOfOrigin: origin ? resolveCountry(origin) : undefined,
  };
}

/** Parse CSV text whose header names the columns. */
function parseCsvItems(text: string): ParsedPO["lineItems"] {
  const rows = text.trim().split(/\r?\n/).map(r => r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, "").trim()));
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex(h => re.test(h));
  const c = {
    desc: col(/desc|item|product/),
    qty: col(/qty|quantity/),
    unit: col(/^unit$|uom|unit of/),
    price: col(/unit ?price|price/),
    total: col(/total|amount|extended/),
    hts: col(/hts|hs ?code|tariff/),
    origin: col(/origin|coo/),
  };
  if (c.desc < 0) return [];
  return rows.slice(1).filter(r => r[c.desc]).map((r, i) => ({
    lineNumber: i + 1,
    description: r[c.desc],
    quantity: c.qty >= 0 ? r[c.qty] : undefined,
    unit: c.unit >= 0 ? r[c.unit] : undefined,
    unitPrice: c.price >= 0 ? cleanMoney(r[c.price]) : undefined,
    totalPrice: c.total >= 0 ? cleanMoney(r[c.total]) : undefined,
    htsCode: c.hts >= 0 ? r[c.hts] || undefined : undefined,
    countryOfOrigin: c.origin >= 0 && r[c.origin] ? resolveCountry(r[c.origin]) : undefined,
  }));
}

/** Extract purchase-order fields from plain text (PDF text layer or CSV). */
export function parsePurchaseOrder(text: string, isCsv = false): ParsedPO {
  if (isCsv) {
    const lineItems = parseCsvItems(text);
    const total = lineItems.reduce((sum, li) => sum + (parseFloat(li.totalPrice || "") || 0), 0);
    return { lineItems, totalValue: total ? total.toFixed(2) : undefined };
  }

  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  // A PO number must contain a digit ("PURCHASE ORDER\nOrder ref..." is not one)
  const poNumber = Array.from(text.matchAll(/(?:P\.?\s?O\.?|Purchase\s+Order|Order)[ \t]*(?:No\.?|Number|Num|Ref\.?|#)?[ \t]*[:#]?[ \t]*([A-Z0-9][A-Z0-9\-/]{2,})/gi))
    .map(m => m[1])
    .find(v => /\d/.test(v));
  const poDate = toIsoDate(labelled(lines, /\b(?:PO\s+|Order\s+|Issue\s+)?Date\b(?!\s*(?:of\s+)?(?:delivery|ship))/i)?.split(/\s{2,}| (?=[A-Z][a-z]+:)/)[0]);
  const deliveryDate = toIsoDate(labelled(lines, /\b(?:Delivery|Ship(?:ment)?|Required|Due)\s+Date\b/i));
  const incoterms = text.match(INCOTERMS)?.[1];
  const currency = text.match(CURRENCY_CODES)?.[1]?.replace("RMB", "CNY")
    ?? (/€/.test(text) ? "EUR" : /£/.test(text) ? "GBP" : /\$/.test(text) ? "USD" : undefined);
  const paymentTerms = labelled(lines, /\bPayment\s+Terms?\b|\bTerms\s*:/i) ?? text.match(/\b(Net\s?\d{1,3}|T\/T[^\n]*|L\/C[^\n]*)/i)?.[1];

  let totalValue: string | undefined;
  for (const l of lines) {
    if (/\b(grand\s+total|total\s+amount|order\s+total|total\s+value|^total)\b/i.test(l)) {
      const amounts = Array.from(l.matchAll(MONEY)).map(m => m[0]);
      if (amounts.length) totalValue = cleanMoney(amounts[amounts.length - 1]);
    }
  }

  const buyer = partyBlock(lines, /\b(?:Buyer|Bill\s+To|Sold\s+To|Purchaser)\b\s*:?/i);
  const seller = partyBlock(lines, /\b(?:Seller|Vendor|Supplier)\b\s*:?/i);
  const shipTo = partyBlock(lines, /\bShip\s+To\b\s*:?/i);

  const lineItems: ParsedPO["lineItems"] = [];
  for (const l of lines) {
    if (/\b(sub)?total\b|\btax\b/i.test(l)) continue;
    const item = parseItemLine(l, lineItems.length + 1);
    if (item) lineItems.push(item);
  }

  return {
    poNumber,
    poDate,
    buyerName: buyer.name,
    buyerAddress: buyer.address,
    sellerName: seller.name,
    sellerAddress: seller.address,
    shipToName: shipTo.name,
    shipToAddress: shipTo.address,
    incoterms,
    currency,
    paymentTerms,
    deliveryDate,
    totalValue,
    lineItems,
  };
}

/** Short names of preferential agreements covering an origin → destination pair. */
export function agreementsFor(origin: string, destination: string): string[] {
  return getApplicableAgreements(resolveCountry(origin), resolveCountry(destination))
    .filter(a => a.id !== "GENERIC")
    .map(a => a.shortName);
}
