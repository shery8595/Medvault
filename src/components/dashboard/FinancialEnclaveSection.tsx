import { StakingVaultCard } from "./StakingVaultCard";
import { useConfidentialBalance } from "../../hooks/useConfidentialBalance";
import {
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Loader2,
  ShieldCheck,
  Upload,
  Download,
  CheckCircle2,
  Unlock,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { WithdrawModeSelector } from "./WithdrawModeSelector";

const FEATURES = [
  { icon: Lock,        title: "AES-256",         sub: "Encryption Standard" },
  { icon: Fingerprint, title: "Zero-Knowledge",  sub: "Proof Enabled" },
  { icon: Database,    title: "Decentralized",   sub: "On-Chain Storage" },
  { icon: ShieldCheck, title: "Tamper-Proof",    sub: "Blockchain Secured" },
] as const;

function EnclaveBalance() {
  const {
    balanceEth,
    walletBalanceEth,
    rewardBalanceEth,
    isRevealed,
    loading,
    error,
    revealBalance,
    hideBalance,
    deposit,
    withdraw,
  } = useConfidentialBalance();

  const [withdrawMode, setWithdrawMode] = useState<"wallet" | "fast" | "private_batch">("wallet");

  const [amount, setAmount]       = useState("");
  const [action, setAction]       = useState<"deposit" | "withdraw" | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const handleAction = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    try {
      if (action === "deposit") {
        await deposit(amount);
        setSuccess(`Shielded ${amount} ETH into the Confidential Vault.`);
      } else {
        if (!isRevealed) throw new Error("Reveal balance before withdrawing.");
        await withdraw(amount, withdrawMode);
        setSuccess(`Withdrawal submitted (${withdrawMode.replace("_", " ")}).`);
      }
      setAmount("");
      setAction(null);
      setTimeout(() => setSuccess(null), 5000);
    } catch { /* handled by hook */ }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* balance card */}
      <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-5">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {isRevealed
            ? <Unlock className="h-3 w-3 text-teal-400" />
            : <Lock    className="h-3 w-3 text-teal-400" />}
          Private Balance
        </p>

        <AnimatePresence mode="wait">
          {loading && !action ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-teal-400"
            >
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs text-slate-400">Decrypting…</span>
            </motion.div>
          ) : isRevealed ? (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-teal-400 md:text-5xl">
                  {balanceEth || "0.000000"}
                </span>
                <span className="text-xl font-bold text-teal-300/80">ETH</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Wallet Balance
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-200">
                    {walletBalanceEth || "0.000000"} ETH
                  </p>
                </div>
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-teal-400">
                    Trial Rewards
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-teal-200">
                    {rewardBalanceEth || "0.000000"} ETH
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={hideBalance}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                <EyeOff className="h-4 w-4" />
                View Balance Summary
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="font-mono text-3xl font-black tracking-tight text-slate-600">
                ••••••
              </p>
              <Button
                onClick={revealBalance}
                className="flex h-10 items-center gap-2 rounded-xl border-0 bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                <Eye className="h-4 w-4" />
                View Balance Summary
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* error / success */}
      <AnimatePresence>
        {error && !action ? (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
          >
            {error}
          </motion.p>
        ) : null}
        {success ? (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4" /> {success}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* shield / unshield actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className={`h-11 rounded-xl border font-semibold text-sm transition-all ${
            action === "deposit"
              ? "border-teal-400/50 bg-teal-500/20 text-teal-200"
              : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
          onClick={() => setAction(action === "deposit" ? null : "deposit")}
        >
          <Upload className="mr-2 h-4 w-4" /> Shield ETH
        </Button>
        <Button
          variant="outline"
          className={`h-11 rounded-xl border font-semibold text-sm transition-all ${
            action === "withdraw"
              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
              : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
          onClick={() => setAction(action === "withdraw" ? null : "withdraw")}
        >
          <Download className="mr-2 h-4 w-4" /> Unshield cETH
        </Button>
      </div>

      <AnimatePresence>
        {action ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/60 p-2">
              <Input
                type="number"
                placeholder="0.00"
                className="h-12 border-0 bg-transparent px-3 font-mono text-xl font-black text-white placeholder:text-slate-600 focus-visible:ring-0"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              />
              <span className="mr-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold tracking-widest text-slate-300">
                {action === "deposit" ? "ETH" : "cETH"}
              </span>
            </div>
            {action === "withdraw" ? (
              <WithdrawModeSelector
                value={withdrawMode}
                onChange={setWithdrawMode}
                variant="enclave"
              />
            ) : null}
            <Button
              className={`h-11 w-full rounded-xl font-semibold text-white ${
                action === "deposit" ? "bg-teal-600 hover:bg-teal-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
              disabled={!amount || loading}
              onClick={handleAction}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirm ${action === "deposit" ? "shielding" : "withdrawal"}`}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function FinancialEnclaveSection() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Financial Enclave
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage your confidential and sensitive data.
        </p>
      </div>

      {/* ── Dark enclave card ── */}
      <div
        className="relative overflow-hidden rounded-3xl shadow-[0_24px_56px_-16px_rgba(5,30,25,0.5)]"
        style={{ background: "linear-gradient(135deg, #0d2e26 0%, #0a2420 60%, #082018 100%)" }}
      >
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-[26rem] w-[26rem] translate-x-1/3 -translate-y-1/3 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(45,212,191,0.35), transparent 60%)" }}
          aria-hidden
        />

        {/* header row */}
        <div className="relative flex items-start justify-between gap-4 px-6 pt-6 md:px-8 md:pt-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-3.5 w-3.5 text-teal-400" strokeWidth={2} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400">
                Confidential Vault
              </span>
            </div>
            <p className="max-w-[280px] text-xs leading-relaxed text-slate-400">
              Your private secure enclave on the blockchain.
              <br />
              Only you can access this data.
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-teal-400" strokeWidth={2} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                End-to-end encrypted
              </span>
            </div>
          </div>
        </div>

        {/* main content — balance left, vault image right */}
        <div className="relative grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <EnclaveBalance />
          <div className="hidden lg:flex items-center justify-end">
            <img
              src="/images/financial_enclave_component.png"
              alt=""
              className="h-auto w-[260px] object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)] pointer-events-none select-none xl:w-[300px]"
              draggable={false}
            />
          </div>
        </div>

        {/* feature strip */}
        <div className="relative border-t border-white/10">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 py-5 md:grid-cols-4 md:px-8">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-400">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-300">{title}</p>
                  <p className="text-[10px] text-slate-500">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <StakingVaultCard />
    </section>
  );
}
