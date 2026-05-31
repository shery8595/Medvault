import { useMemo } from 'react';
import { useSubgraph } from './useSubgraph';
import { isSponsorVisibleAnonymousStatus } from '../lib/anonymousApplicationStatus';
import { useWeb3 } from '../lib/Web3Context';
import {
  buildDonutFromStatuses,
  buildFunnelStats,
  buildSparkline,
  buildTrialTableRows,
  buildWeeklyPerformanceSeries,
  collectTimelineEvents,
  countTrialMatches,
  type DonutSlice,
  type FunnelStat,
  type TrialTableRow,
  type WeeklyBucket,
} from '../lib/sponsorChartData';

export type BiasRiskLevel = 'low' | 'watch' | 'high';

export type BiasIndicator = {
  id: string;
  title: string;
  risk: BiasRiskLevel;
  detail: string;
  remediation: string;
};

/**
 * Subgraph stays backward-compatible: only fields present on deployed Studio schemas.
 * (TrialPropensitySignals exists in-repo subgraph for operators who redeploy.)
 */
const GET_SPONSOR_STATS = `
  query GetSponsorStats($sponsor: Bytes!) {
    sponsor(id: $sponsor) {
      id
      name
      trials {
        id
        name
        active
        genderRequirement
        applications {
          id
          status
          updatedAt
        }
        eligibilityResults {
          id
          computedAt
        }
        consents {
          id
        }
        anonymousSubmissions {
          id
          status
          stagedAt
          submittedAt
          statusUpdatedAt
          fhePropensityCommittedAt
        }
        propensitySignals {
          signalCount
        }
      }
    }
  }
`;

/** Portfolio-level aggregates only — no patient-level PHI. */
function buildBiasIndicators(trials: any[]): BiasIndicator[] {
  const list = trials ?? [];
  if (list.length === 0) {
    return [];
  }

  let totalApps = 0;
  let totalEligible = 0;
  let acceptedApps = 0;
  let rejectedApps = 0;
  let anonymousTotal = 0;
  let anonymousStaged = 0;
  let genderRestrictedTrials = 0;
  let activeTrialsLowVolume = 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const STALE_SEC = 5 * 24 * 3600;

  for (const t of list) {
    const apps = t.applications ?? [];
    const elig = t.eligibilityResults ?? [];
    const anon = t.anonymousSubmissions ?? [];

    const anonVisible = anon.filter((a: any) => isSponsorVisibleAnonymousStatus(a.status));
    totalApps += apps.length + anonVisible.length;
    totalEligible += elig.length;

    acceptedApps += apps.filter((a: any) => a.status === 'Accepted').length;
    acceptedApps += anonVisible.filter((a: any) => a.status === 'Accepted').length;
    rejectedApps += apps.filter((a: any) => a.status === 'Rejected').length;
    rejectedApps += anonVisible.filter((a: any) => a.status === 'Rejected').length;

    anonymousTotal += anonVisible.length;
    anonymousStaged += anon.filter((a: any) => a.status === 'Staged').length;

    if (Number(t.genderRequirement) !== 0) genderRestrictedTrials += 1;

    if (t.active && anonVisible.length > 0) {
      const stalePending = anonVisible.filter((a: any) => {
        if (a.status !== 'Pending') return false;
        const ts = Number(a.statusUpdatedAt ?? a.submittedAt ?? a.stagedAt ?? 0);
        return ts > 0 && nowSec - ts > STALE_SEC;
      }).length;
      if (stalePending > 0 && anonVisible.length <= 6) activeTrialsLowVolume += stalePending;
    }
  }

  const indicators: BiasIndicator[] = [];

  if (totalEligible > 5 && totalApps > 0) {
    const ratio = totalApps / totalEligible;
    let risk: BiasRiskLevel = 'low';
    if (ratio < 0.05) risk = 'high';
    else if (ratio < 0.15) risk = 'watch';

    indicators.push({
      id: 'funnel',
      title: 'Eligibility → application funnel',
      risk,
      detail: `Roughly ${(ratio * 100).toFixed(1)}% of indexed eligibility impressions converted to an application (${totalApps} applications vs ${totalEligible} eligibility events). Aggregate only.`,
      remediation:
        risk === 'high'
          ? 'Review trial copy, reimbursement clarity, or clinic burden — disproportionate drop-offs can correlate with accessibility bias.'
          : 'Monitor week-over-week. Sudden divergence between eligibility volume and commits merits protocol review.',
    });
  }

  if (anonymousTotal > 3) {
    const stagedPct = anonymousStaged / anonymousTotal;
    const risk: BiasRiskLevel = stagedPct >= 0.35 ? 'high' : stagedPct >= 0.15 ? 'watch' : 'low';
    indicators.push({
      id: 'anon-staged',
      title: 'Anonymous pipeline staging backlog',
      risk,
      detail: `${anonymousStaged} of ${anonymousTotal} indexed anonymous pipelines are still marked “Staged” (hash-only queue; no PHI).`,
      remediation:
        'High backlog may indicate registry finalization stalls or wallet friction entering the zk flow — verify automation plus user guidance.',
    });
  }

  if (genderRestrictedTrials > 0) {
    const narrow = genderRestrictedTrials >= Math.max(1, Math.floor(list.length / 2));
    indicators.push({
      id: 'gender-restriction',
      title: 'Narrow categorical inclusion rules',
      risk: narrow ? 'watch' : 'low',
      detail: `${genderRestrictedTrials} trial(s) pin gender-coded inclusion rules on-chain — transparency note only; MedVault cannot infer enrollee mix from chain data.`,
      remediation:
        'Pair on-chain eligibility with voluntary diversity reporting off-chain; keep sponsor review discretionary (advisory MVP).',
    });
  }

  const decidedTotal = acceptedApps + rejectedApps;
  if (decidedTotal >= 8) {
    const acceptPct = acceptedApps / decidedTotal;
    const risk: BiasRiskLevel = acceptPct < 0.08 ? 'high' : acceptPct < 0.18 ? 'watch' : 'low';
    indicators.push({
      id: 'acceptance',
      title: 'Sponsor acceptance ratio',
      risk,
      detail: `${(acceptPct * 100).toFixed(1)}% of decided applications marked accepted (${acceptedApps} / ${decidedTotal}).`,
      remediation:
        'Extreme ratios warrant manual policy review — this dashboard cannot determine fairness, only aggregates.',
    });
  }

  if (activeTrialsLowVolume > 3) {
    indicators.push({
      id: 'stale-queue',
      title: 'Aging anonymous commitments',
      risk: 'watch',
      detail: `${activeTrialsLowVolume} long-running Pending/Staged pipelines detected on low-volume trials.`,
      remediation: 'Check relayer and registry delays and sponsor review SLAs.',
    });
  }

  return indicators.slice(0, 6);
}

