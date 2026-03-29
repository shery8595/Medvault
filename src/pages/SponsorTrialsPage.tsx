import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Plus,
  Search,
  Filter,
  FlaskConical,
  Sparkles,
  Activity,
  Target,
  Users,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { useTrials } from "../hooks/useTrials";
import { useMatches } from "../hooks/useMatches";
import { TrialCard } from "../components/dashboard/TrialCard";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    delay
  },
});

/* ─── Summary Stat ────────────────────────────────────────────────────────── */
function SummaryStat({
  icon: Icon,
  label,
  value,
  iconColor,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor: string;
  delay: number;
}) {
  return (
    <motion.div
      {...fadeUp(delay)}
      className="group relative overflow-hidden px-6 py-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1"
    >
      {/* Glow Layer */}
      <div
        className="absolute -top-10 -right-10 w-24 h-24 blur-[40px] opacity-0 group-hover:opacity-20 transition-opacity duration-700"
        style={{ backgroundColor: iconColor }}
      />

      <div className="flex items-center gap-5 relative z-10">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
          style={{
            background: `${iconColor}15`,
            border: `1px solid ${iconColor}25`,
            boxShadow: `0 0 20px -5px ${iconColor}40`
          }}
        >
          <Icon className="h-6 w-6" style={{ color: iconColor }} />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white leading-none tracking-tighter">{value}</span>
            <div className={`h-1 w-1 rounded-full animate-pulse`} style={{ backgroundColor: iconColor, boxShadow: `0 0 8px ${iconColor}` }} />
          </div>
        </div>
      </div>

      {/* Inner Glow border */}
      <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export function SponsorTrialsPage() {
  const { account } = useWeb3();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const { trials, loading: trialsLoading } = useTrials(account || undefined, account || undefined);
  const { matches, loading: matchesLoading } = useMatches(account || undefined);

  const filteredTrials = trials.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phase.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = trials.filter(
    (t) => t.active
  ).length;

  const totalMatches = trials.reduce((acc, t) => acc + (t.matchCount || 0), 0);
  const loading = trialsLoading || matchesLoading;

  return (
    <div className="space-y-10 pb-16 relative">
      <div className="relative z-10">
        {/* ═══ Page Header ═══ */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-400 font-black">
                ◈ Sponsor Console
              </p>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
              Active Protocols
            </h2>
            <p className="text-slate-400 max-w-xl text-[15px] leading-relaxed border-l-2 border-blue-500/20 pl-5 py-1">
              Monitor and manage your cryptographically verified clinical protocols across the network.
            </p>
          </div>

          <Link to="/sponsor/trials/create">
            <button
              className="flex items-center gap-2.5 font-mono text-[11px] font-black uppercase tracking-widest px-6 py-4 rounded-2xl transition-all duration-300 hover:brightness-110 shrink-0 shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] bg-blue-600 hover:bg-blue-700 text-white group"
            >
              <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              New Protocol
            </button>
          </Link>
        </div>

        {/* ═══ Summary Stats Bar ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <SummaryStat icon={Activity} label="Live Tracks" value={activeCount} iconColor="#3b82f6" delay={0.05} />
          <SummaryStat icon={Target} label="Total Matches" value={totalMatches} iconColor="#6366f1" delay={0.1} />
          <SummaryStat icon={Users} label="Total Protocols" value={trials.length} iconColor="#f59e0b" delay={0.15} />
        </div>

        {/* ═══ Layout Grid ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-8">
            {/* ═══ Search & Filter Bar ═══ */}
            <motion.div {...fadeUp(0.2)} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
                  style={{ color: "#3b82f6" }}
                />
                <input
                  type="text"
                  placeholder="Search by name, phase, or ID..."
                  className="w-full h-14 pl-12 pr-4 rounded-2xl font-mono text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all bg-white/5 border border-white/10 backdrop-blur-md focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`flex items-center gap-2 h-14 px-6 rounded-2xl font-mono text-xs uppercase tracking-widest font-bold transition-all duration-300 border backdrop-blur-md ${filterOpen
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                  }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${filterOpen ? "rotate-180" : ""}`}
                />
              </button>
            </motion.div>

            {/* ═══ Trials List ═══ */}
            <div className="space-y-4">
              {loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    <Sparkles className="h-6 w-6 animate-pulse" style={{ color: "#3b82f6" }} />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-widest text-slate-600">
                    Loading protocols...
                  </p>
                </div>
              ) : filteredTrials.length > 0 ? (
                filteredTrials.map((trial, i) => (
                  <TrialCard key={trial.id} trial={trial} index={i} variant="glass" />
                ))
              ) : (
                <motion.div
                  {...fadeUp(0.1)}
                  className="flex flex-col items-center justify-center py-32 rounded-2xl text-center"
                  style={{
                    background: "rgba(10,22,40,0.5)",
                    border: "1px dashed rgba(59,130,246,0.12)",
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: "rgba(59,130,246,0.06)",
                      border: "1px solid rgba(59,130,246,0.12)",
                    }}
                  >
                    <FlaskConical className="h-7 w-7 text-slate-700" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No protocols found</h3>
                  <p className="font-mono text-xs text-slate-600 mb-6 max-w-xs">
                    {searchQuery
                      ? `No trials matching "${searchQuery}"`
                      : "No active protocols registered yet."}
                  </p>
                  {!searchQuery && (
                    <Link to="/sponsor/trials/create">
                      <button
                        className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-xl transition-all hover:brightness-110"
                        style={{
                          background: "rgba(59, 130, 246, 0.1)",
                          border: "1px solid rgba(59, 130, 246, 0.2)",
                          color: "#3b82f6",
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Create First Protocol
                      </button>
                    </Link>
                  )}
                </motion.div>
              )}
            </div>

            {/* ── Result count ── */}
            {!loading && filteredTrials.length > 0 && (
              <motion.p
                {...fadeUp(0.3)}
                className="font-mono text-[10px] uppercase tracking-widest text-slate-700 text-center mt-8"
              >
                {filteredTrials.length} protocol{filteredTrials.length !== 1 ? "s" : ""} displayed
              </motion.p>
            )}
          </div>

          {/* ═══ Right Sidebar: Protocol Insights ═══ */}
          <aside className="hidden lg:block space-y-6">
            <motion.div
              {...fadeUp(0.4)}
              className="group relative overflow-hidden p-7 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full group-hover:bg-blue-500/10 transition-colors" />
              <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-blue-400 mb-6 font-black">
                Protocol Insights
              </h4>
              <div className="space-y-5">
                <div className="flex justify-between items-center group/item cursor-help">
                  <span className="text-xs text-slate-500 font-mono group-hover/item:text-slate-400 transition-colors">Network Health</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-4 w-1 rounded-full transition-all duration-500 ${i <= 4 ? 'bg-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-slate-800'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                  <span className="text-[11px] text-slate-500 font-mono">Sync Status</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <span className="text-xs font-black text-blue-400 font-mono uppercase tracking-[0.1em]">Live</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              {...fadeUp(0.5)}
              className="group relative overflow-hidden p-7 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full group-hover:bg-indigo-500/15 transition-colors" />
              <h4 className="font-mono text-xs uppercase tracking-[0.25em] text-indigo-400 mb-6 font-black">
                Velocity
              </h4>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-4xl font-black text-white tracking-tighter transition-transform duration-500 group-hover:scale-110 origin-left">+12.4%</p>
                <div className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
                  WEEKLY
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed font-medium">
                Overall patient match increase this week across active protocols.
              </p>
            </motion.div>

            <motion.div
              {...fadeUp(0.6)}
              className="p-8 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-blue-500/30 transition-all duration-500 bg-white/[0.02]"
            >
              <Sparkles className="h-6 w-6 text-slate-700 mb-4 group-hover:text-blue-400/50 group-hover:scale-110 transition-all duration-500" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] font-black group-hover:text-slate-400 transition-colors">
                Unlock Pro Analytics
              </p>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
}
