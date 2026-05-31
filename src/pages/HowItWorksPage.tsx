import { Fragment, useState, type ReactNode } from "react";
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Cpu,
  Database,
  EyeOff,
  FileCheck,
  Fingerprint,
  FlaskConical,
  KeyRound,
  Lock,
  Minus,
  Search,
  Shield,
  UserRound,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";

const viewport = { once: true as const, amount: 0.2 as const };
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: "easeOut" as const, delay },
});

const TEAL = "#00685f";
const MINT = "#89f5e7";
const VIOLET = "#8792fe";
const NAVY = "#0a2540";

const patientSteps = [
  {
    step: "01",
    title: "Connect wallet",
    body: "Sign in with Privy on Arbitrum Sepolia. Your wallet controls consent — not your hospital login.",
    detail: "MedVault never stores a password for your chart. You get an embedded wallet for testnet flows and optional Semaphore identity in the browser.",
    icon: KeyRound,
    accent: "#00685f",
    onDevice: "Privy sign-in · embedded wallet created",
    onChain: "Wallet address linked to vault permissions",
  },
  {
    step: "02",
    title: "Encrypt your vault",
    body: "Enter vitals locally; @cofhe/sdk encrypts each field before anything hits the RPC.",
    detail: "Age, labs, and flags become ciphertext handles. The network computes on sealed values — not plaintext exports.",
    icon: Lock,
    accent: "#00B4D8",
    onDevice: "Plaintext vitals · CoFHE encryption",
    onChain: "Ciphertext handles stored in Medical Vault",
  },
  {
    step: "03",
    title: "Match on ciphertext",
    body: "EligibilityEngine compares your encrypted profile to trial criteria with FHE gates.",
    detail: "Sponsors define ranges and conditions on-chain. You learn if you fit without publishing raw numbers to a public ledger.",
    icon: Search,
    accent: "#8792fe",
    onDevice: "Match UI · local decrypt preview (optional)",
    onChain: "FHE eligibility evaluation · match score handle",
  },
  {
    step: "04",
    title: "Apply anonymously",
    body: "Optional Semaphore path: prove membership and submit with a per-trial nullifier — unlinkable from your wallet.",
    detail: "Relayer-assisted staging keeps your main address off the apply transaction while CoFHE still verifies eligibility.",
    icon: Fingerprint,
    accent: "#00685f",
    onDevice: "Semaphore proof generation · nullifier",
    onChain: "Anonymous application record · ZK verified",
  },
  {
    step: "05",
    title: "Decrypt & certify",
    body: "Reveal your match score locally, then bind the result with a Noir proof verified by Honk on-chain.",
    detail: "Sponsors can see that a proof was accepted — not your underlying vitals. ZK certification is optional but demo-ready on Results.",
    icon: BadgeCheck,
    accent: "#06d6a0",
    onDevice: "Local decrypt · Noir witness",
    onChain: "HonkVerifier attestation · audit event",
  },
];

const sponsorSteps = [
  { title: "Define protocol", body: "Create trials, criteria, and incentive pools on-chain." },
  { title: "Review matches", body: "See applicant status, ZK badges, and blind-ranking pool size — not raw PHI." },
  { title: "Audit access", body: "Consent logs and DataAccessLog events document every read path." },
];

const neverShared = [
  "Raw age, Hb, or diagnosis strings on-chain",
  "Wallet ↔ Semaphore identity linkage in anonymous mode",
  "Decrypted scores without patient permit",
  "Lab PDFs or EHR credentials (no medical oracle in MVP)",
];

const pipeline = [
  { label: "Wallet", Icon: KeyRound },
  { label: "Encrypt", Icon: Lock },
  { label: "FHE match", Icon: Cpu },
  { label: "Consent", Icon: FileCheck },
  { label: "ZK proof", Icon: BadgeCheck },
  { label: "Audit", Icon: Shield },
];

const journeyFunnel = [
  { stage: "Connect", patients: 100 },
  { stage: "Vault", patients: 86 },
  { stage: "Match", patients: 62 },
  { stage: "Apply", patients: 41 },
  { stage: "Certify", patients: 28 },
];

