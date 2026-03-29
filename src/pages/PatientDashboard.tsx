import { useWeb3 } from "../lib/Web3Context";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { useTrials } from "../hooks/useTrials";
import { VaultCard } from "../components/dashboard/VaultCard";
import { StakingVaultCard } from "../components/dashboard/StakingVaultCard";
import { TrialCard } from "../components/dashboard/TrialCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Upload,
  Settings,
  Activity,
  TrendingUp,
  Clock,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import { motion } from "framer-motion";
import { CipherName } from "../components/ui/CipherName";
import { Link } from "react-router-dom";

/* ─── Animation presets ───────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    delay
  },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, delay },
});

/* ─── Section Header ──────────────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, iconBg, iconColor, title, linkTo, linkLabel, count }: any) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-2xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
          {count !== undefined && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {count}
            </span>
          )}
        </div>
      </div>
      {linkTo && (
        <Link to={linkTo}>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-accent transition-colors group">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}
    </div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, iconColor, iconBg, label, value, tag, tagColor, delay }: any) {
  return (
    <motion.div {...fadeUp(delay)}>
      <div className="group relative flex flex-col gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-2xl ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          {tag && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${tagColor}`}>
              {tag}
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1">{value || "0"}</p>
          <p className="text-xs text-slate-400 font-medium">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export function PatientDashboard() {
  const { account } = useWeb3();
  const { profile, loading: profileLoading, hasProfile } = usePatientProfile(account || undefined);
  const { trials, loading: trialsLoading } = useTrials(account || undefined);

  const appliedTrials = trials.filter(t => t.applicationStatus !== null);
  const eligibleTrials = trials.filter(t => t.hasComputed && !t.isExpired);
  const discoverableTrials = trials.filter(t => !t.isExpired);

  const loading = profileLoading || trialsLoading;

  return (
    <div className="max-w-[1600px] mx-auto pb-24 px-4 md:px-8 lg:px-12 space-y-8">

      {/* ── Hero Banner ── */}
      <motion.section
        {...fadeIn(0)}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a192f] via-[#0d2142] to-[#020617] p-8 md:p-10 lg:p-14 text-white shadow-2xl border border-white/10"
      >
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 h-[28rem] w-[28rem] -translate-y-1/2 translate-x-1/3 rounded-full bg-accent/20 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-48 w-80 translate-y-1/2 rounded-full bg-blue-500/15 blur-[80px] pointer-events-none" />

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />

        {/* Thin top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
          {/* Greeting */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.10] text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-6">
              <Sparkles className="h-3 w-3" />
              FHE Encryption Active
            </div>
            <h1 className="text-4xl md:text-[2.75rem] font-bold tracking-tight leading-[1.15] mb-4">
              Good morning,{" "}
              <span className="relative inline-block font-mono">
                <span className="text-accent">
                  {account ? <CipherName length={10} className="text-4xl md:text-[2.75rem] font-black tracking-tighter" /> : "Patient"}
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent/50 rounded-full origin-left"
                />
              </span>
            </h1>
            <p className="text-slate-300/90 text-base leading-relaxed max-w-lg">
              Your medical vault is fully encrypted and secure. We've found{" "}
              <span className="text-white font-semibold">{discoverableTrials.length} potential matches</span> based on your
              anonymized health profile — your raw data was never exposed to trial sponsors.
            </p>
          </div>

          {/* CTA cluster */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:min-w-[180px]">
            <Link to="/patient/vault">
              <Button className="w-full bg-accent hover:bg-accent/90 text-white font-semibold px-6 rounded-2xl h-11 gap-2 shadow-lg shadow-accent/25 transition-all">
                <Upload className="h-4 w-4" />
                Upload Records
              </Button>
            </Link>
            <Link to="/patient/vault">
              <Button
                variant="outline"
                className="w-full border-white/15 hover:bg-white/[0.07] text-white/90 font-semibold px-6 rounded-2xl h-11 gap-2 transition-all"
              >
                <Settings className="h-4 w-4" />
                Manage Access
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          iconBg="bg-blue-50 dark:bg-blue-950/60"
          iconColor="text-blue-500 dark:text-blue-400"
          label="Medical records stored"
          value={hasProfile ? 1 : 0}
          tag={hasProfile ? "Secured" : "None"}
          tagColor={hasProfile ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60" : "text-slate-500 bg-slate-100 dark:bg-slate-800"}
          delay={0.1}
        />
        <StatCard
          icon={ShieldCheck}
          iconBg="bg-blue-50 dark:bg-blue-950/60"
          iconColor="text-blue-500 dark:text-blue-400"
          label="Active trial consents"
          value={appliedTrials.length}
          tag="Authorized"
          tagColor="text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800"
          delay={0.17}
        />
        <StatCard
          icon={FlaskConical}
          iconBg="bg-violet-50 dark:bg-violet-950/60"
          iconColor="text-violet-500 dark:text-violet-400"
          label="Qualified matches"
          value={eligibleTrials.length}
          tag="Calculated"
          tagColor="text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60"
          delay={0.24}
        />
        <StatCard
          icon={Clock}
          iconBg="bg-amber-50 dark:bg-amber-950/60"
          iconColor="text-amber-500 dark:text-amber-400"
          label="Last vault update"
          value={hasProfile ? "Today" : "Never"}
          tag={hasProfile ? "Recently" : "N/A"}
          tagColor="text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800"
          delay={0.31}
        />
      </div>

      {/* ── Main Content Stack ── */}
      <div className="space-y-12">

        {/* ── Privacy Pulse (Full Width Utility) ── */}
        <motion.div {...fadeUp(0.35)} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-700" />
          <div className="relative p-8 md:p-10 rounded-[2.5rem] bg-[#0a192f]/60 backdrop-blur-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <ShieldCheck className="h-32 w-32 text-blue-400" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
              <div className="flex items-start gap-6">
                <div className="relative shrink-0">
                  <div className="p-4 rounded-2xl bg-blue-400/10 border border-blue-500/20">
                    <ShieldCheck className="h-8 w-8 text-blue-400" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="absolute inset-0 bg-blue-400/20 rounded-full"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Security Engine</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-400/10 text-[9px] font-bold text-blue-400 border border-blue-500/20">FHE ACTIVE</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Global Privacy Pulse</h2>
                  <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                    Your medical data is protected by high-entropy encryption. Only anonymized proofs are shared with trial sponsors.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:min-w-[400px]">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Protection Score</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">99.9</span>
                    <span className="text-slate-500 text-sm font-bold">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ZKP Proofs</p>
                  <p className="text-3xl font-bold text-blue-400">Verified</p>
                </div>
                <div className="space-y-2 hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Network Status</p>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <p className="text-xl font-bold text-white">Sync'd</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Medical Vault Section ── */}
        <section>
          <motion.div {...fadeUp(0.45)}>
            <SectionHeader
              icon={ShieldCheck}
              iconBg="bg-blue-50 dark:bg-blue-950/60"
              iconColor="text-blue-500 dark:text-blue-400"
              title="Medical Vault"
              count={hasProfile ? 1 : 0}
              linkTo="/patient/vault"
              linkLabel="Manage complete vault"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {loading ? (
                <div className="col-span-full py-12 flex justify-center">
                  <Sparkles className="h-8 w-8 text-accent animate-pulse" />
                </div>
              ) : hasProfile ? (
                <motion.div {...fadeUp(0.5)}>
                  <VaultCard report={{
                    id: profile.id,
                    patientAddress: account || "",
                    age: 0,
                    hasDiabetes: false,
                    hbLevel: 0,
                    timestamp: new Date(parseInt(profile.profileUpdatedAt) * 1000).toLocaleString(),
                    txHash: profile.profileTxHash
                  }} />
                </motion.div>
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">No secure records found</p>
                  <Link to="/patient/vault">
                    <Button variant="outline" size="sm">Initialize Vault</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── Staking Vault Section ── */}
        <section>
          <motion.div {...fadeUp(0.55)}>
            <SectionHeader
              icon={TrendingUp}
              iconBg="bg-emerald-50 dark:bg-emerald-950/60"
              iconColor="text-emerald-500 dark:text-emerald-400"
              title="Private Staking"
              linkLabel="Manage staking pools"
            />
            <StakingVaultCard />
          </motion.div>
        </section>

        {/* ── Trial Matches Section ── */}
        <section>
          <motion.div {...fadeUp(0.65)}>
            <SectionHeader
              icon={Zap}
              iconBg="bg-violet-50 dark:bg-violet-950/60"
              iconColor="text-violet-500 dark:text-violet-400"
              title="Top Trial Matches"
              count={discoverableTrials.length}
              linkTo="/patient/trials"
              linkLabel="Browse all opportunities"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trialsLoading ? (
                <div className="col-span-full py-12 flex justify-center">
                  <Sparkles className="h-8 w-8 text-accent animate-pulse" />
                </div>
              ) : discoverableTrials.length > 0 ? (
                discoverableTrials.slice(0, 4).map((trial, i) => (
                  <motion.div key={trial.id} {...fadeUp(i * 0.08 + 0.7)}>
                    <TrialCard trial={trial} />
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-slate-500 italic">
                  No trials matching your profile yet.
                </div>
              )}
            </div>

            <Link to="/patient/trials" className="block mt-8">
              <motion.button
                {...fadeUp(0.95)}
                className="group w-full py-5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:text-accent hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-3 text-base font-bold"
              >
                View and Apply to All {discoverableTrials.length} Matches
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1.5 transition-transform" />
              </motion.button>
            </Link>
          </motion.div>
        </section>

      </div>
    </div>
  );
}
