import { Fragment, useEffect, useId, useRef, useState, type ComponentType, type SVGProps } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cpu,
  Database,
  Dna,
  Download,
  ExternalLink,
  Eye,
  MessageCircle,
  Newspaper,
  FileCheck,
  FileText,
  Fingerprint,
  HelpCircle,
  FlaskConical,
  Globe,
  ImageIcon,
  KeyRound,
  Lock,
  Pill,
  Server,
  Shield,
  Smartphone,
  UserCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { McpLandingSection } from "../components/landing/McpLandingSection";
import { LandingClosingSection } from "../components/landing/LandingClosingSection";
import { CoinbaseWalletIcon, MetaMaskIcon, WalletConnectIcon } from "../components/landing/WalletBrandIcons";
import brandLogoUrl from "../../logo/logo.png";

/* ─── shared animation config ─────────────────────────────────────────────── */

const viewportBase = { once: true as const, amount: 0.25 as const };

const transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

const zamaSpringSoft = { type: "spring" as const, stiffness: 280, damping: 32 };

/* ─── data ─────────────────────────────────────────────────────────────────── */

const pillars = [
  {
    icon: UserCheck,
    title: "Anonymous matching",
    text: "Semaphore-style identity lets you apply anonymously; Zama FHE computes the match and Noir seals a compliance receipt without exposing PHI.",
  },
  {
    icon: Lock,
    title: "Encrypted in use",
    text: "FHE-friendly flows keep sensitive signals in ciphertext while policies run on-chain.",
  },
  {
    icon: Shield,
    title: "Auditable consent",
    text: "Grant and revoke sponsor access with cryptographic trails you can review anytime.",
  },
];

type HowItWorksIllustrationKind = "wallet" | "encrypt" | "consent" | "revoke";

const howItWorksSteps: Array<{
  step: string;
  title: string;
  body: string;
  illustration: HowItWorksIllustrationKind;
}> = [
  {
    step: "01",
    title: "Connect Your Wallet",
    body: "Connect any EIP-1193 wallet in seconds. No sign-ups or passwords.",
    illustration: "wallet",
  },
  {
    step: "02",
    title: "Encrypt & Own Your Data",
    body: "Your health records are encrypted client-side; only you hold the keys.",
    illustration: "encrypt",
  },
  {
    step: "03",
    title: "Grant Consent",
    body: "Approve exactly which doctors, sponsors, or trials can access specific data.",
    illustration: "consent",
  },
  {
    step: "04",
    title: "Revoke Anytime",
    body: "Full audit trail and one-click revocation of any access grant.",
    illustration: "revoke",
  },
];

const trustSignals = [
  "Health-data aware",
  "Semaphore attestation",
  "Patient-Owned Keys",
  "256-bit Encryption",
  "Open Source",
];

const stats = [
  { label: "Patient Records Protected", value: 12400, suffix: "+" },
  { label: "Healthcare Providers", value: 340, suffix: "+" },
  { label: "Consent checkpoints", value: 4, suffix: "" },
  { label: "Uptime", value: 99.97, suffix: "%", decimals: 2 },
];

const infraLayers = [
  {
    icon: Shield,
    title: "Identity & Consent Layer",
    body: "Wallet auth, role checks, and revocable consent policies gate every read path before data access.",
    tone: "from-[#89f5e7]/35 to-[#6bd8cb]/20",
    accentHex: "#6bd8cb",
  },
  {
    icon: Database,
    title: "Encrypted Data Layer",
    body: "Records stay encrypted at rest and in transit with tamper-evident logs for every sponsor interaction.",
    tone: "from-[#8792fe]/25 to-[#89f5e7]/15",
    accentHex: "#8792fe",
  },
  {
    icon: Server,
    title: "Proof & Compute Layer",
    body: "Eligibility runs through ZK/FHE-compatible workflows so sponsors see proofs, not patient identifiers.",
    tone: "from-[#c5cae9]/35 to-[#8792fe]/15",
    accentHex: "#c5cae9",
  },
];

const infraFlow = ["Wallet Auth", "Consent Policy", "Encrypted Match", "ZK Proof", "Audit Log"];

const trustItems = [
  { label: "Health-data aware", Icon: Shield },
  { label: "FHE Input Proofs", Icon: Eye },
  { label: "Patient-Owned Keys", Icon: KeyRound },
  { label: "256-bit Encryption", Icon: Lock },
  { label: "Open Source", Icon: Globe },
  { label: "Auditable Consent", Icon: BadgeCheck },
  { label: "Privacy-First", Icon: Fingerprint },
  { label: "FHE-Ready", Icon: Cpu },
];

/** Public links — headlines shortened; blurbs summarize the topic, not verbatim quotes. */
type CommunityPlatform = "reddit" | "stackoverflow" | "hackernews" | "arxiv" | "security";

const medicalPrivacyVoices: Array<{
  id: string;
  url: string;
  platform: CommunityPlatform;
  source: string;
  meta: string;
  accent: string;
  headline: string;
  blurb: string;
}> = [
  {
    id: "mp-1",
    url: "https://www.reddit.com/r/privacy/comments/1fblu6e/each_doctors_visit_sends_your_data_through_a/",
    platform: "reddit",
    source: "r/privacy",
    meta: "Reddit · public thread",
    accent: "#00685f",
    headline: "Each doctor’s visit sends your data through a dozen companies",
    blurb: "Discussion of billing, vendors, and intermediaries that may handle visit data beyond your clinician.",
  },
  {
    id: "mp-2",
    url: "https://stackoverflow.com/questions/8967840/securing-sensitive-user-data-healthcare-saas",
    platform: "stackoverflow",
    source: "Stack Overflow",
    meta: "Healthcare SaaS · security",
    accent: "#f48024",
    headline: "Securing sensitive user data in a healthcare SaaS",
    blurb: "Builders debate plain-text medical records, breach expectations, and HIPAA-aligned encryption at rest.",
  },
  {
    id: "mp-3",
    url: "https://news.ycombinator.com/item?id=37329261",
    platform: "hackernews",
    source: "Hacker News",
    meta: "HN discussion",
    accent: "#ff6600",
    headline: "Why shared hospital rooms don’t “violate HIPAA”",
    blurb: "Comment thread on what HIPAA actually protects, covered entities, and limits on patient control.",
  },
  {
    id: "mp-4",
    url: "https://www.reddit.com/r/healthIT/comments/1menyte/ai_hipaa_and_hospital_portals_unified_portal_with/",
    platform: "reddit",
    source: "r/healthIT",
    meta: "Reddit · public thread",
    accent: "#00B4D8",
    headline: "AI, HIPAA, and unified hospital portals",
    blurb: "Debate on aggregating portal data and using AI on exports — security and policy angles.",
  },
  {
    id: "mp-5",
    url: "https://security.stackexchange.com/questions/197750/what-is-the-point-of-hipaa-de-identification-re-identification",
    platform: "security",
    source: "Security Stack Exchange",
    meta: "HIPAA · de-identification",
    accent: "#8792fe",
    headline: "What is the point of HIPAA de-identification if you keep re-ID keys?",
    blurb: "Explains when pseudonymous samples, lab workflows, and linkage keys still count as PHI.",
  },
  {
    id: "mp-6",
    url: "https://arxiv.org/abs/2511.09043",
    platform: "arxiv",
    source: "arXiv",
    meta: "cs.CR · federated learning",
    accent: "#b31b1b",
    headline: "Privacy-preserving federated learning for healthcare (MedHE)",
    blurb: "Research on homomorphic encryption and gradient sparsification for collaborative models without raw data pooling.",
  },
  {
    id: "mp-7",
    url: "https://www.reddit.com/r/privacy/comments/1se8uxf/unknown_to_most_your_health_history_is_not/",
    platform: "reddit",
    source: "r/privacy",
    meta: "Reddit · public thread",
    accent: "#008378",
    headline: "Your health history is not as private as people assume",
    blurb: "Thread on what HIPAA does and does not block, and where expectations diverge from practice.",
  },
  {
    id: "mp-8",
    url: "https://stackoverflow.com/questions/68515615/how-to-protect-client-data-on-the-cloud-from-the-developers-and-the-deployment-t",
    platform: "stackoverflow",
    source: "Stack Overflow",
    meta: "Medical software · cloud",
    accent: "#f48024",
    headline: "Keeping patient data private from your own dev and ops team",
    blurb: "A clinician-led product asks how to deploy on cloud without vendors or engineers reading the database.",
  },
  {
    id: "mp-9",
    url: "https://news.ycombinator.com/item?id=35002882",
    platform: "hackernews",
    source: "Hacker News",
    meta: "HN discussion",
    accent: "#ff6600",
    headline: "HIPAA scope for cash-only vs. in-network providers",
    blurb: "Health-tech founders and lawyers argue entity-level coverage, hybrid entities, and mental-health carve-outs.",
  },
  {
    id: "mp-10",
    url: "https://www.reddit.com/r/healthcare/comments/1sqb7um/ai_agents_accessing_patient_data_how_are_you/",
    platform: "reddit",
    source: "r/healthcare",
    meta: "Reddit · public thread",
    accent: "#06d6a0",
    headline: "AI agents and patient data — proving authorization",
    blurb: "Clinicians and builders discuss how to evidence what automated tools were allowed to access.",
  },
  {
    id: "mp-11",
    url: "https://security.stackexchange.com/questions/91438/are-internal-patient-identifiers-considered-phi-under-hipaa",
    platform: "security",
    source: "Security Stack Exchange",
    meta: "HIPAA · identifiers",
    accent: "#8792fe",
    headline: "Are internal patient IDs PHI when used in API query strings?",
    blurb: "When a GUID alone is not PHI versus when linking it to clinical data triggers HIPAA obligations.",
  },
  {
    id: "mp-12",
    url: "https://www.reddit.com/r/23andme/comments/1ayw9y3/what_specific_privacy_concerns_do_you_have_about/",
    platform: "reddit",
    source: "r/23andme",
    meta: "Reddit · public thread",
    accent: "#008378",
    headline: "Privacy concerns about 23andMe and DTC genetics",
    blurb: "Users list worries after breaches and policy changes — typical direct-to-consumer genetics concerns.",
  },
];

