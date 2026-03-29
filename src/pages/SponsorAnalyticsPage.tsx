import { AnalyticsCard } from "../components/dashboard/AnalyticsCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts";
import { useSponsorDashboard } from "../hooks/useSponsorDashboard";
import { Sparkles, PieChart as PieIcon, TrendingUp, Users } from "lucide-react";
import { cn } from "../lib/utils";

export function SponsorAnalyticsPage() {
  const { statusDistribution, stats, loading } = useSponsorDashboard();

  // Mock trend data for visualization purposes
  const trendData = [
    { month: 'Jan', matches: Math.round(stats.totalApplications * 0.4), enrollments: Math.round(stats.acceptedApplications * 0.3) },
    { month: 'Feb', matches: Math.round(stats.totalApplications * 0.6), enrollments: Math.round(stats.acceptedApplications * 0.5) },
    { month: 'Mar', matches: Math.round(stats.totalApplications * 0.8), enrollments: Math.round(stats.acceptedApplications * 0.7) },
    { month: 'Apr', matches: stats.totalApplications, enrollments: stats.acceptedApplications },
  ];

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <Sparkles className="h-10 w-10 text-blue-500 animate-pulse" />
          <div className="absolute inset-0 blur-2xl bg-blue-500/20 animate-pulse" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500 animate-pulse">
          Aggregating verified clinical data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative">
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <PieIcon className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-black">
              ◈ Intelligence Hub
            </p>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
            Protocol Analytics
          </h2>
          <p className="text-slate-400 max-w-xl text-[15px] leading-relaxed border-l-2 border-indigo-500/20 pl-5 py-1">
            Real-time cryptographic insights into recruitment flow, participant demographics, and matching efficiency.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnalyticsCard
          title="Protocol Pipeline"
          type="pie"
          data={statusDistribution}
          centerLabel={{ value: stats.totalApplications, label: 'Applications' }}
        />

        <Card className="lg:col-span-2 relative overflow-hidden bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-500 ease-out hover:border-indigo-500/30 hover:shadow-indigo-500/5 group">
          {/* Morphing Background Layer */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out pointer-events-none">
            <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] animate-pulse bg-indigo-500/10" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] animate-pulse bg-blue-500/10 delay-700" />
          </div>

          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
              <CardTitle className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-400 transition-colors">
                Recruitment Efficiency
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="h-[340px] w-full pt-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                    dy={12}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    fontWeight="bold"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#fff'
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingTop: '30px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="matches"
                    stroke="#14B8A6"
                    strokeWidth={4}
                    dot={{ fill: '#14B8A6', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#14B8A6' }}
                    name="Protocol Matches"
                  />
                  <Line
                    type="monotone"
                    dataKey="enrollments"
                    stroke="#6366F1"
                    strokeWidth={4}
                    dot={{ fill: '#6366F1', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#6366F1' }}
                    name="Enrollments"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          {/* Inner Glow Border */}
          <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
        </Card>
      </div>

      {/* ── Metric Summary Footer ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricSummary title="Active Trials" value={stats.activeTrials} sub="Live listing" icon={<Users className="h-4 w-4" />} color="teal" />
        <MetricSummary title="Review Queue" value={stats.pendingApplications} sub="Pending review" icon={<Sparkles className="h-4 w-4" />} color="indigo" />
        <MetricSummary title="Success Rate" value={`${stats.avgMatchRate}%`} sub="Avg eligibility" icon={<TrendingUp className="h-4 w-4" />} color="emerald" />
      </div>
    </div>
  );
}

function MetricSummary({ title, value, sub, icon, color }: { title: string, value: string | number, sub: string, icon: React.ReactNode, color: string }) {
  const colorMap = {
    teal: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <Card className="relative overflow-hidden bg-white/5 border-white/10 backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:-translate-y-1 group p-8">
      <div className="flex flex-col relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn("p-2 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3", colorMap[color as keyof typeof colorMap])}>
            {icon}
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">{title}</span>
        </div>

        <span className="text-4xl font-black text-white tracking-tighter mb-2">{value}</span>

        <div className="flex items-center gap-2">
          <div className={cn("h-1 w-1 rounded-full animate-pulse", color === 'teal' ? 'bg-blue-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500')} />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sub}</span>
        </div>
      </div>

      {/* Subtle Glow */}
      <div className={cn(
        "absolute -bottom-10 -right-10 w-24 h-24 blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity duration-700",
        color === 'teal' ? 'bg-blue-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'
      )} />
    </Card>
  );
}
