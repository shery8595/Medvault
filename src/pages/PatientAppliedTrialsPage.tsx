import { useState, useEffect, useRef, type ComponentType } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import {
    Sparkles,
    FlaskConical,
    ArrowRight,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    DollarSign,
    ShieldCheck,
    Loader2,
    Coins,
    ArrowUpRight,
    MessageSquare,
    ChevronRight,
    Eye,
    AlertTriangle,
    Gift,
} from "lucide-react";
import { ClaimModal } from "../components/ClaimModal";
import { PatientConnectPrompt } from "../components/dashboard/PatientConnectPrompt";
import { motion, AnimatePresence } from "framer-motion";
import { useTrials } from "../hooks/useTrials";
import { useWeb3 } from "../lib/Web3Context";
import { useEncryptedData } from "../lib/EncryptedDataContext";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import {
    getContractAddressForChain
} from "../lib/contracts";
import { forceConnectFHE, reencryptUint8, resetFheClient } from "../lib/fhe";
import { Trial } from "../types";
import { resolveAnonymousNullifier, getStoredIdentity, getEphemeralSigner } from "../lib/semaphore";
import {
    getEncryptedScoreHandle,
    getMilestonesAndProgress,
    registerAnonymousParticipantByNullifier,
} from "../lib/contracts/sponsorAdapters";

/* ─── Status Configuration ─── */
const statusConfig = {
    Pending: {
        color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        dot: "bg-amber-500",
        icon: Clock,
        label: "Pending Review",
    },
    Accepted: {
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        dot: "bg-emerald-500",
        icon: CheckCircle,
        label: "Accepted",
    },
    Rejected: {
        color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        dot: "bg-rose-500",
        icon: XCircle,
        label: "Rejected",
    },
};

/* ─── Stats Card ─── */
function StatsCard({ value, label, icon: Icon, color }: { value: number; label: string; icon: ComponentType<{ className?: string }>; color: string }) {
    return (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className={cn("p-3 rounded-xl", color)}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
            </div>
        </div>
    );
}

