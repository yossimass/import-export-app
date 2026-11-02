import { Loader2, Sparkles, CircleAlert } from "lucide-react";
import type { EnhanceState } from "@/lib/ai";
import { useAi } from "@/lib/ai";
import { cn } from "@/lib/utils";

/** One-line status of the AI pass over a result. Renders nothing when AI is off. */
export function EnhanceNotice({ state, error, className, doneText = "Improved with AI" }: {
  state: EnhanceState;
  error?: string | null;
  className?: string;
  doneText?: string;
}) {
  const { label } = useAi();
  if (state === "off") return null;
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {state === "working" && (
        <span className="inline-flex items-center gap-1.5 text-ai">
          <Loader2 className="size-3.5 animate-spin" /> Improving with AI ({label})…
        </span>
      )}
      {state === "done" && (
        <span className="inline-flex items-center gap-1.5 text-ai">
          <Sparkles className="size-3.5" /> {doneText} · {label}
        </span>
      )}
      {state === "failed" && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={error ?? undefined}>
          <CircleAlert className="size-3.5" /> AI unavailable this time — showing official data and rules
        </span>
      )}
    </div>
  );
}
