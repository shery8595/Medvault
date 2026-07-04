/**
 * Multi-relayer registry: parse configured URLs, probe health, persist user choice, failover.
 */

import { getMedVaultRelayerUrl } from "./mobile";

const STORAGE_KEY = "medvault.selectedRelayerUrl";

export type RelayerHealth = {
  url: string;
  ok: boolean;
  relayerWallet?: string;
  relayerAuthorized?: boolean | null;
  chainId?: number;
  error?: string;
};

function parseRelayerUrlsFromEnv(): string[] {
  const list = import.meta.env.VITE_RELAYER_URLS?.trim();
  if (list) {
    return list
      .split(",")
      .map((u: string) => u.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  try {
    const single = getMedVaultRelayerUrl();
    if (single) return [single.replace(/\/$/, "")];
  } catch {
    // dev empty string proxy
    if (import.meta.env.DEV) return [""];
  }
  return [];
}

/** All configured MedVault relayer base URLs (may include empty string for dev proxy). */
export function getConfiguredRelayerUrls(): string[] {
  const urls = parseRelayerUrlsFromEnv();
  return urls.length > 0 ? urls : [""];
}

export function getStoredRelayerUrl(): string | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY)?.trim();
  if (!stored) return null;
  const configured = getConfiguredRelayerUrls();
  if (configured.includes(stored) || configured.includes(stored.replace(/\/$/, ""))) {
    return stored.replace(/\/$/, "");
  }
  return null;
}

export function setStoredRelayerUrl(url: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

export async function probeRelayerHealth(url: string): Promise<RelayerHealth> {
  const base = url.replace(/\/$/, "");
  const healthUrl = base ? `${base}/health` : "/health";
  try {
    const res = await fetch(healthUrl);
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    return {
      url: base,
      ok: res.ok && data.status === "ok",
      relayerWallet: typeof data.relayerWallet === "string" ? data.relayerWallet : undefined,
      relayerAuthorized:
        typeof data.relayerAuthorized === "boolean" ? data.relayerAuthorized : null,
      chainId: typeof data.chainId === "number" ? data.chainId : undefined,
    };
  } catch (e) {
    return {
      url: base,
      ok: false,
      error: e instanceof Error ? e.message : "Health check failed",
    };
  }
}

export async function probeAllRelayerHealth(): Promise<RelayerHealth[]> {
  const urls = getConfiguredRelayerUrls();
  return Promise.all(urls.map((u) => probeRelayerHealth(u)));
}

/** Pick relayer: stored preference if healthy, else first healthy authorized, else first configured. */
export async function selectRelayer(): Promise<string> {
  const urls = getConfiguredRelayerUrls();
  const health = await probeAllRelayerHealth();
  const stored = getStoredRelayerUrl();

  if (stored) {
    const match = health.find((h) => h.url === stored);
    if (match?.ok && match.relayerAuthorized !== false) return stored;
  }

  const authorized = health.find((h) => h.ok && h.relayerAuthorized === true);
  if (authorized) return authorized.url;

  const anyOk = health.find((h) => h.ok);
  if (anyOk) return anyOk.url;

  return urls[0] ?? "";
}

/** Resolve active relayer URL synchronously (stored or first configured; use selectRelayer for failover). */
export function getActiveRelayerUrl(): string {
  return getStoredRelayerUrl() ?? getConfiguredRelayerUrls()[0] ?? "";
}
