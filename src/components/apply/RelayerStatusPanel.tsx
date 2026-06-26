import { useEffect, useState } from "react";
import { RefreshCw, Radio, CheckCircle2, XCircle, Clock } from "lucide-react";
import { ethers } from "ethers";
import { getEligibilityEngine } from "../../lib/contracts";
import { txExplorerUrl } from "../../lib/network";
import { cn } from "../../lib/utils";
import { getMedVaultRelayerUrl } from "../../lib/mobile";

const relayerHealthOrigin = () => getMedVaultRelayerUrl();

type RelayerJobState = "idle" | "staging" | "finalizing" | "completed" | "cancelled" | "error";

type Props = {
  trialId: string;
  nullifier?: bigint | null;
  provider?: ethers.Provider | null;
  /** When parent is mid-submit */
  jobState?: RelayerJobState;
  stageTxHash?: string | null;
  finalizeTxHash?: string | null;
  errorMessage?: string | null;
  className?: string;
};

const STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Pending",
  2: "Accepted",
  3: "Rejected",
};

export function RelayerStatusPanel({
  trialId,
  nullifier,
  provider,
  jobState = "idle",
  stageTxHash,
  finalizeTxHash,
  errorMessage,
  className,
}: Props) {
  const [relayerOk, setRelayerOk] = useState<boolean | null>(null);
  const [onChainStatus, setOnChainStatus] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${relayerHealthOrigin()}/health`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setRelayerOk(res.ok && data.status === "ok");
      } catch {
        if (!cancelled) setRelayerOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!provider || !nullifier) {
      setOnChainStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPolling(true);
      try {
        const engine = getEligibilityEngine(provider);
        const raw = await engine.getAnonymousApplicationStatus(nullifier, BigInt(trialId));
        if (!cancelled) setOnChainStatus(Number(raw));
      } catch {
        if (!cancelled) setOnChainStatus(null);
      } finally {
        if (!cancelled) setPolling(false);
      }
    };
    void load();
    const id = setInterval(load, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [provider, nullifier, trialId, jobState, finalizeTxHash]);

  const jobRows: { key: string; label: string; state: "done" | "active" | "pending" | "failed" }[] = [
    {
      key: "stage",
      label: "Stage anonymous apply",
      state:
        jobState === "error" && !stageTxHash
          ? "failed"
          : stageTxHash || jobState === "finalizing" || jobState === "completed"
            ? "done"
            : jobState === "staging"
              ? "active"
              : "pending",
    },
    {
      key: "finalize",
      label: "KMS public decrypt & finalize",
      state:
        jobState === "cancelled"
          ? "failed"
          : finalizeTxHash || onChainStatus === 2 || onChainStatus === 3
            ? "done"
            : jobState === "finalizing"
              ? "active"
              : stageTxHash
                ? "pending"
                : "pending",
    },
    {
      key: "result",
      label: "Application recorded",
      state:
        onChainStatus === 2
          ? "done"
          : onChainStatus === 3 || jobState === "cancelled"
            ? "failed"
            : jobState === "completed"
              ? "done"
              : "pending",
    },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
          <Radio className="h-3.5 w-3.5 text-teal-600" />
          Relayer progress
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            relayerOk === true && "bg-emerald-50 text-emerald-700",
            relayerOk === false && "bg-amber-50 text-amber-800",
            relayerOk === null && "bg-slate-100 text-slate-500"
          )}
        >
          {relayerOk === true ? "Relayer online" : relayerOk === false ? "Relayer unreachable" : "Checking…"}
        </span>
      </div>

      <ul className="space-y-2">
        {jobRows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[11px] text-slate-600">
            {row.state === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : row.state === "active" ? (
              <RefreshCw className="h-3.5 w-3.5 text-teal-600 animate-spin shrink-0" />
            ) : row.state === "failed" ? (
              <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            )}
            <span className={cn(row.state === "active" && "font-semibold text-teal-800")}>{row.label}</span>
          </li>
        ))}
      </ul>

      {onChainStatus != null && (
        <p className="text-[11px] text-slate-500">
          On-chain status:{" "}
          <strong className="text-slate-700">{STATUS_LABELS[onChainStatus] ?? `Code ${onChainStatus}`}</strong>
          {polling ? " · refreshing…" : null}
        </p>
      )}

      {(stageTxHash || finalizeTxHash) && (
        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
          {stageTxHash && (
            <a
              href={txExplorerUrl(stageTxHash)}
              target="_blank"
              rel="noreferrer"
              className="text-teal-700 hover:underline"
            >
              Stage tx
            </a>
          )}
          {finalizeTxHash && (
            <a
              href={txExplorerUrl(finalizeTxHash)}
              target="_blank"
              rel="noreferrer"
              className="text-teal-700 hover:underline"
            >
              Finalize tx
            </a>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