/* ─── Application Row ─── */
function ApplicationRow({ trial, index }: { trial: Trial; index: number }) {
    const { signer, account } = useWeb3();
    const { setRevealedScore, getRevealedScore } = useEncryptedData();
    const [decryptedScore, setDecryptedScore] = useState<number | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [poolFunded, setPoolFunded] = useState(false);
    const [incentiveStatus, setIncentiveStatus] = useState<string | null>(null);
    const [showMessage, setShowMessage] = useState(false);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [currentProgress, setCurrentProgress] = useState<number>(-1); // -1 means none
    const [milestonesLoading, setMilestonesLoading] = useState(false);
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [decryptError, setDecryptError] = useState<string | null>(null);
    const autoEnrollAttemptedRef = useRef(false);

    const status = trial.applicationStatus || "Pending";
    const engineAddress = getContractAddressForChain("EligibilityEngine");
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Pending;
    const StatusIcon = config.icon;

    const hasEnded = trial.endTime && parseInt(trial.endTime) <= Math.floor(Date.now() / 1000);
    const payoutShareWei = trial.incentivePool?.shareWei ? BigInt(trial.incentivePool.shareWei) : 0n;
    const canCheckPayout = poolFunded && status === "Accepted" && isRegistered;

    useEffect(() => {
        setPoolFunded(Boolean(trial.rewardPoolFunded || BigInt(trial.incentivePool?.totalFundedWei || "0") > 0n));
        setIsRegistered((prev) => prev || Boolean(trial.rewardParticipantRegistered));
    }, [trial.rewardPoolFunded, trial.rewardParticipantRegistered, trial.incentivePool?.totalFundedWei]);

    // Load score from store
    useEffect(() => {
        if (account && trial.id) {
            if (!engineAddress) return;
            const score = getRevealedScore(engineAddress, trial.id);
            setDecryptedScore(score);
        }
    }, [account, trial.id, getRevealedScore, engineAddress]);

    const handleRevealScore = async () => {
        if (!signer || !account) return;
        setDecryptError(null);
        setIsDecrypting(true);
        try {
            const handle = await getEncryptedScoreHandle(
                signer,
                account,
                trial.id,
                trial.nullifier ?? undefined
            );
            if (handle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                setDecryptedScore(0);
                if (engineAddress) setRevealedScore(engineAddress, trial.id, 0);
                return;
            }
            if (!engineAddress) return;

            if (trial.nullifier) {
                const identity = getStoredIdentity();
                if (!identity) {
                    throw new Error(
                        "Semaphore identity not found in this browser. Use the same profile you used when you applied anonymously."
                    );
                }
                if (!signer.provider) {
                    throw new Error("Wallet provider unavailable.");
                }
                const ephemeralSigner = getEphemeralSigner(identity, signer.provider);
                await forceConnectFHE(signer.provider, ephemeralSigner);
                try {
                    const score = await reencryptUint8(
                        engineAddress,
                        await ephemeralSigner.getAddress(),
                        handle
                    );
                    const scoreNum = Number(score);
                    setDecryptedScore(scoreNum);
                    setRevealedScore(engineAddress, trial.id, scoreNum);
                } finally {
                    resetFheClient();
                }
            } else {
                const score = await reencryptUint8(engineAddress, account, handle);
                const scoreNum = Number(score);
                setDecryptedScore(scoreNum);
                setRevealedScore(engineAddress, trial.id, scoreNum);
            }
        } catch (err: unknown) {
            console.error("Decryption failed:", err);
            setDecryptError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleRegisterForRewards = async () => {
        if (!signer || !account || !trial.id) return;
        setIsRegistering(true);
        setIncentiveStatus("Registering...");
        try {
            if (!signer.provider) {
                throw new Error("Wallet provider unavailable. Please reconnect and retry.");
            }
            const nullifier = await resolveAnonymousNullifier(signer.provider, BigInt(trial.id));
            if (!nullifier) {
                throw new Error("Missing anonymous application nullifier for this trial. Re-open the browser profile used during apply and retry.");
            }
            await registerAnonymousParticipantByNullifier(signer, trial.id, nullifier);
            setIsRegistered(true);
            setIncentiveStatus("Registered!");
        } catch (err: any) {
            console.error("Registration failed:", err);
            setIncentiveStatus(`Failed: ${err.reason || err.message}`);
        } finally {
            setIsRegistering(false);
        }
    };

    useEffect(() => {
        if (!signer || !account || !trial.id) return;
        if (status !== "Accepted") return;
        if (!poolFunded || isRegistered || isRegistering) return;
        if (autoEnrollAttemptedRef.current) return;

        autoEnrollAttemptedRef.current = true;
        setIncentiveStatus("Accepted! Auto-enrolling...");
        void handleRegisterForRewards();
    }, [signer, account, trial.id, status, poolFunded, isRegistered, isRegistering]);

    // Check milestones and progress
    useEffect(() => {
        const fetchProgress = async () => {
            if (!signer || !trial.id) return;
            setMilestonesLoading(true);
            try {
                const { rawMilestones, progress } = await getMilestonesAndProgress(signer, trial.id, account || undefined);
                setMilestones(rawMilestones || []);

                if (account && progress) {
                    // Progress is [lastCompletedIndex, isActive]
                    // We only care about lastCompletedIndex if it's > -1
                    // Wait, TrialMilestoneManager.sol:getParticipantProgress returns (uint256, bool)
                    // If not registered, it might return 0 but bool false.
                    // Actually let's just use the index if bool is true or even if false (default 0)
                    // But we need to know if they actually STARTED.
                    // If they are in the incentive pool, they started.
                    setCurrentProgress(Number(progress[0]));
                }
            } catch (err) {
                console.error("Error fetching progress:", err);
            } finally {
                setMilestonesLoading(false);
            }
        };
        fetchProgress();
    }, [signer, trial.id, account, isRegistered]);

    // Decode sponsor message (hex → text)
    const decodedMessage = (() => {
        if (!trial.applicationMessage) return null;
        try {
            if (trial.applicationMessage.startsWith("0x")) {
                const hex = trial.applicationMessage.slice(2);
                let str = "";
                for (let i = 0; i < hex.length; i += 2) {
                    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                }
                return str;
            }
            return trial.applicationMessage;
        } catch {
            return trial.applicationMessage;
        }
    })();

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="group relative rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.07)] transition-all duration-300 overflow-hidden">

                {/* ── Main Row ── */}
                <div className="flex flex-col lg:flex-row">

                    {/* ── Left: Trial Info ── */}
                    <div className="flex-1 p-6 space-y-4">
                        {/* Top badges row */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn("font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 border", config.color)}>
                                <StatusIcon className="h-3 w-3 mr-1.5" />
                                {config.label}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 bg-slate-50 border-slate-200 text-slate-600">
                                {trial.phase.toUpperCase().startsWith("PHASE") ? trial.phase : `Phase ${trial.phase}`}
                            </Badge>
                            {hasEnded && (
                                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 bg-rose-50 text-rose-600 border-rose-100">
                                    Trial Ended
                                </Badge>
                            )}
                            {poolFunded && (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-1 text-[10px]">
                                    <Coins className="h-3 w-3" /> Reward Pool
                                </Badge>
                            )}
                        </div>

                        {/* Title & sponsor */}
                        <div>
                            <h3 className="text-lg font-display font-bold tracking-tight text-slate-900">
                                {trial.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {trial.sponsor.name.startsWith("0x")
                                    ? `${trial.sponsor.name.slice(0, 6)}...${trial.sponsor.name.slice(-4)}`
                                    : trial.sponsor.name}
                            </p>
                        </div>

                        {/* Quick stats row */}
                        <div className="flex flex-wrap gap-2.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                                <span className="text-xs font-bold text-slate-700">{trial.location}</span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-800">{trial.compensation}</span>
                            </div>
                            {!hasEnded && trial.endTime && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100">
                                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-800">
                                        {(() => {
                                            const secondsLeft = parseInt(trial.endTime) - Math.floor(Date.now() / 1000);
                                            if (secondsLeft > 86400) return `${Math.ceil(secondsLeft / 86400)} days left`;
                                            if (secondsLeft > 3600) return `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m`;
                                            return `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`;
                                        })()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Center: Score & Eligibility ── */}
                    <div className="lg:w-48 p-6 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-100 bg-slate-50/50">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Eligibility</p>
                        {decryptedScore !== null ? (
                            <div className="text-center">
                                <span className={cn(
                                    "text-3xl font-black leading-none",
                                    decryptedScore === 100
                                        ? "text-emerald-500"
                                        : decryptedScore >= 70
                                            ? "text-amber-500"
                                            : "text-rose-500"
                                )}>
                                    {decryptedScore}
                                </span>
                                <span className="text-sm font-bold text-slate-400">%</span>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full mt-3 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${decryptedScore}%` }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        className={cn(
                                            "h-full rounded-full",
                                            decryptedScore === 100
                                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                : decryptedScore >= 70
                                                    ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                                    : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                                        )}
                                    />
                                </div>
                            </div>
                        ) : trial.hasComputed ? (
                            <div className="space-y-3 text-center w-full">
                                <div className="flex items-center justify-center gap-1">
                                    <ShieldCheck className="h-4 w-4 text-teal-600" />
                                    <span className="text-xs font-bold text-teal-700">Encrypted</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="w-full text-[10px] font-bold uppercase tracking-wider bg-teal-600 hover:bg-teal-500 text-white border-0 h-8 rounded-xl"
                                    onClick={handleRevealScore}
                                    disabled={isDecrypting}
                                >
                                    {isDecrypting ? (
                                        <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Decrypting…</>
                                    ) : (
                                        <><Eye className="h-3 w-3 mr-1" /> Decrypt eligibility</>
                                    )}
                                </Button>
                                {decryptError && (
                                    <p className="text-[9px] font-medium text-rose-600 text-center leading-snug mt-1 px-1">
                                        {decryptError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <span className="text-sm font-bold text-slate-400">—</span>
                        )}
                    </div>

                    {/* ── Right: Actions ── */}
                    <div className="lg:w-56 p-6 flex flex-col gap-3 justify-center border-t lg:border-t-0 lg:border-l border-slate-100 bg-white">
                        {/* Incentive action */}
                        {poolFunded && status === "Accepted" && !trial.incentivePool?.distributed && !isRegistered && (
                            <Button
                                size="sm"
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider h-9 gap-1.5 shadow-lg shadow-amber-500/20"
                                onClick={handleRegisterForRewards}
                                disabled={isRegistering}
                            >
                                {isRegistering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
                                {isRegistering ? "Registering..." : "Join Reward Pool"}
                            </Button>
                        )}

                        {canCheckPayout && (
                            <Button
                                size="sm"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider h-9 gap-1.5 shadow-lg shadow-emerald-500/20"
                                onClick={() => setIsClaimModalOpen(true)}
                            >
                                <Gift className="h-3 w-3" />
                                {payoutShareWei > 0n ? "Move / Stake Funds" : "Check / Move Funds"}
                            </Button>
                        )}

                        {/* Sponsor message toggle */}
                        {decodedMessage && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full font-bold rounded-xl text-[10px] uppercase tracking-wider h-9 gap-1.5"
                                onClick={() => setShowMessage(!showMessage)}
                            >
                                <MessageSquare className="h-3 w-3" /> {showMessage ? "Hide Message" : "Sponsor Message"}
                            </Button>
                        )}

                        {/* View trial details link */}
                        <Link to="/patient/find-trials">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="w-full font-medium rounded-xl text-[10px] uppercase tracking-wider h-9 gap-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                            >
                                View Trial <ChevronRight className="h-3 w-3" />
                            </Button>
                        </Link>

                        {incentiveStatus && (
                            <p className={cn("text-[9px] font-bold text-center", incentiveStatus.includes("Failed") ? "text-rose-500" : "text-emerald-500")}>
                                {incentiveStatus}
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Trial Progress (Phase 1.1) ── */}
                {status === "Accepted" && milestones.length > 0 && (
                    <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/60">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-teal-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trial Journey & Milestones</h4>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                {currentProgress + 1} / {milestones.length} Completed
                            </span>
                        </div>

                        <div className="relative flex justify-between items-center px-2">
                            {/* Connector Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 -z-0" />
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentProgress + 1) / (milestones.length - 1 || 1)) * 100}%` }}
                                className="absolute top-1/2 left-0 h-0.5 bg-teal-500 -translate-y-1/2 -z-0"
                            />

                            {milestones.map((m, idx) => {
                                const isCompleted = idx <= currentProgress;
                                const isCurrent = idx === currentProgress + 1;
                                return (
                                    <div key={idx} className="relative z-10 flex flex-col items-center">
                                        <div className={cn(
                                            "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                                            isCompleted
                                                ? "bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-600/25"
                                                : isCurrent
                                                    ? "bg-white border-teal-500 text-teal-600 animate-pulse"
                                                    : "bg-white border-slate-200 text-slate-400"
                                        )}>
                                            {isCompleted ? <CheckCircle className="h-4 w-4" /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                                        </div>
                                        <div className="absolute -bottom-6 w-24 text-center">
                                            <p className={cn(
                                                "text-[9px] font-bold uppercase tracking-tight truncate",
                                                isCompleted ? "text-teal-700" : "text-slate-400"
                                            )}>
                                                {m.name}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="h-4" /> {/* Spacer for labels */}
                    </div>
                )}

                {/* ── Sponsor Message Expandable ── */}
                <AnimatePresence>
                    {showMessage && decodedMessage && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className={cn(
                                "px-6 py-4 border-t text-sm",
                                status === "Accepted"
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                                    : status === "Rejected"
                                        ? "bg-rose-50 border-rose-100 text-rose-800"
                                        : "bg-slate-50 border-slate-100 text-slate-700"
                            )}>
                                <div className="flex items-start gap-3">
                                    <MessageSquare className="h-4 w-4 mt-0.5 opacity-60 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Sponsor Message</p>
                                        <p className="leading-relaxed font-medium">{decodedMessage}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ClaimModal
                isOpen={isClaimModalOpen}
                onClose={() => setIsClaimModalOpen(false)}
                trialId={trial.id}
                nullifier={trial.nullifier}
            />
        </motion.div>
    );
}

/* ─── Main Page ─── */
export function PatientAppliedTrialsPage() {
    const { account } = useWeb3();
    const { trials, loading } = useTrials(account || undefined);
    const isConnected = Boolean(account);
    const [filter, setFilter] = useState<"all" | "Pending" | "Accepted" | "Rejected">("all");

    if (!isConnected) {
        return (
            <div className="mx-auto max-w-6xl space-y-8 pb-8">
                <SectionTopBar title="My Applications" />
                <p className="-mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Track every trial you&apos;ve applied to — status updates, sponsor messages, and reward registration in one place.
                </p>
                <PatientConnectPrompt
                    title="Connect to view your applications"
                    description="Application status, sponsor messages, and rewards are tied to your connected wallet and local anonymous session."
                />
            </div>
        );
    }

    const appliedTrials = trials.filter(t => t.applicationStatus != null);
    const pending = appliedTrials.filter(t => t.applicationStatus === "Pending").length;
    const accepted = appliedTrials.filter(t => t.applicationStatus === "Accepted").length;
    const rejected = appliedTrials.filter(t => t.applicationStatus === "Rejected").length;

    const filteredTrials = filter === "all" ? appliedTrials : appliedTrials.filter(t => t.applicationStatus === filter);

    const filterTabs = [
        { id: "all", label: "All", count: appliedTrials.length },
        { id: "Pending", label: "Pending", count: pending },
        { id: "Accepted", label: "Accepted", count: accepted },
        { id: "Rejected", label: "Rejected", count: rejected },
    ];

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-8">
            <SectionTopBar
                title="My Applications"
                rightContent={
                    <div className="flex items-center gap-4">
                        <Link
                            to="/patient/results"
                            className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800 transition-colors hidden sm:inline"
                        >
                            Clinical results
                        </Link>
                        <Link to="/patient/find-trials">
                            <Button variant="outline" className="gap-2 rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm">
                                <FlaskConical className="h-4 w-4 text-teal-600" /> Find trials
                            </Button>
                        </Link>
                    </div>
                }
            />

            <p className="text-slate-500 text-sm leading-relaxed max-w-2xl -mt-2">
                Track every trial you&apos;ve applied to — status updates, sponsor messages, and reward registration in one place.
            </p>

            {loading && trials.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full border-t-2 border-r-2 border-teal-500 animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-teal-600 animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Loading applications…</p>
                </div>
            ) : appliedTrials.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white shadow-sm border border-slate-200 mb-4">
                        <FlaskConical className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-lg mb-1">No applications yet</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mb-6 text-sm">
                        You haven&apos;t applied to any clinical trials yet. Find a match to get started.
                    </p>
                    <Link to="/patient/find-trials">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-md shadow-teal-900/10 transition-all hover:from-teal-500 hover:to-emerald-500"
                        >
                            Browse trials
                            <ArrowRight className="h-4 w-4" />
                        </motion.button>
                    </Link>
                </div>
            ) : (
                <>
                    {/* ── Stats Row ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard value={appliedTrials.length} label="Total Applications" icon={FlaskConical} color="bg-teal-50 text-teal-700" />
                        <StatsCard value={pending} label="Pending Review" icon={Clock} color="bg-amber-50 text-amber-600" />
                        <StatsCard value={accepted} label="Accepted" icon={CheckCircle} color="bg-emerald-50 text-emerald-600" />
                        <StatsCard value={rejected} label="Rejected" icon={XCircle} color="bg-rose-50 text-rose-600" />
                    </div>

                    {/* ── Filter tabs (underline, matches find-trials) ── */}
                    <nav className="flex flex-wrap items-stretch gap-0 border-b border-slate-200" aria-label="Filter applications">
                        {filterTabs.map((tab) => {
                            const isActive = filter === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setFilter(tab.id as "all" | "Pending" | "Accepted" | "Rejected")}
                                    className={cn(
                                        "relative flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium transition-colors -mb-px border-b-2",
                                        "first:pl-0 sm:first:pl-1",
                                        isActive
                                            ? "border-teal-600 text-slate-900"
                                            : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
                                    )}
                                >
                                    {tab.label}
                                    <span
                                        className={cn(
                                            "tabular-nums text-xs px-1.5 py-0.5 rounded-md",
                                            isActive ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-500"
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* ── Application List ── */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={filter}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-4"
                        >
                            {filteredTrials.map((trial, i) => (
                                <ApplicationRow key={trial.id} trial={trial} index={i} />
                            ))}
                            {filteredTrials.length === 0 && (
                                <div className="py-16 text-center text-slate-500 rounded-2xl border border-dashed border-slate-200 bg-slate-50/30">
                                    <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500/80" />
                                    <p className="font-medium text-sm">No {filter.toLowerCase()} applications in this view.</p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
