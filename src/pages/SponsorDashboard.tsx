import { Link } from "react-router-dom";
import { Plus, Wallet, Calendar } from "lucide-react";
import { useWeb3 } from "../lib/Web3Context";
import { useSponsorDashboard } from "../hooks/useSponsorDashboard";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { Button } from "../components/ui/Button";
import {
  SponsorDashboardSidebar,
  SponsorKpiRow,
  SponsorPerformanceSection,
  SponsorProtocolsTable,
} from "../components/sponsor/SponsorDashboardCharts";
import { cn } from "../lib/utils";
import { sponsorHeroGlow, sponsorHeroShadow, sponsorHeroShell } from "../lib/sponsorUi";

export function SponsorDashboard() {
  const { account, connect, isConnecting, error: connectError } = useWeb3();
  const { stats, charts, recentActivity, loading, error } = useSponsorDashboard();

  return (
    <div className="space-y-8 pb-12">
      <SectionTopBar
        title="MedVault"
        rightContent={
          <div className="flex items-center gap-3 md:gap-4">
            {account ? (
              <div className="hidden md:flex items-center gap-2.5 rounded-full bg-white px-4 py-2 border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-100">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-200/90 flex items-center justify-center ring-1 ring-white shadow-sm">
                  <Wallet className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <span className="font-mono text-xs font-medium text-slate-700 tracking-tight">
                  {`${account.slice(0, 4)}…${account.slice(-4)}`}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={isConnecting}
                title={connectError ?? "Log in"}
                className="hidden md:inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2 border border-slate-200/90 font-mono text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:pointer-events-none shadow-sm"
              >
                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 ring-1 ring-slate-200/60">
                  <Wallet className="h-3.5 w-3.5 text-slate-600" />
                </div>
                {isConnecting ? "Connecting…" : "Log in"}
              </button>
            )}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some dashboard metrics may be incomplete (subgraph unavailable).
        </div>
      ) : null}

      <div className={cn(sponsorHeroShell, sponsorHeroShadow, "px-5 py-4 md:px-6 md:py-4")}>
        <div className={sponsorHeroGlow} aria-hidden />

        <img
          src="/images/sponsor_dashboard.png"
          alt=""
          className="pointer-events-none absolute bottom-0 left-[51%] z-[1] hidden h-[228px] w-auto max-w-none -translate-x-[calc(50%+2%)] translate-y-[20%] object-contain object-bottom drop-shadow-[0_10px_24px_rgba(99,102,241,0.18)] sm:left-[53%] sm:block sm:h-[251px] lg:left-[55%] lg:h-[258px]"
          decoding="async"
          aria-hidden
        />

        <div className="relative z-[2] grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,280px)_auto] lg:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(200px,300px)_auto]">
          <div className="space-y-1.5 lg:pr-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-500/90">
              Sponsor console
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[#1a2744] md:text-[1.65rem] md:leading-snug">
              Sponsor Dashboard
            </h2>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600">
              Overview of trials, applications, and recruitment — all in one place.
            </p>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm backdrop-blur-sm lg:hidden"
              aria-label="Date range"
            >
              <Calendar className="h-3 w-3 text-slate-400" />
              <span className="font-medium">Last 8 weeks</span>
            </div>
          </div>

          <div
            className="hidden h-[138px] shrink-0 sm:h-[152px] lg:block lg:h-[156px]"
            aria-hidden
          />

          <div className="relative z-[2] flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end lg:justify-center lg:gap-2.5">
            <div
              className="hidden items-center gap-1.5 rounded-lg border border-white/80 bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm backdrop-blur-sm lg:inline-flex"
              aria-label="Date range"
            >
              <Calendar className="h-3 w-3 text-slate-400" />
              <span className="font-medium">Last 8 weeks</span>
            </div>
            <Link to="/sponsor/trials/create" className="shrink-0">
              <Button
                size="default"
                className="h-10 w-full gap-1.5 rounded-full border border-[#1a2744] bg-[#1a2744] px-5 text-sm text-white shadow-[0_3px_12px_rgba(26,39,68,0.22)] hover:bg-[#243352] sm:w-auto"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Create trial
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <SponsorKpiRow stats={stats} charts={charts} loading={loading} />

      <SponsorPerformanceSection charts={charts} stats={stats} loading={loading} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SponsorProtocolsTable rows={charts.trialTableRows} loading={loading} />
        <SponsorDashboardSidebar recentActivity={recentActivity} loading={loading} />
      </div>
    </div>
  );
}
