import type { Signer } from "ethers";
import { fetchAndDecryptDocument } from "./EncryptionService";
import { getPatientDocumentStore } from "./contracts";
import { reassembleAesKeyFromUint64Chunks } from "./crypto-utils";
import { decryptForView, FheTypes } from "./fhe";

export type SponsorDocumentRecord = {
  cid: string;
  aesKeyCtHash: bigint | string;
  keyChunk0: bigint | string;
  keyChunk1: bigint | string;
  keyChunk2: bigint | string;
  keyChunk3: bigint | string;
  authorizedSponsor: string;
  revoked: boolean;
};

function ctHandle(h: bigint | string): bigint {
  if (typeof h === "bigint") return h;
  return BigInt(h);
}

/** Sponsor pulls per-access FHE decrypt ACL before reading key chunks (H-2 / P4). */
export async function pullSponsorDocumentKeyAccess(
  signer: Signer,
  nullifier: bigint,
  trialId: bigint
): Promise<string> {
  const store = getPatientDocumentStore(signer);
  const tx = await store.pullSponsorKeyAccess(nullifier, trialId);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("pullSponsorKeyAccess receipt missing");
  return receipt.hash;
}

async function loadDocumentRecord(
  signer: Signer,
  nullifier: bigint,
  trialId: bigint,
  pullFirst = true
): Promise<SponsorDocumentRecord> {
  const store = getPatientDocumentStore(signer);
  if (pullFirst) {
    await pullSponsorDocumentKeyAccess(signer, nullifier, trialId);
  }
  let keyChunks: [bigint | string, bigint | string, bigint | string, bigint | string];
  try {
    keyChunks = (await store.getKeyForSponsor.staticCall(nullifier, trialId)) as [
      bigint | string,
      bigint | string,
      bigint | string,
      bigint | string,
    ];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("access revoked") || message.toLowerCase().includes("pull key")) {
      throw new Error("Access revoked — patient revoked sponsor access to this document.");
    }
    throw err;
  }
  const metaCid = (await store.getDocumentCid.staticCall(nullifier, trialId)) as string;
  return {
    cid: metaCid,
    aesKeyCtHash: 0n,
    keyChunk0: keyChunks[0],
    keyChunk1: keyChunks[1],
    keyChunk2: keyChunks[2],
    keyChunk3: keyChunks[3],
    authorizedSponsor: (await signer.getAddress()).toLowerCase(),
    revoked: false,
  };
}

/**
 * Sponsor unwraps FHE-wrapped AES key via EIP-712 decryptForView (not legacy reencrypt).
 */
export async function decryptSponsorDocumentAesKey(
  signer: Signer,
  docStoreAddress: string,
  nullifier: bigint,
  trialId: bigint
): Promise<Uint8Array> {
  void docStoreAddress;
  const sponsor = await signer.getAddress();
  const rec = await loadDocumentRecord(signer, nullifier, trialId);
  if (rec.authorizedSponsor.toLowerCase() !== sponsor.toLowerCase()) {
    throw new Error("Sponsor is not authorized to decrypt this document key.");
  }

  const storeAddr = await getPatientDocumentStore(signer).getAddress();
  const chunks = await Promise.all([
    decryptForView(ctHandle(rec.keyChunk0), FheTypes.Uint64, storeAddr),
    decryptForView(ctHandle(rec.keyChunk1), FheTypes.Uint64, storeAddr),
    decryptForView(ctHandle(rec.keyChunk2), FheTypes.Uint64, storeAddr),
    decryptForView(ctHandle(rec.keyChunk3), FheTypes.Uint64, storeAddr),
  ]);

  return reassembleAesKeyFromUint64Chunks(chunks.map((c) => BigInt(c as bigint | number | string)));
}

/** Sponsor: FHE unwrap AES key + fetch IPFS ciphertext + local AES decrypt (Plan 01). */
export async function fetchAndDecryptSponsorDocument(
  signer: Signer,
  docStoreAddress: string,
  nullifier: bigint,
  trialId: bigint
): Promise<Uint8Array> {
  void docStoreAddress;
  const rec = await loadDocumentRecord(signer, nullifier, trialId);
  const aesKey = await decryptSponsorDocumentAesKey(signer, docStoreAddress, nullifier, trialId);
  return fetchAndDecryptDocument(rec.cid, aesKey);
}
