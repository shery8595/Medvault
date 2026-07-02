import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  probeWebCryptoAesGcm,
  resolveDocumentCryptoBackend,
} from "./crypto-fallback";
import {
  AES_KEY_BYTES,
  ENCRYPTED_PAYLOAD_ALG,
  ENCRYPTED_PAYLOAD_VERSION,
  assertAesKey,
  base64ToBytes,
  bytesToBase64,
  normalizeDocumentInput,
  randomBytes,
  type EncryptedPayload,
  splitAesKeyToUint64Chunks,
  reassembleAesKeyFromUint64Chunks,
} from "./crypto-utils";
import { getZamaSDK } from "./fhe";
import type { Address } from "@zama-fhe/sdk";
import { fetchEncryptedPayloadFromIpfs } from "./ipfs";

export type { EncryptedPayload };

export type FheAesKeyChunks = {
  chunks: Array<{ handle: `0x${string}`; inputProof: `0x${string}` }>;
  inputProof: `0x${string}`;
};

/**
 * FHE-wrap a 256-bit AES key as 4×euint64 ciphertexts for PatientDocumentStore.
 */
export async function wrapKeyForFhe(
  key: Uint8Array,
  contractAddress: string,
  userAddress: string
): Promise<FheAesKeyChunks> {
  const sdk = getZamaSDK();
  const uint64Chunks = splitAesKeyToUint64Chunks(key);
  const { encryptedValues, inputProof } = await sdk.encrypt({
    values: uint64Chunks.map((value) => ({ value, type: "euint64" as const })),
    contractAddress: contractAddress as Address,
    userAddress: userAddress as Address,
  });
  const proofHex = inputProof as `0x${string}`;
  const chunks = encryptedValues.map((ev) => ({
    handle: ev.handle as `0x${string}`,
    inputProof: proofHex,
  }));
  return { chunks, inputProof: proofHex };
}

/** Generate a fresh 256-bit AES key for document encryption. */
export function generateKey(): Uint8Array {
  return randomBytes(AES_KEY_BYTES);
}

/**
 * Encrypt a document (bytes, ArrayBuffer, or UTF-8 string) with AES-256-GCM.
 * Uses WebCrypto when available; falls back to @noble/ciphers on restricted WebViews.
 */
export async function encryptDocument(
  input: Uint8Array | ArrayBuffer | string,
  key: Uint8Array
): Promise<EncryptedPayload> {
  assertAesKey(key);
  const plaintext = normalizeDocumentInput(input);
  const iv = randomBytes(12);
  const ciphertext = await encryptAes256Gcm(plaintext, key, iv);
  return {
    v: ENCRYPTED_PAYLOAD_VERSION,
    alg: ENCRYPTED_PAYLOAD_ALG,
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

/**
 * Decrypt an AES-256-GCM document payload produced by {@link encryptDocument}.
 */
export async function decryptDocument(
  payload: EncryptedPayload,
  key: Uint8Array
): Promise<Uint8Array> {
  assertAesKey(key);
  if (payload.v !== ENCRYPTED_PAYLOAD_VERSION) {
    throw new Error(`Unsupported payload version: ${payload.v}`);
  }
  if (payload.alg !== ENCRYPTED_PAYLOAD_ALG) {
    throw new Error(`Unsupported payload algorithm: ${payload.alg}`);
  }
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.data);
  return decryptAes256Gcm(ciphertext, key, iv);
}

/**
 * Fetch encrypted document from IPFS, decrypt with a cleartext AES key (Plan 01 AES-256-GCM).
 */
export async function fetchAndDecryptDocument(
  cid: string,
  aesKey: Uint8Array
): Promise<Uint8Array> {
  const payload = await fetchEncryptedPayloadFromIpfs<EncryptedPayload>(cid);
  return decryptDocument(payload, aesKey);
}

/** Wrap (encrypt) an AES key with another AES-256 key. */
export async function wrapKey(
  key: Uint8Array,
  wrappingKey: Uint8Array
): Promise<EncryptedPayload> {
  assertAesKey(key);
  assertAesKey(wrappingKey);
  return encryptDocument(key, wrappingKey);
}

/** Unwrap (decrypt) an AES key previously wrapped with {@link wrapKey}. */
export async function unwrapKey(
  wrapped: EncryptedPayload,
  wrappingKey: Uint8Array
): Promise<Uint8Array> {
  assertAesKey(wrappingKey);
  const unwrapped = await decryptDocument(wrapped, wrappingKey);
  assertAesKey(unwrapped);
  return unwrapped;
}

/** True when the runtime WebCrypto AES-256-GCM probe succeeds. */
export async function isWebCryptoAesAvailable(): Promise<boolean> {
  return probeWebCryptoAesGcm();
}

/** True when document encryption will use the @noble/ciphers fallback. */
export async function isUsingCryptoFallback(): Promise<boolean> {
  return !(await probeWebCryptoAesGcm());
}

/** Which backend encryptDocument/decryptDocument will use on this runtime. */
export async function getDocumentCryptoBackend() {
  return resolveDocumentCryptoBackend();
}

/** Convenience namespace for imports that expect EncryptionService.* */
export const EncryptionService = {
  generateKey,
  encryptDocument,
  decryptDocument,
  fetchAndDecryptDocument,
  wrapKey,
  unwrapKey,
  wrapKeyForFhe,
  splitAesKeyToUint64Chunks,
  reassembleAesKeyFromUint64Chunks,
  isWebCryptoAesAvailable,
  isUsingCryptoFallback,
  getDocumentCryptoBackend,
};
