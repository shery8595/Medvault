import {
  ENCRYPTED_PAYLOAD_ALG,
  ENCRYPTED_PAYLOAD_VERSION,
  bytesToBase64,
  randomBytes,
  type EncryptedPayload,
} from "../src/lib/crypto-utils";
import { encryptAes256Gcm } from "../src/lib/crypto-fallback";

export {
  generateKey,
  reassembleAesKeyFromUint64Chunks,
  splitAesKeyToUint64Chunks,
} from "../src/lib/crypto-utils";

export function generateTestDocumentKey() {
  return randomBytes(32);
}

export async function encryptTestDocument(
  input: Uint8Array | string,
  key: Uint8Array
): Promise<EncryptedPayload> {
  const plaintext = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const iv = randomBytes(12);
  const ciphertext = await encryptAes256Gcm(plaintext, key, iv);
  return {
    v: ENCRYPTED_PAYLOAD_VERSION,
    alg: ENCRYPTED_PAYLOAD_ALG,
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}
