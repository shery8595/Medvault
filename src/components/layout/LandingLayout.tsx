import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, Github, Twitter, Linkedin, Globe } from "lucide-react";
import { Button } from "../ui/Button";

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-accent/20">

      {/* ── Main ── */}
      <main>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="relative bg-slate-950 text-white pt-20 pb-10 overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        {/* BG glow */}
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1440px] mx-auto px-6 lg:px-14 relative z-10">

          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-16 pb-16 border-b border-slate-800">

            {/* Brand col — spans 2 */}
            <div className="lg:col-span-2 space-y-6">
              <Link to="/" className="flex items-center gap-0 group w-fit">
                <div className="flex h-12 w-20 items-center justify-center transition-transform duration-300 group-hover:scale-110 -mr-2">
                  <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain drop-shadow-xl" />
                </div>
                <span className="font-bold text-lg tracking-tight">MedVault</span>
              </Link>
              <p className="text-sm leading-relaxed text-slate-400 max-w-[280px]">
                Securing the future of medical discovery through Fully Homomorphic Encryption. Patient privacy is no longer a trade-off.
              </p>
              <div className="flex gap-2">
                {[Twitter, Github, Linkedin, Globe].map((Icon, i) => (
                  <Link
                    key={i}
                    to="#"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-accent hover:border-accent/50 transition-all"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Simplified Navigation */}
            <div className="lg:col-span-3 flex flex-wrap gap-x-12 gap-y-6 lg:justify-end items-start mt-4 lg:mt-0">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Navigation</h4>
                <ul className="space-y-3">
                  <li><Link to="/patient" className="text-sm text-slate-400 hover:text-white transition-colors">Patient Portal</Link></li>
                  <li><Link to="/sponsor" className="text-sm text-slate-400 hover:text-white transition-colors">Sponsor Console</Link></li>
                  <li><Link to="/docs" className="text-sm text-slate-400 hover:text-white transition-colors">Technical Docs</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 gap-4">
            <p className="text-[12px] text-slate-600">
              © 2026 Fhenix MedVault. Built with FHE technology.
            </p>
            <div className="flex gap-6">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <Link
                  key={item}
                  to="#"
                  className="text-[12px] text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
