import { ethers, type Signer } from "ethers";

import type { DocumentBindingInputs } from "./noir";

import { BN254_FIELD_ORDER, fheStageHandleToField } from "./criteriaSchema";

import type { EncryptedPayload } from "./crypto-utils";

import type { FheAesKeyChunks } from "./EncryptionService";

import { wrapKeyForFhe } from "./EncryptionService";

import { getPatientDocumentStore } from "./contracts";

import { base64ToBytes } from "./crypto-utils";

import { getPendingHybridDocument } from "./pendingHybridDocument";



const BN254 = BN254_FIELD_ORDER;



export function docCidHashField(cid: string): bigint {

  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254;

}



export function aesKeyCtHashFromPayload(payload: EncryptedPayload): `0x${string}` {

  const hash = BigInt(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)))) % BN254;

  return ethers.toBeHex(hash, 32) as `0x${string}`;

}



export function buildDocumentBindingFromFheChunks(

  cid: string,

  aesKeyCtHash: bigint | `0x${string}`,

  chunks: FheAesKeyChunks

): DocumentBindingInputs {

  const handles = chunks.chunks.map((c) => fheStageHandleToField(c.handle)) as [

    bigint,

    bigint,

    bigint,

    bigint,

  ];

  const ctHash =

    typeof aesKeyCtHash === "bigint"

      ? aesKeyCtHash

      : BigInt(aesKeyCtHash);

  return {

    hasDocument: true,

    docCidHash: docCidHashField(cid),

    aesKeyCtHash: ctHash,

    aesKeyFheHandleHashes: handles,

  };

}



export function documentExistsBinding(

  binding?: DocumentBindingInputs | null

): binding is DocumentBindingInputs & { hasDocument: true } {

  return Boolean(binding?.hasDocument);

}



/**

 * Atomic revoke+rotate: new IPFS CID + FHE-wrapped AES key required (H-2 / P4).

 * Old IPFS CID must be unpinned off-chain; contracts cannot revoke already-decrypted files.

 */

export async function revokeAndRotateDocumentKey(

  signer: Signer,

  nullifier: bigint,

  trialId: bigint,

  aesKey?: Uint8Array,

  newCid?: string

): Promise<{ txHash: string; documentBinding: DocumentBindingInputs }> {

  const store = getPatientDocumentStore(signer);

  const docStoreAddress = await store.getAddress();

  const userAddress = await signer.getAddress();



  const pending = getPendingHybridDocument(trialId);

  const key =

    aesKey ??

    (pending?.aesKeyB64 ? base64ToBytes(pending.aesKeyB64) : undefined);

  if (!key || key.length !== 32) {

    throw new Error(

      "No AES key available for rotation. Re-attach the document before revoking, or supply aesKey."

    );

  }



  const rec = await store.getDocumentRecord.staticCall(nullifier, trialId);

  const nextCid = newCid ?? pending?.cid;

  if (!nextCid || nextCid === rec.cid) {

    throw new Error(

      "Supply a new IPFS CID (re-encrypted payload) for revokeAccess."

    );

  }



  const aesKeyCtHash = ethers.toBeHex(

    BigInt(ethers.keccak256(key)) % BN254,

    32

  ) as `0x${string}`;



  const fheChunks = await wrapKeyForFhe(key, docStoreAddress, userAddress);

  const tx = await store.revokeAccess(

    nullifier,

    trialId,

    nextCid,

    aesKeyCtHash,

    fheChunks.chunks[0]!.handle,

    fheChunks.chunks[1]!.handle,

    fheChunks.chunks[2]!.handle,

    fheChunks.chunks[3]!.handle,

    fheChunks.inputProof

  );

  const receipt = await tx.wait();

  if (!receipt) throw new Error("revokeAccess receipt missing");



  const documentBinding = buildDocumentBindingFromFheChunks(

    nextCid,

    aesKeyCtHash,

    fheChunks

  );



  return { txHash: receipt.hash, documentBinding };

}



/** @deprecated Use revokeAndRotateDocumentKey — revoke alone is no longer supported on-chain. */

export async function revokeDocumentAccess(

  signer: Signer,

  nullifier: bigint,

  trialId: bigint

): Promise<string> {

  const { txHash } = await revokeAndRotateDocumentKey(signer, nullifier, trialId);

  return txHash;

}



/** @deprecated Use revokeAndRotateDocumentKey — rotate is atomic with revoke. */

export async function rotateDocumentKeyAfterRevoke(

  signer: Signer,

  nullifier: bigint,

  trialId: bigint,

  aesKey?: Uint8Array,

  newCid?: string

): Promise<{ txHash: string; documentBinding: DocumentBindingInputs }> {

  return revokeAndRotateDocumentKey(signer, nullifier, trialId, aesKey, newCid);

}



/** Alias for atomic revoke+rotate (canonical H-2 path). */

export const revokeAndRotateDocumentKeyAlias = revokeAndRotateDocumentKey;


