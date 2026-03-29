import { Link, useLocation } from "react-router-dom";
import {
    BookOpen,
    Cpu,
    FileCode2,
    ShieldCheck,
    ChevronRight,
    MonitorPlay,
    Lock,
    Database,
    LayoutTemplate,
    Terminal,
    Server,
    Key,
    Activity,
    Coins,
    Shield,
    Scale
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const docSections = [
    {
        title: "Core Concepts",
        items: [
            { title: "Introduction", href: "/docs", icon: BookOpen },
            { title: "Architecture", href: "/docs/architecture", icon: Cpu },
            { title: "FHE Primitives", href: "/docs/fhe-primitives", icon: Lock },
        ]
    },
    {
        title: "Smart Contracts",
        items: [
            { title: "Eligibility Engine", href: "/docs/engine", icon: Activity },
            { title: "Contract Reference", href: "/docs/contracts", icon: FileCode2 },
            { title: "Sponsor System", href: "/docs/sponsor-system", icon: ShieldCheck },
        ]
    },
    {
        title: "Integration & Frontend",
        items: [
            { title: "Client Encryption", href: "/docs/client-encryption", icon: Key },
            { title: "Subgraph Indexing", href: "/docs/subgraph", icon: Database },
            { title: "Frontend Architecture", href: "/docs/frontend", icon: LayoutTemplate },
        ]
    },
    {
        title: "Operations & Guides",
        items: [
            { title: "User Workflows", href: "/docs/guides", icon: MonitorPlay },
            { title: "Private Staking", href: "/docs/staking", icon: Coins },
            { title: "Testing & Verification", href: "/docs/testing", icon: ShieldCheck },
            { title: "Deployment Guide", href: "/docs/deployment", icon: Terminal },
        ]
    },
    {
        title: "Security & Compliance",
        items: [
            { title: "Security Model", href: "/docs/security-model", icon: Shield },
            { title: "Compliance & Audit", href: "/docs/compliance", icon: Scale },
        ]
    }
];

export function DocsSidebar() {
    const location = useLocation();
    // Expanded by default
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
        docSections.reduce((acc, section) => ({ ...acc, [section.title]: true }), {})
    );

    const toggleSection = (title: string) => {
        setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <div className="flex h-full w-[280px] flex-col border-r border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-950 transition-all duration-300">
            {/* ─── Branding Header ─── */}
            <div className="relative flex h-24 items-center px-8 border-b border-slate-200/40 dark:border-slate-800/40 shrink-0">
                <Link to="/" className="group flex items-center gap-3.5">
                    <div className="relative flex h-11 w-[53px] items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden rounded-xl">
                        <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                            MedVault
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-500">
                            Technical Docs
                        </span>
                    </div>
                </Link>
            </div>

            {/* ─── Main Navigation ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 custom-scrollbar">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                    }}
                    className="space-y-6"
                >
                    {docSections.map((section, sIdx) => (
                        <motion.div key={section.title} variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0 }
                        }}>
                            <button
                                onClick={() => toggleSection(section.title)}
                                className="w-full flex items-center justify-between px-4 mb-2 group"
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                    {section.title}
                                </p>
                                <ChevronRight className={cn(
                                    "h-3 w-3 text-slate-400 transition-transform duration-300",
                                    expandedSections[section.title] ? "rotate-90" : ""
                                )} />
                            </button>

                            <AnimatePresence initial={false}>
                                {expandedSections[section.title] && (
                                    <motion.div
                                        key="content"
                                        initial="collapsed"
                                        animate="open"
                                        exit="collapsed"
                                        variants={{
                                            open: { opacity: 1, height: "auto", transition: { duration: 0.3, staggerChildren: 0.05 } },
                                            collapsed: { opacity: 0, height: 0, transition: { duration: 0.3 } }
                                        }}
                                        className="space-y-1 overflow-hidden"
                                    >
                                        {section.items.map((item, index) => {
                                            const Icon = item.icon;
                                            const isActive = location.pathname === item.href;

                                            return (
                                                <motion.div
                                                    key={item.href}
                                                    variants={{
                                                        open: { opacity: 1, x: 0 },
                                                        collapsed: { opacity: 0, x: -10 }
                                                    }}
                                                >
                                                    <Link
                                                        to={item.href}
                                                        className={cn(
                                                            "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300",
                                                            isActive
                                                                ? "text-blue-500 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 shadow-sm"
                                                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                        )}
                                                    >
                                                        {isActive && (
                                                            <motion.div
                                                                layoutId="docs-sidebar-active-indicator"
                                                                className="absolute left-0 w-1.5 h-5 bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                            />
                                                        )}
                                                        <Icon className={cn(
                                                            "h-4.5 w-4.5 transition-all duration-300 group-hover:scale-110",
                                                            isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                                        )} />
                                                        <span className="flex-1 tracking-tight pr-2 truncate">{item.title}</span>
                                                    </Link>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* ─── App Link ─── */}
            <div className="px-6 py-6 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md shrink-0">
                <Link to="/" className="group flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-900 border border-slate-200 dark:border-slate-800 dark:hover:text-white dark:hover:bg-slate-800/50 transition-all duration-300 shadow-sm hover:shadow-md">
                    <span>Return to App</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>
        </div>
    );
}
