import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
    Coins,
    Wallet,
    ArrowUpRight,
    ShieldCheck,
    Lock,
    Unlock,
    AlertCircle,
    Loader2,
    CheckCircle2,
    TrendingUp
} from "lucide-react";
import { useWeb3 } from "../../lib/Web3Context";
import { getConfidentialETH } from "../../lib/contracts";
import { reencryptUint64 } from "../../lib/fhe";
import addresses from "../../lib/contracts/addresses.json";
import { ethers } from "ethers";
import { useStaking } from "../../hooks/useStaking";

export function RewardsCard() {
    const { account, signer, isFHEReady } = useWeb3();
    const [encryptedBalance, setEncryptedBalance] = useState<string | null>(null);
    const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [isStaking, setIsStaking] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const { stakeFromConfidential } = useStaking();

    const cETHAddress = (addresses as any).sepolia.ConfidentialETH;

    const fetchEncryptedBalance = async () => {
        if (!signer || !account) return;
        try {
            const cETH = getConfidentialETH(signer);
            const balance = await cETH.getBalance(account);
            setEncryptedBalance(balance.toString());
        } catch (err: any) {
            console.error("REWARDS Error:", err);
            setStatus("Could not sync with Reward Enclave.");
        }
    };

    useEffect(() => {
        if (signer && account) {
            fetchEncryptedBalance();
        }
    }, [signer, account]);

    const handleReveal = async () => {
        if (!encryptedBalance || !account) {
            return;
        }

        // Normalize handle: sometimes it's returned as a decimal string or short hex
        let normalizedHandle = encryptedBalance;
        if (!normalizedHandle.startsWith("0x")) {
            try {
                normalizedHandle = "0x" + BigInt(normalizedHandle).toString(16).padStart(64, "0");
            } catch (e) {
                // No need to log error here, it will be caught by the main try/catch if it's a real issue
            }
        }

        // Handle zero handle case explicitly
        if (normalizedHandle === "0x0000000000000000000000000000000000000000000000000000000000000000" || normalizedHandle === "0x0") {
            setDecryptedBalance(0);
            setStatus("Secure scan complete: Your private balance is empty.");
            return;
        }

        setIsDecrypting(true);
        setStatus("Waiting for secure signature... Check your wallet.");
        try {
            const clearValue = await reencryptUint64(cETHAddress, account, normalizedHandle);
            setDecryptedBalance(Number(clearValue));
            setStatus("Balance successfully revealed.");
        } catch (err: any) {
            console.error("Decryption error:", err);
            setStatus(`Decryption failed: ${err.message || "Unknown error"}.`);
        } finally {
            setIsDecrypting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!decryptedBalance || !signer || decryptedBalance === 0) return;
        setIsWithdrawing(true);
        setStatus("Processing withdrawal...");
        try {
            const cETH = getConfidentialETH(signer);
            const tx = await cETH.withdraw(decryptedBalance);
            await tx.wait();
            setStatus("Withdrawal successful!");
            setDecryptedBalance(0);
            fetchEncryptedBalance();
        } catch (err: any) {
            console.error(err);
            setStatus(`Withdrawal failed: ${err.reason || err.message}`);
        } finally {
            setIsWithdrawing(false);
        }
    };

    const handleStakeRewards = async () => {
        if (!decryptedBalance || !signer || decryptedBalance === 0) return;
        setIsStaking(true);
        setStatus("Moving funds to Staking Vault...");
        try {
            // decryptedBalance is in micro-ETH
            const ethValue = (decryptedBalance * 1e-6).toString();
            await stakeFromConfidential(ethValue);
            setStatus("Success! Funds moved to Private Staking Vault.");
            setDecryptedBalance(0);
            fetchEncryptedBalance();
        } catch (err: any) {
            console.error(err);
            setStatus(`Staking failed: ${err.message}`);
        } finally {
            setIsStaking(false);
        }
    };

    const ethValue = decryptedBalance ? (decryptedBalance * 1e-6).toFixed(6) : "0.000000";

    return (
        <Card className="relative overflow-hidden border-white/10 glass-panel shadow-2xl group transition-all duration-500 hover:shadow-[0_0_30px_rgba(var(--color-accent),0.1)] hover:border-accent/30">
            {/* Background pattern - Added pointer-events-none to prevent blocking clicks */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                <Coins className="h-32 w-32 rotate-12 text-white" />
            </div>

            <CardContent className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/20 text-[10px] font-bold uppercase tracking-widest text-accent shadow-[0_0_10px_var(--color-accent)]">
                            <ShieldCheck className="h-3 w-3 drop-shadow-[0_0_5px_var(--color-accent)]" />
                            Confidential Payouts
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2 drop-shadow-sm">
                                <Wallet className="h-6 w-6 text-accent drop-shadow-[0_0_8px_var(--color-accent)]" />
                                Reward Enclave
                            </h3>
                            <p className="text-sm text-slate-400">
                                Your clinical trial incentives are protected by FHE.
                            </p>
                        </div>

                        <div className="flex items-center gap-6 pt-2">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</p>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${decryptedBalance !== null ? "bg-accent shadow-[0_0_5px_var(--color-accent)]" : "bg-amber-500"} animate-pulse`} />
                                    <span className="text-xs font-bold text-slate-200">
                                        {decryptedBalance !== null ? "Revealed" : "Encrypted"}
                                    </span>
                                </div>
                            </div>
                            <div className="h-10 w-[1px] bg-white/10" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Units</p>
                                <p className="text-xs font-bold text-slate-200">
                                    micro-ETH (μETH)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-6 relative z-20">
                        <div className="text-center md:text-right space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Your Private Balance</p>
                            <div className="flex items-center gap-3">
                                {decryptedBalance !== null ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-baseline gap-2"
                                    >
                                        <span className="text-4xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                            {ethValue}
                                        </span>
                                        <span className="text-lg font-bold text-accent">ETH</span>
                                    </motion.div>
                                ) : (
                                    <div className="h-12 w-48 bg-blue-950/40 border border-white/5 rounded-2xl animate-pulse flex items-center justify-center">
                                        <Lock className="h-5 w-5 text-slate-500" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {decryptedBalance === null ? (
                                <Button
                                    key="reveal-button"
                                    onClick={handleReveal}
                                    disabled={isDecrypting || !encryptedBalance || !isFHEReady}
                                    className="bg-white hover:bg-slate-100 text-black border border-transparent rounded-xl h-12 px-6 font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] flex gap-2 relative z-30 transition-all hover:scale-105"
                                >
                                    {isDecrypting || !isFHEReady ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                    ) : (
                                        <Unlock className="h-4 w-4" />
                                    )}
                                    {!isFHEReady ? "Initializing..." : isDecrypting ? "Decrypting..." : "Reveal Balance"}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        key="stake-button"
                                        onClick={handleStakeRewards}
                                        disabled={isStaking || decryptedBalance === 0}
                                        className="bg-accent hover:bg-accent/90 text-white rounded-xl h-12 px-6 font-bold shadow-lg shadow-accent/20 flex gap-2 relative z-30"
                                    >
                                        {isStaking ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <TrendingUp className="h-4 w-4" />
                                        )}
                                        {isStaking ? "Staking..." : "Stake Rewards"}
                                    </Button>
                                    <Button
                                        key="withdraw-button"
                                        onClick={handleWithdraw}
                                        disabled={isWithdrawing || decryptedBalance === 0}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-6 font-bold shadow-lg shadow-emerald-600/20 flex gap-2 relative z-30"
                                    >
                                        {isWithdrawing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <ArrowUpRight className="h-4 w-4" />
                                        )}
                                        {isWithdrawing ? "Withdrawing..." : "Withdraw to ETH"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-6 p-4 rounded-xl border flex items-center gap-3 text-xs font-bold shadow-lg backdrop-blur-md ${status.includes("Error") || status.includes("failed")
                            ? "bg-red-950/40 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                            : status.includes("successful") || status.includes("Success")
                                ? "bg-accent/10 border-accent/20 text-white shadow-[0_0_15px_rgba(var(--color-accent),0.1)]"
                                : "bg-blue-950/40 border border-white/5 text-slate-300"
                            }`}
                    >
                        {status.includes("successful") ? <CheckCircle2 className="h-4 w-4 text-accent drop-shadow-[0_0_5px_var(--color-accent)]" /> : <AlertCircle className="h-4 w-4" />}
                        {status}
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}
