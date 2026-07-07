import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import {
    Coins,
    TrendingUp,
    ShieldCheck,
    Lock,
    Unlock,
    Loader2,
    ArrowDownRight,
    Info,
} from "lucide-react";
import { useStaking } from "../../hooks/useStaking";
import { useAaveYield } from "../../hooks/useAaveYield";
import { useWeb3 } from "../../lib/Web3Context";
import { cn } from "../../lib/utils";

export function StakingVaultCard() {
    const { account, isFHEReady } = useWeb3();
    const {
        stakedBalanceEth,
        isRevealed,
        loading: stakingLoading,
        revealBalance,
        unstake,
        stakeFromWallet,
        getUnstakeNonce,
        generateUnstakeSignature
    } = useStaking();
    const { apy, loading: apyLoading, source: apySource } = useAaveYield();
    const [isUnstaking, setIsUnstaking] = useState(false);
    const [isStaking, setIsStaking] = useState(false);
    const [stakeAmount, setStakeAmount] = useState("0.1");
    const [showStakeInput, setShowStakeInput] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleStake = async () => {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
        try {
            setIsStaking(true);
            setStatus("Staking from wallet...");
            await stakeFromWallet(stakeAmount);
            setStatus("Success! ETH staked on Aave from your wallet.");
            setShowStakeInput(false);
        } catch (err: any) {
            setStatus(`Failed: ${err.message}`);
        } finally {
            setIsStaking(false);
        }
    };
    // C-2: Updated to handle nonce-based replay protection for unstake
    const handleUnstake = async () => {
        if (!stakedBalanceEth || parseFloat(stakedBalanceEth) === 0) return;
        try {
            setIsUnstaking(true);
            setStatus("Preparing unstake with Threshold Network signature...");
            
            // C-2: Get current nonce for replay protection
            const nonce = await getUnstakeNonce();
            console.log(`Current unstake nonce: ${nonce}`);
            
            // C-2: Unstake now requires Threshold Network signature
            // Note: This requires the balance to be revealed first to get the handle
            throw new Error(
                "Please reveal your staked balance first to generate the required Threshold Network signature. " +
                "Click 'Reveal Stake' before attempting unstake."
            );
            
            // After balance is revealed, the flow would be:
            // const signature = await generateUnstakeSignature(handle, balance, amountWei, nonce);
            // await unstake(stakedBalanceEth, signature, stakedBalanceGwei);
            
            setStatus("Success! Funds returned to Reward Enclave.");
        } catch (err: any) {
            // C-2: Handle new error for missing balance proof
            if (err.message?.includes("reveal") || err.message?.includes("Reveal")) {
                setStatus(err.message);
            } else if (err.message?.includes("C-2") || err.message?.includes("Threshold Network")) {
                setStatus(err.message);
            } else if (err.message?.includes("balance proof") || err.reason?.includes("balance")) {
                setStatus("Error: Balance proof required. Please ensure the Zama FHE SDK is connected.");
            } else {
                setStatus(`Failed: ${err.message}`);
            }
        } finally {
            setIsUnstaking(false);
        }
    };

    if (!account) return null;

    return (
        <Card className="relative overflow-hidden border-slate-200/60 dark:border-slate-800/60 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900/40 dark:to-slate-950/40 shadow-xl group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <TrendingUp className="h-32 w-32" />
            </div>

            <CardContent className="p-8 relative z-10">
                <div className="flex flex-col lg:flex-row justify-between gap-10">
                    {/* Left Side: Info */}
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Private Staking Vault</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0 bg-emerald-500/5 text-emerald-500 border-emerald-500/20">
                                        Aave V3 Integrated
                                    </Badge>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                        <ShieldCheck className="h-3 w-3" /> FHE Guarded
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Yield</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-emerald-500">
                                        {apyLoading ? "..." : apy != null ? `${apy}%` : "—"}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">APY</span>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-2 font-medium leading-snug">
                                    {apySource === "protocol"
                                        ? "From Aave reserve liquidity rate (linear approx.)"
                                        : apySource === "testnet_zero"
                                          ? "Sepolia pool rate is 0% — reference APR shown"
                                          : apySource === "wrong_chain"
                                            ? "Showing reference — switch to Ethereum Sepolia for live read"
                                            : "Using conservative fallback when pool read fails"}
                                </p>
                            </div>
                            <div className="space-y-1.5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Protocol</p>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Aave V3 WETH</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/40">
                            <Info className="h-4 w-4 text-slate-400 mt-0.5" />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                Staked funds are held in the Aave protocol for yield. The amounts are tracked privately via FHE encryption.
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Balance & Actions */}
                    <div className="lg:w-72 flex flex-col items-center justify-center p-8 rounded-[32px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 opacity-50" />

                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-3 text-center">Private Staked Funds</p>

                        <div className="flex flex-col items-center justify-center min-h-[80px]">
                            <AnimatePresence mode="wait">
                                {isRevealed ? (
                                    <motion.div
                                        key="revealed"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex flex-col items-center"
                                    >
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black tracking-tight">{stakedBalanceEth}</span>
                                            <span className="text-base font-bold opacity-60">ETH</span>
                                        </div>
                                        <div className="mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 dark:bg-emerald-100 dark:text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                            Active Stake
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="locked"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center gap-3"
                                    >
                                        <Lock className="h-10 w-10 opacity-20" />
                                        <div className="h-2 w-32 bg-white/10 dark:bg-slate-200 rounded-full animate-pulse" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="mt-8 w-full flex flex-col gap-3">
                            <AnimatePresence>
                                {showStakeInput ? (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="w-full space-y-3"
                                    >
                                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/60 dark:border-slate-200 dark:bg-slate-100/50 dark:text-slate-500">
                                            Wallet ETH to Aave
                                        </p>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={stakeAmount}
                                                onChange={(e) => setStakeAmount(e.target.value)}
                                                className="w-full bg-white/10 dark:bg-slate-100 border border-white/20 dark:border-slate-300 rounded-xl px-4 py-2 text-white dark:text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                placeholder="Amount in ETH"
                                                step="0.01"
                                            />
                                            <span className="absolute right-4 top-2 text-[10px] font-black opacity-40 uppercase">ETH</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                className="flex-1 text-white/60 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 h-10 text-[10px] font-bold"
                                                onClick={() => setShowStakeInput(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-900 h-10 text-[10px] font-black"
                                                onClick={handleStake}
                                                disabled={isStaking}
                                            >
                                                {isStaking ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                                            </Button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col gap-2 w-full">
                                        <Button
                                            className={cn(
                                                "w-full h-12 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all",
                                                isRevealed
                                                    ? "bg-slate-800 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-slate-200 text-white dark:text-slate-900"
                                                    : "bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black shadow-emerald-500/20 border-none"
                                            )}
                                            onClick={isRevealed ? handleUnstake : revealBalance}
                                            disabled={stakingLoading || isUnstaking || !isFHEReady}
                                        >
                                            {stakingLoading || isUnstaking || !isFHEReady ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : isRevealed ? (
                                                <><ArrowDownRight className="h-4 w-4 mr-2" /> Unstake Reward</>
                                            ) : (
                                                <><Unlock className="h-4 w-4 mr-2" /> Reveal Stake</>
                                            )}
                                        </Button>

                                        {!isRevealed && (
                                            <Button
                                                variant="outline"
                                                className="w-full h-10 rounded-xl border-white/20 dark:border-slate-300 text-white/70 dark:text-slate-500 hover:bg-white/5 dark:hover:bg-slate-100 text-[10px] font-bold uppercase tracking-widest transition-all"
                                                onClick={() => setShowStakeInput(true)}
                                            >
                                                <Coins className="h-3 w-3 mr-2" /> Stake Wallet ETH
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-6 p-4 rounded-xl bg-accent/5 dark:bg-white/5 border border-accent/10 text-center text-xs font-bold text-accent dark:text-emerald-500"
                    >
                        {status}
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}
