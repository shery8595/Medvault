import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { useSponsorDashboard } from "../hooks/useSponsorDashboard";
import { useWeb3 } from "../lib/Web3Context";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Layers,
  Loader2,
  TrendingUp,
  Users,
  AlertTriangle,
  Scale,
  Landmark,
} from "lucide-react";
import { cn } from "../lib/utils";
import { DONUT_SLICE_FILL, countTrialMatches } from "../lib/sponsorChartData";
import {
  sponsorCardHeader,
  sponsorCardShell,
  sponsorHeroComponentArtClassCompact,
  sponsorHeroDescriptionCompact,
  sponsorHeroEyebrowCompact,
  sponsorHeroLinksCompact,
  sponsorHeroPaddingCompact,
  sponsorHeroTitleCompact,
  sponsorHeroTwoColumnArtGridCompact,
} from "../lib/sponsorUi";
import { SponsorHeroBanner } from "../components/sponsor/SponsorHeroBanner";
import { SponsorHeroCenterArt } from "../components/sponsor/SponsorHeroCenterArt";
import { useAaveYield } from "../hooks/useAaveYield";
import { useStaking } from "../hooks/useStaking";
import { useEncryptedTrialAggregates } from "../hooks/useEncryptedTrialAggregates";

const ACCENT = "#1D2634";
const TEAL = "#0d9488";
const VIOLET = "#6366f1";
const AMBER = "#d97706";
const ROSE = "#e11d48";
const EMERALD = "#059669";

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 15px -3px rgb(15 23 42 / 0.08)",
  fontSize: "12px",
  fontWeight: 600,
  color: "#1e293b",
  padding: "10px 12px",
};

