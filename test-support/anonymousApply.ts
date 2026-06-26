import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Contract, Signer } from "ethers";
import { buildMockSemaphoreProof, deriveNullifier } from "./semaphore";
import type { Identity } from "@semaphore-protocol/identity";

export async function signAnonymousApplyPermit(
    signer: Signer,
    registryAddress: string,
    params: {
        trialId: bigint;
        commitment: bigint;
        nullifier: bigint;
        permitRecipient: string;
        deadline: bigint;
    }
): Promise<string> {
    const network = await ethers.provider.getNetwork();
    const domain = {
        name: "MedVaultRegistry",
        version: "1",
        chainId: network.chainId,
        verifyingContract: registryAddress,
    };
    const types = {
        AnonymousApply: [
            { name: "trialId", type: "uint256" },
            { name: "commitment", type: "uint256" },
            { name: "nullifier", type: "uint256" },
            { name: "permitRecipient", type: "address" },
            { name: "deadline", type: "uint256" },
        ],
    };
    return signer.signTypedData(domain, types, params);
}

/** M-2: EIP-712 binding of consent-granting wallet to nullifier at apply finalize. */
export async function signConsentWalletBinding(
    signer: Signer,
    registryAddress: string,
    params: {
        nullifier: bigint;
        trialId: bigint;
        consentWallet: string;
        deadline: bigint;
    }
): Promise<string> {
    const network = await ethers.provider.getNetwork();
    const domain = {
        name: "MedVaultRegistry",
        version: "1",
        chainId: network.chainId,
        verifyingContract: registryAddress,
    };
    const types = {
        ConsentWalletBinding: [
            { name: "nullifier", type: "uint256" },
            { name: "trialId", type: "uint256" },
            { name: "consentWallet", type: "address" },
            { name: "deadline", type: "uint256" },
        ],
    };
    return signer.signTypedData(domain, types, params);
}

// M-4: Distinct EIP-712 cancel authorization signed by the permit recipient. Mirrors the
// CANCEL_ANONYMOUS_APPLY_TYPEHASH in MedVaultRegistry so a captured apply permit cannot be
// replayed to tear down a staged application.
export async function signAnonymousApplyCancelPermit(
    signer: Signer,
    registryAddress: string,
    params: {
        trialId: bigint;
        nullifier: bigint;
        permitRecipient: string;
        deadline: bigint;
    }
): Promise<string> {
    const network = await ethers.provider.getNetwork();
    const domain = {
        name: "MedVaultRegistry",
        version: "1",
        chainId: network.chainId,
        verifyingContract: registryAddress,
    };
    const types = {
        CancelAnonymousApply: [
            { name: "trialId", type: "uint256" },
            { name: "nullifier", type: "uint256" },
            { name: "permitRecipient", type: "address" },
            { name: "deadline", type: "uint256" },
        ],
    };
    return signer.signTypedData(domain, types, params);
}

export async function defaultApplyDeadline(): Promise<bigint> {
    return BigInt((await time.latest()) + 3600);
}

export async function buildAnonymousApplyArgs(
    registry: Contract,
    trialId: bigint,
    identity: Identity,
    permitRecipient: string,
    consentWallet?: string,
    deadline?: bigint
) {
    const registryAddress = await registry.getAddress();
    const nullifier = deriveNullifier(identity, trialId);
    const proof = buildMockSemaphoreProof(
        trialId,
        nullifier,
        identity.commitment,
        permitRecipient
    );
    const permitSigner = await ethers.getSigner(permitRecipient);
    const consentSigner = await ethers.getSigner(consentWallet ?? permitRecipient);
    const dl = deadline ?? (await defaultApplyDeadline());
    const permitSignature = await signAnonymousApplyPermit(permitSigner, registryAddress, {
        trialId,
        commitment: identity.commitment,
        nullifier,
        permitRecipient,
        deadline: dl,
    });
    const consentWalletAddress = consentWallet ?? permitRecipient;
    const consentWalletSignature = await signConsentWalletBinding(consentSigner, registryAddress, {
        nullifier,
        trialId,
        consentWallet: consentWalletAddress,
        deadline: dl,
    });
    return {
        proof,
        commitment: identity.commitment,
        permitRecipient,
        consentWallet: consentWalletAddress,
        deadline: dl,
        permitSignature,
        consentWalletSignature,
    };
}

export async function stageAnonymousApply(
    registry: Contract,
    signer: Signer,
    trialId: bigint,
    identity: Identity,
    permitRecipient: string,
    deadline?: bigint
) {
    const registryAddress = await registry.getAddress();
    const nullifier = deriveNullifier(identity, trialId);
    const proof = buildMockSemaphoreProof(
        trialId,
        nullifier,
        identity.commitment,
        permitRecipient
    );
    const permitSigner = await ethers.getSigner(permitRecipient);
    const dl = deadline ?? (await defaultApplyDeadline());
    const permitSignature = await signAnonymousApplyPermit(permitSigner, registryAddress, {
        trialId,
        commitment: identity.commitment,
        nullifier,
        permitRecipient,
        deadline: dl,
    });
    return registry
        .connect(signer)
        .stageAnonymousApply(
            trialId,
            proof,
            identity.commitment,
            permitRecipient,
            dl,
            permitSignature
        );
}

export async function cancelAnonymousApplyStage(
    registry: Contract,
    signer: Signer,
    trialId: bigint,
    identity: Identity,
    permitRecipient: string,
    deadline?: bigint
) {
    const registryAddress = await registry.getAddress();
    const nullifier = deriveNullifier(identity, trialId);
    const proof = buildMockSemaphoreProof(
        trialId,
        nullifier,
        identity.commitment,
        permitRecipient
    );
    const permitSigner = await ethers.getSigner(permitRecipient);
    const dl = deadline ?? (await defaultApplyDeadline());
    const permitSignature = await signAnonymousApplyPermit(permitSigner, registryAddress, {
        trialId,
        commitment: identity.commitment,
        nullifier,
        permitRecipient,
        deadline: dl,
    });
    const cancelSignature = await signAnonymousApplyCancelPermit(permitSigner, registryAddress, {
        trialId,
        nullifier,
        permitRecipient,
        deadline: dl,
    });
    return registry
        .connect(signer)
        .cancelAnonymousApplyStage(
            trialId,
            proof,
            identity.commitment,
            permitRecipient,
            dl,
            permitSignature,
            cancelSignature
        );
}
