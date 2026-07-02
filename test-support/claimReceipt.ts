import { ethers } from "hardhat";
import type { Contract, Signer } from "ethers";
import type { ContractTransactionReceipt } from "ethers";
import { coerceHandleHex, mockPublicDecryptProof } from "./fhe";

/**
 * Submit confirmReceipt with a mock-network public decryption proof for the staged entitlement ebool.
 */
export async function confirmStagedReceipt(
    vault: Contract,
    trialId: bigint,
    milestoneIndex: bigint,
    participant: Signer,
    _vaultAddress?: string
): Promise<{ receipt: ContractTransactionReceipt; gasCost: bigint }> {
    const participantAddr = await participant.getAddress();
    const prepTx = await vault.connect(participant).prepareEntitlementProof(trialId, milestoneIndex);
    const prepRc = (await prepTx.wait())!;
    const entitlement = await vault.getStagedEntitlement(trialId, participantAddr, milestoneIndex);
    const handle = coerceHandleHex(entitlement);
    const { cleartexts, proof } = await mockPublicDecryptProof(handle);
    const tx = await vault.connect(participant).confirmReceipt(trialId, milestoneIndex, cleartexts, proof);
    const receipt = (await tx.wait())!;
    const gasCost =
        prepRc.gasUsed * (prepRc.gasPrice ?? 0n) + receipt.gasUsed * (receipt.gasPrice ?? 0n);
    return { receipt, gasCost };
}

export async function tryConfirmStagedReceipt(
    vault: Contract,
    trialId: bigint,
    milestoneIndex: bigint,
    participant: Signer
): Promise<{ ok: boolean; error?: string }> {
    try {
        await confirmStagedReceipt(vault, trialId, milestoneIndex, participant);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

export const CHALLENGE_WINDOW_SECS = 7 * 24 * 60 * 60;
