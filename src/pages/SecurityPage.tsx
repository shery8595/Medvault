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
    <div className="flex flex-col bg-slate-950 text-white min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-24 px-6 lg:px-14 overflow-hidden bg-[#020810]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-blue-500/5 to-transparent" />
          <div className="absolute -top-40 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[140px]" />
        </div>

        <div className="relative z-10 max-w-[1220px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-8 text-accent font-mono text-xs tracking-widest uppercase">
            <ShieldCheck className="h-4 w-4" />
            Security & Compliance Framework
          </motion.div>
          <motion.h1 
            {...fadeUp(0.1)}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-8"
          >
            Fortified by <span className="text-accent underline decoration-accent/20 underline-offset-8">Cryptography</span>.
          </motion.h1>
          <motion.p 
            {...fadeUp(0.2)}
            className="text-xl text-slate-400 max-w-2xl leading-relaxed"
          >
            We don't ask for your trust. We provide cryptographic proof. MedVault eliminates the human element of risk through mathematical certainty.
          </motion.p>
        </div>
      </section>

      {/* ─── Core Pillars ─── */}
      <section className="py-24 px-6 lg:px-14">
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
              desc: "Decryption requires a threshold of validator nodes to collaborate using Fhenix's KMS, ensuring no single entity ever holds the full decryption key."
            }
          ].map((item, i) => (
            <motion.div 
              key={item.title}
              {...fadeUp(i * 0.1)}
              className="p-10 rounded-[2rem] bg-slate-900/30 border border-white/5 hover:border-accent/30 transition-all group"
            >
              <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:bg-accent/20 group-hover:text-accent transition-all mb-8">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Compliance Section ─── */}
      <section className="py-24 px-6 lg:px-14 bg-white/5 relative overflow-hidden">
        <div className="max-w-[1220px] mx-auto flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1">
            <motion.h2 {...fadeUp(0)} className="text-4xl font-bold mb-8 tracking-tight">Institutional Compliance</motion.h2>
            <div className="space-y-6">
              {[
                { title: "HIPAA Compliant Infrastructure", status: "Active" },
                { title: "GDPR Data Sovereignty Protocol", status: "Active" },
                { title: "fhEVM Key Management System (KMS)", status: "Active" },
              ].map((row, i) => (
                <motion.div 
                  key={row.title}
                  {...fadeUp(0.1 + (i * 0.1))}
                  className="flex items-center justify-between p-6 rounded-2xl bg-slate-950 border border-white/5"
                >
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">{row.status}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-[450px] aspect-square rounded-[3rem] bg-[#0a0f1d] border border-white/10 flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-accent/5 blur-[80px] group-hover:bg-accent/10 transition-all" />
            <Fingerprint className="h-48 w-48 text-accent opacity-20 group-hover:opacity-40 transition-all scale-90 group-hover:scale-100" />
            <div className="absolute top-12 left-12 h-16 w-16 bg-blue-500/10 rounded-2xl blur-xl" />
            <div className="absolute bottom-12 right-12 h-20 w-20 bg-emerald-500/10 rounded-2xl blur-xl" />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-28 px-6 lg:px-14 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp(0)} className="h-16 w-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-8">
            <Lock className="h-8 w-8" />
          </motion.div>
          <motion.h2 {...fadeUp(0.1)} className="text-4xl font-bold mb-6 tracking-tight">Your data is yours. Period.</motion.h2>
          <motion.p {...fadeUp(0.2)} className="text-lg text-slate-400 mb-10">
            MedVault is built on the fundamental belief that privacy is a human right. Our technology ensures this right is never compromised in the pursuit of medical progress.
          </motion.p>
          <motion.div {...fadeUp(0.3)}>
             <Button className="bg-white text-slate-950 hover:bg-slate-100 h-14 px-10 rounded-2xl font-bold text-base transition-all">
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
