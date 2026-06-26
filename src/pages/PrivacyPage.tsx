import { Fragment } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  ChevronRight,
  Cpu,
  Database,
  EyeOff,
  FileCheck,
  KeyRound,
  Lock,
  Minus,
  Shield,
  UserCheck,
  UserRound,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as const, delay },
});

const TEAL = "#00685f";
const MINT = "#89f5e7";
const VIOLET = "#8792fe";
const NAVY = "#0a2540";

const privacyLayers = [
  {
    icon: KeyRound,
    title: "You hold the keys",
    desc: "Health signals are encrypted before they leave your device. MedVault cannot read your vault contents — only you authorize decryption paths.",
  },
  {
    icon: EyeOff,
    title: "Selective disclosure",
    desc: "Trial matching runs on encrypted or minimized data. Sponsors receive eligibility outcomes and proofs — not raw medical records or wallet-linked identity.",
  },
  {
    icon: FileCheck,
    title: "Consent you control",
    desc: "Every sponsor access request is logged on-chain. Grant access when it helps you; revoke it when it does not. No silent backdoors.",
  },
];

const commitments = [
  "We never sell patient data to advertisers or data brokers.",
  "We never require plaintext uploads of full medical histories for matching.",
  "We never link your Semaphore identity to your wallet address in sponsor views.",
  "We never share contact details until you explicitly opt in to a trial application.",
];

const comparisonRows = [
  { label: "Raw lab values & diagnoses", patient: "Encrypted in vault", sponsor: "Never exposed" },
  { label: "Eligibility outcome", patient: "You choose to apply", sponsor: "Match score / proof only" },
  { label: "Wallet address", patient: "Your account", sponsor: "Minimized until consent" },
  { label: "Consent history", patient: "Full audit trail", sponsor: "Scoped to granted trials" },
];

/** Lower = less exposure risk (illustrative index for marketing page). */
const exposureComparison = [
  { category: "Raw PHI stored", traditional: 92, medvault: 4 },
  { category: "Identity linkage", traditional: 78, medvault: 11 },
  { category: "Sponsor data lake", traditional: 85, medvault: 9 },
  { category: "Unauthorized re-use", traditional: 70, medvault: 6 },
];

const sponsorSignalMix = [
  { name: "Compliance attestation seal", value: 42, color: TEAL },
  { name: "Match score (encrypted)", value: 28, color: MINT },
  { name: "Trial metadata", value: 18, color: VIOLET },
  { name: "Contact (post-consent)", value: 12, color: "#5a6a80" },
  { name: "Raw chart / labs", value: 0, color: "#e2e8e6" },
];

const auditTrailTrend = [
  { month: "Jan", grants: 2, revokes: 0 },
  { month: "Feb", grants: 5, revokes: 1 },
  { month: "Mar", grants: 4, revokes: 2 },
  { month: "Apr", grants: 7, revokes: 1 },
  { month: "May", grants: 6, revokes: 3 },
  { month: "Jun", grants: 8, revokes: 2 },
];

const stackLayers = [
  { label: "On-chain consent & audit", sub: "DataAccessLog · revoke anytime", color: NAVY },
  { label: "Zero-knowledge proofs", sub: "Semaphore · Noir certification", color: TEAL },
  { label: "FHE eligibility engine", sub: "Compute on ciphertext", color: VIOLET },
  { label: "Client-side encryption", sub: "@zama-fhe/sdk before RPC", color: MINT },
];

const flowNodes = [
  { id: "patient", label: "Patient device", sub: "Encrypt locally", x: 8 },
  { id: "vault", label: "Medical vault", sub: "Ciphertext on-chain", x: 28 },
  { id: "fhe", label: "FHE match", sub: "No plaintext decode", x: 50 },
  { id: "proof", label: "ZK proof", sub: "Optional anonymous apply", x: 72 },
  { id: "sponsor", label: "Sponsor view", sub: "Proof + score only", x: 92 },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#bcc9c6]/60 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#191c1e]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
          {String(p.name).includes("exposure") || p.name === "Traditional" || p.name === "MedVault" ? "%" : ""}
        </p>
      ))}
    </div>
  );
}

