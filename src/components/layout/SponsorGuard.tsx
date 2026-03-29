import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldOff, ShieldCheck, Loader2, Wallet, ArrowRight, FileText, AlertTriangle } from "lucide-react";
import { useWeb3 } from "../../lib/Web3Context";
import { useSponsorVerification } from "../../hooks/useSponsorVerification";
import { Button } from "../ui/Button";

interface SponsorGuardProps {
    children: React.ReactNode;
}

export function SponsorGuard({ children }: SponsorGuardProps) {
    const { account, connect, isConnecting } = useWeb3();
    const { isVerified, isAdmin, isLoading, sponsorName } = useSponsorVerification();

    /* ─── No wallet connected ─────────────────────────────────────────────── */
    if (!account) {
        return (
            <FullScreenGate>
                <GateIcon
                    icon={<Wallet className="h-8 w-8 text-blue-400" />}
                    color="teal"
                />
                <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
                    Connect Your Wallet
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs text-center mb-8">
                    The Sponsor Portal requires a verified wallet connection to proceed.
                </p>
                <Button
                    onClick={connect}
                    disabled={isConnecting}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20"
                >
                    {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Wallet className="h-4 w-4" />
                    )}
                    {isConnecting ? "Connecting…" : "Connect Wallet"}
                </Button>
            </FullScreenGate>
        );
    }

    /* ─── Checking verification status ───────────────────────────────────── */
    if (isLoading) {
        return (
            <FullScreenGate>
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl animate-pulse" />
                    <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-slate-800 border border-slate-700">
                        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                    </div>
                </div>
                <p className="text-slate-300 font-semibold text-sm tracking-wide">Verifying sponsor status…</p>
                <p className="text-slate-600 font-mono text-xs mt-1">
                    {account.slice(0, 8)}…{account.slice(-6)}
                </p>
            </FullScreenGate>
        );
    }

    /* ─── Verified or Admin — render children ──────────────────────────────── */
    if (isVerified || isAdmin) {
        return <>{children}</>;
    }

    /* ─── Not verified — access denied screen ─────────────────────────────── */
    return (
        <FullScreenGate>
            {/* Animated red shield */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
                className="relative mb-6"
            >
                <div className="absolute inset-0 rounded-full bg-rose-500/15 blur-2xl animate-pulse" />
                <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-slate-800/80 border border-rose-500/30 backdrop-blur-sm">
                    <ShieldOff className="h-8 w-8 text-rose-400" />
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center gap-4 text-center"
            >
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-widest">
                    <AlertTriangle className="h-3 w-3" />
                    Access Restricted
                </div>

                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                    Sponsor Access Restricted
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                    Only wallets that have been <span className="text-white font-semibold">verified by MedVault</span> can
                    access the Sponsor Portal. Your connected address is not currently on the allowlist.
                </p>

                {/* Wallet chip */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 mt-1">
                    <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    <code className="font-mono text-xs text-slate-400">
                        {account.slice(0, 10)}…{account.slice(-8)}
                    </code>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest ml-1">Not Verified</span>
                </div>

                {/* Divider */}
                <div className="w-full max-w-xs h-px bg-slate-800 my-2" />

                {/* CTA */}
                <p className="text-slate-500 text-xs">Want to run clinical trials on MedVault?</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/admin/sponsors">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20">
                            <FileText className="h-4 w-4" />
                            Apply to Become a Sponsor
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link to="/">
                        <Button
                            variant="outline"
                            className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-400 px-7 py-3 rounded-2xl font-semibold"
                        >
                            Back to Home
                        </Button>
                    </Link>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2.5 mt-4 max-w-sm p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-left">
                    <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        After submitting your application, the MedVault admin team will review and whitelist your wallet address in the{" "}
                        <span className="text-slate-400 font-semibold">SponsorRegistry</span> contract. You'll then have full access to the portal.
                    </p>
                </div>
            </motion.div>
        </FullScreenGate>
    );
}

/* ─── Helper: full-screen centred container ───────────────────────────────── */
function FullScreenGate({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-6"
            style={{ background: "linear-gradient(135deg, #050d18 0%, #0a1628 60%, #050d18 100%)" }}
        >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-8"
                    style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)" }}
                />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-3">
                {children}
            </div>
        </div>
    );
}

/* ─── Helper: icon tile ──────────────────────────────────────────────────── */
function GateIcon({ icon, color }: { icon: React.ReactNode; color: "teal" | "rose" }) {
    const glow = color === "teal" ? "bg-blue-500/15" : "bg-rose-500/15";
    const border = color === "teal" ? "border-blue-500/30" : "border-rose-500/30";
    return (
        <div className="relative mb-6">
            <div className={`absolute inset-0 rounded-full ${glow} blur-2xl animate-pulse`} />
            <div className={`relative flex items-center justify-center h-20 w-20 rounded-2xl bg-slate-800/80 border ${border} backdrop-blur-sm`}>
                {icon}
            </div>
        </div>
    );
}
