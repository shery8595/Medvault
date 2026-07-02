import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { AnimatedDiagram } from "../../components/docs/AnimatedDiagram";
import { DocsCopyActions } from "../../components/docs/DocsPageToolbar";
import { motion } from "framer-motion";
import {
    Activity, Shield, Users, Database, ArrowRight, Lock, Key,
    CheckCircle2, FileCode2, Zap, TrendingUp, Scale, Heart,
    Building2, Bot, ShieldCheck, Coins, Stethoscope, AlertTriangle,
    BookOpen, BarChart3, Server, Cpu, GitBranch, Layers, ArrowDown,
    ExternalLink, CircleDot, Workflow
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { DOCS_CONTRACT_COUNT, PRODUCTION_APP_URL } from "../../lib/docsNav";
import { REPO_STATS } from "../../lib/docsStats";

const INTRO_STAT_TONE: Record<string, string> = {
    teal: "bg-teal-500 text-white",
    emerald: "bg-emerald-500 text-white",
    purple: "bg-violet-500 text-white",
    blue: "bg-blue-500 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-500 text-white",
};

const INTRO_STAT_SURFACE: Record<string, string> = {
    teal: "border-teal-200 bg-gradient-to-b from-teal-50 to-white",
    emerald: "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white",
    purple: "border-violet-200 bg-gradient-to-b from-violet-50 to-white",
    blue: "border-blue-200 bg-gradient-to-b from-blue-50 to-white",
    amber: "border-amber-200 bg-gradient-to-b from-amber-50 to-white",
    rose: "border-rose-200 bg-gradient-to-b from-rose-50 to-white",
};

const STEP_ROW_ICON: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    teal: "bg-teal-100 text-teal-600",
    amber: "bg-amber-100 text-amber-600",
    emerald: "bg-emerald-100 text-emerald-600",
};

const ROLE_CARD: Record<string, { border: string; icon: string; dot: string }> = {
    teal: { border: "border-teal-200", icon: "bg-teal-100 text-teal-600", dot: "bg-teal-500" },
    purple: { border: "border-purple-200", icon: "bg-purple-100 text-purple-600", dot: "bg-purple-500" },
    amber: { border: "border-amber-200", icon: "bg-amber-100 text-amber-600", dot: "bg-amber-500" },
    blue: { border: "border-blue-200", icon: "bg-blue-100 text-blue-600", dot: "bg-blue-500" },
};

const SECTION_BADGE: Record<string, string> = {
    teal: "bg-teal-100 text-teal-700",
    purple: "bg-purple-100 text-purple-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-800",
    cyan: "bg-cyan-100 text-cyan-800",
};

// ─── Animated Counter Stat ───
const AnimatedStat = ({ value, label, icon, color }: { value: string; label: string; icon: React.ReactNode; color: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border shadow-sm text-center group hover:shadow-md transition-all duration-300",
            INTRO_STAT_SURFACE[color] ?? "border-slate-200 bg-white"
        )}
    >
        <div
            className={cn(
                "p-2 rounded-lg mb-2 group-hover:scale-105 transition-transform duration-300 shadow-sm",
                INTRO_STAT_TONE[color] ?? "bg-slate-500 text-white"
            )}
        >
            {icon}
        </div>
        <div className="text-2xl font-black font-display text-slate-900 tracking-tight">{value}</div>
        <div className="text-[11px] font-semibold text-slate-600 mt-0.5 tracking-wide">{label}</div>
    </motion.div>
);

// ─── Section Divider ───
const Divider = () => (
    <div className="flex items-center gap-4 my-16">
        <div className="h-px bg-slate-200 flex-1" />
        <div className="w-3 h-3 rotate-45 border border-slate-300 bg-slate-100" />
        <div className="h-px bg-slate-200 flex-1" />
    </div>
);

// ─── Architecture Flow Diagram (CSS/SVG) ───
const layerStyles: Record<
    string,
    { container: string; dot: string; label: string; iconBg: string; nodeBorder: string }
> = {
    blue: {
        container: "bg-blue-50/90 border-blue-200",
        dot: "bg-blue-500",
        label: "text-blue-800",
        iconBg: "bg-blue-100 text-blue-700",
        nodeBorder: "border-blue-100 hover:border-blue-300",
    },
    teal: {
        container: "bg-teal-50/90 border-teal-200",
        dot: "bg-teal-600",
        label: "text-teal-800",
        iconBg: "bg-teal-100 text-teal-700",
        nodeBorder: "border-teal-100 hover:border-teal-300",
    },
    purple: {
        container: "bg-violet-50/90 border-violet-200",
        dot: "bg-violet-500",
        label: "text-violet-800",
        iconBg: "bg-violet-100 text-violet-700",
        nodeBorder: "border-violet-100 hover:border-violet-300",
    },
    amber: {
        container: "bg-amber-50/90 border-amber-200",
        dot: "bg-amber-500",
        label: "text-amber-900",
        iconBg: "bg-amber-100 text-amber-800",
        nodeBorder: "border-amber-100 hover:border-amber-300",
    },
};

