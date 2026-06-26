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
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Info,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { Link } from "react-router-dom";
import { useWeb3 } from "../../lib/Web3Context";
import {
  getConsentManager,
  getEligibilityEngine,
  getMedVaultRegistry,
  getSponsorIncentiveVault,
  getContractAddressForChain
} from "../../lib/contracts";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "../../lib/zamaChain";
import { useEncryptedData } from "../../lib/EncryptedDataContext";
import {
  getOrCreateIdentity,
  getStoredIdentity,
  isMemberRegistered,
  resolveAnonymousNullifier,
} from "../../lib/semaphore";
import { useAnonymousApplication } from "../../hooks/useAnonymousRegistration";
import { AnonymousApplyWizard, type ApplyWizardPhase } from "../apply/AnonymousApplyWizard";

import { reencryptUint8, reencryptUint8WithEphemeral } from "../../lib/fhe";
import { ethers } from "ethers";
import { EncryptionAnimation } from "../ui/EncryptionAnimation";
import { formatPhaseBadge, formatTrialDurationLabel, trialDiscoverDescription } from "../../lib/trialDisplay";
import { NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE, isNotEligibleForTrialMessage } from "../../lib/relayer";

interface TrialCardProps {
  trial: Trial;
  index?: number;
  variant?: "default" | "glass" | "discover";
  onApplySuccess?: () => void | Promise<void>;
}

const ZERO_HANDLE = "0x" + "0".repeat(64);

