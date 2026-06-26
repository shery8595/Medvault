import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  ShieldCheck,
  Search,
  Clock,
  ArrowRight,
  FlaskConical,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Database,
  ChevronRight,
  Activity,
  BarChart3,
  History,
} from "lucide-react";
import { PatientDashboardHero } from "../components/dashboard/PatientDashboardHero";
import { IndexerHealthBanner } from "../components/observability/IndexerHealthBanner";
import { useWeb3 } from "../lib/Web3Context";
import { emphasizeSparklineValues, pronouncedChartMax } from "../lib/chartScale";
import { useTrials } from "../hooks/useTrials";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { usePatientDashboard } from "../hooks/usePatientDashboard";
import { formatPhaseBadge, formatTrialDurationLabel, trialDiscoverDescription } from "../lib/trialDisplay";
import { cn } from "../lib/utils";

const TEAL = "#0d9488";
const CYAN = "#0891b2";
const VIOLET = "#6366f1";

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 15px -3px rgb(15 23 42 / 0.08)",
  fontSize: "12px",
  fontWeight: 600,
  color: "#1e293b",
  padding: "10px 12px",
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
      <BarChart3 className="mb-2 h-6 w-6 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function formatEventTime(ts: number) {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const eventTypeStyles = {
  application: "bg-violet-50 text-violet-700 ring-violet-100",
  eligibility: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  consent: "bg-teal-50 text-teal-700 ring-teal-100",
} as const;

const cardShell =
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.05)]";

const metricThemes = {
  teal: {
    iconBg: "from-teal-500/15 to-teal-600/8 text-teal-600 ring-teal-200/60",
    accent: TEAL,
    glow: "bg-teal-400/[0.12]",
    footer: "text-teal-700 group-hover:text-teal-800",
  },
  cyan: {
    iconBg: "from-cyan-500/15 to-cyan-600/8 text-cyan-600 ring-cyan-200/60",
    accent: CYAN,
    glow: "bg-cyan-400/[0.12]",
    footer: "text-cyan-700 group-hover:text-cyan-800",
  },
  violet: {
    iconBg: "from-violet-500/15 to-violet-600/8 text-violet-600 ring-violet-200/60",
    accent: VIOLET,
    glow: "bg-violet-400/[0.12]",
    footer: "text-violet-700 group-hover:text-violet-800",
  },
} as const;

function sparkDelta(data: number[]) {
  if (data.length < 2) return { delta: 0, thisWeek: data[data.length - 1] ?? 0 };
  const thisWeek = data[data.length - 1] ?? 0;
  const lastWeek = data[data.length - 2] ?? 0;
  return { delta: thisWeek - lastWeek, thisWeek };
}

