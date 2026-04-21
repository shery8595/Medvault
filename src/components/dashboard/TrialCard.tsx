import { Trial } from "../../types";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Progress } from "../ui/Progress";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  DollarSign,
  Clock,
  ShieldCheck,
  Loader2,
  Coins,
  TrendingUp,
  Unlock,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { Link } from "react-router-dom";
import { useWeb3 } from "../../lib/Web3Context";
import { getConsentManager, getEligibilityEngine, getSponsorIncentiveVault } from "../../lib/contracts";
import { CONSENT_DURATION_OPTIONS, DEFAULT_CONSENT_DURATION_SECONDS } from "../../lib/consentPolicy";
import { useEncryptedData } from "../../lib/EncryptedDataContext";

import { reencryptUint8, getFHEClient } from "../../lib/fhe";
import addresses from "../../lib/contracts/addresses.json";
import { EncryptionAnimation } from "../ui/EncryptionAnimation";

interface TrialCardProps {
  trial: Trial;
  index?: number;
  variant?: "default" | "glass";
  /** Call after on-chain updates so subgraph-backed trial fields refresh without a full page reload */
  refetchTrials?: () => Promise<unknown>;
}

const ZERO_HANDLE = "0x" + "0".repeat(64);

const formatDurationLabel = (seconds: number) => {
  if (seconds === 0) return "No expiry";
  if (seconds % 86400 === 0) return `${seconds / 86400} day(s)`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hour(s)`;
  return `${seconds} sec`;
};

async function pollSubgraphAfterTx(refetchTrials?: () => Promise<unknown>) {
  if (!refetchTrials) return;
  await refetchTrials();
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    await refetchTrials();
  }
}

export function TrialCard({ trial, index = 0, variant = "default", refetchTrials }: TrialCardProps) {
  const isGlass = variant === "glass";
  const [expanded, setExpanded] = useState(() => {
    if (isGlass) return false;
    if (trial.isExpired) return false;
    return !trial.hasComputed && !trial.applicationStatus;
  });

  const { signer, account } = useWeb3();
  const { setRevealedScore, getRevealedScore } = useEncryptedData();

  const [applyStatus, setApplyStatus] = useState<
    "idle" | "consenting" | "computing" | "success" | "error" | "applying" | "applied"
  >(trial.applicationStatus ? "applied" : (trial.hasComputed ? "success" : "idle"));

  const [applyError, setApplyError] = useState<string | null>(null);
  const [decryptedScore, setDecryptedScore] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [poolFunded, setPoolFunded] = useState(false);
  const [incentiveStatus, setIncentiveStatus] = useState<string | null>(null);
  const [consentDurationSeconds, setConsentDurationSeconds] = useState<number>(DEFAULT_CONSENT_DURATION_SECONDS);

  // FIX 1: Track eligibility bool + signature separately from score
  const [isEligibleDecrypted, setIsEligibleDecrypted] = useState<boolean | null>(null);
  const [eligibilitySignature, setEligibilitySignature] = useState<string | null>(null);
  const [isFetchingEligibility, setIsFetchingEligibility] = useState(false);

  const engineAddress =
    (addresses as any).arbitrumSepolia?.EligibilityEngine
    ?? (addresses as any).sepolia?.EligibilityEngine;

  // Incentive Pool Logic
  useEffect(() => {
    const checkPool = async () => {
      if (!signer || !trial.id) return;
      try {
        const vault = getSponsorIncentiveVault(signer);
        const funded = await vault.isPoolFunded(BigInt(trial.id));
        setPoolFunded(funded);

        if (account) {
          const registered = await vault.isRegistered(BigInt(trial.id), account);
          setIsRegistered(registered);
        }
      } catch (err) {
        console.error("Error checking pool:", err);
      }
    };
    checkPool();
  }, [signer, trial.id, account]);

  // Sync internal status with subgraph data if it changes
  useEffect(() => {
    if (trial.hasComputed) {
      setApplyStatus((prev) =>
        prev === "consenting" || prev === "computing" || prev === "applying" ? prev : "success"
      );
    }
  }, [trial.hasComputed]);

  // When subgraph refetch updates parent `trial`, stay in sync without a full reload
  useEffect(() => {
    if (trial.applicationStatus) {
      setApplyStatus("applied");
      return;
    }
    if (trial.hasComputed) {
      setApplyStatus((prev) =>
        prev === "consenting" || prev === "computing" || prev === "applying" ? prev : "success"
      );
    }
  }, [trial.applicationStatus, trial.hasComputed]);

  useEffect(() => {
    if (isGlass) return;
    if (applyStatus === "consenting" || applyStatus === "computing" || applyStatus === "applying") {
      setExpanded(true);
    }
  }, [applyStatus, isGlass]);

  // Load score from memory store
  useEffect(() => {
    if (account && trial.id && engineAddress) {
      const score = getRevealedScore(engineAddress, trial.id);
      setDecryptedScore(score);
    }
  }, [account, trial.id, getRevealedScore, engineAddress]);

  // FIX 1: Pre-fetch eligibility bool + signature when eligibility is computed
  // so the Apply button works without requiring score reveal first
  useEffect(() => {
    if (applyStatus !== "success" || !signer || !account || !trial.id) return;
    if (isEligibleDecrypted !== null) return; // already fetched
    if (trial.applicationStatus) return; // already applied

    const prefetchEligibility = async () => {
      setIsFetchingEligibility(true);
      try {
        const eligibilityEngine = getEligibilityEngine(signer);
        const handle = await eligibilityEngine.encryptedResults(account, BigInt(trial.id));

        // FIX 4: Zero handle guard
        if (!handle || handle === ZERO_HANDLE) {
          console.warn("Eligibility handle is zero — checkEligibility may not have run yet.");
          return;
        }

        const c = await getFHEClient();

        // FIX 2: Cast handle to bigint before passing to decryptForTx
        const handleBig = typeof handle === "string" ? BigInt(handle) : handle;
        const result = await c.decryptForTx(handleBig).withoutPermit().execute();

        const eligible = result.decryptedValue === 1n || result.decryptedValue === true;
        setIsEligibleDecrypted(eligible);
        setEligibilitySignature(result.signature);
      } catch (err) {
        console.error("Failed to pre-fetch eligibility:", err);
        // Non-fatal — user can still retry via apply button
      } finally {
        setIsFetchingEligibility(false);
      }
    };

    prefetchEligibility();
  }, [applyStatus, signer, account, trial.id, trial.applicationStatus]);

  const handleRevealScore = async () => {
    if (!signer || !account || !engineAddress) return;
    setIsDecrypting(true);
    try {
      const eligibilityEngine = getEligibilityEngine(signer);
      const handle = await eligibilityEngine.encryptedScores(account, BigInt(trial.id));

      // FIX 4: Consistent zero handle check
      if (!handle || handle === ZERO_HANDLE) {
        setDecryptedScore(0);
        return;
      }

      const score = await reencryptUint8(
        engineAddress,
        account,
        handle
      );

      const scoreNum = Number(score);
      setDecryptedScore(scoreNum);

      // FIX 3: Save to memory store using correct network address
      setRevealedScore(engineAddress, trial.id, scoreNum);
    } catch (err: any) {
      console.error("Decryption failed:", err);
      setApplyError("Decryption failed. Please try again.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleApplyEncrypted = async () => {
    if (!signer || !account) {
      setApplyError("Please connect your wallet first.");
      setApplyStatus("error");
      return;
    }

    setApplyError(null);

    try {
      // Step 1: Grant consent (if not already granted)
      if (!trial.hasConsent) {
        setApplyStatus("consenting");
        const consentManager = getConsentManager(signer);
        const consentTx = await consentManager.grantConsent(
          BigInt(trial.id),
          BigInt(consentDurationSeconds)
        );
        await consentTx.wait();
      }

      // Step 2: Compute eligibility on-chain (FHE comparison)
      setApplyStatus("computing");
      const eligibilityEngine = getEligibilityEngine(signer);
      const eligibilityTx = await eligibilityEngine.checkEligibility(account, BigInt(trial.id));
      await eligibilityTx.wait();

      // Reset prefetched eligibility so the useEffect re-runs for the new result
      setIsEligibleDecrypted(null);
      setEligibilitySignature(null);

      setApplyStatus("success");
      void pollSubgraphAfterTx(refetchTrials);
    } catch (err: any) {
      console.error("Apply Encrypted failed:", err);
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        setApplyError("Transaction rejected by user.");
      } else {
        setApplyError(err.reason || err.message || "Transaction failed.");
      }
      setApplyStatus("error");
    }
  };

  const handleApplyToSponsor = async () => {
    if (!signer || !account) return;
    setApplyStatus("applying");
    setApplyError(null);

    try {
      const eligibilityEngine = getEligibilityEngine(signer);

      let eligible = isEligibleDecrypted;
      let signature = eligibilitySignature;

      // If pre-fetch didn't complete (e.g. user clicked very quickly), fetch now
      if (eligible === null || !signature) {
        const handle = await eligibilityEngine.encryptedResults(account, BigInt(trial.id));

        // FIX 4: Zero handle guard
        if (!handle || handle === ZERO_HANDLE) {
          setApplyError("Eligibility not yet computed. Please run eligibility check first.");
          setApplyStatus("success");
          return;
        }

        const c = await getFHEClient();

        // FIX 2: Cast handle to bigint
        const handleBig = typeof handle === "string" ? BigInt(handle) : handle;
        const decryptResult = await c.decryptForTx(handleBig).withoutPermit().execute();

        eligible = decryptResult.decryptedValue === 1n || decryptResult.decryptedValue === true;
        signature = decryptResult.signature;
      }

      if (!eligible) {
        setApplyError("You are not eligible for this trial.");
        setApplyStatus("success");
        return;
      }

      // Submit application with on-chain proof
      const tx = await eligibilityEngine.applyToTrial(
        BigInt(trial.id),
        eligible,
        signature
      );
      await tx.wait();
      setApplyStatus("applied");
      void pollSubgraphAfterTx(refetchTrials);
    } catch (err: any) {
      console.error("Application failed:", err);
      setApplyError(err.reason || err.message || "Application failed.");
      setApplyStatus("success"); // Return to computed state
    }
  };

  const handleRegisterForRewards = async () => {
    if (!signer || !account || !trial.id) return;
    setIsRegistering(true);
    setIncentiveStatus("Registering for confidential rewards...");
    try {
      const vault = getSponsorIncentiveVault(signer);
      const tx = await vault.registerParticipant(BigInt(trial.id), account);
      await tx.wait();
      setIsRegistered(true);
      setIncentiveStatus("Successfully registered in reward enclave!");
    } catch (err: any) {
      console.error("Registration failed:", err);
      setIncentiveStatus(`Registration failed: ${err.reason || err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  // FIX 1: Apply button is now gated on isEligibleDecrypted (the ebool),
  // not on decryptedScore === 100 (the UI score which requires a separate reveal step)
  const canApplyToSponsor =
    applyStatus === "success" &&
    !trial.applicationStatus &&
    isEligibleDecrypted === true &&
    !!eligibilitySignature;

  const isReadyToApply = applyStatus === "success" && !trial.applicationStatus;
  const isStillFetchingEligibility = isReadyToApply && isFetchingEligibility;

  const getApplyButtonContent = () => {
    if (trial.hasComputed && (trial.applicationStatus || applyStatus === "applied")) {
      return (
        <>
          <CheckCircle className="h-4 w-4" /> Application {trial.applicationStatus || "Submitted"}
        </>
      );
    }

    switch (applyStatus) {
      case "consenting":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Granting Consent…
          </>
        );
      case "computing":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Running FHE Check…
          </>
        );
      case "applying":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Applying…
          </>
        );
      case "success":
        if (isStillFetchingEligibility) {
          return (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying Eligibility…
            </>
          );
        }
        if (canApplyToSponsor) {
          return (
            <>
              <ShieldCheck className="h-4 w-4" /> Apply to Sponsor
            </>
          );
        }
        if (isEligibleDecrypted === false) {
          return (
            <>
              <XCircle className="h-4 w-4" /> Not Eligible
            </>
          );
        }
        return (
          <>
            <CheckCircle className="h-4 w-4" /> Eligibility Computed
          </>
        );
      case "applied":
        return (
          <>
            <CheckCircle className="h-4 w-4" /> Application Submitted
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="h-4 w-4" /> Retry Action
          </>
        );
      default:
        return (
          <>
            <ShieldCheck className="h-4 w-4" /> {trial.hasConsent ? "Compute Eligibility" : "Apply Encrypted"}
          </>
        );
    }
  };

  const isApplying = applyStatus === "consenting" || applyStatus === "computing" || applyStatus === "applying";

  const handleMainButtonClick = () => {
    if (canApplyToSponsor) {
      handleApplyToSponsor();
    } else {
      handleApplyEncrypted();
    }
  };

  const isMainButtonDisabled =
    isApplying ||
    applyStatus === "applied" ||
    !!trial.applicationStatus ||
    isStillFetchingEligibility ||
    (applyStatus === "success" && isEligibleDecrypted === false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }}
    >
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-500 ease-out",
          isGlass
            ? "bg-white/5 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:border-blue-500/30 hover:shadow-blue-500/5 hover:-translate-y-1"
            : "border-slate-200/60 bg-white shadow-neo hover:shadow-neo-lg dark:border-slate-800 dark:bg-slate-900/50"
        )}
      >
        {isGlass && (
          <>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out pointer-events-none">
              <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full blur-[100px] animate-pulse bg-blue-500/10" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 rounded-full blur-[100px] animate-pulse bg-indigo-500/10 delay-700" />
            </div>
            <div className="absolute inset-[1px] rounded-[inherit] pointer-events-none border border-white/5 opacity-50 group-hover:opacity-100 transition-opacity" />
          </>
        )}
        <CardContent className="p-0 relative z-10">
          <div className="flex flex-col md:flex-row">
            {/* Main Info Area */}
            <div className="flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1",
                    isGlass ? "bg-white/5 border-white/10 text-blue-400" : "bg-slate-50 dark:bg-slate-800"
                  )}
                >
                  {trial.phase.toUpperCase().startsWith("PHASE") ? trial.phase : `Phase ${trial.phase}`}
                </Badge>
                {poolFunded && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 flex items-center gap-1"
                  >
                    <Coins className="h-3 w-3" /> Private Reward Pool
                  </Badge>
                )}
                {(trial.matchCount || 0) > 100 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                  >
                    Trending Trial
                  </Badge>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-1">
                <div className="flex-1">
                  <h3 className={cn(
                    "font-display font-black tracking-tight mb-1 leading-tight transition-colors duration-300",
                    isGlass ? "text-xl text-white group-hover:text-blue-400" : "text-lg text-slate-900 dark:text-slate-50 group-hover:text-accent"
                  )}>
                    {trial.name}
                  </h3>

                  {!isGlass && (
                    <p className="text-[13px] font-medium text-slate-500 flex items-center gap-1">
                      {trial.sponsor.name.startsWith('0x')
                        ? `${trial.sponsor.name.slice(0, 6)}...${trial.sponsor.name.slice(-4)}`
                        : trial.sponsor.name}
                    </p>
                  )}
                </div>

                {trial.endTime && parseInt(trial.endTime) > Math.floor(Date.now() / 1000) && (
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono shadow-sm shrink-0",
                    isGlass
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                      : "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800/50"
                  )}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {(() => {
                        const secondsLeft = parseInt(trial.endTime) - Math.floor(Date.now() / 1000);
                        if (secondsLeft > 86400) return `${Math.ceil(secondsLeft / 86400)}D REMAINING`;
                        if (secondsLeft > 3600) return `${Math.floor(secondsLeft / 3600)}H ${Math.floor((secondsLeft % 3600) / 60)}M`;
                        return `${Math.floor(secondsLeft / 60)}M ${secondsLeft % 60}S`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="flex items-center gap-3 group/item">
                  <div className={cn(
                    "flex items-center justify-center h-8.5 w-8.5 rounded-xl transition-all duration-500 group-hover/item:scale-110 group-hover/item:rotate-3 shadow-lg",
                    isGlass ? "bg-white/5 border border-white/10" : "bg-slate-500/5 border border-slate-500/10"
                  )}>
                    <MapPin className={cn("h-5 w-5", isGlass ? "text-slate-400" : "text-slate-500")} />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1">Location</p>
                    <p className={cn("text-sm font-black", isGlass ? "text-slate-200" : "text-slate-700 dark:text-slate-300")}>
                      {trial.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 group/item">
                  <div className={cn(
                    "flex items-center justify-center h-8.5 w-8.5 rounded-xl transition-all duration-500 group-hover/item:scale-110 group-hover/item:rotate-3 shadow-lg",
                    isGlass ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-500/5 border border-emerald-500/10"
                  )}>
                    <DollarSign className="h-4.5 w-4.5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-500/60 mb-1">Reward</p>
                    <p className={cn("text-sm font-black", isGlass ? "text-white" : "text-slate-900 dark:text-slate-100")}>
                      {trial.compensation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 group/item">
                  <div className={cn(
                    "flex items-center justify-center h-8.5 w-8.5 rounded-xl transition-all duration-500 group-hover/item:scale-110 group-hover/item:rotate-3 shadow-lg",
                    isGlass ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-500/5 border border-blue-500/10"
                  )}>
                    <Clock className="h-4.5 w-4.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-blue-500/60 mb-1">Status</p>
                    {(() => {
                      const hasEnded = trial.endTime && parseInt(trial.endTime) <= Math.floor(Date.now() / 1000);
                      const isLive = trial.active && !hasEnded;
                      return (
                        <p className={cn("text-sm font-black", isLive ? "text-blue-400 animate-pulse" : hasEnded ? "text-rose-400" : "text-slate-400")}>
                          {isLive ? "Live" : hasEnded ? "Ended" : "Inactive"}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Area */}
            <div className={cn(
              "w-full md:w-56 p-4 flex flex-col justify-center relative overflow-hidden",
              isGlass ? "bg-white/[0.02] border-t md:border-t-0 md:border-l border-white/5" : "bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100 dark:bg-slate-800/20 dark:border-slate-800"
            )}>
              {isGlass && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full" />
              )}

              <div className="text-center mb-4 relative z-10">
                <div className="inline-flex items-end gap-1.5 mb-2">
                  <span className={cn(
                    "font-display font-black leading-none transition-all duration-500 group-hover:scale-110",
                    isGlass ? "text-4xl text-blue-400" : "text-2xl text-slate-900 dark:text-slate-50"
                  )}>
                    {isGlass
                      ? (trial.matchCount || 0)
                      : (decryptedScore !== null ? decryptedScore : <EncryptionAnimation />)}
                  </span>
                  {!isGlass && <span className="text-sm font-bold text-slate-400 mb-1.5">%</span>}
                </div>
                {!isGlass && decryptedScore === null && trial.hasComputed && (
                  <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tight">
                    Encrypted Results
                  </p>
                )}
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  {isGlass ? "TOTAL MATCHES" : "ELIGIBILITY"}
                </p>
              </div>

              <div className="relative h-1 w-full bg-slate-800/50 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${isGlass ? Math.min((trial.matchCount || 0) * 10, 100) : (decryptedScore !== null ? decryptedScore : 0)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isGlass || (decryptedScore !== null ? decryptedScore : 0) > 80
                      ? "bg-blue-500 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                      : (decryptedScore !== null ? decryptedScore : 0) > 50
                        ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                        : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                  )}
                />
              </div>

              {!isGlass && decryptedScore === null && trial.hasComputed && (
                <Button
                  size="sm"
                  variant="default"
                  className="w-full text-[11px] font-bold uppercase tracking-wider mb-3 bg-accent hover:bg-accent/90 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  onClick={handleRevealScore}
                  disabled={isDecrypting}
                >
                  {isDecrypting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Decrypting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3 mr-2" />
                      Reveal Match Score
                    </>
                  )}
                </Button>
              )}

              <Button
                size="sm"
                variant={expanded ? "ghost" : (isGlass ? "default" : "outline")}
                className={cn(
                  "w-full text-[10px] font-black uppercase tracking-[0.2em] h-10 rounded-xl transition-all duration-300",
                  isGlass && !expanded ? "bg-white/10 hover:bg-white/20 text-white border-white/5" : ""
                )}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Collapse" : isGlass ? "Protocol Details" : "Eligibility details"}
                {expanded ? (
                  <ChevronUp className="ml-2 h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="ml-2 h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Patient: apply / consent / status always visible (no expand required) */}
          {!isGlass && (
            <div className="px-4 py-4 md:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Trial actions</p>
              {!trial.hasConsent && applyStatus !== "applied" && !trial.applicationStatus && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 mb-3">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">Consent window</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={consentDurationSeconds}
                      onChange={(e) => setConsentDurationSeconds(Number(e.target.value))}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {CONSENT_DURATION_OPTIONS.map((opt) => (
                        <option key={opt.seconds} value={opt.seconds}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 font-medium">{formatDurationLabel(consentDurationSeconds)}</span>
                  </div>
                </div>
              )}

              <Button
                className={cn(
                  "w-full shadow-lg gap-2 font-bold h-11",
                  applyStatus === "applied" || trial.applicationStatus
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : canApplyToSponsor
                      ? "bg-accent hover:bg-accent/90 shadow-accent/20"
                      : applyStatus === "error"
                        ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                        : "shadow-accent/20"
                )}
                onClick={handleMainButtonClick}
                disabled={isMainButtonDisabled}
              >
                {getApplyButtonContent()}
              </Button>

              <AnimatePresence>
                {trial.applicationStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-3 p-3 rounded-lg border text-xs font-medium",
                      trial.applicationStatus === "Accepted"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : trial.applicationStatus === "Rejected"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                    )}
                  >
                    <p className="mb-1">Status: {trial.applicationStatus}</p>
                    {trial.applicationMessage && (
                      <p className="text-[10px] opacity-80 leading-relaxed italic">
                        &ldquo;{trial.applicationMessage}&rdquo;
                      </p>
                    )}
                  </motion.div>
                )}

                {applyStatus === "success" && isEligibleDecrypted === false && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-xs text-center text-rose-500 font-medium"
                  >
                    You do not meet the eligibility criteria for this trial.
                  </motion.p>
                )}

                {applyStatus === "applied" && !trial.applicationStatus && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-xs text-center text-emerald-500 font-medium"
                  >
                    Application submitted to sponsor — syncing status from the network…
                  </motion.p>
                )}

                {poolFunded && trial.applicationStatus === "Accepted" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "mt-4 p-4 rounded-[1.5rem] border space-y-3",
                      trial.incentivePool?.distributed
                        ? "bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border-emerald-500/20"
                        : "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-1.5 rounded-lg shadow-lg",
                          trial.incentivePool?.distributed
                            ? "bg-emerald-500 text-white shadow-emerald-500/20"
                            : "bg-amber-500 text-white shadow-amber-500/20"
                        )}>
                          <Coins className="h-3.5 w-3.5" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          {trial.incentivePool?.distributed ? "Payout Secured" : "Incentive Enclave"}
                        </h5>
                      </div>
                      {trial.incentivePool?.distributed ? (
                        <Badge className="bg-emerald-500 text-white border-0 text-[9px] animate-pulse">Confirmed</Badge>
                      ) : !isRegistered && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 bg-amber-500/5">Action Required</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {trial.incentivePool?.distributed
                        ? "Rewards have been deposited into your private reward enclave. You can now reveal and withdraw them from your Medical Vault."
                        : "This trial has a verified incentive pool. Register to secure your encrypted reward share upon trial completion."}
                    </p>
                    {trial.incentivePool?.distributed ? (
                      <Link to="/patient/vault" className="block w-full">
                        <Button className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest flex gap-2 shadow-xl shadow-emerald-500/20">
                          Go to Medical Vault
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    ) : !isRegistered ? (
                      <Button
                        className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest flex gap-2 shadow-xl shadow-amber-500/20"
                        onClick={handleRegisterForRewards}
                        disabled={isRegistering}
                      >
                        {isRegistering ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                        {isRegistering ? "Registering..." : "Join Reward Pool"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-bold">
                        <CheckCircle className="h-3 w-3" /> Registered for Incentives
                      </div>
                    )}
                    {incentiveStatus && (
                      <p className={cn(
                        "text-[9px] font-semibold text-center mt-2",
                        incentiveStatus.includes("failed") ? "text-rose-500" : "text-blue-500"
                      )}>
                        {incentiveStatus}
                      </p>
                    )}
                  </motion.div>
                )}

                {applyError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-xs text-center text-rose-400 font-medium"
                  >
                    {applyError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Expanded Content — optional eligibility breakdown + disclosure copy */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-transparent">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                        {isGlass ? "Protocol Logic" : "Eligibility Analysis"}
                      </h4>
                      <ul className="space-y-3">
                        {trial.breakdown?.met?.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                        {trial.breakdown?.borderline?.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                        {trial.breakdown?.missing?.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <XCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                        {(!trial.breakdown ||
                          (trial.breakdown.met.length === 0 && trial.breakdown.missing.length === 0)) && (
                            <li className="text-sm text-slate-500 italic">
                              {isGlass
                                ? "On-chain eligibility logic active."
                                : "Eligibility analysis requires profile upload."}
                            </li>
                          )}
                      </ul>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                          Secure Disclosure Plan
                        </h4>
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                          Apply with FHE-encrypted zero-knowledge proofs. Minimal metadata will be
                          shared with the investigator.
                        </p>
                        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          {["Anonymized Vital Signs", "Encrypted Lab Values", "ZKP for Diagnosis"].map((tag) => (
                            <div key={tag} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                              <div className="h-1 w-1 rounded-full bg-accent" /> {tag}
                            </div>
                          ))}
                        </div>
                      </div>

                      {isGlass && (
                        <Link to={`/sponsor/trials/${trial.id}`}>
                          <Button className="mt-6 w-full shadow-lg shadow-accent/20">
                            Manage Recruitment
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}



