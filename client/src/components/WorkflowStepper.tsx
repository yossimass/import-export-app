import { Check } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: number;
  label: string;
  path: string;
}

interface WorkflowStepperProps {
  currentStep: number;
  steps: WorkflowStep[];
}

/** Compact shipment workflow progress; steps link onward, keeping the shipment. */
export default function WorkflowStepper({ currentStep, steps }: WorkflowStepperProps) {
  const shipmentId = new URLSearchParams(window.location.search).get("shipmentId");
  return (
    <ol className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 text-sm">
      {steps.map((step, index) => {
        const done = step.id < currentStep;
        const current = step.id === currentStep;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-1">
            <Link
              href={shipmentId ? `${step.path}?shipmentId=${shipmentId}` : step.path}
              className={cn(
                "flex flex-1 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 transition-colors",
                current ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <span className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                done ? "bg-primary text-primary-foreground" : current ? "border-2 border-primary" : "border"
              )}>
                {done ? <Check className="size-3.5" /> : step.id}
              </span>
              {step.label}
            </Link>
            {index < steps.length - 1 && <span className="hidden h-px w-4 shrink-0 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
