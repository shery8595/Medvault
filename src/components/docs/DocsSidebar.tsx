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
    Key,
    Activity,
    Coins,
    Shield,
    FlaskConical,
    Scale,
    GitBranch,
    HelpCircle,
    ScrollText,
    Fingerprint,
    Bot,
    Plug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { getNavItemsForTab, getTabForPath, type DocsNavItem } from "../../lib/docsNav";

const HREF_ICONS: Record<string, LucideIcon> = {
    "/docs": BookOpen,
    "/docs/index": BookOpen,
    "/docs/local-development": Terminal,
    "/docs/docker": Terminal,
    "/docs/guides": MonitorPlay,
    "/docs/faq": HelpCircle,
    "/docs/architecture": Cpu,
    "/docs/zama-fhe": Lock,
    "/docs/semaphore": Fingerprint,
    "/docs/noir": GitBranch,
    "/docs/fhe-primitives": Lock,
    "/docs/engine": Activity,
    "/docs/contracts": FileCode2,
    "/docs/erc7984-confidential-token": FileCode2,
    "/docs/hybrid-storage": FileCode2,
    "/docs/atomic-flows": FileCode2,
    "/docs/zero-revelation-rewards": FileCode2,
    "/docs/archive": FileCode2,
    "/docs/sponsor-system": ShieldCheck,
    "/docs/automation": Bot,
    "/docs/client-encryption": Key,
    "/docs/subgraph": Database,
    "/docs/hybrid-indexer": Database,
    "/docs/frontend": LayoutTemplate,
    "/docs/identity-privacy": Fingerprint,
    "/docs/staking": Coins,
    "/docs/private-withdrawals": Lock,
    "/docs/testing": FlaskConical,
    "/docs/testing/matrix": FlaskConical,
    "/docs/testing/infrastructure": FlaskConical,
    "/docs/testing/ci": FlaskConical,
    "/docs/deployment": Terminal,
    "/docs/subgraph-sync": Terminal,
    "/docs/ai-service": Terminal,
    "/docs/mcp": Plug,
    "/docs/mcp/setup": Terminal,
    "/docs/mcp/tools": Bot,
    "/docs/changelog": ScrollText,
    "/docs/security-model": Shield,
    "/docs/security-notes": Shield,
    "/docs/internal": Shield,
    "/docs/formal-verification/eligibility-engine-spec": Shield,
    "/docs/formal-verification/certora-halmos-results": Shield,
    "/docs/compliance": Scale,
};

function groupBySection(items: DocsNavItem[]) {
    const order: string[] = [];
    const map = new Map<string, DocsNavItem[]>();
    for (const i of items) {
        if (!map.has(i.section)) {
            order.push(i.section);
            map.set(i.section, []);
        }
        map.get(i.section)!.push(i);
    }
    return order.map((s) => ({ section: s, items: map.get(s)! }));
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const location = useLocation();
    const tabId = getTabForPath(location.pathname);
    const items = useMemo(() => getNavItemsForTab(tabId), [tabId]);
    const groups = useMemo(() => groupBySection(items), [items]);

    /**
     * Section open unless explicitly collapsed (`false`).
     * Important: `useState` only initializes once — when the top tab changes, `groups` gets new
     * section keys; those keys would be `undefined` (falsy) if we treated state as boolean-only,
     * so accordion panels stayed closed. Default-expanded avoids that.
     */
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const isSectionOpen = (section: string) => expandedSections[section] !== false;

    return (
        <div className="flex h-full w-[212px] flex-col border-r border-slate-200/80 bg-white transition-all duration-300">
            <div className="relative flex h-[58px] items-center px-3 border-b border-slate-200/60 shrink-0">
                <Link to="/" className="group flex items-center gap-[9px] min-w-0" onClick={onNavigate}>
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden rounded-lg">
                        <img src="/logo.png" alt="MedVault" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-display text-[15.4px] font-bold tracking-tight text-slate-900 leading-tight truncate">
                            MedVault
                        </span>
                        <span className="text-[9.9px] font-bold uppercase tracking-[0.1em] text-[#00685f] truncate">
                            Docs
                        </span>
                    </div>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 custom-scrollbar">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                    className="space-y-3"
                >
                    {groups.map((group) => (
                        <motion.div
                            key={group.section}
                            variants={{ hidden: { opacity: 0, x: -6 }, visible: { opacity: 1, x: 0 } }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setExpandedSections((prev) => {
                                        const open = prev[group.section] !== false;
                                        return { ...prev, [group.section]: !open };
                                    })
                                }
                                className="w-full flex items-center justify-between px-2 mb-0.5 group"
                            >
                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 group-hover:text-slate-600">
                                    {group.section}
                                </p>
                                <ChevronRight
                                    className={cn(
                                        "h-3 w-3 text-slate-400 transition-transform duration-300",
                                        isSectionOpen(group.section) ? "rotate-90" : ""
                                    )}
                                />
                            </button>

                            <AnimatePresence initial={false}>
                                {isSectionOpen(group.section) && (
                                    <motion.div
                                        key="content"
                                        initial="collapsed"
                                        animate="open"
                                        exit="collapsed"
                                        variants={{
                                            open: { opacity: 1, height: "auto" },
                                            collapsed: { opacity: 0, height: 0 },
                                        }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-0.5 overflow-hidden"
                                    >
                                        {group.items.map((item) => {
                                            const Icon = HREF_ICONS[item.href] ?? BookOpen;
                                            const isActive = location.pathname === item.href;
                                            const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://");
                                            const className = cn(
                                                "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                                                isActive
                                                    ? "text-[#00685f] bg-[#00685f]/8 border border-[#00685f]/15"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                            );
                                            const content = (
                                                <>
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="docs-sidebar-active-marker"
                                                            className="absolute left-0 w-0.5 h-4 bg-[#00685f] rounded-r-full"
                                                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                                        />
                                                    )}
                                                    <Icon
                                                        className={cn(
                                                            "h-3.5 w-3.5 shrink-0",
                                                            isActive ? "text-[#00685f]" : "text-slate-400"
                                                        )}
                                                    />
                                                    <span className="flex-1 tracking-tight pr-1 truncate">{item.title}</span>
                                                </>
                                            );

                                            if (isExternal) {
                                                return (
                                                    <a
                                                        key={item.href}
                                                        href={item.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={onNavigate}
                                                        className={className}
                                                    >
                                                        {content}
                                                    </a>
                                                );
                                            }

                                            return (
                                                <Link
                                                    key={item.href}
                                                    to={item.href}
                                                    onClick={onNavigate}
                                                    className={className}
                                                >
                                                    {content}
                                                </Link>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            <div className="px-2 py-2 border-t border-slate-200/60 bg-slate-50/50 shrink-0">
                <Link
                    to="/"
                    onClick={onNavigate}
                    className="group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200/90 bg-white hover:shadow-sm transition-all"
                >
                    <span className="truncate">App</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
            </div>
        </div>
    );
}

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
    return <SidebarContent onNavigate={onNavigate} />;
}
