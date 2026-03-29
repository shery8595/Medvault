import React from "react";
import { MedicalReport } from "../../types";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Eye,
  Activity,
  Fingerprint,
  Clock,
  Hash,
  ExternalLink,
  Cpu,
  Layers,
} from "lucide-react";

interface VaultCardProps {
  report: MedicalReport;
}

const EncryptedField: React.FC<{ label: string; delay?: number }> = ({ label, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, delay }}
    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-blue-900/20 border border-blue-800/20"
  >
    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-1.5">
      <Lock className="h-2.5 w-2.5 text-blue-400/70" />
      <span className="text-[10px] font-mono text-blue-400/80 tracking-tight">FHE-SEALED</span>
    </div>
  </motion.div>
);

export const VaultCard: React.FC<VaultCardProps> = ({ report }) => {
  const shortTx = report.txHash
    ? `${report.txHash.slice(0, 6)}…${report.txHash.slice(-4)}`
    : "—";
  const etherscanUrl = report.txHash
    ? `https://sepolia.etherscan.io/tx/${report.txHash}`
    : "#";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-[2rem] border border-blue-800/20 bg-gradient-to-br from-[#0a192f] via-[#0d2142] to-[#020617] shadow-2xl shadow-blue-900/10"
    >
      {/* ── Animated background decorations ── */}
      <div className="absolute top-0 right-0 h-72 w-72 -translate-y-1/3 translate-x-1/4 rounded-full bg-blue-500/[0.06] blur-[80px] pointer-events-none transition-all group-hover:bg-blue-500/[0.1]" />
      <div className="absolute bottom-0 left-0 h-56 w-56 translate-y-1/3 -translate-x-1/4 rounded-full bg-blue-500/[0.05] blur-[80px] pointer-events-none transition-all group-hover:bg-blue-500/[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.04),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 p-7">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-7">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 backdrop-blur-sm">
                <Fingerprint className="h-7 w-7 text-blue-400" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#0a192f] shadow-[0_0_10px_rgba(52,211,153,0.5)]"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Encrypted Health Record</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">FHE-Protected Medical Data</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Secured</span>
          </div>
        </div>

        {/* ── Encrypted Fields Grid ── */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <EncryptedField label="Age" delay={0.1} />
          <EncryptedField label="Gender" delay={0.15} />
          <EncryptedField label="Weight" delay={0.2} />
          <EncryptedField label="Height" delay={0.25} />
          <EncryptedField label="Diabetes" delay={0.3} />
          <EncryptedField label="HB Level" delay={0.35} />
          <EncryptedField label="Smoker" delay={0.4} />
          <EncryptedField label="Blood Pressure" delay={0.45} />
        </div>

        {/* ── Security Pulse Bar ── */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-950/40 border border-blue-900/20 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Cpu className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300">Security Pulse</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1, ease: "easeInOut" }}
                className="w-[3px] h-4 rounded-full bg-blue-400"
              />
            ))}
          </div>
        </div>

        {/* ── Metadata Footer ── */}
        <div className="flex items-center justify-between pt-5 border-t border-blue-900/40">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-3 w-3" />
              <span className="text-[11px] font-medium">{report.timestamp || "—"}</span>
            </div>
            <a
              href={etherscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-500 hover:text-blue-400 transition-colors group/link"
            >
              <Hash className="h-3 w-3" />
              <span className="text-[11px] font-mono">{shortTx}</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-500/90 to-blue-600/90 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/20 transition-all">
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 border border-blue-800/30 bg-blue-900/10 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all">
              <Activity className="h-3.5 w-3.5" /> Audit
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
