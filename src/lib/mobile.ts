import { Capacitor } from "@capacitor/core";

const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

const ZAMA_RELAYER_PRODUCTION = "https://relayer.testnet.zama.org";
const MEDVAULT_RELAYER_PRODUCTION = "https://medvault-relayer-production.up.railway.app";

/** True when running inside a Capacitor native shell (Android/iOS). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** True when the WebView origin cannot rely on Vite/Vercel same-origin proxies. */
export function needsDirectApiUrls(): boolean {
  if (isNativeApp()) return true;
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;
  return (
    origin.startsWith("capacitor://") ||
    origin.startsWith("file://") ||
    origin === "https://localhost" ||
    origin === "http://localhost"
  );
}

/** Zama fhEVM relayer base URL for the current runtime. */
export function getZamaRelayerUrl(): string {
  const fromEnv = import.meta.env.VITE_ZAMA_RELAYER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (needsDirectApiUrls()) {
    return ZAMA_RELAYER_PRODUCTION;
  }
  return `${window.location.origin}/api/relayer/${ETHEREUM_SEPOLIA_CHAIN_ID}`;
}

/** MedVault anonymous-apply relayer HTTP origin. */
export function getMedVaultRelayerUrl(): string {
  const fromEnv = import.meta.env.VITE_RELAYER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV && !needsDirectApiUrls()) return "";
  return MEDVAULT_RELAYER_PRODUCTION;
}

/** Capacitor WebView origin sent to backend CORS allowlists. */
export const CAPACITOR_ANDROID_ORIGIN = "https://localhost";
