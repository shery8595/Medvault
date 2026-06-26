import { ethers } from "ethers";
import type { Identity } from "@semaphore-protocol/identity";

export const VAULT_EIP712_DOMAIN = {
    name: "MedVault SponsorIncentiveVault",
    version: "1",
} as const;

export function deriveEphemeralWallet(identity: Identity): ethers.Wallet {
    const identitySecret = identity.secretScalar.toString();
    const privateKey = ethers.keccak256(ethers.toUtf8Bytes(`medvault:ephemeral:${identitySecret}`));
    return new ethers.Wallet(privateKey);
}

export async function deriveEphemeralAddress(identity: Identity): Promise<string> {
    return deriveEphemeralWallet(identity).getAddress();
}

export async function signClaimAuthorizationForTest(
    identity: Identity,
    vaultAddress: string,
    chainId: bigint,
    params: {
        trialId: bigint;
        nullifier: bigint;
        permitHolder: string;
        destination: string;
        units: bigint;
        nonce: bigint;
        deadline: bigint;
    }
): Promise<string> {
    const wallet = deriveEphemeralWallet(identity);
    return wallet.signTypedData(
        {
            name: VAULT_EIP712_DOMAIN.name,
            version: VAULT_EIP712_DOMAIN.version,
            chainId,
            verifyingContract: vaultAddress,
        },
        {
            ClaimAuthorization: [
                { name: "trialId", type: "uint256" },
                { name: "nullifier", type: "uint256" },
                { name: "permitHolder", type: "address" },
                { name: "destination", type: "address" },
                { name: "units", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        {
            trialId: params.trialId,
            nullifier: params.nullifier,
            permitHolder: params.permitHolder,
            destination: params.destination,
            units: params.units,
            nonce: params.nonce,
            deadline: params.deadline,
        }
    );
}

export async function signRegisterAuthorizationForTest(
    identity: Identity,
    vaultAddress: string,
    chainId: bigint,
    params: {
        trialId: bigint;
        nullifier: bigint;
        permitHolder: string;
        nonce: bigint;
        deadline: bigint;
    }
): Promise<string> {
    const wallet = deriveEphemeralWallet(identity);
    return wallet.signTypedData(
        {
            name: VAULT_EIP712_DOMAIN.name,
            version: VAULT_EIP712_DOMAIN.version,
            chainId,
            verifyingContract: vaultAddress,
        },
        {
            RegisterAuthorization: [
                { name: "trialId", type: "uint256" },
                { name: "nullifier", type: "uint256" },
                { name: "permitHolder", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        {
            trialId: params.trialId,
            nullifier: params.nullifier,
            permitHolder: params.permitHolder,
            nonce: params.nonce,
            deadline: params.deadline,
        }
    );
}
