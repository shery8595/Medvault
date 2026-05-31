import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Search,
  Download,
  Clock,
  UserCircle2,
  Activity,
  FileText,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { useWeb3 } from "../lib/Web3Context";
import { Link } from "react-router-dom";
import {
  sponsorCardHeader,
  sponsorCardShell,
  sponsorHeroComponentArtClassCompact,
  sponsorHeroDescriptionCompact,
  sponsorHeroEyebrowCompact,
  sponsorHeroLinksCompact,
  sponsorHeroPaddingCompact,
  sponsorHeroTitleCompact,
  sponsorHeroTwoColumnArtGridCompact,
} from "../lib/sponsorUi";
import { SponsorHeroBanner } from "../components/sponsor/SponsorHeroBanner";
import { SponsorHeroCenterArt } from "../components/sponsor/SponsorHeroCenterArt";
import { cn } from "../lib/utils";

export function SponsorAuditLogPage() {
  const { logs, loading, error } = useAuditLogs();
  const { account } = useWeb3();
  const [searchTerm, setSearchTerm] = useState("");
  const [trialFilter, setTrialFilter] = useState("");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.patientHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.performer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTrial = trialFilter ? log.trialId === trialFilter : true;

      return matchesSearch && matchesTrial;
    });
  }, [logs, searchTerm, trialFilter]);

  const formatHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

    const getActionPillClass = (action: string) => {
        const a = (action || "").toUpperCase();
        if (a.includes("CONSENT")) return "bg-emerald-50 text-emerald-900 border-emerald-200";
        if (a.includes("ELIGIBILITY")) return "bg-sky-50 text-sky-900 border-sky-200";
        if (a.includes("APPLICATION")) return "bg-indigo-50 text-indigo-900 border-indigo-200";
        if (a.includes("REWARD")) return "bg-amber-50 text-amber-950 border-amber-200";
        if (a.includes("PROFILE")) return "bg-slate-100 text-slate-900 border-slate-200";
        if (a.includes("PARTICIPANT") || a.includes("POOL")) return "bg-violet-50 text-violet-900 border-violet-200";
        return "bg-slate-100 text-slate-900 border-slate-200";
    };

    const formatEventLabel = (actionType: string) => {
        const t = (actionType || "").trim();
        if (!t) return "Unknown event";
        return t.replace(/_/g, " ");
    };

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Timestamp,Trial ID,Action,Patient Hash,Performer\n" +
      filteredLogs
        .map(
          (e) =>
            `${e.timestamp.toISOString()},${e.trialId},${e.actionType},${e.patientHash},${e.performer}`
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "medvault_audit_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-8">
      <SponsorHeroBanner
        paddingClassName={sponsorHeroPaddingCompact}
        innerClassName={sponsorHeroTwoColumnArtGridCompact}
      >
        <div className="min-w-0 space-y-1">
          <p className={sponsorHeroEyebrowCompact}>Compliance</p>
          <h1 className={sponsorHeroTitleCompact}>Regulatory audit trail</h1>
          <p className={sponsorHeroDescriptionCompact}>
            On-chain DataAccessLog entries for your protocols, merged with any indexed subgraph events. Filter and
            export for reporting.
          </p>
          <div className={sponsorHeroLinksCompact}>
            <Link
              to="/sponsor/active-trials"
              className="inline-flex items-center gap-1 text-teal-700 transition-colors hover:text-teal-800"
            >
              Active protocols
              <span aria-hidden>→</span>
            </Link>
            <span className="text-slate-300">·</span>
            <Link to="/sponsor/patient-matches" className="text-slate-600 transition-colors hover:text-slate-900">
              Candidate queue
            </Link>
          </div>
        </div>
        <SponsorHeroCenterArt src="/images/audit_component.png" artClassName={sponsorHeroComponentArtClassCompact} />
      </SponsorHeroBanner>

      <Card className={cn(sponsorCardShell, "overflow-hidden border-0")}>
        <CardHeader className={cn(sponsorCardHeader, "px-5 py-5 md:px-6")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="font-display flex items-center gap-2 text-base font-semibold text-slate-900">
              <FileText className="h-5 w-5 text-slate-400" strokeWidth={2} />
              System event log
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search actions or hashes…"
                  className="h-10 border-slate-200 bg-white pl-9 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Input
                placeholder="Trial ID"
                className="h-10 w-[120px] border-slate-200 bg-white shadow-sm"
                value={trialFilter}
                onChange={(e) => setTrialFilter(e.target.value)}
              />
              <Button
                variant="outline"
                className="h-10 gap-2 border-slate-300 bg-white text-slate-800 shadow-none hover:bg-slate-50"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                    Timestamp
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                    Event
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                    Trial
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                    Subject hash
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                    Performer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-600">
                        <Loader2 className="h-8 w-8 animate-spin text-[#1D2634]" />
                        <p className="text-sm font-medium">Loading audit log…</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-sm font-medium text-rose-700">Error loading logs: {error}</p>
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-sm text-slate-500">
                      No audit entries match your filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50/90">
                      <td className="px-5 py-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-mono text-xs font-medium text-slate-700">
                            {log.timestamp.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 md:px-6">
                        <span
                          className={`inline-flex max-w-[min(280px,100%)] items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getActionPillClass(log.actionType)}`}
                        >
                          {formatEventLabel(log.actionType)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800 md:px-6">
                        {log.trialId === "0" ? "—" : `#${log.trialId.padStart(4, "0")}`}
                      </td>
                      <td className="px-5 py-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <code className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                            {formatHash(log.patientHash)}
                          </code>
                        </div>
                      </td>
                      <td className="px-5 py-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-mono text-xs text-slate-600">
                            {account &&
                            log.performer.toLowerCase() === account.toLowerCase()
                              ? "You (this wallet)"
                              : formatHash(log.performer)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SponsorAuditLogPage;
