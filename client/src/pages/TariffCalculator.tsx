import { useState, useEffect } from "react";
import WorkflowStepper from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Calculator, Info, FileDown, FileSpreadsheet, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/PageHeader";
import { SourceBadge } from "@/components/app/SourceBadge";
import { EnhanceNotice } from "@/components/app/EnhanceNotice";
import { useEnhanced } from "@/lib/ai";
import { useLocation } from "wouter";
import type { InfoSource, TariffInput, TariffResult } from "@shared/tradeTypes";

const isUS = (c: string) => ["usa", "us", "united states", "united states of america"].includes(c.trim().toLowerCase());

function Row({ label, value, hint, badge, strong }: { label: string; value: string; hint?: string; badge?: InfoSource; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 py-2.5 ${strong ? "bg-muted/50 font-semibold" : ""}`}>
      <dt className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">{label}{badge && <SourceBadge source={badge} />}</span>
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
import { exportTariffPDF, exportTariffCSV } from "@/lib/exportUtils";
import { toast } from "sonner";
import { CountryInput } from "@/components/app/CountryInput";

const WORKFLOW_STEPS = [
  { id: 1, label: "Classify", path: "/hts-search" },
  { id: 2, label: "Duties", path: "/tariff-calculator" },
  { id: 3, label: "Documents", path: "/documents" },
  { id: 4, label: "Compliance", path: "/checklists" },
];

export default function TariffCalculator() {
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const shipmentId = searchParams.get('shipmentId') ? parseInt(searchParams.get('shipmentId')!) : undefined;
  
  const { data: shipment } = trpc.shipments.get.useQuery(
    { shipmentId: shipmentId! },
    { enabled: !!shipmentId }
  );

  const [formData, setFormData] = useState({
    htsCode: "",
    originCountry: "",
    destinationCountry: "United States",
    value: "10000",
    quantity: "100",
    weight: "500",
    incoterm: "FOB",
    freightCost: "500",
    insuranceCost: "100",
    additionalDutyRate: "",
    dutyRate: "",
  });

  // Pre-populate form with shipment data
  useEffect(() => {
    if (shipment) {
      setFormData(prev => ({
        ...prev,
        htsCode: shipment.htsCode || prev.htsCode,
        originCountry: shipment.originCountry || prev.originCountry,
        destinationCountry: shipment.destinationCountry || prev.destinationCountry,
        value: shipment.value?.toString() || prev.value,
        quantity: shipment.quantity?.toString() || prev.quantity,
        weight: shipment.weight?.toString() || prev.weight,
        incoterm: shipment.incoterm || prev.incoterm,
        freightCost: shipment.freightCost?.toString() || prev.freightCost,
        insuranceCost: shipment.insuranceCost?.toString() || prev.insuranceCost,
      }));
    }
  }, [shipment]);

  const [result, setResult] = useState<TariffResult | null>(null);
  const [lastInput, setLastInput] = useState<TariffInput | null>(null);
  const [, setLocation] = useLocation();
  const { data: enhanced, state, error } = useEnhanced<TariffResult>(
    result,
    result && lastInput ? { feature: "tariff", input: lastInput, base: result } : null,
    r => r.tariff
  );
  const shown = (enhanced ?? result)!;
  const money = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const exportData = () => ({
    htsCode: lastInput!.htsCode,
    origin: lastInput!.originCountry,
    destination: lastInput!.destinationCountry,
    value: lastInput!.value,
    freight: lastInput!.freightCost ?? 0,
    insurance: lastInput!.insuranceCost ?? 0,
    appliedRate: shown.appliedRate,
    dutyAmount: shown.dutyAmount,
    additionalDuties: shown.additionalDuties,
    totalDuties: shown.totalDuties,
    landedCost: shown.landedCost,
    tradeAgreement: shown.tradeAgreement,
  });

  // Auto-save mutation
  const updateShipmentMutation = trpc.shipments.update.useMutation();

  // Auto-save form data with debounce
  useEffect(() => {
    if (!shipmentId) return;
    
    const timer = setTimeout(() => {
      updateShipmentMutation.mutate({
        shipmentId,
        data: {
          htsCode: formData.htsCode || undefined,
          originCountry: formData.originCountry || undefined,
          destinationCountry: formData.destinationCountry || undefined,
          value: formData.value ? parseFloat(formData.value) : undefined,
          quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
          weight: formData.weight ? parseFloat(formData.weight) : undefined,
          incoterm: formData.incoterm || undefined,
          freightCost: formData.freightCost ? parseFloat(formData.freightCost) : undefined,
          insuranceCost: formData.insuranceCost ? parseFloat(formData.insuranceCost) : undefined,
          workflowStep: 2,
          status: "calculating",
        },
      });
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [formData, shipmentId]);

  const calculateMutation = trpc.tariff.calculate.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (error) => {
      console.error('[TariffCalculator] Calculation error:', error);
      toast.error(error.message);
    },
  });

  const handleCalculate = () => {
    
    if (!formData.htsCode || !formData.originCountry || !formData.destinationCountry || !formData.value) {
      toast.error("Please fill in all required fields");
      return;
    }


    const payload: TariffInput = {
      htsCode: formData.htsCode,
      originCountry: formData.originCountry,
      destinationCountry: formData.destinationCountry,
      value: parseFloat(formData.value),
      quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      incoterm: formData.incoterm || undefined,
      freightCost: formData.freightCost ? parseFloat(formData.freightCost) : undefined,
      insuranceCost: formData.insuranceCost ? parseFloat(formData.insuranceCost) : undefined,
      additionalDutyRate: formData.additionalDutyRate ? parseFloat(formData.additionalDutyRate) : undefined,
      dutyRate: formData.dutyRate ? parseFloat(formData.dutyRate) : undefined,
    };
    setLastInput(payload);
    calculateMutation.mutate({ ...payload, shipmentId });
  };


  return (
    <div className="">
      <WorkflowStepper currentStep={2} steps={WORKFLOW_STEPS} />
      <div className="">
      <PageHeader
        eyebrow="Step 2"
        title="Duties & landed cost"
        description="US duty rates, trade-agreement preferences and CBP fees come from official data. With AI on, likely additional duties (e.g. Section 301) are added and labelled."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Card className="p-5">
            <h2 className="text-base font-semibold">Shipment details</h2>
            
            <div className="space-y-4">
              <div>
                <Label>HTS Code *</Label>
                <Input
                  placeholder="e.g., 8471.30.01"
                  value={formData.htsCode}
                  onChange={(e) => setFormData({ ...formData, htsCode: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tc-origin">Origin country *</Label>
                  <CountryInput id="tc-origin" placeholder="e.g. China" value={formData.originCountry} onChange={v => setFormData({ ...formData, originCountry: v })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tc-dest">Destination country *</Label>
                  <CountryInput id="tc-dest" placeholder="e.g. United States" value={formData.destinationCountry} onChange={v => setFormData({ ...formData, destinationCountry: v })} />
                </div>
              </div>

              <div>
                <Label>Merchandise Value (USD) *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Incoterm</Label>
                <Select
                  value={formData.incoterm}
                  onValueChange={(value) => setFormData({ ...formData, incoterm: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select incoterm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                    <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                    <SelectItem value="FOB">FOB - Free on Board</SelectItem>
                    <SelectItem value="CFR">CFR - Cost and Freight</SelectItem>
                    <SelectItem value="CIF">CIF - Cost, Insurance and Freight</SelectItem>
                    <SelectItem value="DAP">DAP - Delivered at Place</SelectItem>
                    <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Freight Cost (USD)</Label>
                  <Input
                    type="number"
                    value={formData.freightCost}
                    onChange={(e) => setFormData({ ...formData, freightCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Insurance Cost (USD)</Label>
                  <Input
                    type="number"
                    value={formData.insuranceCost}
                    onChange={(e) => setFormData({ ...formData, insuranceCost: e.target.value })}
                  />
                </div>
                {formData.destinationCountry && !isUS(formData.destinationCountry) && (
                  <div className="col-span-2">
                    <Label>Import Duty Rate % (destination tariff)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 12"
                      value={formData.dutyRate}
                      onChange={(e) => setFormData({ ...formData, dutyRate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Official rates are built in for US imports only. For other destinations, enter the rate from that country's tariff.
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Additional Duty % (Section 301/232, optional)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 25"
                    value={formData.additionalDutyRate}
                    onChange={(e) => setFormData({ ...formData, additionalDutyRate: e.target.value })}
                  />
                </div>
              </div>

              <Button
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Calculator className="mr-2 h-4 w-4" />
                {calculateMutation.isPending ? "Calculating..." : "Calculate Tariff"}
              </Button>
            </div>
          </Card>
        </div>

        <div>
          {calculateMutation.isPending && <Skeleton className="h-80 w-full rounded-xl" />}

          {result && !calculateMutation.isPending && (
            <div className="space-y-4">
              <Card className="gap-1 border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Total landed cost</p>
                  <SourceBadge source={shown.source} />
                </div>
                <p className="text-3xl font-semibold tracking-tight">{money(shown.landedCost)}</p>
                <p className="text-xs text-muted-foreground">{shown.tradeAgreement} · applied rate {shown.appliedRate}</p>
                {shown !== result && shown.landedCost !== result.landedCost && (
                  <p className="text-xs text-muted-foreground">Without AI estimates: <span className="font-mono">{money(result.landedCost)}</span></p>
                )}
                <EnhanceNotice state={state} error={error} className="mt-2" doneText="Additional duties checked with AI" />
              </Card>

              <Card className="gap-0 p-0">
                <div className="border-b px-5 py-3 text-sm font-semibold">Breakdown</div>
                <dl className="divide-y text-sm">
                  <Row label="Merchandise value" value={money(lastInput?.value ?? 0)} />
                  {!!lastInput?.freightCost && <Row label="Freight" value={money(lastInput.freightCost)} />}
                  {!!lastInput?.insuranceCost && <Row label="Insurance" value={money(lastInput.insuranceCost)} />}
                  <Row label={`Customs duty (${shown.appliedRate})`} value={money(shown.dutyAmount)} badge={shown.source === "ai" ? "ai" : result.source} />
                  {(shown.additionalDutyLines ?? []).map((d, i) => (
                    <Row key={i} label={`${d.name} (${d.ratePercent}%)`} hint={d.basis} value={money(d.amount)} badge={d.source} />
                  ))}
                  {shown.mpf > 0 && <Row label="Merchandise processing fee" value={money(shown.mpf)} badge="official" />}
                  {shown.hmf > 0 && <Row label="Harbor maintenance fee" value={money(shown.hmf)} badge="official" />}
                  <Row label="Total duties & fees" value={money(shown.totalDuties)} strong />
                </dl>
              </Card>

              {(shown.aiNotes?.length ?? 0) > 0 && (
                <Card className="gap-2 border-ai/20 bg-ai-soft/60 p-4 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-ai"><Sparkles className="size-4" /> AI notes</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {shown.aiNotes!.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </Card>
              )}

              {shown.explanation && (
                <details className="rounded-xl border bg-card p-4 text-sm">
                  <summary className="flex cursor-pointer items-center gap-2 font-medium"><Info className="size-4 text-official" /> How this was calculated</summary>
                  <p className="mt-2 whitespace-pre-line text-muted-foreground">{shown.explanation}</p>
                </details>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    exportTariffPDF({ ...exportData(), calculationDate: new Date().toISOString() });
                    toast.success("PDF exported");
                  }}
                >
                  <FileDown className="size-4" /> PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    exportTariffCSV(exportData());
                    toast.success("CSV exported");
                  }}
                >
                  <FileSpreadsheet className="size-4" /> CSV
                </Button>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (shipmentId) {
                    updateShipmentMutation.mutate(
                      { shipmentId, data: { workflowStep: 3, status: "documenting", lastCalculation: shown } },
                      { onSuccess: () => setLocation(`/documents?shipmentId=${shipmentId}`) }
                    );
                  } else {
                    setLocation("/documents");
                  }
                }}
              >
                Save & continue to documents <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {!result && !calculateMutation.isPending && (
            <Card className="items-center justify-center gap-2 p-12 text-center text-sm text-muted-foreground">
              <Calculator className="size-10 opacity-40" />
              Enter shipment details and calculate to see duties and landed cost.
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
