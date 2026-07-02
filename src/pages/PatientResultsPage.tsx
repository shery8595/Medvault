import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Calendar,
  Beaker,
  Activity,
  Loader2,
  Hourglass,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useWeb3 } from "../lib/Web3Context";
import { useEncryptedData } from "../lib/EncryptedDataContext";
import { useTrials } from "../hooks/useTrials";
import { getContractAddressForChain, getMedVaultRegistry } from "../lib/contracts";
import { getEncryptedScoreHandle } from "../lib/contracts/sponsorAdapters";
import { reencryptUint8, reencryptUint8WithEphemeral } from "../lib/fhe";
import { getStoredIdentity, getEphemeralSigner } from "../lib/semaphore";
import { Trial } from "../types";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { fetchCertificationStatus } from "../lib/certificationStatus";
import { ZkCertifyBadge, ZkCertifyStepper, ZkCertifyExplainer, buildZkCertifySteps } from "../components/zk";
import { MatchScoreRing } from "../components/privacy/MatchScoreRing";
import { PatientConnectPrompt } from "../components/dashboard/PatientConnectPrompt";

function formatTrialCode(trial: Trial): string {
  const id = String(trial.id);
  if (/^\d+$/.test(id)) {
    const n = parseInt(id, 10);
    const mid = Math.floor(n / 1000) % 1000;
    const lo = n % 1000;
    return `TRIAL-${String(mid).padStart(3, "0")}-${String(lo).padStart(3, "0")}`;
  }
  const clean = id.replace(/^0x/, "").toUpperCase();
  return `TRIAL-${clean.slice(0, 3)}-${clean.slice(-3)}`;
}

function cohortLabel(t: Trial): string {
  if (t.criteria?.diagnosis?.length) return t.criteria.diagnosis[0];
  if (t.requiresDiabetes) return "Metabolic cohort";
  const loc = t.location?.trim();
  if (loc) {
    const first = loc.split(/[,/]/)[0].trim();
    return first.length > 2 ? `${first} cohort` : "Primary cohort";
  }
  return `${t.phase || "Study"} review`;
}

function scheduleLabel(trial: Trial): { line: string; concluded: boolean } {
  if (!trial.endTime) return { line: "Date TBD", concluded: false };
  const endSec = parseInt(trial.endTime, 10);
  const end = new Date(endSec * 1000);
  const fmt = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const now = Math.floor(Date.now() / 1000);
  if (endSec < now) {
    return { line: `Concluded ${fmt}`, concluded: true };
  }
  return { line: `Est. ${fmt}`, concluded: false };
}

type RowVariant = "decrypt" | "awaiting";

function resultVariant(trial: Trial): RowVariant {
  const st = trial.applicationStatus;
  if (st === "Pending") return "awaiting";
  if (!trial.hasComputed) return "awaiting";
  if (st === "Rejected") return "awaiting";
  return "decrypt";
}

