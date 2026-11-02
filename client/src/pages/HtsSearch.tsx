import { useState } from "react";
import WorkflowStepper from "@/components/WorkflowStepper";
import { PageHeader } from "@/components/app/PageHeader";
import { SourceBadge } from "@/components/app/SourceBadge";
import { EnhanceNotice } from "@/components/app/EnhanceNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useEnhanced } from "@/lib/ai";
import { ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { HtsResult } from "@shared/tradeTypes";

const WORKFLOW_STEPS = [
  { id: 1, label: "Classify", path: "/hts-search" },
  { id: 2, label: "Duties", path: "/tariff-calculator" },
  { id: 3, label: "Documents", path: "/documents" },
  { id: 4, label: "Compliance", path: "/checklists" },
];

const EXAMPLES = ["cotton t-shirts", "laptop", "lithium batteries", "frozen shrimp", "wooden furniture"];

const confidenceTone = (c: number) =>
  c >= 0.75 ? "bg-green-100 text-green-800" : c >= 0.5 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";

export default function HtsSearch() {
  const initial = new URLSearchParams(window.location.search).get("q") ?? "";
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [, setLocation] = useLocation();

  const { data: base, isFetching } = trpc.hts.search.useQuery(
    { query, limit: 10 },
    { enabled: query.length > 0 }
  );
  const isCode = /^\s*\d{4}/.test(query);
  const { data: results, state, error } = useEnhanced<HtsResult[]>(
    base,
    base && base.length && !isCode ? { feature: "hts", query, candidates: base } : null,
    r => r.hts
  );

  const createShipment = trpc.shipments.create.useMutation({
    onSuccess: data => setLocation(`/tariff-calculator?shipmentId=${data.shipmentId}`),
    onError: e => toast.error(e.message),
  });

  const search = (q = input) => {
    const trimmed = q.trim();
    if (!trimmed) return toast.error("Describe the product or enter an HTS code");
    setInput(trimmed);
    setQuery(trimmed);
  };

  return (
    <div>
      <WorkflowStepper currentStep={1} steps={WORKFLOW_STEPS} />
      <PageHeader
        eyebrow="Step 1"
        title="Classify your product"
        description="Search the official US Harmonized Tariff Schedule by description or code. Duty rates always come from the schedule."
      />

      <Card className="mb-6 gap-3 p-4">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); search(); }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="e.g. men's cotton t-shirts, or 6109.10"
              value={input}
              onChange={e => setInput(e.target.value)}
              className="h-11 pl-9 text-base"
            />
          </div>
          <Button type="submit" size="lg" className="h-11" disabled={isFetching}>Search</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Try:
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => search(ex)} className="rounded-full border px-2.5 py-1 hover:bg-accent">{ex}</button>
          ))}
        </div>
      </Card>

      {isFetching && (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      )}

      {!isFetching && results && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{results.length} matches for “{query}”</p>
            <EnhanceNotice state={state} error={error} doneText="Re-ranked with AI" />
          </div>

          {results.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No matches. Try simpler words (material + product, e.g. “steel screws”) or a 4–6 digit code.
            </Card>
          )}

          {results.map((r, idx) => (
            <Card key={r.code} className={`gap-0 p-0 ${idx === 0 ? "ring-1 ring-primary/30" : ""}`}>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-semibold">{r.code}</span>
                    {idx === 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Best match</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${confidenceTone(r.confidence)}`}>{Math.round(r.confidence * 100)}% confidence</span>
                    <SourceBadge source={r.source} />
                  </div>
                  <p className="text-sm leading-relaxed">
                    {r.description.split(" > ").map((part, i, all) => (
                      <span key={i} className={i === all.length - 1 ? "font-medium" : "text-muted-foreground"}>
                        {part}{i < all.length - 1 && <span className="mx-1 text-muted-foreground/60">›</span>}
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{r.reasoning}</p>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">General duty</p>
                    <p className="font-mono text-lg font-semibold">{r.dutyRate}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createShipment.mutate({ shipmentName: `Shipment – ${r.code}`, productDescription: query, htsCode: r.code })}
                    disabled={createShipment.isPending}
                  >
                    Use this code <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
