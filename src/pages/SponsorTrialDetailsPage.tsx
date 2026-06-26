import { useParams, Link } from "react-router-dom";
import { useMatches } from "../hooks/useMatches";
import { cn } from "../lib/utils";
import { sponsorCardShell } from "../lib/sponsorUi";
import { useTrials } from "../hooks/useTrials";
import { useWeb3 } from "../lib/Web3Context";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState, useEffect } from "react";
import { CriteriaBuilder } from "../components/dashboard/CriteriaBuilder";
import { AutomationHeartbeat } from "../components/dashboard/AutomationHeartbeat";
import { BlindRankingPanel } from "../components/dashboard/BlindRankingPanel";
import { TrialOpsTabs, type TrialOpsTabId } from "../components/sponsor/TrialOpsTabs";
import {
    ArrowLeft,
    Users,
    Activity,
    Target,
    Calendar,
    ShieldCheck,
    Mail,
    MoreHorizontal,
    ChevronRight,
    Sparkles,
    Coins,
    TrendingUp,
    AlertCircle,
    Check,
    X,
    MessageSquare,
    Loader2,
    ShieldAlert
} from "lucide-react";
import { motion } from "framer-motion";
import {
    distributePartialMilestone,
    fundTrialPool,
    getAnonymousParticipantMilestoneState,
    getTrialPoolAndMilestones,
    reclaimUndistributedPool,
    promoteAnonymousParticipantAndDistribute,
    promoteParticipantAndDistribute,
    resetMilestonePagination,
    setTrialMilestones,
    updateTrialApplicationStatus,
} from "../lib/contracts/sponsorAdapters";

