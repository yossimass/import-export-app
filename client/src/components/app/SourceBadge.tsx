import { Sparkles, Landmark, ListChecks, UserPen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InfoSource } from "@shared/tradeTypes";

const META: Record<InfoSource, { label: string; icon: typeof Sparkles; className: string; tip: string }> = {
  official: { label: "Official", icon: Landmark, className: "bg-official-soft text-official", tip: "From the official USITC Harmonized Tariff Schedule or CBP fee schedule." },
  rules: { label: "Rules", icon: ListChecks, className: "bg-secondary text-secondary-foreground", tip: "From built-in compliance rules for the country and product chapter." },
  user: { label: "Entered", icon: UserPen, className: "bg-secondary text-secondary-foreground", tip: "Uses a value you entered." },
  ai: { label: "AI", icon: Sparkles, className: "bg-ai-soft text-ai", tip: "Added or improved by AI. Codes are checked against the official schedule; verify other details before relying on them." },
};

export function SourceBadge({ source, className }: { source?: InfoSource; className?: string }) {
  if (!source) return null;
  const m = META[source];
  const Icon = m.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", m.className, className)}>
          <Icon className="size-3" /> {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{m.tip}</TooltipContent>
    </Tooltip>
  );
}
