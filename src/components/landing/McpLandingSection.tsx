import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Cpu,
  Lock,
  Plug,
  Sparkles,
  Terminal,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import brandLogoUrl from "../../../logo/logo.png";

const viewportBase = { once: true as const, amount: 0.18 as const };
const transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

const mcpSteps = [
  {
    n: "01",
    title: "Pick your agent",
    body: "Cursor, Codex, Claude Code, ChatGPT, Antigravity, or OpenClaw.",
  },
  {
    n: "02",
    title: "Build & configure",
    body: "mcp:build, RPC + subgraph env, optional sponsor key for writes.",
  },
  {
    n: "03",
    title: "Operate on Sepolia",
    body: "Query trials & audit logs — or sponsor writes when verified.",
  },
];

const mcpAgents = [
  { name: "Cursor", tag: "IDE", logo: "/images/cursor_logo.png" },
  { name: "Codex", tag: "OpenAI", logo: "/images/codex%20logo.jpeg" },
  { name: "Claude", tag: "Anthropic", logo: "/images/claude%20logo.png" },
  { name: "ChatGPT", tag: "Desktop", logo: "/images/chat%20gpt%20lgo.png" },
  { name: "Antigravity", tag: "Google", logo: "/images/antigravity_logo.jpeg" },
  { name: "OpenClaw", tag: "Agent", logo: "/images/open%20claw%20logo.png" },
] as const;

const mcpCapabilities = [
  {
    badge: "Read",
    icon: BookOpen,
    accent: "border-l-[#6bd8cb]",
    title: "Protocol reads",
    body: "Trials, matches, audit trails, wiring checks, allowlisted subgraph — no patient decrypt.",
    tools: ["medvault_get_active_trials", "medvault_get_audit_logs", "medvault_check_wiring"],
  },
  {
    badge: "Write",
    icon: Bot,
    accent: "border-l-[#00685f]",
    title: "Sponsor MCP",
    body: "Create trials, milestones, fund pools, and application status with MCP_PRIVATE_KEY (sponsor only).",
    tools: ["medvault_create_trial", "medvault_fund_trial_pool", "medvault_get_sponsor_trial_pool_details"],
  },
  {
    badge: "Dev",
    icon: Terminal,
    accent: "border-l-[#8792fe]",
    title: "Builder tools",
    body: "Contract catalog, addresses, eth_call views, and relayer health for local debugging.",
    tools: ["medvault_get_config", "medvault_list_protocol_contracts", "medvault_read_contract_view"],
  },
];