export function SponsorTrialDetailsPage() {
    const { id } = useParams();
    const { account, signer, readOnlyProvider } = useWeb3();
    const { trials, loading: trialsLoading } = useTrials(account || undefined, account || undefined);
    const { matches, loading: matchesLoading, refetch: refetchMatches } = useMatches(account || undefined);

    const trial = trials.find(t => t.id === id);
    const trialMatches = matches.filter(m => m.trialId === id && !m.isAnonymous);
    const anonymousMatches = matches.filter(m => m.trialId === id && m.isAnonymous);
    const anonymousMatchCount = anonymousMatches.length;

    const [fundingAmount, setFundingAmount] = useState("");
    const [fundingStatus, setFundingStatus] = useState<string | null>(null);
    const [poolInfo, setPoolInfo] = useState({
        totalFunded: "0",
        distributed: false,
        reclaim: {
            canReclaim: false,
            reclaimFinalized: false,
            trialEnded: false,
            participantCount: 0,
            reclaimableEth: "0",
            screeningDistributed: false,
        },
    });
    const [reclaimStatus, setReclaimStatus] = useState<string | null>(null);
    const [opsTab, setOpsTab] = useState<TrialOpsTabId>("overview");
    const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
    const [decisionMessage, setDecisionMessage] = useState("");
    const [decisionStatus, setDecisionStatus] = useState<string | null>(null);

    const [milestones, setMilestones] = useState<any[]>([]);
    const [milestonesLoading, setMilestonesLoading] = useState(true);
    const [milestoneStatus, setMilestoneStatus] = useState<string | null>(null);
    const [releasingPhaseIndex, setReleasingPhaseIndex] = useState<number | null>(null);
    const [isDefiningMilestones, setIsDefiningMilestones] = useState(false);
    const [anonymousMilestoneState, setAnonymousMilestoneState] = useState<
        Record<string, { participant: string; registered: boolean; progress: number; paid: boolean[] }>
    >({});
    const [newMilestones, setNewMilestones] = useState([
        { name: "Screening", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 7 },
        { name: "Week 4", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 30 },
        { name: "Week 8", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 60 },
        { name: "Final Check", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 90 },
    ]);

    useEffect(() => {
        const fetchProtocolData = async () => {
            if (!signer || !id) return;
            try {
                const protocolData = await getTrialPoolAndMilestones(signer, id, trial?.endTime);
                setPoolInfo({
                    totalFunded: protocolData.totalFunded ?? "0",
                    distributed: protocolData.distributed,
                    reclaim: protocolData.reclaim,
                });
                if (protocolData.milestones.length > 0) {
                    setMilestones(protocolData.milestones);
                }
                setMilestonesLoading(false);
            } catch (err) {
                console.error("Error fetching protocol data:", err);
                setMilestonesLoading(false);
            }
        };
        fetchProtocolData();
    }, [signer, id, trial?.endTime]);

    useEffect(() => {
        let cancelled = false;
        const loadAnonymousMilestoneState = async () => {
            if (!signer || !id || milestones.length === 0 || anonymousMatches.length === 0) {
                setAnonymousMilestoneState({});
                return;
            }

            const entries = await Promise.all(
                anonymousMatches
                    .filter((match) => match.nullifier)
                    .map(async (match) => {
                        try {
                            const state = await getAnonymousParticipantMilestoneState(
                                signer,
                                id,
                                match.nullifier!,
                                milestones.length
                            );
                            return state ? [match.nullifier!, state] as const : null;
                        } catch {
                            return null;
                        }
                    })
            );

            if (!cancelled) {
                setAnonymousMilestoneState(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, { participant: string; registered: boolean; progress: number; paid: boolean[] }]>));
            }
        };

        void loadAnonymousMilestoneState();
        return () => {
            cancelled = true;
        };
    }, [signer, id, milestones.length, anonymousMatches.map((match) => match.nullifier).join("|")]);

    const handleUpdateStatus = async (patientAddress: string, newStatus: number) => {
        if (!signer || !id) return;
        setDecisionStatus("Broadcasting decision to network...");
        try {
            await updateTrialApplicationStatus(signer, id, patientAddress, newStatus, decisionMessage);

            setDecisionStatus("Success! Status updated and enrolled.");
            setSelectedMatch(null);
            setDecisionMessage("");
            // In a real app we'd refresh matches here
        } catch (err: any) {
            console.error(err);
            setDecisionStatus(`Error: ${err.reason || err.message || "Action failed"}`);
        }
    };

    const handleFundTrial = async () => {
        if (!signer || !id || !fundingAmount) return;
        setFundingStatus("Processing deposit...");
        try {
            const totalFunded = await fundTrialPool(signer, id, fundingAmount);
            setFundingStatus("Success! Pool funded.");
            setFundingAmount("");
            setPoolInfo(prev => ({ ...prev, totalFunded }));
        } catch (err: any) {
            console.error(err);
            setFundingStatus(`Error: ${err.reason || err.message || "Failed to fund"}`);
        }
    };

    const handleReclaimUndistributed = async () => {
        if (!signer || !id) return;
        setReclaimStatus("Reclaiming undistributed ETH...");
        try {
            await reclaimUndistributedPool(signer, id);
            setReclaimStatus("Success! Undistributed funds returned to your wallet.");
            const protocolData = await getTrialPoolAndMilestones(signer, id, trial?.endTime);
            setPoolInfo({
                totalFunded: protocolData.totalFunded,
                distributed: protocolData.distributed,
                reclaim: protocolData.reclaim,
            });
        } catch (err: any) {
            console.error(err);
            setReclaimStatus(`Error: ${err.reason || err.message || "Reclaim failed"}`);
        }
    };

    const isTrialOwner =
        Boolean(account) &&
        Boolean(trial?.sponsor?.name) &&
        trial!.sponsor!.name.toLowerCase() === account!.toLowerCase();
    const { reclaim } = poolInfo;
    const showReclaimPanel =
        isTrialOwner &&
        reclaim.trialEnded &&
        parseFloat(poolInfo.totalFunded) > 0 &&
        !reclaim.reclaimFinalized;

    const handleSetMilestones = async () => {
        if (!signer || !id) return;
        setMilestoneStatus("Defining trial phases...");
        try {
            const updatedMilestones = await setTrialMilestones(signer, id, newMilestones);
            setMilestoneStatus("Success! Milestones established.");
            setIsDefiningMilestones(false);
            setMilestones(updatedMilestones);
        } catch (err: any) {
            console.error(err);
            setMilestoneStatus(`Error: ${err.reason || err.message || "Failed to set milestones"}`);
        }
    };

    const handleDistributePartial = async (index: number) => {
        if (!signer || !id) return;
        setReleasingPhaseIndex(index);
        setMilestoneStatus(`Initiating payout for Phase ${index + 1}...`);
        try {
            await distributePartialMilestone(signer, id, index);
            setMilestoneStatus(`Success! Phase ${index + 1} rewards distributed.`);
            // Update local state
            setMilestones(prev => prev.map((m, i) => i === index ? { ...m, distributed: true } : m));
            if (anonymousMatches.length > 0) {
                const entries = await Promise.all(
                    anonymousMatches
                        .filter((match) => match.nullifier)
                        .map(async (match) => {
                            try {
                                const state = await getAnonymousParticipantMilestoneState(
                                    signer,
                                    id,
                                    match.nullifier!,
                                    milestones.length
                                );
                                return state ? [match.nullifier!, state] as const : null;
                            } catch {
                                return null;
                            }
                        })
                );
                setAnonymousMilestoneState(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, { participant: string; registered: boolean; progress: number; paid: boolean[] }]>));
            }
        } catch (err: any) {
            console.error(err);
            const raw = `${err.reason || ""} ${err.message || ""} ${err.shortMessage || ""}`.toLowerCase();
            if (
                raw.includes("no eligible participants") ||
                raw.includes("missing revert data") ||
                (err.code === "CALL_EXCEPTION" && err.data == null)
            ) {
                setMilestoneStatus(
                    `Error: No unpaid participants are eligible for Phase ${index + 1}. They may need promotion first, or this phase may already be released.`
                );
                return;
            }
            setMilestoneStatus(`Error: ${err.reason || err.message || "Payout failed"}`);
        } finally {
            setReleasingPhaseIndex(null);
        }
    };

    const handlePromoteAnonymous = async (nullifier: string, milestoneIndex: number, milestoneName: string) => {
        if (!signer || !id) return;
        setDecisionStatus(`Promoting anonymous participant to ${milestoneName}...`);
        try {
            const result = await promoteAnonymousParticipantAndDistribute(
                signer,
                id,
                nullifier,
                milestoneIndex
            );
            if (result.alreadyPaid) {
                setDecisionStatus(`Success! ${milestoneName} promoted. Reward was already released for this phase.`);
            } else {
                setDecisionStatus(`Success! Promoted anonymous participant to ${milestoneName}. Use Release Funds to pay this phase.`);
            }
            await refetchMatches();
            const refreshed = await getAnonymousParticipantMilestoneState(signer, id, nullifier, milestones.length);
            if (refreshed) {
                setAnonymousMilestoneState((prev) => ({ ...prev, [nullifier]: refreshed }));
            }
        } catch (err: any) {
            console.error("Anonymous Promotion Error:", err);
            const raw = `${err.reason || ""} ${err.message || ""} ${err.shortMessage || ""}`.toLowerCase();
            if (raw.includes("must complete milestones in order")) {
                setDecisionStatus("Error: Promote earlier phases first. Milestones must be completed in order.");
            } else if (raw.includes("not a registered participant") || raw.includes("participant not registered")) {
                setDecisionStatus("Error: Participant is not in the reward pool yet. Accept/enroll them first.");
            } else if (raw.includes("already paid")) {
                setDecisionStatus(`Success! ${milestoneName} was already released.`);
            } else {
                setDecisionStatus(`Error: ${err.reason || err.message || "Promotion failed"}`);
            }
        }
    };

    // HIGH-3: Handler to reset stuck pagination state
    const handleResetPagination = async (index: number) => {
        if (!signer || !id) return;
        setMilestoneStatus(`Resetting pagination for Phase ${index + 1}...`);
        try {
            await resetMilestonePagination(signer, id, index);
            setMilestoneStatus(`Success! Pagination state reset.`);
        } catch (err: any) {
            console.error(err);
            setMilestoneStatus(`Error: ${err.reason || err.message || "Reset failed"}`);
        }
    };

    const getAnonymousPhaseState = (nullifier: string | undefined, milestoneIndex: number) => {
        const state = nullifier ? anonymousMilestoneState[nullifier] : undefined;
        const promoted = !!state && state.progress >= milestoneIndex + 1;
        const released = !!state?.paid?.[milestoneIndex];
        return { promoted, released };
    };

    const getAnonymousPhaseAggregateState = (milestoneIndex: number) => {
        const accepted = anonymousMatches.filter(
            (match) => match.applicationStatus === "Accepted" && match.nullifier
        );
        const states = accepted
            .map((match) => anonymousMilestoneState[match.nullifier!])
            .filter(Boolean);
        const allKnown = accepted.length > 0 && states.length === accepted.length;
        const promotedCount = states.filter((state) => state.progress >= milestoneIndex + 1).length;
        const releasedCount = states.filter((state) => state.paid?.[milestoneIndex]).length;

        return {
            total: accepted.length,
            allKnown,
            promotedCount,
            releasedCount,
            allPromoted: allKnown && promotedCount === accepted.length,
            allReleased: allKnown && releasedCount === accepted.length,
        };
    };

    const fadeIn = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4 }
    };

    if (trialsLoading) {
        return (
            <div className="py-32 flex flex-col items-center justify-center gap-4">
                <Sparkles className="h-8 w-8 text-accent animate-pulse" />
                <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Retrieving Protocol details...</p>
            </div>
        );
    }

    if (!trial) {
        return (
            <div className="py-32 flex flex-col items-center justify-center gap-4 text-center">
                <Sparkles className="h-8 w-8 text-slate-300" />
                <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Protocol not found</p>
                    <p className="mt-2 text-sm text-slate-500 max-w-md">
                        This trial is not available from the current subgraph/deployment. Check that the subgraph is synced to the latest contracts.
                    </p>
                </div>
                <Link to="/sponsor/active-trials" className="text-sm font-semibold text-accent hover:text-accent/80">
                    Back to active trials
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* ─── Header Section ─── */}
            <div className="flex flex-col gap-4">
                <Link to="/sponsor/active-trials" className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-accent transition-colors">
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Trials
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50">
                                Phase {trial.phase}
                            </Badge>
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 font-bold text-[10px] uppercase">
                                Active Enrollment
                            </Badge>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {trial.name}
                        </h2>
                        {trial.endTime && (
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-2">
                                <Calendar className="h-3 w-3" /> Ends on {new Date(parseInt(trial.endTime) * 1000).toLocaleString()}
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
                            <Link to="/sponsor/patient-matches" className="text-accent hover:text-accent/80 transition-colors">
                                Candidate Queue
                            </Link>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <Link to="/sponsor/analytics" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                Analytics
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-2">
                            Pause Recruitment
                        </Button>
                        <Button size="sm" className="gap-2 shadow-lg shadow-accent/20">
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>

            {/* ─── Metrics Grid ─── */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: "Total Matches", value: trialMatches.length + anonymousMatches.length, icon: Target, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
                    { label: "Interested", value: trialMatches.filter(m => m.status === "Interested").length + anonymousMatches.filter(m => m.applicationStatus === "Pending").length, icon: Users, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                    { label: "Eligibility Score", value: "100%", icon: Activity, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
                    {
                        label: "Time Remaining",
                        value: trial.endTime ? (() => {
                            const secondsLeft = Math.max(0, parseInt(trial.endTime) - Math.floor(Date.now() / 1000));
                            if (secondsLeft > 86400) return `${Math.ceil(secondsLeft / 86400)}D`;
                            if (secondsLeft > 3600) return `${Math.floor(secondsLeft / 3600)}H`;
                            if (secondsLeft > 0) return `${Math.floor(secondsLeft / 60)}M`;
                            return "ENDED";
                        })() : "N/A",
                        icon: Calendar,
                        color: "text-violet-500",
                        bg: "bg-violet-50 dark:bg-violet-500/10"
                    },
                ].map((stat, i) => (
                    <motion.div key={i} {...fadeIn} transition={{ delay: i * 0.1 }}>
                        <Card
                          className={cn(
                            sponsorCardShell,
                            "border-0 overflow-hidden dark:border-slate-800/60 dark:bg-slate-900/40 dark:shadow-sm",
                          )}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2 rounded-xl ${stat.bg}`}>
                                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                                    <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h4>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <TrialOpsTabs activeTab={opsTab} onTabChange={setOpsTab}>
                {(tab) => (
            <>
            {(tab === "overview" || tab === "matches") && (
            <BlindRankingPanel
                trialId={id}
                readProvider={readOnlyProvider}
                sponsorAccount={account}
                fallbackApplicantCount={anonymousMatches.length}
            />
            )}

            <div className="grid gap-8 xl:grid-cols-12">
                {/* ─── Left Column ─── */}
                <div className="xl:col-span-7 space-y-8">
                    {(tab === "overview") && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-accent" />
                                Eligibility Logic
                            </h3>
                        </div>
                        <CriteriaBuilder
                            criteria={{
                                minAge: trial.minAge || 18,
                                maxAge: trial.maxAge || 65,
                                requiresDiabetes: trial.requiresDiabetes || false,
                                minHb: trial.minHb || 100,
                                genderRequirement: (trial as any).genderRequirement || 0,
                                minHeight: (trial as any).minHeight || 0,
                                maxWeight: (trial as any).maxWeight || 0,
                                requiresNonSmoker: (trial as any).requiresNonSmoker || false,
                                requiresNormalBP: (trial as any).requiresNormalBP || false
                            }}
                            onChange={() => { }}
                        />
                        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl px-2">
                            Changes to eligibility criteria will automatically re-run matching across our decentralized FHE network.
                            All computations are performed on encrypted patient data.
                        </p>
                    </section>
                    )}

                    {(tab === "milestones" || tab === "rewards" || tab === "overview") && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Coins className="h-5 w-5 text-amber-500" />
                                Incentive Pool & Milestones
                            </h3>
                            {!milestonesLoading && milestones.length === 0 && !isDefiningMilestones && (
                                <Button
                                    size="sm"
                                    onClick={() => setIsDefiningMilestones(true)}
                                    className="gap-2 bg-accent hover:bg-accent/90"
                                >
                                    <Sparkles className="h-4 w-4" /> Define Phased Payouts
                                </Button>
                            )}
                        </div>

                        <Card
                          className={cn(
                            sponsorCardShell,
                            "border-0 overflow-hidden dark:border-slate-800/60 dark:bg-slate-900/40 dark:shadow-sm",
                          )}
                        >
                            <div className="bg-amber-500/5 border-b border-amber-500/10 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Prize Pool</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{poolInfo.totalFunded} ETH</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className={poolInfo.distributed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}>
                                    {poolInfo.distributed ? "Distributed" : "Accumulating"}
                                </Badge>
                            </div>
                            <CardContent className="p-6 space-y-6">
                                {/* Phased Payouts / Milestones Section */}
                                {isDefiningMilestones ? (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Define Trial Phases</h4>
                                            <Button variant="ghost" size="sm" onClick={() => setIsDefiningMilestones(false)}>Cancel</Button>
                                        </div>
                                        <div className="grid gap-4">
                                            {newMilestones.map((m, idx) => (
                                                <div key={idx} className="flex gap-4 items-end">
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500">Phase {idx + 1} Name</label>
                                                        <Input
                                                            value={m.name}
                                                            onChange={(e) => {
                                                                const copy = [...newMilestones];
                                                                copy[idx].name = e.target.value;
                                                                setNewMilestones(copy);
                                                            }}
                                                            className="h-9 text-xs"
                                                        />
                                                    </div>
                                                    <div className="w-32 space-y-1">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500">Weight (%)</label>
                                                        <Input
                                                            type="number"
                                                            value={m.weight / 100}
                                                            onChange={(e) => {
                                                                const copy = [...newMilestones];
                                                                copy[idx].weight = Number(e.target.value) * 100;
                                                                setNewMilestones(copy);
                                                            }}
                                                            className="h-9 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            className="w-full bg-accent"
                                            onClick={handleSetMilestones}
                                            disabled={newMilestones.reduce((acc, curr) => acc + curr.weight, 0) !== 10000}
                                        >
                                            Confirm Phases (100% Total)
                                        </Button>
                                    </div>
                                ) : milestones.length > 0 ? (
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Active Phased Payouts</h4>
                                        <div className="grid gap-3">
                                            {milestones.map((m, idx) => {
                                                const phase = getAnonymousPhaseAggregateState(idx);
                                                const screeningAutoPaid = idx === 0 && poolInfo.distributed;
                                                const phaseReleased = m.distributed || phase.allReleased || screeningAutoPaid;
                                                const needsPromotion =
                                                    idx > 0 &&
                                                    phase.total > 0 &&
                                                    !phase.allPromoted &&
                                                    !phaseReleased;
                                                const isReleasing = releasingPhaseIndex === idx;
                                                const buttonLabel = phaseReleased
                                                    ? "Released"
                                                    : isReleasing
                                                        ? "Releasing…"
                                                        : needsPromotion
                                                            ? "Promote First"
                                                            : "Release Funds";

                                                return (
                                                    <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={cn(
                                                                "h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0",
                                                                phaseReleased
                                                                    ? "bg-emerald-100 text-emerald-600"
                                                                    : phase.allPromoted
                                                                        ? "bg-teal-100 text-teal-700"
                                                                        : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {idx + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</p>
                                                                <p className="text-[10px] text-slate-500 uppercase font-mono">{m.weightBps / 100}% Reward Weight</p>
                                                                {phase.total > 0 && (
                                                                    <p className="text-[10px] text-slate-500">
                                                                        {phase.releasedCount}/{phase.total} released / {phase.promotedCount}/{phase.total} promoted
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={phaseReleased || needsPromotion || isReleasing}
                                                            onClick={() => void handleDistributePartial(idx)}
                                                            className={cn(
                                                                "h-8 min-w-[7.5rem] text-[10px] font-bold uppercase disabled:opacity-100",
                                                                phaseReleased
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                                    : needsPromotion
                                                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                                                        : "bg-slate-100 text-slate-800",
                                                            )}
                                                        >
                                                            {buttonLabel}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-3">
                                        <Sparkles className="h-8 w-8 text-slate-300" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">No Phased Payouts Set</p>
                                            <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Establish milestones to incentivize participants with partial payouts throughout the trial duration.</p>
                                        </div>
                                    </div>
                                )}

                                {showReclaimPanel && (
                                    <div
                                        className={cn(
                                            "p-4 rounded-xl border space-y-3",
                                            reclaim.canReclaim
                                                ? "border-violet-200 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-950/30"
                                                : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40",
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <ShieldAlert className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                                            <div className="space-y-1 min-w-0">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                                                    Reclaim undistributed funds
                                                </h4>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    {reclaim.participantCount === 0
                                                        ? "This trial ended with no enrolled participants. You can recover the full prize pool that was never paid out."
                                                        : reclaim.screeningDistributed
                                                            ? "After screening payouts, any ETH still in the pool can be returned to you once the trial has ended."
                                                            : "Run screening distribution (or wait for automation) before reclaiming the remaining balance."}
                                                </p>
                                            </div>
                                        </div>
                                        {reclaim.canReclaim ? (
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                {reclaim.participantCount === 0 && parseFloat(reclaim.reclaimableEth) > 0 && (
                                                    <p className="text-sm font-bold text-violet-900 dark:text-violet-200 font-mono">
                                                        ~{reclaim.reclaimableEth} ETH
                                                    </p>
                                                )}
                                                <Button
                                                    onClick={handleReclaimUndistributed}
                                                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-500/20 sm:ml-auto"
                                                >
                                                    Reclaim to wallet
                                                </Button>
                                            </div>
                                        ) : null}
                                        {reclaimStatus && (
                                            <div
                                                className={cn(
                                                    "p-3 rounded-lg text-xs font-semibold flex items-center gap-2",
                                                    reclaimStatus.startsWith("Error")
                                                        ? "bg-red-50 text-red-600"
                                                        : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
                                                )}
                                            >
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                {reclaimStatus}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {reclaim.reclaimFinalized && parseFloat(poolInfo.totalFunded) > 0 && (
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                        <Check className="h-3.5 w-3.5" />
                                        Undistributed pool already reclaimed
                                    </p>
                                )}

                                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Fund Pool with ETH</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="0.5"
                                                    className="h-12 rounded-xl border-slate-200 dark:border-slate-800 focus-visible:ring-amber-500"
                                                    value={fundingAmount}
                                                    onChange={(e) => setFundingAmount(e.target.value)}
                                                />
                                                <Button
                                                    onClick={handleFundTrial}
                                                    disabled={!fundingAmount || poolInfo.distributed}
                                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-xl font-bold shadow-lg shadow-amber-500/20 disabled:opacity-100 disabled:bg-amber-400/40 disabled:text-white/90 disabled:shadow-none"
                                                >
                                                    Deposit
                                                </Button>
                                            </div>
                                        </div>
                                        {(fundingStatus || milestoneStatus) && (
                                            <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${(fundingStatus?.startsWith("Error") || milestoneStatus?.startsWith("Error")) ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                                                <AlertCircle className="h-4 w-4" />
                                                {fundingStatus || milestoneStatus}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">Enterprise Privacy</h4>
                                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                            V1.1 introduces phased payouts. Sponsors can release percentage-based incentives at key milestones, maintaining retention while preserving participant privacy via FHE balances.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                    )}

                    {(tab === "automation" || tab === "overview") && (
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            System Infrastructure
                        </h3>
                        <AutomationHeartbeat
                            trialId={trial.id}
                            isFinalized={(trial as any).isFinalized}
                            endTime={trial.endTime}
                            isActive={trial.active}
                        />
                    </section>
                    )}
                </div>

                {(tab === "matches" || tab === "overview") && (
                <div className="xl:col-span-5 space-y-6">
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent Matches</h3>
                        {anonymousMatchCount > 0 && (
                            <div className="space-y-3">
                                <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300 text-xs font-medium">
                                    {anonymousMatchCount} anonymous application{anonymousMatchCount > 1 ? "s are" : " is"} managed via nullifier flow.
                                </div>
                                {anonymousMatches.slice(0, 6).map((match, i) => (
                                    <Card
                                        key={match.id}
                                        className="border-violet-200/70 bg-violet-50/70 dark:border-violet-900/40 dark:bg-violet-950/20 shadow-sm overflow-hidden"
                                    >
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-mono text-xs font-bold text-violet-950 dark:text-violet-100 truncate">
                                                        {match.patientId || `Anonymous #${i + 1}`}
                                                    </p>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500">
                                                        {match.applicationStatus}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[9px] font-black",
                                                        match.applicationStatus === "Accepted"
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                            : "border-violet-200 bg-white/70 text-violet-700"
                                                    )}
                                                >
                                                    {match.applicationStatus === "Accepted" ? "Participant" : "Review"}
                                                </Badge>
                                            </div>

                                            {match.applicationStatus === "Accepted" && match.nullifier ? (
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                                        Promote participant
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {milestones.map((m, mIdx) => {
                                                            const phase = getAnonymousPhaseState(match.nullifier, mIdx);
                                                            return (
                                                                <Button
                                                                    key={`${match.id}-${mIdx}`}
                                                                    size="sm"
                                                                    variant={phase.promoted || phase.released ? "default" : "outline"}
                                                                    onClick={() => handlePromoteAnonymous(match.nullifier!, mIdx, m.name)}
                                                                    disabled={phase.promoted}
                                                                    className={cn(
                                                                        "h-10 text-[9px] font-bold flex flex-col gap-0.5 disabled:opacity-100",
                                                                        phase.released
                                                                            ? "bg-emerald-600 text-white border-emerald-600"
                                                                            : phase.promoted
                                                                                ? "bg-teal-600 text-white border-teal-600"
                                                                                : "bg-white/80"
                                                                    )}
                                                                >
                                                                    <span>
                                                                        {phase.released
                                                                            ? `P${mIdx + 1} Released`
                                                                            : phase.promoted
                                                                                ? `P${mIdx + 1} Promoted`
                                                                                : `Promote P${mIdx + 1}`}
                                                                    </span>
                                                                    <span className="opacity-70 truncate max-w-full">{m.name}</span>
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <Link
                                                    to="/sponsor/patient-matches"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-violet-700 hover:text-violet-900"
                                                >
                                                    Review anonymous candidate <ChevronRight className="h-3 w-3" />
                                                </Link>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                        <div className="space-y-3">
                            {matchesLoading ? (
                                <p className="text-sm text-slate-500 italic">Syncing matches...</p>
                            ) : trialMatches.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No matches found for this protocol yet.</p>
                            ) : (
                                trialMatches.slice(0, 10).map((match, i) => (
                                    <motion.div key={match.id} {...fadeIn} transition={{ delay: 0.3 + (i * 0.1) }}>
                                        <Card
                                          className={cn(
                                            sponsorCardShell,
                                            "group border-0 overflow-hidden transition-all duration-300 hover:to-slate-100/80 dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/60 dark:shadow-sm",
                                            selectedMatch === match.patientAddress ? "ring-2 ring-accent border-accent/20" : "",
                                          )}
                                        >
                                            <CardContent className="p-0">
                                                <div className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-500">
                                                            #{i + 1}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                                                                    {match.patientAddress.slice(0, 6)}...{match.patientAddress.slice(-4)}
                                                                </span>
                                                                <Badge
                                                                    variant={match.matchScore === 100 ? "success" : "warning"}
                                                                    className="text-[9px] h-4 font-black tracking-tight"
                                                                >
                                                                    {match.applicationStatus === "Accepted" ? "PARTICIPANT" :
                                                                        match.applicationStatus === "Rejected" ? "DECLINED" :
                                                                            match.matchScore === 100 ? "ELIGIBLE" : "PENDING"}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                                                Match Score: {match.matchScore}%
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {match.matchScore === 100 && match.applicationStatus !== "Accepted" && match.applicationStatus !== "Rejected" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-accent hover:text-accent"
                                                                onClick={() => setSelectedMatch(selectedMatch === match.patientAddress ? null : match.patientAddress)}
                                                            >
                                                                Decide
                                                            </Button>
                                                        )}
                                                        {match.applicationStatus === "Accepted" && (
                                                            <div className="flex items-center gap-2">
                                                                {milestones.length > 0 && (
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <div className="flex gap-1">
                                                                            {[1, 2, 3, 4].slice(0, milestones.length).map((mIdx) => (
                                                                                <div
                                                                                    key={mIdx}
                                                                                    className={cn(
                                                                                        "h-1.5 w-4 rounded-full transition-all",
                                                                                        (match.currentMilestone || 0) >= mIdx
                                                                                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                                                                            : "bg-slate-200 dark:bg-slate-800"
                                                                                    )}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                            Phase {(match.currentMilestone || 0)}/{milestones.length}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-400 hover:text-accent"
                                                                    onClick={() => setSelectedMatch(selectedMatch === match.patientAddress ? null : match.patientAddress)}
                                                                >
                                                                    <TrendingUp className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-accent">
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Decision/Promotion Form Overlay */}
                                                {selectedMatch === match.patientAddress && (
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: "auto" }}
                                                        className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-4"
                                                    >
                                                        {match.applicationStatus === "Accepted" ? (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">Promote Participant Journey</h4>
                                                                    <Badge variant="outline" className="text-[9px]">Participant</Badge>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                    {milestones.map((m, mIdx) => (
                                                                        <Button
                                                                            key={mIdx}
                                                                            size="sm"
                                                                            variant={(match.currentMilestone || 0) >= mIdx + 1 ? "default" : "outline"}
                                                                            className={cn(
                                                                                "h-10 text-[9px] font-bold flex flex-col gap-0.5",
                                                                                (match.currentMilestone || 0) === mIdx + 1 && "ring-1 ring-emerald-500"
                                                                            )}
                                                                            onClick={async () => {
                                                                                if (!signer || !id) return;
                                                                                setDecisionStatus(`Promoting to ${m.name}...`);
                                                                                try {
                                                                                    const result = await promoteParticipantAndDistribute(
                                                                                        signer,
                                                                                        id,
                                                                                        match.patientAddress,
                                                                                        mIdx
                                                                                    );
                                                                                    if (result.alreadyPaid) {
                                                                                        setDecisionStatus(`Success! Reward for ${m.name} was already distributed.`);
                                                                                        return;
                                                                                    }
                                                                                    setDecisionStatus(`Success! Promoted to ${m.name}. Processing reward...`);
                                                                                    setDecisionStatus(`Success! Promoted & Reward Sent for ${m.name}.`);
                                                                                } catch (err: any) {
                                                                                    console.error("Promotion Error:", err);
                                                                                    const reason = err.reason || err.message || "";
                                                                                    if (reason.includes("Participant not registered")) {
                                                                                        setDecisionStatus("Error: Participant not in reward pool. Fund trial and retry.");
                                                                                    } else {
                                                                                        setDecisionStatus(`Error: ${reason}`);
                                                                                    }
                                                                                }
                                                                            }}
                                                                        >
                                                                            <span>Phase {mIdx + 1}</span>
                                                                            <span className="opacity-50 text-[7px] truncate w-full">{m.name}</span>
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 italic">
                                                                    Advancing a patient through phases allows for individual progress tracking and automated payout release.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                                        <MessageSquare className="h-3 w-3" /> Secure Message to Patient
                                                                    </label>
                                                                    <textarea
                                                                        className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-accent outline-none min-h-[80px]"
                                                                        placeholder="Enter enrollment instructions or rejection reason..."
                                                                        value={decisionMessage}
                                                                        onChange={(e) => setDecisionMessage(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-bold text-[11px]"
                                                                            onClick={() => handleUpdateStatus(match.patientAddress, 2)}
                                                                        >
                                                                            <Check className="h-3.5 w-3.5" /> Approve
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            className="gap-2 font-bold text-[11px]"
                                                                            onClick={() => handleUpdateStatus(match.patientAddress, 3)}
                                                                        >
                                                                            <X className="h-3.5 w-3.5" /> Reject
                                                                        </Button>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-slate-500 font-bold text-[11px]"
                                                                        onClick={() => setSelectedMatch(null)}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        )}
                                                        {decisionStatus && (
                                                            <p className={cn(
                                                                "text-[10px] font-bold uppercase italic",
                                                                decisionStatus.startsWith("Error") ? "text-rose-500" : "text-indigo-500"
                                                            )}>
                                                                {decisionStatus.startsWith("Success") ? (
                                                                    <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {decisionStatus}</span>
                                                                ) : decisionStatus.includes("Promoting") ? (
                                                                    <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {decisionStatus}</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> {decisionStatus}</span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                            {trialMatches.length > 0 && (
                                <Link to="/sponsor/patient-matches" className="flex items-center justify-center gap-2 p-3 text-sm font-bold text-slate-500 hover:text-accent transition-colors">
                                    View All Matches <ChevronRight className="h-4 w-4" />
                                </Link>
                            )}
                        </div>
                    </section>
                </div>
                )}
            </div>
            </>
                )}
            </TrialOpsTabs>
        </div>
    );
}
