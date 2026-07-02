import { useMemo } from "react";
import { StepProgress, type StepProgressItem } from "../ui/StepProgress";
import { ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ClaimWizardStep } from "../../lib/claimFlow";
import { txExplorerUrl } from "../../lib/network";

type Props = {
  step: ClaimWizardStep;
  destination: string;
  previewEth: string | null;
  previewLoading: boolean;
  confirmTxHash?: string | null;
  claimTxHash?: string | null;
  completeTxHash?: string | null;
  statusMessage?: string | null;
  className?: string;
};

function mapStepStatus(
  current: ClaimWizardStep,
  target: ClaimWizardStep,
  order: ClaimWizardStep[]
): StepProgressItem["status"] {
  const cur = order.indexOf(current);
  const tgt = order.indexOf(target);
  if (current === "error") return tgt < cur ? "complete" : tgt === cur ? "error" : "pending";
  if (tgt < cur) return "complete";
  if (tgt === cur) return "active";
  return "pending";
}

const ORDER: ClaimWizardStep[] = [
  "preview",
  "destination",
  "confirming",
  "claiming",
  "relayer",
  "receipt",
];

export function ClaimWizard({
  step,
  destination,
  previewEth,
  previewLoading,
  confirmTxHash,
  claimTxHash,
  completeTxHash,
  statusMessage,
  className,
}: Props) {
  const steps = useMemo<StepProgressItem[]>(
    () => [
      {
        id: "preview",
        label: "Reward balance",
        description: previewLoading
          ? "Checking staged entitlements and cETH balance…"
          : previewEth
            ? `${previewEth} ETH claimable`
            : "Connect Semaphore identity to preview",
        status: mapStepStatus(step, "preview", ORDER),
      },
      {
        id: "destination",
        label: "Payout destination",
        description: destination ? `${destination.slice(0, 10)}…${destination.slice(-6)}` : "Main wallet",
        status: mapStepStatus(step, "destination", ORDER),
      },
      {
        id: "confirming",
        label: "confirmReceipt",
        description: "Prove staged entitlement and receive confidential cETH",
        status: mapStepStatus(step, "confirming", ORDER),
      },
      {
        id: "claiming",
        label: "claimParticipantRewards",
        description: "Moves confidential units into withdraw-to pipeline",
        status: mapStepStatus(step, "claiming", ORDER),
      },
      {
        id: "relayer",
        label: "completeWithdrawTo",
        description: "Relayer KMS proof finalizes ETH transfer",
        status: mapStepStatus(step, "relayer", ORDER),
      },
      {
        id: "receipt",
        label: "ETH receipt",
        description: statusMessage ?? "Funds arrive at destination address",
        status: mapStepStatus(step, "receipt", ORDER),
      },
    ],
    [step, destination, previewEth, previewLoading, statusMessage]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <StepProgress steps={steps} compact />
      {(confirmTxHash || claimTxHash || completeTxHash) && (
        <div className="flex flex-wrap gap-3 text-[10px] font-semibold">
          {confirmTxHash && (
            <a
              href={txExplorerUrl(confirmTxHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
            >
              Confirm tx <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {claimTxHash && (
            <a
              href={txExplorerUrl(claimTxHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
            >
              Claim tx <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {completeTxHash && (
            <a
              href={txExplorerUrl(completeTxHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
            >
              Complete tx <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
