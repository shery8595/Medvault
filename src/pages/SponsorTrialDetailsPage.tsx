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
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { friendlyMilestoneDistributeError } from "../lib/contractErrors";
import {
    distributePartialMilestone,
    enrollUnregisteredAcceptedParticipants,
    fundTrialPool,
    getAnonymousParticipantMilestoneState,
    getTrialPoolAndMilestones,
    reclaimUndistributedPool,
    claimReclaimedPool,
    promoteAnonymousParticipantAndDistribute,
    promoteParticipantAndDistribute,
    pruneUnconfirmedSlots,
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
            sponsorVerified: true,
            gracePeriodElapsed: false,
            pendingReclaimEth: null as string | null,
            pendingReclaimRecipient: null as string | null,
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
        Record<string, { participant: string; registered: boolean; progress: number; staged: boolean[]; confirmed: boolean[]; paid: boolean[] }>
    >({});
    const [anonymousStateLoading, setAnonymousStateLoading] = useState(false);
    const [promotingKey, setPromotingKey] = useState<string | null>(null);
    const [protocolRefreshing, setProtocolRefreshing] = useState(false);
    const [newMilestones, setNewMilestones] = useState([
        { name: "Screening", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 7 },
        { name: "Week 4", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 30 },
        { name: "Week 8", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 60 },
        { name: "Final Check", weight: 2500, deadline: Math.floor(Date.now() / 1000) + 86400 * 90 },
    ]);

    const refreshProtocolData = useCallback(async () => {
        if (!signer || !id) return;
        setProtocolRefreshing(true);
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
        } finally {
            setProtocolRefreshing(false);
        }
    }, [signer, id, trial?.endTime]);

    const anonymousMatchKey = anonymousMatches
        .filter((match) => match.nullifier)
        .map((match) => match.nullifier)
        .join("|");
    const anonymousNullifiers = useMemo(
        () => anonymousMatches.filter((match) => match.nullifier).map((match) => match.nullifier!),
        [anonymousMatchKey],
    );

    const refreshAnonymousMilestoneState = useCallback(async () => {
        if (!signer || !id || milestones.length === 0 || anonymousNullifiers.length === 0) {
            setAnonymousMilestoneState({});
            setAnonymousStateLoading(false);
            return;
        }

        setAnonymousStateLoading(true);
        try {
            const entries = await Promise.all(
                anonymousNullifiers.map(async (nullifier) => {
                    try {
                        const state = await getAnonymousParticipantMilestoneState(
                            signer,
                            id,
                            nullifier,
                            milestones.length
                        );
                        return state ? [nullifier, state] as const : null;
                    } catch {
                        return null;
                    }
                })
            );
            setAnonymousMilestoneState(
                Object.fromEntries(
                    entries.filter(Boolean) as Array<
                        readonly [
                            string,
                            {
                                participant: string;
                                registered: boolean;
                                progress: number;
                                staged: boolean[];
                                confirmed: boolean[];
                                paid: boolean[];
                            },
                        ]
                    >
                )
            );
        } finally {
            setAnonymousStateLoading(false);
        }
    }, [signer, id, milestones.length, anonymousNullifiers]);

    useEffect(() => {
        void refreshProtocolData();
    }, [refreshProtocolData]);

    useEffect(() => {
        void refreshAnonymousMilestoneState();
    }, [refreshAnonymousMilestoneState]);

    const paymentTabActive = opsTab === "milestones" || opsTab === "rewards";
    useEffect(() => {
        if (!paymentTabActive) return;
        void refreshProtocolData();
        void refreshAnonymousMilestoneState();
        const interval = window.setInterval(() => {
            void refreshProtocolData();
            void refreshAnonymousMilestoneState();
        }, 20_000);
        return () => window.clearInterval(interval);
    }, [paymentTabActive, refreshProtocolData, refreshAnonymousMilestoneState]);

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
        setReclaimStatus("Scheduling reclaim (pull pattern)...");
        try {
            await reclaimUndistributedPool(signer, id);
            setReclaimStatus("Reclaim scheduled. Click “Claim reclaimed ETH” to receive funds in your wallet.");
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

    const handleClaimReclaimed = async () => {
        if (!signer || !id) return;
        setReclaimStatus("Claiming scheduled reclaim to wallet...");
        try {
            await claimReclaimedPool(signer, id);
            setReclaimStatus("Success! Reclaimed ETH sent to your wallet.");
            const protocolData = await getTrialPoolAndMilestones(signer, id, trial?.endTime);
            setPoolInfo({
                totalFunded: protocolData.totalFunded,
                distributed: protocolData.distributed,
                reclaim: protocolData.reclaim,
            });
        } catch (err: any) {
            console.error(err);
            const raw = `${err.reason || ""} ${err.message || ""}`.toLowerCase();
            if (raw.includes("rerouted") || raw.includes("owner")) {
                setReclaimStatus(
                    "Reclaim was rerouted to the protocol owner (transfer failed or sponsor unverified). Contact support if unexpected."
                );
            } else {
                setReclaimStatus(`Error: ${err.reason || err.message || "Claim reclaimed failed"}`);
            }
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
        !reclaim.reclaimFinalized &&
        reclaim.canReclaim;

    const showPendingReclaimPanel =
        isTrialOwner &&
        reclaim.pendingReclaimEth != null &&
        parseFloat(reclaim.pendingReclaimEth) > 0;

    const showReclaimBlockedUnverified =
        isTrialOwner &&
        reclaim.trialEnded &&
        reclaim.sponsorVerified === false &&
        !reclaim.reclaimFinalized &&
        !showPendingReclaimPanel &&
        parseFloat(poolInfo.totalFunded) > 0;

    const showReclaimBlockedInfo =
        isTrialOwner &&
        reclaim.trialEnded &&
        reclaim.sponsorVerified !== false &&
        !reclaim.canReclaim &&
        !reclaim.reclaimFinalized &&
        !showPendingReclaimPanel &&
        parseFloat(poolInfo.totalFunded) > 0;

    const canClaimPendingReclaim =
        showPendingReclaimPanel &&
        account &&
        reclaim.pendingReclaimRecipient?.toLowerCase() === account.toLowerCase();

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

    const promoteTargetKey = (kind: "anon" | "wallet", targetId: string, mIdx: number) =>
        `${kind}:${targetId}:${mIdx}`;

    const handleEnrollParticipants = async () => {
        if (!signer || !id) {
            setMilestoneStatus("Error: Connect your sponsor wallet to enroll participants.");
            return;
        }

        const acceptedNullifiers = anonymousMatches
            .filter((match) => match.applicationStatus === "Accepted" && match.nullifier)
            .map((match) => match.nullifier!);

        if (acceptedNullifiers.length === 0) {
            setMilestoneStatus("Error: No accepted anonymous participants to enroll.");
            return;
        }

        setMilestoneStatus("Enrolling accepted participants in the reward pool…");
        try {
            const result = await enrollUnregisteredAcceptedParticipants(signer, id, acceptedNullifiers);
            if (result.enrolled === 0 && result.alreadyRegistered === acceptedNullifiers.length) {
                setMilestoneStatus("All accepted participants are already enrolled in the reward pool.");
            } else {
                setMilestoneStatus(
                    `Success! Enrolled ${result.enrolled} participant${result.enrolled === 1 ? "" : "s"}${result.failed > 0 ? ` (${result.failed} failed)` : ""}.`,
                );
            }
            await refreshAnonymousMilestoneState();
            await refreshProtocolData();
        } catch (err: any) {
            console.error(err);
            setMilestoneStatus(`Error: ${err.reason || err.message || "Enrollment failed"}`);
        }
    };

    const handleDistributePartial = async (index: number) => {
        if (!signer || !id) {
            setMilestoneStatus("Error: Connect your sponsor wallet to stage entitlements.");
            return;
        }

        const acceptedNullifiers = anonymousMatches
            .filter((match) => match.applicationStatus === "Accepted" && match.nullifier)
            .map((match) => match.nullifier!);

        if (acceptedNullifiers.length > 0) {
            const registrationStates = await Promise.all(
                acceptedNullifiers.map(async (nullifier) => {
                    try {
                        return await getAnonymousParticipantMilestoneState(
                            signer,
                            id,
                            nullifier,
                            milestones.length,
                        );
                    } catch {
                        return null;
                    }
                }),
            );
            const hasUnregistered = registrationStates.some((state) => state && !state.registered);

            if (hasUnregistered) {
                setMilestoneStatus(`Completing enrollment for Phase ${index + 1}…`);
                const gapResult = await enrollUnregisteredAcceptedParticipants(signer, id, acceptedNullifiers);
                if (gapResult.enrolled > 0) {
                    setMilestoneStatus(
                        `Enrolled ${gapResult.enrolled} participant${gapResult.enrolled === 1 ? "" : "s"} (pool was not funded at accept time)…`,
                    );
                }
            }

            const entries = await Promise.all(
                acceptedNullifiers.map(async (nullifier) => {
                    try {
                        const state = await getAnonymousParticipantMilestoneState(
                            signer,
                            id,
                            nullifier,
                            milestones.length,
                        );
                        return state ? [nullifier, state] as const : null;
                    } catch {
                        return null;
                    }
                }),
            );
            setAnonymousMilestoneState((prev) => ({
                ...prev,
                ...Object.fromEntries(entries.filter(Boolean) as Array<
                    readonly [
                        string,
                        {
                            participant: string;
                            registered: boolean;
                            progress: number;
                            staged: boolean[];
                            confirmed: boolean[];
                            paid: boolean[];
                        },
                    ]
                >),
            }));
        }

        const phasePreview = getAnonymousPhaseAggregateState(index);
        if (index > 0 && phasePreview.total > 0 && phasePreview.promotedCount === 0) {
            setMilestoneStatus(
                `Cannot stage Phase ${index + 1}: promote participants to this phase first (use Promote P${index + 1} on the match card below).`,
            );
            return;
        }

        setReleasingPhaseIndex(index);
        setMilestoneStatus(`Initiating payout for Phase ${index + 1}...`);
        try {
            const result = await distributePartialMilestone(signer, id, index);
            let refreshedState: typeof anonymousMilestoneState = {};
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
                refreshedState = Object.fromEntries(
                    entries.filter(Boolean) as Array<
                        readonly [
                            string,
                            {
                                participant: string;
                                registered: boolean;
                                progress: number;
                                staged: boolean[];
                                confirmed: boolean[];
                                paid: boolean[];
                            },
                        ]
                    >,
                );
                setAnonymousMilestoneState(refreshedState);
            }

            const accepted = anonymousMatches.filter(
                (match) => match.applicationStatus === "Accepted" && match.nullifier,
            );
            const stagedAfter = accepted.filter((match) => {
                const state = refreshedState[match.nullifier!];
                return Boolean(state?.staged?.[index]);
            }).length;

            if (stagedAfter === 0) {
                const failureHint =
                    result.creditFailures.length > 0
                        ? ` Credit failures: ${result.creditFailures.map((f) => `${f.participant.slice(0, 10)}… (${f.reason})`).join("; ")}.`
                        : " No participant received a staged entitlement on-chain.";
                setMilestoneStatus(
                    `Phase ${index + 1} transaction confirmed, but 0/${phasePreview.total || accepted.length} participants were staged.${failureHint}`,
                );
                return;
            }

            if (result.creditFailures.length > 0) {
                const summary = result.creditFailures
                    .map((f) => `${f.participant.slice(0, 10)}… (${f.reason})`)
                    .join("; ");
                setMilestoneStatus(
                    `Phase ${index + 1} partially staged — ${stagedAfter} participant(s) staged; ${result.creditFailures.length} failed (${summary}).`,
                );
            } else {
                setMilestoneStatus(
                    `Success! Phase ${index + 1} entitlements staged for ${stagedAfter} participant(s) — they must confirmReceipt in My Applications.`,
                );
            }
            setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, distributed: true } : m)));
            await refreshProtocolData();
            await refreshAnonymousMilestoneState();
        } catch (err: any) {
            console.error(err);
            setMilestoneStatus(`Error: ${friendlyMilestoneDistributeError(err, index + 1)}`);
        } finally {
            setReleasingPhaseIndex(null);
        }
    };

    const handlePromoteAnonymous = async (nullifier: string, milestoneIndex: number, milestoneName: string) => {
        if (!signer || !id) {
            const msg = "Error: Connect your sponsor wallet to promote participants.";
            setDecisionStatus(msg);
            setMilestoneStatus(msg);
            return;
        }

        const key = promoteTargetKey("anon", nullifier, milestoneIndex);
        setPromotingKey(key);
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
            await refreshProtocolData();
        } catch (err: any) {
            console.error("Anonymous Promotion Error:", err);
            const raw = `${err.reason || ""} ${err.message || ""} ${err.shortMessage || ""}`.toLowerCase();
            if (raw.includes("must complete milestones in order")) {
                setDecisionStatus("Error: Promote earlier phases first. Milestones must be completed in order.");
            } else if (raw.includes("not a registered participant") || raw.includes("participant not registered")) {
                setDecisionStatus("Error: Participant is not in the reward pool yet. Accept/enroll them first.");
            } else if (raw.includes("milestone promotion authorization")) {
                setDecisionStatus(
                    "Error: Patient must sync milestone authorization from My Applications (same browser profile used to apply), then retry promotion."
                );
            } else if (raw.includes("already paid")) {
                setDecisionStatus(`Success! ${milestoneName} was already released.`);
            } else {
                setDecisionStatus(`Error: ${err.reason || err.message || "Promotion failed"}`);
            }
        } finally {
            setPromotingKey(null);
        }
    };

    const handlePromoteWallet = async (
        patientAddress: string,
        milestoneIndex: number,
        milestoneName: string,
    ) => {
        if (!signer || !id) {
            const msg = "Error: Connect your sponsor wallet to promote participants.";
            setDecisionStatus(msg);
            setMilestoneStatus(msg);
            return;
        }

        const key = promoteTargetKey("wallet", patientAddress, milestoneIndex);
        setPromotingKey(key);
        setDecisionStatus(`Promoting to ${milestoneName}...`);
        try {
            const result = await promoteParticipantAndDistribute(
                signer,
                id,
                patientAddress,
                milestoneIndex,
            );
            if (result.alreadyPaid) {
                setDecisionStatus(`Success! Reward for ${milestoneName} was already distributed.`);
            } else {
                setDecisionStatus(
                    `Success! Promoted to ${milestoneName}. Use Stage entitlements above to release this phase.`,
                );
            }
            await refetchMatches();
            await refreshProtocolData();
            await refreshAnonymousMilestoneState();
        } catch (err: any) {
            console.error("Promotion Error:", err);
            const reason = err.reason || err.message || "";
            if (reason.includes("Participant not registered")) {
                setDecisionStatus("Error: Participant not in reward pool. Fund trial and retry.");
            } else if (reason.toLowerCase().includes("must complete milestones in order")) {
                setDecisionStatus("Error: Promote earlier phases first. Milestones must be completed in order.");
            } else {
                setDecisionStatus(`Error: ${reason || "Promotion failed"}`);
            }
        } finally {
            setPromotingKey(null);
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

    const handlePruneUnconfirmed = async (index: number) => {
        if (!signer || !id) return;
        setMilestoneStatus(`Pruning unconfirmed slots for Phase ${index + 1}…`);
        try {
            await pruneUnconfirmedSlots(signer, id, index);
            setMilestoneStatus(`Success! Unconfirmed slots pruned for Phase ${index + 1}.`);
            await refreshAnonymousMilestoneState();
            await refreshProtocolData();
        } catch (err: any) {
            console.error(err);
            setMilestoneStatus(`Error: ${err.reason || err.message || "Prune failed"}`);
        }
    };

    const getAnonymousPhaseState = (nullifier: string | undefined, milestoneIndex: number) => {
        const state = nullifier ? anonymousMilestoneState[nullifier] : undefined;
        const promoted = !!state && state.progress >= milestoneIndex + 1;
        const staged = !!state?.staged?.[milestoneIndex];
        const released = !!(state?.confirmed?.[milestoneIndex] ?? state?.paid?.[milestoneIndex]);
        const priorSatisfied =
            milestoneIndex === 0 ||
            (() => {
                const prev = state
                    ? {
                          promoted: state.progress >= milestoneIndex,
                          staged: !!state.staged?.[milestoneIndex - 1],
                          released: !!(state.confirmed?.[milestoneIndex - 1] ?? state.paid?.[milestoneIndex - 1]),
                      }
                    : { promoted: false, staged: false, released: false };
                return prev.promoted || prev.staged || prev.released;
            })();
        return { promoted, staged, released, priorSatisfied, needsOnChainSync: (staged || released) && !promoted };
    };

    const getEffectiveProgress = (state: (typeof anonymousMilestoneState)[string] | undefined): number => {
        if (!state) return 0;
        let effective = state.progress;
        const limit = Math.max(state.staged?.length ?? 0, state.confirmed?.length ?? 0, milestones.length);
        for (let i = 0; i < limit; i++) {
            const paid = state.confirmed?.[i] || state.paid?.[i] || state.staged?.[i];
            if (paid && effective < i + 1) effective = i + 1;
        }
        return effective;
    };

    const getAnonymousPhaseAggregateState = (milestoneIndex: number) => {
        const accepted = anonymousMatches.filter(
            (match) => match.applicationStatus === "Accepted" && match.nullifier
        );
        const states = accepted
            .map((match) => anonymousMilestoneState[match.nullifier!])
            .filter(Boolean);
        const allKnown = accepted.length > 0 && states.length === accepted.length;
        const registeredCount = states.filter((state) => state.registered).length;
        const promotedCount = states.filter((state) => getEffectiveProgress(state) >= milestoneIndex + 1).length;
        const stagedCount = states.filter((state) => state.staged?.[milestoneIndex]).length;
        const releasedCount = states.filter((state) => state.confirmed?.[milestoneIndex] ?? state.paid?.[milestoneIndex]).length;

        return {
            total: accepted.length,
            allKnown,
            registeredCount,
            promotedCount,
            stagedCount,
            releasedCount,
            allRegistered: allKnown && registeredCount === accepted.length,
            allPromoted: allKnown && promotedCount === accepted.length,
            allStaged: allKnown && stagedCount === accepted.length,
            allReleased: allKnown && releasedCount === accepted.length,
        };
    };

    type PhaseRowTone = "idle" | "ready" | "promoted" | "staged" | "done" | "blocked" | "staging";

    type PhaseRowAction = "enroll" | "stage" | "none";

    const resolvePhaseRowUi = (
        idx: number,
        milestone: { name: string; distributed?: boolean },
        phase: ReturnType<typeof getAnonymousPhaseAggregateState>,
        isReleasing: boolean,
    ): {
        statusLabel: string;
        buttonLabel: string;
        buttonDisabled: boolean;
        action: PhaseRowAction;
        tone: PhaseRowTone;
        hint: string | null;
    } => {
        const onChainDone = Boolean(milestone.distributed) || (idx === 0 && poolInfo.distributed);

        if (isReleasing) {
            return {
                statusLabel: "Staging in progress",
                buttonLabel: "Staging…",
                buttonDisabled: true,
                action: "none",
                tone: "staging",
                hint: null,
            };
        }

        if (phase.total === 0) {
            if (onChainDone) {
                return {
                    statusLabel: "Already distributed",
                    buttonLabel: "Done",
                    buttonDisabled: true,
                    action: "none",
                    tone: "done",
                    hint:
                        idx === 0
                            ? "Initial screening entitlements were already released on-chain."
                            : `${milestone.name} was already distributed on-chain.`,
                };
            }
            return {
                statusLabel: "No enrolled participants",
                buttonLabel: "Stage entitlements",
                buttonDisabled: true,
                action: "none",
                tone: "idle",
                hint: "Accept participants before releasing milestone payouts.",
            };
        }

        if (phase.allReleased) {
            return {
                statusLabel: "All confirmed",
                buttonLabel: "Complete",
                buttonDisabled: true,
                action: "none",
                tone: "done",
                hint: `All ${phase.total} participant(s) confirmed receipt for ${milestone.name}.`,
            };
        }

        if (phase.releasedCount > 0) {
            return {
                statusLabel: `${phase.releasedCount}/${phase.total} confirmed`,
                buttonLabel: phase.stagedCount > phase.releasedCount ? "Awaiting confirm" : "Partially confirmed",
                buttonDisabled: true,
                action: "none",
                tone: "staged",
                hint: "Some participants still need to confirm receipt in My Applications.",
            };
        }

        if (phase.allStaged || (onChainDone && phase.stagedCount === phase.total)) {
            return {
                statusLabel: "Staged — awaiting confirm",
                buttonLabel: "Staged",
                buttonDisabled: true,
                action: "none",
                tone: "staged",
                hint: "Participants must confirm receipt before funds are finalized.",
            };
        }

        if (phase.stagedCount > 0) {
            return {
                statusLabel: `${phase.stagedCount}/${phase.total} staged`,
                buttonLabel: "Partially staged",
                buttonDisabled: true,
                action: "none",
                tone: "staged",
                hint: null,
            };
        }

        if (onChainDone && phase.stagedCount === 0) {
            return {
                statusLabel: "Already distributed",
                buttonLabel: "Done",
                buttonDisabled: true,
                action: "none",
                tone: "done",
                hint:
                    idx === 0
                        ? "Initial screening payout was already released (automation or prior distribution)."
                        : `${milestone.name} entitlements were already released on-chain.`,
            };
        }

        const trialEnded =
            poolInfo.reclaim.trialEnded ||
            Boolean(trial?.endTime && parseInt(trial.endTime, 10) <= Math.floor(Date.now() / 1000));

        if (idx === 0 && !trialEnded) {
            return {
                statusLabel: "Awaiting trial end",
                buttonLabel: "Stage after end",
                buttonDisabled: true,
                action: "none",
                tone: "blocked",
                hint: "Screening (Phase 1) entitlements can only be staged after the trial end date.",
            };
        }

        if (phase.allKnown && phase.registeredCount < phase.total) {
            return {
                statusLabel: `${phase.registeredCount}/${phase.total} in reward pool`,
                buttonLabel: "Enroll participants",
                buttonDisabled: false,
                action: "enroll",
                tone: "blocked",
                hint: "Accepted patients must be enrolled in the incentive pool before staging payouts.",
            };
        }

        if (idx > 0 && phase.promotedCount === 0) {
            return {
                statusLabel: "Awaiting promotion",
                buttonLabel: "Promote first",
                buttonDisabled: true,
                action: "none",
                tone: "blocked",
                hint: `Promote participants to ${milestone.name} before staging entitlements.`,
            };
        }

        if (phase.allPromoted) {
            return {
                statusLabel: `All ${phase.total} promoted`,
                buttonLabel: "Stage entitlements",
                buttonDisabled: false,
                action: "stage",
                tone: "ready",
                hint: null,
            };
        }

        if (phase.promotedCount > 0) {
            return {
                statusLabel: `${phase.promotedCount}/${phase.total} promoted`,
                buttonLabel: "Stage entitlements",
                buttonDisabled: false,
                action: "stage",
                tone: "promoted",
                hint: "You can stage now; remaining participants can be promoted later.",
            };
        }

        if (idx === 0 && phase.registeredCount === phase.total) {
            return {
                statusLabel: "Ready for screening payout",
                buttonLabel: "Stage entitlements",
                buttonDisabled: false,
                action: "stage",
                tone: "ready",
                hint: null,
            };
        }

        return {
            statusLabel: "Ready",
            buttonLabel: "Stage entitlements",
            buttonDisabled: false,
            action: "stage",
            tone: "idle",
            hint: null,
        };
    };

    const getParticipantPhaseUi = (
        mIdx: number,
        nullifier: string | undefined,
    ): { label: string; sublabel: string; disabled: boolean; tone: "locked" | "action" | "promoted" | "staged" | "released" } => {
        const phase = getAnonymousPhaseState(nullifier, mIdx);
        const prevSatisfied = mIdx === 0 || getAnonymousPhaseState(nullifier, mIdx - 1).priorSatisfied;

        if (!prevSatisfied) {
            return { label: `P${mIdx + 1} locked`, sublabel: "Complete prior phase", disabled: true, tone: "locked" };
        }
        if (phase.needsOnChainSync) {
            return {
                label: `Sync P${mIdx + 1}`,
                sublabel: "Confirm on-chain",
                disabled: false,
                tone: "action",
            };
        }
        if (phase.released) {
            return { label: `P${mIdx + 1} released`, sublabel: "Funds confirmed", disabled: true, tone: "released" };
        }
        if (phase.staged) {
            return { label: `P${mIdx + 1} staged`, sublabel: "Awaiting confirm", disabled: true, tone: "staged" };
        }
        if (phase.promoted) {
            return { label: `P${mIdx + 1} promoted`, sublabel: "Ready for release", disabled: true, tone: "promoted" };
        }
        return { label: `Promote P${mIdx + 1}`, sublabel: "Not started", disabled: false, tone: "action" };
    };

    const getWalletParticipantPhaseUi = (
        mIdx: number,
        progress: number,
    ): {
        label: string;
        sublabel: string;
        disabled: boolean;
        tone: "locked" | "action" | "promoted";
    } => {
        const prevDone = mIdx === 0 || progress >= mIdx;
        if (!prevDone) {
            return { label: `P${mIdx + 1} locked`, sublabel: "Complete prior phase", disabled: true, tone: "locked" };
        }
        if (progress >= mIdx + 1) {
            return {
                label: `P${mIdx + 1} promoted`,
                sublabel: progress === mIdx + 1 ? "Current phase" : "Complete",
                disabled: true,
                tone: "promoted",
            };
        }
        return { label: `Promote P${mIdx + 1}`, sublabel: "Not started", disabled: false, tone: "action" };
    };

    const phaseToneClasses: Record<PhaseRowTone, { badge: string; icon: string; button: string }> = {
        idle: {
            badge: "bg-slate-100 text-slate-600",
            icon: "bg-slate-100 text-slate-500",
            button: "bg-slate-100 text-slate-800 border-slate-200",
        },
        ready: {
            badge: "bg-sky-100 text-sky-700",
            icon: "bg-sky-100 text-sky-700",
            button: "bg-sky-600 text-white border-sky-600 hover:bg-sky-700",
        },
        promoted: {
            badge: "bg-teal-100 text-teal-700",
            icon: "bg-teal-100 text-teal-700",
            button: "bg-teal-600 text-white border-teal-600",
        },
        staged: {
            badge: "bg-amber-100 text-amber-800",
            icon: "bg-amber-100 text-amber-700",
            button: "border-amber-200 bg-amber-50 text-amber-800",
        },
        done: {
            badge: "bg-emerald-100 text-emerald-700",
            icon: "bg-emerald-100 text-emerald-600",
            button: "border-emerald-200 bg-emerald-50 text-emerald-800",
        },
        blocked: {
            badge: "bg-orange-100 text-orange-800",
            icon: "bg-orange-100 text-orange-700",
            button: "border-orange-200 bg-orange-50 text-orange-800",
        },
        staging: {
            badge: "bg-violet-100 text-violet-700",
            icon: "bg-violet-100 text-violet-700",
            button: "border-violet-200 bg-violet-50 text-violet-800",
        },
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
                                <Badge variant="outline" className={poolInfo.distributed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600"}>
                                    {poolInfo.distributed ? "Screening distributed" : "Accumulating"}
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
                                        <div className="flex items-center justify-between gap-3">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Active Phased Payouts</h4>
                                            {(protocolRefreshing || anonymousStateLoading) && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Syncing on-chain status…
                                                </span>
                                            )}
                                        </div>
                                        {poolInfo.distributed && (
                                            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[10px] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                                                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>
                                                    Initial screening entitlements have already been distributed on-chain.
                                                    Later phases still require promotion and staging.
                                                </span>
                                            </div>
                                        )}
                                        <div className="grid gap-3">
                                            {milestones.map((m, idx) => {
                                                const phase = getAnonymousPhaseAggregateState(idx);
                                                const isReleasing = releasingPhaseIndex === idx;
                                                const rowUi = resolvePhaseRowUi(idx, m, phase, isReleasing);
                                                const tones = phaseToneClasses[rowUi.tone];
                                                const showPrune =
                                                    rowUi.tone === "staged" &&
                                                    phase.stagedCount > 0 &&
                                                    !phase.allReleased;

                                                return (
                                                    <div key={idx} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            <div className={cn(
                                                                "h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0",
                                                                tones.icon,
                                                            )}>
                                                                {rowUi.tone === "done" ? <Check className="h-4 w-4" /> : idx + 1}
                                                            </div>
                                                            <div className="min-w-0 space-y-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</p>
                                                                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border-0", tones.badge)}>
                                                                        {rowUi.statusLabel}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 uppercase font-mono">{m.weightBps / 100}% Reward Weight</p>
                                                                {phase.total > 0 && (
                                                                    <p className="text-[10px] text-slate-500">
                                                                        {phase.registeredCount}/{phase.total} enrolled · {phase.promotedCount}/{phase.total} promoted · {phase.stagedCount}/{phase.total} staged · {phase.releasedCount}/{phase.total} confirmed
                                                                    </p>
                                                                )}
                                                                {rowUi.hint && (
                                                                    <p className="text-[10px] text-slate-500 leading-relaxed">{rowUi.hint}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={rowUi.buttonDisabled}
                                                            onClick={() => {
                                                                if (rowUi.action === "enroll") {
                                                                    void handleEnrollParticipants();
                                                                } else if (rowUi.action === "stage") {
                                                                    void handleDistributePartial(idx);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "h-8 min-w-[7.5rem] text-[10px] font-bold uppercase disabled:opacity-100",
                                                                rowUi.buttonDisabled ? tones.button : rowUi.action === "enroll" ? "bg-orange-600 text-white border-orange-600 hover:bg-orange-700" : "bg-sky-600 text-white border-sky-600 hover:bg-sky-700",
                                                            )}
                                                        >
                                                            {isReleasing ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                    {rowUi.buttonLabel}
                                                                </span>
                                                            ) : (
                                                                rowUi.buttonLabel
                                                            )}
                                                        </Button>
                                                        {showPrune && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-[9px] font-bold uppercase text-slate-500"
                                                                onClick={() => void handlePruneUnconfirmed(idx)}
                                                            >
                                                                Prune unconfirmed
                                                            </Button>
                                                        )}
                                                        </div>
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

                                {showReclaimBlockedUnverified && (
                                    <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed px-1 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 bg-amber-50/80 dark:bg-amber-950/30">
                                        This sponsor wallet is no longer verified on the registry. Distribution and
                                        sponsor reclaim are blocked on-chain. The protocol owner can recover the
                                        remaining pool via{" "}
                                        <span className="font-mono">reclaimAbandonedToOwner</span> after the trial
                                        grace period.
                                    </p>
                                )}

                                {showReclaimBlockedInfo && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                                        Run screening distribution (or wait for automation) before reclaiming the
                                        remaining balance.
                                    </p>
                                )}

                                {showReclaimPanel && (
                                    <div
                                        className={cn(
                                            "p-4 rounded-xl border space-y-3",
                                            "border-violet-200 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-950/30",
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <ShieldAlert className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                                            <div className="space-y-1 min-w-0">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                                                    Schedule reclaim (two-step)
                                                </h4>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    {reclaim.participantCount === 0
                                                        ? "This trial ended with no enrolled participants. Schedule recovery of the prize pool, then claim ETH in a second transaction."
                                                        : "After screening payouts, schedule return of any remaining pool balance, then claim to your wallet."}
                                                </p>
                                            </div>
                                        </div>
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
                                                Schedule reclaim
                                            </Button>
                                        </div>
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

                                {showPendingReclaimPanel && (
                                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Coins className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="space-y-1 min-w-0">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                                                    Pending reclaim
                                                </h4>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    {reclaim.pendingReclaimEth} ETH is scheduled for{" "}
                                                    <span className="font-mono">
                                                        {reclaim.pendingReclaimRecipient?.slice(0, 10)}…
                                                    </span>
                                                    . {canClaimPendingReclaim
                                                        ? "You can claim it now."
                                                        : "Only the designated recipient can claim."}
                                                </p>
                                            </div>
                                        </div>
                                        {canClaimPendingReclaim && (
                                            <Button
                                                onClick={handleClaimReclaimed}
                                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                                            >
                                                Claim reclaimed ETH
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {reclaim.reclaimFinalized &&
                                    !showPendingReclaimPanel &&
                                    parseFloat(poolInfo.totalFunded) > 0 && (
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                        <Check className="h-3.5 w-3.5" />
                                        Reclaim finalized
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
                                {decisionStatus && (
                                    <p className={cn(
                                        "text-[10px] font-bold uppercase italic px-1",
                                        decisionStatus.startsWith("Error") ? "text-rose-500" : "text-indigo-500",
                                    )}>
                                        {decisionStatus.includes("Promoting") ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" /> {decisionStatus}
                                            </span>
                                        ) : decisionStatus.startsWith("Success") ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Check className="h-3 w-3" /> {decisionStatus}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1">
                                                <ShieldAlert className="h-3 w-3" /> {decisionStatus}
                                            </span>
                                        )}
                                    </p>
                                )}
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
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                                            Participant milestone progress
                                                        </p>
                                                        {anonymousStateLoading && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                Syncing
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {milestones.map((m, mIdx) => {
                                                            const ui = getParticipantPhaseUi(mIdx, match.nullifier);
                                                            const isPromoting =
                                                                promotingKey === promoteTargetKey("anon", match.nullifier!, mIdx);
                                                            const toneClass =
                                                                ui.tone === "released"
                                                                    ? "bg-emerald-600 text-white border-emerald-600"
                                                                    : ui.tone === "staged"
                                                                        ? "bg-amber-500 text-white border-amber-500"
                                                                        : ui.tone === "promoted"
                                                                            ? "bg-teal-600 text-white border-teal-600"
                                                                            : ui.tone === "locked"
                                                                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                                                                : "bg-white/80";
                                                            return (
                                                                <Button
                                                                    key={`${match.id}-${mIdx}`}
                                                                    size="sm"
                                                                    variant={ui.tone === "action" ? "outline" : "default"}
                                                                    onClick={() => handlePromoteAnonymous(match.nullifier!, mIdx, m.name)}
                                                                    disabled={ui.disabled || isPromoting}
                                                                    className={cn(
                                                                        "h-11 text-[9px] font-bold flex flex-col gap-0.5 disabled:opacity-100",
                                                                        toneClass,
                                                                    )}
                                                                >
                                                                    <span className="inline-flex items-center gap-1">
                                                                        {isPromoting ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : ui.tone === "released" || ui.tone === "promoted" ? (
                                                                            <Check className="h-3 w-3" />
                                                                        ) : null}
                                                                        {isPromoting ? "Promoting…" : ui.label}
                                                                    </span>
                                                                    <span className="opacity-80 truncate max-w-full font-normal">{m.name}</span>
                                                                    <span className="opacity-60 text-[8px] font-normal">{ui.sublabel}</span>
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
                            ) : trialMatches.length === 0 && anonymousMatches.length === 0 ? (
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
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-accent hover:text-accent"
                                                                    onClick={() => setSelectedMatch(selectedMatch === match.patientAddress ? null : match.patientAddress)}
                                                                >
                                                                    <TrendingUp className="h-3.5 w-3.5" />
                                                                    Promote
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
                                                                    {milestones.map((m, mIdx) => {
                                                                        const ui = getWalletParticipantPhaseUi(mIdx, match.currentMilestone || 0);
                                                                        const isPromoting =
                                                                            promotingKey === promoteTargetKey("wallet", match.patientAddress, mIdx);
                                                                        return (
                                                                        <Button
                                                                            key={mIdx}
                                                                            size="sm"
                                                                            variant={ui.tone === "action" ? "outline" : "default"}
                                                                            disabled={ui.disabled || isPromoting}
                                                                            className={cn(
                                                                                "h-10 text-[9px] font-bold flex flex-col gap-0.5 disabled:opacity-100",
                                                                                ui.tone === "promoted"
                                                                                    ? "bg-emerald-600 text-white border-emerald-600"
                                                                                    : ui.tone === "locked"
                                                                                        ? "bg-slate-100 text-slate-400 border-slate-200"
                                                                                        : "",
                                                                                (match.currentMilestone || 0) === mIdx + 1 && "ring-1 ring-emerald-500"
                                                                            )}
                                                                            onClick={() => void handlePromoteWallet(match.patientAddress, mIdx, m.name)}
                                                                        >
                                                                            <span className="inline-flex items-center gap-1">
                                                                                {isPromoting ? (
                                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                                ) : ui.tone === "promoted" ? (
                                                                                    <Check className="h-3 w-3" />
                                                                                ) : null}
                                                                                {isPromoting ? "Promoting…" : ui.label}
                                                                            </span>
                                                                            <span className="opacity-50 text-[7px] truncate w-full">{m.name}</span>
                                                                        </Button>
                                                                        );
                                                                    })}
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
