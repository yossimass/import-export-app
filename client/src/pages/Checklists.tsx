import { useEffect, useMemo, useState } from "react";
import WorkflowStepper from "@/components/WorkflowStepper";
import { PageHeader } from "@/components/app/PageHeader";
import { SourceBadge } from "@/components/app/SourceBadge";
import { EnhanceNotice } from "@/components/app/EnhanceNotice";
import { CountryInput } from "@/components/app/CountryInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useEnhanced } from "@/lib/ai";
import { exportChecklistPDF } from "@/lib/exportUtils";
import { FileDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import type { ChecklistItem } from "@shared/tradeTypes";

const WORKFLOW_STEPS = [
  { id: 1, label: "Classify", path: "/hts-search" },
  { id: 2, label: "Duties", path: "/tariff-calculator" },
  { id: 3, label: "Documents", path: "/documents" },
  { id: 4, label: "Compliance", path: "/checklists" },
];

const PRIORITY_TONE: Record<string, string> = {
  required: "bg-red-50 text-red-700",
  conditional: "bg-amber-50 text-amber-700",
  optional: "bg-secondary text-secondary-foreground",
};

export default function Checklists() {
  const shipmentId = useMemo(() => {
    const id = new URLSearchParams(window.location.search).get("shipmentId");
    return id ? parseInt(id) : undefined;
  }, []);
  const [form, setForm] = useState({ htsCode: "", origin: "", destination: "", type: "import" as "import" | "export" });
  const [generated, setGenerated] = useState<{ items: ChecklistItem[]; request: typeof form } | null>(null);
  const [items, setItems] = useState<ChecklistItem[] | null>(null);

  const { data: shipment } = trpc.shipments.get.useQuery({ shipmentId: shipmentId! }, { enabled: !!shipmentId });
  const { data: saved } = trpc.checklists.get.useQuery({ shipmentId: shipmentId! }, { enabled: !!shipmentId });

  useEffect(() => {
    if (shipment) {
      setForm(f => ({ ...f, htsCode: shipment.htsCode || "", origin: shipment.originCountry || "", destination: shipment.destinationCountry || "" }));
    }
  }, [shipment]);
  useEffect(() => {
    if (saved && !items) setItems(saved.items as ChecklistItem[]);
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = trpc.checklists.generate.useMutation({
    onSuccess: (data, vars) => {
      setGenerated({ items: data.items, request: { htsCode: vars.htsCode || "", origin: vars.originCountry, destination: vars.destinationCountry, type: vars.shipmentType } });
      setItems(data.items);
    },
    onError: e => toast.error(e.message),
  });
  const save = trpc.checklists.save.useMutation();
  const toggle = trpc.checklists.toggleItem.useMutation();

  const { data: enhanced, state, error } = useEnhanced<ChecklistItem[]>(
    generated?.items,
    generated ? {
      feature: "checklist",
      shipmentType: generated.request.type,
      originCountry: generated.request.origin,
      destinationCountry: generated.request.destination,
      htsCode: generated.request.htsCode || undefined,
      base: generated.items,
    } : null,
    r => r.checklist
  );

  // Adopt AI additions (keeping any boxes already ticked) and store them with the shipment
  useEffect(() => {
    if (state !== "done" || !enhanced || !generated) return;
    setItems(prev => enhanced.map(item => ({ ...item, completed: prev?.find(p => p.task === item.task)?.completed ?? false })));
    if (shipmentId) save.mutate({ shipmentId, items: enhanced });
  }, [state, enhanced]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    if (!form.origin.trim() || !form.destination.trim()) return toast.error("Enter origin and destination");
    generate.mutate({
      shipmentId,
      shipmentType: form.type,
      originCountry: form.origin,
      destinationCountry: form.destination,
      htsCode: form.htsCode || undefined,
    });
  };

  const onToggle = (index: number, completed: boolean) => {
    setItems(prev => prev && prev.map((it, i) => (i === index ? { ...it, completed } : it)));
    if (shipmentId) toggle.mutate({ shipmentId, itemIndex: index, completed });
  };

  const done = items?.filter(i => i.completed).length ?? 0;

  return (
    <div>
      <WorkflowStepper currentStep={4} steps={WORKFLOW_STEPS} />
      <PageHeader
        eyebrow="Step 4"
        title="Compliance checklist"
        description="Tasks for your route and product from built-in rules and trade agreements. With AI on, product-specific tasks are added and labelled."
      />

      <Card className="mb-6 gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cl-type">Direction</Label>
            <div id="cl-type" className="flex rounded-md border p-0.5">
              {(["import", "export"] as const).map(t => (
                <button key={t} onClick={() => setForm({ ...form, type: t })} className={`flex-1 rounded px-2 py-1.5 text-sm capitalize ${form.type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-hts">HTS code</Label>
            <Input id="cl-hts" placeholder="e.g. 8471.30" value={form.htsCode} onChange={e => setForm({ ...form, htsCode: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-origin">Origin</Label>
            <CountryInput id="cl-origin" placeholder="e.g. China" value={form.origin} onChange={v => setForm({ ...form, origin: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-dest">Destination</Label>
            <CountryInput id="cl-dest" placeholder="e.g. United States" value={form.destination} onChange={v => setForm({ ...form, destination: v })} />
          </div>
        </div>
        <div>
          <Button onClick={run} disabled={generate.isPending}>
            <ListChecks className="size-4" /> {items ? "Regenerate checklist" : "Generate checklist"}
          </Button>
        </div>
      </Card>

      {items && (
        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-48 flex-1">
              <p className="text-sm font-semibold">{done} of {items.length} done</p>
              <Progress value={(done / Math.max(items.length, 1)) * 100} className="mt-2 h-1.5" />
            </div>
            <div className="flex items-center gap-3">
              <EnhanceNotice state={state} error={error} doneText="Product-specific tasks added" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportChecklistPDF({ htsCode: form.htsCode, origin: form.origin, destination: form.destination, items });
                  toast.success("Checklist exported");
                }}
              >
                <FileDown className="size-4" /> PDF
              </Button>
            </div>
          </div>
          <ul className="divide-y">
            {items.map((item, i) => (
              <li key={`${item.task}-${i}`} className="flex items-start gap-3 px-5 py-3.5">
                <Checkbox id={`item-${i}`} checked={item.completed} onCheckedChange={v => onToggle(i, v === true)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`item-${i}`} className={`cursor-pointer text-sm font-medium ${item.completed ? "text-muted-foreground line-through" : ""}`}>{item.task}</label>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_TONE[item.priority] ?? PRIORITY_TONE.optional}`}>{item.priority}</span>
                    <SourceBadge source={item.origin} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.deadline}{item.authority ? ` · ${item.authority}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
