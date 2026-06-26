import { Check, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type StepProgressItem = {
  id: string;
  label: string;
  description?: string;
  status: "pending" | "active" | "complete" | "error";
};

type Props = {
  steps: StepProgressItem[];
  className?: string;
  compact?: boolean;
};

export function StepProgress({ steps, className, compact = false }: Props) {
  return (
    <ol className={cn("space-y-0", className)} aria-label="Progress">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                  step.status === "complete" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                  step.status === "active" && "border-teal-400 bg-teal-50 text-teal-800",
                  step.status === "error" && "border-rose-300 bg-rose-50 text-rose-700",
                  step.status === "pending" && "border-slate-200 bg-white text-slate-400"
                )}
              >
                {step.status === "complete" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : step.status === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "my-1 w-px flex-1 min-h-[1.25rem]",
                    step.status === "complete" ? "bg-emerald-200" : "bg-slate-200"
                  )}
                />
              )}
            </div>
            <div className={cn("min-w-0 pb-4", isLast && "pb-0")}>
              <p
                className={cn(
                  compact ? "text-xs" : "text-sm",
                  "font-semibold leading-tight",
                  step.status === "active" && "text-teal-900",
                  step.status === "complete" && "text-emerald-900",
                  step.status === "error" && "text-rose-800",
                  step.status === "pending" && "text-slate-500"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className={cn("mt-0.5 text-[11px] text-slate-500 leading-snug", compact && "text-[10px]")}>
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
