// Result shapes shared by the server (rules/official data) and the AI
// enhancement layer, which runs on the server or in the browser.

/** Where a piece of information came from, shown to the user as a badge. */
export type InfoSource = "official" | "rules" | "user" | "ai";

export type HtsResult = {
  code: string;
  description: string;
  dutyRate: string;
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
  alternatives: Array<{ code: string; reason?: string }>;
  confidence: number;
  source?: InfoSource;
};

export type TariffInput = {
  htsCode: string;
  originCountry: string;
  destinationCountry: string;
  value: number;
  quantity?: number;
  weight?: number;
  incoterm?: string;
  freightCost?: number;
  insuranceCost?: number;
  additionalDutyRate?: number;
  dutyRate?: number;
};

export type AdditionalDuty = { name: string; ratePercent: number; amount: number; basis: string; source: InfoSource };

export type TariffResult = {
  mfnRate: string;
  preferentialRate: string | null;
  additionalDuties: number;
  appliedRate: string;
  tradeAgreement: string;
  exclusionStatus: string;
  dutyAmount: number;
  mpf: number;
  hmf: number;
  totalDuties: number;
  landedCost: number;
  rateSource: string;
  rationale: string;
  explanation: string;
  alternatives: Array<{ scenario: string; impact: string }>;
  effectiveDate: string;
  /** Itemized additional duties (user-entered or AI-estimated) */
  additionalDutyLines?: AdditionalDuty[];
  /** Notes added by the AI layer */
  aiNotes?: string[];
  source?: InfoSource;
};

export type Regulation = {
  title: string;
  category: "import" | "export" | "licensing" | "restriction";
  description: string;
  authority: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requirements: string[];
  documentation: string[];
  source: string;
  penalties?: string;
  origin?: InfoSource;
};

export type ChecklistItem = {
  task: string;
  description: string;
  priority: "required" | "optional" | "conditional";
  category: "documentation" | "compliance" | "inspection" | "payment";
  authority?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  deadline: string;
  completed: boolean;
  origin?: InfoSource;
};

export type POLineItem = {
  lineNumber?: number;
  description: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  totalPrice?: string;
  htsCode?: string;
  countryOfOrigin?: string;
};

export type ParsedPO = {
  poNumber?: string;
  poDate?: string;
  buyerName?: string;
  buyerAddress?: string;
  sellerName?: string;
  sellerAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
  incoterms?: string;
  currency?: string;
  paymentTerms?: string;
  deliveryDate?: string;
  totalValue?: string;
  notes?: string;
  lineItems: POLineItem[];
  /** Fields the AI filled in */
  aiFields?: string[];
};

export type OriginGuidance = {
  recommendedCriterion: string;
  criterionExplanation: string;
  producerDeclaration: string;
  warnings: string[];
  suggestions: string[];
  requiredDocuments: string[];
  tradeAgreementNotes: string[];
  eligibilityAssessment: string;
  source?: InfoSource;
};

/** Official data for a validated HTS code. */
export type OfficialLine = { code: string; description: string; general: string; special: string; other: string };
