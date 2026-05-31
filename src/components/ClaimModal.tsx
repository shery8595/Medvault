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
import { motion, AnimatePresence } from "framer-motion";
import { useAaveYield } from "../hooks/useAaveYield";
import { useStaking } from "../hooks/useStaking";
import { useWeb3 } from "../lib/Web3Context";
import { getStakingManager } from "../lib/contracts";
import { cn } from "../lib/utils";

import { decryptForTxWithPermit, forceConnectFHE, reencryptUint64, restoreMainFheSession } from "../lib/fhe";
import { getConfidentialETH } from "../lib/contracts";
import { resolveAnonymousNullifier, getStoredIdentity, getEphemeralSigner, generateEphemeralAddress } from "../lib/semaphore";
import { claimRewardsWithSignature } from "../lib/contracts/sponsorAdapters";

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
    const [status, setStatus] = useState<string | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [staking, setStaking] = useState(false);
    const [previewEth, setPreviewEth] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const loadEphemeralRewardPreview = useCallback(async () => {
        if (!signer) return;
        const identity = getStoredIdentity();
        if (!identity) {
            setPreviewEth(null);
            return;
        }
        const provider = signer.provider;
        if (!provider) return;

        setPreviewLoading(true);
        try {
            const ephemeralAddress = await generateEphemeralAddress(identity);
            const cETH = getConfidentialETH(signer);
            const contractAddress = await cETH.getAddress();
            const handle = await cETH.getBalance(ephemeralAddress);
            const handleStr = handle.toString();
            if (!handleStr || BigInt(handleStr) === 0n) {
                setPreviewEth("0.000000");
                return;
            }

            const ephemeralSigner = getEphemeralSigner(identity, provider);
            await forceConnectFHE(provider, ephemeralSigner);
            try {
                const decrypted = await reencryptUint64(contractAddress, ephemeralAddress, handleStr);
                setPreviewEth(formatMicroEth(Number(decrypted)));
            } finally {
                await restoreMainFheSession(provider, signer);
            }
        } catch {
            setPreviewEth(null);
        } finally {
            setPreviewLoading(false);
        }
    }, [signer]);

    useEffect(() => {
        if (!isOpen) {
            setPreviewEth(null);
            setPreviewLoading(false);
            setStatus(null);
            return;
        }
        void loadEphemeralRewardPreview();
    }, [isOpen, loadEphemeralRewardPreview]);

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

        try {
            const cETH = getConfidentialETH(signer);
            const handle = await cETH.getBalance(ephemeralAddress);
            const handleStr = handle.toString();

            if (!handleStr || BigInt(handleStr) === 0n) {
                throw new Error("Ephemeral rewards balance is empty.");
            }

            const balanceHandle = BigInt(handleStr);

            setStatus("Signing Threshold Network decryption signature using ephemeral key...");
            const result = await decryptForTxWithPermit(balanceHandle, provider, ephemeralSigner);

            const units = Number(result.decryptedValue);
            if (units <= 0) throw new Error("Ephemeral rewards balance is empty.");

            setStatus("Submitting secure payout claim transaction...");
            await claimRewardsWithSignature(
                signer,
                trialId,
                resolvedNullifier,
                account,
                units,
                result.signature,
                result.decryptedValue
            );

            return {
                units,
                claimedWei: BigInt(units) * 1_000_000_000_000n,
            };
        } finally {
            await restoreMainFheSession(provider, signer);
        }
    };

    const handleClaimDirect = async () => {
        try {
            setClaiming(true);
            setStatus("Generating secure payout signature... Check your wallet.");
            await claimEphemeralRewardToWallet();
            setStatus("Claim successful! Funds moved to your main wallet.");
            setTimeout(onClose, 2000);
        } catch (err: any) {
            console.error("Direct claim failed:", err);
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

            setStatus("Staking successful! Your claimed reward is now earning through Aave.");
            setTimeout(onClose, 2000);
        } catch (err: any) {
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
                    {/* Header with Sparkles */}
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
                            Move rewards from your ephemeral payout address to your wallet, or claim and stake them into Aave.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Amount Display */}
                    <div className="mt-8 p-6 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Available Payout</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-slate-900 dark:text-white">
                                {previewLoading ? "…" : previewEth ?? "Private"}
                            </span>
                            <span className="text-xl font-bold text-slate-400 uppercase">ETH</span>
                        </div>
                        <p className="mt-2 text-[10px] font-medium text-slate-400">
                            {previewEth
                                ? "Full encrypted ephemeral balance — claimed in one transaction."
                                : "Connect your Semaphore identity to preview and claim your reward balance."}
                        </p>
                    </div>

                    {/* Staking Features */}
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
                                <p className="text-[9px] opacity-60 mt-1">
                                    {apySource === "protocol"
                                        ? "Live Aave pool snapshot"
                                        : apySource === "wrong_chain"
                                          ? "Wrong network — reference"
                                          : "Fallback / degraded read"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <ShieldCheck className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold leading-tight">Privacy Guard Enabled</p>
                                <p className="text-[10px] font-medium opacity-80">Your intent is hidden using secure FHE.</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
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
                            Main Wallet sends ETH to your connected wallet. Stake & Earn claims the reward first, then submits the claimed amount to Aave.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
