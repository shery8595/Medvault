import React from "react";
import { Link } from "react-router-dom";
import { Loader2, Wallet, ArrowRight, FileText, AlertTriangle, Building2 } from "lucide-react";
import { useWeb3 } from "../../lib/Web3Context";
import { useSponsorVerification } from "../../hooks/useSponsorVerification";
import { Button } from "../ui/Button";

interface SponsorGuardProps {
    children: React.ReactNode;
}

/** Sponsor routes only require a connected wallet (on-chain registry allowlist not enforced in UI). */
export function SponsorGuard({ children }: SponsorGuardProps) {
    const { account, connect, isConnecting, error: connectError } = useWeb3();
    const { isVerified, isAdmin, isLoading, error } = useSponsorVerification();

    if (!account) {
        return (
            <FullScreenGate>
                <GateIcon
                    icon={<Wallet className="h-7 w-7 text-teal-700" />}
                />
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                    Sponsor portal
                </p>
                <h1 className="font-display text-3xl font-semibold text-slate-950 mb-3 tracking-tight">
                    Sign in to continue
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed max-w-sm text-center mb-8">
                    The Sponsor Portal uses Privy: sign in with email or social to get an in-app wallet on Ethereum Sepolia
                    (testnet gas required for transactions).
                </p>
                <Button
                    onClick={() => void connect()}
                    disabled={isConnecting}
                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-2xl font-bold shadow-[0_14px_28px_rgba(13,148,136,0.22)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                    {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Wallet className="h-4 w-4" />
                    )}
                    {isConnecting ? "Connecting…" : "Log in"}
                </Button>
                {connectError ? (
                    <p className="text-rose-600 text-xs max-w-sm text-center mt-4 leading-relaxed">
                        {connectError}
                    </p>
                ) : null}
            </FullScreenGate>
        );
    }

    /* ─── Wallet connected — wait for on-chain verification check ─────────── */
    if (isLoading) {
        return (
            <FullScreenGate>
                <GateIcon
                    icon={<Loader2 className="h-7 w-7 text-teal-700 animate-spin" />}
                />
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                    Sponsor portal
                </p>
                <h1 className="font-display text-3xl font-semibold text-slate-950 mb-3 tracking-tight">
                    Checking Sponsor Verification
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed max-w-sm text-center">
                    Verifying your wallet against Sponsor Registry...
                </p>
            </FullScreenGate>
        );
    }

    /* ─── Wallet connected but not verified on-chain ──────────────────────── */
    if (!isVerified && !isAdmin) {
        return (
            <FullScreenGate>
                <GateIcon
                    icon={<AlertTriangle className="h-7 w-7 text-amber-700" />}
                />
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Access review
                </p>
                <h1 className="font-display text-3xl font-semibold text-slate-950 mb-3 tracking-tight">
                    Sponsor verification required
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed max-w-sm text-center mb-8">
                    This wallet is not verified in Sponsor Registry yet. Apply for verification to access the Sponsor Portal.
                </p>
                {error ? (
                    <p className="text-rose-600 text-xs max-w-sm text-center mb-6">
                        Verification check error: {error}
                    </p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-3">
                    <Link
                        to="/sponsor/verification"
                        className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-6 py-3 font-bold text-white shadow-[0_14px_28px_rgba(13,148,136,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:translate-y-0"
                    >
                        <FileText className="h-4 w-4" />
                        Verification & apply
                    </Link>
                    <Button
                        onClick={() => window.location.reload()}
                        className="gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0"
                    >
                        <ArrowRight className="h-4 w-4" />
                        Re-check
                    </Button>
                </div>
            </FullScreenGate>
        );
    }

    /* ─── Verified sponsor/admin — render children ────────────────────────── */
    return <>{children}</>;
}

function FullScreenGate({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-6 py-12 text-slate-900"
            style={{
                backgroundImage:
                    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.96) 48%, rgba(241,245,249,0.96) 100%)",
            }}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/70 to-transparent" />
                <div className="absolute left-0 top-0 h-full w-full opacity-[0.035] [background-image:linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] [background-size:32px_32px]" />
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white/80 to-transparent" />
            </div>

            <div className="absolute left-6 top-6 z-10 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur md:left-10 md:top-10">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/70">
                    <Building2 className="h-[18px] w-[18px]" />
                </div>
                <div className="leading-tight">
                    <p className="text-sm font-bold text-slate-950">MedVault</p>
                    <p className="text-[11px] font-medium text-slate-500">Clinical sponsor access</p>
                </div>
            </div>

            <div className="relative z-10 w-full max-w-[30rem] rounded-[2rem] border border-slate-200/90 bg-white/90 px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur md:px-10 md:py-12">
                <div className="mx-auto flex flex-col items-center gap-3">{children}</div>
            </div>
        </div>
    );
}

function GateIcon({ icon }: { icon: React.ReactNode }) {
    return (
        <div className="relative mb-5">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-teal-200/80 bg-gradient-to-b from-white to-teal-50/80 shadow-[0_14px_32px_rgba(13,148,136,0.14)]">
                {icon}
            </div>
            <div className="absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-teal-200/70" />
        </div>
    );
}