const medicalPrivacyTop = medicalPrivacyVoices.slice(0, 6);
const medicalPrivacyBottom = medicalPrivacyVoices.slice(6, 12);

/* ─── types ─────────────────────────────────────────────────────────────────── */

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

const platformIcons: Record<CommunityPlatform, LucideIcon> = {
  reddit: MessageCircle,
  stackoverflow: HelpCircle,
  hackernews: Newspaper,
  arxiv: FileText,
  security: Shield,
};

type OrbitNode = {
  key: string;
  icon: LucideIcon;
  label: string;
  sub: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay: number;
  accent: string;
};

const orbitNodes: OrbitNode[] = [
  { key: "imaging", icon: ImageIcon,     label: "Imaging", sub: "MRI 2026",     position: { top: "24%",    left: "2%"   }, delay: 0.0, accent: "#00B4D8" },
  { key: "ehr",     icon: ClipboardList, label: "EHR",     sub: "0x91\u2026a2", position: { top: "30%",    right: "-2%" }, delay: 0.4, accent: "#00B4D8" },
  { key: "lab",     icon: FlaskConical,  label: "Lab",     sub: "CBC 03/12",    position: { top: "52%",    right: "-6%" }, delay: 0.2, accent: "#06D6A0" },
  { key: "rx",      icon: Pill,          label: "Rx",      sub: "3 active",     position: { bottom: "14%", right: "20%" }, delay: 0.9, accent: "#00685F" },
  { key: "gene",    icon: Dna,           label: "Gene",    sub: "AES-256",      position: { bottom: "30%", left: "-2%"  }, delay: 0.6, accent: "#00B4D8" },
];

/* ─── Hero orbit ───────────────────────────────────────────────────────────── */

/** Seconds for one full orbit (dashed rings + cards); keep slow for a calm hero. */
const HERO_ORBIT_PERIOD_SEC = 132;

const heroOrbitTransition = {
  duration: HERO_ORBIT_PERIOD_SEC,
  repeat: Infinity,
  ease: "linear" as const,
};

/** Outer dashed ring is 92% of box → radius 46% from center; anchor badge centers on that circle. */
const HERO_OUTER_ORBIT_RADIUS_PCT = 46;

