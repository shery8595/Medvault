import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Radio, CheckCircle2, XCircle, Clock } from "lucide-react";
import { ethers } from "ethers";
import { getEligibilityEngine } from "../../lib/contracts";
import { txExplorerUrl } from "../../lib/network";
import { cn } from "../../lib/utils";
import {
  getActiveRelayerUrl,
  probeAllRelayerHealth,
  setStoredRelayerUrl,
  type RelayerHealth,
} from "../../lib/relayerRegistry";

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
  selectedRelayerUrl?: string;
  onRelayerChange?: (url: string) => void;
};

const STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Pending",
  2: "Accepted",
  3: "Rejected",
};

function relayerLabel(h: RelayerHealth, index: number): string {
  if (h.relayerWallet) {
    return `Relayer ${index + 1} (${h.relayerWallet.slice(0, 6)}…${h.relayerWallet.slice(-4)})`;
  }
  return h.url ? `Relayer ${index + 1}` : "Dev proxy";
}

export function RelayerStatusPanel({
  trialId,
  nullifier,
  provider,
  jobState = "idle",
  stageTxHash,
  finalizeTxHash,
  errorMessage,
  className,
  selectedRelayerUrl,
  onRelayerChange,
}: Props) {
  const [relayers, setRelayers] = useState<RelayerHealth[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [onChainStatus, setOnChainStatus] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  const activeUrl = selectedRelayerUrl ?? getActiveRelayerUrl();
  const activeHealth = relayers.find((r) => r.url === activeUrl);
  const relayerOk = activeHealth?.ok ?? null;

  const refreshRelayers = useCallback(async () => {
    setRefreshing(true);
    try {
      const health = await probeAllRelayerHealth();
      setRelayers(health);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshRelayers();
    const id = setInterval(() => void refreshRelayers(), 30_000);
    return () => clearInterval(id);
  }, [refreshRelayers]);

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

  const handleSelect = (url: string) => {
    setStoredRelayerUrl(url);
    onRelayerChange?.(url);
  };

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
      label: "Noir proof & relayer finalize",
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshRelayers()}
            className="p-1 rounded text-slate-400 hover:text-teal-600"
            title="Refresh relayer health"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
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
      </div>

      {relayers.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Authorized relayers (P3.1)
          </p>
          <ul className="space-y-1">
            {relayers.map((h, i) => {
              const selected = h.url === activeUrl;
              return (
                <li key={h.url || `relayer-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(h.url)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors",
                      selected
                        ? "border-teal-300 bg-teal-50/80"
                        : "border-slate-200 bg-white hover:border-teal-200"
                    )}
                  >
                    <span className="font-medium text-slate-700 truncate">{relayerLabel(h, i)}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {h.relayerAuthorized === true && (
                        <span className="text-[9px] text-emerald-600 font-semibold">on-chain</span>
                      )}
                      {h.ok ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-amber-600" />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
