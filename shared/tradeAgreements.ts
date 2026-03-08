/**
 * Trade Agreement Certificate of Origin Definitions
 * Each agreement defines its unique fields, origin criteria, required documents,
 * and official certification language.
 */

export interface OriginCriterionOption {
  value: string;
  label: string;
  description: string;
}

export interface TradeAgreementField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
}

export interface TradeAgreement {
  id: string;
  name: string;
  shortName: string;
  description: string;
  eligibleCountries: string[]; // ISO-3 codes
  originCriteria: OriginCriterionOption[];
  additionalFields: TradeAgreementField[];
  certificationLanguage: string;
  requiredDocuments: string[];
  notes: string[];
  officialFormName?: string;
}

export const TRADE_AGREEMENTS: TradeAgreement[] = [
  {
    id: "USMCA",
    name: "United States–Mexico–Canada Agreement",
    shortName: "USMCA",
    description: "Replaces NAFTA. Covers trade between USA, Mexico, and Canada.",
    eligibleCountries: ["USA", "MEX", "CAN"],
    officialFormName: "USMCA Certificate of Origin",
    originCriteria: [
      {
        value: "A",
        label: "A – Wholly obtained or produced",
        description: "The good is wholly obtained or produced entirely in the territory of one or more of the Parties.",
      },
      {
        value: "B",
        label: "B – Tariff classification change",
        description: "The good is produced entirely in the territory of one or more of the Parties and satisfies the applicable tariff classification change.",
      },
      {
        value: "C",
        label: "C – Tariff classification change + RVC",
        description: "Satisfies both a tariff classification change and a regional value content requirement.",
      },
      {
        value: "D",
        label: "D – Regional value content only",
        description: "The good satisfies the applicable regional value content requirement.",
      },
      {
        value: "E",
        label: "E – Automatic data processing goods",
        description: "Applies to automatic data processing goods and their parts.",
      },
      {
        value: "F",
        label: "F – Agricultural goods",
        description: "Applies to agricultural goods that are wholly obtained or produced.",
      },
    ],
    additionalFields: [
      {
        key: "blanketPeriodFrom",
        label: "Blanket Period From",
        type: "date",
        required: false,
        helpText: "If this certificate covers multiple shipments, enter the start date of the blanket period (max 12 months).",
      },
      {
        key: "blanketPeriodTo",
        label: "Blanket Period To",
        type: "date",
        required: false,
        helpText: "End date of the blanket period.",
      },
      {
        key: "producerName",
        label: "Producer Name",
        type: "text",
        required: false,
        placeholder: "Same as exporter / Various / Confidential",
        helpText: "Name of the producer if different from the exporter. Enter 'Various' if multiple producers.",
      },
      {
        key: "netCostMethod",
        label: "Net Cost Method Used",
        type: "select",
        required: false,
        options: [
          { value: "", label: "Not applicable" },
          { value: "NC", label: "NC – Net Cost" },
          { value: "TV", label: "TV – Transaction Value" },
        ],
        helpText: "Method used to calculate regional value content, if applicable.",
      },
      {
        key: "rvcPercentage",
        label: "Regional Value Content (%)",
        type: "text",
        required: false,
        placeholder: "e.g., 75",
        helpText: "Percentage of regional value content, if criterion C or D applies.",
      },
      {
        key: "certifierRole",
        label: "Certifier Role",
        type: "select",
        required: true,
        options: [
          { value: "Exporter", label: "Exporter" },
          { value: "Producer", label: "Producer" },
          { value: "Importer", label: "Importer" },
        ],
        helpText: "USMCA allows the exporter, producer, or importer to certify origin.",
      },
    ],
    certificationLanguage: `I certify that the goods described in this document qualify as originating and the information contained in this document is true and accurate. I assume responsibility for proving such representations and agree to maintain and present upon request, or to make available during a verification visit, documentation necessary to support this certification.`,
    requiredDocuments: [
      "Commercial Invoice",
      "Bill of Lading or Airway Bill",
      "Packing List",
      "Production records or cost statements (if RVC applies)",
    ],
    notes: [
      "USMCA does not require a specific government-issued form — a self-certification by the exporter, producer, or importer is sufficient.",
      "The certification must include the nine minimum data elements specified in Annex 5-A.",
      "Blanket certificates may cover multiple shipments of identical goods for up to 12 months.",
      "Importers must have the certification in their possession at the time of claiming preferential tariff treatment.",
    ],
  },
  {
    id: "CAFTA-DR",
    name: "Dominican Republic–Central America FTA",
    shortName: "CAFTA-DR",
    description: "FTA between USA and Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua, Dominican Republic.",
    eligibleCountries: ["USA", "CRI", "SLV", "GTM", "HND", "NIC", "DOM"],
    officialFormName: "CAFTA-DR Certificate of Origin",
    originCriteria: [
      {
        value: "A",
        label: "A – Wholly obtained or produced",
        description: "The good is wholly obtained or produced entirely in the territory of one or more Parties.",
      },
      {
        value: "B",
        label: "B – Produced from non-originating materials",
        description: "Each non-originating material undergoes the applicable change in tariff classification set out in Annex 4.1.",
      },
      {
        value: "C",
        label: "C – RVC (35% net cost or 45% transaction value)",
        description: "The good satisfies the applicable regional value content requirement.",
      },
      {
        value: "D",
        label: "D – Specific manufacturing or processing operation",
        description: "The good satisfies a specific manufacturing or processing operation.",
      },
    ],
    additionalFields: [
      {
        key: "blanketPeriodFrom",
        label: "Blanket Period From",
        type: "date",
        required: false,
        helpText: "Start date for blanket certificate (up to 12 months).",
      },
      {
        key: "blanketPeriodTo",
        label: "Blanket Period To",
        type: "date",
        required: false,
        helpText: "End date for blanket certificate.",
      },
      {
        key: "rvcMethod",
        label: "RVC Calculation Method",
        type: "select",
        required: false,
        options: [
          { value: "", label: "Not applicable" },
          { value: "NC", label: "Net Cost (35% minimum)" },
          { value: "TV", label: "Transaction Value (45% minimum)" },
        ],
      },
      {
        key: "rvcPercentage",
        label: "Regional Value Content (%)",
        type: "text",
        required: false,
        placeholder: "e.g., 45",
      },
      {
        key: "producerName",
        label: "Producer (if different from exporter)",
        type: "text",
        required: false,
        placeholder: "Same as exporter / Various / Available on request",
      },
    ],
    certificationLanguage: `I certify that the goods described in this document qualify as originating under the terms of the Dominican Republic-Central America-United States Free Trade Agreement (CAFTA-DR) and that the information contained in this document is true and accurate.`,
    requiredDocuments: [
      "Commercial Invoice",
      "Bill of Lading",
      "Packing List",
      "Production cost records (if RVC method used)",
    ],
    notes: [
      "CAFTA-DR uses a self-certification model — no government stamp is required.",
      "The certificate must be in the possession of the importer at time of entry.",
      "Textile and apparel goods have specific rules of origin (yarn-forward rule).",
    ],
  },
  {
    id: "EU_GSP",
    name: "EU Generalised Scheme of Preferences",
    shortName: "EU GSP",
    description: "Preferential tariff treatment for developing countries exporting to the EU.",
    eligibleCountries: [
      "BGD", "BOL", "KHM", "ETH", "GHA", "GTM", "HND", "IND", "IDN", "KEN",
      "LAO", "MDV", "MMR", "NPL", "NIC", "NGA", "PAK", "PHL", "SEN", "LKA",
      "TZA", "UGA", "VNM", "ZMB",
    ],
    officialFormName: "Statement on Origin / REX Declaration",
    originCriteria: [
      {
        value: "P",
        label: "P – Wholly obtained",
        description: "Products wholly obtained in the beneficiary country (e.g., agricultural products, minerals).",
      },
      {
        value: "W",
        label: "W – Sufficiently processed/worked",
        description: "Products sufficiently processed or worked in the beneficiary country (meets the product-specific rules).",
      },
    ],
    additionalFields: [
      {
        key: "rexNumber",
        label: "REX Number (Registered Exporter)",
        type: "text",
        required: false,
        placeholder: "e.g., INREX123456789",
        helpText: "Required for shipments over €6,000. Register at your national customs authority.",
      },
      {
        key: "statementOnOrigin",
        label: "Statement on Origin Text",
        type: "textarea",
        required: true,
        placeholder: "The exporter of the products covered by this document declares that, except where otherwise clearly indicated, these products are of ... preferential origin.",
        helpText: "The official EU GSP statement on origin text. Must appear on the commercial invoice.",
      },
      {
        key: "cumulationType",
        label: "Cumulation Applied",
        type: "select",
        required: false,
        options: [
          { value: "", label: "None" },
          { value: "bilateral", label: "Bilateral cumulation (with EU materials)" },
          { value: "regional", label: "Regional cumulation (within GSP group)" },
          { value: "extended", label: "Extended cumulation" },
        ],
      },
      {
        key: "directTransport",
        label: "Direct Transport Declaration",
        type: "checkbox",
        required: false,
        helpText: "Confirm that goods were transported directly from the beneficiary country to the EU without passing through another country.",
      },
    ],
    certificationLanguage: `The exporter of the products covered by this document (Registered Exporter No. [REX NUMBER]) declares that, except where otherwise clearly indicated, these products are of [COUNTRY] preferential origin.`,
    requiredDocuments: [
      "Commercial Invoice (with Statement on Origin)",
      "Bill of Lading or Airway Bill",
      "Packing List",
      "REX registration certificate (for shipments > €6,000)",
    ],
    notes: [
      "Since 2017, the EU GSP uses the REX (Registered Exporter) system instead of Form A.",
      "For shipments under €6,000, any exporter can make the statement on origin.",
      "For shipments over €6,000, the exporter must be registered in the REX system.",
      "The statement on origin must appear on the commercial invoice or any other commercial document.",
    ],
  },
  {
    id: "AGOA",
    name: "African Growth and Opportunity Act",
    shortName: "AGOA",
    description: "US preferential trade program for eligible sub-Saharan African countries.",
    eligibleCountries: [
      "AGO", "BEN", "BWA", "BFA", "CPV", "CMR", "CAF", "TCD", "COM", "COD",
      "COG", "CIV", "DJI", "ETH", "GAB", "GMB", "GHA", "GIN", "GNB", "KEN",
      "LSO", "LBR", "MDG", "MWI", "MLI", "MRT", "MUS", "MOZ", "NAM", "NER",
      "NGA", "RWA", "STP", "SEN", "SLE", "SOM", "ZAF", "SSD", "TZA", "TGO",
      "UGA", "ZMB", "ZWE",
    ],
    officialFormName: "AGOA Certificate of Origin",
    originCriteria: [
      {
        value: "A",
        label: "A – Wholly the growth, product, or manufacture",
        description: "The article is wholly the growth, product, or manufacture of a beneficiary sub-Saharan African country.",
      },
      {
        value: "B",
        label: "B – Substantial transformation",
        description: "The article is a new or different article of commerce that has been substantially transformed in a beneficiary country.",
      },
      {
        value: "C",
        label: "C – 35% value-added rule",
        description: "At least 35% of the appraised value of the article is attributable to materials produced in one or more beneficiary countries and/or direct costs of processing.",
      },
    ],
    additionalFields: [
      {
        key: "beneficiaryCountry",
        label: "Beneficiary Sub-Saharan African Country",
        type: "text",
        required: true,
        placeholder: "e.g., Kenya",
        helpText: "The AGOA-eligible country where the goods were produced.",
      },
      {
        key: "valueAddedPercentage",
        label: "Value Added in Beneficiary Country (%)",
        type: "text",
        required: false,
        placeholder: "e.g., 40",
        helpText: "Required if using the 35% value-added criterion.",
      },
      {
        key: "substantialTransformationDescription",
        label: "Substantial Transformation Description",
        type: "textarea",
        required: false,
        placeholder: "Describe how the goods were substantially transformed in the beneficiary country...",
        helpText: "Required if using criterion B. Describe the manufacturing process.",
      },
      {
        key: "thirdCountryFabric",
        label: "Third-Country Fabric Used (Apparel)",
        type: "checkbox",
        required: false,
        helpText: "For apparel: check if third-country fabric was used under the AGOA 'third-country fabric' provision.",
      },
    ],
    certificationLanguage: `I certify that the goods described in this document qualify for preferential treatment under the African Growth and Opportunity Act (AGOA) and that the information contained in this document is true and accurate.`,
    requiredDocuments: [
      "Commercial Invoice",
      "Bill of Lading",
      "Packing List",
      "Visa (for textile and apparel goods)",
      "Production records demonstrating value-added content",
    ],
    notes: [
      "Textile and apparel goods require a visa issued by the beneficiary country's government.",
      "The 35% value-added rule may include materials from the US and other AGOA beneficiary countries.",
      "AGOA benefits are reviewed annually — verify the country's current eligibility status.",
    ],
  },
  {
    id: "US_KOREA",
    name: "US–Korea Free Trade Agreement",
    shortName: "KORUS FTA",
    description: "FTA between the United States and South Korea.",
    eligibleCountries: ["USA", "KOR"],
    officialFormName: "KORUS FTA Certificate of Origin",
    originCriteria: [
      {
        value: "A",
        label: "A – Wholly obtained or produced",
        description: "The good is wholly obtained or produced entirely in the territory of one or both Parties.",
      },
      {
        value: "B",
        label: "B – Produced from non-originating materials (tariff shift)",
        description: "Each non-originating material used in the production of the good undergoes the applicable change in tariff classification.",
      },
      {
        value: "C",
        label: "C – Regional value content",
        description: "The good satisfies the applicable regional value content requirement.",
      },
      {
        value: "D",
        label: "D – Combination of tariff shift + RVC",
        description: "The good satisfies both a tariff classification change and a regional value content requirement.",
      },
    ],
    additionalFields: [
      {
        key: "blanketPeriodFrom",
        label: "Blanket Period From",
        type: "date",
        required: false,
        helpText: "Start date for blanket certificate.",
      },
      {
        key: "blanketPeriodTo",
        label: "Blanket Period To",
        type: "date",
        required: false,
        helpText: "End date for blanket certificate (max 12 months).",
      },
      {
        key: "rvcMethod",
        label: "RVC Calculation Method",
        type: "select",
        required: false,
        options: [
          { value: "", label: "Not applicable" },
          { value: "TV", label: "Transaction Value" },
          { value: "NC", label: "Net Cost" },
        ],
      },
      {
        key: "rvcPercentage",
        label: "Regional Value Content (%)",
        type: "text",
        required: false,
        placeholder: "e.g., 55",
      },
      {
        key: "producerName",
        label: "Producer (if different from exporter)",
        type: "text",
        required: false,
        placeholder: "Same as exporter / Various / Available on request",
      },
    ],
    certificationLanguage: `I certify that the goods described in this document qualify as originating under the terms of the United States–Korea Free Trade Agreement (KORUS) and that the information contained in this document is true and accurate.`,
    requiredDocuments: [
      "Commercial Invoice",
      "Bill of Lading or Airway Bill",
      "Packing List",
      "Production cost records (if RVC applies)",
    ],
    notes: [
      "KORUS uses a self-certification model — no government-issued form is required.",
      "The certification may be made by the exporter, producer, or importer.",
      "Blanket certificates may cover multiple shipments for up to 12 months.",
    ],
  },
  {
    id: "GENERIC",
    name: "Generic / Chamber of Commerce",
    shortName: "Generic COO",
    description: "Standard certificate of origin for countries without a specific FTA format. Certified by a Chamber of Commerce.",
    eligibleCountries: [], // All countries
    officialFormName: "Certificate of Origin",
    originCriteria: [
      {
        value: "WO",
        label: "Wholly Obtained",
        description: "The goods are wholly obtained or produced in the declared country of origin.",
      },
      {
        value: "SP",
        label: "Substantially Processed",
        description: "The goods have been substantially processed or transformed in the declared country of origin.",
      },
      {
        value: "TC",
        label: "Tariff Classification Change",
        description: "The goods satisfy the applicable change in tariff classification.",
      },
      {
        value: "VA",
        label: "Value Added",
        description: "Sufficient value has been added in the declared country of origin.",
      },
    ],
    additionalFields: [
      {
        key: "chamberCertificationNumber",
        label: "Chamber Certification Number",
        type: "text",
        required: false,
        placeholder: "e.g., LA-2026-00123",
        helpText: "Reference number assigned by the certifying Chamber of Commerce.",
      },
      {
        key: "numberOfOriginals",
        label: "Number of Originals Issued",
        type: "select",
        required: false,
        options: [
          { value: "1", label: "1 Original" },
          { value: "2", label: "2 Originals" },
          { value: "3", label: "3 Originals" },
        ],
      },
    ],
    certificationLanguage: `The undersigned authority certifies that the goods described in this document originate in the country shown and that the information contained herein is true and correct to the best of its knowledge.`,
    requiredDocuments: [
      "Commercial Invoice",
      "Bill of Lading or Airway Bill",
      "Packing List",
    ],
    notes: [
      "Generic COOs are typically certified by a Chamber of Commerce or government authority.",
      "Some countries require an apostille or consular legalization.",
      "Check the importing country's specific requirements for acceptable certifying bodies.",
    ],
  },
];

export function getAgreementById(id: string): TradeAgreement | undefined {
  return TRADE_AGREEMENTS.find(a => a.id === id);
}

export function getApplicableAgreements(exporterCountry: string, destinationCountry: string): TradeAgreement[] {
  return TRADE_AGREEMENTS.filter(agreement => {
    if (agreement.id === "GENERIC") return true;
    if (agreement.eligibleCountries.length === 0) return true;
    return (
      agreement.eligibleCountries.includes(exporterCountry) &&
      agreement.eligibleCountries.includes(destinationCountry)
    );
  });
}
