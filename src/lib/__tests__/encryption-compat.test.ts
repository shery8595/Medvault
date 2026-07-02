import { describe, expect, it } from "vitest";
import {
  decryptAes256GcmNoble,
  decryptAes256GcmWebCrypto,
  encryptAes256GcmNoble,
  encryptAes256GcmWebCrypto,
  probeWebCryptoAesGcm,
  resetCryptoProbeCache,
} from "../crypto-fallback";

const PARITY_KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const PARITY_IV = Uint8Array.from({ length: 12 }, (_, i) => (i * 11 + 5) & 0xff);
const PARITY_PLAINTEXT = new TextEncoder().encode(
  "MedVault WebCrypto vs @noble/ciphers parity vector"
);

describe("WebCrypto vs @noble/ciphers parity", () => {
  it("noble encrypt/decrypt round-trip", () => {
    const ciphertext = encryptAes256GcmNoble(PARITY_PLAINTEXT, PARITY_KEY, PARITY_IV);
    const decrypted = decryptAes256GcmNoble(ciphertext, PARITY_KEY, PARITY_IV);
    expect(decrypted).toEqual(PARITY_PLAINTEXT);
  });

  it("WebCrypto and noble produce identical ciphertext for the same key+IV", async () => {
    const webCryptoOk = await probeWebCryptoAesGcm();
    if (!webCryptoOk) {
      // Skip when Node/Vitest runtime lacks WebCrypto (CI should have it on Node 20+).
      return;
    }

    const webCryptoCiphertext = await encryptAes256GcmWebCrypto(
      PARITY_PLAINTEXT,
      PARITY_KEY,
      PARITY_IV
    );
    const nobleCiphertext = encryptAes256GcmNoble(PARITY_PLAINTEXT, PARITY_KEY, PARITY_IV);

    expect(bytesToHex(webCryptoCiphertext)).toBe(bytesToHex(nobleCiphertext));

    const webCryptoPlaintext = await decryptAes256GcmWebCrypto(
      nobleCiphertext,
      PARITY_KEY,
      PARITY_IV
    );
    const noblePlaintext = decryptAes256GcmNoble(webCryptoCiphertext, PARITY_KEY, PARITY_IV);

    expect(webCryptoPlaintext).toEqual(PARITY_PLAINTEXT);
    expect(noblePlaintext).toEqual(PARITY_PLAINTEXT);
  });

  it("probeWebCryptoAesGcm caches its result", async () => {
    resetCryptoProbeCache();
    const first = await probeWebCryptoAesGcm();
    const second = await probeWebCryptoAesGcm();
    expect(second).toBe(first);
  });
});

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