const flowSteps = [
  { Icon: UserRound, label: "You", ring: "bg-[#e8f4fd] text-[#0a2540]" },
  { Icon: Database, label: "Vault", ring: "bg-[#89f5e7]/35 text-[#00685f]" },
  { Icon: Cpu, label: "FHE", ring: "bg-[#8792fe]/25 text-[#5a4a9e]" },
  { Icon: BadgeCheck, label: "ZK", ring: "bg-[#00685f]/12 text-[#00685f]" },
  { Icon: EyeOff, label: "Sponsor", ring: "bg-[#f7f9fb] text-[#5a6a80] ring-1 ring-[#bcc9c6]" },
] as const;

function FlowConnector({ reduce, index }: { reduce: boolean; index: number }) {
  return (
    <div className="flex min-w-[2.5rem] flex-1 flex-col items-center justify-center gap-1 px-0.5 sm:min-w-[3rem]">
      <span className="whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-wide text-[#00685f] sm:text-[9px]">
        ciphertext
      </span>
      <div className="relative flex w-full items-center">
        <div className="h-px flex-1 rounded-full bg-gradient-to-r from-[#89f5e7] to-[#00685f]" />
        <ChevronRight className="-ml-0.5 h-4 w-4 shrink-0 text-[#00685f]" strokeWidth={2.5} />
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6bd8cb]"
            animate={{ x: [-12, 12], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.35, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

function HeroFlowDiagram({ reduce }: { reduce: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(10,37,64,0.12)] sm:p-6"
      aria-label="Diagram showing encrypted data flow from patient to sponsor"
    >
      <p className="mb-5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">
        End-to-end data path
      </p>

      {/* Main horizontal flow */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[min(100%,22rem)] items-start justify-between gap-0 sm:min-w-0">
        {flowSteps.map((step, i) => (
          <Fragment key={step.label}>
            <div className="flex w-[3.25rem] shrink-0 flex-col items-center sm:w-14">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14 ${step.ring}`}
              >
                <step.Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
              </div>
              <span className="mt-2 text-center text-[10px] font-semibold leading-tight text-[#191c1e] sm:text-xs">
                {step.label}
              </span>
            </div>
            {i < flowSteps.length - 1 && <FlowConnector reduce={reduce} index={i} />}
          </Fragment>
        ))}
        </div>
      </div>

      {/* Blocked PHI shortcut — arc from first to last node */}
      <div className="relative mx-2 mt-3 h-10 sm:mx-4 sm:h-12">
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 320 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M 24 6 Q 160 44 296 6"
            fill="none"
            stroke="#f87171"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="24" cy="6" r="3" fill="#f87171" />
          <circle cx="296" cy="6" r="3" fill="#f87171" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-2.5 py-0.5 text-[9px] font-semibold text-red-700 sm:text-[10px]">
            <Ban className="h-3 w-3 shrink-0" strokeWidth={2.5} />
            Raw PHI path — blocked
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {["Encrypt", "Store sealed", "Match in FHE", "Prove", "Minimal reveal"].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[#6bd8cb]/40 bg-[#89f5e7]/15 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#00685f]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function PrivacyStackDiagram() {
  return (
    <div className="space-y-2">
      {stackLayers.map((layer, i) => (
        <motion.div
          key={layer.label}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: i * 0.08 }}
          className="relative overflow-hidden rounded-2xl border border-[#bcc9c6]/50 p-5"
          style={{
            marginLeft: `${i * 12}px`,
            marginRight: `${(stackLayers.length - 1 - i) * 12}px`,
            background: `linear-gradient(90deg, ${layer.color}12 0%, white 70%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black text-white"
              style={{ backgroundColor: layer.color }}
            >
              {4 - i}
            </div>
            <div>
              <p className="font-semibold text-[#191c1e]">{layer.label}</p>
              <p className="text-sm text-[#5a6a80]">{layer.sub}</p>
            </div>
          </div>
        </motion.div>
      ))}
      <p className="pt-2 text-center text-xs text-[#5a6a80]">Each layer must fail independently — defense in depth</p>
    </div>
  );
}

function ZkFlowStrip({ reduce }: { reduce: boolean }) {
  const nodes = [
    { Icon: UserRound, bg: "#e8f4fd", fg: NAVY, label: "Identity" },
    { Icon: Lock, bg: `${VIOLET}18`, fg: "#5a6a80", label: "ZK proof" },
    { Icon: BadgeCheck, bg: "#06d6a018", fg: TEAL, label: "Verified" },
  ];
  return (
    <div className="rounded-2xl border border-[#bcc9c6]/50 bg-[#f7f9fb] p-5">
      <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#5a6a80]">
        Anonymous apply flow
      </p>
      <div className="flex items-center gap-2">
        {nodes.map((node, idx) => (
          <Fragment key={idx}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: node.bg, color: node.fg }}
              >
                <node.Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#5a6a80]">
                {node.label}
              </span>
            </div>
            {idx < 2 && (
              <div className="flex flex-1 flex-col gap-1 pb-5">
                {[0, 1].map((j) => (
                  <motion.div
                    key={j}
                    className="h-px rounded-full bg-gradient-to-r from-[#6bd8cb] to-[#89f5e7]"
                    animate={reduce ? undefined : { scaleX: [0.4, 1, 0.4], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: j * 0.4, ease: "easeInOut" }}
                  />
                ))}
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DisclosureBars() {
  return (
    <div className="space-y-3">
      {comparisonRows.map((row, i) => (
        <div key={row.label} className="rounded-xl border border-[#bcc9c6]/40 bg-[#f7f9fb] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#191c1e]">{row.label}</span>
            <div className="flex gap-3 text-xs">
              <span className="font-semibold text-[#00685f]">You: {row.patient}</span>
              <span className="text-[#5a6a80]">Sponsor: {row.sponsor}</span>
            </div>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#bcc9c6]/30">
            <motion.div
              className="h-full bg-[#00685f]"
              initial={{ width: 0 }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              title="Patient control"
            />
            <motion.div
              className="h-full bg-[#bcc9c6]"
              initial={{ width: 0 }}
              whileInView={{ width: row.sponsor.includes("Never") ? "0%" : "18%" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
              title="Sponsor exposure"
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-[#5a6a80]">Teal = full visibility for you · grey = minimal sponsor surface</p>
    </div>
  );
}

export function PrivacyPage() {
  const reduce = !!useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fb] text-[#191c1e]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-24 lg:px-14">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -left-20 top-0 h-[520px] w-[520px] rounded-full bg-[#89f5e7]/20 blur-[120px]" />
          <div className="absolute -right-10 top-24 h-[400px] w-[400px] rounded-full bg-[#8792fe]/15 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-[1220px] gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#00685f]"
            >
              <Shield className="h-4 w-4" />
              Privacy Program
            </motion.div>
            <motion.h1
              {...fadeUp(0.1)}
              className="max-w-3xl text-5xl font-bold tracking-tight text-[#191c1e] md:text-6xl"
            >
              Your health data stays{" "}
              <span className="text-[#00685f] underline decoration-[#89f5e7] decoration-4 underline-offset-8">
                yours
              </span>
              .
            </motion.h1>
            <motion.p {...fadeUp(0.2)} className="mt-8 max-w-xl text-xl leading-relaxed text-[#3d4947]">
              MedVault is built for patients who need clinical trial discovery without trading away identity. Privacy is
              enforced by encryption, zero-knowledge proofs, and on-chain consent — visualized below.
            </motion.p>
            <motion.div {...fadeUp(0.3)} className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/patient/dashboard"
                className="inline-flex h-14 items-center gap-2 rounded-2xl bg-[#00685f] px-8 text-base font-semibold text-white transition hover:bg-[#005a52]"
              >
                Open patient vault
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/patient/privacy-tour"
                className="inline-flex h-14 items-center rounded-2xl border border-[#00685f]/40 bg-white px-8 text-base font-semibold text-[#00685f] transition hover:bg-[#00685f]/5"
              >
                60-second privacy tour
              </Link>
            </motion.div>
          </div>
          <motion.div {...fadeUp(0.2)}>
            <HeroFlowDiagram reduce={reduce} />
          </motion.div>
        </div>
      </section>

      {/* Exposure comparison chart */}
      <section className="border-y border-[#bcc9c6]/40 bg-white px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <motion.div {...fadeUp(0)}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Benchmark</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
                Less exposure than traditional matching
              </h2>
              <p className="mt-4 leading-relaxed text-[#3d4947]">
                Illustrative risk index (0–100): how much sensitive health signal typically leaves patient control in
                legacy recruitment stacks vs. MedVault&apos;s encrypted pipeline.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-[#5a6a80]">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#94a3b8]" /> Traditional trial platforms
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#00685f]" /> MedVault architecture
                </li>
              </ul>
            </motion.div>
            <motion.div
              {...fadeUp(0.15)}
              className="h-[320px] rounded-[2rem] border border-[#bcc9c6]/60 bg-[#f7f9fb] p-4 pt-6 sm:h-[360px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureComparison} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#bcc9c6" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#5a6a80" }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={120}
                    tick={{ fontSize: 10, fill: NAVY }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="traditional" name="Traditional" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="medvault" name="MedVault" fill={TEAL} radius={[0, 4, 4, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stack + ZK strip */}
      <section className="px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <motion.div {...fadeUp(0)} className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Defense in depth</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
              Four layers between you and exposure
            </h2>
          </motion.div>
          <div className="grid gap-10 lg:grid-cols-2">
            <PrivacyStackDiagram />
            <div className="space-y-6">
              <ZkFlowStrip reduce={reduce} />
              <div className="grid gap-5 sm:grid-cols-3">
                {privacyLayers.map((item, i) => (
                  <motion.div
                    key={item.title}
                    {...fadeUp(i * 0.08)}
                    className="rounded-2xl border border-[#bcc9c6]/60 bg-white p-5"
                  >
                    <item.icon className="mb-3 h-6 w-6 text-[#00685f]" />
                    <h3 className="text-sm font-bold text-[#191c1e]">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#3d4947]">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Donut + consent area chart */}
      <section className="bg-[#e8f0ee]/50 px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <motion.div {...fadeUp(0)} className="mb-12 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Signal composition</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
              What actually reaches sponsors
            </h2>
            <p className="mt-4 text-[#3d4947]">
              Representative breakdown of sponsor-visible artifacts after matching — raw chart data stays at 0%.
            </p>
          </motion.div>
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              {...fadeUp(0.1)}
              className="flex flex-col items-center rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-6"
            >
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sponsorSignalMix.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {sponsorSignalMix
                        .filter((d) => d.value > 0)
                        .map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}%`, "Share"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 grid w-full gap-2 sm:grid-cols-2">
                {sponsorSignalMix.map((item) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs text-[#3d4947]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                    <span className="ml-auto font-mono font-semibold text-[#191c1e]">{item.value}%</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...fadeUp(0.2)}
              className="rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-6"
            >
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">
                Consent activity (example)
              </p>
              <p className="mb-4 text-sm text-[#5a6a80]">
                Grants vs. revokes over time — patients retain an auditable trail of every access decision.
              </p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={auditTrailTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grantGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TEAL} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revokeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5a6a80" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#5a6a80" }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="grants"
                      name="Grants"
                      stroke={TEAL}
                      fill="url(#grantGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="revokes"
                      name="Revokes"
                      stroke="#ef4444"
                      fill="url(#revokeGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Transparency with visual bars */}
      <section className="bg-white px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <motion.div {...fadeUp(0)}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Transparency</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
                What sponsors see — and what they never will
              </h2>
              <p className="mt-4 leading-relaxed text-[#3d4947]">
                Trial sponsors need enough signal to run ethical recruitment. They do not need your full chart. MedVault
                minimizes data by default and expands disclosure only with your consent.
              </p>
            </motion.div>
            <motion.div {...fadeUp(0.15)}>
              <DisclosureBars />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pipeline timeline */}
      <section className="px-6 py-16 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <motion.div {...fadeUp(0)} className="overflow-hidden rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">Pipeline</p>
            <h3 className="mt-2 text-xl font-bold text-[#191c1e]">From wallet to sponsor — nothing leaks in the middle</h3>
            <div className="relative mt-10 hidden sm:block">
              <div className="absolute left-0 right-0 top-5 h-0.5 bg-gradient-to-r from-[#89f5e7] via-[#00685f] to-[#8792fe]" />
              <div className="relative flex justify-between">
                {flowNodes.map((node, i) => (
                  <div key={node.id} className="flex max-w-[4.5rem] flex-col items-center text-center sm:max-w-none">
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#00685f] font-mono text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#191c1e] sm:text-sm">{node.label}</p>
                    <p className="mt-1 hidden text-[10px] text-[#5a6a80] sm:block">{node.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:hidden">
              {flowNodes.map((n, i) => (
                <span key={n.id} className="rounded-lg bg-[#f7f9fb] px-3 py-2 text-xs font-medium text-[#3d4947]">
                  {i + 1}. {n.label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Commitments */}
      <section className="px-6 py-12 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <motion.div {...fadeUp(0)} className="rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-6">
              <p className="mb-4 text-sm font-semibold text-[#191c1e]">Legacy vs. MedVault (quick check)</p>
              <div className="space-y-3">
                {[
                  { label: "Hospital exports to sponsor", legacy: true, mv: false },
                  { label: "FHE eligibility on ciphertext", legacy: false, mv: true },
                  { label: "On-chain consent log", legacy: false, mv: true },
                  { label: "Anonymous Semaphore apply", legacy: false, mv: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#bcc9c6]/40 px-4 py-3 text-sm"
                  >
                    <span className="text-[#3d4947]">{row.label}</span>
                    <div className="flex shrink-0 gap-6">
                      <span className="flex items-center gap-1.5 text-[#5a6a80]">
                        Legacy{" "}
                        {row.legacy ? (
                          <Check className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Minus className="h-4 w-4 text-[#bcc9c6]" />
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-[#00685f]">
                        MedVault{" "}
                        {row.mv ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4 text-[#bcc9c6]" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <div>
              <motion.h2 {...fadeUp(0)} className="text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
                Our privacy commitments
              </motion.h2>
              <ul className="mt-8 space-y-4">
                {commitments.map((text, i) => (
                  <motion.li
                    key={text}
                    {...fadeUp(0.08 + i * 0.06)}
                    className="flex gap-4 rounded-2xl border border-[#bcc9c6]/50 bg-white p-5"
                  >
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#00685f]" />
                    <span className="leading-relaxed text-[#3d4947]">{text}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Standards */}
      <section className="bg-[#e8f0ee]/60 px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <motion.h2 {...fadeUp(0)} className="text-center text-3xl font-bold tracking-tight text-[#191c1e]">
            Built for regulated health data
          </motion.h2>
          <motion.p {...fadeUp(0.1)} className="mx-auto mt-4 max-w-2xl text-center text-[#3d4947]">
            We design flows with health-privacy principles in mind (encryption at the edge, consent logs, minimized on-chain PHI). This is not a claim of HIPAA or GDPR certification — see compliance and security documentation for details.
          </motion.p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { icon: UserCheck, label: "Patient-owned keys", sub: "Encryption at the edge" },
              { icon: Lock, label: "FHE-ready vault", sub: "Compute without decrypting" },
              { icon: FileCheck, label: "Auditable consent", sub: "On-chain access logs" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                {...fadeUp(0.15 + i * 0.08)}
                className="rounded-2xl border border-[#bcc9c6]/50 bg-white p-8 text-center"
              >
                <item.icon className="mx-auto h-8 w-8 text-[#00685f]" />
                <p className="mt-4 font-semibold text-[#191c1e]">{item.label}</p>
                <p className="mt-1 text-sm text-[#5a6a80]">{item.sub}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUp(0.35)} className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to="/docs/compliance"
              className="text-sm font-semibold text-[#00685f] underline-offset-4 hover:underline"
            >
              Compliance documentation →
            </Link>
            <Link
              to="/docs/identity-privacy"
              className="text-sm font-semibold text-[#00685f] underline-offset-4 hover:underline"
            >
              Identity & privacy architecture →
            </Link>
            <Link to="/security" className="text-sm font-semibold text-[#00685f] underline-offset-4 hover:underline">
              Security overview →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center lg:px-14">
        <div className="mx-auto max-w-2xl">
          <motion.div
            {...fadeUp(0)}
            className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00685f]/10 text-[#00685f]"
          >
            <Lock className="h-8 w-8" />
          </motion.div>
          <motion.h2 {...fadeUp(0.1)} className="text-4xl font-bold tracking-tight text-[#191c1e]">
            Privacy is the product
          </motion.h2>
          <motion.p {...fadeUp(0.2)} className="mt-6 text-lg leading-relaxed text-[#3d4947]">
            Explore trials on your terms. Connect your wallet, fill your vault, and see exactly how matching works —
            without exposing who you are.
          </motion.p>
          <motion.div {...fadeUp(0.3)} className="mt-10">
            <Link
              to="/patient/dashboard"
              className="inline-flex h-14 items-center gap-2 rounded-2xl bg-[#00685f] px-10 text-base font-bold text-white transition hover:bg-[#005a52]"
            >
              Get started
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
