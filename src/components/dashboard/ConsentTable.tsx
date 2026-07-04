import { ConsentLog } from "../../types";
import { Button } from "../ui/Button";
import { Ban, Loader2, ShieldOff } from "lucide-react";
import { useMemo } from "react";
import { canRevokeConsent, consentRowVariant } from "../../lib/consentDisplay";
import { cn } from "../../lib/utils";

interface ConsentTableProps {
  logs: ConsentLog[];
  searchQuery?: string;
  onRevokeTrial?: (trialId: string) => Promise<void>;
  revokeBusyTrialId?: string | null;
}

function shortTrialId(id: string | undefined) {
  if (!id) return "—";
  const s = String(id);
  if (s.startsWith("0x") && s.length >= 12) {
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  }
  return s.length > 18 ? `${s.slice(0, 10)}…` : s;
}

function formatDateGranted(rawTimestamp?: number) {
  if (rawTimestamp == null || Number.isNaN(rawTimestamp)) {
    return { line1: "—", line2: "" };
  }
  const d = new Date(rawTimestamp * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return {
    line1: `${y}.${m}.${day}`,
    line2: `${h}:${min} UTC`,
  };
}

function rowVariant(
  log: ConsentLog
): "active" | "revoked" | "pending" {
  const s = (log.status || "").toLowerCase();
  if (s === "rejected" || s === "revoked") return "revoked";
  if (s === "pending") return "pending";
  return "active";
}

export function ConsentTable({
  logs,
  searchQuery = "",
  onRevokeTrial,
  revokeBusyTrialId,
}: ConsentTableProps) {
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        (log.sponsorName?.toLowerCase().includes(q) ?? false) ||
        log.trialName.toLowerCase().includes(q) ||
        (log.trialId != null && String(log.trialId).toLowerCase().includes(q))
    );
  }, [logs, searchQuery]);

  return (
    <div className="w-full">
      <table className="w-full text-sm text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-200 bg-white">
            <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Trial name
            </th>
            <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
              Date granted
            </th>
            <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Status
            </th>
            <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredLogs.map((log) => {
            const variant = rowVariant(log);
            const { line1, line2 } = formatDateGranted(log.rawTimestamp);
            return (
              <tr
                key={log.id}
                className="bg-white hover:bg-slate-50/80 transition-colors"
              >
                <td className="px-6 py-5 align-top">
                  <div className="font-semibold text-slate-900 leading-snug">
                    {log.trialName}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    ID: {shortTrialId(log.trialId)}
                  </div>
                </td>
                <td className="px-6 py-5 align-top text-slate-600">
                  <div>{line1}</div>
                  {line2 ? (
                    <div className="text-xs text-slate-500 mt-0.5">{line2}</div>
                  ) : null}
                </td>
                <td className="px-6 py-5 align-top">
                  {variant === "active" && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        "bg-teal-50 text-teal-700 border border-teal-100"
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" aria-hidden />
                      Active
                    </span>
                  )}
                  {variant === "revoked" && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        "bg-rose-50 text-rose-700 border border-rose-100"
                      )}
                    >
                      <Ban className="h-3.5 w-3.5 shrink-0" />
                      Revoked
                    </span>
                  )}
                  {variant === "pending" && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        "bg-amber-50 text-amber-800 border border-amber-100"
                      )}
                    >
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-6 py-5 align-top text-right">
                  {variant !== "revoked" && onRevokeTrial && canRevokeConsent(log) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50 font-medium h-9 gap-1.5"
                      disabled={revokeBusyTrialId === String(log.trialId)}
                      onClick={() => {
                        const ok = window.confirm(
                          `Revoke sponsor access for "${log.trialName}"? Future consent-gated access for this trial will be blocked.`
                        );
                        if (ok && log.trialId) void onRevokeTrial(String(log.trialId));
                      }}
                    >
                      {revokeBusyTrialId === String(log.trialId) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5" />
                      )}
                      Revoke
                    </Button>
                  ) : null}
                  {variant === "revoked" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="rounded-lg border-slate-200 text-slate-400 cursor-not-allowed font-medium h-9"
                    >
                      Revoked
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {filteredLogs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-16 text-center">
                <p className="text-slate-500 font-medium text-sm">
                  {logs.length === 0
                    ? "No consent records yet. When you grant access to a trial, it will appear here."
                    : "No records match your search."}
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