export function SponsorAnalyticsPage() {
  const { account } = useWeb3();
  const {
    stats,
    charts,
    biasIndicators,
    recentActivity,
    trials,
    loading,
    error,
  } = useSponsorDashboard();
  const { apy, loading: apyLoading, source: apySource, error: apyError } = useAaveYield();
  const { stakedBalanceEth, isRevealed, revealBalance, loading: stakingLoading } = useStaking();

  const trialIds = useMemo(() => trials.map((t) => String(t.id)), [trials]);
  const {
    aggregates: fheAggregates,
    loading: fheAggLoading,
    decryptError: fheAggError,
    decryptAggregates,
  } = useEncryptedTrialAggregates(trialIds);

  const pipelineData = useMemo(() => {
    return charts.donutChart.map((slice) => ({
      name: slice.name,
      value: slice.value,
      fill: DONUT_SLICE_FILL[slice.name] ?? ACCENT,
    }));
  }, [charts.donutChart]);

  const pipelineDisplay = useMemo(() => {
    if (pipelineData.length > 0) return pipelineData;
    return [
      { name: "Pending review", value: 0, fill: AMBER },
      { name: "Accepted", value: 0, fill: EMERALD },
      { name: "Rejected", value: 0, fill: ROSE },
    ];
  }, [pipelineData]);

  const weeklySeries = useMemo(
    () =>
      charts.weeklyPerformance.map((w) => ({
        period: w.label,
        applications: w.applications,
        accepted: w.accepted,
        rejected: w.rejected,
      })),
    [charts.weeklyPerformance],
  );

  const trialPerformance = useMemo(() => {
    return [...trials]
      .map((t) => ({
        label: t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name,
        fullName: t.name,
        matches: countTrialMatches(t),
        active: t.active ? 1 : 0,
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 8);
  }, [trials]);

  const yieldProjection = useMemo(() => {
    if (!apy || apyLoading) return null;
    if (!isRevealed || !stakedBalanceEth) return null;
    const p = parseFloat(stakedBalanceEth);
    if (!Number.isFinite(p) || p <= 0) return null;
    const est = (p * apy) / 100;
    return est.toFixed(4);
  }, [apy, apyLoading, isRevealed, stakedBalanceEth]);

  const apyBadge =
    apySource === "protocol"
      ? "Live pool (linear APR snapshot)"
      : apySource === "wrong_chain"
        ? "Reference only — connect Ethereum Sepolia"
        : "Fallback / degraded pool read";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-9 w-9 animate-spin text-[#1D2634]" strokeWidth={2} />
        <p className="text-sm font-medium text-slate-600">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <SectionTopBar
        title="Analytics"
        rightContent={
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-semibold">
            <Link to="/sponsor/dashboard" className="text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
            <Link to="/sponsor/active-trials" className="text-[#1D2634] hover:underline">
              Active protocols
            </Link>
            <Link to="/sponsor/patient-matches" className="text-slate-600 hover:text-slate-900">
              Candidate queue
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some metrics may be incomplete (subgraph unavailable).
        </div>
      ) : null}

      {!loading && account && stats.totalTrials === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No sponsor portfolio indexed yet for this wallet. Create a protocol or confirm your wallet is linked in the
          subgraph.
        </div>
      ) : null}

      <SponsorHeroBanner
        paddingClassName={sponsorHeroPaddingCompact}
        innerClassName={sponsorHeroTwoColumnArtGridCompact}
      >
        <div className="min-w-0 space-y-1">
          <p className={sponsorHeroEyebrowCompact}>Analytics</p>
          <h1 className={sponsorHeroTitleCompact}>Protocol analytics</h1>
          <p className={sponsorHeroDescriptionCompact}>
            Applications, review pipeline, and recruitment performance across your sponsor portfolio.
          </p>
          <div className={sponsorHeroLinksCompact}>
            <Link
              to="/sponsor/active-trials"
              className="inline-flex items-center gap-1 text-teal-700 transition-colors hover:text-teal-800"
            >
              Active protocols
              <span aria-hidden>→</span>
            </Link>
            <span className="text-slate-300">·</span>
            <Link to="/sponsor/patient-matches" className="text-slate-600 transition-colors hover:text-slate-900">
              Candidate queue
            </Link>
          </div>
        </div>
        <SponsorHeroCenterArt
          src="/images/analytics_component.png"
          artClassName={sponsorHeroComponentArtClassCompact}
        />
      </SponsorHeroBanner>

      <Card className={cn(sponsorCardShell, "border-0 overflow-hidden")}>
        <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-700" />
              <div>
                <CardTitle className="font-display text-base font-semibold text-slate-900">
                  Zama FHE encrypted aggregates
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Homomorphic applicant count &amp; average propensity — no per-patient scores on-chain
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void decryptAggregates()}
              disabled={fheAggLoading || trialIds.length === 0}
              className="rounded-lg bg-[#1D2634] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {fheAggLoading ? "Decrypting…" : "Decrypt aggregates"}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {fheAggError ? (
            <p className="text-sm text-amber-800">{fheAggError}</p>
          ) : null}
          {fheAggregates.length === 0 ? (
            <p className="text-sm text-slate-600">
              Click decrypt to load encrypted match counts from <code className="text-xs">EncryptedScoreLeaderboard</code>{" "}
              (requires Zama FHE permit).
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {fheAggregates.map((row) => (
                <li
                  key={row.trialId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">Trial #{row.trialId}</span>
                  {row.error ? (
                    <span className="text-xs text-rose-700">{row.error}</span>
                  ) : (
                    <span className="text-xs text-slate-600">
                      {row.applicantCount ?? "—"} applicants
                      {row.avgScore != null ? ` · avg score ${row.avgScore}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className={cn(sponsorCardShell, "border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-600" />
              <div>
                <CardTitle className="font-display text-base font-semibold text-slate-900">
                  Representation monitoring
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Advisory aggregates only — no patient-level PHI</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {biasIndicators.length === 0 ? (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
                <AlertTriangle className="h-8 w-8 text-slate-300 mb-2" aria-hidden />
                <p className="text-sm font-medium text-slate-700">
                  Insufficient subgraph volume for automated checks
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  As applications and eligibility events accrue we surface funnel, anonymity staging, categorical rule, and
                  acceptance-ratio hints for sponsor reviewers.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {biasIndicators.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm shadow-sm",
                      row.risk === "high" && "border-rose-200 bg-rose-50/95 text-rose-950",
                      row.risk === "watch" && "border-amber-200 bg-amber-50/95 text-amber-950",
                      row.risk === "low" && "border-slate-200 bg-white text-slate-900",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold">{row.title}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          row.risk === "high" && "bg-rose-200/70 text-rose-900",
                          row.risk === "watch" && "bg-amber-200/70 text-amber-900",
                          row.risk === "low" && "bg-slate-200/70 text-slate-800",
                        )}
                      >
                        {row.risk}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-95">{row.detail}</p>
                    <p className="text-[11px] mt-2 text-slate-700/90 font-medium">{row.remediation}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={cn(sponsorCardShell, "border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-600" />
              <div>
                <CardTitle className="font-display text-base font-semibold text-slate-900">Yield KPIs</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{apyBadge}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">Supply APR snapshot</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-teal-700">{apyLoading ? "…" : `${apy}%`}</p>
              <p className="text-[10px] text-slate-500 mt-1">Aave V3 WETH reserve (approximation)</p>
              {apyError ? <p className="text-[10px] text-amber-700 mt-2">{apyError}</p> : null}
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">Revealed stake</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">
                {isRevealed ? stakedBalanceEth : "—"} ETH
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {isRevealed ? (
                  "Decrypted from Private Staking Vault"
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void revealBalance()}
                      disabled={stakingLoading}
                      className="font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-60"
                    >
                      {stakingLoading ? "Decrypting…" : "Reveal stake"}
                    </button>
                    {" · "}
                    <Link to="/sponsor/dashboard" className="font-semibold text-teal-700 hover:text-teal-800">
                      Dashboard vault
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-slate-500">Linear projection</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-violet-800">
                {yieldProjection !== null ? `~${yieldProjection}` : "—"} ETH / yr
              </p>
              <p className="text-[10px] text-slate-500 mt-1">APR × stake (does not compound)</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        <Kpi title="Applications" value={stats.totalApplications} hint="All statuses" />
        <Kpi title="Active trials" value={stats.activeTrials} hint="Live protocols" />
        <Kpi title="Pending review" value={stats.pendingApplications} hint="In queue" />
        <Kpi title="Match rate" value={`${stats.avgMatchRate}%`} hint="Eligibility / consent" />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className={cn(sponsorCardShell, "xl:col-span-4 border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <CardTitle className="font-display text-base font-semibold text-slate-900">Application pipeline</CardTitle>
            <p className="text-xs text-slate-500">Distribution by review status</p>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[280px] w-full">
              {stats.totalApplications === 0 ? (
                <EmptyChart label="No applications yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pipelineDisplay}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={96}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {pipelineDisplay.map((entry, i) => (
                        <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipContentStyle} formatter={(v: number) => [v, "Count"]} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs font-medium text-slate-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(sponsorCardShell, "xl:col-span-8 border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <CardTitle className="font-display text-base font-semibold text-slate-900">Weekly activity</CardTitle>
            <p className="text-xs text-slate-500">Applications and decisions by ISO week (subgraph timestamps)</p>
          </CardHeader>
          <CardContent className="p-5 pt-6">
            <div className="h-[300px] w-full">
              {weeklySeries.every((w) => w.applications === 0 && w.accepted === 0) ? (
                <EmptyChart label="No weekly activity indexed yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklySeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="fillAcc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={VIOLET} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Legend
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(v) => <span className="text-xs font-medium text-slate-600">{v}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      name="Applications"
                      stroke={TEAL}
                      strokeWidth={2}
                      fill="url(#fillApps)"
                    />
                    <Area
                      type="monotone"
                      dataKey="accepted"
                      name="Accepted"
                      stroke={VIOLET}
                      strokeWidth={2}
                      fill="url(#fillAcc)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className={cn(sponsorCardShell, "lg:col-span-2 border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base font-semibold text-slate-900">
                  Matches by protocol
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Wallet eligibility + anonymous FHE applications per trial (subgraph)
                </p>
              </div>
              <Layers className="h-5 w-5 shrink-0 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[320px] w-full">
              {trialPerformance.length === 0 ? (
                <EmptyChart label="Create a protocol to see per-trial performance" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trialPerformance}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={120}
                      tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      formatter={(v: number, _n, p) => [v, p?.payload?.fullName ? "Matches" : ""]}
                      labelFormatter={(_, p) => (p?.[0]?.payload?.fullName as string) || ""}
                    />
                    <Bar dataKey="matches" name="Matches" fill={ACCENT} radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(sponsorCardShell, "border-0 overflow-hidden")}>
          <CardHeader className={cn(sponsorCardHeader, "px-5 py-4")}>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              <CardTitle className="font-display text-base font-semibold text-slate-900">Recent activity</CardTitle>
            </div>
            <p className="text-xs text-slate-500">Latest application updates</p>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">No recent updates.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((row) => (
                  <li key={row.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          row.status === "Accepted" && "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80",
                          row.status === "Rejected" && "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80",
                          row.status === "Pending" && "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
                          !["Accepted", "Rejected", "Pending"].includes(row.status) &&
                            "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                        )}
                      >
                        {row.status}
                      </span>
                      <span className="text-[10px] font-medium tabular-nums text-slate-400">
                        {new Date(row.timestamp).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">{row.trialName}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Insight
          icon={<Users className="h-4 w-4" />}
          title="Active trials"
          value={stats.activeTrials}
          caption="Protocols marked live in the index."
        />
        <Insight
          icon={<TrendingUp className="h-4 w-4" />}
          title="Review queue"
          value={stats.pendingApplications}
          caption="Applications awaiting sponsor decision."
        />
        <Insight
          icon={<BarChart3 className="h-4 w-4" />}
          title="Portfolio size"
          value={stats.totalTrials}
          caption="Total trials under this sponsor wallet."
        />
      </section>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <div
      className={cn(
        sponsorCardShell,
        "border-0 px-4 py-4 md:px-5 md:py-5"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <p className="font-display mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 md:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function Insight({
  icon,
  title,
  value,
  caption,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className={cn(sponsorCardShell, "flex gap-4 border-0 p-5")}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#1D2634] ring-1 ring-slate-200/80">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <p className="font-display mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