function ResultRow({
  trial,
  index,
  identityOk,
  decryptedScore,
  onDecrypt,
  isDecrypting,
  sealCertified,
  sealEligible,
}: {
  trial: Trial;
  index: number;
  identityOk: boolean;
  decryptedScore: number | null;
  onDecrypt: () => void;
  isDecrypting: boolean;
  sealCertified: boolean;
  sealEligible: boolean | null;
}) {
  const variant = resultVariant(trial);
  /** Pending = awaiting decrypted inputs; decryptable = handle present; revealed = decryptedScore set */
  let propensityPhaseLabel = "Awaiting ciphertext";
  if (decryptedScore !== null) propensityPhaseLabel = "Revealed locally";
  else if (trial.hasComputed) propensityPhaseLabel = "Decryptable";

  const { line: scheduleLine, concluded } = scheduleLabel(trial);
  const code = formatTrialCode(trial);
  const cohort = cohortLabel(trial);
  const st = trial.applicationStatus;

  const statusBadge =
    !st && trial.hasComputed ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 border border-teal-100 px-2 py-0.5 text-[11px] font-semibold">
        <ShieldCheck className="h-3 w-3" /> Encrypted
      </span>
    ) : st === "Accepted" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
        <CheckCircle2 className="h-3 w-3" /> Accepted
      </span>
    ) : st === "Rejected" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-800 border border-rose-100 px-2 py-0.5 text-[11px] font-semibold">
        Rejected
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 text-[11px] font-semibold">
        <Hourglass className="h-3 w-3" /> Pending
      </span>
    );

  const canDecrypt = variant === "decrypt" && identityOk;
  const showZkRail = !!trial.nullifier && trial.hasComputed;

  const zkBadgeVariant: "certified" | "pending" | "processing" = sealCertified
    ? "certified"
    : "pending";

  const zkSteps = showZkRail
    ? buildZkCertifySteps({
        hasComputed: !!trial.hasComputed,
        decrypted: decryptedScore !== null,
        certifyPhase: "idle",
        isCertified: sealCertified,
      })
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className={cn(
        "rounded-2xl border bg-white shadow-sm overflow-hidden",
        concluded && (st === "Accepted" || (!st && trial.hasComputed))
          ? "border-t-4 border-t-teal-500 border-slate-200/90"
          : "border-slate-200/90"
      )}
    >
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex shrink-0 flex-row items-start gap-4">
          {decryptedScore !== null ? (
            <MatchScoreRing score={decryptedScore} size={92} />
          ) : (
            <div className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              <Lock className="h-8 w-8 text-slate-300" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-teal-50 text-teal-800 border border-teal-100 px-2.5 py-0.5 text-[11px] font-mono font-semibold">
              {code}
            </span>
            <span className="inline-flex rounded-full bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold">
              Propensity · {propensityPhaseLabel}
            </span>
            {statusBadge}
            {showZkRail ? (
              <>
                <ZkCertifyBadge variant={zkBadgeVariant} size="sm" eligible={sealEligible} />
                {!sealCertified ? (
                  <span className="inline-flex rounded-full bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold">
                    Not sealed
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{trial.name}</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
              {scheduleLine}
            </span>
            <span className="inline-flex items-center gap-2">
              <Beaker className="h-4 w-4 shrink-0 text-slate-400" />
              {cohort}
            </span>
          </div>
          {decryptedScore !== null && (
            <p className="text-sm font-semibold text-teal-800">
              Decrypted encrypted propensity: <span className="tabular-nums">{decryptedScore}%</span>
              <span className="block text-[11px] font-normal text-teal-900/75 mt-0.5">
                Deterministic cohort fit compiled to an on-chain ciphertext — revealed only here after authorization.
              </span>
            </p>
          )}
          {showZkRail ? (
            <div className="pt-1">
              <ZkCertifyStepper steps={zkSteps} compact className="mt-1" />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 w-full lg:w-auto lg:min-w-[200px] flex flex-col gap-2 items-stretch lg:items-end">
          {canDecrypt ? (
            <Button
              type="button"
              onClick={onDecrypt}
              disabled={isDecrypting}
              className="w-full lg:w-auto rounded-full bg-teal-600 hover:bg-teal-500 text-white px-8 py-6 h-auto text-sm font-semibold shadow-md gap-2"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Decrypting…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Decrypt result
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              variant="outline"
              className="w-full lg:w-auto rounded-full border-slate-200 bg-slate-100 text-slate-500 px-8 py-6 h-auto text-sm font-semibold cursor-not-allowed gap-2"
            >
              <Lock className="h-4 w-4" /> Awaiting data
            </Button>
          )}

        </div>
      </div>
    </motion.div>
  );
}

export function PatientResultsPage() {
  const { account, signer, provider, chainId } = useWeb3();
  const { trials, loading, refetch } = useTrials(account || undefined);
  const { setRevealedScore, getRevealedScore } = useEncryptedData();
  const engineAddress = getContractAddressForChain("EligibilityEngine");

  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [sealStatus, setSealStatus] = useState<
    Record<string, { certified: boolean; eligible: boolean | null }>
  >({});

  useEffect(() => {
    if (!signer || !account) {
      setIdentityVerified(false);
      setIdentityLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const registry = getMedVaultRegistry(signer);
        const ok = await registry.isRegistered();
        if (!cancelled) setIdentityVerified(ok);
      } catch {
        if (!cancelled) setIdentityVerified(false);
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signer, account]);

  useEffect(() => {
    if (!account || !engineAddress) return;
    const next: Record<string, number> = {};
    for (const t of trials) {
      const s = getRevealedScore(engineAddress, t.id);
      if (s != null) next[t.id] = s;
    }
    setScores(next);
  }, [account, engineAddress, trials, getRevealedScore]);

  // Keep result state fresh when the user returns, without page-level refresh flicker.
  useEffect(() => {
    if (!account) return;
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [account, refetch]);

  const resultTrials = useMemo(() => {
    if (!account) return [];
    const list = trials.filter((t) => t.hasComputed || t.applicationStatus != null);
    return [...list].sort((a, b) => {
      const ea = a.endTime ? parseInt(a.endTime, 10) : 0;
      const eb = b.endTime ? parseInt(b.endTime, 10) : 0;
      return eb - ea;
    });
  }, [trials, account]);

  const handleDecrypt = async (trial: Trial) => {
    if (!signer || !account || !engineAddress) return;
    setDecryptingId(trial.id);
    try {
      const handle = await getEncryptedScoreHandle(signer, account, trial.id, trial.nullifier);
      if (
        !handle ||
        handle === "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        setScores((prev) => ({ ...prev, [trial.id]: 0 }));
        setRevealedScore(engineAddress, trial.id, 0);
        return;
      }
      let score: unknown;
      if (trial.nullifier) {
        const identity = getStoredIdentity();
        if (!identity || !signer.provider) {
          throw new Error("Anonymous result decrypt requires the local Semaphore identity.");
        }
        const ephemeralWallet = getEphemeralSigner(identity, signer.provider);
        score = await reencryptUint8WithEphemeral(ephemeralWallet, engineAddress, handle);
      } else {
        score = await reencryptUint8(engineAddress, account, handle);
      }
      const n = Number(score);
      setScores((prev) => ({ ...prev, [trial.id]: n }));
      setRevealedScore(engineAddress, trial.id, n);
    } catch (e) {
      console.error("Decrypt result failed:", e);
    } finally {
      setDecryptingId(null);
    }
  };

  useEffect(() => {
    if (!provider || !engineAddress || resultTrials.length === 0) return;
    let cancelled = false;
    (async () => {
      const checks = await Promise.all(
        resultTrials
          .filter((t) => t.nullifier)
          .map(async (t) => {
            const status = await fetchCertificationStatus(
              provider,
              engineAddress,
              t.nullifier!,
              t.id
            );
            return [t.id, status] as const;
          })
      );
      if (!cancelled) {
        const next: Record<string, { certified: boolean; eligible: boolean | null }> = {};
        checks.forEach(([id, status]) => {
          next[id] = { certified: status.certified, eligible: status.eligible };
        });
        setSealStatus(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, engineAddress, resultTrials]);

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto pb-20 space-y-8">
        <SectionTopBar
          title="Clinical Results"
          rightContent={
            <Link
              to="/patient/find-trials"
              className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800 transition-colors"
            >
              Find trials
            </Link>
          }
        />
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Access your secured trial outcomes. Data stays shielded until explicitly decrypted by your local key.
        </p>
        <PatientConnectPrompt
          title="Connect to view clinical results"
          description="Encrypted eligibility outcomes and decryption controls appear here after you connect your wallet."
          showBrowseTrials={false}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-8">
      <SectionTopBar
        title="Clinical Results"
        rightContent={
          <div className="flex items-center gap-4">
            <Link
              to="/patient/privacy-tour"
              className="text-xs font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Privacy tour
            </Link>
            <Link
              to="/patient/applications"
              className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800 transition-colors"
            >
              My applications
            </Link>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-900/70">
          {identityLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
          )}
          {identityVerified ? "Identity verified" : account ? "Identity pending" : "Log in"}
        </div>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
          Access your secured trial outcomes. Data remains shielded until explicitly decrypted by your local key.
        </p>
      </div>

      <ZkCertifyExplainer chainId={chainId} />

      {loading && resultTrials.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading secured outcomes…</p>
        </div>
      ) : resultTrials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center">
          <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 mb-1">No outcomes yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Apply to a trial and complete encrypted eligibility checks — your clinical results will show here when
            available.
          </p>
          <Link
            to="/patient/find-trials"
            className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Find trials →
          </Link>
          <div>
            <Link
              to="/patient/privacy-tour"
              className="mt-4 inline-flex text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              60-second privacy tour →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {resultTrials.map((trial, i) => (
            <ResultRow
              key={trial.id}
              trial={trial}
              index={i}
              identityOk={identityVerified}
              decryptedScore={scores[trial.id] ?? (engineAddress ? getRevealedScore(engineAddress, trial.id) : null)}
              onDecrypt={() => handleDecrypt(trial)}
              isDecrypting={decryptingId === trial.id}
              sealCertified={!!sealStatus[trial.id]?.certified}
              sealEligible={sealStatus[trial.id]?.eligible ?? null}
            />
          ))}
        </div>
      )}

      {!identityVerified && account && !identityLoading && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          Register your health profile in Medical Vault to verify identity and enable decryption.
        </p>
      )}
    </div>
  );
}
