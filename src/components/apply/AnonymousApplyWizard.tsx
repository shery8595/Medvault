import { useMemo } from "react";
import { StepProgress, type StepProgressItem } from "../ui/StepProgress";
import { RelayerStatusPanel } from "./RelayerStatusPanel";
import { cn } from "../../lib/utils";

export type ApplyWizardPhase =
  | "idle"
  | "checking-identity"
  | "registering-profile"
  | "generating-proof"
  | "staging"
  | "finalizing"
  | "applied"
  | "error";

type Props = {
  phase: ApplyWizardPhase;
  walletRegistered: boolean;
  semaphoreRegistered: boolean;
  hasProfile: boolean;
  trialId: string;
  nullifier?: bigint | null;
  provider?: import("ethers").Provider | null;
  stageTxHash?: string | null;
  finalizeTxHash?: string | null;
  errorMessage?: string | null;
  className?: string;
};

function stepStatus(
  done: boolean,
  active: boolean,
  errored: boolean
): StepProgressItem["status"] {
  if (errored) return "error";
  if (done) return "complete";
  if (active) return "active";
  return "pending";
}

export function AnonymousApplyWizard({
  phase,
  walletRegistered,
  semaphoreRegistered,
  hasProfile,
  trialId,
  nullifier,
  provider,
  stageTxHash,
  finalizeTxHash,
  errorMessage,
  className,
}: Props) {
  const isError = phase === "error";
  const isSubmitting = phase === "staging" || phase === "finalizing" || phase === "generating-proof";

  const steps = useMemo<StepProgressItem[]>(() => {
    const identityDone = walletRegistered && semaphoreRegistered;
    const profileDone = hasProfile || walletRegistered;
    const proofDone = phase === "staging" || phase === "finalizing" || phase === "applied";
    const stageDone = !!stageTxHash || phase === "finalizing" || phase === "applied";
    const finalizeDone = phase === "applied" || !!finalizeTxHash;

    return [
      {
        id: "identity",
        label: "Anonymous identity check",
        description: "Wallet linked to Semaphore commitment in this browser",
        status: stepStatus(identityDone, phase === "checking-identity", isError && !identityDone),
      },
      {
        id: "profile",
        label: "Encrypted profile registered",
        description: "Health vault sealed on Ethereum Sepolia",
        status: stepStatus(profileDone, phase === "registering-profile", isError && !profileDone),
      },
      {
        id: "proof",
        label: "Semaphore membership proof",
        description:
          "Trial-scoped anonymous identity — separate from Noir eligibility attestation at finalize",
        status: stepStatus(proofDone, phase === "generating-proof", isError && phase === "generating-proof"),
      },
      {
        id: "stage",
        label: "Stage FHE eligibility",
        description: "Relayer stages encrypted eligibility on-chain (Zama FHE compute)",
        status: stepStatus(stageDone, phase === "staging", isError && phase === "staging"),
      },
      {
        id: "finalize",
        label: "FHE decrypt, Noir proof & finalize",
        description:
          "Browser decrypts staged result, generates Noir attestation (incl. hybrid doc binding if attached), relayer finalizes apply",
        status: stepStatus(finalizeDone, phase === "finalizing", isError && phase === "finalizing"),
      },
      {
        id: "done",
        label: "Application submitted",
        description: "Status Pending — sponsor accepts or rejects; no PHI exposed on-chain",
        status: stepStatus(phase === "applied", false, isError && phase === "applied"),
      },
    ];
  }, [
    walletRegistered,
    semaphoreRegistered,
    hasProfile,
    phase,
    stageTxHash,
    finalizeTxHash,
    isError,
  ]);

  const relayerJobState =
    phase === "staging"
      ? "staging"
      : phase === "finalizing"
        ? "finalizing"
        : phase === "applied"
          ? "completed"
          : isError
            ? "error"
            : "idle";

  return (
    <div className={cn("space-y-4", className)}>
      <StepProgress steps={steps} compact />
      {(isSubmitting || stageTxHash || finalizeTxHash || nullifier) && (
        <RelayerStatusPanel
          trialId={trialId}
          nullifier={nullifier}
          provider={provider}
          jobState={relayerJobState}
          stageTxHash={stageTxHash}
          finalizeTxHash={finalizeTxHash}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
