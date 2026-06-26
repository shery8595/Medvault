import { cn } from "../../lib/utils";
import type { WithdrawExitMode } from "../../lib/withdrawFlow";

type Props = {
  value: WithdrawExitMode;
  onChange: (mode: WithdrawExitMode) => void;
  variant?: "default" | "enclave";
};

const MODES: Array<{
  id: WithdrawExitMode;
  label: string;
  description: string;
}> = [
  {
    id: "wallet",
    label: "Wallet",
    description: "Complete from your wallet after KMS proof (amount visible at settlement).",
  },
  {
    id: "fast",
    label: "Fast exit",
    description: "Relayer submits immediately to a one-time stealth address.",
  },
  {
    id: "private_batch",
    label: "Private exit",
    description: "Relayer batches settlement for better timing unlinkability (slower).",
  },
];

export function WithdrawModeSelector({ value, onChange, variant = "default" }: Props) {
  const isEnclave = variant === "enclave";

  return (
    <div className="space-y-2">
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.16em]",
          isEnclave ? "text-slate-400" : "text-slate-500"
        )}
      >
        Exit mode
      </p>
      <div className="grid gap-2">
        {MODES.map((mode) => {
          const selected = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                isEnclave
                  ? selected
                    ? "border-teal-400/50 bg-teal-500/15 text-teal-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  : selected
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              <span className="block text-xs font-bold">{mode.label}</span>
              <span
                className={cn(
                  "mt-0.5 block text-[10px] leading-snug",
                  isEnclave ? "text-slate-400" : "text-slate-500"
                )}
              >
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
