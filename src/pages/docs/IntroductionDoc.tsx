import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { AnimatedDiagram } from "../../components/docs/AnimatedDiagram";
import { motion } from "framer-motion";
import {
    Activity, Shield, Users, Database, ArrowRight, Lock, Key,
    CheckCircle2, FileCode2, Zap, TrendingUp, Scale, Heart,
    Building2, Bot, ShieldCheck, Coins, Stethoscope, AlertTriangle,
    BookOpen, BarChart3, Server, Cpu, GitBranch, Layers, ArrowDown,
    ExternalLink, CircleDot, Workflow
} from "lucide-react";
import { Link } from "react-router-dom";

// ─── Animated Counter Stat ───
const AnimatedStat = ({ value, label, icon, color }: { value: string; label: string; icon: React.ReactNode; color: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center group hover:shadow-lg transition-all duration-300"
    >
        <div className={`p-2.5 rounded-xl mb-3 bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
        </div>
        <div className="text-3xl font-black font-display text-slate-900 dark:text-white tracking-tight">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-1 tracking-wide">{label}</div>
    </motion.div>
);

// ─── Section Divider ───
const Divider = () => (
    <div className="flex items-center gap-4 my-16">
        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
        <div className="w-3 h-3 rotate-45 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" />
        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
    </div>
);

// ─── Architecture Flow Diagram (CSS/SVG) ───
const layerStyles: Record<string, { container: string; dot: string; label: string; iconBg: string }> = {
    blue: {
        container: "bg-blue-950/40 border-blue-500/20",
        dot: "bg-blue-500",
        label: "text-blue-400",
        iconBg: "bg-blue-900/40 text-blue-400",
    },
    teal: {
        container: "bg-blue-950/40 border-blue-500/20",
        dot: "bg-blue-500",
        label: "text-blue-400",
        iconBg: "bg-blue-900/40 text-blue-400",
    },
    purple: {
        container: "bg-purple-950/40 border-purple-500/20",
        dot: "bg-purple-500",
        label: "text-purple-400",
        iconBg: "bg-purple-900/40 text-purple-400",
    },
    amber: {
        container: "bg-amber-950/40 border-amber-500/20",
        dot: "bg-amber-500",
        label: "text-amber-400",
        iconBg: "bg-amber-900/40 text-amber-400",
    },
};

const ArchitectureFlowDiagram = () => {
    const layers = [
        {
            label: "CLIENT LAYER",
            color: "blue",
            nodes: [
                { icon: <Users className="w-4 h-4" />, name: "Patient Browser", detail: "fhevmjs SDK" },
                { icon: <Building2 className="w-4 h-4" />, name: "Sponsor Portal", detail: "React DApp" },
            ]
        },
        {
            label: "SMART CONTRACT LAYER",
            color: "teal",
            nodes: [
                { icon: <Database className="w-4 h-4" />, name: "PatientRegistry", detail: "euint32 Storage" },
                { icon: <Activity className="w-4 h-4" />, name: "EligibilityEngine", detail: "FHE Compute" },
                { icon: <Cpu className="w-4 h-4" />, name: "TrialManager", detail: "Trial Logic" },
                { icon: <Shield className="w-4 h-4" />, name: "ConsentManager", detail: "ACL Gating" },
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
        <div className="not-prose my-12 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D18] relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
            {/* Glow accents */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">System Architecture — Layered Overview</h3>
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
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 shadow-sm hover:shadow-md hover:bg-white/10 transition-all duration-300 group cursor-default"
                                        >
                                            <div className={`p-1.5 rounded-lg ${styles.iconBg} group-hover:scale-110 transition-transform`}>
                                                {node.icon}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{node.name}</div>
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
                                        <div className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
                                        <ArrowDown className="w-3 h-3 text-slate-400 dark:text-slate-600" />
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
        { label: "Plaintext", value: "age = 42", bg: "bg-rose-500", desc: "Raw patient data in browser memory", icon: <Heart className="w-4 h-4" /> },
        { label: "FHE Encrypt", value: "fhevmjs.encrypt32(42)", bg: "bg-amber-500", desc: "Client-side encryption via Fhenix SDK", icon: <Lock className="w-4 h-4" /> },
        { label: "Ciphertext", value: "0x7f3a...b2c1", bg: "bg-purple-500", desc: "euint32 handle stored on-chain", icon: <Database className="w-4 h-4" /> },
        { label: "FHE Compute", value: "FHE.ge(age, minAge)", bg: "bg-blue-500", desc: "Homomorphic comparison in coprocessor", icon: <Cpu className="w-4 h-4" /> },
        { label: "Encrypted Result", value: "ebool → euint32 score", bg: "bg-blue-500", desc: "Score accumulated via CMUX", icon: <Activity className="w-4 h-4" /> },
        { label: "Patient Decrypt", value: "EIP-712 → plaintext 100", bg: "bg-emerald-500", desc: "Only patient can view their score", icon: <Key className="w-4 h-4" /> },
    ];

    return (
        <div className="not-prose my-12 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D18] relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute top-1/2 left-0 w-full h-48 bg-gradient-to-r from-rose-500/5 via-purple-500/5 to-emerald-500/5 blur-[80px] -translate-y-1/2" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">FHE Encryption Pipeline — Data Flow</h3>
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
                                className="flex-1 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:shadow-lg transition-all duration-300 group relative"
                            >
                                {/* Stage number badge */}
                                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${stage.bg} text-white text-[10px] font-black flex items-center justify-center shadow-lg`}>
                                    {idx + 1}
                                </div>

                                <div className={`w-9 h-9 rounded-xl ${stage.bg}/10 flex items-center justify-center mb-3`}>
                                    <div className={`${stage.bg.replace('bg-', 'text-').replace('-500', '-500')}`}>
                                        {stage.icon}
                                    </div>
                                </div>

                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stage.label}</div>
                                <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-bold mb-2 break-all leading-relaxed">{stage.value}</div>
                                <div className="text-[11px] text-slate-500 leading-snug">{stage.desc}</div>
                            </motion.div>

                            {idx < stages.length - 1 && (
                                <div className="hidden md:flex items-center justify-center px-0">
                                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 shrink-0" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/30">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <p className="text-xs text-rose-700 dark:text-rose-400 m-0 font-medium">
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
        { id: "registry", title: "Patient Registry", subtitle: "euint32 Storage", icon: <Database className="h-5 w-5" />, position: { x: 260, y: 20 }, color: "blue" as const },
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
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Contract Interaction Graph</h3>
                    <p className="text-xs text-slate-500 m-0">Animated data flow between core smart contracts</p>
                </div>
            </div>
            <AnimatedDiagram nodes={nodes} edges={edges} height={420} className="w-full" />
            <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 mt-3 tracking-tight">
                Fig 1. Data flows from Patient → Registry → Engine and Sponsor → TrialManager → Engine. Animated edges show live ciphertext transfer paths.
            </p>
        </div>
    );
};

// ─── FHE State Machine ───
const FheStateMachine = () => {
    const states = [
        { step: "01", title: "Client Encryption", desc: "`fhevmjs` encrypts health metrics entirely in the browser using FHE.", icon: <Users className="w-5 h-5" />, color: "blue" },
        { step: "02", title: "On-Chain Vault", desc: "`PatientRegistry` stores ciphertext handles in encrypted contract state.", icon: <Database className="w-5 h-5" />, color: "purple" },
        { step: "03", title: "FHEVM Engine", desc: "`EligibilityEngine` runs homomorphic comparisons without decrypting inputs.", icon: <Lock className="w-5 h-5" />, color: "teal", highlight: true },
        { step: "04", title: "EIP-712 Decrypt", desc: "Only the patient can sign a viewing key to decrypt their match score.", icon: <Key className="w-5 h-5" />, color: "amber" },
    ];

    return (
        <div className="my-16 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50 dark:bg-[#060D18] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

            <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-0 mb-8 relative z-10 flex items-center gap-3">
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
                                ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-b-4 border-b-blue-500"
                                : s.color === "amber"
                                    ? "bg-amber-500 text-white"
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                }`}
                        >
                            <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-3 ${s.color === "amber" && !s.highlight ? "bg-white/20" : `bg-${s.color}-100 dark:bg-${s.color}-900/30`}`}>
                                <div className={s.color === "amber" && !s.highlight ? "text-white" : `text-${s.color}-600 dark:text-${s.color}-400`}>
                                    {s.icon}
                                </div>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${s.color === "amber" && !s.highlight ? "text-white/70" : "text-slate-400"}`}>State {s.step}</div>
                            <div className={`font-medium text-sm ${s.color === "amber" && !s.highlight ? "text-white" : "text-slate-900 dark:text-white"}`}>{s.title}</div>
                            <div className={`text-xs mt-2 ${s.color === "amber" && !s.highlight ? "text-white/80" : "text-slate-500"}`}>{s.desc}</div>
                        </motion.div>
                        {i < states.length - 1 && (
                            <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-700 hidden md:block shrink-0" />
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
                <div className="not-prose relative -mt-4 mb-16">
                    {/* Hero Banner Image */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl relative group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/20 z-10 pointer-events-none" />
                        <img
                            src="/assets/images/medvault_fhe_hero.png"
                            alt="MedVault FHE Enclave Architecture"
                            className="w-full aspect-[21/9] object-cover object-center transition-transform duration-[2000ms] group-hover:scale-105"
                        />

                        {/* Hero Text Overlay */}
                        <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 md:p-10">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                                    <span className="text-blue-400 text-xs font-black uppercase tracking-[0.25em]">Technical Documentation</span>
                                </div>
                                <h1 className="text-4xl md:text-6xl font-display font-black text-white tracking-tight mb-3 leading-[1.1]">
                                    MedVault<span className="text-blue-400">.</span>
                                </h1>
                                <p className="text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed font-medium">
                                    The first <strong className="text-white">Fully Homomorphic Encryption</strong> powered clinical trial matching platform built on Ethereum, leveraging the Fhenix fhEVM coprocessor to enable computation on encrypted medical data.
                                </p>

                                {/* Quick action pills */}
                                <div className="flex flex-wrap gap-2 mt-6">
                                    <Link to="/docs/architecture" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-400 transition-colors">
                                        <Cpu className="w-3.5 h-3.5" /> Architecture
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                    <Link to="/docs/engine" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-bold border border-white/20 hover:bg-white/20 transition-colors">
                                        <Activity className="w-3.5 h-3.5" /> Engine Mechanics
                                    </Link>
                                    <Link to="/docs/security-model" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-bold border border-white/20 hover:bg-white/20 transition-colors">
                                        <Shield className="w-3.5 h-3.5" /> Security Model
                                    </Link>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>

                {/* ─── Platform Statistics Bar ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 my-12 not-prose">
                    <AnimatedStat value="11" label="Smart Contracts" icon={<FileCode2 className="w-5 h-5" />} color="teal" />
                    <AnimatedStat value="100+" label="Tests Passing" icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
                    <AnimatedStat value="3" label="DeFi Protocols" icon={<TrendingUp className="w-5 h-5" />} color="purple" />
                    <AnimatedStat value="0" label="Data Exposed" icon={<Shield className="w-5 h-5" />} color="blue" />
                    <AnimatedStat value="4" label="FHE Type System" icon={<Lock className="w-5 h-5" />} color="amber" />
                    <AnimatedStat value="<100ms" label="Query Latency" icon={<Zap className="w-5 h-5" />} color="rose" />
                </div>

                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-prose leading-relaxed mb-8">
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

                <div className="my-8 p-6 bg-rose-50 dark:bg-rose-950/20 border-l-4 border-rose-500 rounded-r-2xl">
                    <h4 className="text-rose-900 dark:text-rose-400 font-bold mt-0 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        The Web2 Privacy Catastrophe — By the Numbers
                    </h4>
                    <ul className="text-rose-800 dark:text-rose-300/80 mb-0 space-y-3">
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
                        { step: "1", title: "Patient Encrypts Health Data in Browser", desc: "The patient enters their medical metrics (Age, Blood Pressure, HbA1c, Weight) into the MedVault dashboard. The Fhenix fhevmjs SDK encrypts every value into FHE ciphertexts entirely within the browser. The original plaintext values are immediately discarded from memory. Only encrypted ciphertext blobs are transmitted to the blockchain.", icon: <Lock className="w-6 h-6" />, color: "blue" },
                        { step: "2", title: "Sponsor Publishes Encrypted Trial Criteria", desc: "A verified pharmaceutical sponsor defines their trial eligibility criteria (e.g., Age 18-65, HbA1c < 7.0). These requirements are also encrypted as euint32 ciphertext values and stored on-chain in the TrialManager contract. The trial's structural metadata (name, phase, location) remains public.", icon: <Building2 className="w-6 h-6" />, color: "purple" },
                        { step: "3", title: "EligibilityEngine Computes on Encrypted Data", desc: "The EligibilityEngine smart contract performs FHE homomorphic operations (FHE.ge(), FHE.le(), FHE.cmux()) to compare encrypted patient values against encrypted trial bounds. The result is an encrypted eligibility score (0-100) stored on-chain. The network computes the match without decrypting any inputs.", icon: <Activity className="w-6 h-6" />, color: "teal" },
                        { step: "4", title: "Patient Decrypts Their Own Score", desc: "The encrypted score can only be decrypted by the patient. They sign an EIP-712 message in MetaMask to generate a cryptographic viewing key. The Fhenix KMS threshold decryption service verifies this signature and returns the decrypted score exclusively to the patient.", icon: <Key className="w-6 h-6" />, color: "amber" },
                        { step: "5", title: "Optional Consent & Enrollment", desc: "If the score is 100 (perfect match), the patient may optionally grant identity access to the sponsor through ConsentManager. Upon approval, the patient is registered in the SponsorIncentiveVault reward pool. Chainlink Automation handles milestone payouts. The patient earns yield via Aave V3.", icon: <CheckCircle2 className="w-6 h-6" />, color: "emerald" },
                    ].map((s, i) => (
                        <motion.div
                            key={s.step}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            viewport={{ once: true }}
                            className="flex gap-5 items-start p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className={`p-3 rounded-2xl bg-${s.color}-100 dark:bg-${s.color}-900/30 text-${s.color}-600 dark:text-${s.color}-400 shrink-0 mt-0.5`}>
                                {s.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-400">Step {s.step}</span>
                                </div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-white mt-0 mb-2">{s.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-0">{s.desc}</p>
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
                    MedVault's 11 smart contracts form a dependency graph with strictly scoped cross-contract interactions. The animated diagram below shows the primary data flow paths between the core contracts.
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
                <div className="not-prose my-10 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 m-0">Architectural Comparison: FHE vs. ZKP for Clinical Trial Matching</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Dimension</th>
                                    <th className="text-left px-4 py-3 font-bold text-blue-700 dark:text-blue-400">FHE (MedVault)</th>
                                    <th className="text-left px-4 py-3 font-bold text-purple-700 dark:text-purple-400">ZKP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { dim: "Patient Online Requirement", fhe: "Upload once, go offline forever. Engine evaluates asynchronously.", zkp: "Must be online to generate a proof for every trial application.", win: "fhe" },
                                    { dim: "Trial Parameter Updates", fhe: "Sponsor can update criteria without invalidating patient data.", zkp: "Patient's proof invalidates immediately on any criteria change.", win: "fhe" },
                                    { dim: "Multi-Trial Matching", fhe: "Single encrypted profile matched against unlimited trials.", zkp: "Separate proof generation required per trial. O(n) computation.", win: "fhe" },
                                    { dim: "Computation Location", fhe: "On-chain in the Fhenix coprocessor. Fully trustless.", zkp: "Client-side. Requires trusted prover setup.", win: "fhe" },
                                    { dim: "Data Granularity", fhe: "Exact encrypted values. Complex range queries supported.", zkp: "Only proves boolean statements. No partial scores.", win: "fhe" },
                                    { dim: "Gas Cost", fhe: "Higher per-operation. Optimized via batched CMUX compute.", zkp: "Lower per-proof. But O(n) proofs needed per patient.", win: "draw" },
                                    { dim: "Proof Size", fhe: "Ciphertexts are larger (~256 bytes per euint32).", zkp: "Proofs are compact (~128-256 bytes).", win: "zkp" },
                                    { dim: "Setup Complexity", fhe: "No trusted setup. Standard FHE bootstrapping keys.", zkp: "May require trusted setup ceremony (zk-SNARKs).", win: "fhe" },
                                ].map((row, i) => (
                                    <tr key={row.dim} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">{row.dim}</td>
                                        <td className={`px-4 py-3 text-xs ${row.win === "fhe" || row.win === "draw" ? "text-blue-700 dark:text-blue-400" : "text-slate-500"}`}>
                                            {row.win === "fhe" && <span className="mr-1">✓</span>}{row.fhe}
                                        </td>
                                        <td className={`px-4 py-3 text-xs ${row.win === "zkp" ? "text-purple-700 dark:text-purple-400" : "text-slate-500"}`}>
                                            {row.win === "zkp" && <span className="mr-1">✓</span>}{row.zkp}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
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
                        { icon: <Coins className="w-8 h-8" />, title: "Private Yield Generation", desc: "Patient trial rewards are wrapped in ConfidentialETH (encrypted balances), then staked into Aave V3 lending pools. Yield accrues on private assets — a novel DeFi × healthcare primitive.", gradient: "from-purple-500 to-fuchsia-500" },
                        { icon: <Bot className="w-8 h-8" />, title: "Automated Compliance Trail", desc: "Every sensitive operation is logged to DataAccessLog with anonymized keccak256 hashes. MedVaultAutomation uses Chainlink Keepers for trustless milestone payouts. Full HIPAA/GDPR-compatible audit trail.", gradient: "from-blue-500 to-cyan-500" },
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
                        { icon: <Heart className="w-6 h-6" />, title: "Patient", color: "teal", permissions: ["Encrypt & store health metrics on-chain", "Apply to unlimited clinical trials", "Decrypt their own eligibility scores (EIP-712)", "Grant/revoke identity access to sponsors", "Stake rewards in private yield vaults"] },
                        { icon: <Building2 className="w-6 h-6" />, title: "Sponsor", color: "purple", permissions: ["Create trials with encrypted criteria (after KYC)", "View anonymized match counts via Subgraph", "Accept/reject matched patients", "Fund trial incentive escrow pools", "Access consented patient profiles"] },
                        { icon: <ShieldCheck className="w-6 h-6" />, title: "Protocol Admin", color: "amber", permissions: ["Add/remove verified sponsors (multisig)", "Emergency halt trials via SponsorRegistry", "Authorize contracts in DataAccessLog", "Manage Chainlink Automation upkeep"] },
                        { icon: <Bot className="w-6 h-6" />, title: "Chainlink Keeper", color: "blue", permissions: ["Trigger checkUpkeep() on MedVaultAutomation", "Execute performUpkeep() for milestone payouts", "Automate trial deadline enforcement", "No access to encrypted data"] },
                    ].map(role => (
                        <div key={role.title} className={`p-6 rounded-2xl border border-${role.color}-200 dark:border-${role.color}-900/30 bg-white dark:bg-slate-900 shadow-sm`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2.5 rounded-xl bg-${role.color}-100 dark:bg-${role.color}-900/30 text-${role.color}-600 dark:text-${role.color}-400`}>
                                    {role.icon}
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-lg m-0">{role.title}</h4>
                            </div>
                            <ul className="space-y-2 m-0 p-0">
                                {role.permissions.map(p => (
                                    <li key={p} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                        <div className={`w-1.5 h-1.5 rounded-full bg-${role.color}-500 mt-1.5 shrink-0`} />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <Callout type="warning" title="Testnet Environment">
                    MedVault is currently deployed on the <strong>Fhenix Sepolia Testnet</strong>. FHE operations require massive polynomial mathematics in the Fhenix coprocessor, so expect 15–60 second confirmation times for FHE transactions.
                </Callout>

                <Divider />

                {/* ═══════════════════════════════════════════════════════════════════════
                    SECTION IX — Navigation Portal
                ═══════════════════════════════════════════════════════════════════════ */}
                <h2>IX. Navigating the Technical Documentation</h2>
                <p>
                    This documentation is built for developers, auditors, and hackathon judges. It is organized into five thematic sections:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 mb-8">
                    {[
                        { id: "S1", title: "Core Concepts", desc: "Architecture overviews, Fhenix integration deep-dive, and guide to FHE.sol encrypted types.", color: "teal", links: [{ label: "Architecture", href: "/docs/architecture" }, { label: "FHE Primitives", href: "/docs/fhe-primitives" }] },
                        { id: "S2", title: "Smart Contracts", desc: "Reference for all 11 contracts, EligibilityEngine scoring mechanics, and consent-gated decryption.", color: "purple", links: [{ label: "Engine", href: "/docs/engine" }, { label: "Contracts", href: "/docs/contracts" }, { label: "Sponsors", href: "/docs/sponsor-system" }] },
                        { id: "S3", title: "Integration & Frontend", desc: "Client-side encryption with fhevmjs, The Graph subgraph indexing, and React context management.", color: "blue", links: [{ label: "Encryption", href: "/docs/client-encryption" }, { label: "Subgraph", href: "/docs/subgraph" }, { label: "Frontend", href: "/docs/frontend" }] },
                        { id: "S4", title: "Operations & Guides", desc: "User workflows, private yield staking, deployment guides, and the verification suite.", color: "amber", links: [{ label: "Workflows", href: "/docs/guides" }, { label: "Staking", href: "/docs/staking" }, { label: "Testing", href: "/docs/testing" }, { label: "Deploy", href: "/docs/deployment" }] },
                        { id: "S5", title: "Security & Compliance", desc: "Threat model, FHE security guarantees, HIPAA/GDPR compliance, and immutable audit trail.", color: "emerald", links: [{ label: "Security Model", href: "/docs/security-model" }, { label: "Compliance", href: "/docs/compliance" }] },
                    ].map(section => (
                        <div key={section.id} className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <div className="flex items-center gap-4 mb-3">
                                <div className={`w-12 h-12 rounded-xl bg-${section.color}-100 dark:bg-${section.color}-900/30 flex items-center justify-center text-${section.color}-600 dark:text-${section.color}-400 font-bold font-display`}>{section.id}</div>
                                <div>
                                    <h5 className="font-bold text-slate-900 dark:text-white m-0">{section.title}</h5>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 m-0 leading-snug mb-3">{section.desc}</p>
                            <div className="flex flex-wrap gap-2">
                                {section.links.map(link => (
                                    <Link key={link.href} to={link.href} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50">
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
