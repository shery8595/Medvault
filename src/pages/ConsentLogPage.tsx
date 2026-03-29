import { ConsentTable } from "../components/dashboard/ConsentTable";
import { useState, useMemo } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { useConsent } from "../hooks/useConsent";
import {
  ShieldCheck,
  Clock,
  UserCheck,
  XCircle,
  Search,
  SlidersHorizontal,
  Download,
  ChevronDown,
  Activity,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { ConsentLog } from "../types";

/* ─── Animation helpers ───────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any, delay },
});

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub, subColor, delay }: any) {
  return (
    <motion.div {...fadeUp(delay)}>
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className={`p-3 rounded-2xl shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{value.toString()}</p>
          {sub && (
            <p className={`text-[11px] font-medium mt-1 ${subColor ?? "text-slate-400"}`}>{sub}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Filter Tab ──────────────────────────────────────────────────────────── */
function FilterTab({ label, count, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${active
        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active
            ? "bg-white/20 dark:bg-black/20 text-white dark:text-slate-900"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export function ConsentLogPage() {
  const { account } = useWeb3();
  const { consents, applications, loading, error, refetch } = useConsent(account as any);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  const formattedLogs = useMemo<ConsentLog[]>(() => {
    // Map of trialId -> combined log
    const trialMap = new Map<string, ConsentLog>();

    // Process consents first
    consents.forEach((c: any) => {
      trialMap.set(c.trial.id, {
        id: c.id,
        trialId: c.trial.id,
        trialName: c.trial.name,
        timestamp: new Date(parseInt(c.lastUpdatedAt) * 1000).toLocaleString(),
        rawTimestamp: parseInt(c.lastUpdatedAt),
        txHash: c.txHash,
        status: "Active",
        sponsorName: c.trial.sponsor.name.startsWith('0x')
          ? `${c.trial.sponsor.name.slice(0, 6)}...${c.trial.sponsor.name.slice(-4)}`
          : c.trial.sponsor.name,
        dataShared: ["Medical Profile", "Encrypted Labs"]
      });
    });

    // Merge applications (which have messages and specific statuses)
    applications.forEach((app: any) => {
      const existing = trialMap.get(app.trial.id);
      
      // If the application is newer than the consent (or no consent exists), use its data
      const appTs = parseInt(app.updatedAt);
      if (!existing || appTs >= (existing.rawTimestamp || 0)) {
          const combinedLog: any = {
            id: app.id,
            trialId: app.trial.id,
            trialName: app.trial.name,
            timestamp: new Date(appTs * 1000).toLocaleString(),
            rawTimestamp: appTs,
            txHash: app.txHash,
            status: app.status,
            message: app.message,
            sponsorName: app.trial.sponsor.name.startsWith('0x')
              ? `${app.trial.sponsor.name.slice(0, 6)}...${app.trial.sponsor.name.slice(-4)}`
              : app.trial.sponsor.name,
            // Carry over dataShared if we have it from consent, or use default
            dataShared: existing?.dataShared || ["Full Medical Disclosure"]
          };
          trialMap.set(app.trial.id, combinedLog);
      }
    });

    const logs = Array.from(trialMap.values());
    return logs.sort((a: any, b: any) => b.rawTimestamp - a.rawTimestamp);
  }, [consents, applications]);

  // Derive counts from real data
  const total = formattedLogs.length;
  const active = formattedLogs.filter((l) => l.status === "Active" || l.status === "Accepted").length;
  const revoked = 0;
  const pending = formattedLogs.filter((l) => l.status === "Pending").length;

  const filters = [
    { key: "all", label: "All", count: total },
    { key: "active", label: "Active", count: active },
    { key: "pending", label: "Pending", count: pending },
    { key: "revoked", label: "Revoked", count: revoked },
  ];

  const filteredLogs = useMemo(() => {
    if (activeFilter === "all") return formattedLogs;
    return formattedLogs.filter((l) => {
      const s = l.status?.toLowerCase();
      if (activeFilter === "active") return s === "active" || s === "accepted";
      return s === activeFilter;
    });
  }, [formattedLogs, activeFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading privacy controls…</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto pb-24 px-4 md:px-8 lg:px-12 space-y-8">

      {/* ── Page Header ── */}
      <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
            <Activity className="h-3 w-3" />
            Privacy Controls
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            Consent Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 max-w-md">
            Track and manage who has access to your decrypted medical data. All access is encrypted and auditable.
          </p>
        </div>

        {/* Sync button */}
        <motion.button
          {...fadeUp(0.1)}
          onClick={() => refetch()}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
        >
          <Clock className="h-4 w-4" />
          Sync Records
        </motion.button>
      </motion.div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ShieldCheck}
          iconBg="bg-blue-50 dark:bg-blue-950/60"
          iconColor="text-blue-500 dark:text-blue-400"
          label="Total Logs"
          value={total}
          sub="All time"
          delay={0.1}
        />
        <StatCard
          icon={UserCheck}
          iconBg="bg-emerald-50 dark:bg-emerald-950/60"
          iconColor="text-emerald-500 dark:text-emerald-400"
          label="Active Grants"
          value={active}
          sub="Currently sharing"
          subColor="text-emerald-500 dark:text-emerald-400"
          delay={0.17}
        />
        <StatCard
          icon={Clock}
          iconBg="bg-amber-50 dark:bg-amber-950/60"
          iconColor="text-amber-500 dark:text-amber-400"
          label="Pending"
          value={pending}
          sub="Awaiting approval"
          subColor="text-amber-500 dark:text-amber-400"
          delay={0.24}
        />
        <StatCard
          icon={XCircle}
          iconBg="bg-red-50 dark:bg-red-950/60"
          iconColor="text-red-400 dark:text-red-400"
          label="Revoked"
          value={revoked}
          sub="Access removed"
          delay={0.31}
        />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
          Error loading real-time data: {error.message}. Showing cached results.
        </div>
      )}

      {/* ── Table Panel ── */}
      <motion.div
        {...fadeUp(0.35)}
        className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {filters.map((f) => (
              <FilterTab
                key={f.key}
                label={f.label}
                count={f.count}
                active={activeFilter === f.key}
                onClick={() => setActiveFilter(f.key)}
              />
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-52 pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
            />
          </div>

          {/* Sort dropdown placeholder */}
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-slate-300 dark:hover:border-slate-600 transition shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Sort
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <ConsentTable logs={filteredLogs} searchQuery={search} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600 dark:text-slate-300">{filteredLogs.length}</span> of{" "}
            <span className="font-semibold text-slate-600 dark:text-slate-300">{total}</span> logs
          </p>
          <p className="text-[11px] text-slate-300 dark:text-slate-600 hidden sm:block">
            All access events are cryptographically signed and immutable
          </p>
        </div>
      </motion.div>

    </div>
  );
}
