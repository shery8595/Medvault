import React from "react";
import { Sidebar } from "./Sidebar";
import { Link, useLocation } from "react-router-dom";
import brandLogoUrl from "../../../logo/logo.png";
import { cn } from "../../lib/utils";
import {
  dashboardMainInset,
  dashboardMainInsetCompact,
  dashboardSidebarCollapsedOffsetClass,
  dashboardSidebarCollapsedWidthClass,
  dashboardSidebarOffsetClass,
  dashboardSidebarWidthClass,
} from "../../lib/dashboardLayout";
import { useSidebarCollapsed } from "../../lib/useSidebarCollapsed";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { MobileNativeHints } from "../mobile/MobileNativeHints";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "patient" | "sponsor";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { pathname } = useLocation();
  const compactSponsorPage = role === "sponsor" && pathname.includes("/active-trials");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { collapsed, toggle } = useSidebarCollapsed();

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <div
      className={cn(
        "relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden transition-colors duration-300",
        "bg-slate-50 text-slate-900"
      )}
    >
      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r transition-[width] duration-200 ease-out md:flex",
          collapsed ? dashboardSidebarCollapsedWidthClass : dashboardSidebarWidthClass,
          role === "patient" ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"
        )}
      >
        <Sidebar role={role} collapsed={collapsed} />
      </aside>

      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col transition-[padding] duration-200 ease-out",
          collapsed ? dashboardSidebarCollapsedOffsetClass : dashboardSidebarOffsetClass
        )}
      >
        <header className="shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 md:px-5 md:py-3">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "hidden md:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm",
              "transition hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
            )}
            aria-expanded={!collapsed}
            aria-controls="dashboard-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" strokeWidth={2} />
            ) : (
              <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
            )}
          </button>

          <Link
            to={role === "patient" ? "/patient/dashboard" : "/sponsor/dashboard"}
            className="inline-flex min-w-0 items-center gap-2.5 md:hidden"
          >
            <img
              src={brandLogoUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
              aria-hidden
            />
            <span className="font-bold text-slate-900 leading-none">MedVault</span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                role === "patient" ? "text-teal-700/80" : "text-[#1D2634]"
              )}
            >
              {role === "patient" ? "Patient" : "Sponsor"}
            </span>
          </Link>

          <div className="hidden md:block min-w-0 flex-1" aria-hidden />
        </header>

        <MobileNativeHints />

        <main
          ref={scrollRef}
          id="dashboard-main"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
        >
          <div className={cn(compactSponsorPage ? dashboardMainInsetCompact : dashboardMainInset)}>
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
