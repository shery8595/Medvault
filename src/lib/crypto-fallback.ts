import { gcm } from "@noble/ciphers/aes.js";
import {
  AES_KEY_BYTES,
  GCM_IV_BYTES,
  assertAesKey,
  assertGcmIv,
} from "./crypto-utils";

/** Known probe vector — must round-trip via WebCrypto when available. */
export const CRYPTO_PROBE_KEY = new Uint8Array(AES_KEY_BYTES).fill(0x42);
export const CRYPTO_PROBE_IV = new Uint8Array(GCM_IV_BYTES).fill(0x01);
export const CRYPTO_PROBE_PLAINTEXT = new TextEncoder().encode("medvault-crypto-probe-v1");

let webCryptoProbeResult: boolean | null = null;

export function resetCryptoProbeCache(): void {
  webCryptoProbeResult = null;
}

async function importWebCryptoAesKey(key: Uint8Array): Promise<CryptoKey> {
  assertAesKey(key);
  return crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptAes256GcmWebCrypto(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  assertAesKey(key);
  assertGcmIv(iv);
  const cryptoKey = await importWebCryptoAesKey(key);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plaintext);
  return new Uint8Array(ciphertext);
}

export async function decryptAes256GcmWebCrypto(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  assertAesKey(key);
  assertGcmIv(iv);
  const cryptoKey = await importWebCryptoAesKey(key);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new Uint8Array(plaintext);
}

export function encryptAes256GcmNoble(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  assertAesKey(key);
  assertGcmIv(iv);
  return gcm(key, iv).encrypt(plaintext);
}

export function decryptAes256GcmNoble(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  assertAesKey(key);
  assertGcmIv(iv);
  return gcm(key, iv).decrypt(ciphertext);
}

/**
 * Runtime feature probe: crypto.subtle must exist and round-trip AES-256-GCM.
 * Result is cached for the lifetime of the module (reset in tests via resetCryptoProbeCache).
 */
export async function probeWebCryptoAesGcm(): Promise<boolean> {
  if (webCryptoProbeResult !== null) return webCryptoProbeResult;
  if (typeof globalThis.crypto?.subtle?.encrypt !== "function") {
    webCryptoProbeResult = false;
    return false;
  }
  try {
    const ciphertext = await encryptAes256GcmWebCrypto(
      CRYPTO_PROBE_PLAINTEXT,
      CRYPTO_PROBE_KEY,
      CRYPTO_PROBE_IV
    );
    const roundTrip = await decryptAes256GcmWebCrypto(
      ciphertext,
      CRYPTO_PROBE_KEY,
      CRYPTO_PROBE_IV
    );
    webCryptoProbeResult =
      roundTrip.length === CRYPTO_PROBE_PLAINTEXT.length &&
      roundTrip.every((byte, index) => byte === CRYPTO_PROBE_PLAINTEXT[index]);
  } catch {
    webCryptoProbeResult = false;
  }
  return webCryptoProbeResult;
}

export type DocumentCryptoBackend = "webcrypto" | "noble";

export async function resolveDocumentCryptoBackend(): Promise<DocumentCryptoBackend> {
  return (await probeWebCryptoAesGcm()) ? "webcrypto" : "noble";
}

export async function encryptAes256Gcm(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  backend?: DocumentCryptoBackend
): Promise<Uint8Array> {
  const resolved = backend ?? (await resolveDocumentCryptoBackend());
  return resolved === "webcrypto"
    ? encryptAes256GcmWebCrypto(plaintext, key, iv)
    : encryptAes256GcmNoble(plaintext, key, iv);
}

export async function decryptAes256Gcm(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  backend?: DocumentCryptoBackend
): Promise<Uint8Array> {
  const resolved = backend ?? (await resolveDocumentCryptoBackend());
  return resolved === "webcrypto"
    ? decryptAes256GcmWebCrypto(ciphertext, key, iv)
    : decryptAes256GcmNoble(ciphertext, key, iv);
}
