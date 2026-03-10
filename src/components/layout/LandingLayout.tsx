import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, Github, Twitter, Linkedin, Globe } from "lucide-react";
import { Button } from "../ui/Button";

export function LandingLayout({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-accent/20">

      {/* ── Header ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? "bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm"
          : "bg-transparent border-b border-transparent"
          }`}
      >
        <div className="max-w-[1440px] mx-auto flex h-[72px] items-center justify-between px-6 lg:px-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="flex h-10 w-12 items-center justify-center transition-colors overflow-hidden rounded-xl">
              <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-none justify-center">
              <span className="font-bold text-[17px] tracking-tight text-slate-900 dark:text-white mt-1">MedVault</span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {["Technology", "Security", "Sponsors", "Documentation"].map((item) => (
              <Link
                key={item}
                to={`#${item.toLowerCase()}`}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all"
              >
                {item}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link to="/patient" className="hidden sm:block">
              <button className="px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                Log In
              </button>
            </Link>
            <Link to="/patient">
              <Button className="bg-accent hover:bg-accent/90 text-white font-semibold px-5 h-10 rounded-xl shadow-md shadow-accent/20 gap-2 text-[13px] group transition-all">
                Launch App
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="pt-[72px]">
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
              <Link to="/" className="flex items-center gap-3.5 group w-fit">
                <div className="flex h-10 w-12 items-center justify-center overflow-hidden rounded-xl">
                  <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain" />
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
              © 2026 Zama MedVault. Built with FHE technology.
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
