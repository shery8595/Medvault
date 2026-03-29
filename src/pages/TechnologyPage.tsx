import React from "react";
import { motion } from "framer-motion";
import { Cpu, Zap, Lock, Database, Search, Activity, ShieldCheck, CircuitBoard } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as any, delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 1, delay },
});

export function TechnologyPage() {
  return (
    <div className="flex flex-col bg-slate-950 text-white min-h-screen overflow-hidden">
      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 pb-20 px-6 lg:px-14 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-accent/10 rounded-full blur-[160px] opacity-40" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[140px]" />
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{ 
              backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1220px] mx-auto text-center">
          <motion.div {...fadeIn(0)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-bold uppercase tracking-widest text-accent mb-8">
            <CircuitBoard className="h-3.5 w-3.5" />
            Core Infrastructure
          </motion.div>
          <motion.h1 
            {...fadeUp(0.1)}
            className="text-5xl md:text-[5.5rem] font-bold tracking-tight leading-[1.05] mb-8"
          >
            The Zenith of <br />
            <span className="text-accent">Computational Privacy</span>
          </motion.h1>
          <motion.p 
            {...fadeUp(0.2)}
            className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12"
          >
            MedVault leverages Fully Homomorphic Encryption (FHE) to enable complex computations on encrypted data without ever exposing the underlying privacy.
          </motion.p>
        </div>
      </section>

      {/* ─── Tech Bento Grid ─── */}
      <section className="py-24 px-6 lg:px-14 relative z-10 bg-[#020810]">
        <div className="max-w-[1220px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* FHE Deep Dive */}
            <motion.div 
              {...fadeUp(0)} 
              className="md:col-span-8 group relative rounded-[2.5rem] p-10 lg:p-14 overflow-hidden border border-white/5 bg-slate-900/40 backdrop-blur-md"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-[1.6] group-hover:rotate-6">
                <Cpu className="h-64 w-64 text-accent" />
              </div>
              <div className="relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent mb-8 shadow-lg shadow-accent/20">
                  <Cpu className="h-6 w-6" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 tracking-tight">Fully Homomorphic Encryption</h2>
                <p className="text-lg text-slate-400 leading-relaxed max-w-xl mb-8">
                  Unlike traditional encryption where data must be decrypted to be processed, FHE allows us to perform mathematical operations directly on the ciphertext. MedVault utilizes <span className="text-white font-semibold">Fhenix FHE</span>, the industry-standard implementation of FHE.
                </p>
                <div className="flex flex-wrap gap-4">
                  {["fhEVM Integration", "Programmable Bootstrapping", "FHE Gates", "Encrypted Booleans", "Bivariate Logic", "Provable Integrity"].map((tag) => (
                    <span key={tag} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-accent">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Performance Stats */}
            <motion.div 
              {...fadeUp(0.1)} 
              className="md:col-span-4 rounded-[2.5rem] p-10 border border-white/5 bg-gradient-to-br from-slate-900/60 to-slate-950 flex flex-col justify-between"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 mb-8">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-4 tracking-tight">Real-time Compute</h3>
              </div>
              <div className="space-y-8">
                <div>
                  <div className="text-4xl font-bold text-white mb-2 tracking-tight">2.4sec</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Avg. Eligibility Check</div>
                </div>
                <div className="h-px bg-white/5" />
                <div>
                  <div className="text-4xl font-bold text-white mb-2 tracking-tight">0kb</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Plaintext Exposure</div>
                </div>
              </div>
            </motion.div>

            {/* Smart Contracts */}
            <motion.div 
              {...fadeUp(0.2)} 
              className="md:col-span-4 rounded-[2.5rem] p-10 border border-white/5 bg-slate-900/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-8">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-4 tracking-tight">Smart Eligibility</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Trials are defined as programmable criteria on-chain. Patients match themselves locally, and the protocol verifies the match via FHE proofs without knowing the patient's identity.
              </p>
            </motion.div>

            {/* Fhenix Stack Section */}
            <motion.div 
              {...fadeUp(0.3)} 
              className="md:col-span-12 rounded-[2.5rem] p-10 border border-white/5 bg-gradient-to-r from-slate-900/40 via-blue-900/10 to-transparent flex flex-col items-center text-center lg:text-left lg:flex-row gap-12"
            >
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white mb-8 mx-auto lg:mx-0">
                  <CircuitBoard className="h-6 w-6" />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">Powered by Fhenix's fhEVM</h3>
                <p className="text-slate-400 leading-relaxed text-lg max-w-2xl">
                  MedVault runs on Fhenix's fhEVM, bringing on-chain confidentiality to Ethereum. Smart contracts can now store and process private states using encrypted types like <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">ebool</code>, <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">euint32</code>, and <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">eaddress</code>, ensuring that only the final authorized result is ever visible.
                </p>
              </div>
              <div className="flex-shrink-0 grid grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-slate-950 border border-white/5 text-center">
                  <div className="text-2xl font-bold text-accent mb-1">99.9%</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Privacy Reliability</div>
                </div>
                <div className="p-6 rounded-3xl bg-slate-950 border border-white/5 text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-1">fhEVM</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Protocol Core</div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─── Modern Footer Reveal ─── */}
      <section className="py-32 px-6 lg:px-14 bg-accent relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#020810] to-transparent" />
        <div className="max-w-[1220px] mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-slate-950 mb-8 tracking-tight">Ready to explore the source code?</h2>
          <Button 
            onClick={() => window.location.href = '/docs'}
            className="bg-slate-950 text-white hover:bg-slate-900 h-16 px-12 rounded-2xl text-lg font-bold shadow-2xl transition-all hover:scale-105"
          >
            Technical Documentation
          </Button>
        </div>
      </section>
    </div>
  );
}

// Simple Button placeholder if not imported
function Button({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center transition-all ${className}`}>
      {children}
    </button>
  );
}
