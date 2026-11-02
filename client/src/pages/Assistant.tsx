import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { AiSettingsDialog } from "@/components/app/AiSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAi } from "@/lib/ai";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What documents do I need to import cotton t-shirts from Vietnam?",
  "Does Section 301 apply to laptops from China?",
  "How do I claim USMCA preference?",
];

export default function Assistant() {
  const { mode, run, label } = useAi();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shipmentId, setShipmentId] = useState<string>("none");
  const { data: shipments } = trpc.shipments.list.useQuery();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const shipment = shipments?.find(s => String(s.id) === shipmentId);
  const context = shipment
    ? JSON.stringify({
        name: shipment.shipmentName,
        product: shipment.productDescription,
        htsCode: shipment.htsCode,
        origin: shipment.originCountry,
        destination: shipment.destinationCountry,
        value: shipment.value,
        currency: shipment.currency,
        incoterm: shipment.incoterm,
        lastCalculation: shipment.lastCalculation,
      })
    : undefined;

  const send = async (text = draft) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = messages.slice(-8);
    setMessages(m => [...m, { role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    try {
      const { answer } = await run({ feature: "assistant", question, history, context });
      setMessages(m => [...m, { role: "assistant", content: answer }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `_Couldn't get an answer: ${e?.message ?? "AI request failed"}_` }]);
    } finally {
      setBusy(false);
    }
  };

  if (mode === "off") {
    return (
      <div>
        <PageHeader title="Assistant" description="Ask trade compliance questions about your shipments." />
        <Card className="items-center gap-3 p-10 text-center">
          <Sparkles className="size-10 text-ai" />
          <p className="font-medium">The assistant needs an AI model</p>
          <p className="max-w-md text-sm text-muted-foreground">Turn on the site's AI, or connect a model running on your own computer with Ollama. Everything else in the app works without it.</p>
          <Button onClick={() => setSettingsOpen(true)}>Set up AI</Button>
        </Card>
        <AiSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-4rem)]">
      <PageHeader
        title="Assistant"
        description={<>Answers come from {label}. Verify codes and rates with the Classify and Duties tools.</>}
        actions={
          <Select value={shipmentId} onValueChange={setShipmentId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Shipment context" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No shipment context</SelectItem>
              {shipments?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.shipmentName}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <Card className="min-h-0 flex-1 gap-0 overflow-y-auto p-0">
        <div className="space-y-4 p-5">
          {messages.length === 0 && (
            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-col items-center gap-2">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div className={m.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                : "prose prose-sm max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm"}>
                {m.role === "user" ? m.content : <Streamdown>{m.content}</Streamdown>}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</div>}
          <div ref={bottom} />
        </div>
      </Card>

      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about classification, duties, documents, origin rules…"
          rows={2}
          className="min-h-0 resize-none"
        />
        <Button type="submit" size="icon" className="h-auto w-12" disabled={busy || !draft.trim()} aria-label="Send"><SendHorizontal className="size-4" /></Button>
      </form>
    </div>
  );
}
