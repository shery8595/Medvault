import { Link } from "react-router-dom";
import { Card, Flex, Metric, ProgressBar, Text } from "@tremor/react";
import { MetricSparkline, SPARK_COLORS } from "../charts/MetricSparkline";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { useSponsorDashboard } from "../../hooks/useSponsorDashboard";
import { formatRelativeTimeFromUnix } from "../../lib/formatRelativeTime";
import { donutSliceColor, type DonutSlice } from "../../lib/sponsorChartData";
import { sponsorCardHeader, sponsorCardShell, sponsorKpiCardClass } from "../../lib/sponsorUi";
import { cn } from "../../lib/utils";

type DashboardCharts = NonNullable<ReturnType<typeof useSponsorDashboard>["charts"]>;
type DashboardStats = ReturnType<typeof useSponsorDashboard>["stats"];

const valueFormatter = (n: number) => n.toLocaleString();

const WEEKLY_FUNNEL_LEGEND = [
  { name: "Applications", dotClass: "bg-violet-500" },
  { name: "Screened", dotClass: "bg-blue-500" },
  { name: "Accepted", dotClass: "bg-emerald-500" },
] as const;

type KpiKey = "activeTrials" | "applications" | "accepted" | "matchRate";

const KPI_CONFIG: Record<
  KpiKey,
  { title: string; color: "blue" | "violet" | "emerald" | "amber"; icon: React.ReactNode; format?: (v: number) => string }
> = {
  activeTrials: { title: "Active trials", color: "blue", icon: <Activity className="h-5 w-5" /> },
  applications: { title: "Applications", color: "violet", icon: <Users className="h-5 w-5" /> },
  accepted: { title: "Accepted", color: "emerald", icon: <CheckCircle2 className="h-5 w-5" /> },
  matchRate: {
    title: "Match rate",
    color: "amber",
    icon: <TrendingUp className="h-5 w-5" />,
    format: (v) => `${v}%`,
  },
};

