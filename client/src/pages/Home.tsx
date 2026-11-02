import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Calculator, FolderOpen, ListChecks, Scale, Search, Sparkles, Stamp, Wrench, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useAi } from "@/lib/ai";
import { AiSettingsDialog } from "@/components/app/AiSettings";

const STEPS = [
  { path: "/hts-search", label: "Classify", body: "Find the HTS code and its official duty rate.", icon: Search },
  { path: "/tariff-calculator", label: "Duties & landed cost", body: "Duties, trade-agreement savings and CBP fees.", icon: Calculator },
  { path: "/documents", label: "Documents", body: "Keep invoices, POs and certificates together.", icon: FolderOpen },
  { path: "/checklists", label: "Compliance", body: "Permits, filings and deadlines for the route.", icon: ListChecks },
];

const REFERENCE = [
  { path: "/regulations", label: "Regulations", body: "Requirements by country and product.", icon: Scale },
  { path: "/certificate-of-origin", label: "Certificate of origin", body: "USMCA, KORUS, CAFTA-DR, AGOA, EU GSP.", icon: Stamp },
  { path: "/utilities", label: "Currency & freight", body: "Live FX rates and freight estimates.", icon: Wrench },
];

const STEP_PATHS = ["/hts-search", "/tariff-calculator", "/documents", "/checklists"];

export default function Home() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const { mode, label } = useAi();
  const { data: recent } = trpc.shipments.recent.useQuery({ limit: 4 });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">International trade compliance</p>
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Classify, cost and clear your shipments, from official data.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          HTS codes and US duty rates come from the USITC schedule; fees from CBP. Regulations and checklists come from built-in rules — and get sharper with AI when it's on.
        </p>
        <form className="mt-5 flex max-w-xl gap-2" onSubmit={e => { e.preventDefault(); if (q.trim()) setLocation(`/hts-search?q=${encodeURIComponent(q.trim())}`); }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="What are you shipping? e.g. cotton t-shirts" className="h-11 pl-9" />
          </div>
          <Button type="submit" size="lg" className="h-11">Classify</Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Shipment workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ path, label, body, icon: Icon }, i) => (
            <Link key={path} href={path}>
              <Card className="h-full gap-2 p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                  <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                </div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent shipments</h2>
            <Link href="/my-shipments" className="text-xs text-primary hover:underline">All shipments</Link>
          </div>
          {recent && recent.length > 0 ? (
            <Card className="gap-0 divide-y p-0">
              {recent.map(s => {
                const step = Math.min(Math.max(s.workflowStep || 1, 1), 4);
                return (
                  <Link key={s.id} href={`${STEP_PATHS[step - 1]}?shipmentId=${s.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50">
                    <Package className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.shipmentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[s.htsCode && `HTS ${s.htsCode}`, s.originCountry && s.destinationCountry && `${s.originCountry} → ${s.destinationCountry}`].filter(Boolean).join(" · ") || "Not classified yet"}
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <Progress value={(step / 4) * 100} className="h-1.5" />
                      <p className="mt-1 text-right text-[11px] text-muted-foreground">Step {step} of 4</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </Card>
          ) : (
            <Card className="items-start gap-2 p-5 text-sm text-muted-foreground">
              No shipments yet. Classify a product to start one, or import a purchase order.
              <Link href="/my-shipments"><Button variant="outline" size="sm">Import a PO</Button></Link>
            </Card>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Reference</h2>
          {REFERENCE.map(({ path, label, body, icon: Icon }) => (
            <Link key={path} href={path}>
              <Card className="flex-row items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{body}</p>
                </div>
              </Card>
            </Link>
          ))}
          <Card className="gap-2 border-ai/20 bg-ai-soft/60 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ai"><Sparkles className="size-4" /> {mode === "off" ? "AI enhancement is off" : `AI on · ${label}`}</p>
            <p className="text-xs text-muted-foreground">
              {mode === "off"
                ? "Everything works without it. Turn it on for better HTS matches, extra duties and rules, scanned PO reading and the assistant."
                : "Results are improved by AI where it helps; additions are labelled and codes are checked against the official schedule."}
            </p>
            <Button size="sm" variant="outline" className="self-start" onClick={() => setAiOpen(true)}>{mode === "off" ? "Set up AI" : "AI settings"}</Button>
          </Card>
        </section>
      </div>
      <AiSettingsDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