function HeroOrbit({ reduce }: { reduce: boolean }) {
  return (
    <div className="pointer-events-none relative mx-auto aspect-square w-full max-w-[560px] select-none" aria-hidden>
      <motion.div
        className="absolute inset-[4%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(107,216,203,0.55), rgba(137,245,231,0.30) 55%, rgba(255,255,255,0) 80%)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.04, 1], opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute inset-0 origin-center"
        animate={reduce ? { rotate: 0 } : { rotate: 360 }}
        transition={heroOrbitTransition}
      >
        {[92, 72, 52].map((size, i) => (
          <div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
            style={{ width: `${size}%`, height: `${size}%`, borderColor: `rgba(10,37,64,${0.08 + i * 0.04})` }}
          />
        ))}

        {/* Top of outer orbit: center = (50%, 50% - r); static translate so counter-rotate pivots on the ring */}
        <div
          className="absolute left-1/2 w-max max-w-[min(280px,52vw)] -translate-x-1/2 -translate-y-1/2"
          style={{ top: `calc(50% - ${HERO_OUTER_ORBIT_RADIUS_PCT}%)` }}
        >
          <motion.div
            className="flex justify-center origin-center"
            animate={reduce ? { rotate: 0 } : { rotate: -360 }}
            transition={heroOrbitTransition}
          >
            <motion.div
              className="flex w-full max-w-[280px] items-center gap-2 rounded-full border border-[#bcc9c6]/60 bg-white/95 px-3 py-2 shadow-[0_10px_24px_-12px_rgba(10,37,64,0.35)] backdrop-blur-sm"
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#06d6a0]">
                <BadgeCheck className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[11px] font-bold text-[#0a2540]">ZK-Proof Verified</p>
                <p className="truncate font-mono text-[9px] text-[#5a6a80]">proof 0xa3…c9f · 2s ago</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {orbitNodes.map((node, i) => (
          <OrbitNodePill key={node.key} node={node} reduce={reduce} index={i} />
        ))}
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-1/2 z-10 flex aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a2540] shadow-[0_14px_30px_-10px_rgba(10,37,64,0.45)] ring-[6px] ring-white"
        animate={reduce ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <UserRound className="h-[48%] w-[48%] text-white" strokeWidth={1.6} />
        <span className="absolute right-[4%] top-[8%] flex h-[24%] w-[24%] items-center justify-center rounded-full bg-[#06d6a0] ring-[3px] ring-white">
          <Check className="h-[60%] w-[60%] text-white" strokeWidth={3.2} />
        </span>
      </motion.div>
    </div>
  );
}

function OrbitNodePill({ node, reduce, index }: { node: OrbitNode; reduce: boolean; index: number }) {
  const Icon = node.icon;
  return (
    <motion.div
      className="absolute origin-center"
      style={node.position}
      animate={reduce ? { rotate: 0 } : { rotate: -360 }}
      transition={heroOrbitTransition}
    >
      <motion.div
        className="flex min-w-[120px] max-w-[46%] items-center gap-2 rounded-2xl border border-[#bcc9c6]/60 bg-white/95 px-2.5 py-2 shadow-[0_10px_24px_-12px_rgba(10,37,64,0.25)] backdrop-blur-sm"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut", delay: node.delay }}
      >
        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${node.accent}1A`, color: node.accent }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
          {!reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ border: `2px solid ${node.accent}` }}
              animate={{ scale: [1, 1.8, 2.2], opacity: [0.55, 0.08, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: index * 0.35 }}
            />
          )}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-bold text-[#0a2540]">{node.label}</p>
          <p className="truncate font-mono text-[10px] text-[#5a6a80]">{node.sub}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Community voices — marquee cards + scroll-linked accent line ────── */

type MedicalVoice = (typeof medicalPrivacyVoices)[number];
type MarqueeRowId = "top" | "bottom";

function CommunitySourceIcon({ platform, accent }: { platform: CommunityPlatform; accent: string }) {
  const Icon = platformIcons[platform];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-white/80"
      style={{ backgroundColor: `${accent}18`, color: accent, boxShadow: `0 0 0 1px ${accent}30` }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

function MedicalPrivacyPostCard({
  v,
  selected,
  onPick,
}: {
  v: MedicalVoice;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={cn(
        "group relative flex shrink-0 cursor-pointer flex-col rounded-2xl border bg-white text-left transition duration-300",
        "w-[calc((100vw-1.5rem-2.25rem)/1.15)] min-[400px]:w-[calc((100vw-2rem-2rem)/2.05)] min-[640px]:w-[calc((100vw-3rem)/3.2)] min-[1024px]:w-[320px]",
        "min-h-[220px] border-[#bcc9c6]/45 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_32px_-20px_rgba(10,37,64,0.14)]",
        "hover:border-[#6bd8cb]/55 hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_20px_44px_-18px_rgba(0,104,95,0.16)]",
        selected && "z-[1] scale-[1.02] border-[#6bd8cb]/70 ring-2 ring-[#6bd8cb]/30 shadow-[0_20px_48px_-16px_rgba(0,104,95,0.2)]"
      )}
      aria-pressed={selected}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <CommunitySourceIcon platform={v.platform} accent={v.accent} />
            <div className="min-w-0 pt-0.5">
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block truncate text-sm font-semibold leading-tight transition hover:underline"
                style={{ color: v.accent }}
              >
                {v.source}
              </a>
              <p className="mt-0.5 truncate text-xs text-[#5a6a80]">{v.meta}</p>
            </div>
          </div>
          <a
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open thread: ${v.headline}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5a6a80]/70 opacity-60 transition hover:bg-[#f7f9fb] hover:text-[#00685f] hover:opacity-100"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        </div>

        <a
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mb-2 block text-[15px] font-bold leading-snug text-[#191c1e] [text-wrap:pretty] transition group-hover:text-[#008378] sm:text-base"
        >
          {v.headline}
        </a>
        <p className="line-clamp-4 flex-1 text-[13px] leading-relaxed text-[#5a6a80]">{v.blurb}</p>
      </div>
    </article>
  );
}

function MedicalPrivacyMarqueeRow({
  items,
  direction,
  reduce,
  selectedId,
  onCardClick,
}: {
  items: MedicalVoice[];
  direction: "left" | "right";
  reduce: boolean;
  selectedId: string | null;
  onCardClick: (row: MarqueeRowId, v: MedicalVoice) => void;
}) {
  const [isHoveringRow, setIsHoveringRow] = useState(false);
  const rowId: MarqueeRowId = direction === "left" ? "top" : "bottom";

  const card = (v: MedicalVoice, keySuffix: string) => (
    <MedicalPrivacyPostCard
      key={`${v.id}${keySuffix}`}
      v={v}
      selected={selectedId === v.id}
      onPick={() => onCardClick(rowId, v)}
    />
  );

  if (reduce) {
    return (
      <div className="flex flex-wrap justify-center gap-4 px-2">
        {items.map((v) => card(v, ""))}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden py-1"
      role="region"
      aria-label={direction === "left" ? "Scrolling community concerns, left" : "Scrolling community concerns, right"}
      onMouseEnter={() => setIsHoveringRow(true)}
      onMouseLeave={() => setIsHoveringRow(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-[#f7f9fb] from-20% to-transparent sm:w-14"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[#f7f9fb] from-20% to-transparent sm:w-14"
      />
      <div
        className={cn(
          "flex w-max gap-4",
          direction === "left" ? "mv-marq-track-left" : "mv-marq-track-right",
          isHoveringRow && "mv-marq-paused"
        )}
      >
        <div className="flex gap-4">{items.map((v) => card(v, ""))}</div>
        <div className="flex gap-4" aria-hidden>
          {items.map((v) => card(v, "-loop"))}
        </div>
      </div>
    </div>
  );
}

function MedicalPrivacyVoicesBento() {
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onCardClick = (_row: MarqueeRowId, v: MedicalVoice) => {
    setSelectedId((prev) => (prev === v.id ? null : v.id));
  };

  return (
    <section
      className="relative border-b border-[#bcc9c6]/35 bg-[#f7f9fb] px-4 py-20 sm:px-8"
      id="medical-privacy-risks"
      aria-labelledby="medical-privacy-risks-heading"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#89f5e7]/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#8792fe]/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-screen-xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={reduce ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
          transition={transition}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Real questions people ask</p>
          <h2
            id="medical-privacy-risks-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl"
          >
            Medical data doesn’t stay in one place —{" "}
            <span className="text-[#008378]">it spreads.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#3d4947] sm:text-lg">
            Portals, payers, vendors, and wearables can each surface more than you expect. MedVault is built for a
            world where you choose what gets shared — with proofs, not open-ended exposure.
          </p>
        </motion.div>

        <p className="mx-auto mt-10 max-w-lg text-center text-[11px] text-[#5a6a80] sm:text-xs">
          Top row scrolls left · bottom row scrolls right · hover to pause · click to focus
        </p>

        <div className="relative mt-6 min-h-[480px] overflow-hidden py-2 sm:mt-8">
          <div className="relative space-y-4 sm:space-y-5">
            <MedicalPrivacyMarqueeRow
              items={medicalPrivacyTop}
              direction="left"
              reduce={!!reduce}
              selectedId={selectedId}
              onCardClick={onCardClick}
            />
            <MedicalPrivacyMarqueeRow
              items={medicalPrivacyBottom}
              direction="right"
              reduce={!!reduce}
              selectedId={selectedId}
              onCardClick={onCardClick}
            />
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-[#5a6a80]">
          Real public threads from Reddit, Stack Overflow, Hacker News, arXiv, and Security Stack Exchange — opens in a
          new tab. Headlines summarize the discussion; not medical or legal advice.
        </p>
      </div>
    </section>
  );
}

/* ─── Trust marquee ──────────────────────────────────────────────────────────── */

function TrustMarquee() {
  const reduce = useReducedMotion();
  const doubled = [...trustItems, ...trustItems];
  return (
    <div className="relative overflow-hidden border-y border-[#bcc9c6]/40 bg-white py-[18px]">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />
      <motion.div
        className="flex w-max items-center"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((item, i) => (
          <Fragment key={i}>
            <span className="flex shrink-0 items-center gap-2 px-5 text-sm font-medium text-[#3d4947]">
              <item.Icon className="h-3.5 w-3.5 text-[#00685f]" strokeWidth={1.8} />
              {item.label}
            </span>
            <span aria-hidden className="shrink-0 text-[#bcc9c6] text-lg select-none">·</span>
          </Fragment>
        ))}
      </motion.div>
    </div>
  );
}

function HowItWorksIllustration({ type }: { type: HowItWorksIllustrationKind }) {
  if (type === "wallet") return <WalletStepIllustration />;
  if (type === "encrypt") return <EncryptStepIllustration />;
  if (type === "consent") return <ConsentStepIllustration />;
  return <RevokeStepIllustration />;
}

function IllustrationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/80 bg-gradient-to-br from-white via-[#f7fffd] to-[#eef8ff] p-5 shadow-inner">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(0,104,95,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,104,95,0.045)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div aria-hidden className="absolute -left-10 top-4 h-28 w-28 rounded-full bg-[#89f5e7]/35 blur-2xl" />
      <div aria-hidden className="absolute -right-10 bottom-3 h-32 w-32 rounded-full bg-[#8792fe]/18 blur-2xl" />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function WalletStepIllustration() {
  const rows = [
    { label: "MetaMask", active: true, Icon: MetaMaskIcon },
    { label: "WalletConnect", active: false, Icon: WalletConnectIcon },
    { label: "Coinbase Wallet", active: false, Icon: CoinbaseWalletIcon },
  ];

  return (
    <IllustrationShell>
      <div className="relative mx-auto max-w-[190px]">
        <div className="rounded-2xl border border-[#d8e1df] bg-white/95 p-3.5 shadow-[0_22px_45px_-24px_rgba(15,23,42,0.42)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-left text-[10px] font-bold text-[#191c1e]">Connect Wallet</p>
            <span className="rounded-full bg-[#e3fbf7] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#00685f]">Secure</span>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
                  row.active
                    ? "border-[#16a085]/25 bg-gradient-to-r from-white to-[#f0faf7] shadow-[0_8px_20px_-16px_rgba(22,160,133,0.55)]"
                    : "border-[#e5ecea] bg-gradient-to-r from-white to-[#f8fbfb]",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5">
                  <row.Icon className="h-full w-full object-contain" />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-[10px] font-semibold",
                    row.active ? "text-[#191c1e]" : "text-[#7a8a88]",
                  )}
                >
                  {row.label}
                </span>
                {row.active ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#16a085]">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-[#d8e1df] bg-white" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-5 -right-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8e1df] bg-white shadow-[0_18px_35px_-18px_rgba(15,23,42,0.5)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00685f] text-white">
            <Shield className="h-4 w-4" strokeWidth={2.3} />
          </div>
        </div>
      </div>
    </IllustrationShell>
  );
}

function EncryptStepIllustration() {
  return (
    <IllustrationShell>
      <div className="relative mx-auto h-[118px] w-[212px]">
        <div className="absolute left-[64px] top-1/2 z-0 w-[148px] -translate-y-1/2 rounded-2xl border border-[#d8e1df] bg-white/95 p-2.5 text-left shadow-[0_22px_45px_-24px_rgba(15,23,42,0.42)] backdrop-blur">
          <p className="text-[10px] font-bold text-[#191c1e]">Medical Record</p>
          <div className="mt-2 flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-[#00685f]" strokeWidth={1.8} />
            <span className="h-1.5 flex-1 rounded-full bg-[#dce7e5]" />
          </div>
          <div className="mt-1.5 space-y-1">
            <span className="block h-1.5 rounded-full bg-[#e8eeed]" />
            <span className="block h-1.5 w-3/4 rounded-full bg-[#e8eeed]" />
          </div>
          <div className="mt-2 inline-flex rounded-md bg-[#00685f] px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white">
            Encrypted
          </div>
          <p className="mt-1 font-mono text-[7px] text-[#5a6a80]">A3F2...9B7C</p>
        </div>

        <div className="absolute -left-3 top-1/2 z-20 flex h-[74px] w-[74px] -translate-y-1/2 items-center justify-center rounded-[1.2rem] border border-white bg-gradient-to-br from-[#e3fbf7] to-[#00685f]/15 shadow-[0_16px_32px_-16px_rgba(15,23,42,0.4)]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-[#d8e1df]/80">
            <img
              src={brandLogoUrl}
              alt=""
              aria-hidden
              className="h-full w-full object-contain object-center"
              draggable={false}
            />
          </span>
          <div className="absolute -bottom-1 -right-1 z-30 flex h-6 w-6 items-center justify-center rounded-lg border border-[#d8e1df] bg-white shadow-sm">
            <Lock className="h-3 w-3 text-[#00685f]" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </IllustrationShell>
  );
}

function ConsentStepIllustration() {
  const rows = ["Dr. Sarah Chen", "Research Study", "Health Sponsor"];

  return (
    <IllustrationShell>
      <div className="relative mx-auto max-w-[185px]">
        <div className="rounded-2xl border border-[#d8e1df] bg-white/95 p-3.5 text-left shadow-[0_22px_45px_-24px_rgba(15,23,42,0.42)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#191c1e]">Grant Access</p>
            <span className="h-2 w-2 rounded-full bg-[#16a085] shadow-[0_0_0_4px_rgba(22,160,133,0.12)]" />
          </div>
          <div className="space-y-2.5">
            {rows.map((row, idx) => (
              <div key={row} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e8f4fd] text-[#00685f]">
                  {idx === 0 ? <UserRound className="h-3.5 w-3.5" /> : idx === 1 ? <ClipboardList className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9px] font-bold text-[#191c1e]">{row}</span>
                  <span className="mt-0.5 block h-1 w-14 rounded-full bg-[#e8eeed]" />
                </span>
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-[#16a085] shadow-sm">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-5 -right-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8e1df] bg-white shadow-[0_18px_35px_-18px_rgba(15,23,42,0.5)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3fbf7] text-[#00685f]">
            <UserCheck className="h-4 w-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </IllustrationShell>
  );
}

function RevokeStepIllustration() {
  return (
    <IllustrationShell>
      <div className="relative mx-auto max-w-[185px]">
        <div className="rounded-2xl border border-[#d8e1df] bg-white/95 p-3.5 text-left shadow-[0_22px_45px_-24px_rgba(15,23,42,0.42)] backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#191c1e]">Access Revoked</p>
            <span className="rounded-full bg-[#e3fbf7] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#00685f]">Done</span>
          </div>
          <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#00685f]/45 bg-[#e3fbf7]/55">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00685f] text-white">
              <CheckCircle2 className="h-6 w-6" strokeWidth={2.1} />
            </div>
          </div>
          <div className="mt-3 border-t border-[#eef3f2] pt-2">
            <p className="text-[9px] font-bold text-[#191c1e]">Audit Trail</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#bcc9c6]" />
              <span className="h-px flex-1 bg-[#bcc9c6]" />
              <span className="h-2 w-2 rounded-full bg-[#00685f]" />
            </div>
          </div>
        </div>
        <div className="absolute -bottom-5 -right-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8e1df] bg-white shadow-[0_18px_35px_-18px_rgba(15,23,42,0.5)]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3fbf7] text-[#00685f]">
            <Activity className="h-4 w-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </IllustrationShell>
  );
}

/* ─── Powered by Zama (distinct from generic “chain partner” promos) ───── */

type ZamaRow = { Icon: React.ElementType; title: string; body: string };

const zamaHighlights: ZamaRow[] = [
  {
    Icon: Lock,
    title: "Ciphertexts on-chain",
    body: "Trial logic reads encrypted state. Eligibility and scoring run as homomorphic programs, not clear-text database queries.",
  },
  {
    Icon: Cpu,
    title: "FHE you can deploy",
    body: "Solidity with Zama FHE opcodes for comparisons, boolean mux, and score accumulation - values stay sealed mid-execution.",
  },
  {
    Icon: Shield,
    title: "Sealed at the client",
    body: "Wallets encrypt inputs before broadcast. Peers see handles and ZK-backed proofs of inputs, not raw lab or chart numbers.",
  },
  {
    Icon: KeyRound,
    title: "Keys meet consent",
    body: "Decryption and sponsor access follow wallet-scoped policy on the same surface that gates trial enrollment and audit logs.",
  },
];

const CIPHER_ROWS = [
  { input: "0x4a2f", field: "age_score", op: "cmux", handle: "0xe3f1a2" },
  { input: "0x7bc1", field: "bmi_class", op: "add",  handle: "0x92c28d" },
  { input: "0x1d88", field: "diag_flag", op: "cmp",  handle: "pending"  },
  { input: "0x5f3c", field: "rx_index",  op: "mul",  handle: "0xa7d4e0" },
] as const;

function ZamaCipherTerminal({ reduce }: { reduce: boolean }) {
  const [activeRow, setActiveRow] = useState(2);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActiveRow((p) => (p + 1) % 4), 2200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="w-full max-w-[19.5rem] sm:max-w-[20.5rem] lg:max-w-none" aria-hidden>
      <div className="rounded-xl bg-white/[0.025] p-px ring-1 ring-white/[0.09] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-[1.25rem]">
        <div className="overflow-hidden rounded-[calc(1.25rem-1px)] border border-white/[0.05] bg-[#06080c] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-[calc(1.5rem-1px)]">
          {/* terminal header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/10 text-[#7dd3c0] ring-1 ring-white/[0.08] sm:h-7 sm:w-7">
                <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={1.6} />
              </div>
              <span className="font-mono text-[10px] font-medium text-slate-300 sm:text-[11px]">fhEVM</span>
              <span className="font-mono text-[9px] text-slate-600 sm:text-[10px]">Zama</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!reduce && (
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-teal-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">live</span>
            </div>
          </div>

          {/* column headers */}
          <div className="grid grid-cols-[3.25rem_1fr_2.25rem_4.5rem] gap-x-2 border-b border-white/[0.04] px-3 py-1 sm:grid-cols-[3.5rem_1fr_2.5rem_5rem] sm:gap-x-3 sm:px-4 sm:py-1.5">
            {["input", "field", "op", "handle"].map((h) => (
              <span key={h} className="font-mono text-[7px] font-medium uppercase tracking-[0.16em] text-slate-600 sm:text-[8px] sm:tracking-[0.18em]">{h}</span>
            ))}
          </div>

          {/* op rows */}
          <div className="divide-y divide-white/[0.03] px-3 sm:px-4">
            {CIPHER_ROWS.map((row, i) => {
              const isActive = i === activeRow;
              return (
                <div
                  key={row.input}
                  className={cn(
                    "grid grid-cols-[3.25rem_1fr_2.25rem_4.5rem] items-center gap-x-2 py-1.5 transition-colors duration-500 sm:grid-cols-[3.5rem_1fr_2.5rem_5rem] sm:gap-x-3 sm:py-2.5",
                    isActive ? "bg-teal-500/[0.04]" : ""
                  )}
                >
                  <span className="font-mono text-[9px] text-slate-600 sm:text-[10px]">{row.input}</span>
                  <span className={cn("font-mono text-[9px] truncate sm:text-[10px]", isActive ? "text-teal-300" : "text-slate-400")}>{row.field}</span>
                  <span className="font-mono text-[9px] text-slate-600 sm:text-[10px]">{row.op}</span>
                  <span className={cn("font-mono text-[9px] tabular-nums sm:text-[10px]", isActive ? "text-[#5eead4]" : "text-slate-500")}>
                    {isActive && !reduce ? (
                      <>
                        {"comp"}
                        <span className="mv-cursor-blink inline-block">{"\u258B"}</span>
                      </>
                    ) : row.handle}
                  </span>
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-white/[0.04] px-3 py-1.5 sm:px-4 sm:py-2">
            <span className="font-mono text-[8px] text-slate-600 sm:text-[9px]">4 ops</span>
            <span className="font-mono text-[8px] text-slate-600 sm:text-[9px]">sealed</span>
            <span className="font-mono text-[8px] tabular-nums text-slate-600 sm:text-[9px]">~11ms</span>
          </div>
        </div>
      </div>
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute -right-6 top-0 h-40 w-40 rounded-full bg-teal-400/[0.07] blur-3xl"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden
        />
      )}
    </div>
  );
}

function PoweredByZamaSection() {
  const reduce = useReducedMotion();

  const fadeLift = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition } }
    : { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition } };

  const rowParent = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: reduce ? 0.04 : 0.1, delayChildren: 0.1 } },
  };
  const rowChild = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition } }
    : { hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0, transition } };

  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.05] bg-[#07090c] px-4 py-10 text-slate-200 sm:px-6 md:py-12"
      id="zama-fhe"
      aria-labelledby="zama-fhe-heading"
    >
      {/* ambient mesh gradients */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 52% at 4% 0%, rgba(20,184,166,0.10) 0%, transparent 45%)," +
            "radial-gradient(ellipse 60% 42% at 96% 100%, rgba(8,120,110,0.13) 0%, transparent 44%)",
        }}
        aria-hidden
      />

      <div className="mx-auto max-w-6xl">

        {/* header zone - full width, editorial scale */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportBase}
          variants={fadeLift}
          className="mb-6 max-w-3xl sm:mb-7"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/[0.07] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.22em] text-[#8fd4c8] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.05)]">
            <Server className="h-2.5 w-2.5" strokeWidth={1.5} />
            Core Protocol — Zama fhEVM
          </span>
          <h2
            id="zama-fhe-heading"
            className="font-display mt-3 text-2xl font-bold tracking-tight text-white sm:mt-3.5 sm:text-3xl sm:leading-[1.1] md:text-4xl"
          >
            Health data stays sealed.
            <br className="hidden sm:inline" />
            <span className="text-[#5eead4]"> Powered by Zama.</span>
          </h2>
          <p className="mt-2.5 max-w-[56ch] text-pretty text-sm leading-relaxed text-slate-400 sm:mt-3">
            MedVault runs trial policy on{" "}
            <strong className="font-semibold text-slate-200">Zama fhEVM</strong> - a co-processor where health metrics stay
            ciphertext on-chain while smart contracts compute eligibility. No plaintext leaves the wallet.
          </p>
          <a
            href="https://docs.zama.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-4 inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] pl-3.5 pr-1.5 py-1 text-xs font-medium text-slate-100 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-teal-500/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 active:scale-[0.985] sm:mt-3.5"
          >
            <span className="pr-0.5">Zama documentation</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:bg-white/[0.15]">
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
            </span>
          </a>
        </motion.div>

        {/* feature rows + cipher terminal */}
        <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[1fr_minmax(0,19rem)] lg:gap-8 lg:items-center">

          {/* feature strips */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={rowParent}
            className="flex flex-col divide-y divide-white/[0.05]"
          >
            {zamaHighlights.map(({ Icon, title, body }) => (
              <motion.div
                key={title}
                variants={rowChild}
                whileHover={reduce ? undefined : { x: 4 }}
                transition={zamaSpringSoft}
                className="group flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 sm:gap-3.5 sm:py-3"
              >
                <div className="flex shrink-0 flex-col items-center gap-1 self-stretch">
                  <span className="mt-0.5 block w-0.5 flex-1 rounded-full bg-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-teal-500/55" style={{ minHeight: "0.5rem" }} />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03] text-[#7dd3c0] transition duration-300 group-hover:border-teal-500/20 group-hover:bg-teal-500/[0.08] group-hover:text-[#5eead4] sm:h-8 sm:w-8 sm:rounded-[0.55rem]">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold leading-snug text-slate-100 sm:text-[0.9rem]">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-[0.8125rem] sm:leading-snug">{body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* cipher terminal */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportBase}
            transition={transition}
            className="relative flex justify-center self-center lg:sticky lg:top-16 lg:justify-end"
          >
            <ZamaCipherTerminal reduce={!!reduce} />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
/* ─── Stat card ──────────────────────────────────────────────────────────────── */

function StatCard({ value, label, suffix, decimals = 0 }: { value: number; label: string; suffix: string; decimals?: number }) {
  const [count, setCount] = useState(0);
  const statRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(statRef, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  const shown = decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString();

  return (
    <motion.div
      ref={statRef}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
    >
      <p className="font-mono text-4xl font-black tracking-tight text-[#191c1e] tabular-nums sm:text-5xl">
        {shown}
        <span className="text-[#00685f]">{suffix}</span>
      </p>
      <p className="mt-3 text-sm font-medium text-[#5a6a80]">{label}</p>
    </motion.div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const reduce = useReducedMotion();
  const apkDownloadUrl = (import.meta.env.VITE_ANDROID_APK_URL as string | undefined)?.trim() || "/downloads/medvault.apk";

  const fadeUp = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };

  const staggerParent = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reduce ? 0.04 : 0.09,
        delayChildren: 0.06,
      },
    },
  };

  const staggerItem = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition } }
    : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition } };

  return (
    <div className="relative w-full overflow-x-clip">

      {/* ── Hero (UNCHANGED) ──────────────────────────────────────────────── */}
      <section className="relative" aria-labelledby="hero-heading">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#6bd8cb]/35 blur-3xl" />
          <div className="absolute top-32 -left-16 h-64 w-64 rounded-full bg-[#8792fe]/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-40 w-[60%] -translate-x-1/2 rounded-full bg-[#89f5e7]/25 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-10 sm:px-8 md:pb-24 md:pt-16 lg:px-14 xl:px-20">
          <motion.div
            className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 xl:gap-20"
            initial={false}
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: reduce ? 0.05 : 0.1, delayChildren: 0.05 },
              },
            }}
          >
            <div className="relative z-10 flex flex-col">
              <motion.p
                variants={fadeUp}
                transition={transition}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-[#bcc9c6]/50 bg-white/70 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-[#3d4947]"
              >
                <span className="h-2 w-2 rounded-full bg-[#6bd8cb]" />
                CORE PROTOCOL · FHE CLINICAL MATCHING
              </motion.p>

              <motion.h1
                id="hero-heading"
                variants={fadeUp}
                transition={transition}
                className="mt-5 text-4xl font-bold tracking-tight text-[#191c1e] sm:text-5xl md:text-6xl lg:text-[64px] lg:leading-[1.05]"
              >
                Private clinical-trial matching
                <br />
                on <span className="text-[#008378]">encrypted data.</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                transition={transition}
                className="mt-5 max-w-xl text-lg leading-relaxed text-[#3d4947]"
              >
                Patients encrypt vitals; sponsors encrypt trial criteria;{" "}
                <code className="text-sm font-semibold text-[#00685f]">EligibilityEngine</code> matches
                homomorphically on Ethereum Sepolia — validators and indexers never see plaintext PHI during on-chain scoring.
              </motion.p>

              <motion.div
                variants={fadeUp}
                transition={transition}
                className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4"
              >
                <motion.div
                  whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                >
                  <Link
                    to="/patient/dashboard"
                    className="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[#00685f] px-8 py-4 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,104,95,0.55)] transition hover:bg-[#008378] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00685f]/30"
                  >
                    Try Demo
                    <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                    {!reduce && (
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                          mixBlendMode: "overlay",
                        }}
                        animate={{ x: ["-120%", "380%"] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.4 }}
                      />
                    )}
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                >
                  <Link
                    to="/docs"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#bcc9c6] bg-white px-8 py-4 text-base font-semibold text-[#191c1e] shadow-sm transition hover:bg-[#f2f4f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00685f]/20"
                  >
                    <FileText className="h-4 w-4 text-[#00685f]" strokeWidth={1.8} />
                    Read Whitepaper
                  </Link>
                </motion.div>
              </motion.div>

              <motion.p
                variants={fadeUp}
                transition={transition}
                className="mt-5 inline-flex items-center gap-2 text-sm text-[#5a6a80]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#06d6a0]" strokeWidth={2.2} />
                No account needed. Connect any EIP-1193 wallet in 10 seconds.
              </motion.p>
            </div>

            <motion.div
              variants={fadeUp}
              transition={transition}
              className="pointer-events-none relative z-10 mx-auto w-full max-w-[520px] lg:max-w-[560px]"
            >
              <HeroOrbit reduce={!!reduce} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Trust marquee ─────────────────────────────────────────────────── */}
      <TrustMarquee />

      {/* ── Community-style medical privacy “pain points” bento ────────────── */}
      <MedicalPrivacyVoicesBento />

      {/* ── Pillars — asymmetric bento ────────────────────────────────────── */}
      <section className="relative bg-[#f7f9fb] px-4 py-20 sm:px-8" id="privacy">
        {/* Soft ambient glows */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-[#89f5e7]/18 blur-3xl" />
          <div className="absolute -right-16 bottom-8 h-64 w-64 rounded-full bg-[#8792fe]/12 blur-3xl" />
        </div>

        <div className="mx-auto max-w-screen-lg">
          {/* Left-aligned header */}
          <motion.div
            className="max-w-xl"
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={fadeUp}
            transition={transition}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Why MedVault</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
              Privacy layers you can reason about
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-[#3d4947]">
              Built for patients who need transparency on how data flows — without surrendering identity.
            </p>
          </motion.div>

          {/* Asymmetric bento: wide card left + stacked pair right */}
          <div className="mt-12 grid gap-5 md:grid-cols-[3fr_2fr]">
            {/* First pillar — wide feature card */}
            {(() => {
              const FirstIcon = pillars[0].icon;
              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={viewportBase}
                  transition={transition}
                  whileHover={reduce ? undefined : { y: -4 }}
                  className="relative overflow-hidden rounded-[2rem] border border-[#bcc9c6]/60 bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
                >
                  {/* Gradient mesh glow */}
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-[#89f5e7]/25 blur-3xl" />

                  <div className="relative">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00685f]/10 text-[#00685f] ring-1 ring-[#6bd8cb]/40">
                      <FirstIcon className="h-6 w-6" strokeWidth={1.7} />
                    </div>
                    <h3 className="text-xl font-bold text-[#191c1e]">{pillars[0].title}</h3>
                    <p className="mt-3 max-w-sm leading-relaxed text-[#3d4947]">{pillars[0].text}</p>

                    {/* Inline ZK-flow diagram */}
                    <div className="mt-6 rounded-2xl border border-[#bcc9c6]/50 bg-[#f7f9fb] p-4">
                      <div className="flex items-center gap-2">
                        {[
                          { Icon: UserRound, bg: "#e8f4fd", fg: "#0a2540", label: "Identity" },
                          { Icon: Lock,      bg: "#8792fe18", fg: "#5a6a80", label: "ZK Proof" },
                          { Icon: BadgeCheck, bg: "#06d6a018", fg: "#00685f", label: "Verified" },
                        ].map((node, idx) => (
                          <Fragment key={idx}>
                            <div className="flex flex-col items-center gap-1.5">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: node.bg, color: node.fg }}
                              >
                                <node.Icon className="h-4 w-4" strokeWidth={1.8} />
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
                  </div>
                </motion.div>
              );
            })()}

            {/* Pillars 2 & 3 — double-bezel stacked */}
            <div className="flex flex-col gap-5">
              {pillars.slice(1).map((p, idx) => {
                const PillarIcon = p.icon;
                return (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={viewportBase}
                    transition={{ ...transition, delay: 0.08 + idx * 0.1 }}
                    whileHover={reduce ? undefined : { y: -3 }}
                    /* Double-bezel outer shell */
                    className="p-px rounded-[1.8rem] bg-gradient-to-br from-[#6bd8cb]/50 to-[#8792fe]/20 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)]"
                  >
                    {/* Inner core */}
                    <div className="h-full rounded-[calc(1.8rem-1px)] bg-white p-6">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#89f5e7]/30 text-[#00685f] ring-1 ring-[#6bd8cb]/40">
                        <PillarIcon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <h3 className="text-lg font-bold text-[#191c1e]">{p.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#3d4947]">{p.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works — four-step flow ──────────────────────────────────── */}
      <section className="bg-[#fefefe] px-4 py-20 sm:px-8" id="how-it-works">
        <div className="mx-auto max-w-screen-xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={fadeUp}
            transition={transition}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bcc9c6]/70 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00685f]">
              <span aria-hidden className="text-[9px] leading-none">
                ●
              </span>
              Simple • Secure • Private
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl lg:text-[2.75rem]">
              How <span className="text-[#00685f]">MedVault</span> Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#5a6a80] sm:text-lg">
              Decentralized by design. You own your data. You decide who can access it.
            </p>
          </motion.div>

          <motion.div
            className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
          >
            {howItWorksSteps.map((s) => (
              <motion.div
                key={s.step}
                variants={staggerItem}
                whileHover={reduce ? undefined : { y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="group relative h-full overflow-hidden rounded-[1.75rem] border border-[#d8e1df]/80 bg-white p-3 shadow-[0_18px_50px_-34px_rgba(10,37,64,0.48)] ring-1 ring-white/70 transition-shadow hover:shadow-[0_24px_60px_-32px_rgba(0,104,95,0.32)]"
              >
                <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#89f5e7]/80 to-transparent" />
                <div className="relative">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="rounded-full border border-[#00685f]/15 bg-[#00685f]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#00685f]">
                      Step {s.step}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a2540] text-[11px] font-bold text-white shadow-[0_12px_24px_-16px_rgba(10,37,64,0.7)]">
                      {s.step}
                    </span>
                  </div>

                  <HowItWorksIllustration type={s.illustration} />

                  <div className="px-2 pb-3 pt-5 text-left">
                    <h3 className="text-lg font-bold tracking-tight text-[#191c1e]">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5a6a80]">{s.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Mobile APK download ───────────────────────────────────────────── */}
      <section className="bg-white px-4 py-20 sm:px-8" id="mobile-app">
        <div className="mx-auto max-w-screen-xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={fadeUp}
            transition={transition}
            className="overflow-hidden rounded-[2rem] border border-[#bcc9c6]/50 bg-gradient-to-br from-[#f7fffd] via-white to-[#e8f4fd] shadow-[0_24px_70px_-35px_rgba(0,104,95,0.35)]"
          >
            <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[#00685f]/20 bg-[#00685f]/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#00685f]">
                  <Smartphone className="h-3.5 w-3.5" strokeWidth={2} />
                  Android APK
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
                  Take MedVault with you.
                </h2>
                <p className="mt-4 max-w-2xl leading-relaxed text-[#3d4947]">
                  Install the Android app to access your patient vault, consent controls, encrypted matching, and audit trail from your phone.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={apkDownloadUrl}
                    download={apkDownloadUrl.startsWith("/") ? "medvault.apk" : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00685f] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_32px_-18px_rgba(0,104,95,0.65)] transition hover:bg-[#00584f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00685f]/35"
                  >
                    <Download className="h-4 w-4" strokeWidth={2.2} />
                    Download APK
                  </a>
                  <Link
                    to="/docs/mobile/android-apk"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00685f]/25 bg-white px-6 py-3 text-sm font-bold text-[#00685f] transition hover:bg-[#00685f]/5"
                  >
                    Build notes
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-[#5a6a80]">
                  Android may ask you to allow installs from your browser before opening an APK downloaded outside the Play Store.
                </p>
              </div>

              <div className="relative mx-auto flex w-full max-w-sm justify-center">
                <div className="absolute inset-x-8 top-8 h-48 rounded-full bg-[#89f5e7]/35 blur-3xl" aria-hidden />
                <div className="relative w-56 rounded-[2.2rem] border border-[#0a2540]/10 bg-[#0a2540] p-2 shadow-[0_30px_70px_-30px_rgba(10,37,64,0.55)]">
                  <div className="rounded-[1.7rem] bg-[#fefefe] p-4">
                    <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#d8e1df]" />
                    <div className="rounded-2xl bg-[#00685f] p-4 text-white">
                      <div className="flex items-center justify-between">
                        <Smartphone className="h-6 w-6" strokeWidth={1.8} />
                        <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold">APK</span>
                      </div>
                      <p className="mt-5 text-lg font-bold leading-tight">MedVault Mobile</p>
                      <p className="mt-1 text-xs text-white/75">Private access on Android</p>
                    </div>
                    <div className="mt-4 space-y-2">
                      {["Wallet login", "Consent controls", "Encrypted records"].map((item) => (
                        <div key={item} className="flex items-center gap-2 rounded-xl border border-[#e5ecea] bg-white px-3 py-2">
                          <Check className="h-3.5 w-3.5 text-[#00685f]" strokeWidth={2.4} />
                          <span className="text-xs font-semibold text-[#3d4947]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <PoweredByZamaSection />

      <section className="bg-white px-4 pt-16 sm:px-8" aria-labelledby="platform-services-heading">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Platform Services</p>
          <h2
            id="platform-services-heading"
            className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-[#191c1e] sm:text-3xl"
          >
            Extended capabilities around the core FHE matching flow
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#3d4947]">
            MCP tools, AI criteria extraction, Chainlink CRE automation, confidential staking, and mobile SDK — deployability
            layers, not the core innovation claim.
          </p>
        </div>
      </section>

      <McpLandingSection />

      {/* ── Stats — hairline-grid strip ───────────────────────────────────── */}
      <section className="border-y border-[#bcc9c6]/40 bg-[#f7f9fb] px-4 sm:px-8">
        <div className="mx-auto max-w-screen-lg">
          {/* grid gap-px bg-[...] creates hairline dividers without border declarations */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#bcc9c6]/40 bg-[#bcc9c6]/40 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[#f7f9fb]">
                <StatCard value={s.value} suffix={s.suffix} decimals={s.decimals} label={s.label} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Infrastructure ────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-20 sm:px-8" id="for-sponsors">
        <div className="mx-auto max-w-screen-xl">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={fadeUp}
            transition={transition}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00685f]">Platform Services</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
              Deployment infrastructure around the core protocol
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-[#3d4947]">
              Relayer network, audit logging, confidential rewards, and consent controls — secondary to homomorphic eligibility matching.
            </p>
          </motion.div>

          {/* Layer cards — double-bezel with gradient top accent */}
          <motion.div
            className="mt-10 grid gap-5 md:grid-cols-3"
            variants={staggerParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
          >
            {infraLayers.map((layer) => {
              const LayerIcon = layer.icon;
              return (
                <motion.article
                  key={layer.title}
                  variants={staggerItem}
                  whileHover={reduce ? undefined : { y: -5, scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  /* outer shell: gradient top-accent fades to transparent */
                  className="p-px rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)]"
                  style={{
                    background: `linear-gradient(to bottom, ${layer.accentHex}66 0%, ${layer.accentHex}11 40%, transparent 100%)`,
                  }}
                >
                  {/* inner core */}
                  <div className="h-full rounded-[calc(2rem-1px)] bg-white p-6 backdrop-blur-sm">
                    {/* Icon with matching accent ring */}
                    <div
                      className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-[#6bd8cb]/30"
                      style={{
                        backgroundColor: `${layer.accentHex}18`,
                        color: layer.accentHex === "#c5cae9" ? "#5a6a80" : layer.accentHex,
                      }}
                    >
                      <LayerIcon className="h-5 w-5" strokeWidth={1.7} />
                    </div>
                    <h3 className="text-lg font-bold text-[#191c1e]">{layer.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#3d4947]">{layer.body}</p>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>

          {/* Animated pipeline */}
          <motion.div
            className="relative mt-10 overflow-hidden rounded-2xl border border-[#bcc9c6]/60 bg-white/90 p-5 shadow-sm [container-type:inline-size] sm:p-6"
            initial="hidden"
            whileInView="visible"
            viewport={viewportBase}
            variants={fadeUp}
            transition={transition}
          >
            {/* Shimmer: CSS `left` sweep spans full parent width. Framer `x` with %/calc targets element box, not track. */}
            {!reduce && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-[#6bd8cb]/22 to-transparent mv-request-path-sweep"
              />
            )}

            {/* Header */}
            <div className="mb-5 flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#06d6a0] opacity-75" />
                {!reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inline-flex h-full w-full rounded-full bg-[#06d6a0]"
                    animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#00685f]">
                <Activity className="h-3.5 w-3.5" strokeWidth={2} />
                Request Path · Live
              </span>
            </div>

            {/* Flow steps */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-0">
              {infraFlow.map((step, idx) => (
                <Fragment key={step}>
                  <motion.div
                    className="flex-1 cursor-default rounded-xl border border-[#bcc9c6]/60 bg-[#f7f9fb] px-3 py-2.5 text-center text-xs font-semibold text-[#1f2937] transition-colors"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.35, delay: idx * 0.09 }}
                    whileHover={reduce ? undefined : { backgroundColor: "#e8f4fd", y: -1 }}
                  >
                    {step}
                  </motion.div>
                  {idx < infraFlow.length - 1 && (
                    <ChevronRight
                      aria-hidden
                      className="hidden h-4 w-4 shrink-0 text-[#bcc9c6] sm:block"
                      strokeWidth={2}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA — premium gradient card ───────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-28 pt-6 sm:px-8" id="for-patients">
        {/* Animated background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <motion.div
            className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#89f5e7]/18 blur-3xl"
            animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[#8792fe]/14 blur-3xl"
            animate={reduce ? undefined : { scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportBase}
            transition={transition}
            className="overflow-hidden rounded-[2.5rem] border border-[#bcc9c6]/60 bg-gradient-to-br from-[#89f5e7]/15 via-white to-[#8792fe]/10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.07)]"
          >
            <div className="grid md:grid-cols-[3fr_2fr]">

              {/* Left: content */}
              <div className="px-8 py-12 sm:px-12 sm:py-14">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bcc9c6]/60 bg-white/80 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#00685f]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#06d6a0]" />
                  Get started
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-[#191c1e] sm:text-4xl">
                  Ready to explore on your terms?
                </h2>
                <p className="mt-4 max-w-sm leading-relaxed text-[#3d4947]">
                  Open the patient console to browse trials, manage consent, and review your encrypted activity.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  {/* Primary — button-in-button pattern */}
                  <motion.div
                    whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  >
                    <Link
                      to="/patient/find-trials"
                      className={cn(
                        "inline-flex items-center gap-3 rounded-full px-7 py-4 font-semibold text-white",
                        "bg-[#0a2540] transition hover:bg-[#163a5f]",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00685f]/30",
                      )}
                    >
                      <FlaskConical className="h-4 w-4" strokeWidth={2} />
                      Find trials
                      {/* Button-in-button arrow circle */}
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12">
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    </Link>
                  </motion.div>

                  {/* Secondary */}
                  <motion.div
                    whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  >
                    <Link
                      to="/docs"
                      className="inline-flex items-center gap-2 rounded-full border border-[#bcc9c6] bg-white px-7 py-4 font-semibold text-[#191c1e] shadow-sm transition hover:bg-[#f2f4f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00685f]/20"
                    >
                      <FileCheck className="h-4 w-4 text-[#00685f]" strokeWidth={1.8} />
                      Read the docs
                    </Link>
                  </motion.div>
                </div>
              </div>

              {/* Right: decorative encryption flow panel */}
              <div className="relative hidden overflow-hidden md:flex md:items-center md:justify-center">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#89f5e7]/15 to-[#8792fe]/15" />
                <div className="relative w-full px-8 py-10">
                  <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#00685f]">
                    Data pipeline
                  </p>
                  {[
                    { label: "Patient Data",    Icon: UserRound,  bg: "#e8f4fd",   fg: "#0a2540" },
                    { label: "FHE Encrypted",   Icon: Lock,       bg: "#8792fe18", fg: "#8792fe" },
                    { label: "ZK Proof",        Icon: BadgeCheck, bg: "#06d6a018", fg: "#00685f" },
                    { label: "Sponsor Access",  Icon: CheckCircle2, bg: "#6bd8cb18", fg: "#00685f" },
                  ].map((node, idx) => (
                    <motion.div
                      key={idx}
                      className="mb-2 flex items-center gap-3 rounded-xl border border-[#bcc9c6]/50 bg-white/85 px-3 py-2.5 backdrop-blur-sm last:mb-0"
                      initial={{ opacity: 0, x: 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: idx * 0.12 + 0.3 }}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: node.bg, color: node.fg }}
                      >
                        <node.Icon className="h-4 w-4" strokeWidth={1.8} />
                      </div>
                      <span className="text-xs font-semibold text-[#1f2937]">{node.label}</span>
                      <Check className="ml-auto h-3.5 w-3.5 text-[#06d6a0]" strokeWidth={2.5} />
                    </motion.div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white px-4 pb-10 sm:px-8" aria-label="Admin access">
        <div className="mx-auto flex max-w-4xl justify-center">
          <Link
            to="/admin/sponsors"
            className="inline-flex items-center gap-2 rounded-full border border-[#00685f]/25 bg-[#00685f]/5 px-5 py-2.5 text-sm font-bold text-[#00685f] transition hover:bg-[#00685f]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00685f]/20"
          >
            <Shield className="h-4 w-4" strokeWidth={2} />
            Admin
          </Link>
        </div>
      </section>

      <LandingClosingSection />

    </div>
  );
}
