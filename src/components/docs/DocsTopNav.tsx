import { useMemo, useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
    Search,
    PanelLeft,
    Rocket,
    Layers,
    Lock,
    Fingerprint,
    GitBranch,
    Code2,
    Wrench,
    Shield,
    FlaskConical,
    Plug,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { DOCS_TABS, type DocsTabId, getTabForPath, searchDocsNav, getNavItemsForTab } from "../../lib/docsNav";

const tabIcons: Record<DocsTabId, typeof Rocket> = {
    "getting-started": Rocket,
    protocol: Layers,
    zama: Lock,
    semaphore: Fingerprint,
    noir: GitBranch,
    clients: Code2,
    mcp: Plug,
    operations: Wrench,
    testing: FlaskConical,
    security: Shield,
};

export function DocsTopNav() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const activeTab = getTabForPath(pathname);
    const tabMeta = DOCS_TABS.find((t) => t.id === activeTab) ?? DOCS_TABS[0];
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const results = useMemo(() => (q.trim() ? searchDocsNav(q, 8) : []), [q]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    return (
        <div className="shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
            <div className="px-3 md:px-5 py-2.5 max-w-[1600px] mx-auto w-full">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-900 leading-tight">
                            Technical <span className="text-[#00685f]">docs</span>
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 hidden sm:block max-w-xl">
                            {tabMeta.subtitle}
                        </p>
                    </div>

                    <div className="w-full sm:w-52 md:w-60 shrink-0" ref={searchRef}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            <input
                                type="search"
                                placeholder="Search…"
                                value={q}
                                onChange={(e) => {
                                    setQ(e.target.value);
                                    setOpen(true);
                                }}
                                onFocus={() => setOpen(true)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f]/40"
                            />
                            {open && q.trim() && results.length > 0 && (
                                <ul className="absolute z-50 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg py-1 text-sm custom-scrollbar">
                                    {results.map(({ item }) => (
                                        <li key={item.href}>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex flex-col gap-0.5"
                                                onClick={() => {
                                                    navigate(item.href);
                                                    setQ("");
                                                    setOpen(false);
                                                }}
                                            >
                                                <span className="font-semibold text-slate-800">{item.title}</span>
                                                <span className="text-xs text-slate-500">
                                                    {item.section} · {item.href}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {open && q.trim() && results.length === 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 bg-white shadow-lg px-3 py-3 text-sm text-slate-500">
                                    No results. Try &quot;encryption&quot;, &quot;engine&quot;, or &quot;staking&quot;.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1 min-w-0">
                    {DOCS_TABS.map((tab) => {
                        const Icon = tabIcons[tab.id];
                        const isActive = tab.id === activeTab;
                        return (
                            <Link
                                key={tab.id}
                                to={getNavItemsForTab(tab.id)[0]?.href ?? "/docs"}
                                onClick={(e) => {
                                    if (isActive) {
                                        e.preventDefault();
                                    }
                                }}
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 border border-slate-200/90 bg-slate-50/80 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <Icon className="h-3 w-3 opacity-90 shrink-0" />
                                <span className="truncate max-w-[9rem] xl:max-w-none">{tab.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/** Mobile: open docs menu — sidebar is off-canvas; use with DocsSidebar in drawer */
export function DocsMobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-700"
            aria-label="Open documentation menu"
        >
            <PanelLeft className="h-5 w-5" />
        </button>
    );
}
