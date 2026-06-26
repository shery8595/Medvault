import { ethers } from "ethers";
import { getContractAddressForChain } from "./contracts";
import EligibilityEngineAbi from "./contracts/abis/EligibilityEngine.json";

export type AttestationAuditBundle = {
    trialId: string;
    nullifier: string;
    verified: boolean;
    resultHash: string;
    profileCommitment: string;
    criteriaSchemaHash: string;
    fheStageHash: string;
    honkVerifier: string;
    eligibilityEngine: string;
    exportedAt: string;
};

function engineAbi(): ethers.InterfaceAbi {
    return (Array.isArray(EligibilityEngineAbi)
        ? EligibilityEngineAbi
        : (EligibilityEngineAbi as { abi: ethers.InterfaceAbi }).abi) as ethers.InterfaceAbi;
}

/** Fetch on-chain attestation receipt and package a sponsor audit bundle (no PHI). */
export async function fetchAttestationAuditBundle(
    provider: ethers.Provider,
    trialId: bigint,
    nullifier: bigint,
    chainId?: bigint | number
): Promise<AttestationAuditBundle | null> {
    const engineAddress = getContractAddressForChain("EligibilityEngine", chainId);
    const honkVerifier = getContractAddressForChain("HonkVerifier", chainId);
    if (!engineAddress) return null;

    const engine = new ethers.Contract(engineAddress, engineAbi(), provider);
    const receipt = await engine.attestationReceipt(nullifier, trialId);
    if (!receipt?.verified) return null;

    const onChainVerifier = (await engine.eligibilityVerifier()) as string;

    return {
        trialId: trialId.toString(),
        nullifier: nullifier.toString(),
        verified: Boolean(receipt.verified),
        resultHash: String(receipt.resultHash),
        profileCommitment: String(receipt.profileCommitment),
        criteriaSchemaHash: String(receipt.criteriaSchemaHash),
        fheStageHash: String(receipt.fheStageHash),
        honkVerifier: onChainVerifier || honkVerifier || "",
        eligibilityEngine: engineAddress,
        exportedAt: new Date().toISOString(),
    };
}

export function downloadAttestationAuditBundle(bundle: AttestationAuditBundle): void {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medvault-attestation-${bundle.trialId}-${bundle.nullifier.slice(0, 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}
