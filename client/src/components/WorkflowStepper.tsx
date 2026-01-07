import { Check } from "lucide-react";

interface WorkflowStep {
  id: number;
  label: string;
  path: string;
}

interface WorkflowStepperProps {
  currentStep: number;
  steps: WorkflowStep[];
}

export default function WorkflowStepper({ currentStep, steps }: WorkflowStepperProps) {
  return (
    <div className="border-b-2 border-border bg-white py-6">
      <div className="container">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            const isUpcoming = step.id > currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                      isCompleted
                        ? "bg-primary border-primary text-white"
                        : isCurrent
                        ? "bg-white border-primary text-primary"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-sm font-medium ${
                      isCurrent ? "text-primary" : isUpcoming ? "text-gray-400" : "text-black"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 transition-all ${
                      isCompleted ? "bg-primary" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
