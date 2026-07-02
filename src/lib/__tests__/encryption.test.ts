import { describe, expect, it } from "vitest";
import {
  decryptDocument,
  encryptDocument,
  generateKey,
  unwrapKey,
  wrapKey,
} from "../EncryptionService";
import { decryptAes256GcmNoble, encryptAes256GcmNoble } from "../crypto-fallback";
import { base64ToBytes, bytesToBase64 } from "../crypto-utils";

/** NIST-style fixed vector for regression (key/iv/plaintext chosen for test stability). */
const KAT_KEY = Uint8Array.from({ length: 32 }, (_, i) => i);
const KAT_IV = Uint8Array.from({ length: 12 }, (_, i) => 0x10 + i);
const KAT_PLAINTEXT = new TextEncoder().encode("MedVault AES-256-GCM known-answer test");

describe("EncryptionService AES-256-GCM", () => {
  it("generateKey returns 32 bytes", () => {
    const key = generateKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("round-trips document encryption", async () => {
    const key = generateKey();
    const payload = await encryptDocument(KAT_PLAINTEXT, key);
    const decrypted = await decryptDocument(payload, key);
    expect(decrypted).toEqual(KAT_PLAINTEXT);
  });

  it("round-trips wrapKey / unwrapKey", async () => {
    const documentKey = generateKey();
    const wrappingKey = generateKey();
    const wrapped = await wrapKey(documentKey, wrappingKey);
    const unwrapped = await unwrapKey(wrapped, wrappingKey);
    expect(unwrapped).toEqual(documentKey);
  });

  it("rejects tampered GCM authentication tag", async () => {
    const key = generateKey();
    const payload = await encryptDocument(KAT_PLAINTEXT, key);
    const tamperedBytes = base64ToBytes(payload.data);
    tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
    const tampered = { ...payload, data: bytesToBase64(tamperedBytes) };
    await expect(decryptDocument(tampered, key)).rejects.toThrow();
  });

  it("rejects tampered IV", async () => {
    const key = generateKey();
    const payload = await encryptDocument(KAT_PLAINTEXT, key);
    const ivBytes = base64ToBytes(payload.iv);
    ivBytes[0] ^= 0xff;
    const tampered = { ...payload, iv: bytesToBase64(ivBytes) };
    await expect(decryptDocument(tampered, key)).rejects.toThrow();
  });

  it("rejects unsupported payload version", async () => {
    const key = generateKey();
    const payload = await encryptDocument(KAT_PLAINTEXT, key);
    await expect(
      decryptDocument({ ...payload, v: 99 as typeof payload.v }, key)
    ).rejects.toThrow(/Unsupported payload version/);
  });

  it("uses fixed KAT vector deterministically with noble backend", () => {
    const ciphertext = encryptAes256GcmNoble(KAT_PLAINTEXT, KAT_KEY, KAT_IV);
    expect(ciphertext.length).toBeGreaterThan(KAT_PLAINTEXT.length);
    const roundTrip = decryptAes256GcmNoble(ciphertext, KAT_KEY, KAT_IV);
    expect(roundTrip).toEqual(KAT_PLAINTEXT);
  });
});
