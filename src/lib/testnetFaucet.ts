export type TestnetDripResult = {
  txHash: string;
  explorerUrl?: string;
};

/** Default web UI (not an API) — users paste address / connect wallet. */
export const DEFAULT_PUBLIC_SEPOLIA_FAUCET_PAGE = "https://faucet.quicknode.com/ethereum/sepolia";

/** @deprecated Use DEFAULT_PUBLIC_SEPOLIA_FAUCET_PAGE */
export const DEFAULT_PUBLIC_TESTNET_FAUCET_PAGE = DEFAULT_PUBLIC_SEPOLIA_FAUCET_PAGE;

/**
 * Base URL for `POST /drip` JSON (standalone `sepolia-faucet` service or any compatible host). Public sites like QuickNode
 * cannot be used here — they have no compatible API from the browser.
 *
 * Uses `VITE_TESTNET_FAUCET_URL` when set; in local dev falls back to `http://127.0.0.1:8787`.
 */
export function getTestnetFaucetApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_TESTNET_FAUCET_URL as string | undefined)?.trim() || "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:8787";
  return "";
}

/** @deprecated Use `getTestnetFaucetApiBaseUrl`. */
export const getTestnetFaucetBaseUrl = getTestnetFaucetApiBaseUrl;

/**
 * Page opened in a new tab for “get test ETH” when no API URL is configured (production),
 * or as an extra option. Override with `VITE_TESTNET_FAUCET_PAGE_URL`.
 */
export function getPublicTestnetFaucetPageUrl(): string {
  const fromEnv = (import.meta.env.VITE_TESTNET_FAUCET_PAGE_URL as string | undefined)?.trim() || "";
  if (fromEnv) return fromEnv;
  return DEFAULT_PUBLIC_SEPOLIA_FAUCET_PAGE;
}

/**
 * POST { address } to a compatible faucet server (see `sepolia-faucet/`).
 */
export async function requestTestnetDrip(faucetBaseUrl: string, recipient: string): Promise<TestnetDripResult> {
  const base = faucetBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/drip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: recipient }),
  });

  let data: { success?: boolean; txHash?: string; explorerUrl?: string; error?: string; retryAfterMs?: number } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const extra =
      typeof data.retryAfterMs === "number" && data.retryAfterMs > 0
        ? ` Retry in ~${Math.ceil(data.retryAfterMs / 60_000)} min.`
        : "";
    throw new Error((data.error || `Faucet request failed (${res.status})`) + extra);
  }

  if (!data.txHash) {
    throw new Error(data.error || "Faucet returned an invalid response");
  }

  return { txHash: data.txHash, explorerUrl: data.explorerUrl };
}
