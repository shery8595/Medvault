/** Shared helpers for AES-256-GCM document encryption (Plan 01). */

export const AES_KEY_BYTES = 32;
export const GCM_IV_BYTES = 12;
export const ENCRYPTED_PAYLOAD_VERSION = 1 as const;
export const ENCRYPTED_PAYLOAD_ALG = "AES-256-GCM" as const;

export type EncryptedPayload = {
  v: typeof ENCRYPTED_PAYLOAD_VERSION;
  alg: typeof ENCRYPTED_PAYLOAD_ALG;
  /** Base64-encoded 12-byte GCM nonce. */
  iv: string;
  /** Base64-encoded ciphertext including the GCM authentication tag. */
  data: string;
};

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function normalizeDocumentInput(
  input: Uint8Array | ArrayBuffer | string
): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") return new TextEncoder().encode(input);
  return new Uint8Array(input);
}

export function assertAesKey(key: Uint8Array): void {
  if (key.length !== AES_KEY_BYTES) {
    throw new Error(`AES-256 key must be ${AES_KEY_BYTES} bytes`);
  }
}

export function assertGcmIv(iv: Uint8Array): void {
  if (iv.length !== GCM_IV_BYTES) {
    throw new Error(`GCM IV must be ${GCM_IV_BYTES} bytes`);
  }
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/** Generate a fresh 256-bit AES key for document encryption. */
export function generateKey(): Uint8Array {
  return randomBytes(AES_KEY_BYTES);
}

/** Split a 256-bit AES key into four big-endian uint64 chunks. */
export function splitAesKeyToUint64Chunks(key: Uint8Array): [bigint, bigint, bigint, bigint] {
  assertAesKey(key);
  const chunks: bigint[] = [];
  for (let i = 0; i < 4; i++) {
    let v = 0n;
    for (let j = 0; j < 8; j++) {
      v = (v << 8n) | BigInt(key[i * 8 + j]!);
    }
    chunks.push(v);
  }
  return chunks as [bigint, bigint, bigint, bigint];
}

/** Reassemble a 256-bit AES key from four big-endian uint64 chunks. */
export function reassembleAesKeyFromUint64Chunks(chunks: readonly bigint[]): Uint8Array {
  if (chunks.length !== 4) {
    throw new Error("Expected 4 uint64 chunks for AES-256 key");
  }
  const key = new Uint8Array(AES_KEY_BYTES);
  for (let i = 0; i < 4; i++) {
    let v = chunks[i]!;
    for (let j = 7; j >= 0; j--) {
      key[i * 8 + j] = Number(v & 0xffn);
      v >>= 8n;
    }
  }
  assertAesKey(key);
  return key;
}
