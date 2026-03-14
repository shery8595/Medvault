import { motion, AnimatePresence } from "framer-motion";
import { useWeb3 } from "../lib/Web3Context";
import { PatientRecordForm } from "../components/dashboard/PatientRecordForm";
import React, { useState } from "react";
import { Portal } from "../components/ui/Portal";
import { VaultCard } from "../components/dashboard/VaultCard";
import { ConfidentialWallet } from "../components/dashboard/ConfidentialWallet";
import { Button } from "../components/ui/Button";
import { usePatientProfile } from "../hooks/usePatientProfile";
import {
  Plus,
  ShieldCheck,
  Upload,
  History,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  SearchX,
  Coins
} from "lucide-react";

/* ─── Animation helpers ───────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any, delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, delay },
});

export function PatientVaultPage() {
  const { account, connect, isConnecting } = useWeb3();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const { profile, loading, hasProfile } = usePatientProfile(account || undefined);

  return (
    <div className="max-w-[1600px] mx-auto pb-24 px-4 md:px-8 lg:px-12 space-y-10">

      {/* ── Hero Banner ── */}
      <motion.section
        {...fadeIn(0)}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-10 md:p-14 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 h-[30rem] w-[30rem] -translate-y-1/2 translate-x-1/3 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-48 w-80 -translate-y-1/4 -translate-x-1/4 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-6">
              <ShieldCheck className="h-3 w-3" />
              Secure FHE Enclave
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Medical <span className="text-blue-400">Vault</span>
            </h1>
            <p className="text-slate-300/90 text-lg leading-relaxed">
              Your sensitive health records are stored in an encrypted state using Fully Homomorphic Encryption. Only you control who can access the decrypted insights.
            </p>
          </div>

          <motion.div {...fadeUp(0.2)}>
            {!account ? (
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold h-14 px-8 rounded-2xl gap-3 shadow-xl shadow-blue-500/20 transition-all text-base"
              >
                <ShieldCheck className="h-5 w-5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            ) : (
              <Button
                onClick={() => setShowUploadForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold h-14 px-8 rounded-2xl gap-3 shadow-xl shadow-blue-500/20 transition-all text-base"
              >
                <Upload className="h-5 w-5" />
                {hasProfile ? "Update Protected Record" : "Upload Initial Record"}
              </Button>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* ── Upload Modal Overlay ── */}
      <AnimatePresence>
        {showUploadForm && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl custom-scrollbar relative z-[110]"
              >
                <PatientRecordForm
                  onSuccess={() => setShowUploadForm(false)}
                  onCancel={() => setShowUploadForm(false)}
                />
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* ── Financial Enclave ── */}
      <motion.section {...fadeUp(0.1)} className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="h-6 w-6 text-amber-500" />
              Financial Enclave
            </h2>
            <p className="text-sm text-slate-500">Manage your private incentives and confidential rewards.</p>
          </div>
        </div>
        <ConfidentialWallet />
      </motion.section>

      {/* ── Vault Grid ── */}
      <div className="flex items-center justify-between px-2 mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
            Medical Enclave
          </h2>
          <p className="text-sm text-slate-500">Your FHE-protected health records and diagnostic data.</p>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full h-64 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-blue-500 animate-pulse" />
          </div>
        ) : hasProfile ? (
          <motion.div {...fadeUp(0.2)}>
            <VaultCard report={{
              id: profile.id,
              patientAddress: account || "",
              age: 0, // Placeholder as it's encrypted
              hasDiabetes: false,
              hbLevel: 0,
              timestamp: new Date(parseInt(profile.profileUpdatedAt) * 1000).toLocaleString(),
              txHash: profile.profileTxHash
            }} />
          </motion.div>
        ) : account && (
          <motion.div
            {...fadeUp(0.2)}
            className="col-span-full py-20 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800"
          >
            <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <SearchX className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Vault is currently empty</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">Initialize your secure health record to start matching with clinical trials.</p>
            </div>
          </motion.div>
        )}

        {account && (
          <motion.button
            {...fadeUp(0.3)}
            onClick={() => setShowUploadForm(true)}
            className="group flex flex-col items-center justify-center gap-4 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400/50 hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all min-h-[280px]"
          >
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-all">
              <Plus className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-900 dark:text-white mb-1">{hasProfile ? "Add Additional Records" : "Upload First Record"}</p>
              <p className="text-xs text-slate-400 font-medium">Securely upload PDF or HL7 data</p>
            </div>
          </motion.button>
        )}
      </div>

      {/* ── Footer / Activity ── */}
      <motion.div
        {...fadeUp(0.5)}
        className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 text-slate-400">
          <History className="h-4 w-4" />
          <span className="text-sm font-medium">Security Status: <span className="text-emerald-500 font-bold">Hardened</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">FHE Protocol Active</span>
        </div>
      </motion.div>
    </div>
  );
}
