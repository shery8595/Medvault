import { ethers } from "hardhat";
import type { Signer } from "ethers";
import { buildAesKeyChunksForTest } from "./fhe";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

/** Sponsor must pull FHE decrypt ACL after accept (H-2 / P4 per-access grant). */
export async function pullSponsorKeyAccess(
    store: { connect(signer: Signer): { pullSponsorKeyAccess(nullifier: bigint, trialId: bigint): Promise<{ wait(): Promise<unknown> }> } },
    sponsor: Signer,
    nullifier: bigint,
    trialId: bigint
) {
    await (await store.connect(sponsor).pullSponsorKeyAccess(nullifier, trialId)).wait();
}

/** Atomic revoke+rotate: new CID + FHE-wrapped AES key chunks required (H-2 / P4). */
export async function revokeAccessAndRotate(
    store: {
        getAddress(): Promise<string>;
        connect(signer: Signer): {
            revokeAccess(
                nullifier: bigint,
                trialId: bigint,
                newCid: string,
                newAesKeyCtHash: `0x${string}`,
                c0: string,
                c1: string,
                c2: string,
                c3: string,
                inputProof: string
            ): Promise<{ wait(): Promise<unknown> }>;
        };
    },
    patient: Signer,
    nullifier: bigint,
    trialId: bigint,
    newCid: string,
    newAesKey: Uint8Array
) {
    const patientAddress = await patient.getAddress();
    const docStoreAddr = await store.getAddress();
    const { chunks, inputProof } = await buildAesKeyChunksForTest(
        docStoreAddr,
        patientAddress,
        newAesKey
    );
    const tx = await store
        .connect(patient)
        .revokeAccess(
            nullifier,
            trialId,
            newCid,
            docCidHash(newCid),
            chunks[0]!.handle,
            chunks[1]!.handle,
            chunks[2]!.handle,
            chunks[3]!.handle,
            inputProof
        );
    return tx.wait();
}