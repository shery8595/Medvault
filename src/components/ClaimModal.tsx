import React, { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
    Coins,
    ShieldCheck,
    Wallet,
    Info,
    Loader2,
    TrendingUp,
    Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAaveYield } from "../hooks/useAaveYield";
import { useStaking } from "../hooks/useStaking";
import { useWeb3 } from "../lib/Web3Context";
import { getStakingManager, getSponsorIncentiveVault } from "../lib/contracts";
import { cn } from "../lib/utils";
import { reencryptUint64WithEphemeral } from "../lib/fhe";
import { getConfidentialETH } from "../lib/contracts";
import { resolveAnonymousNullifier, getStoredIdentity, getEphemeralSigner, generateEphemeralAddress } from "../lib/semaphore";
import { claimRewardsWithCompletion, type ClaimWizardStep } from "../lib/claimFlow";
import { getParticipantReceiptStatus } from "../lib/confirmReceiptFlow";
import { ClaimWizard } from "./claim/ClaimWizard";

const formatMicroEth = (units: number) => (units / 1_000_000).toFixed(6);

interface ClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    trialId: string;
    nullifier: string | bigint | null;
}

export function ClaimModal({ isOpen, onClose, trialId, nullifier }: ClaimModalProps) {
    const { apy, loading: apyLoading, source: apySource } = useAaveYield();
    const { loading: stakeLoading } = useStaking();
    const { signer, account } = useWeb3();
    const [wizardStep, setWizardStep] = useState<ClaimWizardStep>("preview");
    const [status, setStatus] = useState<string | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [staking, setStaking] = useState(false);
    const [previewEth, setPreviewEth] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
    const [confirmTxHash, setConfirmTxHash] = useState<string | null>(null);
    const [completeTxHash, setCompleteTxHash] = useState<string | null>(null);
    const [hasStagedEntitlement, setHasStagedEntitlement] = useState(false);

    const loadEphemeralRewardPreview = useCallback(async () => {
        if (!signer) return;
        const identity = getStoredIdentity();
        if (!identity) {
            setPreviewEth(null);
            setHasStagedEntitlement(false);
            return;
        }
        const provider = signer.provider;
        if (!provider) return;

        setPreviewLoading(true);
        try {
            const ephemeralAddress = await generateEphemeralAddress(identity);
            const cETH = getConfidentialETH(signer);
            const contractAddress = await cETH.getAddress();
            const vault = getSponsorIncentiveVault(signer);

            const receiptStatus = await getParticipantReceiptStatus(signer, trialId, ephemeralAddress, 0);
            setHasStagedEntitlement(receiptStatus.entitlementStaged && !receiptStatus.confirmedPayout);

            if (receiptStatus.entitlementStaged && !receiptStatus.confirmedPayout && receiptStatus.stagedShareWei > 0n) {
                setPreviewEth((Number(receiptStatus.stagedShareWei) / 1e18).toFixed(6));
                return;
            }

            const handle = await cETH.getBalance(ephemeralAddress);
            const handleStr = handle.toString();
            if (!handleStr || BigInt(handleStr) === 0n) {
                const stagedWei = await vault.getStagedShareWei(BigInt(trialId), ephemeralAddress, 0);
                if (BigInt(stagedWei) > 0n) {
                    setPreviewEth((Number(stagedWei) / 1e18).toFixed(6));
                    setHasStagedEntitlement(true);
                } else {
                    setPreviewEth("0.000000");
                }
                return;
            }

            const ephemeralSigner = getEphemeralSigner(identity, provider);
            const decrypted = await reencryptUint64WithEphemeral(
                ephemeralSigner,
                contractAddress,
                handleStr
            );
            setPreviewEth(formatMicroEth(Number(decrypted)));
        } catch {
            setPreviewEth(null);
            setHasStagedEntitlement(false);
        } finally {
            setPreviewLoading(false);
        }
    }, [signer, trialId]);

    useEffect(() => {
        if (!isOpen) {
            setPreviewEth(null);
            setPreviewLoading(false);
            setStatus(null);
            setWizardStep("preview");
            setClaimTxHash(null);
            setConfirmTxHash(null);
            setCompleteTxHash(null);
            setHasStagedEntitlement(false);
            return;
        }
        void loadEphemeralRewardPreview();
        if (account) setWizardStep("destination");
    }, [isOpen, loadEphemeralRewardPreview, account]);

    const claimEphemeralRewardToWallet = async () => {
        if (!signer || !account) throw new Error("Wallet not connected.");

        const identity = getStoredIdentity();
        if (!identity) {
            throw new Error("Local Semaphore identity not found. Cannot claim rewards.");
        }

        const provider = signer.provider;
        if (!provider) throw new Error("Wallet provider not available");

        const resolvedNullifier = nullifier ? BigInt(nullifier) : await resolveAnonymousNullifier(provider, BigInt(trialId));
        if (!resolvedNullifier) {
            throw new Error("Nullifier could not be resolved");
        }

        const ephemeralSigner = getEphemeralSigner(identity, provider);
        const ephemeralAddress = await generateEphemeralAddress(identity);

        const cETH = getConfidentialETH(signer);
        const handle = await cETH.getBalance(ephemeralAddress);
        const handleStr = handle.toString();
        let units = 0;

        if (handleStr && BigInt(handleStr) !== 0n) {
            const decrypted = await reencryptUint64WithEphemeral(
                ephemeralSigner,
                await cETH.getAddress(),
                handleStr
            );
            units = Number(decrypted);
        }

        if (units <= 0 && !hasStagedEntitlement) {
            throw new Error("No staged entitlement or cETH balance to claim.");
        }

        setWizardStep(hasStagedEntitlement && units <= 0 ? "confirming" : "claiming");
        const result = await claimRewardsWithCompletion(
            signer,
            trialId,
            resolvedNullifier,
            account,
            units > 0 ? units : 1,
            (p) => {
                setWizardStep(p.step);
                setStatus(p.message);
                if (p.confirmTxHash) setConfirmTxHash(p.confirmTxHash);
                if (p.claimTxHash) setClaimTxHash(p.claimTxHash);
                if (p.completeTxHash) setCompleteTxHash(p.completeTxHash);
            },
            identity
        );

        setClaimTxHash(result.claimTxHash);
        if (result.completeTxHash) setCompleteTxHash(result.completeTxHash);

        return {
            units,
            claimedWei: BigInt(units) * 1_000_000_000_000n,
        };
    };

    const handleClaimDirect = async () => {
        try {
            setClaiming(true);
            setStatus("Starting secure payout wizard…");
            await claimEphemeralRewardToWallet();
            setWizardStep("receipt");
            setStatus("Claim successful! Funds moved to your main wallet.");
            setTimeout(onClose, 2500);
        } catch (err: any) {
            console.error("Direct claim failed:", err);
            setWizardStep("error");
            setStatus(`Error: ${err.reason || err.message || "Failed to claim"}`);
        } finally {
            setClaiming(false);
        }
    };

    const handleStakeOnAave = async () => {
        if (!signer) return;
        try {
            setStaking(true);
            setStatus("Claiming encrypted reward into your main wallet...");
            const { claimedWei } = await claimEphemeralRewardToWallet();

            setStatus("Staking claimed funds into Aave V3...");
            const stakingManager = getStakingManager(signer);
            const tx = await stakingManager.stake({ value: claimedWei });
            await tx.wait();

            setWizardStep("receipt");
            setStatus("Staking successful! Your claimed reward is now earning through Aave.");
            setTimeout(onClose, 2500);
        } catch (err: any) {
            setWizardStep("error");
            setStatus(`Error: ${err.message || "Failed to stake"}`);
        } finally {
            setStaking(false);
        }
    };

    const isLoading = claiming || staking || stakeLoading;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-[32px]">
                <div className="relative p-8">
                    <div className="absolute top-0 right-0 p-8">
                        <Sparkles className="h-12 w-12 text-accent/10 animate-pulse" />
                    </div>

                    <DialogHeader className="relative z-10">
                        <Badge variant="secondary" className="w-fit mb-4 bg-accent/10 text-accent border-accent/20 font-mono text-[10px] tracking-widest uppercase py-1">
                            Secure Payout
                        </Badge>
                        <DialogTitle className="text-3xl font-display font-black tracking-tight text-slate-900 dark:text-white">
                            Claim Compensation
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                            Confirm staged entitlements, then move confidential cETH to your main wallet via claimParticipantRewards and relayer completeWithdrawTo.
                        </DialogDescription>
                    </DialogHeader>

                    <ClaimWizard
                        className="mt-6"
                        step={wizardStep}
                        destination={account ?? ""}
                        previewEth={previewEth}
                        previewLoading={previewLoading}
                        confirmTxHash={confirmTxHash}
                        claimTxHash={claimTxHash}
                        completeTxHash={completeTxHash}
                        statusMessage={status}
                    />

                    <div className="mt-6 p-6 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Available Payout</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-slate-900 dark:text-white">
                                {previewLoading ? "…" : previewEth ?? "Private"}
                            </span>
                            <span className="text-xl font-bold text-slate-400 uppercase">ETH</span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold leading-tight">Stake on Aave V3</p>
                                <p className="text-[10px] font-medium opacity-80">Claim to your main wallet, then stake the same amount into the Aave WETH market.</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black leading-none">{apyLoading ? "..." : `${apy}%`}</p>
                                <p className="text-[9px] font-bold uppercase tracking-tighter opacity-60">Est. APR</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <ShieldCheck className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold leading-tight">Privacy Guard Enabled</p>
                                <p className="text-[10px] font-medium opacity-80">Your intent is hidden using Zama FHE.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold"
                            onClick={handleClaimDirect}
                            disabled={isLoading}
                        >
                            {claiming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                            <span className="text-xs uppercase tracking-wider">Main Wallet</span>
                        </Button>
                        <Button
                            className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-accent hover:bg-accent/90 text-white font-bold shadow-lg shadow-accent/25 overflow-hidden group"
                            onClick={handleStakeOnAave}
                            disabled={isLoading}
                        >
                            {staking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coins className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                            <span className="text-xs uppercase tracking-wider">Stake & Earn</span>
                        </Button>
                    </div>

                    {status && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "mt-6 p-4 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2",
                                status.includes("Error") ? "bg-rose-50 text-rose-500 border border-rose-100" : "bg-accent/5 text-accent border border-accent/10"
                            )}
                        >
                            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status}
                        </motion.div>
                    )}

                    <div className="mt-6 flex items-start gap-2 text-slate-400">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <p className="text-[10px] leading-relaxed italic">
                            {hasStagedEntitlement
                                ? "Staged rewards require confirmReceipt before claim. Your ephemeral key submits confirm txs; the main wallet runs FHE public decrypt."
                                : "Main Wallet runs confirmReceipt → claimParticipantRewards → completeWithdrawTo via the relayer KMS proof."}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
