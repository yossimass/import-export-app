import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navigation from "@/components/Navigation";
import {
  FileText, Download, CheckCircle, AlertTriangle, Info,
  Loader2, Save, Printer, Shield, Sparkles, ChevronRight,
  BookOpen, RefreshCw, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, type Country } from "@/lib/countries";
import { TRADE_AGREEMENTS, type TradeAgreement, type TradeAgreementField } from "../../../shared/tradeAgreements";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CertFormData {
  tradeAgreement: string;
  exporterName: string;
  exporterAddress: string;
  exporterCountry: string;
  exporterSignatory: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCountry: string;
  htsCode: string;
  goodsDescription: string;
  quantity: string;
  quantityUnit: string;
  grossWeight: string;
  netWeight: string;
  marksNumbers: string;
  invoiceNumber: string;
  countryOfOrigin: string;
  originCriterion: string;
  producerDeclaration: string;
  departureDate: string;
  vessel: string;
  portOfLoading: string;
  portOfDischarge: string;
  destinationCountry: string;
  chamberName: string;
  issueDate: string;
  issuePlace: string;
  agreementFields: Record<string, string>;
}

const EMPTY_FORM: CertFormData = {
  tradeAgreement: "GENERIC",
  exporterName: "",
  exporterAddress: "",
  exporterCountry: "",
  exporterSignatory: "",
  consigneeName: "",
  consigneeAddress: "",
  consigneeCountry: "",
  htsCode: "",
  goodsDescription: "",
  quantity: "",
  quantityUnit: "units",
  grossWeight: "",
  netWeight: "",
  marksNumbers: "",
  invoiceNumber: "",
  countryOfOrigin: "",
  originCriterion: "",
  producerDeclaration: "",
  departureDate: "",
  vessel: "",
  portOfLoading: "",
  portOfDischarge: "",
  destinationCountry: "",
  chamberName: "",
  issueDate: new Date().toISOString().slice(0, 10),
  issuePlace: "",
  agreementFields: {},
};

