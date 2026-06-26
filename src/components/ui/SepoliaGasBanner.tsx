import { useState } from "react";
import { ExternalLink, Copy, Check, CheckCircle2, X, Fuel, Droplets } from "lucide-react";
import { ethers } from "ethers";
import { useWeb3 } from "../../lib/Web3Context";
import { useNativeEthBalance } from "../../hooks/useNativeEthBalance";
import {
  getTestnetFaucetApiBaseUrl,
  getPublicTestnetFaucetPageUrl,
  requestTestnetDrip,
} from "../../lib/testnetFaucet";
import { SEPOLIA_FAUCET_LINKS, txExplorerUrl } from "../../lib/network";

const FAUCET_LINKS = SEPOLIA_FAUCET_LINKS;

/** Show funding hint when balance is below this (testnet gas is cheap, but 0 = broken txs). */
const MIN_NATIVE_WEI = ethers.parseEther("0.0002");

const dripDevTitle =
  import.meta.env.DEV && !(import.meta.env.VITE_TESTNET_FAUCET_URL as string | undefined)?.trim()
    ? "Dev: POST http://127.0.0.1:8787/drip — run sepolia-faucet (npm start) or set VITE_TESTNET_FAUCET_URL"
    : undefined;

function DripSuccessNotice({ txUrl }: { txUrl: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
    >
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.25} aria-hidden />
        <span className="text-[11px] font-semibold text-emerald-900 tracking-tight">Test ETH sent</span>
      </span>
      <span className="text-[10px] text-emerald-800/90 hidden sm:inline">Funds are on the way — confirm on-chain if needed.</span>
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-800 underline-offset-2 hover:text-emerald-950 hover:underline"
      >
        View on Etherscan
        <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
      </a>
    </div>
  );
}

export function SepoliaGasBanner() {
  const { account } = useWeb3();
  const { balanceWei, refresh } = useNativeEthBalance();
  const [lowBalanceDismissed, setLowBalanceDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dripLoading, setDripLoading] = useState(false);
  const [dripError, setDripError] = useState<string | null>(null);
  const [dripTxUrl, setDripTxUrl] = useState<string | null>(null);

  if (!account || balanceWei === null) {
    return null;
  }

  const apiBase = getTestnetFaucetApiBaseUrl();
  const canOneClickDrip = apiBase.length > 0;
  const publicFaucetPage = getPublicTestnetFaucetPageUrl();
  const showLowBalanceHelp = balanceWei < MIN_NATIVE_WEI && !lowBalanceDismissed;
  const showTealFaucetBar = canOneClickDrip && !showLowBalanceHelp;
  const showPublicFaucetInYellow = showLowBalanceHelp && !canOneClickDrip;

  if (!showLowBalanceHelp && !showTealFaucetBar) {
    return null;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const requestDrip = async () => {
    const url = getTestnetFaucetApiBaseUrl();
    if (!url || !account) return;
    setDripError(null);
    setDripTxUrl(null);
    setDripLoading(true);
    try {
      const { txHash, explorerUrl } = await requestTestnetDrip(url, account);
      setDripTxUrl(explorerUrl || txExplorerUrl(txHash));
      await refresh();
    } catch (e) {
      setDripError((e as Error)?.message || "Could not send test ETH");
    } finally {
      setDripLoading(false);
    }
  };

  const linkPill =
    "text-[11px] text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline";

  return (
    <div className="space-y-2">
      {showTealFaucetBar ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
          role="region"
          aria-label="Testnet faucet"
        >
          <p className="text-[11px] text-stone-600">
            <span className="font-medium text-stone-800">Sepolia ETH</span>
            <span className="text-stone-400 mx-1.5">·</span>
            Optional top-up for gas.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dripError ? <span className="text-[11px] text-red-700 max-w-[220px] leading-snug">{dripError}</span> : null}
            {dripTxUrl ? <DripSuccessNotice txUrl={dripTxUrl} /> : null}
            <button
              type="button"
              disabled={dripLoading}
              title={dripDevTitle}
              onClick={() => void requestDrip()}
              className="inline-flex items-center gap-1 rounded-md border border-stone-800 bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              <Droplets className="h-3 w-3 opacity-90" />
              {dripLoading ? "…" : "Get ETH"}
            </button>
          </div>
        </div>
      ) : null}

      {showLowBalanceHelp ? (
        <div
          className="relative rounded-lg border border-stone-200 bg-[#FBFAF8] px-3 py-2 pr-8 text-stone-800"
          role="status"
        >
          <button
            type="button"
            onClick={() => setLowBalanceDismissed(true)}
            className="absolute right-1.5 top-1.5 rounded p-0.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 pr-4">
            <Fuel className="h-3.5 w-3.5 shrink-0 text-amber-700/90" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-stone-800 leading-tight">Low Sepolia balance</p>
              <p className="text-[10px] text-stone-500 leading-tight mt-0.5">Fund for gas, then refresh.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canOneClickDrip ? (
                <button
                  type="button"
                  disabled={dripLoading}
                  title={dripDevTitle}
                  onClick={() => void requestDrip()}
                  className="inline-flex items-center gap-1 rounded-md border border-stone-800 bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Droplets className="h-3 w-3 opacity-90" />
                  {dripLoading ? "…" : "Get ETH"}
                </button>
              ) : null}
              {showPublicFaucetInYellow ? (
                <button
                  type="button"
                  onClick={() => window.open(publicFaucetPage, "_blank", "noopener,noreferrer")}
                  className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-800 hover:bg-stone-50"
                >
                  <ExternalLink className="h-3 w-3 opacity-70" />
                  Faucet
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-stone-200/80 pt-2">
            <code className="text-[10px] font-mono text-stone-600 truncate max-w-[200px] sm:max-w-[240px]">{account}</code>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-0.5 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-700 hover:bg-stone-50"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "OK" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-[10px] font-medium text-stone-500 hover:text-stone-800 underline-offset-2 hover:underline"
            >
              Refresh
            </button>
            <span className="text-[10px] text-stone-300 hidden sm:inline" aria-hidden>
              |
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-stone-500">
              {FAUCET_LINKS.map(({ label, href }, i) => (
                <span key={href} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <span aria-hidden>·</span> : null}
                  <a href={href} target="_blank" rel="noopener noreferrer" className={linkPill}>
                    {label}
                  </a>
                </span>
              ))}
            </span>
          </div>

          {dripError ? <p className="mt-1.5 text-[10px] text-red-700 leading-snug">{dripError}</p> : null}
          {dripTxUrl ? (
            <div className="mt-2">
              <DripSuccessNotice txUrl={dripTxUrl} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
