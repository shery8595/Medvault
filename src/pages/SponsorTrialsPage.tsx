import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  FlaskConical,
  ChevronDown,
  Zap,
  MoreVertical,
  LayoutGrid,
  List,
  Download,
  Heart,
  Droplets,
  Microscope,
  Stethoscope,
  Bone,
} from "lucide-react";
import { ProgressBar } from "@tremor/react";
import { useWeb3 } from "../lib/Web3Context";
import { useSponsorPortfolioMetrics } from "../hooks/useSponsorPortfolioMetrics";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SponsorPageHero } from "../components/sponsor/SponsorPageHero";
import { SponsorTrialsSummaryRow } from "../components/sponsor/SponsorTrialsSummaryRow";
import { BudgetUtilizationCard } from "../components/sponsor/BudgetUtilizationCard";
import { SponsorTrialsInsights } from "../components/sponsor/SponsorTrialsInsights";
import { formatEthCompact } from "../lib/parseCompensation";
import type { TrialPortfolioRow } from "../hooks/useSponsorPortfolioMetrics";
import { cn } from "../lib/utils";
import { sponsorCardHeader } from "../lib/sponsorUi";
import {
  trialsCardInsetX,
  trialsCardShell,
  trialsInputClass,
  trialsPageStack,
  trialsSectionGap,
  trialsSelectClass,
  trialsSplitGrid,
} from "../lib/sponsorTrialsUi";

const PAGE_SIZES = [5, 10, 20] as const;
const TRIAL_ICONS = [FlaskConical, Bone, Heart, Droplets, Microscope, Stethoscope] as const;
const PHASE_OPTIONS = ["All phases", "Phase 1", "Phase 2", "Phase 3", "Phase 4"];

function trialIconFor(id: string) {
  const n = parseInt(id.slice(-4) || "0", 16);
  return TRIAL_ICONS[n % TRIAL_ICONS.length];
}

function indicationLabel(trial: TrialPortfolioRow) {
  return trial.requiresDiabetes ? "Type 2 diabetes" : "General";
}