const privacyPoints = [
  "Runs locally — no hosted production MCP endpoint.",
  "Patient FHE and relayer flows stay in the browser dApp.",
  "Sponsor writes use your own Sepolia wallet only.",
];

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "medvault": {
      "command": "node",
      "args": ["\${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "SEPOLIA_RPC_URL": "…",
        "MEDVAULT_SUBGRAPH_URL": "…"
      }
    }
  }
}`;

/** Brand PNG has a light matte; white tile + ring matches agent logos on dark panel. */
function MedVaultHubLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-white p-2.5",
        "shadow-[0_4px_24px_-6px_rgba(107,216,203,0.5)] ring-2 ring-[#6bd8cb]/40",
        className
      )}
    >
      <img
        src={brandLogoUrl}
        alt="MedVault"
        className="block h-10 w-10 max-h-full max-w-full object-contain object-center"
        width={40}
        height={40}
        decoding="async"
      />
    </span>
  );
}

const AGENT_ICON_BOX = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5";

function AgentTile({ name, tag, logo }: (typeof mcpAgents)[number]) {
  return (
    <div
      className={cn(
        "group flex min-h-[7.25rem] flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-3.5",
        "transition-all duration-200 hover:border-[#6bd8cb]/45 hover:bg-white/[0.09] hover:shadow-[0_8px_24px_-12px_rgba(107,216,203,0.35)]"
      )}
    >
      <span className={cn(AGENT_ICON_BOX, "transition group-hover:ring-[#6bd8cb]/30")}>
        <img
          src={logo}
          alt=""
          className="max-h-7 max-w-7 object-contain object-center"
          width={28}
          height={28}
          loading="lazy"
          decoding="async"
        />
      </span>
      <div className="w-full min-w-0 text-center">
        <p className="truncate text-xs font-semibold text-white m-0 px-0.5">{name}</p>
        <p className="text-[10px] font-medium text-[#8fd4c8]/75 m-0 mt-0.5">{tag}</p>
      </div>
    </div>
  );
}

function McpHubStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-[#6bd8cb]/20 bg-gradient-to-r from-white/[0.08] to-transparent p-4",
        className
      )}
    >
      <MedVaultHubLogo />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white m-0">MedVault MCP</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400 m-0">
          One local server — every client below connects via stdio.
        </p>
      </div>
    </div>
  );
}

export function McpLandingSection() {
  const reduce = useReducedMotion();
  const fadeUp = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition } }
    : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition } };

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: reduce ? 0.04 : 0.07 } },
  };
  const item = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition } }
    : { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition } };

  return (
    <section
      id="mcp"
      className="relative overflow-x-clip border-y border-[#bcc9c6]/40 bg-white px-4 py-20 pb-24 sm:px-8 sm:py-28 sm:pb-32"
      aria-labelledby="mcp-heading"
    >
      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,104,95,0.04) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(0,104,95,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 right-0 h-72 w-72 -z-10 rounded-full bg-[#6bd8cb]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 -z-10 rounded-full bg-[#8792fe]/10 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl">
        {/* Hero — split */}
        <motion.div
          className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-12"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={fadeUp}
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#00685f]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00685f]">
              <Plug className="h-3 w-3" strokeWidth={2.5} />
              MCP server
            </span>
            <h2
              id="mcp-heading"
              className="font-display mt-5 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]"
            >
              Connect your AI assistant to{" "}
              <span className="bg-gradient-to-r from-[#00685f] to-[#008378] bg-clip-text text-transparent">
                MedVault on Sepolia
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5a6a80] sm:text-lg">
              A local Model Context Protocol bridge for subgraph reads, contract context, and sponsor workflows — from
              Cursor, Codex, or any MCP client. Nothing extra to deploy.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/docs/mcp"
                className="inline-flex items-center gap-2 rounded-full bg-[#00685f] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-[#00685f]/20 transition hover:bg-[#005a52]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Setup guide
              </Link>
              <Link
                to="/docs/mcp/tools"
                className="inline-flex items-center gap-2 rounded-full border border-[#bcc9c6] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#00685f] transition hover:bg-[#f7f9fb]"
              >
                Tool list
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#bcc9c6]/50 bg-[#f7f9fb]/80 p-4 backdrop-blur-sm sm:p-5">
            {[
              { value: "21", label: "MCP tools", icon: Terminal },
              { value: "6", label: "AI clients", icon: Bot },
              { value: "0", label: "Hosted endpoints", icon: Zap, suffix: " prod" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <Icon className="mx-auto h-4 w-4 text-[#6bd8cb]" strokeWidth={1.75} />
                  <p className="mt-2 font-display text-2xl font-bold text-[#191c1e] sm:text-3xl">
                    {stat.value}
                    {"suffix" in stat && stat.suffix ? (
                      <span className="text-sm font-semibold text-[#5a6a80]">{stat.suffix}</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5a6a80]">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Timeline steps */}
        <motion.ol
          className="relative mt-16 grid gap-6 sm:grid-cols-3 sm:gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={stagger}
        >
          <div
            className="pointer-events-none absolute top-5 left-[16%] right-[16%] hidden h-px bg-gradient-to-r from-transparent via-[#6bd8cb]/50 to-transparent sm:block"
            aria-hidden
          />
          {mcpSteps.map((s) => (
            <motion.li
              key={s.n}
              variants={item}
              className="relative list-none rounded-2xl border border-[#bcc9c6]/40 bg-white p-5 shadow-sm sm:pt-7"
            >
              <span className="relative z-[1] inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#00685f] text-[11px] font-black text-white shadow-md">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-bold text-[#191c1e]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5a6a80]">{s.body}</p>
            </motion.li>
          ))}
        </motion.ol>

        {/* Agents — dark showcase */}
        <motion.div
          className="relative mt-12 overflow-x-clip rounded-3xl bg-[#0f1419] p-6 sm:p-8 lg:p-10"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={fadeUp}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(107,216,203,0.22) 0%, transparent 55%)," +
                "radial-gradient(ellipse 50% 45% at 100% 100%, rgba(135,146,254,0.12) 0%, transparent 50%)",
            }}
          />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:items-start">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6bd8cb]">Works with</p>
              <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">Your favorite MCP clients</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                One stdio server — snippets in{" "}
                <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-[#8fd4c8]">
                  config/mcp/
                </code>
                . Run{" "}
                <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-[#8fd4c8]">
                  npm run mcp:export-config
                </code>{" "}
                after clone.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["stdio", "HTTP optional", "local only"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <McpHubStrip className="mt-8 hidden lg:flex" />
            </div>

            <div className="min-w-0">
              <McpHubStrip className="mb-5 lg:hidden" />

              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  {mcpAgents.map((agent) => (
                    <AgentTile key={agent.name} {...agent} />
                  ))}
                </div>
              </div>

              <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
                Same <span className="text-[#8fd4c8]/80">mcp-server/dist/index.js</span> for every client
              </p>
            </div>
          </div>
        </motion.div>

        {/* Capability cards */}
        <motion.div
          className="mt-10 grid gap-4 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={stagger}
        >
          {mcpCapabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <motion.article
                key={cap.title}
                variants={item}
                className={cn(
                  "flex flex-col rounded-2xl border border-[#bcc9c6]/45 border-l-4 bg-white p-5 shadow-sm",
                  cap.accent
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#f7f9fb] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00685f]">
                    {cap.badge}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f9fb]">
                    <Icon className="h-4 w-4 text-[#00685f]/80" strokeWidth={1.75} />
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#191c1e]">{cap.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[#5a6a80]">{cap.body}</p>
                <ul className="mt-4 space-y-1 rounded-lg bg-[#f7f9fb] p-3">
                  {cap.tools.map((t) => (
                    <li key={t} className="truncate font-mono text-[10px] text-[#3d4947]">
                      {t}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </motion.div>

        {/* Privacy + config */}
        <motion.div
          className="mt-10 rounded-3xl border border-[#bcc9c6]/50 bg-[#f7f9fb] shadow-sm"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={fadeUp}
        >
          <div className="grid lg:grid-cols-2 lg:items-stretch">
            <div className="border-b border-[#bcc9c6]/40 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-[#00685f]">
                <Lock className="h-4 w-4" strokeWidth={2} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Privacy boundary</span>
              </div>
              <ul className="mt-5 space-y-3">
                {privacyPoints.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed text-[#3d4947]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6bd8cb]" strokeWidth={2} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex min-h-0 flex-col bg-[#07090c] lg:min-h-full lg:rounded-r-3xl">
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/90" />
                </div>
                <span className="font-mono text-[10px] text-[#6bd8cb]">.cursor/mcp.json</span>
              </div>
              <pre className="overflow-x-auto px-4 pt-4 pb-5 font-mono text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                <code>{MCP_CONFIG_SNIPPET}</code>
              </pre>
              <p className="mt-auto shrink-0 border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
                Copy from <span className="text-slate-400">config/mcp/</span> · optional{" "}
                <span className="text-slate-400">MCP_PRIVATE_KEY</span> for sponsor writes
              </p>
            </div>
          </div>
        </motion.div>

        <motion.p
          className="mx-auto mt-10 max-w-2xl px-2 text-center text-xs leading-relaxed text-[#5a6a80] sm:text-sm"
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={fadeUp}
        >
          <Cpu className="mx-auto mb-2 h-4 w-4 text-[#6bd8cb]" strokeWidth={1.5} />
          The web app at med-vault.xyz is unchanged — MCP is optional for developers and verified sponsors. Patient flows
          stay in the browser with Zama FHE and Privy.
        </motion.p>
      </div>
    </section>
  );
}