export function SponsorKpiRow({
  stats,
  charts,
  loading,
}: {
  stats: DashboardStats;
  charts: DashboardCharts;
  loading: boolean;
}) {
  const values: Record<KpiKey, string | number> = {
    activeTrials: stats.activeTrials,
    applications: stats.totalApplications,
    accepted: stats.acceptedApplications,
    matchRate: stats.avgMatchRate,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {(Object.keys(KPI_CONFIG) as KpiKey[]).map((key) => {
        const cfg = KPI_CONFIG[key];
        const numericValue = Number(values[key]);
        const sparkValues = charts.kpiSparklines[key].map((p) => p.value);
        const display = cfg.format ? cfg.format(numericValue) : values[key];

        return (
          <Card key={key} className={cn(sponsorKpiCardClass(cfg.color), "border-0 p-0 ring-0")}>
            <div className="flex min-h-[9.25rem] flex-col p-5 md:p-6">
              <Flex justifyContent="between" alignItems="start" className="flex-1">
                <div>
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {cfg.title}
                  </Text>
                  {loading ? (
                    <div className="mt-3 h-9 w-16 animate-pulse rounded-lg bg-slate-100" />
                  ) : (
                    <Metric className="mt-2 font-display text-3xl font-semibold text-slate-900 md:text-[2rem]">
                      {display}
                    </Metric>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm",
                    key === "activeTrials" && "bg-blue-50 text-blue-600 ring-blue-200/50",
                    key === "applications" && "bg-violet-50 text-violet-600 ring-violet-200/50",
                    key === "accepted" && "bg-emerald-50 text-emerald-600 ring-emerald-200/50",
                    key === "matchRate" && "bg-amber-50 text-amber-600 ring-amber-200/50",
                  )}
                >
                  {cfg.icon}
                </div>
              </Flex>
              <MetricSparkline
                className="mt-auto shrink-0 pt-3"
                height={36}
                values={sparkValues}
                currentValue={numericValue}
                color={SPARK_COLORS[cfg.color]}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function SponsorPerformanceSection({
  charts,
  stats,
  loading,
}: {
  charts: DashboardCharts;
  stats: DashboardStats;
  loading: boolean;
}) {
  const areaData = charts.weeklyPerformance.map((w) => ({
    date: w.label,
    Applications: w.applications,
    Screened: w.screened,
    Accepted: w.accepted,
  }));

  const hasAreaData = areaData.some((d) => d.Applications + d.Screened + d.Accepted > 0);
  const donutData = charts.donutChart.length
    ? charts.donutChart
    : [{ name: "No data", value: 1 }];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <Card className={cn(sponsorCardShell, "border-0 p-0 ring-0 xl:col-span-8")}>
        <div className={cn(sponsorCardHeader, "px-6 py-5 md:px-8")}>
          <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">
            Trial performance overview
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Weekly recruitment funnel from subgraph events</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {charts.funnelStats.map((row) => (
              <div key={row.key} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold tabular-nums text-slate-900">{loading ? "—" : row.value}</span>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-5 md:px-6 md:py-6">
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">Loading chart…</div>
          ) : !hasAreaData && stats.totalApplications === 0 ? (
            <EmptyChart message="Application and screening activity will appear here as your trials recruit." />
          ) : (
            <div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value: number) => valueFormatter(value)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Applications"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Screened"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Accepted"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div
                className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4"
                aria-hidden
              >
                {WEEKLY_FUNNEL_LEGEND.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", item.dotClass)} />
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className={cn(sponsorCardShell, "border-0 p-0 ring-0 xl:col-span-4")}>
        <div className={cn(sponsorCardHeader, "px-6 py-5")}>
          <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">
            Applications by status
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Portfolio review pipeline</p>
        </div>
        <div className="flex flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-center">
          {loading ? (
            <div className="h-[220px] w-full animate-pulse rounded-xl bg-slate-100" />
          ) : stats.totalApplications === 0 ? (
            <EmptyChart message="No applications indexed yet." compact />
          ) : (
            <>
              <ApplicationsStatusDonut slices={donutData} total={stats.totalApplications} />
              <ul className="min-w-[140px] space-y-2 text-sm">
                {charts.donutChart.map((slice) => {
                  const pct =
                    stats.totalApplications > 0
                      ? Math.round((slice.value / stats.totalApplications) * 100)
                      : 0;
                  return (
                    <li key={slice.name} className="flex items-center justify-between gap-3 text-slate-600">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: donutSliceColor(slice.name) }}
                        />
                        {slice.name}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export function SponsorProtocolsTable({
  rows,
  loading,
}: {
  rows: DashboardCharts["trialTableRows"];
  loading: boolean;
}) {
  const display = rows.slice(0, 6);

  return (
    <section className={cn(sponsorCardShell, "overflow-hidden xl:col-span-8")}>
      <div
        className={cn(
          sponsorCardHeader,
          "flex flex-col gap-1 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6",
        )}
      >
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">Your protocols</h3>
          <p className="mt-0.5 text-xs text-slate-500">Applicants, acceptance, and match rate per trial.</p>
        </div>
        <Link
          to="/sponsor/active-trials"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800 md:mt-0"
        >
          View all trials
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-8">
                Trial
              </th>
              <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phase</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Applicants
              </th>
              <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Accepted
              </th>
              <th className="min-w-[120px] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Match rate
              </th>
              <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-8">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center text-sm text-slate-500 md:px-8">
                  Loading protocols…
                </td>
              </tr>
            ) : display.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <div className="flex flex-col items-center px-6 py-14 text-center md:px-8">
                    <FlaskConical className="mb-4 h-12 w-12 text-slate-300" strokeWidth={1.25} />
                    <p className="font-display text-base font-semibold text-slate-900">No protocols yet</p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      Create a trial to start recruiting and tracking applicants here.
                    </p>
                    <Link
                      to="/sponsor/trials/create"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4" />
                      Create trial
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              display.map((trial) => (
                <tr key={trial.id} className="transition-colors hover:bg-slate-50/90">
                  <td className="px-6 py-4 md:px-8 md:py-5">
                    <Link to={`/sponsor/trials/${trial.id}`} className="group flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900 group-hover:text-teal-800">{trial.name}</span>
                      <span className="font-mono text-[11px] text-slate-500">#{trial.id.slice(-6).toUpperCase()}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 md:py-5">{trial.phase}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-slate-700 md:py-5">{trial.applicants}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-slate-700 md:py-5">{trial.accepted}</td>
                  <td className="px-4 py-4 md:py-5">
                    <div className="flex min-w-[100px] flex-col gap-1">
                      <span className="text-xs font-semibold tabular-nums text-slate-700">{trial.matchRate}%</span>
                      <ProgressBar value={trial.matchRate} color="blue" className="mt-0.5" />
                    </div>
                  </td>
                  <td className="px-4 py-4 md:py-5">
                    <TrialStatusBadge active={trial.active} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 md:px-8 md:py-5">
                    {trial.updatedAtSec > 0
                      ? formatRelativeTimeFromUnix(trial.updatedAtSec)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SponsorDashboardSidebar({
  recentActivity,
  loading,
}: {
  recentActivity: ReturnType<typeof useSponsorDashboard>["recentActivity"];
  loading: boolean;
}) {
  const quickActions = [
    { label: "Create new trial", href: "/sponsor/trials/create", icon: Plus },
    { label: "View patient matches", href: "/sponsor/patient-matches", icon: UserPlus },
    { label: "Protocol analytics", href: "/sponsor/analytics", icon: BarChart3 },
    { label: "Active trials", href: "/sponsor/active-trials", icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col gap-5 xl:col-span-4">
      <Card className={cn(sponsorCardShell, "border-0 p-0 ring-0")}>
        <div className={cn(sponsorCardHeader, "px-5 py-4")}>
          <h3 className="font-display text-base font-semibold text-slate-900">Recent activity</h3>
          <p className="mt-0.5 text-xs text-slate-500">Latest application updates</p>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Loading…</p>
          ) : recentActivity.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No application updates yet.</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3 px-5 py-3.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                    activity.status === "Accepted" && "bg-emerald-50 text-emerald-600 ring-emerald-200/60",
                    activity.status === "Rejected" && "bg-rose-50 text-rose-600 ring-rose-200/60",
                    !["Accepted", "Rejected"].includes(activity.status) &&
                      "bg-slate-100 text-slate-600 ring-slate-200/60",
                  )}
                >
                  {activity.status === "Accepted" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.status === "Accepted"
                      ? "Application accepted"
                      : activity.status === "Rejected"
                        ? "Application declined"
                        : "New application"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{activity.trialName}</p>
                  <p className="mt-1 text-[10px] font-medium tabular-nums text-slate-400">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className={cn(sponsorCardShell, "border-0 p-0 ring-0")}>
        <div className={cn(sponsorCardHeader, "px-5 py-4")}>
          <h3 className="font-display text-base font-semibold text-slate-900">Quick actions</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-slate-200 hover:bg-white"
            >
              <span className="flex items-center gap-2.5">
                <action.icon className="h-4 w-4 text-slate-500" />
                {action.label}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

const donutTooltipStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 15px -3px rgb(15 23 42 / 0.08)",
  fontSize: "12px",
  fontWeight: 600,
  color: "#1e293b",
  padding: "8px 10px",
};

function ApplicationsStatusDonut({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const data = slices.map((slice) => ({
    ...slice,
    fill: donutSliceColor(slice.name),
  }));

  return (
    <div className="relative mx-auto h-44 w-44 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={donutTooltipStyle}
            formatter={(v: number | string) => [valueFormatter(Number(v)), "Count"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-xl font-semibold tabular-nums text-slate-900">{total}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total</span>
      </div>
    </div>
  );
}

function TrialStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        active
          ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} />
      {active ? "Active" : "Draft"}
    </span>
  );
}

function EmptyChart({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center",
        compact ? "min-h-[160px] py-8" : "min-h-[220px] py-12",
      )}
    >
      <p className="max-w-xs text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
