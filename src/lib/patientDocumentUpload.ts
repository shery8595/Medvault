import { ethers, type Signer } from "ethers";
import {
  encryptDocument,
  generateKey,
  wrapKeyForFhe,
  type FheAesKeyChunks,
} from "./EncryptionService";
import type { EncryptedPayload } from "./crypto-utils";
import { bytesToBase64, base64ToBytes } from "./crypto-utils";
import { pinToIpfs } from "./ipfs";
import type { DocumentBindingInputs } from "./noir";
import {
  aesKeyCtHashFromPayload,
  buildDocumentBindingFromFheChunks,
} from "./documentBindingHelpers";
import { getPatientDocumentStore, tryGetPatientDocumentStoreAddress } from "./contracts";
import {
  getPendingHybridDocument,
  storePendingHybridDocument,
  updatePendingHybridDocument,
  type StoredPendingHybridDocument,
} from "./pendingHybridDocument";
import { docCidHashField } from "./documentBindingHelpers";
import { fheStageHandleToField } from "./criteriaSchema";

export type PreparedHybridDocument = {
  cid: string;
  aesKey: Uint8Array;
  encryptedPayload: EncryptedPayload;
  aesKeyCtHash: `0x${string}`;
  filename: string;
};

export type RecordedHybridDocument = {
  txHash: string;
  cid: string;
  documentBinding: DocumentBindingInputs;
  fheChunks: FheAesKeyChunks;
};

/** Encrypt file, pin ciphertext JSON to IPFS; store pending record locally (pre-stage). */
export async function prepareHybridDocumentUpload(
  file: File | Uint8Array,
  trialId: number | bigint,
  filename?: string
): Promise<PreparedHybridDocument> {
  const bytes =
    file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
  const name =
    filename ?? (file instanceof File ? file.name : `medvault-document-${Date.now()}`);
  const aesKey = generateKey();
  const encryptedPayload = await encryptDocument(bytes, aesKey);
  const cid = await pinToIpfs(encryptedPayload, name);
  const aesKeyCtHash = aesKeyCtHashFromPayload(encryptedPayload);

  storePendingHybridDocument({
    trialId: String(trialId),
    cid,
    aesKeyCtHash,
    filename: name,
    aesKeyB64: bytesToBase64(aesKey),
    createdAt: Date.now(),
  });

  return { cid, aesKey, encryptedPayload, aesKeyCtHash, filename: name };
}

/** After apply stage: FHE-wrap AES key + recordDocumentCid on-chain. */
export async function recordHybridDocumentOnChain(
  signer: Signer,
  nullifier: bigint,
  trialId: bigint,
  docStoreAddress: string,
  pending?: StoredPendingHybridDocument | null
): Promise<RecordedHybridDocument> {
  const stored = pending ?? getPendingHybridDocument(trialId);
  if (!stored) {
    throw new Error("No pending hybrid document for this trial. Upload a file before applying.");
  }

  const aesKey = base64ToBytes(stored.aesKeyB64);
  const userAddress = await signer.getAddress();
  const fheChunks = await wrapKeyForFhe(aesKey, docStoreAddress, userAddress);
  const documentBinding = buildDocumentBindingFromFheChunks(
    stored.cid,
    stored.aesKeyCtHash,
    fheChunks
  );

  const store = getPatientDocumentStore(signer);
  const tx = await store.recordDocumentCid(
    nullifier,
    trialId,
    stored.cid,
    stored.aesKeyCtHash,
    fheChunks.chunks[0]!.handle,
    fheChunks.chunks[1]!.handle,
    fheChunks.chunks[2]!.handle,
    fheChunks.chunks[3]!.handle,
    fheChunks.inputProof
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("recordDocumentCid receipt missing");

  updatePendingHybridDocument(trialId, {
    documentBinding,
    recordedTxHash: receipt.hash,
    aesKeyB64: "",
  });

  return {
    txHash: receipt.hash,
    cid: stored.cid,
    documentBinding,
    fheChunks,
  };
}

export async function resolveDocumentBindingForApply(
  signer: Signer,
  nullifier: bigint,
  trialId: bigint,
  docStoreAddress?: string
): Promise<DocumentBindingInputs | undefined> {
  const storeAddr =
    docStoreAddress ?? tryGetPatientDocumentStoreAddress(await resolveChainIdFromSigner(signer));
  const pending = getPendingHybridDocument(trialId);
  if (pending?.documentBinding?.hasDocument) {
    return pending.documentBinding;
  }
  if (pending && !pending.recordedTxHash && storeAddr) {
    const recorded = await recordHybridDocumentOnChain(
      signer,
      nullifier,
      trialId,
      storeAddr,
      pending
    );
    return recorded.documentBinding;
  }
  if (!storeAddr) return undefined;

  try {
    const store = getPatientDocumentStore(signer);
    const exists = await store.documentExists(nullifier, trialId);
    if (!exists) return undefined;
    const rec = await store.getDocumentRecord.staticCall(nullifier, trialId);
    const handles = [rec.keyChunk0, rec.keyChunk1, rec.keyChunk2, rec.keyChunk3] as const;
    return {
      hasDocument: true,
      docCidHash: docCidHashField(rec.cid as string),
      aesKeyCtHash: BigInt(rec.aesKeyCtHash),
      aesKeyFheHandleHashes: handles.map((h) => fheStageHandleToField(h)) as [
        bigint,
        bigint,
        bigint,
        bigint,
      ],
    };
  } catch {
    return undefined;
  }
}

async function resolveChainIdFromSigner(signer: Signer): Promise<bigint | undefined> {
  if (!signer.provider) return undefined;
  const network = await signer.provider.getNetwork();
  return network.chainId;
}

export async function checkDocumentExistsOnChain(
  provider: ethers.Provider,
  docStoreAddress: string,
  nullifier: bigint,
  trialId: bigint
): Promise<boolean> {
  const store = new ethers.Contract(
    docStoreAddress,
    ["function documentExists(uint256,uint256) view returns (bool)"],
    provider
  );
  return Boolean(await store.documentExists(nullifier, trialId));
}
