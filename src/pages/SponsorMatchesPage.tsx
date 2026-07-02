import { useMatches } from "../hooks/useMatches";
import { useWeb3 } from "../lib/Web3Context";
import {
  downloadAttestationAuditBundle,
  fetchAttestationAuditBundle,
} from "../lib/attestationExport";
import { parseFieldElement, parseTrialId } from "../lib/field";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Link } from "react-router-dom";
import {
  Mail,
  Clock,
  Search,
  UserCheck,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Download,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "../lib/utils";
import {
  sponsorCardHeader,
  sponsorCardShell,
  sponsorHeroDescription,
  sponsorHeroEyebrow,
  sponsorHeroThreeColumnArtGrid,
  sponsorHeroTitle,
} from "../lib/sponsorUi";
import { trialsInputClass } from "../lib/sponsorTrialsUi";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { SponsorHeroBanner } from "../components/sponsor/SponsorHeroBanner";
import { SponsorHeroCenterArt } from "../components/sponsor/SponsorHeroCenterArt";
import { useSponsorApplicationActions } from "../hooks/useSponsorApplicationActions";
import { useAnonymousCertification } from "../hooks/useAnonymousCertification";
import { ZkCertifyBadge } from "../components/zk/ZkCertifyBadge";
import { Match } from "../types";
import { formatRelativeTimeFromUnix } from "../lib/formatRelativeTime";
import { AnimatePresence, motion } from "framer-motion";
import { SponsorDocumentPanel } from "../components/sponsor/SponsorDocumentPanel";
import { useMatchHasDocument } from "../hooks/useMatchHasDocument";

function fheMatchLabel(match: Match): { text: string; dotClass: string } {
  if (!match.isAnonymous) {
    const score = match.matchScore ?? 0;
    if (score === 100) {
      return { text: "Verified 100%", dotClass: "bg-emerald-500" };
    }
    return { text: "Processing", dotClass: "bg-slate-400" };
  }
  if (match.fhePropensityCommittedAt) {
    const ts = Number(match.fhePropensityCommittedAt);
    const rel = Number.isFinite(ts) ? formatRelativeTimeFromUnix(ts) : "";
    return {
      text: rel ? `FHE committed · ${rel}` : "FHE committed",
      dotClass: "bg-teal-500",
    };
  }
  return { text: "Encrypted match", dotClass: "bg-teal-500" };
}

function MatchRow({
  match,
  trialId,
  onSelect,
}: {
  match: Match;
  trialId: string;
  onSelect: (match: Match) => void;
}) {
  const { provider, chainId } = useWeb3();
  const { hasDocument } = useMatchHasDocument(
    provider ?? undefined,
    match.isAnonymous ? match.nullifier : undefined,
    trialId,
    match.isAnonymous
  );
  const { certified, eligible, fheCommitted } = useAnonymousCertification(
    match.isAnonymous ? match.nullifier : undefined,
    match.isAnonymous ? trialId : undefined,
    match.isAnonymous
      ? {
          noirCertified: match.noirCertified,
          noirEligible: match.noirEligible,
          fhePropensityCommittedAt: match.fhePropensityCommittedAt,
        }
      : undefined
  );

  const fheLabel = fheMatchLabel(match);
  const showFheCommitted = match.isAnonymous && (fheCommitted || match.fhePropensityCommittedAt);

  const handleExportAudit = async () => {
    if (!provider || !match.nullifier) return;
    try {
      const bundle = await fetchAttestationAuditBundle(
        provider,
        parseTrialId(trialId),
        parseFieldElement(match.nullifier),
        chainId ?? undefined
      );
      if (bundle) downloadAttestationAuditBundle(bundle);
    } catch (err) {
      console.error("Attestation export failed:", err);
    }
  };

  return (
    <div
      className={cn(
        "grid min-w-[720px] grid-cols-[1.5fr_1fr_1fr_1fr_120px] items-center gap-4 rounded-xl border px-5 py-4 transition-colors md:px-6",
        match.isAnonymous
          ? "border-violet-200/80 bg-violet-50/40 hover:border-violet-300"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ring-1",
            match.isAnonymous
              ? "bg-violet-100 text-violet-800 ring-violet-200"
              : "bg-slate-100 text-[#1D2634] ring-slate-200"
          )}
        >
          {match.isAnonymous ? "AN" : "VP"}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-mono text-sm font-semibold",
              match.isAnonymous ? "text-violet-900" : "text-slate-900"
            )}
          >
            {match.patientId?.slice(0, 12) || "Unknown"}…
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {match.isAnonymous ? "Anonymous" : "Verified"}
            {hasDocument ? " · Doc" : ""}
          </p>
          {certified ? (
            <div className="mt-1 flex flex-col gap-0.5">
              <ZkCertifyBadge variant="certified" size="sm" eligible={eligible} />
              <span className="text-[10px] font-medium text-teal-700">Zama match sealed</span>
              <button
                type="button"
                onClick={handleExportAudit}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-teal-800"
              >
                <Download className="h-3 w-3" />
                Export audit bundle
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", fheLabel.dotClass)} />
          <span className="text-xs font-medium text-slate-600">{fheLabel.text}</span>
        </div>
        {showFheCommitted && !certified ? (
          <span className="text-[10px] text-teal-700/80 pl-3.5">FHE pipeline on ciphertext</span>
        ) : null}
      </div>

      <div>
        <Badge
          className={cn(
            "border font-semibold text-[10px] uppercase tracking-wide",
            match.status === "Accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            match.status === "Rejected" && "border-rose-200 bg-rose-50 text-rose-800",
            match.status !== "Accepted" &&
              match.status !== "Rejected" &&
              "border-slate-200 bg-slate-50 text-slate-700"
          )}
        >
          {match.status}
        </Badge>
      </div>

      <div className="font-mono text-[11px] font-medium text-slate-500">{match.timestamp}</div>

      <div className="text-right">
        {match.isAnonymous && match.status === "Pending" ? (
          <Button
            size="sm"
            className="h-9 rounded-lg border border-violet-700 bg-violet-700 px-3 text-xs font-semibold text-white shadow-none hover:bg-violet-800"
            onClick={() => onSelect(match)}
          >
            Review
          </Button>
        ) : match.isAnonymous && (match.status === "Accepted" || match.status === "Rejected") ? (
          <div className="flex flex-col items-end gap-1">
            <Badge
              className={cn(
                "border text-[10px] font-semibold",
                match.status === "Accepted"
                  ? "border-violet-200 bg-violet-50 text-violet-900"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              )}
            >
              {match.status}
            </Badge>
            {certified ? (
              <ZkCertifyBadge variant="certified" size="sm" eligible={eligible} />
            ) : null}
          </div>
        ) : match.isAnonymous ? (
          certified ? (
            <ZkCertifyBadge variant="certified" size="sm" eligible={eligible} />
          ) : (
            <span className="text-[10px] font-medium text-teal-700">FHE · awaiting seal</span>
          )
        ) : match.status === "Pending" ? (
          <Button
            size="sm"
            className="h-9 rounded-lg border border-[#1D2634] bg-[#1D2634] px-3 text-xs font-semibold text-white shadow-none hover:bg-[#151c28]"
            onClick={() => onSelect(match)}
          >
            Review
          </Button>
        ) : match.status === "Computed" && (match.matchScore || 0) === 100 ? (
          <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-900">
            <Clock className="mr-1 inline h-3 w-3" />
            Awaiting application
          </Badge>
        ) : match.status === "Accepted" || match.status === "Rejected" ? (
          <button
            type="button"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1D2634]"
          >
            <Mail className="h-4 w-4" />
          </button>
        ) : (
          <span className="text-xs font-medium text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}

export function SponsorMatchesPage() {
  const { account } = useWeb3();
  const { matches, loading, refetch } = useMatches(account || undefined);
  const { updatingId, error, updateApplicationStatus, updateAnonymousApplicationStatus } =
    useSponsorApplicationActions();
  const [message, setMessage] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleUpdateStatus = async (trialId: string, patientAddress: string, status: number) => {
    try {
      const ok = await updateApplicationStatus(trialId, patientAddress, status, message);
      if (!ok) return;
      setMessage("");
      setSelectedMatch(null);
      refetch();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleUpdateAnonymousStatus = async (trialId: string, nullifier: string, status: number) => {
    try {
      const ok = await updateAnonymousApplicationStatus(trialId, nullifier, status);
      if (!ok) return;
      setSelectedMatch(null);
      refetch();
    } catch (err) {
      console.error("Failed to update anonymous status:", err);
    }
  };

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((match) => {
      const identity = (
        match.patientId ||
        match.nullifier ||
        match.patientAddress ||
        ""
      ).toLowerCase();
      return (
        match.trialName.toLowerCase().includes(q) ||
        match.trialId.toLowerCase().includes(q) ||
        match.status.toLowerCase().includes(q) ||
        (match.applicationStatus ?? "").toLowerCase().includes(q) ||
        identity.includes(q)
      );
    });
  }, [matches, searchQuery]);

  const groupedMatches = useMemo(() => {
    const groups: { [key: string]: { trialName: string; matches: any[]; maxTimestamp: number } } = {};
    filteredMatches.forEach((match) => {
      if (!groups[match.trialId]) {
        groups[match.trialId] = { trialName: match.trialName, matches: [], maxTimestamp: 0 };
      }
      groups[match.trialId].matches.push(match);
      const matchTs = (match as any).rawTimestamp || 0;
      if (matchTs > groups[match.trialId].maxTimestamp) {
        groups[match.trialId].maxTimestamp = matchTs;
      }
    });
    return groups;
  }, [filteredMatches]);

  const groupedEntries = useMemo(() => {
    return (
      Object.entries(groupedMatches) as [string, { trialName: string; matches: any[]; maxTimestamp: number }][]
    ).sort((a, b) => b[1].maxTimestamp - a[1].maxTimestamp);
  }, [groupedMatches]);

  return (
    <div className="space-y-5 pb-8">
      <SectionTopBar
        title="Patient matches"
        rightContent={
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/sponsor/active-trials" className="text-[#1D2634] hover:underline">
              Active protocols
            </Link>
            <Link to="/sponsor/analytics" className="text-slate-600 hover:text-slate-900">
              Analytics
            </Link>
          </div>
        }
      />

      <SponsorHeroBanner innerClassName={sponsorHeroThreeColumnArtGrid}>
        <div className="min-w-0 space-y-1.5">
          <p className={sponsorHeroEyebrow}>Recruitment</p>
          <h1 className={sponsorHeroTitle}>Patient matches</h1>
          <p className={sponsorHeroDescription}>
            Review applications grouped by protocol. Anonymous rows use a separate verification flow.
          </p>
        </div>

        <SponsorHeroCenterArt src="/images/patient_matches_component.png" />

        <div className="relative w-full md:col-start-3 md:row-start-1 md:justify-self-end">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search protocol, status, or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            className={cn(trialsInputClass, "w-full")}
          />
        </div>
      </SponsorHeroBanner>

      <div
        className={cn(
          sponsorCardShell,
          "flex flex-col gap-3 border-0 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        )}
      >
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Privacy:</span> identities stay minimized until you complete
          review.
        </p>
        <Link to="/sponsor/active-trials" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1D2634] hover:underline">
          View protocols
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Card className={cn(sponsorCardShell, "overflow-hidden border-0")}>
        <CardHeader className={cn(sponsorCardHeader, "px-5 py-4 md:px-6")}>
          <CardTitle className="font-display text-base font-semibold text-slate-900">
            Candidate queue
          </CardTitle>
          <p className="mt-0.5 text-xs text-slate-500">Grouped by protocol · review and update status</p>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-600">
              <Loader2 className="h-9 w-9 animate-spin text-[#1D2634]" />
              <p className="text-sm font-medium">Loading matches…</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <UserCheck className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900">No candidates yet</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                When patients apply to your trials, they will appear here by protocol.
              </p>
            </div>
          ) : groupedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
              <Search className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <h3 className="font-display text-lg font-semibold text-slate-900">No matches found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Nothing matches &ldquo;{searchQuery.trim()}&rdquo;. Try another protocol name, status, or ID.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-4 text-sm font-semibold text-[#1D2634] hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {groupedEntries.map(([trialId, group]) => (
                <div key={trialId} className="space-y-4">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                        <ShieldCheck className="h-5 w-5 text-[#1D2634]" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-slate-900">{group.trialName}</h3>
                        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Protocol {trialId}
                        </p>
                      </div>
                    </div>
                    <Badge className="w-fit border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                      {group.matches.length} {group.matches.length === 1 ? "candidate" : "candidates"}
                    </Badge>
                  </div>

                  <div className="hidden min-w-0 md:block">
                    <div className="mb-2 grid min-w-[720px] grid-cols-[1.5fr_1fr_1fr_1fr_120px] gap-4 px-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:px-6">
                      <span>Identity</span>
                      <span>Match</span>
                      <span>Status</span>
                      <span>Time</span>
                      <span className="text-right">Action</span>
                    </div>
                  </div>

                  <div className="space-y-2 overflow-x-auto pb-1">
                    {group.matches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        trialId={trialId}
                        onSelect={setSelectedMatch}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !updatingId && setSelectedMatch(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="border-b border-slate-100 px-6 py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1D2634]/10 ring-1 ring-[#1D2634]/15">
                  <UserCheck className="h-6 w-6 text-[#1D2634]" />
                </div>
                <h3 className="font-display text-xl font-semibold text-slate-900">Protocol review</h3>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  ID {selectedMatch.patientId?.slice(0, 18)}…
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                {!selectedMatch.isAnonymous && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Message to applicant (optional)</label>
                    <textarea
                      placeholder="Instructions or feedback…"
                      className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-[#1D2634]/40 focus:ring-2 focus:ring-[#1D2634]/15"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                )}

                {selectedMatch.isAnonymous && selectedMatch.nullifier ? (
                  <SponsorDocumentPanel
                    nullifier={selectedMatch.nullifier}
                    trialId={selectedMatch.trialId}
                    status={selectedMatch.status}
                    isAnonymous
                  />
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => {
                      if (selectedMatch.isAnonymous) {
                        handleUpdateAnonymousStatus(selectedMatch.trialId, selectedMatch.nullifier, 3);
                      } else {
                        handleUpdateStatus(selectedMatch.trialId, selectedMatch.patientAddress, 3);
                      }
                    }}
                    disabled={!!updatingId}
                  >
                    {updatingId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Decline"}
                  </Button>
                  <Button
                    className="h-12 rounded-xl border border-[#1D2634] bg-[#1D2634] text-sm font-semibold text-white shadow-none hover:bg-[#151c28]"
                    onClick={() => {
                      if (selectedMatch.isAnonymous) {
                        handleUpdateAnonymousStatus(selectedMatch.trialId, selectedMatch.nullifier, 2);
                      } else {
                        handleUpdateStatus(selectedMatch.trialId, selectedMatch.patientAddress, 2);
                      }
                    }}
                    disabled={!!updatingId}
                  >
                    {updatingId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Accept"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-3">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Encrypted workflow
                </span>
                <button
                  type="button"
                  onClick={() => !updatingId && setSelectedMatch(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