/** Inline notice after failed anonymous apply — eligibility vs other failures */
function AnonymousApplyFeedback({
  registrationError,
  semaphoreError,
}: {
  registrationError: string | null;
  semaphoreError: string | null;
}) {
  const msg = registrationError || semaphoreError;
  if (!msg) return null;
  const notEligible = isNotEligibleForTrialMessage(msg);
  const displayBody = notEligible ? NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE : msg;
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-xl border p-4 text-left shadow-sm",
        notEligible
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-950 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20 dark:text-amber-100"
          : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            notEligible ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-500/15 text-rose-600"
          )}
        >
          {notEligible ? <Info className="h-5 w-5" aria-hidden /> : <AlertTriangle className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">
            {notEligible ? "Not eligible to apply" : "Something went wrong"}
          </p>
          <p className="text-sm font-medium leading-snug">{displayBody}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function TrialCard({ trial, index = 0, variant = "default", onApplySuccess }: TrialCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [discoverBookmarked, setDiscoverBookmarked] = useState(false);
  const isGlass = variant === "glass";
  const isDiscover = variant === "discover" && !isGlass;
  /** Wallet-linked sponsor apply is deprecated; anonymous apply is the supported path. */
  const canApplyToSponsor = false;

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
  /** After first on-chain read of pool + isParticipantRegistered — avoids auto-enroll racing ahead of "already registered". */
  const [incentiveCheckDone, setIncentiveCheckDone] = useState(false);

  const [applyWizardNullifier, setApplyWizardNullifier] = useState<bigint | null>(null);

  // Semaphore Anonymous Apply state
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'registering' | 'done' | 'error'>('idle');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isSemaphoreRegistered, setIsSemaphoreRegistered] = useState(false);

  // Use the simplified Semaphore hook for anonymous application
  const {
    generateSemaphoreProof,
    submitApplication,
    isGeneratingSemaphore,
    isSubmitting,
    hasApplied,
    error: semaphoreError,
    reset
  } = useAnonymousApplication(signer || undefined, signer?.provider || undefined);

  const applyWizardPhase: ApplyWizardPhase = (() => {
    if (trial.applicationStatus || hasApplied || applyStatus === "applied") return "applied";
    if (registrationError || semaphoreError) return "error";
    if (isSubmitting) return "finalizing";
    if (isGeneratingSemaphore) return "generating-proof";
    if (isRegistering || registrationStatus === "registering") return "registering-profile";
    if (applyStatus === "consenting" || applyStatus === "computing") return "checking-identity";
    return "idle";
  })();

  useEffect(() => {
    if (!signer?.provider || !(hasApplied || trial.applicationStatus)) return;
    void resolveAnonymousNullifier(signer.provider, BigInt(trial.id)).then((n) => {
      if (n) setApplyWizardNullifier(n);
    });
  }, [signer, trial.id, hasApplied, trial.applicationStatus]);

  // FIX 1: Track eligibility bool + signature separately from score
  const [isEligibleDecrypted, setIsEligibleDecrypted] = useState<boolean | null>(null);
  const [eligibilitySignature, setEligibilitySignature] = useState<string | null>(null);
  const [isFetchingEligibility, setIsFetchingEligibility] = useState(false);
  const autoEnrollAttemptedRef = useRef(false);
  useEffect(() => {
    autoEnrollAttemptedRef.current = false;
  }, [trial.id]);

  const engineAddress = getContractAddressForChain("EligibilityEngine");

  // Incentive Pool Logic
  useEffect(() => {
    let cancelled = false;
    const checkPool = async () => {
      if (!signer || !trial.id) {
        setIncentiveCheckDone(true);
        return;
      }
      try {
        const vault = getSponsorIncentiveVault(signer);
        const funded = await vault.isPoolFunded(BigInt(trial.id));
        if (cancelled) return;
        setPoolFunded(funded);

        if (account) {
          let participantAddress = account;
          const nullifier = signer.provider
            ? await resolveAnonymousNullifier(signer.provider, BigInt(trial.id))
            : null;
          if (nullifier) {
            const holder = await getEligibilityEngine(signer).getDecryptPermitHolder(
              nullifier,
              BigInt(trial.id)
            );
            if (holder && holder !== ethers.ZeroAddress) {
              participantAddress = holder;
            }
          }
          const registered = await vault.isParticipantRegistered(BigInt(trial.id), participantAddress);
          if (cancelled) return;
          setIsRegistered(registered);
        }
      } catch (err) {
        console.error("Error checking pool:", err);
      } finally {
        if (!cancelled) setIncentiveCheckDone(true);
      }
    };
    setIncentiveCheckDone(false);
    void checkPool();
    return () => {
      cancelled = true;
    };
  }, [signer, trial.id, account]);

  // Check if the current identity commitment is registered on-chain
  const refreshMembership = async (): Promise<{
    registered: boolean;
    missingIdentity: boolean;
    mismatch: boolean;
    walletRegistered: boolean;
    wrongNetwork: boolean;
  }> => {
    if (!signer?.provider || !account) {
      return { registered: false, missingIdentity: false, mismatch: false, walletRegistered: false, wrongNetwork: false };
    }
    try {
      const network = await signer.provider.getNetwork();
      if (network.chainId !== BigInt(ETHEREUM_SEPOLIA_CHAIN_ID)) {
        setIsSemaphoreRegistered(false);
        return { registered: false, missingIdentity: false, mismatch: false, walletRegistered: false, wrongNetwork: true };
      }

      const registry = getMedVaultRegistry(signer);
      const identity = getStoredIdentity();
      if (!identity) {
        setIsSemaphoreRegistered(false);
        return { registered: false, missingIdentity: true, mismatch: false, walletRegistered: false, wrongNetwork: false };
      }

      const walletRegistered = await registry.isRegistered();
      if (walletRegistered) {
        const onChainCommitment = await registry.getCommitmentForWallet(account);
        const localCommitment = identity.commitment;
        if (BigInt(onChainCommitment) !== BigInt(localCommitment)) {
          setIsSemaphoreRegistered(false);
          return { registered: false, missingIdentity: false, mismatch: true, walletRegistered: true, wrongNetwork: false };
        }
      }

      const registered = await isMemberRegistered(signer.provider, identity.commitment);
      setIsSemaphoreRegistered(registered);
      return { registered, missingIdentity: false, mismatch: false, walletRegistered, wrongNetwork: false };
    } catch (err) {
      console.error("Error checking membership:", err);
      return { registered: false, missingIdentity: false, mismatch: false, walletRegistered: false, wrongNetwork: false };
    }
  };

  useEffect(() => {
    void refreshMembership();
  }, [signer]);

  // Sync internal status with subgraph data if it changes
  useEffect(() => {
    if (trial.hasComputed) {
      setApplyStatus("success");
    } else if (trial.hasConsent && applyStatus === "idle") {
      setApplyStatus("computing");
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

  const handleRevealScore = async () => {
    if (!signer || !account || !engineAddress) return;
    setIsDecrypting(true);
    try {
      const eligibilityEngine = getEligibilityEngine(signer);

      // Derive the per-trial nullifier from local storage — never commitment
      const { getAnonymousNullifier } = await import("../../lib/semaphore");
      const nullifier = getAnonymousNullifier(BigInt(trial.id));

      let handle: any = null;
      let usedAnonymousHandle = false;
      if (nullifier) {
        // Primary: nullifier-keyed lookup (unlinkable across trials)
        handle = await eligibilityEngine.getAnonymousScore(nullifier, BigInt(trial.id));
        usedAnonymousHandle = !!handle && handle !== ZERO_HANDLE;
      }

      // FIX: Consistent zero handle check
      if (!handle || handle === ZERO_HANDLE) {
        // Fallback to legacy address-based if needed
        handle = await eligibilityEngine.getEncryptedScore(account, BigInt(trial.id));
        if (!handle || handle === ZERO_HANDLE) {
          setDecryptedScore(0);
          return;
        }
      }

      let score: unknown;
      if (usedAnonymousHandle) {
        const identity = getStoredIdentity();
        if (!identity || !signer.provider) {
          throw new Error("Anonymous score requires the local Semaphore identity.");
        }
        const privateKey = ethers.keccak256(
          ethers.toUtf8Bytes(`medvault:ephemeral:${identity.secretScalar.toString()}`)
        );
        const ephemeralWallet = new ethers.Wallet(privateKey, signer.provider);
        score = await reencryptUint8WithEphemeral(ephemeralWallet, engineAddress, handle);
      } else {
        score = await reencryptUint8(engineAddress, account, handle);
      }

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

  const handleApplyToSponsor = async () => {
    setApplyError("Legacy application flow deprecated. Please use the anonymous ZK application instead.");
    setApplyStatus("error");
  };

  const handleApplyAnonymously = async () => {
    if (!signer || !account) return;
    
    if (!signer.provider) {
      setRegistrationError('No network provider available. Please reconnect your wallet.');
      return;
    }

    setRegistrationError(null);

    try {
      // Step 1: Check registration live right before apply to avoid stale UI state
      const membership = await refreshMembership();
      if (membership.wrongNetwork) {
        throw new Error("Wrong network. Please switch your wallet to Ethereum Sepolia and retry.");
      }
      if (membership.missingIdentity) {
        throw new Error("No local anonymous identity found in this browser/profile. Use the same browser/profile used for registration, or re-register with a new wallet.");
      }
      if (membership.mismatch) {
        throw new Error("Identity mismatch detected: this wallet is registered with a different anonymous identity than the one currently stored in your browser. Use the original browser/profile used at registration, or register again with a new wallet.");
      }
      if (!membership.walletRegistered) {
        throw new Error("Wallet is not registered in MedVaultRegistry on Ethereum Sepolia. Please register your health profile from this same wallet/network first.");
      }
      if (!membership.registered) {
        throw new Error("Registered wallet found, but current local anonymous identity is not in the Semaphore group. Use the original browser/profile used at registration.");
      }

      // Step 2: Submit anonymous application (via relayer)
      // Atomic call handles proof generation + submission internally
      const trialIdNum = parseInt(trial.id);
      await submitApplication(trialIdNum);
      setApplyStatus("applied");
      await onApplySuccess?.();
    } catch (err: any) {
      console.error('Semaphore apply failed:', err);
      setRegistrationError(err.reason || err.message || 'Anonymous application failed.');
      setRegistrationStatus('error');
    }
  };


  const handleRegisterForRewards = async () => {
    if (!signer || !account || !trial.id) return;
    setIsRegistering(true);
    setIncentiveStatus("Registering for confidential rewards...");
    console.log("[Rewards] register:start", {
      trialId: trial.id,
      account,
      appStatus: trial.applicationStatus,
      poolFunded,
    });
    try {
      if (!signer.provider) {
        throw new Error("Wallet provider unavailable. Please reconnect and retry.");
      }
      const vault = getSponsorIncentiveVault(signer);
      const eligibilityEngine = getEligibilityEngine(signer);
      const nullifier = await resolveAnonymousNullifier(signer.provider, BigInt(trial.id));
      console.log("[Rewards] register:nullifier", {
        trialId: trial.id,
        nullifier: nullifier?.toString() ?? null,
      });
      if (!nullifier) {
        throw new Error("Unable to recover anonymous application nullifier for this trial. Re-open the original browser profile used during apply and retry.");
      }
      const permitHolder = await eligibilityEngine.getDecryptPermitHolder(
        nullifier,
        BigInt(trial.id)
      );
      if (!permitHolder || permitHolder === ethers.ZeroAddress) {
        throw new Error("No reward permit holder found for this anonymous application.");
      }
      try {
        const [funded, statusRaw, alreadyRegistered] = await Promise.all([
          vault.isPoolFunded(BigInt(trial.id)),
          eligibilityEngine.getAnonymousApplicationStatus(nullifier, BigInt(trial.id)),
          vault.isParticipantRegistered(BigInt(trial.id), permitHolder),
        ]);
        const statusNum = Number(statusRaw);
        console.log("[Rewards] register:precheck", {
          trialId: trial.id,
          nullifier: nullifier.toString(),
          permitHolder,
          funded: Boolean(funded),
          appStatusRaw: statusNum,
          alreadyRegistered: Boolean(alreadyRegistered),
        });
        if (!funded) {
          setIncentiveStatus("Registration blocked: incentive pool is not funded yet.");
          return;
        }
        if (alreadyRegistered) {
          setIsRegistered(true);
          setIncentiveStatus("You’re already registered for this pool.");
          return;
        }
        if (statusNum !== 2) {
          const statusLabel =
            statusNum === 1 ? "Pending" : statusNum === 3 ? "Rejected" : "None";
          setIncentiveStatus(
            `Registration blocked: anonymous application status is ${statusLabel}. Sponsor must set it to Accepted first.`
          );
          return;
        }
      } catch (precheckErr) {
        console.warn("[Rewards] register:precheck_failed", precheckErr);
      }
      const tx = await vault.registerAnonymousParticipant(BigInt(trial.id), nullifier);
      console.log("[Rewards] register:tx_submitted", {
        trialId: trial.id,
        txHash: tx.hash,
      });
      await tx.wait();
      setIsRegistered(true);
      setIncentiveStatus("Successfully registered in reward enclave!");
      console.log("[Rewards] register:tx_confirmed", {
        trialId: trial.id,
        txHash: tx.hash,
      });
    } catch (err: any) {
      console.error("Registration failed:", err);
      console.error("[Rewards] register:error_detail", {
        reason: err?.reason,
        shortMessage: err?.shortMessage,
        message: err?.message,
        data: err?.data,
      });
      const raw = `${err?.reason || ""} ${err?.message || ""} ${err?.shortMessage || ""}`.toLowerCase();
      if (
        raw.includes("already registered") ||
        raw.includes("nullifier already used") ||
        (err?.code === "CALL_EXCEPTION" && err?.data == null && raw.includes("missing revert data"))
      ) {
        setIsRegistered(true);
        setIncentiveStatus("You’re already registered for this pool.");
        return;
      }
      if (err.reason?.includes("capacity") || err.message?.includes("capacity")) {
        setIncentiveStatus("Registration failed: Trial participant limit reached (200 max).");
      } else {
        setIncentiveStatus(`Registration failed: ${err.reason || err.message || "Unknown error"}`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (!incentiveCheckDone) return;
    if (!signer || !account || !trial.id) return;
    if (!trial.applicationStatus || trial.applicationStatus !== "Accepted") return;
    if (!poolFunded || isRegistered || isRegistering) return;
    if (autoEnrollAttemptedRef.current) return;

    autoEnrollAttemptedRef.current = true;
    setIncentiveStatus("Accepted! Auto-enrolling in reward pool...");
    void handleRegisterForRewards();
  }, [signer, account, trial.id, trial.applicationStatus, poolFunded, isRegistered, isRegistering, incentiveCheckDone]);

  const isReadyToApply = applyStatus === "success" && !trial.applicationStatus;
  const isStillFetchingEligibility = isReadyToApply && isFetchingEligibility;

  const getApplyButtonContent = () => {
    if (hasApplied || trial.applicationStatus) {
      return (
        <>
          <CheckCircle className="h-4 w-4" /> Applied Anonymously
        </>
      );
    }

    if (isSubmitting) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Matching via Relayer...
        </>
      );
    }

    if (isGeneratingSemaphore) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Generating Secure Proof...
        </>
      );
    }

    if (registrationStatus === 'registering') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Registering Identity...
        </>
      );
    }

    if (registrationStatus === 'error' || semaphoreError) {
      return (
        <>
          <XCircle className="h-4 w-4" /> Retry Secure Apply
        </>
      );
    }

    if (isStillFetchingEligibility) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Checking Eligibility...
        </>
      );
    }

    if (isReadyToApply && isEligibleDecrypted === false) {
      return (
        <>
          <XCircle className="h-4 w-4" /> Not Eligible
        </>
      );
    }

    return (
      <>
        <ShieldCheck className="h-4 w-4" /> Apply Anonymously
      </>
    );
  };

  const handleMainButtonClick = () => {
    handleApplyAnonymously();
  };

  /* Discover: allow apply without prior subgraph eligibility + FHE prefetch — submit flow validates registration/proof. */
  const isMainButtonDisabled =
    isSubmitting ||
    isGeneratingSemaphore ||
    registrationStatus === 'registering' ||
    hasApplied ||
    !!trial.applicationStatus ||
    (isDiscover && (!signer || !account)) ||
    (!!account && isDiscover && isStillFetchingEligibility) ||
    (!!account && isDiscover && isReadyToApply && isEligibleDecrypted === false);

  if (isDiscover) {
    const sponsorDisplay = trial.sponsor.name.startsWith("0x")
      ? `${trial.sponsor.name.slice(0, 6)}...${trial.sponsor.name.slice(-4)}`
      : trial.sponsor.name;

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
        <Card className="border border-slate-200/90 bg-white dark:bg-white shadow-[0px_12px_32px_rgba(30,41,59,0.04)] hover:shadow-[0px_12px_40px_rgba(30,41,59,0.07)] transition-shadow duration-300 rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 relative z-10 space-y-6">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    {formatPhaseBadge(trial)}
                  </span>
                  {poolFunded && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      <Coins className="h-3 w-3 mr-1" /> Reward pool
                    </Badge>
                  )}
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-900 leading-tight">
                  {trial.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiscoverBookmarked((v) => !v)}
                className={cn(
                  "shrink-0 p-2 rounded-full transition-colors text-slate-400 hover:text-teal-600 hover:bg-slate-100",
                  discoverBookmarked && "text-teal-600 bg-teal-50"
                )}
                aria-label={discoverBookmarked ? "Remove bookmark" : "Bookmark trial"}
              >
                <Bookmark className={cn("h-5 w-5", discoverBookmarked && "fill-teal-600 text-teal-600")} />
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-600 text-sm leading-relaxed">
              {trialDiscoverDescription(trial)}
            </p>

            <div className="bg-slate-50/90 dark:bg-slate-50 rounded-xl border border-slate-100 p-5 flex flex-col gap-0">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
                <span className="text-sm text-slate-500 font-medium">Sponsor</span>
                <span className="text-sm font-semibold text-slate-900 text-right truncate max-w-[55%]">{sponsorDisplay}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 py-3">
                <span className="text-sm text-slate-500 font-medium">Duration</span>
                <span className="text-sm font-semibold text-slate-900">{formatTrialDurationLabel(trial)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 gap-3 bg-emerald-50/80 dark:bg-emerald-50 -mx-1 px-4 py-3 rounded-lg border border-emerald-100/80">
                <span className="text-sm text-slate-500 font-medium">Compensation</span>
                <span className="text-sm font-semibold font-mono text-teal-700 tabular-nums">
                  {trial.compensation}
                </span>
              </div>
            </div>

            {trial.hasComputed && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Eligibility</p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-900 tabular-nums">
                      {decryptedScore !== null ? decryptedScore : <EncryptionAnimation />}
                    </span>
                    <span className="text-sm font-bold text-slate-400 mb-1">%</span>
                  </div>
                </div>
                {decryptedScore === null && (
                  <Button
                    size="sm"
                    className="rounded-full bg-teal-600 hover:bg-teal-500 text-white font-semibold"
                    onClick={handleRevealScore}
                    disabled={isDecrypting}
                  >
                    {isDecrypting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Decrypting...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Reveal match score
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200/80 px-3 py-2 text-xs font-semibold w-fit">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                ZK Protected
              </div>
              <Button
                className={cn(
                  "rounded-full px-6 py-3 font-semibold text-sm shadow-md transition-all hover:-translate-y-0.5 gap-2 min-h-[48px]",
                  "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border-0 w-full sm:w-auto justify-center",
                  hasApplied || trial.applicationStatus ? "from-emerald-600 to-emerald-700" : "",
                  registrationStatus === "error" || semaphoreError ? "from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600" : ""
                )}
                onClick={handleMainButtonClick}
                disabled={isMainButtonDisabled}
              >
                {getApplyButtonContent()}
                {!(
                  hasApplied ||
                  trial.applicationStatus ||
                  isSubmitting ||
                  isGeneratingSemaphore ||
                  registrationStatus === "registering"
                ) && <ArrowRight className="h-4 w-4 opacity-90" />}
              </Button>
            </div>

            {(isSubmitting || isGeneratingSemaphore || hasApplied || trial.applicationStatus || registrationError || semaphoreError) && (
              <AnonymousApplyWizard
                phase={applyWizardPhase}
                walletRegistered={isSemaphoreRegistered}
                semaphoreRegistered={isSemaphoreRegistered}
                hasProfile={isRegistered || isSemaphoreRegistered}
                trialId={trial.id}
                nullifier={applyWizardNullifier}
                provider={signer?.provider ?? null}
                errorMessage={registrationError || semaphoreError || applyError}
                className="mt-4"
              />
            )}

            {(registrationError || semaphoreError) && (
              <AnonymousApplyFeedback registrationError={registrationError} semaphoreError={semaphoreError} />
            )}

            <AnimatePresence>
              {trial.applicationStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-lg border text-xs font-medium",
                    trial.applicationStatus === "Accepted"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800"
                      : trial.applicationStatus === "Rejected"
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-700"
                        : "bg-slate-500/10 border-slate-500/20 text-slate-600"
                  )}
                >
                  <p className="mb-1">Status: {trial.applicationStatus}</p>
                  {trial.applicationMessage && (
                    <p className="text-[10px] opacity-80 leading-relaxed italic">&ldquo;{trial.applicationMessage}&rdquo;</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {applyStatus === "success" && isEligibleDecrypted === false && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80 p-4 text-left text-amber-950 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20 dark:text-amber-100"
              >
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Info className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">
                      Not eligible to apply
                    </p>
                    <p className="text-sm font-medium leading-snug">{NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {poolFunded && trial.applicationStatus === "Accepted" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-4 rounded-xl border space-y-3",
                  trial.incentivePool?.distributed
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        trial.incentivePool?.distributed ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                      )}
                    >
                      <Coins className="h-3.5 w-3.5" />
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                      {trial.incentivePool?.distributed ? "Payout secured" : "Incentive enclave"}
                    </h5>
                  </div>
                  {trial.incentivePool?.distributed ? (
                    <Badge className="bg-emerald-600 text-white border-0 text-[9px]">Confirmed</Badge>
                  ) : (
                    !isRegistered && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-700 bg-amber-50">
                        Action required
                      </Badge>
                    )
                  )}
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  {trial.incentivePool?.distributed
                    ? "Rewards are available in your private enclave. Open Medical Vault to reveal and withdraw."
                    : "This trial has a funded incentive pool. Register to secure your encrypted reward share."}
                </p>
                {trial.incentivePool?.distributed ? (
                  <Link to="/patient/medical-vault" className="block">
                    <Button className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest gap-2">
                      Medical Vault
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </Link>
                ) : !isRegistered ? (
                  <Button
                    className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest gap-2"
                    onClick={handleRegisterForRewards}
                    disabled={isRegistering}
                  >
                    {isRegistering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {isRegistering ? "Registering..." : "Join reward pool"}
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 text-[10px] font-bold">
                    <CheckCircle className="h-3 w-3" /> Registered for incentives
                  </div>
                )}
                {incentiveStatus && (
                  <p
                    className={cn(
                      "text-[9px] font-semibold text-center",
                      incentiveStatus.includes("failed") ? "text-rose-600" : "text-teal-700"
                    )}
                  >
                    {incentiveStatus}
                  </p>
                )}
              </motion.div>
            )}

            {applyError && <p className="text-xs text-center text-rose-600 font-medium">{applyError}</p>}

            <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2">
                Protocol &amp; eligibility details
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 p-4 space-y-6 bg-slate-50/40">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Eligibility analysis</h4>
                  <ul className="space-y-2">
                    {trial.breakdown?.met?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {trial.breakdown?.borderline?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {trial.breakdown?.missing?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <XCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {(!trial.breakdown ||
                      (trial.breakdown.met.length === 0 && trial.breakdown.missing.length === 0)) && (
                      <li className="text-sm text-slate-500 italic">Upload your medical profile to run encrypted eligibility checks.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Secure disclosure</h4>
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                    Apply with FHE-encrypted zero-knowledge proofs. Minimal metadata is shared with the investigator.
                  </p>
                  <div className="space-y-2 p-3 rounded-lg bg-white border border-slate-100">
                    {["Anonymized vitals", "Encrypted labs", "ZKP diagnosis"].map((tag) => (
                      <div key={tag} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <div className="h-1 w-1 rounded-full bg-teal-500" /> {tag}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

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
              {!trial.hasConsent && applyStatus !== "applied" && !trial.applicationStatus && !isDiscover && (
                <p className="text-xs text-slate-500 mb-3">
                  Anonymous apply embeds consent in your Semaphore proof — no separate consent transaction required.
                </p>
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

                      {isGlass ? (
                        <Link to={`/sponsor/trials/${trial.id}`}>
                          <Button className="mt-6 w-full shadow-lg shadow-accent/20">
                            Manage Recruitment
                          </Button>
                        </Link>
                      ) : (
                        <div className="mt-6 space-y-2">
                          <Button
                            className={cn(
                              "w-full shadow-lg gap-2 font-bold",
                              hasApplied || trial.applicationStatus
                                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                                : (registrationStatus === "error" || semaphoreError)
                                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                                  : "bg-accent hover:bg-accent/90 shadow-accent/20"
                            )}
                            onClick={handleMainButtonClick}
                            disabled={isMainButtonDisabled}
                          >
                            {getApplyButtonContent()}
                          </Button>

                          {(isSubmitting || isGeneratingSemaphore || hasApplied || trial.applicationStatus || registrationError || semaphoreError) && (
                            <AnonymousApplyWizard
                              phase={applyWizardPhase}
                              walletRegistered={isSemaphoreRegistered}
                              semaphoreRegistered={isSemaphoreRegistered}
                              hasProfile={isRegistered || isSemaphoreRegistered}
                              trialId={trial.id}
                              nullifier={applyWizardNullifier}
                              provider={signer?.provider ?? null}
                              errorMessage={registrationError || semaphoreError || applyError}
                            />
                          )}

                          {/* Semaphore error message */}
                          {(registrationError || semaphoreError) && (
                            <AnonymousApplyFeedback registrationError={registrationError} semaphoreError={semaphoreError} />
                          )}

                          {/* Status messages */}
                          <AnimatePresence>
                            {trial.applicationStatus && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  "p-3 rounded-lg border text-xs font-medium",
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
                                    "{trial.applicationMessage}"
                                  </p>
                                )}
                              </motion.div>
                            )}

                            {/* FIX 1: Show ineligibility message based on ebool, not score */}
                            {applyStatus === "success" && isEligibleDecrypted === false && (
                              <motion.div
                                role="status"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80 p-4 text-left text-amber-950 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20 dark:text-amber-100"
                              >
                                <div className="flex gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                    <Info className="h-5 w-5" aria-hidden />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">
                                      Not eligible to apply
                                    </p>
                                    <p className="text-sm font-medium leading-snug">{NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}

                            {applyStatus === "applied" && !trial.applicationStatus && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-center text-emerald-500 font-medium"
                              >
                                Application submitted to sponsor!
                              </motion.p>
                            )}

                            {/* Incentive Registration Section */}
                            {poolFunded && trial.applicationStatus === "Accepted" && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
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
                                  <Link to="/patient/medical-vault" className="block w-full">
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
                                className="text-xs text-center text-rose-400 font-medium"
                              >
                                {applyError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
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