const roleComparison = [
  { action: "Stores raw labs", patient: 0, sponsor: 0, platform: 0 },
  { action: "Defines criteria", patient: 0, sponsor: 100, platform: 0 },
  { action: "Runs FHE match", patient: 20, sponsor: 0, platform: 80 },
  { action: "Grants consent", patient: 100, sponsor: 0, platform: 0 },
  { action: "Views match proof", patient: 100, sponsor: 40, platform: 0 },
];

function FlowLines({
  reduce,
  trackClassName = "bg-[#6bd8cb]/70",
}: {
  reduce: boolean;
  trackClassName?: string;
}) {
  return (
    <div className="flex w-full flex-col justify-center gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[3px] w-full overflow-hidden rounded-full bg-[#bcc9c6]/30">
          <motion.div
            className={cn("h-full w-full rounded-full", trackClassName)}
            animate={reduce ? { opacity: 0.85 } : { opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.6,
              repeat: reduce ? 0 : Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function DataFlowConnector({
  reduce,
  label,
  left,
  right,
  trackClassName,
}: {
  reduce: boolean;
  label: string;
  left: ReactNode;
  right: ReactNode;
  trackClassName?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 pb-8 pt-6">
      <div className="shrink-0">{left}</div>
      <div className="relative min-w-0 flex-1">
        <FlowLines reduce={reduce} trackClassName={trackClassName} />
        <p className="absolute -bottom-5 left-0 right-0 text-center font-mono text-[9px] font-semibold uppercase tracking-wider text-[#5a6a80]">
          {label}
        </p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function ConnectIllus({ reduce }: { reduce: boolean }) {
  return (
    <DataFlowConnector
      reduce={reduce}
      label="Linking wallet"
      trackClassName="bg-gradient-to-r from-[#6bd8cb] via-[#89f5e7] to-[#00685f]"
      left={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4fd] ring-1 ring-[#bcc9c6]/40">
          <UserRound className="h-5 w-5 text-[#0a2540]" strokeWidth={1.7} />
        </div>
      }
      right={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00685f]/10 ring-1 ring-[#6bd8cb]/30">
          <Database className="h-5 w-5 text-[#00685f]" strokeWidth={1.7} />
        </div>
      }
    />
  );
}

function EncryptIllus({ reduce }: { reduce: boolean }) {
  return (
    <DataFlowConnector
      reduce={reduce}
      label="Encrypting locally"
      trackClassName="bg-gradient-to-r from-[#00B4D8] via-[#89f5e7] to-[#8792fe]"
      left={
        <div className="flex h-10 w-10 flex-col justify-center gap-[3px] rounded-xl bg-[#e8f4fd] px-2.5 py-2 ring-1 ring-[#bcc9c6]/40">
          {[72, 88, 60].map((w) => (
            <div key={w} className="h-[3px] w-full rounded-full bg-[#0a2540]/15">
              <div className="h-full rounded-full bg-[#0a2540]/40" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      }
      right={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8792fe]/15 ring-1 ring-[#8792fe]/35">
          <div className="relative">
            <Database className="h-5 w-5 text-[#5a4a9e]" strokeWidth={1.7} />
            <Lock className="absolute -bottom-1 -right-1 h-3 w-3 text-[#00685f]" strokeWidth={2.5} />
          </div>
        </div>
      }
    />
  );
}

function MatchIllus() {
  const rows = [
    { label: "CBC · recent", match: true },
    { label: "Age 31–55", match: true },
    { label: "Cardiac Rx", match: false },
  ];
  return (
    <div className="flex flex-col gap-1.5 px-4 py-4">
      {rows.map((row, i) => (
        <motion.div
          key={i}
          className="flex items-center justify-between rounded-lg border border-[#bcc9c6]/50 bg-white px-3 py-2"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
        >
          <span className="font-mono text-[10px] text-[#5a6a80]">{row.label}</span>
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full",
              row.match ? "bg-[#06d6a0]/20" : "bg-[#bcc9c6]/30"
            )}
          >
            {row.match ? (
              <Check className="h-2.5 w-2.5 text-[#00685f]" strokeWidth={3} />
            ) : (
              <Minus className="h-2.5 w-2.5 text-[#5a6a80]" strokeWidth={3} />
            )}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function ProofIllus({ reduce }: { reduce: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-5">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#06d6a0]/15">
        <BadgeCheck className="h-6 w-6 text-[#00685f]" strokeWidth={1.8} />
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full ring-2 ring-[#06d6a0]/40"
            animate={{ scale: [1, 1.7], opacity: [0.7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">ZK proof accepted</p>
      <p className="font-mono text-[9px] text-[#5a6a80]">nullifier bound · HonkVerifier</p>
    </div>
  );
}

function StepPreviewIllus({ index, reduce }: { index: number; reduce: boolean }) {
  if (index === 0) return <ConnectIllus reduce={reduce} />;
  if (index === 1) return <EncryptIllus reduce={reduce} />;
  if (index <= 3) return <MatchIllus />;
  return <ProofIllus reduce={reduce} />;
}

function OverviewPipeline({ reduce }: { reduce: boolean }) {
  return (
    <div className="rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(10,37,64,0.12)] sm:p-6">
      <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">
        Platform overview
      </p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[22rem] items-center justify-between gap-0 sm:min-w-0">
          {pipeline.map((node, i) => (
            <Fragment key={node.label}>
              <div className="flex w-14 shrink-0 flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00685f]/10 text-[#00685f] sm:h-12 sm:w-12">
                  <node.Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <span className="mt-2 text-center text-[10px] font-semibold text-[#191c1e] sm:text-xs">
                  {node.label}
                </span>
              </div>
              {i < pipeline.length - 1 && (
                <div className="flex min-w-[1.75rem] flex-1 flex-col items-center gap-1 px-0.5">
                  <span className="font-mono text-[8px] font-semibold uppercase tracking-wide text-[#5a6a80] sm:text-[9px]">
                    log
                  </span>
                  <div className="flex w-full items-center">
                    <motion.div
                      className="h-px flex-1 origin-left bg-gradient-to-r from-[#89f5e7] to-[#00685f]"
                      animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    />
                    <ChevronRight className="-ml-0.5 h-3.5 w-3.5 shrink-0 text-[#00685f]" />
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeviceVsChainPanel({ stepIndex }: { stepIndex: number }) {
  const step = patientSteps[stepIndex];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-[#bcc9c6]/50 bg-[#e8f4fd]/50 p-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#0a2540]">On your device</p>
        <p className="mt-2 text-sm leading-relaxed text-[#3d4947]">{step.onDevice}</p>
      </div>
      <div className="rounded-xl border border-[#6bd8cb]/40 bg-[#89f5e7]/10 p-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#00685f]">On Arbitrum Sepolia</p>
        <p className="mt-2 text-sm leading-relaxed text-[#3d4947]">{step.onChain}</p>
      </div>
    </div>
  );
}

function SwimlaneDiagram() {
  const lanes = [
    { role: "Patient", color: TEAL, items: ["Connect wallet", "Encrypt vault", "Grant consent", "Apply / certify"] },
    { role: "MedVault (FHE + ZK)", color: VIOLET, items: ["Eligibility engine", "CoFHE ops", "Semaphore / Noir", "Audit log"] },
    { role: "Sponsor", color: NAVY, items: ["Publish trial", "Set criteria", "Review proofs", "Incentivize cohort"] },
  ];
  return (
    <div className="space-y-3">
      {lanes.map((lane) => (
        <div key={lane.role} className="rounded-2xl border border-[#bcc9c6]/50 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane.color }} />
            <span className="text-sm font-bold text-[#191c1e]">{lane.role}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lane.items.map((item, i) => (
              <Fragment key={item}>
                <span className="rounded-lg bg-[#f7f9fb] px-3 py-1.5 text-xs font-medium text-[#3d4947]">{item}</span>
                {i < lane.items.length - 1 && (
                  <ChevronRight className="hidden h-4 w-4 shrink-0 self-center text-[#bcc9c6] sm:block" aria-hidden />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HowItWorksPage() {
  const reduce = !!useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const current = patientSteps[activeStep];
  const StepIcon = current.icon;

  return (
    <div className="bg-[#f7f9fb] text-[#191c1e]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-24 lg:px-14">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-[#89f5e7]/25 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#8792fe]/15 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-[1220px] gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <p className="font-mono text-xs uppercase tracking-widest text-[#00685f]">How MedVault works</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[#191c1e] md:text-5xl md:leading-[1.08]">
              From encrypted vault to trial proof —{" "}
              <span className="text-[#00685f]">without exposing your chart</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#3d4947]">
              MedVault separates identity, computation, and disclosure. Follow the patient journey, see what runs on your
              device vs. on-chain, and how sponsors recruit with proofs — not PHI lakes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/patient/dashboard"
                className="inline-flex h-14 items-center gap-2 rounded-2xl bg-[#00685f] px-8 text-base font-semibold text-white transition hover:bg-[#005a52]"
              >
                Start as patient
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/sponsor/dashboard"
                className="inline-flex h-14 items-center rounded-2xl border border-[#00685f]/40 bg-white px-8 text-base font-semibold text-[#00685f] transition hover:bg-[#00685f]/5"
              >
                Sponsor console
              </Link>
              <Link
                to="/privacy"
                className="inline-flex h-14 items-center rounded-2xl border border-[#bcc9c6] px-6 text-base font-semibold text-[#3d4947] transition hover:bg-white"
              >
                Privacy overview
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
            <OverviewPipeline reduce={reduce} />
          </motion.div>
        </div>
      </section>

      {/* Funnel + swimlanes */}
      <section className="border-y border-[#bcc9c6]/40 bg-white px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-12 lg:grid-cols-2">
            <motion.div {...fadeUp(0)}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Patient funnel</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Typical discovery path</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#3d4947]">
                Illustrative completion rates across the five-step journey on testnet — each stage keeps prior privacy
                guarantees.
              </p>
              <div className="mt-6 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={journeyFunnel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#5a6a80" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#5a6a80" }} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Patients"]} />
                    <Area
                      type="monotone"
                      dataKey="patients"
                      stroke={TEAL}
                      fill="url(#funnelGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            <motion.div {...fadeUp(0.1)}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Three-party flow</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Who does what</h2>
              <p className="mt-3 mb-6 text-sm leading-relaxed text-[#3d4947]">
                Patients own keys and consent. MedVault runs FHE and ZK. Sponsors define protocols and review proofs.
              </p>
              <SwimlaneDiagram />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive patient journey */}
      <section className="px-6 py-16 lg:px-14 lg:py-20">
        <div className="mx-auto max-w-[1220px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.45, ease }}
            className="max-w-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Patient journey</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Five steps, one privacy stack</h2>
            <p className="mt-3 leading-relaxed text-[#3d4947]">
              Select a step to preview the flow, then compare what stays on your device versus what is recorded on-chain.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-12">
            <div className="flex flex-col gap-2">
              {patientSteps.map((s, idx) => {
                const Icon = s.icon;
                const isActive = idx === activeStep;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={cn(
                      "group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all",
                      isActive
                        ? "border-[#6bd8cb]/60 bg-white shadow-[0_12px_32px_-16px_rgba(0,104,95,0.25)] ring-1 ring-[#6bd8cb]/30"
                        : "border-transparent bg-white/60 hover:border-[#bcc9c6]/60 hover:bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black text-white transition-colors",
                        isActive ? "bg-[#0a2540]" : "bg-[#bcc9c6]/80 text-[#3d4947]"
                      )}
                    >
                      {s.step}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4 shrink-0"
                          style={{ color: isActive ? s.accent : "#5a6a80" }}
                          strokeWidth={1.75}
                        />
                        <h3 className={cn("font-bold", isActive ? "text-[#191c1e]" : "text-[#3d4947]")}>{s.title}</h3>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#5a6a80]">{s.body}</p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "mt-3 h-4 w-4 shrink-0 transition-transform",
                        isActive ? "translate-x-0.5 text-[#00685f]" : "text-[#bcc9c6] opacity-0 group-hover:opacity-100"
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease }}
              className="overflow-hidden rounded-[2rem] border border-[#bcc9c6]/50 bg-white shadow-[0_24px_48px_-24px_rgba(10,37,64,0.15)]"
            >
              <div
                className="border-b border-[#bcc9c6]/40 px-6 py-5"
                style={{ background: `linear-gradient(135deg, ${current.accent}18 0%, transparent 55%)` }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0a2540] text-white">
                    <StepIcon className="h-6 w-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00685f]">
                      Step {current.step}
                    </p>
                    <h3 className="text-xl font-bold text-[#191c1e]">{current.title}</h3>
                  </div>
                </div>
              </div>
              <div className="border-b border-[#bcc9c6]/50 bg-[#f7f9fb]">
                <StepPreviewIllus index={activeStep} reduce={reduce} />
                {activeStep === 3 && (
                  <p className="pb-3 text-center text-xs font-semibold text-[#5a6a80]">
                    Semaphore nullifier — wallet stays off the apply tx
                  </p>
                )}
              </div>
              <div className="space-y-4 p-6 sm:p-8">
                <p className="text-sm leading-relaxed text-[#3d4947]">{current.body}</p>
                <DeviceVsChainPanel stepIndex={activeStep} />
                <p className="rounded-xl border border-[#89f5e7]/40 bg-[#89f5e7]/10 px-4 py-3 text-sm leading-relaxed text-[#00685f]">
                  {current.detail}
                </p>
                {activeStep === 4 && (
                  <Link
                    to="/patient/results"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#00685f] hover:underline"
                  >
                    Try decrypt &amp; certify on Results
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {activeStep === 1 && (
                  <Link
                    to="/patient/medical-vault"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#00685f] hover:underline"
                  >
                    Open medical vault
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Role responsibility chart */}
      <section className="bg-[#e8f0ee]/50 px-6 py-20 lg:px-14">
        <div className="mx-auto max-w-[1220px]">
          <motion.div {...fadeUp(0)} className="mb-10 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Responsibilities</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Where each role participates</h2>
            <p className="mt-3 text-[#3d4947]">
              Illustrative involvement index (0–100) — shows that sponsors never reach 100% on patient-controlled actions.
            </p>
          </motion.div>
          <motion.div {...fadeUp(0.1)} className="h-[300px] rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleComparison} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e6" />
                <XAxis dataKey="action" tick={{ fontSize: 10, fill: "#5a6a80" }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#5a6a80" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="patient" name="Patient" fill={TEAL} radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="sponsor" name="Sponsor" fill={NAVY} radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="platform" name="MedVault" fill={VIOLET} radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </section>

      {/* Sponsor + never shared */}
      <section className="border-y border-[#bcc9c6]/40 bg-white px-6 py-16 lg:px-14 lg:py-20">
        <div className="mx-auto grid max-w-[1220px] gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.45, ease }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">For sponsors</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Recruit without a data lake of PHI</h2>
            <ul className="mt-6 space-y-4">
              {sponsorSteps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a2540]/5 font-mono text-xs font-bold text-[#00685f]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[#191c1e]">{s.title}</p>
                    <p className="mt-0.5 text-sm text-[#5a6a80]">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/sponsor/active-trials"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#00685f] hover:underline"
            >
              View active protocols
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.45, delay: 0.08, ease }}
            className="rounded-[2rem] border border-[#bcc9c6]/50 bg-[#f7f9fb] p-6 sm:p-8"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a2540] text-white">
                <EyeOff className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-bold">What never hits the chain</h3>
            </div>
            <ul className="space-y-3">
              {neverShared.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#3d4947]">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#00685f]" strokeWidth={2} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/privacy"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#00685f] hover:underline"
            >
              Full privacy breakdown
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 pt-4 lg:px-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="mx-auto max-w-[1220px] overflow-hidden rounded-[2rem] bg-[#0a2540] px-8 py-12 text-center sm:px-12"
        >
          <FlaskConical className="mx-auto h-10 w-10 text-[#89f5e7]" strokeWidth={1.5} />
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Ready to try the full flow?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/75">
            Register your vault, browse trials on testnet, and see FHE + ZK certification on your own wallet.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/patient/find-trials"
              className="inline-flex items-center gap-2 rounded-full bg-[#89f5e7] px-6 py-3 text-sm font-bold text-[#0a2540]"
            >
              Find trials
              <Zap className="h-4 w-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Technical docs
              <FileCheck className="h-4 w-4" />
            </Link>
            <Link
              to="/technology"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Technology
              <Building2 className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
