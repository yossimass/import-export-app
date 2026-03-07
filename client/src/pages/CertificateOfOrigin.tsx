import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navigation from "@/components/Navigation";
import {
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2,
  Save,
  Printer,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, type Country } from "@/lib/countries";

// Origin criteria definitions
const ORIGIN_CRITERIA = [
  { value: "A", label: "A – Wholly obtained or produced in the country" },
  { value: "B", label: "B – Produced exclusively from originating materials" },
  { value: "C", label: "C – Satisfies tariff classification change rule" },
  { value: "D", label: "D – Satisfies regional value content requirement" },
  { value: "E", label: "E – Satisfies specific manufacturing process" },
  { value: "F", label: "F – Combination of C and D criteria" },
];

interface CertFormData {
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
}

const EMPTY_FORM: CertFormData = {
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
};

export default function CertificateOfOrigin() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<CertFormData>(EMPTY_FORM);
  const [generatedCert, setGeneratedCert] = useState<{
    certificateId: number;
    certificateNumber: string;
    validationResult: any;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeSection, setActiveSection] = useState<"form" | "preview">("form");

  // Read shipmentId from URL
  const params = new URLSearchParams(window.location.search);
  const shipmentId = params.get("shipmentId") ? Number(params.get("shipmentId")) : undefined;

  // Auto-fill from shipment if shipmentId is present
  const { data: shipment } = trpc.shipments.get.useQuery(
    { shipmentId: shipmentId! },
    { enabled: !!shipmentId }
  );

  useEffect(() => {
    if (shipment) {
      setForm(prev => ({
        ...prev,
        htsCode: shipment.htsCode || prev.htsCode,
        countryOfOrigin: shipment.originCountry || prev.countryOfOrigin,
        destinationCountry: shipment.destinationCountry || prev.destinationCountry,
        goodsDescription: shipment.productDescription || prev.goodsDescription,
      }));
    }
  }, [shipment]);

  const generateMutation = trpc.certificate.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedCert(data);
      setShowPreview(true);
      setActiveSection("preview");
      toast.success(`Certificate ${data.certificateNumber} generated successfully`);
    },
    onError: (err) => {
      toast.error(`Failed to generate certificate: ${err.message}`);
    },
  });

  const issueMutation = trpc.certificate.issue.useMutation({
    onSuccess: () => {
      toast.success("Certificate issued successfully");
    },
  });

  const handleGenerate = () => {
    if (!form.exporterName || !form.consigneeName || !form.goodsDescription || !form.countryOfOrigin) {
      toast.error("Please fill in all required fields: Exporter, Consignee, Goods Description, and Country of Origin");
      return;
    }
    generateMutation.mutate({ ...form, shipmentId });
  };

  const handleDownloadPDF = () => {
    if (!generatedCert) return;
    generatePDF(form, generatedCert.certificateNumber);
  };

  const handlePrint = () => {
    window.print();
  };

  const update = (field: keyof CertFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const getCountryName = (code: string) => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
  };

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
              Generate official certificates of origin with AI-powered validation
            </p>
          </div>
          {generatedCert && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={handleDownloadPDF} className="gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {showPreview && (
          <div className="flex gap-2 mb-6 border-b border-border">
            <button
              onClick={() => setActiveSection("form")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === "form"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Edit Form
            </button>
            <button
              onClick={() => setActiveSection("preview")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeSection === "preview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Certificate Preview
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className={`lg:col-span-2 space-y-6 ${activeSection === "preview" && showPreview ? "hidden lg:block" : ""}`}>

            {/* 1. Exporter */}
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

            {/* 2. Consignee */}
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

            {/* 3. Goods Description */}
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
                  <Label htmlFor="quantityUnit">Unit</Label>
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

            {/* 4. Origin Declaration */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">4</span>
                  Origin Declaration
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Country of Origin <span className="text-red-500">*</span></Label>
                  <Select value={form.countryOfOrigin} onValueChange={v => update("countryOfOrigin", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Origin Criterion</Label>
                  <Select value={form.originCriterion} onValueChange={v => update("originCriterion", v)}>
                    <SelectTrigger><SelectValue placeholder="Select criterion" /></SelectTrigger>
                    <SelectContent>
                      {ORIGIN_CRITERIA.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="producerDeclaration">Producer Declaration</Label>
                  <Textarea id="producerDeclaration" value={form.producerDeclaration} onChange={e => update("producerDeclaration", e.target.value)} placeholder="The undersigned hereby declares that the goods described above originate in the country shown..." rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* 5. Transport */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">5</span>
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

            {/* 6. Certifying Body */}
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">6</span>
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
                <><FileText className="w-5 h-5" /> Generate Certificate of Origin</>
              )}
            </Button>
          </div>

          {/* Right panel: Validation / Preview */}
          <div className={`space-y-6 ${activeSection === "form" && showPreview ? "hidden lg:block" : ""}`}>

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
                    AI Validation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={generatedCert.validationResult?.isValid ? "default" : "destructive"}>
                      {generatedCert.validationResult?.isValid ? "Valid" : "Issues Found"}
                    </Badge>
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

                  {generatedCert.validationResult?.warnings?.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-yellow-700">Warnings</p>
                      {generatedCert.validationResult.warnings.map((w: string, i: number) => (
                        <div key={i} className="flex gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                          <p className="text-yellow-800">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {generatedCert.validationResult?.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-green-700">Suggestions</p>
                      {generatedCert.validationResult.suggestions.map((s: string, i: number) => (
                        <div key={i} className="flex gap-2 p-2 bg-green-50 rounded border border-green-200">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <p className="text-green-800">{s}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {generatedCert.validationResult?.tradeAgreements?.length > 0 && (
                    <div>
                      <p className="font-semibold mb-2">Applicable Trade Agreements</p>
                      <div className="flex flex-wrap gap-1">
                        {generatedCert.validationResult.tradeAgreements.map((ta: string) => (
                          <Badge key={ta} variant="outline" className="text-xs">{ta}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />
                  <Button
                    variant="default"
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
              <CertificatePreview form={form} certNumber={generatedCert.certificateNumber} getCountryName={getCountryName} />
            )}

            {/* Help card when no cert yet */}
            {!generatedCert && (
              <Card className="border-2 bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">About Certificates of Origin</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>A Certificate of Origin (COO) is an official document declaring the country where goods were manufactured or produced.</p>
                  <p>It is required for customs clearance, determining applicable tariff rates, and verifying eligibility for preferential trade agreements (USMCA, CAFTA-DR, etc.).</p>
                  <p>Fill in all required fields marked with <span className="text-red-500 font-bold">*</span> and click <strong>Generate Certificate</strong> to create your certificate with AI validation.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Full-width certificate preview on mobile */}
        {showPreview && activeSection === "preview" && (
          <div className="lg:hidden mt-6">
            {generatedCert && (
              <CertificatePreview form={form} certNumber={generatedCert.certificateNumber} getCountryName={getCountryName} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Certificate Preview Component ────────────────────────────────────────────
function CertificatePreview({
  form,
  certNumber,
  getCountryName,
}: {
  form: CertFormData;
  certNumber: string;
  getCountryName: (code: string) => string;
}) {
  return (
    <Card className="border-2 print:border-0 print:shadow-none" id="certificate-preview">
      <CardContent className="p-6 font-serif text-sm">
        {/* Header */}
        <div className="text-center mb-4 border-b-2 border-black pb-4">
          <h2 className="text-xl font-bold uppercase tracking-widest">Certificate of Origin</h2>
          <p className="text-xs text-muted-foreground mt-1">Original – Not Negotiable</p>
          <p className="text-xs font-mono mt-1">{certNumber}</p>
        </div>

        {/* Exporter & Consignee */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-black p-3">
            <p className="text-xs font-bold uppercase mb-1">1. Exporter</p>
            <p className="font-semibold">{form.exporterName || "—"}</p>
            {form.exporterAddress && <p className="text-xs text-muted-foreground whitespace-pre-line">{form.exporterAddress}</p>}
            {form.exporterCountry && <p className="text-xs font-medium mt-1">{getCountryName(form.exporterCountry)}</p>}
          </div>
          <div className="border border-black p-3">
            <p className="text-xs font-bold uppercase mb-1">2. Consignee</p>
            <p className="font-semibold">{form.consigneeName || "—"}</p>
            {form.consigneeAddress && <p className="text-xs text-muted-foreground whitespace-pre-line">{form.consigneeAddress}</p>}
            {form.consigneeCountry && <p className="text-xs font-medium mt-1">{getCountryName(form.consigneeCountry)}</p>}
          </div>
        </div>

        {/* Transport */}
        <div className="border border-black p-3 mb-4">
          <p className="text-xs font-bold uppercase mb-2">3. Transport Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="text-muted-foreground">Departure:</span> {form.departureDate || "—"}</div>
            <div><span className="text-muted-foreground">Vessel/Flight:</span> {form.vessel || "—"}</div>
            <div><span className="text-muted-foreground">Port of Loading:</span> {form.portOfLoading || "—"}</div>
            <div><span className="text-muted-foreground">Port of Discharge:</span> {form.portOfDischarge || "—"}</div>
            {form.destinationCountry && <div className="col-span-2"><span className="text-muted-foreground">Destination:</span> {getCountryName(form.destinationCountry)}</div>}
          </div>
        </div>

        {/* Goods */}
        <div className="border border-black mb-4">
          <div className="grid grid-cols-12 border-b border-black text-xs font-bold bg-muted/50">
            <div className="col-span-1 p-2 border-r border-black">Marks</div>
            <div className="col-span-5 p-2 border-r border-black">Description of Goods</div>
            <div className="col-span-2 p-2 border-r border-black">HTS Code</div>
            <div className="col-span-2 p-2 border-r border-black">Qty</div>
            <div className="col-span-2 p-2">Weight (kg)</div>
          </div>
          <div className="grid grid-cols-12 text-xs">
            <div className="col-span-1 p-2 border-r border-black text-muted-foreground">{form.marksNumbers || "—"}</div>
            <div className="col-span-5 p-2 border-r border-black">{form.goodsDescription || "—"}</div>
            <div className="col-span-2 p-2 border-r border-black font-mono">{form.htsCode || "—"}</div>
            <div className="col-span-2 p-2 border-r border-black">{form.quantity ? `${form.quantity} ${form.quantityUnit}` : "—"}</div>
            <div className="col-span-2 p-2">
              <div>G: {form.grossWeight || "—"}</div>
              <div>N: {form.netWeight || "—"}</div>
            </div>
          </div>
        </div>

        {/* Origin */}
        <div className="border border-black p-3 mb-4">
          <p className="text-xs font-bold uppercase mb-2">4. Origin Declaration</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Country of Origin: </span>
              <span className="font-bold">{form.countryOfOrigin ? getCountryName(form.countryOfOrigin) : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Criterion: </span>
              <span className="font-bold">{form.originCriterion || "—"}</span>
            </div>
          </div>
          {form.producerDeclaration && (
            <p className="text-xs text-muted-foreground mt-2 italic">{form.producerDeclaration}</p>
          )}
        </div>

        {/* Certification */}
        <div className="border border-black p-3">
          <p className="text-xs font-bold uppercase mb-2">5. Certification</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">Certifying Authority:</p>
              <p>{form.chamberName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Issue Date & Place:</p>
              <p>{form.issueDate || "—"}{form.issuePlace ? `, ${form.issuePlace}` : ""}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed border-gray-400 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-6">Authorized Signature</p>
              <div className="border-b border-black"></div>
              <p className="text-xs mt-1">{form.exporterSignatory || "Signature"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-6">Official Stamp</p>
              <div className="w-20 h-16 border-2 border-dashed border-gray-300 rounded-full mx-auto flex items-center justify-center">
                <span className="text-xs text-gray-300">STAMP</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PDF Generation ────────────────────────────────────────────────────────────
function generatePDF(form: CertFormData, certNumber: string) {
  // Dynamic import to keep bundle size small
  import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    const line = () => { doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 4; };
    const bold = (size = 10) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); };
    const normal = (size = 9) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); };
    const addText = (text: string, x: number, indent = 0) => {
      const lines = doc.splitTextToSize(text, contentW - indent);
      doc.text(lines, x, y);
      y += lines.length * 5;
    };

    // Title
    bold(16);
    doc.text("CERTIFICATE OF ORIGIN", pageW / 2, y, { align: "center" });
    y += 6;
    normal(9);
    doc.text("Original – Not Negotiable", pageW / 2, y, { align: "center" });
    y += 5;
    bold(9);
    doc.text(`Certificate No: ${certNumber}`, pageW / 2, y, { align: "center" });
    y += 8;
    line();

    // Exporter & Consignee side by side
    const colW = contentW / 2 - 3;
    const col2X = margin + colW + 6;
    const sectionY = y;

    bold(8); doc.text("1. EXPORTER / SELLER", margin, y); y += 5;
    normal(9);
    doc.text(form.exporterName || "—", margin, y); y += 5;
    if (form.exporterAddress) { addText(form.exporterAddress, margin); }
    if (form.exporterCountry) { doc.text(form.exporterCountry, margin, y); y += 5; }
    if (form.exporterSignatory) { doc.text(`Signatory: ${form.exporterSignatory}`, margin, y); y += 5; }

    const col1EndY = y;
    y = sectionY;
    bold(8); doc.text("2. CONSIGNEE / BUYER", col2X, y); y += 5;
    normal(9);
    doc.text(form.consigneeName || "—", col2X, y); y += 5;
    if (form.consigneeAddress) {
      const lines = doc.splitTextToSize(form.consigneeAddress, colW);
      doc.text(lines, col2X, y);
      y += lines.length * 5;
    }
    if (form.consigneeCountry) { doc.text(form.consigneeCountry, col2X, y); y += 5; }

    y = Math.max(col1EndY, y) + 4;
    line();

    // Transport
    bold(8); doc.text("3. TRANSPORT DETAILS", margin, y); y += 5;
    normal(9);
    const transportPairs = [
      ["Departure Date:", form.departureDate || "—"],
      ["Vessel / Flight:", form.vessel || "—"],
      ["Port of Loading:", form.portOfLoading || "—"],
      ["Port of Discharge:", form.portOfDischarge || "—"],
      ["Destination:", form.destinationCountry || "—"],
    ];
    transportPairs.forEach(([label, val], i) => {
      const x = i % 2 === 0 ? margin : pageW / 2;
      if (i % 2 === 0 && i > 0) y += 5;
      bold(8); doc.text(label, x, y);
      normal(9); doc.text(val, x + 35, y);
    });
    y += 8; line();

    // Goods table
    bold(8); doc.text("4. DESCRIPTION OF GOODS", margin, y); y += 5;
    const tableHeaders = ["Marks & Nos", "Description", "HTS Code", "Quantity", "Weight (kg)"];
    const colWidths = [25, 70, 25, 25, 25];
    let tx = margin;
    bold(8);
    tableHeaders.forEach((h, i) => { doc.text(h, tx, y); tx += colWidths[i]; });
    y += 5;
    doc.setLineWidth(0.2); doc.line(margin, y - 1, pageW - margin, y - 1);
    normal(9);
    tx = margin;
    const goodsRow = [
      form.marksNumbers || "—",
      form.goodsDescription || "—",
      form.htsCode || "—",
      form.quantity ? `${form.quantity} ${form.quantityUnit}` : "—",
      `G:${form.grossWeight || "—"} N:${form.netWeight || "—"}`,
    ];
    goodsRow.forEach((cell, i) => {
      const lines = doc.splitTextToSize(cell, colWidths[i] - 2);
      doc.text(lines, tx, y);
      tx += colWidths[i];
    });
    y += 12; line();

    // Origin
    bold(8); doc.text("5. ORIGIN DECLARATION", margin, y); y += 5;
    normal(9);
    bold(8); doc.text("Country of Origin:", margin, y);
    normal(10); doc.text(form.countryOfOrigin || "—", margin + 40, y);
    bold(8); doc.text("Criterion:", pageW / 2, y);
    normal(10); doc.text(form.originCriterion || "—", pageW / 2 + 25, y);
    y += 7;
    if (form.producerDeclaration) {
      normal(8);
      const lines = doc.splitTextToSize(form.producerDeclaration, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;
    }
    line();

    // Certification & Signature
    bold(8); doc.text("6. CERTIFICATION", margin, y); y += 5;
    normal(9);
    doc.text(`Certifying Authority: ${form.chamberName || "—"}`, margin, y); y += 5;
    doc.text(`Issue Date: ${form.issueDate || "—"}    Place: ${form.issuePlace || "—"}`, margin, y); y += 12;
    doc.line(margin, y, margin + 70, y);
    y += 4;
    normal(8); doc.text("Authorized Signature & Stamp", margin, y);

    doc.save(`${certNumber}.pdf`);
  });
}
