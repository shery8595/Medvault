import { Link } from "react-router-dom";
import { AnalyticsCard } from "../components/dashboard/AnalyticsCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Plus,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { useWeb3 } from "../lib/Web3Context";
import { useSponsorDashboard } from "../hooks/useSponsorDashboard";
import { useTrials } from "../hooks/useTrials";
import { Trial } from "../types";

interface RecentActivity {
  id: string;
  status: string;
  timestamp: number;
  patientId: string;
  trialName: string;
}

export function SponsorDashboard() {
  const { account } = useWeb3();
  const { stats, statusDistribution, recentActivity, loading: statsLoading } = useSponsorDashboard();
  const { trials, loading: trialsLoading } = useTrials(undefined, account || undefined);

  const loading = statsLoading || trialsLoading;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Sponsor Portal
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time trial performance and participant recruitment analytics.
          </p>
        </div>
        <Link to="/sponsor/trials/create">
          <Button size="lg" className="gap-2 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6">
            <Plus className="h-5 w-5" /> Create New Trial
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Trials"
          value={stats.activeTrials}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          description="Live recruitment"
        />
        <MetricCard
          title="Total Applications"
          value={stats.totalApplications}
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          description="All-time matched"
        />
        <MetricCard
          title="Accepted"
          value={stats.acceptedApplications}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          description="Ready for screening"
        />
        <MetricCard
          title="Match Rate"
          value={`${stats.avgMatchRate}%`}
          icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
          description="Avg. eligibility"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Analytics Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" /> Enrollment Hub
            </h3>
            <Link to="/sponsor/analytics" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
              Deep Dive <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              <CardHeader className="pb-2 border-b border-slate-100/50 dark:border-slate-800/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold tracking-tight">Application Pipeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <AnalyticsCard
                    title=""
                    type="pie"
                    data={statusDistribution}
                    centerLabel={{ value: stats.totalApplications, label: 'Applicants' }}
                  />
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {statusDistribution.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div
                          className="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(var(--color))] "
                          style={{ backgroundColor: ['#14B8A6', '#6366F1', '#F43F5E'][idx % 3] }}
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.name}</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <CardHeader className="pb-2 border-b border-slate-100/50 dark:border-slate-800/50 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold tracking-tight">Active Recruitment</CardTitle>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 ">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Real-time</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {trials.length > 0 ? trials.slice(0, 4).map((trial) => (
                    <Link
                      key={trial.id}
                      to={`/sponsor/trials/${trial.id}`}
                      className="group block p-5 hover:bg-white/50 dark:hover:bg-slate-800/30 transition-all duration-500 relative overflow-hidden"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1.5">
                            <span className="text-sm font-black text-slate-900 dark:text-slate-50 group-hover:text-blue-600 transition-colors tracking-tight block">
                              {trial.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] h-4.5 px-2 uppercase font-black tracking-widest text-blue-600 border-blue-500/20 bg-blue-500/5 dark:text-blue-400">
                                {trial.phase}
                              </Badge>
                              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                              <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">#{trial.id.slice(-4).toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tighter transition-transform group-hover:scale-110 origin-right">
                                {(trial.matchCount || 0)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">/ 50</span>
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">Matched</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden p-[1px]">
                            {/* Inner background glow */}
                            <div className="absolute inset-x-0 h-full bg-blue-500/5 animate-pulse" />
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(((trial.matchCount || 0) / 50) * 100, 100)}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)] relative overflow-hidden"
                            >
                              {/* Shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                            </motion.div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3 w-3 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Protocol Capacity</span>
                            </div>
                            <div className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black tracking-tighter">
                              {Math.round(Math.min(((trial.matchCount || 0) / 50) * 100, 100))}% REACHED
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interactive background highlight */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/[0.02] to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </Link>
                  )) : (
                    <div className="py-20 text-center space-y-3">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700">
                        <Activity className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 italic">No recruitment trails active</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="p-4 border-t border-slate-100/50 dark:border-slate-800/50 bg-slate-50/30 dark:bg-transparent">
                <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-slate-500 hover:text-blue-600 gap-2 rounded-xl group/btn">
                  Manage Pipeline <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Side Section: Recent Activity & Info */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" /> Recent Activity
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Live</span>
              </div>
            </div>
            <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                {(recentActivity as RecentActivity[]).length > 0 ? (
                  <div className="relative">
                    {/* Timeline Spine */}
                    <div className="absolute left-[29px] top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-slate-200 dark:via-slate-700 to-transparent" />

                    {(recentActivity as RecentActivity[]).map((activity, i) => {
                      const isAccepted = activity.status === 'Accepted';
                      const isRejected = activity.status === 'Rejected';

                      const statusClasses = isAccepted
                        ? { bg: 'bg-emerald-500', ring: 'ring-emerald-500/20', icon: 'bg-emerald-500 text-white', text: 'text-emerald-500', bgLight: 'bg-emerald-50 dark:bg-emerald-950/30' }
                        : isRejected
                          ? { bg: 'bg-rose-500', ring: 'ring-rose-500/20', icon: 'bg-rose-500 text-white', text: 'text-rose-500', bgLight: 'bg-rose-50 dark:bg-rose-950/30' }
                          : { bg: 'bg-indigo-500', ring: 'ring-indigo-500/20', icon: 'bg-indigo-500 text-white', text: 'text-indigo-500', bgLight: 'bg-indigo-50 dark:bg-indigo-950/30' };

                      // Relative time
                      const timeAgo = (() => {
                        const diff = Math.floor((Date.now() - activity.timestamp) / 1000);
                        if (diff < 60) return 'Just now';
                        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
                        return new Date(activity.timestamp).toLocaleDateString();
                      })();

                      return (
                        <div
                          key={activity.id}
                          className="group relative flex gap-4 p-5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all duration-300 cursor-default"
                        >
                          {/* Timeline node */}
                          <div className="relative z-10 flex-shrink-0">
                            <div className={`h-[18px] w-[18px] rounded-full ${statusClasses.icon} ring-4 ${statusClasses.ring} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-125`}>
                              {isAccepted ? (
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              ) : isRejected ? (
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              ) : (
                                <Clock className="h-2.5 w-2.5" />
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 -mt-0.5">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0 h-5 border ${isAccepted ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800' : isRejected ? 'text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-900/30 dark:border-rose-800' : 'text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800'}`}>
                                {activity.status}
                              </Badge>
                              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{timeAgo}</span>
                            </div>

                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-2 truncate">
                              {activity.trialName}
                            </p>

                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                                <div className="h-2 w-2 rounded-full bg-slate-400/30" />
                                <code className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                  {activity.patientId.slice(0, 6)}···{activity.patientId.slice(-4)}
                                </code>
                              </div>
                              <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.15em]">Patient</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3">
                      <Clock className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">No recent applications</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border-none p-6 relative overflow-hidden rounded-3xl group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />
            <div className="relative z-10">
              <div className="p-2 bg-white/10 w-fit rounded-xl mb-4 backdrop-blur-md">
                <ShieldCheck className="h-6 w-6 text-blue-400" />
              </div>
              <h4 className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-2">FHE Infrastructure Active</h4>
              <p className="text-xl font-bold mb-3 leading-tight tracking-tight">Enterprise Grade Privacy Protection</p>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                MedVault employs Fully Homomorphic Encryption. Patient identities remain shielded until you both securely establish contact.
              </p>
              <Button size="sm" variant="outline" className="text-white border-white/20 hover:bg-white/10 rounded-xl px-4 text-xs font-bold transition-all">
                Security Audit Logs
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, description }: { title: string, value: string | number, icon: React.ReactNode, description: string }) {
  // Determine color theme based on icon/title to match the "Liquid Glass" style
  const isTeal = title.toLowerCase().includes('active');
  const isIndigo = title.toLowerCase().includes('total');
  const isEmerald = title.toLowerCase().includes('accepted');
  const isAmber = title.toLowerCase().includes('rate');

  const glowColor = isTeal ? 'rgba(20, 184, 166, 0.15)' :
    isIndigo ? 'rgba(79, 70, 229, 0.15)' :
      isEmerald ? 'rgba(16, 185, 129, 0.15)' :
        'rgba(245, 158, 11, 0.15)';

  const accentColor = isTeal ? 'bg-blue-500' :
    isIndigo ? 'bg-indigo-500' :
      isEmerald ? 'bg-emerald-500' :
        'bg-amber-500';

  return (
    <Card className="group relative overflow-hidden border-slate-200/40 dark:border-white/10 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl transition-all duration-500 ease-out hover:shadow-2xl hover:shadow-slate-200/20 dark:hover:shadow-black/40 hover:-translate-y-1">
      {/* Morphing Background Layer */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out pointer-events-none">
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] animate-pulse ${accentColor} opacity-20`} />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-200/5 dark:to-white/5" />
      </div>

      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              {title}
            </span>
          </div>
          <div className="relative">
            <div
              className="absolute inset-0 blur-xl opacity-40 group-hover:opacity-80 transition-opacity duration-500"
              style={{ backgroundColor: glowColor.replace('0.15', '0.6') }}
            />
            <div className="relative p-2.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
              {icon}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tighter mb-1.5 transition-all duration-500 group-hover:scale-[1.02] origin-left">
            {value}
          </span>
          <div className="flex items-center gap-2">
            <div className={`h-1 w-1 rounded-full ${accentColor} animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]`} />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{description}</p>
          </div>
        </div>
      </CardContent>

      {/* "Inner Glow" border effect */}
      <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/10 dark:border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}
