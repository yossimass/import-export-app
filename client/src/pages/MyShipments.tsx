import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Package, ArrowRight, Trash2, Calendar, Upload, FileText,
  Stamp, CheckCircle2, Clock, AlertCircle, X, ChevronDown, ChevronUp,
  Loader2, Eye
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
  lineNumber?: number;
  description: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  totalPrice?: string;
  htsCode?: string;
  countryOfOrigin?: string;
}

interface POData {
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
  fileUrl?: string;
  extractedAt?: string;
  lineItems?: LineItem[];
}

// ─── COO Status Badge ─────────────────────────────────────────────────────────
function CooStatusBadge({ status }: { status: string }) {
  if (status === "issued") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        COO Issued
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        COO Draft
      </Badge>
    );
  }
  return null;
}

// ─── PO Preview Panel ─────────────────────────────────────────────────────────
function POPreviewPanel({ poData, onConfirm, onEdit, isCreating }: {
  poData: POData;
  onConfirm: () => void;
  onEdit: (field: string, value: string) => void;
  isCreating: boolean;
}) {
  const [showItems, setShowItems] = useState(true);

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">
          AI successfully extracted data from your PO. Review and confirm below.
        </p>
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: "PO Number", key: "poNumber" },
          { label: "PO Date", key: "poDate" },
          { label: "Seller / Exporter", key: "sellerName" },
          { label: "Buyer", key: "buyerName" },
          { label: "Ship To", key: "shipToName" },
          { label: "Incoterms", key: "incoterms" },
          { label: "Currency", key: "currency" },
          { label: "Total Value", key: "totalValue" },
          { label: "Payment Terms", key: "paymentTerms" },
          { label: "Delivery Date", key: "deliveryDate" },
        ].map(({ label, key }) => {
          const val = (poData as any)[key];
          if (!val) return null;
          return (
            <div key={key} className="bg-gray-50 rounded p-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium truncate">{val}</p>
            </div>
          );
        })}
      </div>

      {/* Line items */}
      {poData.lineItems && poData.lineItems.length > 0 && (
        <div>
          <button
            className="flex items-center gap-2 text-sm font-semibold mb-2 hover:text-primary transition-colors"
            onClick={() => setShowItems(v => !v)}
          >
            {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {poData.lineItems.length} Line Item{poData.lineItems.length !== 1 ? "s" : ""}
          </button>
          {showItems && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 font-semibold">#</th>
                    <th className="text-left p-2 font-semibold">Description</th>
                    <th className="text-left p-2 font-semibold">Qty</th>
                    <th className="text-left p-2 font-semibold">Unit Price</th>
                    <th className="text-left p-2 font-semibold">HTS</th>
                    <th className="text-left p-2 font-semibold">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {poData.lineItems.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground">{item.lineNumber ?? i + 1}</td>
                      <td className="p-2 max-w-[180px] truncate" title={item.description}>{item.description}</td>
                      <td className="p-2">{item.quantity} {item.unit}</td>
                      <td className="p-2">{item.unitPrice}</td>
                      <td className="p-2 font-mono">{item.htsCode || "—"}</td>
                      <td className="p-2">{item.countryOfOrigin || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Button onClick={onConfirm} disabled={isCreating} className="w-full">
        {isCreating ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Shipment…</>
        ) : (
          <><Package className="w-4 h-4 mr-2" /> Create Shipment from PO</>
        )}
      </Button>
    </div>
  );
}

// ─── PO Import Modal ──────────────────────────────────────────────────────────
function POImportModal({ open, onClose, onShipmentCreated }: {
  open: boolean;
  onClose: () => void;
  onShipmentCreated: (shipmentId: number, name: string) => void;
}) {
  const [step, setStep] = useState<"upload" | "extracting" | "preview" | "error">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [extractedPO, setExtractedPO] = useState<POData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importPOMutation = trpc.shipments.importPO.useMutation();
  const createFromPOMutation = trpc.shipments.createFromPO.useMutation();
  const uploadDocMutation = trpc.documents.upload.useMutation();

  const handleFile = useCallback(async (file: File) => {
    const MAX_MB = 16;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`File too large. Maximum size is ${MAX_MB}MB.`);
      setStep("error");
      return;
    }

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/tiff"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Unsupported file type. Please upload a PDF or image (PNG, JPG, WEBP, TIFF).");
      setStep("error");
      return;
    }

    setStep("extracting");

    try {
      // Read file as base64 and upload to S3 via documents.upload
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadResult = await uploadDocMutation.mutateAsync({
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        documentType: 'purchase_order',
      });
      const fileUrl = uploadResult.url;

      // Extract PO data via AI
      const result = await importPOMutation.mutateAsync({
        fileUrl,
        fileName: file.name,
        mimeType: file.type,
      });

      setExtractedPO(result as POData);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to extract PO data. Please try again.");
      setStep("error");
    }
  }, [importPOMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirmCreate = async () => {
    if (!extractedPO) return;
    try {
      const result = await createFromPOMutation.mutateAsync({ poData: extractedPO });
      toast.success(`Shipment "${result.shipmentName}" created from PO`);
      onShipmentCreated(result.shipmentId, result.shipmentName);
      handleClose();
    } catch (err: any) {
      toast.error("Failed to create shipment: " + (err?.message || "Unknown error"));
    }
  };

  const handleClose = () => {
    setStep("upload");
    setExtractedPO(null);
    setErrorMsg("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Import Purchase Order
          </DialogTitle>
          <DialogDescription>
            Upload a PO document (PDF or image). AI will extract all fields and pre-fill a new shipment.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50"
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-semibold mb-1">Drop your PO here</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports PDF, PNG, JPG, WEBP, TIFF — up to 16MB
            </p>
            <Button variant="outline" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {step === "extracting" && (
          <div className="py-16 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-semibold mb-2">Extracting PO Data…</p>
            <p className="text-sm text-muted-foreground">
              AI is reading your document and extracting all fields. This takes 5–15 seconds.
            </p>
          </div>
        )}

        {step === "preview" && extractedPO && (
          <POPreviewPanel
            poData={extractedPO}
            onConfirm={handleConfirmCreate}
            onEdit={(field, value) => setExtractedPO(prev => prev ? { ...prev, [field]: value } : prev)}
            isCreating={createFromPOMutation.isPending}
          />
        )}

        {step === "error" && (
          <div className="py-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-semibold mb-2">Extraction Failed</p>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep("upload")}>Try Again</Button>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyShipments() {
  const [, setLocation] = useLocation();
  const { data: shipments, isLoading, refetch } = trpc.shipments.list.useQuery();
  const [showPOModal, setShowPOModal] = useState(false);
  const [expandedPO, setExpandedPO] = useState<number | null>(null);

  const deleteMutation = trpc.shipments.delete.useMutation({
    onSuccess: () => { toast.success("Shipment deleted"); refetch(); },
    onError: () => toast.error("Failed to delete shipment"),
  });

  const getStepRoute = (step: number) => {
    switch (step) {
      case 1: return "/hts-search";
      case 2: return "/tariff-calculator";
      case 3: return "/documents";
      case 4: return "/checklists";
      default: return "/hts-search";
    }
  };

  const getStepName = (step: number) => {
    switch (step) {
      case 1: return "HTS Code Search";
      case 2: return "Tariff Calculation";
      case 3: return "Documents";
      case 4: return "Compliance Review";
      default: return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "bg-green-100 text-green-800";
      case "reviewing": return "bg-blue-100 text-blue-800";
      case "documenting": return "bg-yellow-100 text-yellow-800";
      case "calculating": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleResume = (shipmentId: number, workflowStep: number) => {
    setLocation(`${getStepRoute(workflowStep)}?shipmentId=${shipmentId}`);
  };

  const handleGenerateCOO = (shipment: any) => {
    // Build query params from shipment data
    const params = new URLSearchParams({ shipmentId: shipment.id.toString() });
    if (shipment.originCountry) params.set("exporterCountry", shipment.originCountry);
    if (shipment.destinationCountry) params.set("destinationCountry", shipment.destinationCountry);
    if (shipment.htsCode) params.set("htsCode", shipment.htsCode);
    if (shipment.productDescription) params.set("goodsDescription", encodeURIComponent(shipment.productDescription));
    setLocation(`/certificate-of-origin?${params.toString()}`);
  };

  const handleDelete = (shipmentId: number) => {
    if (confirm("Are you sure you want to delete this shipment?")) {
      deleteMutation.mutate({ shipmentId });
    }
  };

  const handlePOShipmentCreated = (shipmentId: number, name: string) => {
    refetch();
    // Navigate to the new shipment's workflow
    setLocation(`/hts-search?shipmentId=${shipmentId}`);
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="w-2 h-12 bg-primary mb-4"></div>
            <h1 className="text-4xl font-bold mb-2">My Shipments</h1>
            <p className="text-muted-foreground">
              View and manage all your saved trade compliance workflows
            </p>
          </div>
          <Button
            onClick={() => setShowPOModal(true)}
            variant="outline"
            className="flex items-center gap-2 mt-4"
          >
            <Upload className="w-4 h-4" />
            Import PO
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Loading shipments…</p>
          </div>
        )}

        {!isLoading && (!shipments || shipments.length === 0) && (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold mb-2">No shipments yet</h3>
            <p className="text-muted-foreground mb-6">
              Start a new workflow or import a Purchase Order to create your first shipment
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setLocation("/hts-search")}>
                Start HTS Search
              </Button>
              <Button variant="outline" onClick={() => setShowPOModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import PO
              </Button>
            </div>
          </Card>
        )}

        {shipments && shipments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shipments.map((shipment: any) => (
              <Card key={shipment.id} className="p-6 hover:shadow-lg transition-shadow flex flex-col">
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Package className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-base leading-tight truncate" title={shipment.shipmentName}>
                        {shipment.shipmentName || shipment.htsCode || "Draft Shipment"}
                      </h3>
                      <p className="text-xs text-muted-foreground">ID #{shipment.id}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(shipment.status)} shrink-0 ml-2`}>
                    {shipment.status}
                  </Badge>
                </div>

                {/* PO badge */}
                {shipment.poData && (
                  <div className="mb-3">
                    <button
                      className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition-colors"
                      onClick={() => setExpandedPO(expandedPO === shipment.id ? null : shipment.id)}
                    >
                      <FileText className="w-3 h-3" />
                      PO {shipment.poData.poNumber ? `#${shipment.poData.poNumber}` : "Imported"}
                      {expandedPO === shipment.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {expandedPO === shipment.id && (
                      <div className="mt-2 text-xs bg-gray-50 rounded p-2 space-y-1 border">
                        {shipment.poData.sellerName && <p><span className="text-muted-foreground">Seller:</span> {shipment.poData.sellerName}</p>}
                        {shipment.poData.buyerName && <p><span className="text-muted-foreground">Buyer:</span> {shipment.poData.buyerName}</p>}
                        {shipment.poData.totalValue && <p><span className="text-muted-foreground">Value:</span> {shipment.poData.currency || ""} {shipment.poData.totalValue}</p>}
                        {shipment.poData.incoterms && <p><span className="text-muted-foreground">Incoterms:</span> {shipment.poData.incoterms}</p>}
                        {shipment.poData.lineItems?.length > 0 && (
                          <p><span className="text-muted-foreground">Items:</span> {shipment.poData.lineItems.length} line item{shipment.poData.lineItems.length !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Route */}
                {shipment.originCountry && shipment.destinationCountry && (
                  <div className="mb-3 text-sm">
                    <p>
                      <span className="font-semibold">Route:</span>{" "}
                      {shipment.originCountry} → {shipment.destinationCountry}
                    </p>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Workflow Progress</span>
                    <span className="font-semibold">
                      Step {Math.min(shipment.workflowStep, 4)} / 4
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min((shipment.workflowStep / 4) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getStepName(shipment.workflowStep)}
                  </p>
                </div>

                {/* COO status */}
                {shipment.cooStatus && shipment.cooStatus !== "none" && (
                  <div className="mb-3">
                    <CooStatusBadge status={shipment.cooStatus} />
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>Updated {new Date(shipment.updatedAt).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto space-y-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleResume(shipment.id, shipment.workflowStep)}
                      className="flex-1"
                      size="sm"
                    >
                      Resume
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleDelete(shipment.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Generate COO button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center gap-2"
                    onClick={() => handleGenerateCOO(shipment)}
                  >
                    <Stamp className="w-3.5 h-3.5" />
                    {shipment.cooStatus === "none" || !shipment.cooStatus
                      ? "Generate Certificate of Origin"
                      : shipment.cooStatus === "draft"
                      ? "Edit Certificate of Origin"
                      : "View Certificate of Origin"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* PO Import Modal */}
      <POImportModal
        open={showPOModal}
        onClose={() => setShowPOModal(false)}
        onShipmentCreated={handlePOShipmentCreated}
      />
    </div>
  );
}
