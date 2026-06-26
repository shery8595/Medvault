import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, EyeOff, FileCheck, Globe, UserCheck, AlertCircle, Fingerprint } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as any, delay },
});

export function SecurityPage() {
  return (
    <div className="flex flex-col bg-slate-50 text-slate-900 min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative pt-24 pb-16 px-6 lg:px-14 overflow-hidden bg-slate-100">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-blue-500/5 to-transparent" />
          <div className="absolute -top-40 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[140px]" />
        </div>

        <div className="relative z-10 max-w-[1220px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-8 text-teal-700 font-mono text-xs tracking-widest uppercase">
            <ShieldCheck className="h-4 w-4" />
            Security & Compliance Framework
          </motion.div>
          <motion.h1 
            {...fadeUp(0.1)}
            className="text-5xl md:text-6xl font-bold tracking-tight mb-8 text-slate-900"
          >
            Fortified by <span className="text-teal-700 underline decoration-teal-300 underline-offset-8">Cryptography</span>.
          </motion.h1>
          <motion.p 
            {...fadeUp(0.2)}
            className="text-xl text-slate-600 max-w-2xl leading-relaxed"
          >
            We don't ask for your trust. We provide cryptographic proof. MedVault eliminates the human element of risk through mathematical certainty.
          </motion.p>
        </div>
      </section>

      {/* ─── Core Pillars ─── */}
      <section className="py-20 px-6 lg:px-14">
        <div className="max-w-[1220px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: EyeOff,
              title: "Zero-Knowledge Visibility",
              desc: "Neither MedVault nor trial sponsors can ever see your raw medical data. Only the computational result is selectively revealed."
            },
            {
              icon: FileCheck,
              title: "On-Chain Consent",
              desc: "Every data access request is logged on a tamper-proof ledger. You maintain absolute authority over your encryption keys."
            },
            {
              icon: AlertCircle,
              title: "Threshold Decryption",
              desc: "Decryption requires a threshold of validator nodes to collaborate using Zama's KMS, ensuring no single entity ever holds the full decryption key."
            }
          ].map((item, i) => (
            <motion.div 
              key={item.title}
              {...fadeUp(i * 0.1)}
              className="p-10 rounded-[2rem] bg-white border border-slate-200 hover:border-teal-300 transition-all group"
            >
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-teal-100 group-hover:text-teal-700 transition-all mb-8">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight text-slate-900">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Compliance Section ─── */}
      <section className="py-20 px-6 lg:px-14 bg-slate-100 relative overflow-hidden">
        <div className="max-w-[1220px] mx-auto flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1">
            <motion.h2 {...fadeUp(0)} className="text-4xl font-bold mb-8 tracking-tight text-slate-900">Privacy & compliance goals</motion.h2>
            <div className="space-y-6">
              {[
                { title: "Health-data privacy patterns", status: "In design" },
                { title: "Data residency & export controls", status: "In design" },
                { title: "fhEVM Key Management System (KMS)", status: "On testnet" },
              ].map((row, i) => (
                <motion.div 
                  key={row.title}
                  {...fadeUp(0.1 + (i * 0.1))}
                  className="flex items-center justify-between p-6 rounded-2xl bg-white border border-slate-200"
                >
                  <span className="font-semibold text-slate-900">{row.title}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                      row.status === "On testnet"
                        ? "text-teal-700 bg-teal-100"
                        : "text-slate-600 bg-slate-100"
                    }`}
                  >
                    {row.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[450px] aspect-square rounded-[3rem] bg-white border border-slate-200 flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-teal-100/30 blur-[80px] group-hover:bg-teal-100/50 transition-all" />
            <Fingerprint className="h-48 w-48 text-teal-700 opacity-20 group-hover:opacity-40 transition-all scale-90 group-hover:scale-100" />
            <div className="absolute top-12 left-12 h-16 w-16 bg-blue-500/10 rounded-2xl blur-xl" />
            <div className="absolute bottom-12 right-12 h-20 w-20 bg-emerald-500/10 rounded-2xl blur-xl" />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-24 px-6 lg:px-14 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp(0)} className="h-16 w-16 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-8">
            <Lock className="h-8 w-8" />
          </motion.div>
          <motion.h2 {...fadeUp(0.1)} className="text-4xl font-bold mb-6 tracking-tight text-slate-900">Your data is yours. Period.</motion.h2>
          <motion.p {...fadeUp(0.2)} className="text-lg text-slate-600 mb-10">
            MedVault is built on the fundamental belief that privacy is a human right. Our technology ensures this right is never compromised in the pursuit of medical progress.
          </motion.p>
          <motion.div {...fadeUp(0.3)}>
             <Button className="bg-teal-700 text-white hover:bg-teal-800 h-14 px-10 rounded-2xl font-bold text-base transition-all">
               Establish your Secure Vault
             </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function Button({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center transition-all ${className}`}>
      {children}
    </button>
  );
}
