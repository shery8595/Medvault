import { ethers } from "ethers";
import type { ContractTransactionReceipt, Interface, LogDescription } from "ethers";

const CLAIM_INITIATED_IFACE = new ethers.Interface([
    "event ClaimInitiated(uint256 indexed trialId, address indexed permitHolder, bytes32 sufficientHandle)",
]);

/** Parse VaultClaimLib.ClaimInitiated from a vault transaction receipt. */
export function parseClaimInitiatedLog(
    receipt: ContractTransactionReceipt | null | undefined
): LogDescription | undefined {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
        try {
            const parsed = CLAIM_INITIATED_IFACE.parseLog(log);
            if (parsed?.name === "ClaimInitiated") return parsed;
        } catch {
            /* try next log */
        }
    }
    return undefined;
}

export function parseClaimInitiatedFromInterface(
    receipt: ContractTransactionReceipt | null | undefined,
    vaultInterface: Interface
): LogDescription | undefined {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
        try {
            const parsed = vaultInterface.parseLog(log);
            if (parsed?.name === "ClaimInitiated") return parsed;
        } catch {
            /* try library ABI */
        }
    }
    return parseClaimInitiatedLog(receipt);
}
