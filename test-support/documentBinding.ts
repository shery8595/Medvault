import { ethers } from "hardhat";
import type { MedVaultStack } from "./deployments";
import type { DocumentBindingFields } from "./noirProof";
import { fheStageHandleToField } from "./noirProof";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function docCidHashField(cid: string): bigint {
    return BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254;
}

export async function readDocumentBindingFields(
    stack: MedVaultStack,
    nullifier: bigint,
    trialId: bigint
): Promise<DocumentBindingFields> {
    const engineAddr = await stack.eligibilityEngine.getAddress();
    await ethers.provider.send("hardhat_setBalance", [engineAddr, "0x1000000000000000000"]);
    const engineSigner = await ethers.getImpersonatedSigner(engineAddr);
    const binding = await stack.patientDocumentStore
        .connect(engineSigner)
        .getDocumentBindingForEngine.staticCall(nullifier, trialId);

    return {
        hasDocument: true,
        docCidHash: BigInt(binding.cidHash),
        aesKeyCtHash: BigInt(binding.aesKeyCtHash),
        aesKeyFheHandleHashes: [
            BigInt(binding.keyHandleHash0),
            BigInt(binding.keyHandleHash1),
            BigInt(binding.keyHandleHash2),
            BigInt(binding.keyHandleHash3),
        ],
    };
}

export function keyHandleFieldsFromChunks(handles: Array<bigint | string>): DocumentBindingFields["aesKeyFheHandleHashes"] {
    return handles.map((h) => fheStageHandleToField(h)) as [
        bigint,
        bigint,
        bigint,
        bigint,
    ];
}
