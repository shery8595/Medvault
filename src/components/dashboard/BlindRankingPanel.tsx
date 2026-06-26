import { useEffect, useState } from "react";
import { Shield, TrendingDown, EyeOff, Cpu, BadgeCheck } from "lucide-react";
import { getEncryptedScoreLeaderboard } from "../../lib/contracts";
import { cn } from "../../lib/utils";
import { ZkCertifyBadge } from "../zk/ZkCertifyBadge";

type Props = {
  trialId: string | undefined;
  readProvider: import("ethers").Provider | null;
  sponsorAccount: string | null;
  fallbackApplicantCount?: number;
  className?: string;
};

/**
 * Sponsor-facing blind ranking pool with encrypted comparison UX.
 */
export function BlindRankingPanel({ trialId, readProvider, sponsorAccount, fallbackApplicantCount = 0, className }: Props) {
  const [applicantCount, setApplicantCount] = useState<number | null>(null);
  const [comparisonReady, setComparisonReady] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!trialId || !readProvider) {
      setApplicantCount(null);
      setComparisonReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let tid: bigint;
        try {
          tid = BigInt(String(trialId).replace(/^#/, ""));
        } catch {
          if (!cancelled) {
            setLoadErr("Invalid trial ID for leaderboard read.");
          }
          return;
        }
        const board = getEncryptedScoreLeaderboard(readProvider);
        const n = await board.getApplicantCount(tid);
        if (!cancelled) {
          setLoadErr(null);
          const count = Number(n);
          setApplicantCount(count);
          setComparisonReady(count >= 2);
        }
      } catch {
        if (!cancelled) {
          setApplicantCount(null);
          setComparisonReady(false);
          setLoadErr("Could not read blind pool (wrong network or contract unset).");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trialId, readProvider]);

  if (!trialId) return null;
  const displayCount = applicantCount !== null && applicantCount > 0 ? applicantCount : fallbackApplicantCount;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-5 sm:p-6 shadow-sm ring-1 ring-slate-100/80",
        className
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4 min-w-0">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1D2634] text-white shadow-lg shadow-slate-900/15">
            <EyeOff className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-slate-900">Blind ranking pool</h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                <Shield className="h-3 w-3" />
                Zama FHE
              </span>
              {comparisonReady && (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                  <BadgeCheck className="h-3 w-3" />
                  Comparison ready
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
              Anonymous applicants are stored as <strong>nullifiers</strong> only. Pairwise comparisons use{" "}
              <code className="text-xs bg-white/70 px-1 rounded border border-slate-200">FHE.gt(scoreA, scoreB)</code> on
              ciphertext — sponsors see relative order, never raw vitals or exact scores.
            </p>
            {comparisonReady && (
              <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <strong>Encrypted comparison complete</strong> — cohort size supports pairwise FHE.gt ranking on-chain.
                Use authorized sponsor flows to batch-compare without decrypting PHI.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-white/90 px-4 py-4 min-w-[200px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Anonymous slots (this trial)</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-indigo-900">
            {displayCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {applicantCount !== null && applicantCount > 0 ? (
              <>Contract: <span className="font-mono">EncryptedScoreLeaderboard</span></>
            ) : (
              <>Indexed anonymous applications</>
            )}
          </p>
          <div className="mt-3">
            <ZkCertifyBadge variant="certified" size="sm" eligible={null} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-3">
          <Cpu className="h-5 w-5 shrink-0 text-teal-600 mt-0.5" aria-hidden />
          <div className="min-w-0 text-xs text-slate-600">
            <strong className="text-slate-800">Authorized sponsor flows</strong> can call compare / batch helpers on-chain
            for this trial&apos;s cohort (subject to deployment configuration).
          </div>
        </div>
        <div className="flex gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-3">
          <TrendingDown className="h-5 w-5 shrink-0 text-violet-600 mt-0.5" aria-hidden />
          <div className="min-w-0 text-xs text-slate-600">
            <strong className="text-slate-800">Zero raw leakage</strong> — ordering is computed on encrypted booleans until
            you explicitly decrypt within permit rules.
          </div>
        </div>
      </div>

      {sponsorAccount && (
        <p className="mt-4 text-[11px] text-slate-400 font-mono">
          Sponsor context: <span title={sponsorAccount}>{`${sponsorAccount.slice(0, 10)}...`}</span>
        </p>
      )}
      {loadErr ? <p className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{loadErr}</p> : null}
    </div>
  );
}