// ─── Agreement selector card ──────────────────────────────────────────────────
function AgreementCard({
  agreement,
  selected,
  onClick,
}: {
  agreement: TradeAgreement;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-lg border-2 transition-all w-full ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm">{agreement.shortName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agreement.description}</p>
        </div>
        {selected && <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

// ─── Dynamic field renderer ───────────────────────────────────────────────────
function DynamicField({
  field,
  value,
  onChange,
}: {
  field: TradeAgreementField;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={field.key} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
        {field.helpText && (
          <span title={field.helpText} className="cursor-help">
            <HelpCircle className="w-3 h-3 text-muted-foreground" />
          </span>
        )}
      </Label>
      {field.helpText && (
        <p className="text-xs text-muted-foreground mb-1">{field.helpText}</p>
      )}
      {field.type === "textarea" && (
        <Textarea
          id={field.key}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      )}
      {field.type === "text" && (
        <Input
          id={field.key}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.type === "date" && (
        <Input
          id={field.key}
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {field.type === "select" && field.options && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value || "__none__"}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.type === "checkbox" && (
        <div className="flex items-center gap-2 mt-1">
          <Checkbox
            id={field.key}
            checked={value === "true"}
            onCheckedChange={checked => onChange(checked ? "true" : "false")}
          />
          <label htmlFor={field.key} className="text-sm cursor-pointer">
            {field.placeholder || "Yes"}
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CertificateOfOrigin() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<CertFormData>(EMPTY_FORM);
  const [generatedCert, setGeneratedCert] = useState<{
    certificateId: number;
    certificateNumber: string;
    validationResult: any;
    agreement: any;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<"form" | "preview">("form");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Read URL params (from shipment workflow or PO import)
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const shipmentId = params.get("shipmentId") ? Number(params.get("shipmentId")) : undefined;
  // Direct URL param pre-fills (from MyShipments "Generate COO" button)
  const urlExporterCountry = params.get("exporterCountry") || "";
  const urlDestinationCountry = params.get("destinationCountry") || "";
  const urlHtsCode = params.get("htsCode") || "";
  const urlGoodsDescription = params.get("goodsDescription") ? decodeURIComponent(params.get("goodsDescription")!) : "";  

  // Get selected agreement definition
  const selectedAgreement = useMemo(
    () => TRADE_AGREEMENTS.find(a => a.id === form.tradeAgreement) || TRADE_AGREEMENTS.find(a => a.id === "GENERIC")!,
    [form.tradeAgreement]
  );

  // Auto-detect applicable agreements when countries change
  const { data: applicableAgreements } = trpc.certificate.getApplicableAgreements.useQuery(
    { exporterCountry: form.exporterCountry, destinationCountry: form.destinationCountry },
    { enabled: !!(form.exporterCountry && form.destinationCountry) }
  );

  // Auto-fill from shipment
  const { data: shipment } = trpc.shipments.get.useQuery(
    { shipmentId: shipmentId! },
    { enabled: !!shipmentId }
  );

  // Apply URL params on mount (before shipment loads)
  useEffect(() => {
    if (urlExporterCountry || urlDestinationCountry || urlHtsCode || urlGoodsDescription) {
      setForm(prev => ({
        ...prev,
        exporterCountry: urlExporterCountry || prev.exporterCountry,
        countryOfOrigin: urlExporterCountry || prev.countryOfOrigin,
        destinationCountry: urlDestinationCountry || prev.destinationCountry,
        htsCode: urlHtsCode || prev.htsCode,
        goodsDescription: urlGoodsDescription || prev.goodsDescription,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply shipment data when loaded (overrides URL params with richer data)
  useEffect(() => {
    if (shipment) {
      setForm(prev => ({
        ...prev,
        htsCode: shipment.htsCode || prev.htsCode,
        countryOfOrigin: shipment.originCountry || prev.countryOfOrigin,
        exporterCountry: shipment.originCountry || prev.exporterCountry,
        destinationCountry: shipment.destinationCountry || prev.destinationCountry,
        goodsDescription: shipment.productDescription || prev.goodsDescription,
        // Pre-fill exporter from PO seller data if available
        exporterName: (shipment as any).poData?.sellerName || prev.exporterName,
        exporterAddress: (shipment as any).poData?.sellerAddress || prev.exporterAddress,
        consigneeName: (shipment as any).poData?.buyerName || (shipment as any).poData?.shipToName || prev.consigneeName,
        consigneeAddress: (shipment as any).poData?.buyerAddress || (shipment as any).poData?.shipToAddress || prev.consigneeAddress,
        invoiceNumber: (shipment as any).poData?.poNumber ? `PO-${(shipment as any).poData.poNumber}` : prev.invoiceNumber,
      }));
    }
  }, [shipment]);

  // When agreement changes, reset origin criterion
  useEffect(() => {
    setForm(prev => ({ ...prev, originCriterion: "", agreementFields: {} }));
  }, [form.tradeAgreement]);

  const updateCooStatusMutation = trpc.shipments.updateCooStatus.useMutation();

  const generateMutation = trpc.certificate.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedCert(data);
      setActiveSection("preview");
      toast.success(`Certificate ${data.certificateNumber} generated`);
      // Update shipment COO status to 'draft'
      if (shipmentId) {
        updateCooStatusMutation.mutate({
          shipmentId,
          cooStatus: "draft",
          cooId: data.certificateId,
        });
      }
    },
    onError: (err) => toast.error(`Failed to generate: ${err.message}`),
  });
  const issueMutation = trpc.certificate.issue.useMutation({
    onSuccess: () => {
      toast.success("Certificate issued");
      // Update shipment COO status to 'issued'
      if (shipmentId && generatedCert) {
        updateCooStatusMutation.mutate({
          shipmentId,
          cooStatus: "issued",
          cooId: generatedCert.certificateId,
        });
      }
    },
  });;

  const aiAssistMutation = trpc.certificate.aiAssist.useMutation({
    onSuccess: (data) => {
      setAiResult(data);
      // Auto-apply recommended criterion
      if (data.recommendedCriterion) {
        setForm(prev => ({ ...prev, originCriterion: data.recommendedCriterion }));
      }
      // Auto-apply producer declaration
      if (data.producerDeclaration) {
        setForm(prev => ({ ...prev, producerDeclaration: data.producerDeclaration }));
      }
      toast.success("AI analysis complete — fields updated");
    },
    onError: (err) => toast.error(`AI assist failed: ${err.message}`),
  });

  const handleGenerate = () => {
    if (!form.exporterName || !form.consigneeName || !form.goodsDescription || !form.countryOfOrigin) {
      toast.error("Please fill in: Exporter, Consignee, Goods Description, and Country of Origin");
      return;
    }
    generateMutation.mutate({
      ...form,
      shipmentId,
      agreementFields: form.agreementFields,
    });
  };

  const handleAiAssist = () => {
    aiAssistMutation.mutate({
      tradeAgreement: form.tradeAgreement,
      exporterCountry: form.exporterCountry,
      destinationCountry: form.destinationCountry,
      goodsDescription: form.goodsDescription,
      htsCode: form.htsCode,
      userQuery: aiQuery || undefined,
    });
  };

  const update = (field: keyof CertFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateAgreementField = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      agreementFields: { ...prev.agreementFields, [key]: value },
    }));
  };

  const getCountryName = (code: string) =>
    COUNTRIES.find((c: Country) => c.code === code)?.name || code;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-20 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">Please log in to generate Certificates of Origin.</p>
          <Button asChild><a href={getLoginUrl()}>Log In</a></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileText className="w-8 h-8 text-primary" />
              <h1 className="text-3xl sm:text-4xl font-bold">Certificate of Origin</h1>
            </div>
            <p className="text-muted-foreground">
              Generate trade-agreement-specific COOs with AI-powered compliance validation
            </p>
          </div>
          {generatedCert && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={() => generatePDF(form, generatedCert.certificateNumber, selectedAgreement)} className="gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          )}
        </div>

        {/* Context banner: shown when launched from a shipment */}
        {(shipmentId || urlExporterCountry || urlHtsCode) && (
          <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="text-sm text-blue-800 flex-1">
              {shipmentId ? (
                <span>
                  <strong>Linked to Shipment #{shipmentId}</strong>
                  {shipment?.shipmentName ? ` — ${shipment.shipmentName}` : ""}
                  {(shipment as any)?.poData?.poNumber ? ` (PO #${(shipment as any).poData.poNumber})` : ""}
                  . Fields have been pre-filled from your shipment data.
                </span>
              ) : (
                <span>Fields pre-filled from shipment data. Review and adjust as needed.</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 shrink-0"
              onClick={() => window.history.back()}
            >
              ← Back to Shipment
            </Button>
          </div>
        )}

        {/* Tab switcher */}
        {generatedCert && (
          <div className="flex gap-2 mb-6 border-b border-border">
            {(["form", "preview"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSection(tab)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeSection === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "form" ? "Edit Form" : "Certificate Preview"}
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">

          {/* ── LEFT: Form ─────────────────────────────────────────────────── */}
          <div className={`lg:col-span-2 space-y-6 ${activeSection === "preview" && generatedCert ? "hidden lg:block" : ""}`}>

            {/* STEP 0: Trade Agreement Selector */}
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Trade Agreement / Certificate Format
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select the applicable trade agreement. The form will adapt to show the required fields for that format.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TRADE_AGREEMENTS.map(agreement => (
                    <AgreementCard
                      key={agreement.id}
                      agreement={agreement}
                      selected={form.tradeAgreement === agreement.id}
                      onClick={() => update("tradeAgreement", agreement.id)}
                    />
                  ))}
                </div>

                {/* Auto-detected agreements hint */}
                {applicableAgreements && applicableAgreements.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <strong>Detected applicable agreements</strong> for {getCountryName(form.exporterCountry)} → {getCountryName(form.destinationCountry)}:{" "}
                      {applicableAgreements.map(a => (
                        <button
                          key={a.id}
                          onClick={() => update("tradeAgreement", a.id)}
                          className="underline font-medium mx-1 hover:text-blue-600"
                        >
                          {a.shortName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected agreement info */}
                {selectedAgreement && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold">{selectedAgreement.name}</p>
                    {selectedAgreement.officialFormName && (
                      <p className="text-xs text-muted-foreground">Official form: {selectedAgreement.officialFormName}</p>
                    )}
                    {selectedAgreement.notes.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {selectedAgreement.notes.slice(0, 2).map((note, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1">
                            <span className="text-primary mt-0.5">•</span> {note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Assist Panel */}
            <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI Compliance Assistant
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className="text-purple-700 hover:bg-purple-100"
                  >
                    {showAiPanel ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get AI guidance on origin criteria, eligibility, and required documentation for {selectedAgreement?.shortName}.
                </p>
              </CardHeader>
              {showAiPanel && (
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="aiQuery">Ask a specific question (optional)</Label>
                    <Textarea
                      id="aiQuery"
                      value={aiQuery}
                      onChange={e => setAiQuery(e.target.value)}
                      placeholder={`e.g., "Do my cotton t-shirts qualify for USMCA preferential treatment if assembled in Mexico from US yarn?" or leave blank for general guidance.`}
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleAiAssist}
                    disabled={aiAssistMutation.isPending}
                    className="w-full gap-2 bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    {aiAssistMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Analyze & Suggest Fields</>
                    )}
                  </Button>

                  {aiResult && (
                    <div className="space-y-3 text-sm">
                      {aiResult.eligibilityAssessment && (
                        <div className="p-3 bg-white rounded border border-purple-200">
                          <p className="font-semibold text-purple-800 mb-1">Eligibility Assessment</p>
                          <p className="text-gray-700">{aiResult.eligibilityAssessment}</p>
                        </div>
                      )}
                      {aiResult.criterionExplanation && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                          <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Recommended Criterion: <Badge className="ml-1">{aiResult.recommendedCriterion}</Badge>
                          </p>
                          <p className="text-blue-700">{aiResult.criterionExplanation}</p>
                        </div>
                      )}
                      {aiResult.warnings?.length > 0 && (
                        <div className="space-y-1">
                          {aiResult.warnings.map((w: string, i: number) => (
                            <div key={i} className="flex gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                              <p className="text-yellow-800">{w}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {aiResult.suggestions?.length > 0 && (
                        <div className="space-y-1">
                          {aiResult.suggestions.map((s: string, i: number) => (
                            <div key={i} className="flex gap-2 p-2 bg-green-50 rounded border border-green-200">
                              <ChevronRight className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                              <p className="text-green-800">{s}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {aiResult.requiredDocuments?.length > 0 && (
                        <div className="p-3 bg-gray-50 rounded border">
                          <p className="font-semibold mb-1">Required Documents</p>
                          <ul className="space-y-1">
                            {aiResult.requiredDocuments.map((d: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-1">
                                <span className="text-primary">•</span> {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiResult.producerDeclaration && (
                        <div className="p-3 bg-gray-50 rounded border">
                          <p className="font-semibold mb-1 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Auto-filled Producer Declaration
                          </p>
                          <p className="text-xs text-muted-foreground italic">{aiResult.producerDeclaration}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* STEP 1: Exporter */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">1</span>
                  Exporter / Seller
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="exporterName">Company Name <span className="text-red-500">*</span></Label>
                  <Input id="exporterName" value={form.exporterName} onChange={e => update("exporterName", e.target.value)} placeholder="Acme Corp International" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="exporterAddress">Address</Label>
                  <Textarea id="exporterAddress" value={form.exporterAddress} onChange={e => update("exporterAddress", e.target.value)} placeholder="123 Trade Street, City, State, ZIP" rows={2} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Select value={form.exporterCountry} onValueChange={v => update("exporterCountry", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c: Country) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exporterSignatory">Authorized Signatory</Label>
                  <Input id="exporterSignatory" value={form.exporterSignatory} onChange={e => update("exporterSignatory", e.target.value)} placeholder="John Smith, Director" />
                </div>
              </CardContent>
            </Card>

            {/* STEP 2: Consignee */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">2</span>
                  Consignee / Buyer
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="consigneeName">Company Name <span className="text-red-500">*</span></Label>
                  <Input id="consigneeName" value={form.consigneeName} onChange={e => update("consigneeName", e.target.value)} placeholder="Global Imports Ltd" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="consigneeAddress">Address</Label>
                  <Textarea id="consigneeAddress" value={form.consigneeAddress} onChange={e => update("consigneeAddress", e.target.value)} placeholder="456 Import Ave, City, Country" rows={2} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Select value={form.consigneeCountry} onValueChange={v => update("consigneeCountry", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c: Country) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* STEP 3: Goods */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">3</span>
                  Description of Goods
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="goodsDescription">Description <span className="text-red-500">*</span></Label>
                  <Textarea id="goodsDescription" value={form.goodsDescription} onChange={e => update("goodsDescription", e.target.value)} placeholder="Men's cotton t-shirts, 100% cotton, various colors, sizes S-XL" rows={3} />
                </div>
                <div>
                  <Label htmlFor="htsCode">HTS / HS Code</Label>
                  <Input id="htsCode" value={form.htsCode} onChange={e => update("htsCode", e.target.value)} placeholder="6109.10.0012" />
                </div>
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input id="invoiceNumber" value={form.invoiceNumber} onChange={e => update("invoiceNumber", e.target.value)} placeholder="INV-2026-001" />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" value={form.quantity} onChange={e => update("quantity", e.target.value)} placeholder="500" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={form.quantityUnit} onValueChange={v => update("quantityUnit", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["units", "pieces", "kg", "lbs", "MT", "CBM", "cartons", "pallets", "rolls", "meters"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grossWeight">Gross Weight (kg)</Label>
                  <Input id="grossWeight" value={form.grossWeight} onChange={e => update("grossWeight", e.target.value)} placeholder="250.00" />
                </div>
                <div>
                  <Label htmlFor="netWeight">Net Weight (kg)</Label>
                  <Input id="netWeight" value={form.netWeight} onChange={e => update("netWeight", e.target.value)} placeholder="230.00" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="marksNumbers">Marks & Numbers</Label>
                  <Input id="marksNumbers" value={form.marksNumbers} onChange={e => update("marksNumbers", e.target.value)} placeholder="ACME / BOX 1-10 / MADE IN USA" />
                </div>
              </CardContent>
            </Card>

            {/* STEP 4: Origin Declaration */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">4</span>
                  Origin Declaration
                  <Badge variant="outline" className="text-xs">{selectedAgreement?.shortName}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Country of Origin <span className="text-red-500">*</span></Label>
                  <Select value={form.countryOfOrigin} onValueChange={v => update("countryOfOrigin", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c: Country) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Origin Criterion</Label>
                  <Select value={form.originCriterion} onValueChange={v => update("originCriterion", v)}>
                    <SelectTrigger><SelectValue placeholder="Select criterion" /></SelectTrigger>
                    <SelectContent>
                      {selectedAgreement?.originCriteria.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.originCriterion && selectedAgreement && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAgreement.originCriteria.find(c => c.value === form.originCriterion)?.description}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="producerDeclaration">Producer Declaration</Label>
                  <Textarea
                    id="producerDeclaration"
                    value={form.producerDeclaration || selectedAgreement?.certificationLanguage || ""}
                    onChange={e => update("producerDeclaration", e.target.value)}
                    placeholder={selectedAgreement?.certificationLanguage}
                    rows={3}
                  />
                  {selectedAgreement?.certificationLanguage && !form.producerDeclaration && (
                    <button
                      type="button"
                      onClick={() => update("producerDeclaration", selectedAgreement.certificationLanguage)}
                      className="text-xs text-primary underline mt-1"
                    >
                      Use official {selectedAgreement.shortName} certification language
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* STEP 5: Agreement-specific fields */}
            {selectedAgreement && selectedAgreement.additionalFields.length > 0 && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">5</span>
                    {selectedAgreement.shortName} — Specific Fields
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    These fields are required or recommended for {selectedAgreement.name} certificates.
                  </p>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  {selectedAgreement.additionalFields.map(field => (
                    <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                      <DynamicField
                        field={field}
                        value={form.agreementFields[field.key] || ""}
                        onChange={val => updateAgreementField(field.key, val)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* STEP 6: Transport */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">6</span>
                  Transport Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="departureDate">Departure Date</Label>
                  <Input id="departureDate" type="date" value={form.departureDate} onChange={e => update("departureDate", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="vessel">Vessel / Flight / Vehicle</Label>
                  <Input id="vessel" value={form.vessel} onChange={e => update("vessel", e.target.value)} placeholder="MSC OSCAR / AA 100" />
                </div>
                <div>
                  <Label htmlFor="portOfLoading">Port of Loading</Label>
                  <Input id="portOfLoading" value={form.portOfLoading} onChange={e => update("portOfLoading", e.target.value)} placeholder="Los Angeles, CA" />
                </div>
                <div>
                  <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                  <Input id="portOfDischarge" value={form.portOfDischarge} onChange={e => update("portOfDischarge", e.target.value)} placeholder="Hamburg, Germany" />
                </div>
                <div>
                  <Label>Destination Country</Label>
                  <Select value={form.destinationCountry} onValueChange={v => update("destinationCountry", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map((c: Country) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* STEP 7: Certifying Body */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">7</span>
                  Certifying Body
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="chamberName">Chamber of Commerce / Certifying Authority</Label>
                  <Input id="chamberName" value={form.chamberName} onChange={e => update("chamberName", e.target.value)} placeholder="Los Angeles Area Chamber of Commerce" />
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input id="issueDate" type="date" value={form.issueDate} onChange={e => update("issueDate", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="issuePlace">Place of Issue</Label>
                  <Input id="issuePlace" value={form.issuePlace} onChange={e => update("issuePlace", e.target.value)} placeholder="Los Angeles, CA, USA" />
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              size="lg"
              className="w-full text-base gap-2"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Validating & Generating Certificate…</>
              ) : (
                <><FileText className="w-5 h-5" /> Generate {selectedAgreement?.shortName} Certificate of Origin</>
              )}
            </Button>
          </div>

          {/* ── RIGHT: Validation + Preview ────────────────────────────────── */}
          <div className={`space-y-6 ${activeSection === "form" && generatedCert ? "hidden lg:block" : ""}`}>

            {/* Validation Results */}
            {generatedCert && (
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {generatedCert.validationResult?.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    )}
                    Compliance Validation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={generatedCert.validationResult?.isValid ? "default" : "destructive"}>
                      {generatedCert.validationResult?.isValid ? "Valid" : "Issues Found"}
                    </Badge>
                    {generatedCert.validationResult?.complianceScore !== undefined && (
                      <Badge variant="outline">Score: {generatedCert.validationResult.complianceScore}%</Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">{generatedCert.certificateNumber}</span>
                  </div>

                  {generatedCert.validationResult?.originCriterionExplanation && (
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="flex gap-2">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-blue-800">{generatedCert.validationResult.originCriterionExplanation}</p>
                      </div>
                    </div>
                  )}

                  {generatedCert.validationResult?.missingFields?.length > 0 && (
                    <div className="p-3 bg-red-50 rounded border border-red-200">
                      <p className="font-semibold text-red-700 mb-1">Missing Required Fields</p>
                      {generatedCert.validationResult.missingFields.map((f: string, i: number) => (
                        <p key={i} className="text-xs text-red-600">• {f}</p>
                      ))}
                    </div>
                  )}

                  {generatedCert.validationResult?.warnings?.length > 0 && (
                    <div className="space-y-1">
                      {generatedCert.validationResult.warnings.map((w: string, i: number) => (
                        <div key={i} className="flex gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                          <p className="text-yellow-800">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {generatedCert.validationResult?.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      {generatedCert.validationResult.suggestions.map((s: string, i: number) => (
                        <div key={i} className="flex gap-2 p-2 bg-green-50 rounded border border-green-200">
                          <ChevronRight className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <p className="text-green-800">{s}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agreement notes */}
                  {generatedCert.agreement?.notes?.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded border">
                      <p className="font-semibold mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {generatedCert.agreement.shortName} Notes
                      </p>
                      {generatedCert.agreement.notes.map((n: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground flex gap-1 mt-1">
                          <span className="text-primary">•</span> {n}
                        </p>
                      ))}
                    </div>
                  )}

                  <Separator />
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => issueMutation.mutate({ certificateId: generatedCert.certificateId })}
                    disabled={issueMutation.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {issueMutation.isPending ? "Issuing…" : "Issue Certificate"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Certificate Preview */}
            {generatedCert && (
              <CertificatePreview
                form={form}
                certNumber={generatedCert.certificateNumber}
                agreement={selectedAgreement}
                getCountryName={getCountryName}
              />
            )}

            {/* Help card */}
            {!generatedCert && (
              <Card className="border-2 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">How it works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p><strong>1. Select a trade agreement</strong> — the form adapts to show the exact fields required for that format (USMCA, CAFTA-DR, EU GSP, etc.).</p>
                  <p><strong>2. Use AI Assist</strong> — describe your goods and get AI-powered guidance on origin criteria, eligibility, and required documents.</p>
                  <p><strong>3. Fill the form</strong> — required fields are marked with <span className="text-red-500 font-bold">*</span>.</p>
                  <p><strong>4. Generate & Download</strong> — get a validated certificate with compliance score and PDF export.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile preview */}
        {generatedCert && activeSection === "preview" && (
          <div className="lg:hidden mt-6">
            <CertificatePreview
              form={form}
              certNumber={generatedCert.certificateNumber}
              agreement={selectedAgreement}
              getCountryName={getCountryName}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Certificate Preview ──────────────────────────────────────────────────────
function CertificatePreview({
  form,
  certNumber,
  agreement,
  getCountryName,
}: {
  form: CertFormData;
  certNumber: string;
  agreement: TradeAgreement;
  getCountryName: (code: string) => string;
}) {
  return (
    <Card className="border-2 print:border-0 print:shadow-none" id="certificate-preview">
      <CardContent className="p-6 font-serif text-sm">
        {/* Header */}
        <div className="text-center mb-4 border-b-2 border-black pb-4">
          <h2 className="text-lg font-bold uppercase tracking-widest">Certificate of Origin</h2>
          <p className="text-xs font-semibold text-muted-foreground">{agreement.name}</p>
          {agreement.officialFormName && (
            <p className="text-xs text-muted-foreground">{agreement.officialFormName}</p>
          )}
          <p className="text-xs font-mono mt-1">{certNumber}</p>
        </div>

        {/* Exporter & Consignee */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="border border-black p-2">
            <p className="text-xs font-bold uppercase mb-1">1. Exporter</p>
            <p className="font-semibold text-xs">{form.exporterName || "—"}</p>
            {form.exporterAddress && <p className="text-xs text-muted-foreground whitespace-pre-line">{form.exporterAddress}</p>}
            {form.exporterCountry && <p className="text-xs font-medium">{getCountryName(form.exporterCountry)}</p>}
          </div>
          <div className="border border-black p-2">
            <p className="text-xs font-bold uppercase mb-1">2. Consignee</p>
            <p className="font-semibold text-xs">{form.consigneeName || "—"}</p>
            {form.consigneeAddress && <p className="text-xs text-muted-foreground whitespace-pre-line">{form.consigneeAddress}</p>}
            {form.consigneeCountry && <p className="text-xs font-medium">{getCountryName(form.consigneeCountry)}</p>}
          </div>
        </div>

        {/* Goods */}
        <div className="border border-black mb-3">
          <div className="grid grid-cols-12 border-b border-black text-xs font-bold bg-muted/50">
            <div className="col-span-5 p-1 border-r border-black">Description</div>
            <div className="col-span-2 p-1 border-r border-black">HTS Code</div>
            <div className="col-span-2 p-1 border-r border-black">Quantity</div>
            <div className="col-span-3 p-1">Weight (kg)</div>
          </div>
          <div className="grid grid-cols-12 text-xs">
            <div className="col-span-5 p-1 border-r border-black">{form.goodsDescription || "—"}</div>
            <div className="col-span-2 p-1 border-r border-black font-mono">{form.htsCode || "—"}</div>
            <div className="col-span-2 p-1 border-r border-black">{form.quantity ? `${form.quantity} ${form.quantityUnit}` : "—"}</div>
            <div className="col-span-3 p-1 text-xs">G:{form.grossWeight || "—"} N:{form.netWeight || "—"}</div>
          </div>
        </div>

        {/* Origin */}
        <div className="border border-black p-2 mb-3">
          <p className="text-xs font-bold uppercase mb-1">Origin Declaration</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Country: </span><strong>{form.countryOfOrigin ? getCountryName(form.countryOfOrigin) : "—"}</strong></div>
            <div><span className="text-muted-foreground">Criterion: </span><strong>{form.originCriterion || "—"}</strong></div>
          </div>
          {form.producerDeclaration && (
            <p className="text-xs text-muted-foreground mt-1 italic">{form.producerDeclaration}</p>
          )}
        </div>

        {/* Agreement-specific fields preview */}
        {agreement.additionalFields.length > 0 && Object.keys(form.agreementFields).length > 0 && (
          <div className="border border-black p-2 mb-3">
            <p className="text-xs font-bold uppercase mb-1">{agreement.shortName} — Specific Fields</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {agreement.additionalFields.map(field => {
                const val = form.agreementFields[field.key];
                if (!val) return null;
                return (
                  <div key={field.key}>
                    <span className="text-muted-foreground">{field.label}: </span>
                    <span>{val === "true" ? "Yes" : val === "false" ? "No" : val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certification */}
        <div className="border border-black p-2">
          <p className="text-xs font-bold uppercase mb-1">Certification</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Authority: </span>{form.chamberName || "—"}</div>
            <div><span className="text-muted-foreground">Date/Place: </span>{form.issueDate || "—"}{form.issuePlace ? `, ${form.issuePlace}` : ""}</div>
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-gray-400 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-4">Authorized Signature</p>
              <div className="border-b border-black"></div>
              <p className="text-xs mt-1">{form.exporterSignatory || "Signature"}</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-1">Official Stamp</p>
              <div className="w-16 h-12 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-300">STAMP</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PDF Generation ───────────────────────────────────────────────────────────
function generatePDF(form: CertFormData, certNumber: string, agreement: TradeAgreement) {
  import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    const bold = (size = 10) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); };
    const normal = (size = 9) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); };
    const ln = (n = 5) => { y += n; };
    const hline = () => { doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); ln(4); };

    bold(14);
    doc.text("CERTIFICATE OF ORIGIN", pageW / 2, y, { align: "center" }); ln(6);
    normal(9);
    doc.text(agreement.name, pageW / 2, y, { align: "center" }); ln(5);
    bold(9);
    doc.text(`Certificate No: ${certNumber}`, pageW / 2, y, { align: "center" }); ln(8);
    hline();

    // Exporter & Consignee
    const colW = contentW / 2 - 3;
    const col2X = margin + colW + 6;
    const sY = y;

    bold(8); doc.text("1. EXPORTER / SELLER", margin, y); ln(5);
    normal(9);
    doc.text(form.exporterName || "—", margin, y); ln(5);
    if (form.exporterAddress) {
      const lines = doc.splitTextToSize(form.exporterAddress, colW);
      doc.text(lines, margin, y); y += lines.length * 4;
    }
    if (form.exporterCountry) { doc.text(form.exporterCountry, margin, y); ln(5); }
    if (form.exporterSignatory) { doc.text(`Signatory: ${form.exporterSignatory}`, margin, y); ln(5); }
    const c1Y = y;

    y = sY;
    bold(8); doc.text("2. CONSIGNEE / BUYER", col2X, y); ln(5);
    normal(9);
    doc.text(form.consigneeName || "—", col2X, y); ln(5);
    if (form.consigneeAddress) {
      const lines = doc.splitTextToSize(form.consigneeAddress, colW);
      doc.text(lines, col2X, y); y += lines.length * 4;
    }
    if (form.consigneeCountry) { doc.text(form.consigneeCountry, col2X, y); ln(5); }

    y = Math.max(c1Y, y) + 4;
    hline();

    // Goods
    bold(8); doc.text("3. DESCRIPTION OF GOODS", margin, y); ln(5);
    const headers = ["Description", "HTS Code", "Quantity", "Weight"];
    const cw = [70, 30, 30, 30];
    let tx = margin;
    bold(8);
    headers.forEach((h, i) => { doc.text(h, tx, y); tx += cw[i]; });
    ln(5);
    doc.line(margin, y - 1, pageW - margin, y - 1);
    normal(9);
    tx = margin;
    [
      form.goodsDescription || "—",
      form.htsCode || "—",
      form.quantity ? `${form.quantity} ${form.quantityUnit}` : "—",
      `G:${form.grossWeight || "—"} N:${form.netWeight || "—"}`,
    ].forEach((cell, i) => {
      const lines = doc.splitTextToSize(cell, cw[i] - 2);
      doc.text(lines, tx, y);
      tx += cw[i];
    });
    ln(12); hline();

    // Origin
    bold(8); doc.text("4. ORIGIN DECLARATION", margin, y); ln(5);
    normal(9);
    bold(8); doc.text("Country of Origin:", margin, y);
    normal(10); doc.text(form.countryOfOrigin || "—", margin + 40, y);
    bold(8); doc.text("Criterion:", pageW / 2, y);
    normal(10); doc.text(form.originCriterion || "—", pageW / 2 + 25, y);
    ln(7);
    if (form.producerDeclaration) {
      normal(8);
      const lines = doc.splitTextToSize(form.producerDeclaration, contentW);
      doc.text(lines, margin, y); y += lines.length * 4 + 3;
    }
    hline();

    // Agreement-specific fields
    const agFields = Object.entries(form.agreementFields).filter(([, v]) => v);
    if (agFields.length > 0) {
      bold(8); doc.text(`5. ${agreement.shortName.toUpperCase()} — SPECIFIC FIELDS`, margin, y); ln(5);
      normal(8);
      agFields.forEach(([key, val]) => {
        const fieldDef = agreement.additionalFields.find(f => f.key === key);
        const label = fieldDef?.label || key;
        doc.text(`${label}: ${val === "true" ? "Yes" : val === "false" ? "No" : val}`, margin, y); ln(4);
      });
      hline();
    }

    // Certification
    bold(8); doc.text("6. CERTIFICATION", margin, y); ln(5);
    normal(9);
    doc.text(`Authority: ${form.chamberName || "—"}`, margin, y); ln(5);
    doc.text(`Date: ${form.issueDate || "—"}  Place: ${form.issuePlace || "—"}`, margin, y); ln(12);
    doc.line(margin, y, margin + 70, y); ln(4);
    normal(8); doc.text("Authorized Signature & Stamp", margin, y);

    doc.save(`${certNumber}.pdf`);
  });
}