const ArchitectureFlowDiagram = () => {
    const layers = [
        {
            label: "CLIENT LAYER",
            color: "blue",
            nodes: [
                { icon: <Users className="w-4 h-4" />, name: "Patient Browser", detail: "@zama-fhe/sdk SDK" },
                { icon: <Building2 className="w-4 h-4" />, name: "Sponsor Portal", detail: "React DApp" },
            ]
        },
        {
            label: "SMART CONTRACT LAYER",
            color: "teal",
            nodes: [
                { icon: <Database className="w-4 h-4" />, name: "AnonymousPatientRegistry", detail: "Semaphore identity" },
                { icon: <Database className="w-4 h-4" />, name: "MedVaultRegistry", detail: "Encrypted vault" },
                { icon: <Activity className="w-4 h-4" />, name: "EligibilityEngine", detail: "FHE compute" },
                { icon: <Cpu className="w-4 h-4" />, name: "TrialManager", detail: "Trial logic" },
                { icon: <Shield className="w-4 h-4" />, name: "ConsentManager", detail: "ACL gating" },
            ]
        },
        {
            label: "DEFI & AUTOMATION",
            color: "purple",
            nodes: [
                { icon: <Coins className="w-4 h-4" />, name: "IncentiveVault", detail: "Escrow Pool" },
                { icon: <TrendingUp className="w-4 h-4" />, name: "StakingManager", detail: "Aave V3 Yield" },
                { icon: <Bot className="w-4 h-4" />, name: "Automation", detail: "Chainlink Keeper" },
            ]
        },
        {
            label: "INDEXING & AUDIT",
            color: "amber",
            nodes: [
                { icon: <Server className="w-4 h-4" />, name: "Subgraph", detail: "The Graph" },
                { icon: <FileCode2 className="w-4 h-4" />, name: "DataAccessLog", detail: "Audit Trail" },
            ]
        },
    ];

    return (
        <div className="not-prose my-8 p-5 md:p-6 rounded-2xl border border-slate-200 bg-white relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
            {/* Glow accents */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-teal-100 text-teal-700 border border-teal-200">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 m-0">System Architecture — Layered Overview</h3>
                        <p className="text-xs text-slate-500 m-0">4 distinct layers with strict separation of concerns</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {layers.map((layer, layerIdx) => {
                        const styles = layerStyles[layer.color];
                        return (
                        <div key={layer.label}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: layerIdx * 0.15 }}
                                viewport={{ once: true }}
                                className={`rounded-2xl border p-4 ${styles.container}`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-2 h-2 rounded-full ${styles.dot} animate-pulse`} />
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${styles.label}`}>{layer.label}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {layer.nodes.map((node, nodeIdx) => (
                                        <motion.div
                                            key={node.name}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: layerIdx * 0.15 + nodeIdx * 0.05 }}
                                            viewport={{ once: true }}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border shadow-sm hover:shadow-md transition-all duration-300 group cursor-default",
                                                styles.nodeBorder
                                            )}
                                        >
                                            <div className={`p-1.5 rounded-lg ${styles.iconBg} group-hover:scale-110 transition-transform`}>
                                                {node.icon}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900 leading-tight">{node.name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{node.detail}</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Connector arrows between layers */}
                            {layerIdx < layers.length - 1 && (
                                <div className="flex justify-center py-1">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        viewport={{ once: true }}
                                        className="flex flex-col items-center gap-0.5"
                                    >
                                        <div className="w-px h-3 bg-slate-300" />
                                        <ArrowDown className="w-3 h-3 text-slate-400" />
                                    </motion.div>
                                </div>
                    )}
                    </div>
                    );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── FHE Encryption Pipeline Diagram ───
const EncryptionPipelineDiagram = () => {
    const stages = [
        { label: "Plaintext", value: "age = 42", bg: "bg-rose-500", iconRing: "bg-rose-100", iconText: "text-rose-600", desc: "Raw patient data in browser memory", icon: <Heart className="w-4 h-4" /> },
        { label: "FHE Encrypt", value: "@zama-fhe/sdk.encrypt32(42)", bg: "bg-amber-500", iconRing: "bg-amber-100", iconText: "text-amber-600", desc: "Client-side encryption via Zama SDK", icon: <Lock className="w-4 h-4" /> },
        { label: "Ciphertext", value: "0x7f3a...b2c1", bg: "bg-purple-500", iconRing: "bg-purple-100", iconText: "text-purple-600", desc: "euint32 handle stored on-chain", icon: <Database className="w-4 h-4" /> },
        { label: "FHE Compute", value: "FHE.ge(age, minAge)", bg: "bg-blue-500", iconRing: "bg-blue-100", iconText: "text-blue-600", desc: "Homomorphic comparison in coprocessor", icon: <Cpu className="w-4 h-4" /> },
        { label: "Encrypted Result", value: "ebool → euint32 score", bg: "bg-blue-500", iconRing: "bg-blue-100", iconText: "text-blue-600", desc: "Score accumulated via CMUX", icon: <Activity className="w-4 h-4" /> },
        { label: "Patient Decrypt", value: "EIP-712 → plaintext 100", bg: "bg-emerald-500", iconRing: "bg-emerald-100", iconText: "text-emerald-600", desc: "Only patient can view their score", icon: <Key className="w-4 h-4" /> },
    ];

    return (
        <div className="not-prose my-12 p-6 md:p-8 rounded-3xl border border-slate-200 bg-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute top-1/2 left-0 w-full h-48 bg-gradient-to-r from-rose-500/5 via-purple-500/5 to-emerald-500/5 blur-[80px] -translate-y-1/2" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 m-0">FHE Encryption Pipeline — Data Flow</h3>
                        <p className="text-xs text-slate-500 m-0">End-to-end encryption lifecycle from plaintext to patient-only decryption</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch gap-2">
                    {stages.map((stage, idx) => (
                        <div key={stage.label} className="contents">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                viewport={{ once: true }}
                                className="flex-1 p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-lg transition-all duration-300 group relative"
                            >
                                {/* Stage number badge */}
                                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${stage.bg} text-white text-[10px] font-black flex items-center justify-center shadow-lg`}>
                                    {idx + 1}
                                </div>

                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stage.iconRing)}>
                                    <div className={stage.iconText}>
                                        {stage.icon}
                                    </div>
                                </div>

                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stage.label}</div>
                                <div className="font-mono text-xs text-slate-700 font-bold mb-2 break-all leading-relaxed">{stage.value}</div>
                                <div className="text-[11px] text-slate-500 leading-snug">{stage.desc}</div>
                            </motion.div>

                            {idx < stages.length - 1 && (
                                <div className="hidden md:flex items-center justify-center px-0">
                                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200/50">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <p className="text-xs text-rose-700 m-0 font-medium">
                        <strong>Zero Plaintext Exposure:</strong> Raw values exist only in browser memory for milliseconds. After encryption, plaintext is discarded. The blockchain never sees unencrypted data.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ─── Contract Interaction Diagram ───
const ContractInteractionDiagram = () => {
    const nodes = [
        { id: "patient", title: "Patient Wallet", subtitle: "Encrypted Data Owner", icon: <Users className="h-5 w-5" />, position: { x: 30, y: 20 }, color: "teal" as const },
        { id: "registry", title: "MedVaultRegistry", subtitle: "Encrypted vault", icon: <Database className="h-5 w-5" />, position: { x: 260, y: 20 }, color: "blue" as const },
        { id: "engine", title: "Eligibility Engine", subtitle: "FHE Computation", icon: <Activity className="h-5 w-5" />, position: { x: 500, y: 20 }, color: "purple" as const },
        { id: "sponsor", title: "Sponsor Wallet", subtitle: "Trial Creator", icon: <Building2 className="h-5 w-5" />, position: { x: 30, y: 200 }, color: "amber" as const },
        { id: "trialmanager", title: "Trial Manager", subtitle: "Trial Logic & Access", icon: <Shield className="h-5 w-5" />, position: { x: 260, y: 200 }, color: "emerald" as const },
        { id: "vault", title: "Incentive Vault", subtitle: "Escrow & Payouts", icon: <Coins className="h-5 w-5" />, position: { x: 500, y: 200 }, color: "purple" as const },
    ];

    const edges = [
        { id: "e1", from: "patient", to: "registry", animated: true },
        { id: "e2", from: "sponsor", to: "trialmanager", animated: true },
        { id: "e3", from: "registry", to: "engine", animated: true },
        { id: "e4", from: "trialmanager", to: "engine", animated: true },
        { id: "e5", from: "trialmanager", to: "vault", animated: true },
    ];

    return (
        <div className="my-12">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <GitBranch className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 m-0">Contract Interaction Graph</h3>
                    <p className="text-xs text-slate-500 m-0">Animated data flow between core smart contracts</p>
                </div>
            </div>
            <AnimatedDiagram nodes={nodes} edges={edges} height={420} className="w-full" />
            <p className="text-center text-xs font-medium text-slate-500 mt-3 tracking-tight">
                Fig 1. Data flows from Patient → Registry → Engine and Sponsor → TrialManager → Engine. Animated edges show live ciphertext transfer paths.
            </p>
        </div>
    );
};

// ─── FHE State Machine ───
const FheStateMachine = () => {
    const states = [
        { step: "01", title: "Client Encryption", desc: "`@zama-fhe/sdk` encrypts health metrics entirely in the browser using FHE.", icon: <Users className="w-5 h-5" />, color: "blue" as const, iconRing: "bg-blue-100", iconGlyph: "text-blue-600" },
        { step: "02", title: "On-Chain Vault", desc: "`MedVaultRegistry` stores ciphertext handles in encrypted contract state.", icon: <Database className="w-5 h-5" />, color: "purple" as const, iconRing: "bg-purple-100", iconGlyph: "text-purple-600" },
        { step: "03", title: "FHEVM Engine", desc: "`EligibilityEngine` runs homomorphic comparisons without decrypting inputs.", icon: <Lock className="w-5 h-5" />, color: "teal" as const, iconRing: "bg-teal-100", iconGlyph: "text-teal-600", highlight: true },
        { step: "04", title: "EIP-712 Decrypt", desc: "Only the patient can sign a viewing key to decrypt their match score.", icon: <Key className="w-5 h-5" />, color: "amber" as const, iconRing: "bg-white/20", iconGlyph: "text-white" },
    ];

    return (
        <div className="my-16 p-8 border border-slate-200 rounded-3xl bg-slate-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

            <h3 className="text-xl font-bold font-display text-slate-900 mt-0 mb-8 relative z-10 flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                The FHE Matching State Machine
            </h3>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
                {states.map((s, i) => (
                    <motion.div key={s.step} className="contents">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.2 }}
                            viewport={{ once: true }}
                            className={`flex-1 w-full p-4 rounded-2xl shadow-sm text-center ${s.highlight
                                ? "bg-white border border-slate-200 border-b-4 border-b-blue-500"
                                : s.color === "amber"
                                    ? "bg-amber-500 text-white"
                                    : "bg-white border border-slate-200"
                                }`}
                        >
                            <div
                                className={cn(
                                    "mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-3",
                                    s.iconRing
                                )}
                            >
                                <div className={s.iconGlyph}>
                                    {s.icon}
                                </div>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${s.color === "amber" && !s.highlight ? "text-white/70" : "text-slate-400"}`}>State {s.step}</div>
                            <div className={`font-medium text-sm ${s.color === "amber" && !s.highlight ? "text-white" : "text-slate-900"}`}>{s.title}</div>
                            <div className={`text-xs mt-2 ${s.color === "amber" && !s.highlight ? "text-white/80" : "text-slate-500"}`}>{s.desc}</div>
                        </motion.div>
                        {i < states.length - 1 && (
                            <ArrowRight className="w-5 h-5 text-slate-300 hidden md:block shrink-0" />
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ───
export function IntroductionDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">

                {/* ═══════════════════════════════════════════════════════════════════════
                    HERO SECTION — Premium Landing
                ═══════════════════════════════════════════════════════════════════════ */}
                <div className="not-prose relative mb-10">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-[0_12px_40px_-20px_rgba(0,104,95,0.2)] relative"
                    >
                        <DocsCopyActions className="absolute top-3 right-3 z-20" />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#00685f]/[0.06] via-transparent to-blue-500/[0.05] pointer-events-none" />
                        <div className="grid md:grid-cols-[1.18fr_0.76fr] gap-0 items-stretch">
                            <div className="p-5 md:p-8 flex flex-col justify-center relative z-10 pr-28 md:pr-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00685f] animate-pulse" />
                                    <span className="text-[#00685f] text-[10px] font-black uppercase tracking-[0.18em]">
                                        Getting started
                                    </span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight mb-2 leading-tight m-0">
                                    MedVault<span className="text-[#00685f]">.</span>
                                </h1>
                                <p className="text-sm md:text-base text-slate-600 max-w-xl leading-relaxed m-0">
                                    FHE-powered clinical trial matching on{" "}
                                    <strong className="text-slate-900">Ethereum Sepolia</strong> with{" "}
                                    <strong className="text-slate-900">Zama FHE</strong> — homomorphic eligibility on
                                    ciphertexts, Semaphore identity, and consent-gated access.
                                </p>
                                <div className="flex flex-wrap gap-2 mt-5">
                                    <Link
                                        to="/docs/architecture"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00685f] text-white text-xs font-bold shadow-sm hover:bg-[#005a52] transition-colors"
                                    >
                                        <Cpu className="w-3.5 h-3.5" /> Architecture
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                    <Link
                                        to="/docs/engine"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                                    >
                                        <Activity className="w-3.5 h-3.5" /> Engine
                                    </Link>
                                    <Link
                                        to="/docs/testing"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Tests ({REPO_STATS.testSuiteDefaultPassing})
                                    </Link>
                                    <Link
                                        to="/docs/security-model"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                                    >
                                        <Shield className="w-3.5 h-3.5" /> Security
                                    </Link>
                                    <a
                                        href={PRODUCTION_APP_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#00685f] text-xs font-bold border border-[#00685f]/30 hover:bg-[#00685f]/5 transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> Live app
                                    </a>
                                </div>
                            </div>
                            <div className="relative flex min-h-[125px] md:min-h-[179px] items-center justify-center p-3 md:p-4">
                                <img
                                    src="/assets/images/medvault_fhe_hero.png"
                                    alt="MedVault architecture"
                                    className="relative z-[1] w-[90%] max-w-full h-auto max-h-[125px] md:max-h-[179px] object-contain object-center opacity-95"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent md:bg-gradient-to-l pointer-events-none" />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ─── Platform Statistics Bar ─── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 my-8 not-prose">
                    <AnimatedStat
                        value={String(DOCS_CONTRACT_COUNT)}
                        label="Production contracts"
                        icon={<FileCode2 className="w-5 h-5" />}
                        color="teal"
                    />
                    <AnimatedStat value={String(REPO_STATS.testSuiteDefaultPassing)} label="Hardhat tests" icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
                    <AnimatedStat value="3" label="DeFi Protocols" icon={<TrendingUp className="w-5 h-5" />} color="purple" />
                    <AnimatedStat value="0" label="Data Exposed" icon={<Shield className="w-5 h-5" />} color="blue" />
                    <AnimatedStat value="4" label="FHE Type System" icon={<Lock className="w-5 h-5" />} color="amber" />
                    <AnimatedStat value="<100ms" label="Query Latency" icon={<Zap className="w-5 h-5" />} color="rose" />
                </div>

                <p className="text-lg text-slate-500 max-w-prose leading-relaxed mb-8">
                    MedVault allows patients to match with life-saving clinical trials while keeping their health data <em>mathematically encrypted at all times</em> — at rest, in transit, and most critically, <strong>during the actual computation of the eligibility algorithm</strong>. No trusted third party. No decryption. No data exposure. Ever.
                </p>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION I — Architecture Diagram
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>I. System Architecture at a Glance</h2>
                <p>
                    MedVault is built on a <strong>4-layer architecture</strong> that strictly separates client-side encryption, on-chain FHE computation, DeFi reward mechanisms, and event indexing. Each layer communicates through well-defined contract interfaces with FHE ACL-gated access control.
                </p>

                <ArchitectureFlowDiagram />

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION II — The Data Sovereignty Crisis
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>II. The Data Sovereignty Crisis in Healthcare</h2>

                <p>
                    Traditional clinical trial recruitment is fundamentally broken. The pharmaceutical industry spends an estimated <strong>$2.6 billion per drug</strong> brought to market, with patient recruitment alone consuming up to 40% of the timeline. To determine if a single patient qualifies for a life-saving trial, research organizations demand complete access to unencrypted, highly sensitive medical records.
                </p>

                <div className="my-8 p-6 bg-rose-50 border-l-4 border-rose-500 rounded-r-2xl">
                    <h4 className="text-rose-900 font-bold mt-0 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        The Web2 Privacy Catastrophe — By the Numbers
                    </h4>
                    <ul className="text-rose-800 mb-0 space-y-3">
                        <li><strong>Patient Custody Loss:</strong> The healthcare industry experienced over <strong>700 data breaches</strong> in 2023 alone, exposing 133 million records. Once submitted, data sovereignty is permanently and irrevocably lost.</li>
                        <li><strong>Sponsor Overhead:</strong> Pharmaceutical companies incur massive compliance overhead (HIPAA, GDPR, CCPA) to secure millions of records — often discovering that <strong>85-95% of screened candidates are ineligible</strong>.</li>
                        <li><strong>Recruitment Bottlenecks:</strong> 80% of clinical trials fail to meet enrollment deadlines. 48% of research sites fail to enroll a single patient.</li>
                        <li><strong>Data Silos:</strong> Cross-institutional rare-disease aggregation is nearly impossible without exposing patient identity across organizational boundaries.</li>
                    </ul>
                </div>

                <p>
                    MedVault radically reimagines this pipeline using <strong>Fully Homomorphic Encryption (FHE)</strong> deployed directly on-chain. The blockchain determines whether a patient matches a trial's criteria <strong>without ever learning what those criteria or patient values actually are</strong>.
                </p>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION III — FHE Encryption Pipeline Diagram
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>III. The FHE Encryption Pipeline</h2>
                <p>
                    The following diagram traces a single patient health attribute (e.g., Age) through the complete MedVault encryption lifecycle — from raw plaintext in the browser, through FHE encryption, on-chain homomorphic computation, and finally patient-only decryption.
                </p>

                <EncryptionPipelineDiagram />

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION IV — How It Works (5-Step Walkthrough)
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>IV. How MedVault Works — A 60-Second Overview</h2>

                <p>
                    For readers new to Fully Homomorphic Encryption or decentralized clinical trials, here is the complete patient-to-match lifecycle in five atomic steps.
                </p>

                <div className="not-prose space-y-4 my-10">
                    {[
                        { step: "1", title: "Patient Encrypts Health Data in Browser", desc: "The patient enters their medical metrics (Age, Blood Pressure, HbA1c, Weight) into the MedVault dashboard. The Zama @zama-fhe/sdk SDK encrypts every value into FHE ciphertexts entirely within the browser. The original plaintext values are immediately discarded from memory. Only encrypted ciphertext blobs are transmitted to the blockchain.", icon: <Lock className="w-6 h-6" />, color: "blue" },
                        { step: "2", title: "Sponsor Publishes Encrypted Trial Criteria", desc: "A verified pharmaceutical sponsor defines their trial eligibility criteria (e.g., Age 18-65, HbA1c < 7.0). These requirements are also encrypted as euint32 ciphertext values and stored on-chain in the TrialManager contract. The trial's structural metadata (name, phase, location) remains public.", icon: <Building2 className="w-6 h-6" />, color: "purple" },
                        { step: "3", title: "EligibilityEngine Computes on Encrypted Data", desc: "The EligibilityEngine smart contract performs FHE homomorphic operations (FHE.ge(), FHE.le(), FHE.cmux()) to compare encrypted patient values against encrypted trial bounds. The result is an encrypted eligibility score (0-100) stored on-chain. The network computes the match without decrypting any inputs.", icon: <Activity className="w-6 h-6" />, color: "teal" },
                        { step: "4", title: "Patient Decrypts Their Own Score", desc: "The encrypted score can only be decrypted by the patient. They sign an EIP-712 message in MetaMask to generate a cryptographic viewing key. The Zama KMS threshold decryption service verifies this signature and returns the decrypted score exclusively to the patient.", icon: <Key className="w-6 h-6" />, color: "amber" },
                        { step: "5", title: "Optional Consent & Enrollment", desc: "If the score is 100 (perfect match), the patient may optionally grant identity access to the sponsor through ConsentManager. After sponsor accepts, the patient self-enrolls in the SponsorIncentiveVault reward pool (permit-holder-only — sponsor cannot call registerAnonymousParticipant). Chainlink Automation handles milestone payouts.", icon: <CheckCircle2 className="w-6 h-6" />, color: "emerald" },
                    ].map((s, i) => (
                        <motion.div
                            key={s.step}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            viewport={{ once: true }}
                            className="flex gap-5 items-start p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div
                                className={cn(
                                    "p-3 rounded-2xl shrink-0 mt-0.5",
                                    STEP_ROW_ICON[s.color] ?? "bg-slate-100 text-slate-600"
                                )}
                            >
                                {s.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-400">Step {s.step}</span>
                                </div>
                                <h4 className="font-bold text-lg text-slate-900 mt-0 mb-2">{s.title}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed mb-0">{s.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION V — Contract Interaction Diagram
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>V. Smart Contract Interaction Graph</h2>
                <p>
                    MedVault&apos;s production contracts form a dependency graph with strictly scoped cross-contract
                    interactions. The diagram below shows primary data flow paths between core contracts on{" "}
                    <strong>Ethereum Sepolia</strong>.
                </p>

                <ContractInteractionDiagram />

                <FheStateMachine />

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION VI — FHE vs ZKP Comparison
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>VI. FHE vs. Zero-Knowledge Proofs — An Architectural Decision</h2>
                <p>
                    A critical question from auditors: <em>"Why use FHE instead of ZKPs?"</em> The answer lies in the fundamental difference between proving a statement and computing on hidden data.
                </p>

                {/* Comparison Table */}
                <div className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 m-0">Architectural Comparison: FHE vs. ZKP for Clinical Trial Matching</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700">Dimension</th>
                                    <th className="text-left px-4 py-3 font-bold text-blue-700">FHE (MedVault)</th>
                                    <th className="text-left px-4 py-3 font-bold text-purple-700">ZKP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { dim: "Patient Online Requirement", fhe: "Upload once, go offline forever. Engine evaluates asynchronously.", zkp: "Must be online to generate a proof for every trial application.", win: "fhe" },
                                    { dim: "Trial Parameter Updates", fhe: "Sponsor can update criteria without invalidating patient data.", zkp: "Patient's proof invalidates immediately on any criteria change.", win: "fhe" },
                                    { dim: "Multi-Trial Matching", fhe: "Single encrypted profile matched against unlimited trials.", zkp: "Separate proof generation required per trial. O(n) computation.", win: "fhe" },
                                    { dim: "Computation Location", fhe: "On-chain in the Zama FHE coprocessor. Fully trustless.", zkp: "Client-side. Requires trusted prover setup.", win: "fhe" },
                                    { dim: "Data Granularity", fhe: "Exact encrypted values. Complex range queries supported.", zkp: "Only proves boolean statements. No partial scores.", win: "fhe" },
                                    { dim: "Gas Cost", fhe: "Higher per-operation. Optimized via batched CMUX compute.", zkp: "Lower per-proof. But O(n) proofs needed per patient.", win: "draw" },
                                    { dim: "Proof Size", fhe: "Ciphertexts are larger (~256 bytes per euint32).", zkp: "Proofs are compact (~128-256 bytes).", win: "zkp" },
                                    { dim: "Setup Complexity", fhe: "No trusted setup. Standard FHE bootstrapping keys.", zkp: "May require trusted setup ceremony (zk-SNARKs).", win: "fhe" },
                                ].map((row, i) => (
                                    <tr key={row.dim} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                                        <td className="px-4 py-3 font-bold text-slate-700 text-xs">{row.dim}</td>
                                        <td className={`px-4 py-3 text-xs ${row.win === "fhe" || row.win === "draw" ? "text-blue-700" : "text-slate-500"}`}>
                                            {row.win === "fhe" && <span className="mr-1">✓</span>}{row.fhe}
                                        </td>
                                        <td className={`px-4 py-3 text-xs ${row.win === "zkp" ? "text-purple-700" : "text-slate-500"}`}>
                                            {row.win === "zkp" && <span className="mr-1">✓</span>}{row.zkp}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
                        Table 1. FHE wins on asynchronous multi-trial matching — the core requirement for clinical trial platforms.
                    </div>
                </div>

                <Callout type="info" title="The Bottom Line">
                    ZKPs prove that a statement is true. FHE allows you to <strong>compute on the data without knowing what it is</strong>. For a clinical trial platform where sponsors need to dynamically evaluate thousands of encrypted patient profiles against evolving trial criteria — without patient interaction — FHE is the mathematically correct choice.
                </Callout>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION VII — Key Innovations
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>VII. Key Technical Innovations</h2>
                <p>
                    MedVault introduces several innovations that distinguish it from both traditional clinical trial platforms and existing blockchain health solutions.
                </p>

                <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
                    {[
                        { icon: <Activity className="w-8 h-8" />, title: "Encrypted Matching Engine", desc: "The EligibilityEngine computes weighted eligibility scores across 3+ health dimensions using FHE.cmux() conditional multiplexing — without decrypting any patient data. Scores accumulate entirely in ciphertext space.", gradient: "from-blue-500 to-emerald-500" },
                        { icon: <Coins className="w-8 h-8" />, title: "Private Yield Generation", desc: "Trial rewards live in ConfidentialETH (encrypted balances). Stake confidentially inside MedVault or use the public Aave path; private unstake returns to encrypted cETH without on-chain amount leaks from Aave events.", gradient: "from-purple-500 to-fuchsia-500" },
                        { icon: <Bot className="w-8 h-8" />, title: "Automated Compliance Trail", desc: "Every sensitive operation is logged to DataAccessLog with anonymized keccak256 hashes. MedVaultAutomation uses Chainlink Keepers for trustless milestone payouts. Compliance-oriented audit trail — not a claim of HIPAA/GDPR certification.", gradient: "from-blue-500 to-cyan-500" },
                    ].map(inn => (
                        <motion.div
                            key={inn.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group"
                            style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${inn.gradient} opacity-100`} />
                            <div className="relative z-10">
                                <div className="opacity-80 mb-4">{inn.icon}</div>
                                <h3 className="text-xl font-black mb-3">{inn.title}</h3>
                                <p className="text-sm opacity-90 font-medium leading-relaxed">{inn.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION VIII — Protocol Stakeholders
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>VIII. Protocol Stakeholders</h2>
                <p>
                    MedVault operates with four distinct actor roles, each with unique permissions and cryptographic capabilities.
                </p>

                <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
                    {[
                        { icon: <Heart className="w-6 h-6" />, title: "Patient", color: "teal", permissions: ["Encrypt & store health metrics on-chain", "Apply to unlimited clinical trials", "Decrypt their own eligibility scores (EIP-712)", "Grant/revoke identity access to sponsors", "Withdraw or stake rewards with encrypted amount staging", "Optional stealth-address public exit via relayer"] },
                        { icon: <Building2 className="w-6 h-6" />, title: "Sponsor", color: "purple", permissions: ["Create trials with public eligibility bounds (after KYC on mainnet; open on Sepolia demo)", "View anonymized match counts via Subgraph", "Accept/reject matched patients", "Fund trial incentive escrow pools", "Access consented patient profiles only"] },
                        { icon: <ShieldCheck className="w-6 h-6" />, title: "Protocol Admin", color: "amber", permissions: ["Add/remove verified sponsors (multisig)", "Emergency halt trials via SponsorRegistry", "Authorize contracts in DataAccessLog", "Manage Chainlink Automation upkeep"] },
                        { icon: <Bot className="w-6 h-6" />, title: "Chainlink Keeper", color: "blue", permissions: ["Trigger checkUpkeep() on MedVaultAutomation", "Execute performUpkeep() for milestone payouts", "Automate trial deadline enforcement", "No access to encrypted data"] },
                    ].map(role => (
                        <div
                            key={role.title}
                            className={cn(
                                "p-6 rounded-2xl border bg-white shadow-sm",
                                ROLE_CARD[role.color]?.border ?? "border-slate-200"
                            )}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div
                                    className={cn(
                                        "p-2.5 rounded-xl",
                                        ROLE_CARD[role.color]?.icon ?? "bg-slate-100 text-slate-600"
                                    )}
                                >
                                    {role.icon}
                                </div>
                                <h4 className="font-bold text-slate-900 text-lg m-0">{role.title}</h4>
                            </div>
                            <ul className="space-y-2 m-0 p-0">
                                {role.permissions.map(p => (
                                    <li key={p} className="flex items-start gap-2 text-xs text-slate-600">
                                        <div
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                                ROLE_CARD[role.color]?.dot ?? "bg-slate-400"
                                            )}
                                        />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <Callout type="warning" title="Testnet environment">
                    The app targets <strong>Ethereum Sepolia</strong> (chainId 11155111) with Privy embedded wallets. FHE operations use the Zama testnet relayer and can take longer than plain transfers. Contract behavior is covered by 260+ Hardhat tests with local FHE mocks.
                </Callout>

                <Callout type="info" title="Known privacy limits (honest disclosure)">
                    <ul className="text-sm m-0 pl-4 space-y-1">
                        <li><strong>Registration:</strong> direct <code>registerPatient</code> links the patient wallet to a Semaphore commitment in the same transaction.</li>
                        <li><strong>Trial criteria:</strong> bounds in <code>TrialManager</code> are public on-chain; patient health fields stay encrypted.</li>
                        <li><strong>Transaction layer:</strong> native ETH deposits, stakes, and public exits remain visible at settlement even when contract events omit amounts.</li>
                        <li><strong>Compliance:</strong> MedVault is designed with health-privacy principles in mind; it is not certified HIPAA- or GDPR-compliant.</li>
                    </ul>
                </Callout>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION IX — Navigation Portal
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>IX. Navigating the Technical Documentation</h2>
                <p>
                    This documentation is built for developers, auditors, and hackathon judges. It is organized into thematic sections below — covering protocol contracts (including Chainlink Automation), client integrations (encryption, subgraph, Semaphore / Noir / relayer / faucet), operations, and security.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 mb-8">
                    {[
                        { id: "S1", title: "Core Concepts", desc: "Architecture overviews, Zama integration deep-dive, and guide to FHE.sol encrypted types.", color: "teal", links: [{ label: "Architecture", href: "/docs/architecture" }, { label: "FHE Primitives", href: "/docs/fhe-primitives" }] },
                        { id: "S2", title: "Smart Contracts", desc: `Reference for ${DOCS_CONTRACT_COUNT} production contracts, EligibilityEngine scoring mechanics, Chainlink Automation, and consent-gated decryption.`, color: "purple", links: [{ label: "Engine", href: "/docs/engine" }, { label: "Contracts", href: "/docs/contracts" }, { label: "Sponsors", href: "/docs/sponsor-system" }, { label: "Chainlink Automation", href: "/docs/automation" }] },
                        { id: "S3", title: "Integration & Frontend", desc: "Client-side encryption with @zama-fhe/sdk, subgraph indexing, React architecture, Semaphore / relayer / faucet tooling.", color: "blue", links: [{ label: "Encryption", href: "/docs/client-encryption" }, { label: "Subgraph", href: "/docs/subgraph" }, { label: "Frontend", href: "/docs/frontend" }, { label: "Identity & tooling", href: "/docs/identity-privacy" }] },
                        { id: "S4", title: "Operations", desc: "User workflows, private yield staking, deployment, timelock wiring, and release notes.", color: "amber", links: [{ label: "Workflows", href: "/docs/guides" }, { label: "Staking", href: "/docs/staking" }, { label: "Deploy", href: "/docs/deployment" }, { label: "Timelock", href: "/docs/timelock-wiring" }, { label: "Changelog", href: "/docs/changelog" }] },
                        { id: "S7", title: "MCP & SDK", desc: "TypeScript SDK for integrators plus local MCP for Cursor, Codex, and sponsor automation — not hosted in production.", color: "cyan", links: [{ label: "SDK", href: "/docs/mcp/sdk" }, { label: "MCP", href: "/docs/mcp" }, { label: "Setup", href: "/docs/mcp/setup" }, { label: "Tools", href: "/docs/mcp/tools" }] },
                        { id: "S6", title: "Tests & verification", desc: `${REPO_STATS.testSuiteDefaultPassing} Hardhat cases: unit, integration, timelock wiring (TL-*), IERC7984 (CET-13/14), Zama FHE mocks, matrix IDs, and CI.`, color: "emerald", links: [{ label: "Overview", href: "/docs/testing" }, { label: "Matrix", href: "/docs/testing/matrix" }, { label: "Fixtures", href: "/docs/testing/infrastructure" }, { label: "CI", href: "/docs/testing/ci" }] },
                        { id: "S5", title: "Security & Compliance", desc: "Threat model, FHE security guarantees, HIPAA/GDPR compliance, and immutable audit trail.", color: "rose", links: [{ label: "Security Model", href: "/docs/security-model" }, { label: "Compliance", href: "/docs/compliance" }, { label: "FAQ", href: "/docs/faq" }] },
                    ].map(section => (
                        <div key={section.id} className="p-5 border border-slate-200 rounded-2xl group hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4 mb-3">
                                <div
                                    className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold font-display",
                                        SECTION_BADGE[section.color] ?? "bg-slate-100 text-slate-700"
                                    )}
                                >
                                    {section.id}
                                </div>
                                <div>
                                    <h5 className="font-bold text-slate-900 m-0">{section.title}</h5>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 m-0 leading-snug mb-3">{section.desc}</p>
                            <div className="flex flex-wrap gap-2">
                                {section.links.map(link => (
                                    <Link key={link.href} to={link.href} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors px-2 py-1 rounded-lg bg-blue-50 border border-blue-200/50">
                                        {link.label}
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>


            </Prose>
        </motion.div>
    );
}
