import { Identity } from "@semaphore-protocol/identity";
import { keccak256, solidityPacked, getAddress } from "ethers";
import { toBeHex } from "ethers/utils";
import { poseidon2 } from "poseidon-lite";

export function anonymousApplySignal(commitment: bigint, permitRecipient: string): bigint {
    const signal = keccak256(
        solidityPacked(["uint256", "address"], [commitment, getAddress(permitRecipient)])
    );
    return BigInt(signal);
}

export function semaphoreScopeField(scope: bigint): bigint {
    return BigInt(keccak256(toBeHex(scope, 32))) >> 8n;
}

export function deriveNullifier(identity: Identity, trialId: bigint): bigint {
    return poseidon2([semaphoreScopeField(trialId), identity.secretScalar]);
}

export function consentMessage(commitment: bigint, trialId: bigint, permitRecipient: string): bigint {
    const signal = keccak256(
        solidityPacked(
            ["uint256", "uint256", "address", "string"],
            [commitment, trialId, permitRecipient, "CONSENT"]
        )
    );
    return BigInt(signal);
}

export function buildMockSemaphoreProof(
    trialId: bigint,
    nullifier: bigint,
    commitment: bigint,
    permitRecipient: string
) {
    const message = anonymousApplySignal(commitment, permitRecipient);
    const zero = 0n;
    return {
        merkleTreeDepth: 20n,
        merkleTreeRoot: commitment,
        nullifier,
        message,
        scope: trialId,
        points: [zero, zero, zero, zero, zero, zero, zero, zero],
    };
}
