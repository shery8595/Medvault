import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";

const TICKER_ITEMS = [
  "FHE MATCHING",
  "Zama FHE",
  "SEMAPHORE",
  "NOIR / HONK",
  "MEDVAULT",
  "Ethereum Sepolia",
  "MCP",
  "SUBGRAPH",
  "PRIVY",
  "CONSENT ACL",
  "NOIR ATTESTATION",
  "CHAINLINK",
] as const;

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Find trials", href: "/patient/find-trials" },
      { label: "Patient dashboard", href: "/patient/dashboard" },
      { label: "Sponsor dashboard", href: "/sponsor/dashboard" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Technology", href: "/technology" },
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "MCP server", href: "/docs/mcp" },
      { label: "Architecture", href: "/docs/architecture" },
      {
        label: "GitHub",
        href: "https://github.com/shery8595/Med-Vault",
        external: true,
      },
    ],
  },
  {
    title: "Build & ship",
    links: [
      { label: "Deployment guide", href: "/docs/deployment" },
      { label: "Testing & CI", href: "/docs/testing" },
      { label: "Live app", href: "https://med-vault.xyz", external: true },
      { label: "Changelog", href: "/docs/changelog" },
    ],
  },
] as const;

function TickerStrip() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="border-y border-[#6bd8cb]/15 bg-[#030908]/80 py-3.5 overflow-hidden">
      <div className="mv-marq-track-left flex w-max gap-10 px-4">
        {items.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex shrink-0 items-center gap-10 font-mono text-[11px] font-semibold tracking-[0.2em] text-[#6bd8cb]/90"
          >
            {label}
            <span className="text-[#6bd8cb]/30" aria-hidden>
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LandingClosingSection() {
  const reduce = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden bg-[#040d0c] text-slate-200"
      aria-labelledby="landing-closing-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(107,216,203,0.14) 0%, transparent 55%)," +
            "radial-gradient(ellipse 40% 35% at 100% 100%, rgba(135,146,254,0.08) 0%, transparent 50%)",
        }}
      />

      {/* CTA band */}
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-8 sm:pt-20 sm:pb-16">
        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#6bd8cb]">
            Encrypted clinical research
          </p>
          <h2
            id="landing-closing-heading"
            className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.65rem] md:leading-[1.1]"
          >
            Put <span className="text-[#6bd8cb]">privacy</span> at the center of trial matching
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            FHE-friendly vitals, anonymous Semaphore apply, optional Noir compliance seals, and sponsor workflows on Ethereum Sepolia — patients stay in
            control; builders get docs, subgraph, and a local MCP layer.
          </p>

          <motion.div
            className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            whileHover={reduce ? undefined : undefined}
          >
            <Link
              to="/patient/find-trials"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5",
                "bg-[#6bd8cb] text-[#040d0c] text-sm font-bold uppercase tracking-wide",
                "shadow-[0_0_40px_-8px_rgba(107,216,203,0.65)] transition hover:bg-[#89f5e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6bd8cb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#040d0c]"
              )}
            >
              Launch patient app
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="https://med-vault.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#6bd8cb]/35 bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-[#6bd8cb] transition hover:bg-[#6bd8cb]/10"
            >
              med-vault.xyz
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </motion.div>
        </motion.div>
      </div>

      <TickerStrip />

      {/* Link columns */}
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6bd8cb]">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-slate-300 transition hover:text-white"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-slate-300 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#6bd8cb]/20 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6bd8cb]">
            Stay in the loop
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
            Star the repo for release notes, open an issue for integrations, or read the MCP guide to wire your IDE to
            Sepolia.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://github.com/shery8595/Med-Vault"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#6bd8cb]/30 bg-[#6bd8cb]/10 px-4 py-2.5 text-xs font-semibold text-[#6bd8cb] transition hover:bg-[#6bd8cb]/20"
            >
              View on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              to="/docs/mcp"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-[#6bd8cb]/30 hover:text-white"
            >
              MCP documentation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#6bd8cb]/10 bg-[#020605]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-[11px] text-slate-500 sm:flex-row sm:px-8">
          <p className="m-0 font-mono tracking-wide">
            © {new Date().getFullYear()} MedVault · Ethereum Sepolia testnet
          </p>
          <p className="m-0 flex items-center gap-2 font-mono uppercase tracking-[0.15em] text-slate-500">
            <span className="text-[#6bd8cb]/80">Powered by</span>
            <span className="text-slate-400">Zama FHE</span>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <span className="text-slate-400">Semaphore</span>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <span className="text-slate-400">Noir</span>
          </p>
        </div>
      </div>
    </section>
  );
}
