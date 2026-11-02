import { useEffect, useState } from "react";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAi, type AiMode, type AiSettings } from "@/lib/ai";
import { cn } from "@/lib/utils";

export function AiStatusButton({ className, compact }: { className?: string; compact?: boolean }) {
  const { mode, label } = useAi();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
          mode === "off" ? "text-muted-foreground" : "border-ai/30 bg-ai-soft text-ai",
          className
        )}
      >
        <Sparkles className="size-4 shrink-0" />
        {compact ? <span className="font-medium">{mode === "off" ? "AI off" : "AI on"}</span> : (
          <span className="min-w-0">
            <span className="block font-medium">{mode === "off" ? "AI enhancement off" : "AI enhancement on"}</span>
            <span className="block truncate opacity-80">{mode === "off" ? "Official data and rules only" : label}</span>
          </span>
        )}
      </button>
      <AiSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AiSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { settings, setSettings, serverAvailable, serverModel, mode, testLocal } = useAi();
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [test, setTest] = useState<{ state: "idle" | "testing" | "ok" | "error"; message?: string }>({ state: "idle" });

  useEffect(() => {
    if (open) {
      setDraft({ ...settings, mode: settings.mode ?? mode });
      setTest({ state: "idle" });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const runTest = async () => {
    setTest({ state: "testing" });
    try {
      const reply = await testLocal(draft);
      setTest({ state: "ok", message: `Connected — model replied "${reply.trim().slice(0, 40)}"` });
    } catch (e: any) {
      setTest({ state: "error", message: e?.message?.includes("fetch") ? "Couldn't reach Ollama. Is it running, and is this site allowed (see below)?" : e?.message });
    }
  };

  const option = (value: AiMode, title: string, body: string, disabled = false) => (
    <Label
      htmlFor={`ai-${value}`}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
        draft.mode === value && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <RadioGroupItem id={`ai-${value}`} value={value} disabled={disabled} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </Label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-ai" /> AI enhancement</DialogTitle>
          <DialogDescription>
            Every tool works from official data and built-in rules. With AI on, results are improved: better HTS
            matches, extra duties and regulations, scanned PO reading and an assistant. AI additions are labelled.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={draft.mode ?? "off"} onValueChange={v => setDraft({ ...draft, mode: v as AiMode })} className="gap-2">
          {option("off", "Off", "Official data and rules only.")}
          {option("server", "Site AI", serverAvailable ? `Hosted model provided by this site (${serverModel}).` : "Not configured on this site.", !serverAvailable)}
          {option("local", "Local model (Ollama)", "Runs on your own computer. Nothing leaves your machine.")}
        </RadioGroup>

        {draft.mode === "local" && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ai-url" className="text-xs">Ollama URL</Label>
                <Input id="ai-url" value={draft.localUrl} onChange={e => setDraft({ ...draft, localUrl: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-model" className="text-xs">Model</Label>
                <Input id="ai-model" value={draft.localModel} onChange={e => setDraft({ ...draft, localModel: e.target.value })} placeholder="gemma3:4b" />
              </div>
            </div>
            {/(^|[:\-])(0?\.\d+b|1b|270m|360m|500m|135m)\b/i.test(draft.localModel) && (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                Models of 1B parameters or less often get duties and regulations wrong. Use 4B or larger (e.g. gemma3:4b, qwen3:4b) for useful results.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={runTest} disabled={test.state === "testing"}>
                {test.state === "testing" && <Loader2 className="size-4 animate-spin" />} Test connection
              </Button>
              {test.state === "ok" && <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="size-4" /> {test.message}</span>}
              {test.state === "error" && <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="size-4 shrink-0" /> {test.message}</span>}
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Setup (2 minutes)</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                <li>Install Ollama from ollama.com, then pull a model: <code className="rounded bg-background px-1">ollama pull gemma3:4b</code> (needs ~4 GB; use a vision model like gemma3 to read scanned POs).</li>
                <li>Allow this site to call it, then restart Ollama:<br />
                  <code className="mt-1 block break-all rounded bg-background px-1.5 py-1">launchctl setenv OLLAMA_ORIGINS "{origin}"</code>
                  <span className="mt-1 block">(Windows/Linux: set the <code>OLLAMA_ORIGINS</code> environment variable to the same value.)</span>
                </li>
                <li>Use Chrome, Edge or Firefox. If the browser asks to allow access to local network devices, allow it.</li>
              </ol>
            </details>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { setSettings(draft); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
