import { useMatches } from "../hooks/useMatches";
import { useWeb3 } from "../lib/Web3Context";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Mail, CheckCircle, Clock, Search, Sparkles, UserCheck, XCircle, Send, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { getEligibilityEngine, getSponsorIncentiveVault } from "../lib/contracts";
import { ethers } from "ethers";
import { cn } from "../lib/utils";

export function SponsorMatchesPage() {
  const { account, signer } = useWeb3();
  const { matches, loading, refetch } = useMatches(account || undefined);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  const handleUpdateStatus = async (trialId: string, patientAddress: string, status: number) => {
    if (!signer) return;
    setUpdatingId(`${trialId}-${patientAddress}`);
    try {
      const engine = getEligibilityEngine(signer);
      const messageBytes = ethers.hexlify(ethers.toUtf8Bytes(message || (status === 2 ? "Accepted" : "Rejected")));

      const tx = await engine.updateApplicationStatus(
        BigInt(trialId),
        patientAddress,
        status,
        messageBytes
      );
      await tx.wait();

      // V1.2.3: Automatic Registration for Reward Pool on Approval
      if (status === 2) {
        const vault = getSponsorIncentiveVault(signer);
        const txReg = await vault.registerParticipant(BigInt(trialId), patientAddress);
        await txReg.wait();
      }

      setMessage("");
      setSelectedMatch(null);
      refetch();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Group matches by trial
  const groupedMatches = useMemo(() => {
    const groups: { [key: string]: { trialName: string; matches: any[]; maxTimestamp: number } } = {};
    matches.forEach(match => {
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
  }, [matches]);

  const groupedEntries = useMemo(() => {
    return (Object.entries(groupedMatches) as [string, { trialName: string; matches: any[]; maxTimestamp: number }][])
      .sort((a, b) => b[1].maxTimestamp - a[1].maxTimestamp);
  }, [groupedMatches]);

  return (
    <div className="min-h-screen pb-16 space-y-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-blue-400" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-400 font-black">
              ◈ Recruitment Hub
            </p>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
            Protocol Candidates
          </h2>
          <p className="text-slate-400 max-w-xl text-[15px] leading-relaxed border-l-2 border-blue-500/20 pl-5 py-1">
            Review and manage cryptographically verified applications grouped by their respective clinical protocols.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 pt-2">
          <button className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-mono text-[11px] uppercase tracking-widest font-black transition-all hover:bg-white/10 hover:text-white group">
            <Search className="h-4 w-4 group-hover:text-blue-400 transition-colors" /> Search Candidates
          </button>
        </div>
      </div>

      {/* ── Candidate Queue ── */}
      <div className="relative">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-3xl border-2 border-blue-500/20 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-blue-400 animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">
              Syncing Protocol Results...
            </p>
          </div>
        ) : matches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-32 flex flex-col items-center justify-center rounded-3xl bg-white/[0.02] border border-dashed border-white/10 text-center"
          >
            <div className="h-20 w-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <UserCheck className="h-8 w-8 text-slate-700" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Empty Recruitment Queue</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              No applications currently pending review. Verified candidates will appear here once they authorize disclosure.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-12">
            {groupedEntries.map(([trialId, group], groupIndex) => (
              <motion.div
                key={trialId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.1 }}
                className="space-y-6"
              >
                {/* Trial Section Header */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">{group.trialName}</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Protocol ID: {trialId}</p>
                    </div>
                  </div>
                  <Badge className="bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest px-3 py-1 text-slate-400">
                    {group.matches.length} {group.matches.length === 1 ? 'Candidate' : 'Candidates'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_100px] px-8 mb-2">
                    {["Patient Identity", "Match Confidence", "Current Status", "Timestamp", ""].map((header, i) => (
                      <span key={i} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {header}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {group.matches.map((match, i) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group relative grid grid-cols-[1.5fr_1fr_1fr_1fr_100px] items-center px-8 py-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 hover:border-blue-500/30 overflow-hidden"
                      >
                        {/* Glow layer */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                          <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/5 blur-[50px] rounded-full" />
                        </div>

                        {/* Identity */}
                        <div className="flex items-center gap-4 relative z-10">
                          <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-blue-500 shadow-inner group-hover:scale-110 transition-transform duration-500">
                            VP
                          </div>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">
                              {match.patientId?.slice(0, 12) || "Unknown"}...
                            </span>
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                              Verified Identity
                            </span>
                          </div>
                        </div>

                        {/* Match Confidence */}
                        <div className="flex items-center gap-2 relative z-10">
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            (match.matchScore || 0) === 100 ? "bg-blue-500 shadow-[0_0_8px_rgba(20,184,166,0.6)] animate-pulse" : "bg-indigo-500"
                          )} />
                          <span className="text-xs font-black text-slate-400 group-hover:text-slate-200 uppercase tracking-widest transition-colors">
                            {(match.matchScore || 0) === 100 ? "Verified 100%" : "Processing"}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="relative z-10">
                          <Badge
                            className={cn(
                              "font-black text-[9px] uppercase tracking-widest border-none px-3 py-1",
                              match.status === "Accepted" ? "bg-blue-500/10 text-blue-400" :
                                match.status === "Rejected" ? "bg-rose-500/10 text-rose-400" : "bg-indigo-500/10 text-indigo-400"
                            )}
                          >
                            {match.status}
                          </Badge>
                        </div>

                        {/* Date */}
                        <div className="font-mono text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors uppercase tracking-widest relative z-10">
                          {match.timestamp}
                        </div>

                        {/* Action */}
                        <div className="text-right relative z-10">
                          {match.status === "Pending" ? (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 gap-2 font-black text-[10px] uppercase tracking-widest px-4 h-9 rounded-xl transition-all"
                              onClick={() => setSelectedMatch(match)}
                            >
                              Review
                            </Button>
                          ) : match.status === "Computed" && (match.matchScore || 0) === 100 ? (
                            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black text-[9px] uppercase tracking-widest px-3 py-1.5">
                              <Clock className="h-3 w-3 mr-1.5 inline" />
                              Awaiting Application
                            </Badge>
                          ) : match.status === "Accepted" || match.status === "Rejected" ? (
                            <button className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-blue-400 hover:bg-white/10 transition-all">
                              <Mail className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                              —
                            </span>
                          )}
                        </div>

                        {/* Inner glow border */}
                        <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Decision Atmosphere Modal ── */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !updatingId && setSelectedMatch(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-xl rounded-[40px] bg-[#050b14] border border-white/10 shadow-[0_0_80px_rgba(20,184,166,0.1)] overflow-hidden flex flex-col pt-10"
            >
              {/* Animated Mesh Backround inside Modal */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/30 blur-[100px] rounded-full animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse delay-700" />
              </div>

              <div className="px-10 pb-8 relative z-10 text-center">
                <div className="mx-auto w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 shadow-2xl">
                  <UserCheck className="h-7 w-7 text-blue-400" />
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter mb-2">
                  Protocol Review
                </h3>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.2em] mb-8">
                  Patient ID: <span className="text-blue-400">{selectedMatch.patientId.slice(0, 16)}...</span>
                </p>

                <div className="space-y-6 text-left">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        Secure Cryptographic Response
                      </label>
                      <ShieldCheck className="h-4 w-4 text-blue-500/50" />
                    </div>
                    <textarea
                      placeholder="Enter contact instructions or match feedback. This message will be FHE-encrypted..."
                      className="w-full h-40 p-6 rounded-3xl border border-white/10 bg-white/5 text-slate-200 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 outline-none transition-all resize-none shadow-inner"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <Button
                      variant="outline"
                      className="h-16 rounded-3xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 font-black text-xs uppercase tracking-[0.2em] transition-all group"
                      onClick={() => handleUpdateStatus(selectedMatch.trialId, selectedMatch.patientAddress, 3)}
                      disabled={!!updatingId}
                    >
                      {updatingId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Decline Protocol"}
                    </Button>
                    <Button
                      className="h-16 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-[0_20px_40px_-10px_rgba(20,184,166,0.3)]"
                      onClick={() => handleUpdateStatus(selectedMatch.trialId, selectedMatch.patientAddress, 2)}
                      disabled={!!updatingId}
                    >
                      {updatingId ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Accept"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="px-10 py-5 bg-white/5 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,1)]" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500 font-black">FHE Coprocessor Optimized</span>
                </div>
                <button
                  onClick={() => !updatingId && setSelectedMatch(null)}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  Cancel Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

