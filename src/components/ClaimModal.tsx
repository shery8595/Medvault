import React, { useState } from "react";
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
    ArrowUpRight,
    Wallet,
    Info,
    Loader2,
    TrendingUp,
    Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAaveYield } from "../hooks/useAaveYield";
import { useConfidentialBalance } from "../hooks/useConfidentialBalance";
import { useStaking } from "../hooks/useStaking";
import { useWeb3 } from "../lib/Web3Context";
import { getStakingManager } from "../lib/contracts";
import { cn } from "../lib/utils";

interface ClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    amountEth: string; // The amount currently in the vault/cETH available to claim
}

export function ClaimModal({ isOpen, onClose, amountEth }: ClaimModalProps) {
    const { apy, loading: apyLoading } = useAaveYield();
    const { withdraw, loading: withdrawLoading } = useConfidentialBalance();
    const { loading: stakeLoading } = useStaking();
    const { signer } = useWeb3();
    const [status, setStatus] = useState<string | null>(null);

    const handleClaimDirect = async () => {
        try {
            setStatus("Preparing withdrawal...");
            await withdraw(amountEth);
            setStatus("Success!");
            setTimeout(onClose, 2000);
        } catch (err: any) {
            setStatus(`Error: ${err.message || "Failed to claim"}`);
        }
    };

    const handleStakeOnAave = async () => {
        if (!signer) return;
        try {
            setStatus("Initiating private stake...");
            const stakingManager = getStakingManager(signer);

            // Amount is in ETH, StakingManager expects units (micro-ETH)
            const units = Math.floor(parseFloat(amountEth) * 1_000_000);

            const tx = await stakingManager.stakeFromConfidential(units);
            await tx.wait();

            setStatus("Staking successful!");
            setTimeout(onClose, 2000);
        } catch (err: any) {
            setStatus(`Error: ${err.message || "Failed to stake"}`);
        }
    };

    const isLoading = withdrawLoading || stakeLoading;

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
                            Choose how you wish to receive your trial rewards. Your choice remains encrypted on-chain.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Amount Display */}
                    <div className="mt-8 p-6 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Available Payout</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-slate-900 dark:text-white">{amountEth}</span>
                            <span className="text-xl font-bold text-slate-400 uppercase">ETH</span>
                        </div>
                    </div>

                    {/* Staking Features */}
                    <div className="mt-6 space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold leading-tight">Stake on Aave V3</p>
                                <p className="text-[10px] font-medium opacity-80">Earn yield while keeping your balance private.</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black leading-none">{apyLoading ? "..." : `${apy}%`}</p>
                                <p className="text-[9px] font-bold uppercase tracking-tighter opacity-60">Est. APY</p>
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
                            <Wallet className="h-5 w-5" />
                            <span className="text-xs uppercase tracking-wider">Direct Claim</span>
                        </Button>
                        <Button
                            className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-accent hover:bg-accent/90 text-white font-bold shadow-lg shadow-accent/25 overflow-hidden group"
                            onClick={handleStakeOnAave}
                            disabled={isLoading}
                        >
                            <Coins className="h-5 w-5 group-hover:scale-110 transition-transform" />
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
                            Claiming direct sends ETH to your wallet. Staking converts ETH to aWETH and records the amount in your private staking profile.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