export function SponsorTrialsPage() {
  const { account } = useWeb3();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState("All phases");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [diabetesFilter, setDiabetesFilter] = useState<"all" | "yes" | "no">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  const { metrics, charts, biasIndicators, recentActivity, loading, error } =
    useSponsorPortfolioMetrics(account || undefined);

  const q = searchQuery.trim().toLowerCase();
  const filteredTrials = useMemo(() => {
    return metrics.trialRows.filter((t) => {
      if (statusFilter === "active" && !t.active) return false;
      if (statusFilter === "draft" && t.active) return false;
      if (phaseFilter !== "All phases" && t.phase !== phaseFilter) return false;
      if (diabetesFilter === "yes" && !t.requiresDiabetes) return false;
      if (diabetesFilter === "no" && t.requiresDiabetes) return false;
      if (!q) return true;
      const idTail = t.id.slice(-6).toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.phase.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q.replace(/^#/, "")) ||
        idTail.includes(q.replace(/^#/, ""))
      );
    });
  }, [metrics.trialRows, q, statusFilter, phaseFilter, diabetesFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTrials.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageTrials = filteredTrials.slice(pageStart, pageStart + pageSize);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (phaseFilter !== "All phases" ? 1 : 0) +
    (diabetesFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setPhaseFilter("All phases");
    setStatusFilter("all");
    setDiabetesFilter("all");
    setSearchQuery("");
    setPage(1);
  };

  const exportCsv = () => {
    const header = [
      "Name",
      "ID",
      "Phase",
      "Applicants",
      "Accepted",
      "Status",
      "Allocated ETH",
      "Paid to participants ETH",
    ];
    const rows = filteredTrials.map((t) => [
      t.name,
      t.id,
      t.phase,
      String(t.applicantCount ?? 0),
      String(t.acceptedCount ?? 0),
      t.active ? "Active" : "Draft",
      formatEthCompact(t.fundedEth),
      formatEthCompact(t.paidToParticipantsEth),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medvault-protocols.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={trialsPageStack}>
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Some metrics may be incomplete (subgraph unavailable).
        </div>
      ) : null}

      <SponsorPageHero
        title="Active protocols"
        description="Monitor and manage your clinical protocols and applicant flow."
        illustrationSrc="/images/active_trial_component.png"
        cta={{ label: "New protocol", to: "/sponsor/trials/create" }}
        links={[
          { label: "Candidate queue", to: "/sponsor/patient-matches", primary: true },
          { label: "Audit logs", to: "/sponsor/audit-logs" },
        ]}
      />

      <div className={trialsSplitGrid}>
        <div className={cn("grid grid-cols-1 sm:grid-cols-3", trialsSectionGap)}>
          <SponsorTrialsSummaryRow
            activeTrials={metrics.activeTrials}
            startingSoon={metrics.startingSoon}
            enrollingCount={metrics.enrollingCount}
            pendingCount={metrics.pendingCount}
            pendingReviewCount={metrics.pendingReviewCount}
            charts={charts}
            loading={loading}
          />
        </div>
        <div className="min-w-0">
          <BudgetUtilizationCard
            utilizationPct={metrics.payoutUtilizationPct}
            allocatedEth={metrics.allocatedEth}
            paidToParticipantsEth={metrics.paidToParticipantsEth}
            loading={loading}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className={cn("flex flex-col lg:flex-row lg:items-center", trialsSectionGap)}>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <input
              type="search"
              placeholder="Search by name, phase, or ID…"
              className={trialsInputClass}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              autoComplete="off"
            />
          </div>
          <select
            value={phaseFilter}
            onChange={(e) => {
              setPhaseFilter(e.target.value);
              setPage(1);
            }}
            className={trialsSelectClass}
          >
            {PHASE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "All phases" ? "All phases" : p}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setPage(1);
            }}
            className={trialsSelectClass}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-semibold uppercase tracking-wide",
              filterOpen
                ? "border-teal-300 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            More filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
            <ChevronDown className={cn("h-3.5 w-3.5", filterOpen && "rotate-180")} />
          </button>
          {activeFilterCount > 0 || searchQuery ? (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 rounded-lg px-2.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
            >
              Clear
            </button>
          ) : null}
        </div>

        {filterOpen ? (
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Therapeutic area (proxy)
            </span>
            {(["all", "yes", "no"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDiabetesFilter(key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize",
                  diabetesFilter === key
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200",
                )}
              >
                {key === "all" ? "All" : key === "yes" ? "Diabetes-focused" : "General"}
              </button>
            ))}
          </div>
        ) : null}

        <div className={trialsSplitGrid}>
          <section className={cn(trialsCardShell, "min-w-0")}>
            <div
              className={cn(
                cn(sponsorCardHeader, "flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"),
                trialsCardInsetX,
              )}
            >
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Trials ({filteredTrials.length})
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-500">Trials linked to your sponsor wallet.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded p-1",
                      viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400",
                    )}
                    aria-label="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded p-1",
                      viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400",
                    )}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "list" ? (
              <div className={cn("overflow-x-auto pb-1", trialsCardInsetX)}>
                <table className="w-full min-w-0 text-left text-xs">
                  <colgroup>
                    <col className="min-w-[160px]" />
                    <col className="w-[5.25rem]" />
                    <col className="min-w-[108px]" />
                    <col className="w-[6.25rem]" />
                    <col className="min-w-[100px]" />
                    <col className="w-[12.5rem]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:px-5">
                        Trial
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Phase
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </th>
                      <th className="min-w-[100px] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Enrollment
                      </th>
                      <th className="min-w-[96px] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Incentive pool
                      </th>
                      <th className="whitespace-nowrap py-2 pl-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                          Loading protocols…
                        </td>
                      </tr>
                    ) : pageTrials.length > 0 ? (
                      pageTrials.map((trial) => <TrialTableRow key={trial.id} trial={trial} />)
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <EmptyState searchQuery={searchQuery} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 p-3.5 sm:grid-cols-2 md:px-5">
                {loading ? (
                  <p className="col-span-full py-8 text-center text-xs text-slate-500">Loading…</p>
                ) : pageTrials.length > 0 ? (
                  pageTrials.map((trial) => <TrialGridCard key={trial.id} trial={trial} />)
                ) : (
                  <div className="col-span-full">
                    <EmptyState searchQuery={searchQuery} />
                  </div>
                )}
              </div>
            )}

            {!loading && filteredTrials.length > 0 ? (
              <PaginationFooter
                pageStart={pageStart}
                pageSize={pageSize}
                total={filteredTrials.length}
                safePage={safePage}
                totalPages={totalPages}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                onPage={setPage}
              />
            ) : null}
          </section>

          <div className="min-w-0">
            <SponsorTrialsInsights
              biasIndicators={biasIndicators}
              payoutAlertCount={metrics.trialsWithPayoutAlert}
              recentActivity={recentActivity}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrialTableRow({ trial }: { trial: TrialPortfolioRow }) {
  const Icon = trialIconFor(trial.id);
  const applicants = trial.applicantCount ?? 0;
  const accepted = trial.acceptedCount ?? 0;
  const enrollmentPct = applicants > 0 ? Math.round((accepted / applicants) * 100) : 0;

  return (
    <tr className="transition-colors hover:bg-slate-50/90">
      <td className="px-3.5 py-2.5 md:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-900">{trial.name}</span>
              {trial.isNew ? (
                <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-teal-800 ring-1 ring-teal-200/80">
                  New
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">#{trial.id.slice(-6).toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
          {trial.phase || "—"}
        </span>
      </td>
      <td className="px-2 py-2.5">
        <StatusCell trial={trial} />
      </td>
      <td className="px-2 py-2.5">
        <div className="min-w-[88px]">
          <div className="flex justify-between text-[10px] tabular-nums text-slate-600">
            <span>
              {accepted} / {applicants}
            </span>
            <span>{enrollmentPct}%</span>
          </div>
          <ProgressBar value={enrollmentPct} color="blue" className="mt-1" />
        </div>
      </td>
      <td className="px-2 py-2.5">
        <div className="text-[10px] font-semibold tabular-nums text-slate-800">
          {formatEthCompact(trial.paidToParticipantsEth)} / {formatEthCompact(trial.fundedEth)} ETH
        </div>
        {trial.fundedEth > 0 ? (
          <>
            <ProgressBar value={trial.payoutPct} color="emerald" className="mt-1" />
            <div className="mt-0.5 text-[9px] text-slate-500">{trial.payoutPct}% paid out</div>
          </>
        ) : (
          <div className="mt-0.5 text-[9px] text-slate-400">Pool not funded</div>
        )}
      </td>
      <td className="py-2.5 pl-2 pr-4 text-right">
        <TrialActions trial={trial} />
      </td>
    </tr>
  );
}

function TrialGridCard({ trial }: { trial: TrialPortfolioRow }) {
  const Icon = trialIconFor(trial.id);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-900">{trial.name}</p>
          <p className="text-[10px] text-slate-500">{indicationLabel(trial)} · {trial.phase}</p>
        </div>
      </div>
      <div className="mt-2.5">
        <StatusCell trial={trial} />
      </div>
      <div className="mt-2.5 flex justify-end">
        <TrialActions trial={trial} />
      </div>
    </div>
  );
}

function StatusCell({ trial }: { trial: TrialPortfolioRow }) {
  return (
    <div className="space-y-1">
      <Badge
        className={cn(
          "px-1.5 py-0 text-[10px]",
          trial.active
            ? "border border-emerald-200/80 bg-emerald-50 font-medium text-emerald-800"
            : "border border-slate-200 bg-slate-50 font-medium text-slate-600",
        )}
      >
        {trial.active ? "Active enrolling" : "Draft"}
      </Badge>
      {trial.active ? (
        <div className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/90 px-1.5 py-0.5 text-[9px] font-semibold text-blue-800">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
          </span>
          <Zap className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
          Chainlink upkeep
        </div>
      ) : null}
    </div>
  );
}

function TrialActions({ trial }: { trial: TrialPortfolioRow }) {
  return (
    <div className="ml-auto inline-flex flex-nowrap items-center justify-end gap-2">
      <Link to={`/sponsor/trials/${trial.id}`} className="shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 min-w-[3.25rem] rounded-md border-slate-200 bg-white px-3 text-[11px] text-slate-700"
        >
          View
        </Button>
      </Link>
      <Link to={`/sponsor/trials/${trial.id}`} className="shrink-0">
        <Button
          size="sm"
          disabled={!trial.active}
          className={cn(
            "h-7 min-w-[3.25rem] rounded-md border px-3 text-[11px] shadow-none",
            trial.active
              ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              : "border-slate-200 bg-slate-100 text-slate-400",
          )}
        >
          Fund
        </Button>
      </Link>
      <Link
        to={`/sponsor/trials/${trial.id}`}
        className="ml-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 ring-1 ring-slate-200/80 hover:bg-slate-50"
        aria-label="More"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PaginationFooter({
  pageStart,
  pageSize,
  total,
  safePage,
  totalPages,
  onPageSize,
  onPage,
}: {
  pageStart: number;
  pageSize: number;
  total: number;
  safePage: number;
  totalPages: number;
  onPageSize: (n: (typeof PAGE_SIZES)[number]) => void;
  onPage: (p: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        trialsCardInsetX,
      )}
    >
      <p className="text-[11px] text-slate-600">
        Showing {pageStart + 1} to {Math.min(pageStart + pageSize, total)} of {total} trials
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
          Per page
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
            className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPage(Math.max(1, safePage - 1))}
            className="h-7 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold disabled:opacity-40"
          >
            Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              className={cn(
                "h-7 min-w-7 rounded-md border px-1.5 text-[11px] font-semibold",
                safePage === n
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPage(Math.min(totalPages, safePage + 1))}
            className="h-7 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <FlaskConical className="mb-3 h-9 w-9 text-slate-300" strokeWidth={1.25} />
      <h3 className="font-display text-sm font-semibold text-slate-900">No protocols found</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        {searchQuery ? `Nothing matches “${searchQuery.trim()}”.` : "Create a protocol to get started."}
      </p>
      {!searchQuery && (
        <Link to="/sponsor/trials/create" className="mt-4">
          <Button className="h-8 gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-4 text-xs text-white">
            <Plus className="h-3.5 w-3.5" />
            Create protocol
          </Button>
        </Link>
      )}
    </div>
  );
}
