import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { SourceBadge } from "@/components/app/SourceBadge";
import { EnhanceNotice } from "@/components/app/EnhanceNotice";
import { CountryInput } from "@/components/app/CountryInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useEnhanced } from "@/lib/ai";
import { exportRegulationsPDF } from "@/lib/exportUtils";
import { FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import type { Regulation } from "@shared/tradeTypes";

const TYPES = [
  { value: "all", label: "All" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
  { value: "licensing", label: "Licensing" },
  { value: "restrictions", label: "Restrictions" },
] as const;

const RISK_TONE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-green-50 text-green-700",
};

export default function Regulations() {
  const [form, setForm] = useState({ country: "", htsCode: "", product: "" });
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("all");
  const [submitted, setSubmitted] = useState<typeof form | null>(null);

  const { data: base, isFetching } = trpc.regulations.search.useQuery(
    { countryCode: submitted?.country ?? "", regulationType: "all", htsCode: submitted?.htsCode || undefined },
    { enabled: !!submitted }
  );
  const { data: all, state, error } = useEnhanced<Regulation[]>(
    base,
    submitted && base ? { feature: "regulations", country: submitted.country, htsCode: submitted.htsCode || undefined, productDescription: submitted.product || undefined, base } : null,
    r => r.regulations
  );

  const wanted = type === "restrictions" ? "restriction" : type;
  const regulations = all?.filter(r => type === "all" || r.category === wanted);

  const search = () => {
    if (!form.country.trim()) return toast.error("Enter a country");
    setSubmitted({ ...form });
  };

  return (
    <div>
      <PageHeader
        title="Regulations"
        description="Key import and export requirements by country, plus product rules for your HTS chapter. With AI on, product-specific requirements are added and labelled."
      />

      <Card className="mb-6 gap-4 p-5">
        <form className="grid gap-4 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); search(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="rg-country">Country</Label>
            <CountryInput id="rg-country" placeholder="e.g. Germany" value={form.country} onChange={v => setForm({ ...form, country: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-hts">HTS code</Label>
            <Input id="rg-hts" placeholder="e.g. 8517.13" value={form.htsCode} onChange={e => setForm({ ...form, htsCode: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-product">Product (optional)</Label>
            <Input id="rg-product" placeholder="e.g. Bluetooth headphones" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
          </div>
          <Button type="submit" disabled={isFetching}><Search className="size-4" /> Look up</Button>
        </form>
      </Card>

      {isFetching && <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>}

      {!isFetching && regulations && submitted && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)} className={`rounded-md px-3 py-1 text-sm ${type === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{t.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <EnhanceNotice state={state} error={error} doneText="Product-specific rules added" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportRegulationsPDF({ country: submitted.country, regulations: regulations.map(r => ({ ...r, documents: r.documentation })) });
                  toast.success("Exported");
                }}
              >
                <FileDown className="size-4" /> PDF
              </Button>
            </div>
          </div>

          {regulations.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">Nothing in this category.</Card>}

          <div className="grid gap-3 lg:grid-cols-2">
            {regulations.map((reg, i) => (
              <Card key={`${reg.title}-${i}`} className="gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{reg.category}</span>
                      <SourceBadge source={reg.origin} />
                    </div>
                    <h3 className="font-semibold leading-snug">{reg.title}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${RISK_TONE[reg.riskLevel] ?? RISK_TONE.medium}`}>{reg.riskLevel}</span>
                </div>
                <p className="text-sm text-muted-foreground">{reg.description}</p>
                {(reg.requirements.length > 0 || reg.documentation.length > 0) && (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {reg.requirements.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold">What to do</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{reg.requirements.map((r, j) => <li key={j}>{r}</li>)}</ul>
                      </div>
                    )}
                    {reg.documentation.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold">Documents</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{reg.documentation.map((d, j) => <li key={j}>{d}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  {reg.authority && <span>{reg.authority}</span>}
                  {reg.source && <span className="font-mono">{reg.source}</span>}
                  {reg.penalties && <span className="text-red-700">Penalties: {reg.penalties}</span>}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
