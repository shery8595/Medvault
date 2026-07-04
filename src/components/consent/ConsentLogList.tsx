import { useMemo, useState, type MouseEvent } from "react";
import {
  Beaker,
  ChevronDown,
  ChevronRight,
  Download,
  Droplets,
  FlaskConical,
  HeartPulse,
  Loader2,
  Search,
  BadgeCheck,
  ShieldOff,
} from "lucide-react";
import type { ConsentLog } from "../../types";
import {
  canRevokeConsent,
  consentRowVariant,
  exportConsentLogsCsv,
  formatExpires,
  formatGrantedUtc,
  trialIconIndex,
  type ConsentRowVariant,
} from "../../lib/consentDisplay";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

const TRIAL_ICONS = [FlaskConical, Beaker, Droplets, HeartPulse] as const;

const FILTER_TABS: { id: "all" | ConsentRowVariant; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "revoked", label: "Revoked" },
  { id: "expiring", label: "Expiring soon" },
];

function StatusBadge({ variant }: { variant: ConsentRowVariant }) {
  if (variant === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Active
      </span>
    );
  }
  if (variant === "pending") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
        Pending
      </span>
    );
  }
  if (variant === "expiring") {
    return (
      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800">
        Expiring soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800">
      Revoked
    </span>
  );
}

type Props = {
  logs: ConsentLog[];
  search: string;
  onSearchChange: (v: string) => void;
  onRevokeTrial?: (trialId: string) => Promise<void>;
  revokeBusyTrialId?: string | null;
};

export function ConsentLogList({
  logs,
  search,
  onSearchChange,
  onRevokeTrial,
  revokeBusyTrialId,
}: Props) {
  const [filter, setFilter] = useState<"all" | ConsentRowVariant>("all");
  const [sponsorFilter, setSponsorFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sponsors = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.sponsorName) set.add(l.sponsorName);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const variant = consentRowVariant(log);
      if (filter !== "all" && variant !== filter) return false;
      if (sponsorFilter !== "all" && log.sponsorName !== sponsorFilter) return false;
      if (!q) return true;
      return (
        log.trialName.toLowerCase().includes(q) ||
        (log.sponsorName?.toLowerCase().includes(q) ?? false) ||
        String(log.trialId ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, filter, sponsorFilter, search]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-4px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === tab.id
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sponsorFilter}
              onChange={(e) => setSponsorFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              aria-label="Filter by sponsor"
            >
              <option value="all">All sponsors</option>
              {sponsors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[180px] sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search trials, sponsors…"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300"
              />
            </div>
            <button
              type="button"
              onClick={() => exportConsentLogsCsv(filtered)}
              disabled={filtered.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export logs
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          <span className="font-semibold text-slate-600">{filtered.length}</span> of{" "}
          <span className="font-semibold text-slate-600">{logs.length}</span> records
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {filtered.map((log) => {
          const variant = consentRowVariant(log);
          const granted = formatGrantedUtc(log.rawTimestamp);
          const expires = formatExpires(log);
          const Icon = TRIAL_ICONS[trialIconIndex(log.trialId)];
          const expanded = expandedId === log.id;
          const revokable = Boolean(onRevokeTrial) && canRevokeConsent(log);
          const revoking = revokeBusyTrialId === String(log.trialId);

          const handleRevoke = async (e: MouseEvent) => {
            e.stopPropagation();
            if (!onRevokeTrial || !log.trialId) return;
            const ok = window.confirm(
              `Revoke sponsor access for "${log.trialName}"?\n\nThis blocks future consent-gated eligibility for this trial. Already-decrypted data cannot be recalled on-chain (forward-only revocation).`
            );
            if (!ok) return;
            await onRevokeTrial(String(log.trialId));
          };

          return (
            <div key={log.id} className="bg-white hover:bg-slate-50/60 transition-colors">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : log.id)}
                className="w-full text-left px-4 py-4 sm:px-5 grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:grid-cols-[auto_1.4fr_1fr_1fr_auto_auto]"
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
                    variant === "active" && "bg-teal-50 text-teal-700 ring-teal-100",
                    variant === "pending" && "bg-amber-50 text-amber-700 ring-amber-100",
                    variant === "expiring" && "bg-orange-50 text-orange-700 ring-orange-100",
                    variant === "revoked" && "bg-slate-100 text-slate-500 ring-slate-200"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>

                <div className="min-w-0 sm:col-span-1 lg:col-span-1">
                  <p className="font-semibold text-slate-900 truncate">{log.trialName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="truncate">{log.sponsorName ?? "Sponsor"}</span>
                    {variant === "active" || variant === "expiring" ? (
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-label="Verified sponsor" />
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(log.dataShared ?? ["Medical profile"]).slice(0, 3).map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="hidden lg:block text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Granted</p>
                  <p className="font-medium text-slate-800 tabular-nums">{granted.date}</p>
                  {granted.time ? (
                    <p className="text-xs text-slate-500 tabular-nums">{granted.time}</p>
                  ) : null}
                </div>

                <div className="hidden lg:block text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {variant === "revoked" ? "Revoked" : "Expires"}
                  </p>
                  <p className="font-medium text-slate-800 tabular-nums">{expires.date}</p>
                  <p className="text-xs text-slate-500">{expires.sub}</p>
                </div>

                <div className="flex items-center gap-3 sm:justify-end">
                  <StatusBadge variant={variant} />
                  {revokable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold shrink-0"
                      disabled={revoking}
                      onClick={(e) => void handleRevoke(e)}
                    >
                      {revoking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5" />
                      )}
                      Revoke
                    </Button>
                  ) : null}
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-sm text-slate-600 space-y-2">
                  <div className="grid grid-cols-2 gap-3 lg:hidden text-xs">
                    <div>
                      <span className="font-semibold text-slate-500">Granted</span>
                      <p className="tabular-nums">
                        {granted.date} {granted.time}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Expires</span>
                      <p>
                        {expires.date} — {expires.sub}
                      </p>
                    </div>
                  </div>
                  {log.message ? (
                    <p>
                      <span className="font-semibold text-slate-700">Note:</span> {log.message}
                    </p>
                  ) : null}
                  {log.txHash ? (
                    <p className="font-mono text-xs break-all">
                      Tx: {log.txHash}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">Trial ID: {log.trialId ?? "—"}</p>
                  {revokable ? (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      Revoking updates on-chain consent for this trial. Sponsors who already decrypted hybrid
                      documents may retain copies off-chain — use{" "}
                      <strong>Revoke &amp; rotate</strong> on the trial card for document access.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-600">
              {logs.length === 0
                ? "No consent records yet. When you grant access to a trial, it will appear here."
                : "No records match your filters."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