export function useSponsorDashboard() {
  const { account } = useWeb3();
  const { data, loading, error } = useSubgraph(GET_SPONSOR_STATS, {
    sponsor: account?.toLowerCase() || "0x0000000000000000000000000000000000000000",
  });

  const sponsorData = data?.sponsor;

  const derived = useMemo(() => {
    if (!sponsorData) return null;

    const trials = sponsorData.trials || [];

    const activeTrials = trials.filter((t: any) => t.active).length;
    const walletApplications = trials.flatMap((t: any) =>
      (t.applications || []).map((a: any) => ({
        ...a,
        trialId: t.id,
        trialName: t.name,
        kind: 'wallet',
        timestamp: Number(a.updatedAt ?? 0),
      }))
    );
    const anonymousApplications = trials.flatMap((t: any) =>
      (t.anonymousSubmissions || [])
        .filter((a: any) => isSponsorVisibleAnonymousStatus(a.status))
        .map((a: any) => ({
          ...a,
          trialId: t.id,
          trialName: t.name,
          kind: 'anonymous',
          timestamp: Number(a.statusUpdatedAt ?? a.submittedAt ?? a.stagedAt ?? 0),
        }))
    );
    const allApplications = [...walletApplications, ...anonymousApplications];
    const totalApplications = allApplications.length;
    const pendingApplications = allApplications.filter((a: any) => a.status === 'Pending').length;
    const acceptedApplications = allApplications.filter((a: any) => a.status === 'Accepted').length;
    const rejectedApplications = allApplications.filter((a: any) => a.status === 'Rejected').length;

    const totalWalletEligibility = trials.reduce(
      (acc: number, t: any) => acc + countTrialMatches(t),
      0
    );

    const anonymousApplicants = anonymousApplications.length;

    let totalConsents = 0;
    for (const t of trials) {
      totalConsents += (t.consents ?? []).length;
    }
    const avgMatchRate =
      totalConsents > 0 ? Math.round((totalWalletEligibility / totalConsents) * 100) : 0;

    const biasIndicators = buildBiasIndicators(trials);

    const stagedApplications = allApplications.filter((a: any) => a.status === 'Staged').length;

    const statusDistribution = [
      { name: 'Pending', value: pendingApplications },
      { name: 'Accepted', value: acceptedApplications },
      { name: 'Rejected', value: rejectedApplications },
    ];

    const { applications: appEvents, screened, accepted: accEvents, rejected: rejEvents } =
      collectTimelineEvents(trials);
    const weeklyPerformance = buildWeeklyPerformanceSeries(appEvents, screened, accEvents, rejEvents);
    const appWeekly = weeklyPerformance.map((w) => w.applications);
    const screenedWeekly = weeklyPerformance.map((w) => w.screened);
    const acceptedWeekly = weeklyPerformance.map((w) => w.accepted);

    const donutChart: DonutSlice[] = buildDonutFromStatuses({
      pending: pendingApplications - stagedApplications,
      accepted: acceptedApplications,
      rejected: rejectedApplications,
      staged: stagedApplications,
    });

    const funnelStats: FunnelStat[] = buildFunnelStats(trials);
    const trialTableRows: TrialTableRow[] = buildTrialTableRows(trials);

    const recentActivity = allApplications
      .sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp))
      .slice(0, 5)
      .map((a: any) => ({
        id: a.id,
        status: a.status,
        timestamp: Number(a.timestamp) * 1000,
        patientId: a.kind === 'anonymous' ? `anon-${String(a.nullifier || '').slice(0, 8)}` : a.id.split('-')[0],
        trialName: a.trialName || 'Unknown Trial',
      }));

    return {
      trials,
      activeTrials,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      avgMatchRate,
      statusDistribution,
      recentActivity,
      totalWalletEligibility,
      anonymousApplicants,
      biasIndicators,
      stagedApplications,
      charts: {
        weeklyPerformance,
        donutChart,
        funnelStats,
        trialTableRows,
        kpiSparklines: {
          activeTrials: buildSparkline(weeklyPerformance.map(() => activeTrials)),
          applications: buildSparkline(appWeekly),
          accepted: buildSparkline(acceptedWeekly),
          matchRate: buildSparkline(screenedWeekly.map((s, i) => (appWeekly[i] > 0 ? Math.round((s / appWeekly[i]) * 100) : 0))),
        },
      },
    };
  }, [sponsorData]);

  if (!derived) {
    return {
      stats: {
        totalTrials: 0,
        activeTrials: 0,
        totalApplications: 0,
        pendingApplications: 0,
        acceptedApplications: 0,
        avgMatchRate: 0,
        totalWalletEligibility: 0,
        anonymousApplicants: 0,
      },
      statusDistribution: [],
      recentActivity: [],
      biasIndicators: [] as BiasIndicator[],
      charts: {
        weeklyPerformance: [] as WeeklyBucket[],
        donutChart: [] as DonutSlice[],
        funnelStats: [] as FunnelStat[],
        trialTableRows: [] as TrialTableRow[],
        kpiSparklines: {
          activeTrials: [],
          applications: [],
          accepted: [],
          matchRate: [],
        },
      },
      trials: [],
      loading,
      error,
    };
  }

  const { trials, ...rest } = derived;

  return {
    stats: {
      totalTrials: trials.length,
      activeTrials: rest.activeTrials,
      totalApplications: rest.totalApplications,
      pendingApplications: rest.pendingApplications,
      acceptedApplications: rest.acceptedApplications,
      avgMatchRate: rest.avgMatchRate,
      totalWalletEligibility: rest.totalWalletEligibility,
      anonymousApplicants: rest.anonymousApplicants,
    },
    statusDistribution: rest.statusDistribution,
    recentActivity: rest.recentActivity,
    biasIndicators: rest.biasIndicators,
    charts: rest.charts,
    trials,
    loading,
    error,
  };
}
