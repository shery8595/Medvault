import { useState } from "react";
import { ethers } from "ethers";
import { ArrowUpRight, Loader2, Send } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useWeb3 } from "../../lib/Web3Context";
import { useNativeEthBalance } from "../../hooks/useNativeEthBalance";

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletSendCard() {
  const { account, signer } = useWeb3();
  const { balanceWei, loading: balanceLoading, refresh } = useNativeEthBalance();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;

  const balanceEth =
    balanceWei !== null ? Number(ethers.formatEther(balanceWei)).toFixed(6) : balanceLoading ? "…" : "—";

  const handleSend = async () => {
    setError(null);
    setStatus(null);

    if (!signer) {
      setError("Wallet not ready. Try refreshing the page.");
      return;
    }

    const recipient = to.trim();
    if (!ethers.isAddress(recipient)) {
      setError("Enter a valid Ethereum address.");
      return;
    }

    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    let value: bigint;
    try {
      value = ethers.parseEther(amount.trim());
    } catch {
      setError("Amount is too small or has too many decimals.");
      return;
    }

    if (balanceWei !== null && value > balanceWei) {
      setError("Amount exceeds your wallet balance (leave some for gas).");
      return;
    }

    setSending(true);
    try {
      const tx = await signer.sendTransaction({ to: recipient, value });
      setStatus(`Sent — waiting for confirmation…`);
      const receipt = await tx.wait();
      setStatus(`Sent ${amount} ETH to ${shortAddr(recipient)}.`);
      setTo("");
      setAmount("");
      await refresh();
      if (receipt?.hash) {
        console.info("Transfer tx:", receipt.hash);
      }
    } catch (err: unknown) {
      const e = err as { code?: string; reason?: string; message?: string };
      if (e.code === "ACTION_REJECTED" || e.code === "4001") {
        setError("Transaction cancelled in wallet.");
      } else {
        setError(e.reason || e.message || "Transfer failed.");
      }
    } finally {
      setSending(false);
    }
  };

  const useMax = () => {
    if (balanceWei === null || balanceWei === 0n) return;
    const reserve = ethers.parseEther("0.0001");
    const max = balanceWei > reserve ? balanceWei - reserve : 0n;
    setAmount(ethers.formatEther(max));
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] overflow-hidden border-t-4 border-t-emerald-500">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200/80">
            <Send className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Send ETH</h2>
            <p className="text-xs text-slate-500">Ethereum Sepolia · from your app wallet</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your balance</p>
          <p className="mt-1 font-mono font-semibold text-slate-900">{balanceEth} ETH</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 truncate" title={account}>
            {account}
          </p>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Recipient address</span>
            <Input
              type="text"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
              className="font-mono text-xs"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Amount (ETH)</span>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={sending}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 h-11 px-3 text-xs font-bold"
                onClick={useMax}
                disabled={sending || balanceWei === null || balanceWei === 0n}
              >
                Max
              </Button>
            </div>
          </label>
        </div>

        <Button
          type="button"
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2"
          disabled={sending || !to.trim() || !amount.trim()}
          onClick={() => void handleSend()}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <ArrowUpRight className="h-4 w-4" /> Send
            </>
          )}
        </Button>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Sends native ETH from your Privy wallet (the address MedVault uses for transactions). Paste any
          destination — e.g. MetaMask or another account you control.
        </p>

        {status ? (
          <p className="text-sm font-medium text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-medium text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
