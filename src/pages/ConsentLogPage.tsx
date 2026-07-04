import { useState, useMemo, useEffect, useCallback } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { useConsent } from "../hooks/useConsent";
import { useRevokeTrialConsent } from "../hooks/useRevokeTrialConsent";
import { Clock, Loader2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ConsentLog } from "../types";
import { Link } from "react-router-dom";
import { useTrials } from "../hooks/useTrials";
import { ConsentSecureBanner } from "../components/consent/ConsentSecureBanner";
import { ConsentStatCards, buildConsentStats } from "../components/consent/ConsentStatCards";
import { ConsentLogList } from "../components/consent/ConsentLogList";
import { ConsentSidebarPanels } from "../components/consent/ConsentSidebarPanels";
import { PrivacyTimeline, buildDefaultPrivacyTimeline } from "../components/privacy/PrivacyTimeline";
import { PatientConnectPrompt } from "../components/dashboard/PatientConnectPrompt";
import { consentRowVariant } from "../lib/consentDisplay";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay },
});

function formatLastSynced(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function countInLastWeek(logs: ConsentLog[], predicate: (l: ConsentLog) => boolean) {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  return logs.filter((l) => (l.rawTimestamp || 0) >= weekAgo && predicate(l)).length;
}

export function ConsentLogPage() {
  const { account, signer } = useWeb3();
  const { consents, applications, loading, error, refetch } = useConsent(account as string | undefined);
  const { trials, loading: trialsLoading, refetch: refetchTrials } = useTrials(account || undefined);
  const { busyTrialId, error: revokeError, revokeTrialConsent, clearError } = useRevokeTrialConsent(
    signer ?? undefined
  );
  const [search, setSearch] = useState("");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([refetch(), refetchTrials()]);
      setLastSynced(new Date());
    } finally {
      setSyncing(false);
    }
  }, [refetch, refetchTrials]);

  const handleRevokeTrial = useCallback(
    async (trialId: string) => {
      clearError();
      await revokeTrialConsent(trialId);
      await handleSync();
    },
    [clearError, revokeTrialConsent, handleSync]
  );

  useEffect(() => {
    if (!account) return;
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void handleSync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [account, handleSync]);

  useEffect(() => {
    if (!loading && !trialsLoading && account && !lastSynced) {
      setLastSynced(new Date());
    }
  }, [loading, trialsLoading, account, lastSynced]);

  const formattedLogs = useMemo<ConsentLog[]>(() => {
    const trialMap = new Map<string, ConsentLog>();

    consents.forEach((c: any) => {
      const expiresAt = c.expiresAt ? parseInt(String(c.expiresAt), 10) : undefined;
      trialMap.set(c.trial.id, {
        id: c.id,
        trialId: c.trial.id,
        trialName: c.trial.name,
        timestamp: new Date(parseInt(c.lastUpdatedAt) * 1000).toLocaleString(),
        rawTimestamp: parseInt(c.lastUpdatedAt, 10),
        txHash: c.txHash,
        granted: c.granted !== false,
        status: c.granted === false ? "Revoked" : "Active",
        expiresAt: expiresAt && expiresAt > 0 ? expiresAt : undefined,
        sponsorName: c.trial.sponsor.name.startsWith("0x")
          ? `${c.trial.sponsor.name.slice(0, 6)}...${c.trial.sponsor.name.slice(-4)}`
          : c.trial.sponsor.name,
        dataShared: ["Medical profile", "Encrypted labs"],
      });
    });

    applications.forEach((app: any) => {
      const existing = trialMap.get(app.trial.id);
      const appTs = parseInt(app.updatedAt, 10);
      if (!existing || appTs >= (existing.rawTimestamp || 0)) {
        const combinedLog: ConsentLog = {
          id: app.id,
          trialId: app.trial.id,
          trialName: app.trial.name,
          timestamp: new Date(appTs * 1000).toLocaleString(),
          rawTimestamp: appTs,
          txHash: app.txHash,
          status: app.status,
          message: app.message,
          sponsorName: app.trial.sponsor.name.startsWith("0x")
            ? `${app.trial.sponsor.name.slice(0, 6)}...${app.trial.sponsor.name.slice(-4)}`
            : app.trial.sponsor.name,
          dataShared: existing?.dataShared || ["Full medical disclosure"],
        };
        trialMap.set(app.trial.id, combinedLog);
      }
    });

    trials
      .filter((trial) => trial.nullifier && trial.applicationStatus)
      .forEach((trial) => {
        const existing = trialMap.get(trial.id);
        const rawTimestamp = Number(trial.createdAt || "0") || undefined;
        if (!existing) {
          trialMap.set(trial.id, {
            id: `anonymous-${trial.id}-${trial.nullifier}`,
            trialId: trial.id,
            trialName: trial.name,
            timestamp: rawTimestamp
              ? new Date(rawTimestamp * 1000).toLocaleString()
              : "Anonymous application",
            rawTimestamp,
            status: trial.applicationStatus,
            message: trial.applicationMessage || undefined,
            sponsorName: trial.sponsor.name.startsWith("0x")
              ? `${trial.sponsor.name.slice(0, 6)}...${trial.sponsor.name.slice(-4)}`
              : trial.sponsor.name,
            dataShared: ["Anonymous eligibility", "Ephemeral reward address"],
          });
        }
      });

    return Array.from(trialMap.values()).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
  }, [consents, applications, trials]);

  const stats = useMemo(() => {
    const isActive = (l: ConsentLog) => {
      const v = consentRowVariant(l);
      return v === "active" || v === "expiring";
    };
    const isPending = (l: ConsentLog) => consentRowVariant(l) === "pending";
    const isRevoked = (l: ConsentLog) => consentRowVariant(l) === "revoked";
    const sponsors = new Set(formattedLogs.map((l) => l.sponsorName).filter(Boolean));

    return buildConsentStats(
      {
        active: formattedLogs.filter(isActive).length,
        pending: formattedLogs.filter(isPending).length,
        revoked: formattedLogs.filter(isRevoked).length,
        sponsors: sponsors.size,
      },
      {
        active: countInLastWeek(formattedLogs, isActive),
        pending: countInLastWeek(formattedLogs, isPending),
        revoked: countInLastWeek(formattedLogs, isRevoked),
        sponsors: countInLastWeek(formattedLogs, () => true),
      }
    );
  }, [formattedLogs]);

  const total = formattedLogs.length;

  if (!account) {
    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        <motion.header {...fadeUp(0)} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <Shield className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Consent Logs</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            Manage your cryptographic proofs and clinical trial access permissions.
          </p>
        </motion.header>
        <PatientConnectPrompt
          title="Connect to view consent logs"
          description="Consent grants, revocations, and application-linked access show here after you connect the wallet tied to your vault."
          showBrowseTrials={false}
          className="mt-4"
        />
      </div>
    );
  }

  if ((loading || trialsLoading) && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading consent records…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <motion.header
        {...fadeUp(0)}
        className="sticky top-0 z-30 pt-1 pb-4 mb-2 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/80 space-y-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                <Shield className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Consent Logs</h1>
            </div>
            <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
              Manage your cryptographic proofs and clinical trial access permissions.
            </p>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <div className="flex flex-wrap gap-2">
              <Link
                to="/patient/find-trials"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Browse trials
              </Link>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-70 transition-colors shadow-sm"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Sync records
              </button>
            </div>
            {lastSynced ? (
              <p className="text-[11px] text-slate-400 text-right">
                Last synced: {formatLastSynced(lastSynced)}
              </p>
            ) : null}
          </div>
        </div>
      </motion.header>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm">
          Could not refresh all data: {error.message}. Showing the last loaded snapshot.
        </div>
      ) : null}

      {revokeError ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Revoke failed: {revokeError}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <motion.div {...fadeUp(0.06)}>
        <PrivacyTimeline
          events={buildDefaultPrivacyTimeline({
            hasProfile: true,
            hasConsent: consents.length > 0,
            hasSemaphoreIdentity: true,
            hasApplied: applications.length > 0,
            applicationAccepted: applications.some((a: { status?: string }) => a.status === "Accepted"),
            rewardClaimed: formattedLogs.some((l) => l.status === "Accepted"),
          })}
        />
      </motion.div>

      <motion.div {...fadeUp(0.04)}>
        <ConsentSecureBanner />
      </motion.div>

      <motion.div {...fadeUp(0.08)}>
        <ConsentStatCards stats={stats} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <motion.div {...fadeUp(0.12)}>
          <ConsentLogList
            logs={formattedLogs}
            search={search}
            onSearchChange={setSearch}
            onRevokeTrial={signer ? handleRevokeTrial : undefined}
            revokeBusyTrialId={busyTrialId}
          />
        </motion.div>
        <motion.div {...fadeUp(0.14)} className="xl:sticky xl:top-24 xl:self-start">
          <ConsentSidebarPanels logs={formattedLogs} />
        </motion.div>
      </div>
    </div>
  );
}
