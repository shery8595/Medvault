import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useConfidentialBalance } from "../../hooks/useConfidentialBalance";
import {
  Eye,
  EyeOff,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  Lock,
  Unlock,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { WithdrawModeSelector } from "./WithdrawModeSelector";

type Props = {
  variant?: "default" | "enclave";
};

export function ConfidentialWallet({ variant = "default" }: Props) {
  const isEnclave = variant === "enclave";
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

  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"deposit" | "withdraw" | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAction = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;

    try {
      if (action === "deposit") {
        await deposit(amount);
        setSuccessMessage(`Successfully shielded ${amount} ETH entering the Confidential Vault.`);
      } else if (action === "withdraw") {
        setSuccessMessage(null);
        if (!isRevealed) {
          throw new Error("Reveal your balance before withdrawing.");
        }
        await withdraw(amount, withdrawMode);
        setSuccessMessage(`Withdrawal initiated (${withdrawMode.replace("_", " ")}).`);
      }
      setAmount("");
      setAction(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      // Error is handled by the hook
    }
  };

  const balanceBlock = (
    <div
      className={cn(
        "flex flex-col transition-all",
        isEnclave
          ? "items-start justify-center min-h-[140px]"
          : "items-center justify-center min-h-[180px] rounded-[1.5rem] border border-slate-200 bg-slate-50 p-8 hover:bg-slate-100"
      )}
    >
      <p
        className={cn(
          "mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]",
          isEnclave ? "text-slate-400" : "text-slate-500"
        )}
      >
        {isRevealed ? (
          <Unlock className={cn("h-3 w-3", isEnclave ? "text-teal-400" : "text-emerald-500")} />
        ) : (
          <Lock className={cn("h-3 w-3", isEnclave ? "text-teal-400" : "text-teal-600")} />
        )}
        Private Balance
      </p>

      <AnimatePresence mode="wait">
        {loading && !action ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "flex flex-col gap-3",
              isEnclave ? "items-start text-teal-400" : "items-center text-teal-600"
            )}
          >
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-teal-500/30" />
              <Loader2 className="relative z-10 h-8 w-8 animate-spin" />
            </div>
            <span className={cn("text-xs font-medium uppercase tracking-wide", isEnclave && "text-slate-400")}>
              Decrypting via coprocessor…
            </span>
          </motion.div>
        ) : isRevealed ? (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("flex flex-col gap-3", isEnclave ? "items-start w-full" : "items-center")}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <h2
                className={cn(
                  "font-black tracking-tighter",
                  isEnclave
                    ? "text-4xl text-teal-400 md:text-5xl"
                    : "bg-gradient-to-br from-slate-900 via-teal-700 to-emerald-600 bg-clip-text text-6xl text-transparent"
                )}
              >
                {balanceEth || "0.000000"}
              </h2>
              <span className={cn("text-xl font-bold", isEnclave ? "text-teal-300/90" : "text-teal-700")}>
                {isEnclave ? "ETH" : "cETH"}
              </span>
            </div>
            <div
              className={cn(
                "grid w-full max-w-md grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider",
                isEnclave ? "text-slate-400" : "text-slate-500"
              )}
            >
              <div
                className={cn(
                  "rounded-lg border px-3 py-2",
                  isEnclave ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                )}
              >
                <p>Wallet balance</p>
                <p className={cn("normal-case", isEnclave ? "text-slate-200" : "text-slate-900")}>
                  {walletBalanceEth || "0.000000"} ETH
                </p>
              </div>
              <div
                className={cn(
                  "rounded-lg border px-3 py-2",
                  isEnclave
                    ? "border-teal-500/20 bg-teal-500/10 text-teal-300"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}
              >
                <p>Trial rewards</p>
                <p className={cn("normal-case", isEnclave ? "text-teal-200" : "text-emerald-900")}>
                  {rewardBalanceEth || "0.000000"} ETH
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "mt-1 h-8 rounded-full px-4 text-xs font-bold",
                isEnclave
                  ? "text-slate-400 hover:bg-white/10 hover:text-white"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              )}
              onClick={hideBalance}
            >
              <EyeOff className="mr-2 h-4 w-4" /> Hide balance
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("flex w-full flex-col gap-4", isEnclave ? "items-start" : "items-center gap-5")}
          >
            {!isEnclave ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                    className="h-10 w-8 rounded-lg border border-slate-300 bg-slate-200"
                  />
                ))}
              </div>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-slate-500">••••••</p>
            )}
            <Button
              className={cn(
                "rounded-xl border-0 font-bold shadow-lg transition-all hover:scale-[1.02]",
                isEnclave
                  ? "h-11 bg-teal-600 px-5 text-white hover:bg-teal-500"
                  : "h-12 bg-gradient-to-r from-teal-600 to-emerald-600 px-6 text-white hover:from-teal-500 hover:to-emerald-500"
              )}
              onClick={revealBalance}
            >
              <Eye className="mr-2 h-5 w-5" />
              {isEnclave ? "View balance summary" : "Reveal (requires decryption key)"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const messages = (
    <AnimatePresence>
      {error && !action ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            "rounded-xl border p-4 text-xs font-medium",
            isEnclave
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-rose-200 bg-rose-50 text-rose-600"
          )}
        >
          {error}
        </motion.div>
      ) : null}
      {successMessage ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-4 text-xs font-medium",
            isEnclave
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          <CheckCircle2 className="h-5 w-5" /> {successMessage}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const actions = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className={cn(
            "h-12 rounded-xl font-bold text-sm transition-all",
            isEnclave
              ? action === "deposit"
                ? "border-teal-400/50 bg-teal-500/20 text-teal-200"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
              : action === "deposit"
                ? "border-teal-300 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          )}
          onClick={() => setAction(action === "deposit" ? null : "deposit")}
        >
          <Upload className="mr-2 h-5 w-5" /> Shield ETH
        </Button>
        <Button
          variant="outline"
          className={cn(
            "h-12 rounded-xl font-bold text-sm transition-all",
            isEnclave
              ? action === "withdraw"
                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
              : action === "withdraw"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          )}
          onClick={() => setAction(action === "withdraw" ? null : "withdraw")}
        >
          <Download className="mr-2 h-5 w-5" /> Unshield cETH
        </Button>
      </div>

      <AnimatePresence>
        {action ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "space-y-4 rounded-2xl border p-5 shadow-inner",
              isEnclave ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-2 transition-colors focus-within:border-teal-500/50",
                isEnclave ? "border-white/15 bg-slate-900/50" : "border-slate-200 bg-white"
              )}
            >
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="0.00"
                  className={cn(
                    "h-14 border-0 bg-transparent px-4 font-mono text-2xl font-black focus-visible:ring-0",
                    isEnclave
                      ? "text-white placeholder:text-slate-500"
                      : "text-slate-900 placeholder:text-slate-400"
                  )}
                  value={amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                />
              </div>
              <div
                className={cn(
                  "mr-2 rounded-lg px-4 py-2 text-sm font-bold tracking-widest",
                  isEnclave ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"
                )}
              >
                {action === "deposit" ? "ETH" : "cETH"}
              </div>
            </div>
            {action === "withdraw" ? (
              <WithdrawModeSelector
                value={withdrawMode}
                onChange={setWithdrawMode}
                variant={isEnclave ? "enclave" : "default"}
              />
            ) : null}
            <Button
              className={cn(
                "h-12 w-full rounded-xl text-sm font-bold tracking-wide shadow-xl",
                action === "deposit"
                  ? "bg-teal-600 text-white hover:bg-teal-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              )}
              disabled={!amount || loading}
              onClick={handleAction}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `Confirm ${action === "deposit" ? "shielding" : "withdrawal"}`
              )}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );

  if (isEnclave) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <Lock className="h-3.5 w-3.5 text-teal-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
              Confidential vault
            </span>
          </div>
          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-300">
            End-to-end encrypted
          </span>
        </div>
        {balanceBlock}
        {messages}
        {actions}
      </div>
    );
  }

  return (
    <Card className="group relative min-h-[400px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl dark:border-slate-200 dark:bg-white dark:text-slate-900">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 opacity-100" />
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-300/10 blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.5, 1], x: [0, -50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeOut" }}
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-300/10 blur-[100px]"
      />
      <div className="pointer-events-none absolute right-0 top-0 translate-x-12 -translate-y-8 p-8 opacity-10 transition-opacity duration-700 group-hover:opacity-20">
        <Lock className="h-48 w-48 -rotate-12 text-slate-500" />
      </div>

      <CardHeader className="relative z-10 px-8 pb-6 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-700">
          <Activity className="h-3 w-3" /> Zero-Knowledge Proof enabled
        </div>
        <CardTitle className="mt-4 flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
          Confidential Vault
        </CardTitle>
        <CardDescription className="mt-2 max-w-sm text-sm text-slate-600">
          Your trial incentives are fully encrypted via FHE. Only your private key can reveal the
          contents.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10 space-y-8 px-8 pb-8">
        {balanceBlock}
        {messages}
        {actions}
      </CardContent>
    </Card>
  );
}
