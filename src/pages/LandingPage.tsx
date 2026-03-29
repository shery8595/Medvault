import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Globe,
  Lock,
  Unlock,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Key,
  Shield,
  Zap,
  Terminal,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { HeartbeatBackground } from "../components/ui/HeartbeatBackground";
import { AuraBackground } from "../components/landing/AuraBackground";
import { StartBuildingButton } from "../components/landing/StartBuildingButton";
import { ScrollStory } from "../components/landing/ScrollStory";

/* ─── Typewriter Hook ─────────────────────────────────────────────────────── */
function useTypewriter(words: string[], speed = 80, pause = 1800) {
  const [displayed, setDisplayed] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIdx];
    const delay = deleting ? speed / 2 : charIdx === current.length ? pause : speed;

    const timer = setTimeout(() => {
      if (!deleting && charIdx < current.length) {
        setDisplayed(current.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      } else if (!deleting && charIdx === current.length) {
        if (words.length > 1) setDeleting(true);
      } else if (deleting && charIdx > 0) {
        setDisplayed(current.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      } else {
        setDeleting(false);
        setWordIdx((i) => (i + 1) % words.length);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return { displayed, wordIdx, isFinished: !deleting && charIdx === words[wordIdx].length };
}

/* ─── Animation Presets ───────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: "easeOut" as any, delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.7, delay },
});



/* ─── Bento Card wrapper ──────────────────────────────────────────────────── */


function BentoCard({
  children,
  className = "",
  delay = 0,
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      {...fadeUp(delay)}
      className={`rounded-3xl p-6 lg:p-10 ${className} relative overflow-hidden group`}
      style={{
        background: "rgba(10, 22, 40, 0.45)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(59, 130, 246, 0.15)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        ...style,
      }}
    >
      {/* Internal subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function BentoLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-widest mb-1" style={{ color: "#3b82f6" }}>
      {children}
    </p>
  );
}

function BentoTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-white mb-5">{children}</h3>;
}

/* ─── Hero Heading with Typewriter ────────────────────────────────────────── */
const TYPEWRITER_WORDS = ["Zero Exposure.", "Full Privacy.", "Your Rules.", "Encrypted. Always."];

function HeroHeading() {
  const { displayed, wordIdx, isFinished } = useTypewriter(TYPEWRITER_WORDS, 95, 2300);
  const currentWord = TYPEWRITER_WORDS[wordIdx];

  // Map phrases to their colored segments (only applied when isFinished is true)
  const segmentsMap: Record<string, { text: string; isRed: boolean }[]> = {
    "Zero Exposure.": [
      { text: "Zero", isRed: true },
      { text: " Exposure.", isRed: false },
    ],
    "Full Privacy.": [
      { text: "Full ", isRed: false },
      { text: "Privacy.", isRed: true },
    ],
    "Your Rules.": [
      { text: "Your Rules.", isRed: true },
    ],
    "Encrypted. Always.": [
      { text: "Encrypted.", isRed: true },
      { text: " Always.", isRed: false },
    ],
  };

  const currentSegments = segmentsMap[currentWord] || [{ text: currentWord, isRed: false }];

  const renderContent = () => {
    let charOffsetCount = 0;
    return (
      <>
        {currentSegments.map((segment, idx) => {
          const startIdx = charOffsetCount;
          const endIdx = startIdx + segment.text.length;
          charOffsetCount = endIdx;

          if (displayed.length <= startIdx) return null;

          // Slice the segment text based on how much has been typed
          const segmentVisiblePart = segment.text.slice(0, Math.max(0, displayed.length - startIdx));

          return (
            <motion.span
              key={`${wordIdx}-${idx}`}
              className={segment.isRed ? "font-serif italic" : ""}
              initial={{ color: "#3b82f6" }}
              animate={{ 
                color: (segment.isRed && isFinished) ? "#ef4444" : "#3b82f6" 
              }}
              transition={{ 
                duration: 0.7, 
                delay: segment.isRed ? 0.2 : 0,
                ease: "easeInOut" 
              }}
            >
              {segmentVisiblePart}
            </motion.span>
          );
        })}
      </>
    );
  };

  return (
    <motion.h1
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      className="text-5xl md:text-[4.5rem] lg:text-[6.5rem] font-extrabold tracking-tighter text-slate-950 dark:text-white leading-[1.0] mb-8"
    >
      Medical Trials. <br />
      <span className="relative">
        {renderContent()}
        <motion.span
          className="inline-block w-[3px] h-[0.85em] ml-1 align-middle rounded-sm"
          initial={{ background: "#3b82f6" }}
          animate={{
            background: (isFinished && currentSegments.slice(-1)[0]?.isRed) ? "#ef4444" : "#3b82f6",
          }}
          transition={{
            duration: 0.7,
            delay: 0.2,
            ease: "easeInOut"
          }}
          style={{
            animation: "heroCursorBlink 1s step-start infinite",
          }}
        />
      </span>
    </motion.h1>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="flex flex-col">

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative min-h-screen flex items-center py-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <AuraBackground />
          <HeartbeatBackground />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-blue-500/5 blur-[160px]" />
          
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, #3b82f6 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1000px] mx-auto px-6 lg:px-14 w-full text-center">
          <div className="flex flex-col items-center">

            {/* ── Text content ── */}
            <div className="flex flex-col items-center text-center">
              {/* Badge */}
              <motion.div {...fadeIn(0)} className="flex mb-10">
              </motion.div>

              {/* Heading */}
              <HeroHeading />

              {/* Sub-copy */}
              <motion.p
                {...fadeUp(0.2)}
                className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 leading-relaxed mb-12 max-w-2xl"
              >
                Match with clinical trials. Earn ETH rewards.{" "}
                <br className="hidden md:block" />
                <em className="not-italic font-semibold text-slate-700 dark:text-slate-200">
                  Your data stays encrypted — always.
                </em>
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-5 mb-16 z-20 relative">
                <Link to="/patient" className="z-20">
                  <StartBuildingButton />
                </Link>
                <Link to="/sponsor">
                  <Button variant="outline" size="lg" className="h-14 px-10 rounded-2xl text-base border-slate-200 dark:border-slate-700 font-semibold gap-2.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-900">
                    For Trial Sponsors
                    <Building2 className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ SCROLL STORY SECTION ════════════════ */}
      <ScrollStory />

      {/* ════════════════ SECTION 1 — INSTITUTIONAL INFRASTRUCTURE ════════════════ */}
      <section
        id="security"
        className="relative py-28 lg:py-36 overflow-hidden bg-black"
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-black" />
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px]" />
          
          <div
            className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
            style={{
              backgroundImage:
                "linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1220px] mx-auto px-6 lg:px-14">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <motion.p {...fadeUp(0)} className="font-mono text-xs tracking-widest mb-5" style={{ color: "#3b82f6" }}>
              ◈ TRIAL COMMAND GRID
            </motion.p>
            <motion.h2
              {...fadeUp(0.1)}
              className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1]"
            >
              Institutional Infrastructure
            </motion.h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Card 1: Private Trial Creation (col-span-2) */}
            <BentoCard delay={0.1} className="md:col-span-2">
              <BentoLabel>TRIAL.CREATE</BentoLabel>
              <BentoTitle>Private Trial Creation</BentoTitle>
              <div className="space-y-3 mb-5">
                {[
                  { label: "Min Age", value: "18", unit: "years" },
                  { label: "Requires Diabetes", value: "true", unit: "bool" },
                  { label: "HbA1c Threshold", value: "≥ 7.0", unit: "%" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl px-5 py-3.5 transition-colors hover:bg-white/5 group/row border border-white/5 active:scale-[0.98]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 group-hover/row:text-blue-400 transition-colors">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-white font-bold">{row.value}</span>
                      <span className="font-mono text-[10px] text-slate-600 group-hover/row:text-slate-400 transition-colors uppercase">{row.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="w-full rounded-2xl py-4 font-mono text-xs tracking-[0.2em] font-bold text-white uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 border border-blue-400/30"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
              >
                ⬡ Lock Criteria to Chain
              </button>
            </BentoCard>

            {/* Card 2: Consent Authority */}
            <BentoCard delay={0.15}>
              <BentoLabel>CONSENT.AUTH</BentoLabel>
              <h3 className="text-lg font-bold text-white mb-6">Consent Authority</h3>
              <div className="space-y-4">
                {[
                  { label: "Grant Access", active: true },
                  { label: "Revoke Access", active: false },
                  { label: "Delegate Auth", active: true },
                  { label: "Emergency Override", active: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between group/toggle py-1 border-b border-white/5 last:border-0 pb-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 group-hover/toggle:text-slate-300 transition-colors">{item.label}</span>
                    <div
                      className="relative w-11 h-[22px] rounded-full flex items-center px-[3px] transition-all cursor-pointer shadow-inner active:scale-95"
                      style={{ background: item.active ? "linear-gradient(90deg, #3b82f6, #2563eb)" : "rgba(255,255,255,0.06)" }}
                    >
                      <motion.div
                        layout
                        className="w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        initial={false}
                        animate={{ x: item.active ? 22 : 0 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            {/* Card 3: Encrypted Storage */}
            <BentoCard delay={0.2} className="overflow-hidden">
              <BentoLabel>STORAGE.FHE</BentoLabel>
              <BentoTitle>Encrypted Storage</BentoTitle>
              <div
                className="relative rounded-2xl overflow-hidden mb-6"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(59, 130, 246, 0.15)",
                  height: "140px",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020617] opacity-60 pointer-events-none" />
                <div
                  className="font-mono text-[9px] leading-[2] text-blue-400/30 whitespace-pre p-4"
                  style={{ animation: "infraHexScroll 20s linear infinite" }}
                >
                  {`0x4a2c f891 0e3d 7b56 ff12 d4a8\n3c7e 91b0 f5d2 6a83 e4c1 08b7\n7d9f 2e46 b3a1 c058 14d6 8f23\ne6b4 5c09 a217 f38d 6e4b d0c5\n92a8 1f73 d6e0 4b5c 87f2 3a9d\nc4e7 58b1 2d0f a396 6fc8 1e4a\n0b5d 8a2e f7c3 49d1 e685 3b07\na4f2 c891 0e3d 7b56 ff12 d4a8\n3c7e 91b0 f5d2 6a83 e4c1 08b7`}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "#3b82f6", animation: "infraPulse 2s ease-in-out infinite" }}
                  />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#3b82f6" }} />
                </span>
                <span className="font-mono text-xs font-medium" style={{ color: "#3b82f6" }}>On-Chain Active</span>
              </div>
            </BentoCard>

            {/* Card 4: Selective Decryption (col-span-2) */}
            <BentoCard delay={0.25} className="md:col-span-2">
              <BentoLabel>DECRYPT.GATE</BentoLabel>
              <BentoTitle>Selective Decryption</BentoTitle>
              <div className="space-y-4">
                {[
                  { entity: "0xSponsor…3f8a", permission: "AUTHORIZED", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
                  { entity: "0xPatient…7b2c", permission: "AUTHORIZED", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
                  { entity: "0x3rdParty…****", permission: "RESTRICTED", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
                ].map((row) => (
                  <div
                    key={row.entity}
                    className="flex items-center justify-between rounded-2xl px-5 py-4 transition-all hover:bg-white/5 group/access border border-white/5"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">{row.entity}</span>
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full ${row.permission === 'AUTHORIZED' ? 'bg-blue-400' : 'bg-red-500'} shadow-[0_0_8px_currentColor]`} />
                          <span className="font-mono text-[11px] font-bold tracking-tight" style={{ color: row.color }}>{row.permission}</span>
                        </div>
                      </div>
                    </div>
                    <Lock className={`h-4 w-4 ${row.permission === 'AUTHORIZED' ? 'text-blue-400/50' : 'text-red-500/50'} transition-colors group-hover/access:text-white`} />
                  </div>
                ))}
              </div>
            </BentoCard>


          </div>
        </div>

        <style>{`
          @keyframes infraHexScroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          @keyframes infraPulse {
            0%, 100% { transform: scale(1); opacity: 0.75; }
            50% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes engineCursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes logLinePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
      </section>

      {/* ════════════════ SECTION 2 — THE ENGINE ════════════════ */}
      <section
        id="engine"
        className="relative py-28 lg:py-36 overflow-hidden bg-black"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full blur-[120px] opacity-10"
            style={{ background: "radial-gradient(ellipse, rgba(59, 130, 246, 0.4), transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 max-w-[1220px] mx-auto px-6 lg:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

            {/* Left: copy + stats */}
            <div>
              <motion.p {...fadeUp(0)} className="font-mono text-xs tracking-widest mb-6" style={{ color: "#3b82f6" }}>
                ◈ LIVE ELIGIBILITY ENGINE
              </motion.p>
              <motion.h2
                {...fadeUp(0.1)}
                className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-6"
              >
                The Engine
              </motion.h2>
              <motion.p
                {...fadeUp(0.2)}
                className="text-slate-400 text-[17px] leading-relaxed mb-12 max-w-md"
              >
                Homomorphic gates compute patient eligibility without ever reading patient data.
                Every operation is sealed, auditable, and provably private.
              </motion.p>

              {/* Stats */}
              <motion.div {...fadeUp(0.3)} className="grid grid-cols-3 gap-6">
                {[
                  { value: "99.97%", label: "Uptime" },
                  { value: "< 2s", label: "Compute Time" },
                  { value: "0", label: "Data Exposed" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col gap-2">
                    <div
                      className="text-3xl font-bold tracking-tight"
                      style={{ color: "#3b82f6" }}
                    >
                      {value}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Terminal */}
            <motion.div {...fadeUp(0.15)}>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "#060e18",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  boxShadow: "0 0 60px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                {/* Terminal titlebar */}
                <div
                  className="flex items-center gap-2 px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)" }}
                >
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  <span className="font-mono text-[11px] text-slate-600 ml-3">medvault_kernel.log</span>
                </div>

                {/* Log lines */}
                <div className="p-6 space-y-3">
                  {[
                    { time: "12:00:01", msg: "SCANNING PROFILE...", active: false, done: true },
                    { time: "12:00:02", msg: "LOADING FHE KEYS", active: false, done: true },
                    { time: "12:00:03", msg: "RUNNING ENCRYPTED GT", active: true, done: false },
                    { time: "12:00:04", msg: "AND OPERATION SUCCESS", active: true, done: false },
                    { time: "12:00:05", msg: "RESULT SEALED — ELIGIBLE", active: false, done: true },
                    { time: "12:00:06", msg: "TRANSMITTING SIGNAL...", active: false, done: false },
                  ].map(({ time, msg, active, done }) => (
                    <div
                      key={time}
                      className="flex items-center gap-4 py-1.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <span className="font-mono text-[11px] text-slate-700 shrink-0 w-16">{time}</span>
                      <span
                        className="font-mono text-[13px] font-medium"
                        style={{
                          color: active ? "#3b82f6" : done ? "#64748b" : "#94a3b8",
                          animation: active ? "logLinePulse 1.8s ease-in-out infinite" : "none",
                        }}
                      >
                        {active && <span style={{ color: "#3b82f6", marginRight: 6 }}>▶</span>}
                        {msg}
                      </span>
                    </div>
                  ))}

                  {/* Cursor line */}
                  <div className="flex items-center gap-3 pt-2">
                    <span className="font-mono text-[13px]" style={{ color: "#3b82f6" }}>$</span>
                    <div
                      className="w-[9px] h-[16px] rounded-sm"
                      style={{
                        background: "#3b82f6",
                        animation: "engineCursorBlink 1.1s step-start infinite",
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ════════════════ SECTION 3 — SYSTEM LAYERS ════════════════ */}
      <section
        id="architecture"
        className="relative py-28 lg:py-36 overflow-hidden bg-black"
      >
        <div className="relative z-10 max-w-[1220px] mx-auto px-6 lg:px-14">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-20">
            <motion.p {...fadeUp(0)} className="font-mono text-xs tracking-widest mb-5" style={{ color: "#3b82f6" }}>
              ◈ ARCHITECTURE BLUEPRINT
            </motion.p>
            <motion.h2
              {...fadeUp(0.1)}
              className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1]"
            >
              System Layers
            </motion.h2>
          </div>

          {/* 4-column architecture layout */}
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">

            {/* Horizontal connector line (desktop only) */}
            <div
              className="hidden lg:block absolute top-[52px] left-[calc(12.5%+4px)] right-[calc(12.5%+4px)] h-px pointer-events-none"
              style={{
                background: "linear-gradient(to right, transparent, rgba(59, 130, 246, 0.4) 15%, rgba(59, 130, 246, 0.4) 85%, transparent)",
              }}
            />

            {[
              {
                icon: Lock,
                title: "Client Encryption",
                desc: "AES-256 + FHE key generation. Data never leaves device unencrypted.",
                ref: "0xA91F3E",
                delay: 0.1,
              },
              {
                icon: Cpu,
                title: "FHE Smart Contracts",
                desc: "On-chain homomorphic computation. FHE gates for boolean logic.",
                ref: "0xB82C9D",
                delay: 0.2,
              },
              {
                icon: Shield,
                title: "Permission Layer",
                desc: "RBAC + patient consent authority. Cryptographic access control.",
                ref: "0xC73E8A",
                delay: 0.3,
              },
              {
                icon: Key,
                title: "Selective Decryption",
                desc: "Threshold decryption. Sponsor + patient keys required.",
                ref: "0xD64F2B",
                delay: 0.4,
              },
            ].map(({ icon: Icon, title, desc, ref, delay }) => (
              <motion.div
                key={title}
                {...fadeUp(delay)}
                className="group flex flex-col items-center text-center relative"
              >
                {/* Icon container */}
                <div
                  className="relative z-10 flex items-center justify-center w-[56px] h-[56px] rounded-2xl mb-6 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: "rgba(10,22,40,0.9)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.25)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(59, 130, 246, 0.55)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 rgba(59, 130, 246, 0)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(59, 130, 246, 0.2)";
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: "#3b82f6" }} strokeWidth={1.5} />
                </div>

                {/* Hover REF_ID */}
                <div
                  className="font-mono text-[9px] tracking-widest mb-3 transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0"
                  style={{ color: "#3b82f6" }}
                >
                  REF_ID: {ref}…
                </div>

                <h4 className="text-[15px] font-bold text-white mb-3 tracking-tight">{title}</h4>
                <p className="text-[13px] text-slate-500 leading-relaxed max-w-[200px]">{desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Bottom divider — subtle teal line */}
          <motion.div
            {...fadeIn(0.5)}
            className="mt-24 h-px w-full"
            style={{ background: "linear-gradient(to right, transparent, rgba(59, 130, 246, 0.15), transparent)" }}
          />
        </div>
      </section>

      {/* ════════════════ FINAL CTA ════════════════ */}
      <section className="py-32 relative overflow-hidden bg-black">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[400px] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />
        
        <div className="max-w-[1440px] mx-auto px-6 lg:px-14 relative z-10">
          <motion.div
            {...fadeIn(0)}
            className="relative overflow-hidden rounded-[3rem] bg-slate-900/40 backdrop-blur-2xl border border-white/10 px-8 py-24 md:px-24 text-center flex flex-col items-center shadow-[0_0_80px_rgba(0,0,0,0.4)] transition-all hover:border-blue-500/20 group/ctacard"
          >
            {/* Glossy top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent opacity-0 group-hover/ctacard:opacity-100 transition-opacity duration-1000" />
            
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-accent/20 blur-[120px] pointer-events-none transition-all duration-1000 group-hover/ctacard:scale-110" />
            <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
            
            <div className="absolute bottom-0 right-12 opacity-[0.03] pointer-events-none transition-all duration-1000 group-hover/ctacard:translate-y-4 group-hover/ctacard:scale-110">
              <ShieldCheck className="h-80 w-80 text-white" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent mb-6">Secured Ecosystem</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-white mb-6 leading-[1.0] font-display">
                Ready to join the future of Healthcare?
              </h2>
              <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-12 font-sans font-medium">
                Join <span className="text-white font-bold">1,200+ patients</span> already securing their medical destiny through MedVault's FHE-powered platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <Link to="/patient">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 font-extrabold h-14 px-12 rounded-2xl text-base shadow-2xl shadow-white/5 transition-all gap-3 group active:scale-95">
                    Register your Vault
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/sponsor">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-slate-700 hover:bg-white/5 text-white font-bold h-14 px-12 rounded-2xl text-base transition-all active:scale-95"
                  >
                    For Trial Sponsors
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