function MetricSparkline({ data, color }: { data: number[]; color: string }) {
  const displayData = emphasizeSparklineValues(data);
  const yMax = pronouncedChartMax(displayData, 4);
  const chartData = displayData.map((v, i) => ({ i, v }));
  const hasSignal = data.some((v) => v > 0);

  if (!hasSignal) {
    return (
      <div className="flex h-11 items-end gap-1">
        {data.map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-slate-100"
            style={{ height: `${8 + (i % 3) * 4}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, yMax]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#spark-${color.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricCard({
  title,
  value,
  icon,
  tint,
  href,
  caption,
  footerLabel,
  sparkline,
  connected = true,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tint: keyof typeof metricThemes;
  href: string;
  caption: string;
  footerLabel: string;
  sparkline: number[];
  connected?: boolean;
}) {
  const theme = metricThemes[tint];
  const { delta, thisWeek } = sparkDelta(sparkline);
  const displayValue = connected ? value : "—";

  const inner = (
      <div
        className={cn(
          `${cardShell} relative flex h-full flex-col overflow-hidden transition-all duration-200`,
          connected && "group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.12)]",
          !connected && "opacity-[0.92]"
        )}
      >
        <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl", theme.glow)} />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent transition-opacity",
            connected ? "opacity-0 group-hover:opacity-100" : "opacity-0"
          )}
          style={{ color: theme.accent }}
        />

        <div className="relative flex flex-1 flex-col p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 shadow-sm transition-transform",
                theme.iconBg,
                connected && "group-hover:scale-105"
              )}
            >
              {icon}
            </div>
            <span className="pt-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {title}
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-4xl font-semibold tabular-nums leading-none tracking-tight text-slate-900">
                {displayValue}
              </p>
              <p className="mt-2 max-w-[140px] text-xs leading-snug text-slate-500">{caption}</p>
            </div>
            <div className="w-[44%] min-w-[88px] max-w-[120px]">
              <MetricSparkline data={connected ? sparkline : [0, 0, 0, 0]} color={theme.accent} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-[10px] font-medium text-slate-400">
              {connected ? (
                thisWeek > 0 ? (
                  <>
                    <span className="font-semibold text-slate-600">{thisWeek}</span> this week
                    {delta !== 0 && (
                      <span className={cn("ml-1.5 font-semibold", delta > 0 ? "text-emerald-600" : "text-rose-500")}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </>
                ) : (
                  "No activity this week"
                )
              ) : (
                "Connect wallet to unlock"
              )}
            </span>
            {connected ? (
              <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold transition-colors", theme.footer)}>
                {footerLabel}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
  );

  if (!connected) {
    return <div className="h-full">{inner}</div>;
  }

  return (
    <Link to={href} className="group block h-full">
      {inner}
    </Link>
  );
}

const statusStyles = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  Accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Rejected: "border-rose-200 bg-rose-50 text-rose-800",
} as const;

function TrialPreviewCard({ trial }: { trial: ReturnType<typeof useTrials>["trials"][number] }) {
  const sponsorDisplay = trial.sponsor.name.startsWith("0x")
    ? `${trial.sponsor.name.slice(0, 6)}…${trial.sponsor.name.slice(-4)}`
    : trial.sponsor.name;
  const applied = trial.applicationStatus != null;
  const description = trialDiscoverDescription(trial);

  return (
    <article
      className={`${cardShell} group overflow-hidden transition-all duration-200 hover:shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)]`}
    >
      <div className="flex flex-col lg:flex-row">
        <div className="relative flex-1 p-5 md:p-6">
          <div className="pointer-events-none absolute left-0 top-5 bottom-5 w-1 rounded-r-full bg-gradient-to-b from-teal-400 to-cyan-500 opacity-80" />
          <div className="pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {formatPhaseBadge(trial)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
                <ShieldCheck className="h-3 w-3" />
                ZK Protected
              </span>
              {applied && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-3 w-3" />
                  {trial.applicationStatus}
                </span>
              )}
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-slate-900 group-hover:text-teal-800 transition-colors">
              {trial.name}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sponsor</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">{sponsorDisplay}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Duration</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatTrialDurationLabel(trial)}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600/80">Compensation</p>
                <p className="mt-0.5 truncate text-xs font-semibold font-mono text-teal-800">
                  {trial.compensation || "TBD"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-slate-100 bg-slate-50/40 p-5 lg:w-52 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{trial.location?.trim() || "Multiple sites"}</span>
          </div>
          <Link
            to="/patient/find-trials"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              applied
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-teal-700 text-white shadow-sm hover:bg-teal-600"
            )}
          >
            {applied ? "View trial" : "Apply anonymously"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PatientDashboard() {
  const { account, connect, isConnecting, error: connectError } = useWeb3();
  const { trials, loading } = useTrials(account || undefined);
  const { hasProfile, loading: profileLoading } = usePatientProfile(account || undefined);
  const {
    activitySeries,
    hasActivity,
    recentEvents,
    stats: dashStats,
    loading: dashLoading,
  } = usePatientDashboard(account || undefined);

  const isConnected = Boolean(account);

  /** Wallet-only: ignore local anonymous trial state until the user connects. */
  const discoverableTrials = useMemo(
    () => (isConnected ? trials.filter((trial) => !trial.isExpired) : trials.filter((trial) => !trial.isExpired && trial.active)),
    [isConnected, trials]
  );
  const appliedTrials = useMemo(
    () => (isConnected ? trials.filter((trial) => trial.applicationStatus !== null) : []),
    [isConnected, trials]
  );
  const pendingResults = isConnected
    ? appliedTrials.filter((trial) => trial.applicationStatus === "Pending").length
    : 0;
  const acceptedCount = isConnected
    ? appliedTrials.filter((trial) => trial.applicationStatus === "Accepted").length
    : 0;
  const topTrials = discoverableTrials.slice(0, 3);
  const recentApplications = appliedTrials.slice(0, 5);

  const statusPieData = useMemo(() => {
    const counts = { Pending: 0, Accepted: 0, Rejected: 0 };
    for (const trial of appliedTrials) {
      const status = trial.applicationStatus;
      if (status && status in counts) counts[status] += 1;
    }
    return [
      { name: "Pending", value: counts.Pending, fill: "#d97706" },
      { name: "Accepted", value: counts.Accepted, fill: "#059669" },
      { name: "Rejected", value: counts.Rejected, fill: "#e11d48" },
    ].filter((d) => d.value > 0);
  }, [appliedTrials]);

  const funnelDisplay = useMemo(() => {
    const eligibility = Math.max(dashStats.totalEligibility, trials.filter((t) => t.hasComputed).length);
    return [
      { stage: "Consents", count: dashStats.totalConsents, fill: TEAL },
      { stage: "Eligibility", count: eligibility, fill: CYAN },
      { stage: "Applications", count: Math.max(dashStats.totalApplications, appliedTrials.length), fill: VIOLET },
      { stage: "Accepted", count: acceptedCount, fill: "#059669" },
    ];
  }, [dashStats, trials, appliedTrials.length, acceptedCount]);

  const appSparkline = useMemo(() => activitySeries.map((w) => w.applications), [activitySeries]);
  const matchSparkline = useMemo(() => activitySeries.map((w) => w.eligibility), [activitySeries]);
  const pendingSparkline = useMemo(
    () => activitySeries.map((w) => w.applications),
    [activitySeries]
  );

  const activityChartMax = useMemo(() => {
    const vals: number[] = [];
    for (const w of activitySeries) {
      vals.push(w.applications, w.eligibility, w.consents);
    }
    return pronouncedChartMax(vals, 5);
  }, [activitySeries]);

  const funnelChartMax = useMemo(
    () => pronouncedChartMax(funnelDisplay.map((f) => f.count), 4),
    [funnelDisplay]
  );

  const applicationCaption = !isConnected
    ? "Connect wallet to see your applications"
    : appliedTrials.length === 0
      ? "No trial submissions yet"
      : acceptedCount > 0
        ? `${acceptedCount} accepted${pendingResults > 0 ? ` · ${pendingResults} pending` : ""}`
        : pendingResults > 0
          ? `${pendingResults} awaiting sponsor review`
          : `${appliedTrials.length} submitted — view outcomes`;

  const trialsCaption = !isConnected
    ? discoverableTrials.length === 0
      ? "Log in to browse recruiting trials"
      : `${discoverableTrials.length} open protocol${discoverableTrials.length !== 1 ? "s" : ""} on the network`
    : discoverableTrials.length === 0
      ? "No open protocols right now"
      : `${discoverableTrials.length} recruiting · encrypted match ready`;

  const pendingCaption = !isConnected
    ? "Connect wallet to track sponsor reviews"
    : pendingResults === 0
      ? "All caught up — nothing in review"
      : `${pendingResults} sponsor review${pendingResults !== 1 ? "s" : ""} in progress`;

  const nextStep = !account
    ? { label: "Log in to get started", href: null as string | null, action: "connect" as const }
    : !hasProfile && !profileLoading
      ? { label: "Set up your medical vault", href: "/patient/medical-vault", action: "link" as const }
      : appliedTrials.length === 0
        ? { label: "Browse open trials", href: "/patient/find-trials", action: "link" as const }
        : pendingResults > 0
          ? { label: "Check pending applications", href: "/patient/applications", action: "link" as const }
          : { label: "Find more trials", href: "/patient/find-trials", action: "link" as const };

  return (
    <div className="space-y-8 pb-12">
      <PatientDashboardHero
        account={account ?? undefined}
        connect={connect}
        isConnecting={isConnecting}
        connectError={connectError}
        nextStep={nextStep}
      />

      <IndexerHealthBanner />

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-5">
        <MetricCard
          title="Applications"
          value={appliedTrials.length}
          tint="teal"
          icon={<FlaskConical className="h-5 w-5" strokeWidth={1.8} />}
          href="/patient/applications"
          caption={applicationCaption}
          footerLabel="View all"
          sparkline={appSparkline}
          connected={isConnected}
        />
        <MetricCard
          title="Open trials"
          value={discoverableTrials.length}
          tint="cyan"
          icon={<Search className="h-5 w-5" strokeWidth={1.8} />}
          href="/patient/find-trials"
          caption={trialsCaption}
          footerLabel="Explore"
          sparkline={matchSparkline}
          connected={isConnected}
        />
        <MetricCard
          title="Pending"
          value={pendingResults}
          tint="violet"
          icon={<Clock className="h-5 w-5" strokeWidth={1.8} />}
          href="/patient/applications"
          caption={pendingCaption}
          footerLabel="Check status"
          sparkline={pendingSparkline}
          connected={isConnected}
        />
      </div>

      {/* Analytics */}
      {account && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">Your activity</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Weekly activity */}
            <div className={`${cardShell} lg:col-span-2 overflow-hidden`}>
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">History — last 8 weeks</h3>
                <p className="text-xs text-slate-500">Applications, eligibility checks, and consent events</p>
              </div>
              <div className="h-[260px] p-4 pt-2">
                {dashLoading ? (
                  <div className="h-full animate-pulse rounded-xl bg-slate-100" />
                ) : hasActivity ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activitySeries} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="patientAppGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={VIOLET} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="patientEligGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CYAN} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="patientConsentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis
                        allowDecimals={false}
                        domain={[0, activityChartMax]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Area type="monotone" dataKey="applications" name="Applications" stroke={VIOLET} fill="url(#patientAppGrad)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="eligibility" name="Eligibility" stroke={CYAN} fill="url(#patientEligGrad)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="consents" name="Consents" stroke={TEAL} fill="url(#patientConsentGrad)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="Activity will appear here as you match and apply" />
                )}
              </div>
            </div>

            {/* Application outcomes */}
            <div className={`${cardShell} overflow-hidden`}>
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Application outcomes</h3>
                <p className="text-xs text-slate-500">Status breakdown</p>
              </div>
              <div className="relative h-[260px] p-4">
                {dashLoading && loading ? (
                  <div className="h-full animate-pulse rounded-xl bg-slate-100" />
                ) : statusPieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {statusPieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-semibold tabular-nums text-slate-900">
                        {appliedTrials.length}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Total</span>
                    </div>
                  </>
                ) : (
                  <EmptyChart label="No applications yet" />
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Funnel */}
            <div className={`${cardShell} overflow-hidden`}>
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Engagement funnel</h3>
                <p className="text-xs text-slate-500">Consent → eligibility → apply → accept</p>
              </div>
              <div className="h-[220px] p-4 pt-2">
                {dashLoading ? (
                  <div className="h-full animate-pulse rounded-xl bg-slate-100" />
                ) : funnelDisplay.some((f) => f.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelDisplay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis
                        allowDecimals={false}
                        domain={[0, funnelChartMax]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(241,245,249,0.8)", radius: 6 }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                        {funnelDisplay.map((entry) => (
                          <Cell key={entry.stage} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="Start with vault setup and trial matching" />
                )}
              </div>
            </div>

            {/* Event timeline */}
            <div className={`${cardShell} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recent history</h3>
                  <p className="text-xs text-slate-500">Indexed on-chain events</p>
                </div>
                <History className="h-4 w-4 text-slate-400" />
              </div>
              <div className="max-h-[220px] divide-y divide-slate-100 overflow-y-auto">
                {dashLoading ? (
                  <div className="space-y-3 p-5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                  </div>
                ) : recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{event.label}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1",
                              eventTypeStyles[event.type]
                            )}
                          >
                            {event.type}
                          </span>
                          {event.detail ? (
                            <span className="text-[10px] text-slate-400">{event.detail}</span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
                        {formatEventTime(event.timestamp)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[180px] items-center justify-center px-5 text-center">
                    <p className="text-sm text-slate-500">No indexed events for this wallet yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main content */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
        <section className={`${cardShell} overflow-hidden`}>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-4 md:px-7">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">Trials for you</h2>
              <p className="text-xs text-slate-500">Top matches from your encrypted profile</p>
            </div>
            <Link
              to="/patient/find-trials"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-4 p-5 md:p-6">
            {loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100/80" />
              ))
            ) : !isConnected ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                  <ShieldCheck className="h-6 w-6 text-teal-600" />
                </div>
                <p className="mt-4 font-display font-semibold text-slate-900">Connect your wallet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                  Your trial matches and application history appear here after you log in.
                </p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
                >
                  {isConnecting ? "Connecting…" : "Connect wallet"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {connectError ? <p className="mt-2 text-xs text-rose-600">{connectError}</p> : null}
              </div>
            ) : topTrials.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                  <FlaskConical className="h-6 w-6 text-teal-600" />
                </div>
                <p className="mt-4 font-display font-semibold text-slate-900">No trials to show</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                  {!hasProfile
                    ? "Register your vault profile to unlock encrypted matching."
                    : "Browse the catalog for open protocols."}
                </p>
                <Link
                  to={!hasProfile ? "/patient/medical-vault" : "/patient/find-trials"}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600"
                >
                  {!hasProfile ? "Set up vault" : "Browse trials"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              topTrials.map((trial) => <TrialPreviewCard key={trial.id} trial={trial} />)
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {/* Vault snapshot */}
          <div className={`${cardShell} overflow-hidden`}>
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">Vault</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                    hasProfile
                      ? "bg-emerald-50 text-emerald-600 ring-emerald-200/60"
                      : "bg-slate-100 text-slate-500 ring-slate-200/80"
                  )}
                >
                  {hasProfile ? <CheckCircle2 className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {profileLoading ? "Checking…" : hasProfile ? "Profile active" : "Not set up"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {hasProfile ? "Ready for matching" : "Upload to match trials"}
                  </p>
                </div>
              </div>
              {isConnected && acceptedCount > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-800">
                    {acceptedCount} accepted application{acceptedCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <Link
                to="/patient/medical-vault"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-50/50"
              >
                Open vault
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Recent applications */}
          <div className={`${cardShell} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">Applications</h3>
              <Link to="/patient/applications" className="text-[11px] font-semibold text-teal-700 hover:text-teal-800">
                All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentApplications.length > 0 ? (
                recentApplications.map((trial) => {
                  const status = trial.applicationStatus!;
                  return (
                    <Link
                      key={trial.id}
                      to="/patient/applications"
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{trial.name}</p>
                        <p className="text-[11px] text-slate-400">{trial.phase || "—"}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                          statusStyles[status]
                        )}
                      >
                        {status}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="px-5 py-8 text-center">
                  <Activity className="mx-auto h-5 w-5 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-500">No applications yet</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
