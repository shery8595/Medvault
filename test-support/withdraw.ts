import type { Contract, Signer } from "ethers";

import { ethers } from "ethers";

import { time } from "@nomicfoundation/hardhat-network-helpers";

import {

    createEncryptedUint64,

    mockPublicDecryptProof,

    parseEventArg,

} from "./fhe";



export const CONFIDENTIAL_ETH_EIP712_VERSION = "2";



export function computeEncryptedAmountCommitment(

    handle: string,

    inputProof: string

): `0x${string}` {

    return ethers.keccak256(

        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes"], [handle, inputProof])

    ) as `0x${string}`;

}



export async function signWithdrawToAuthorization(

    signer: { signTypedData: (domain: unknown, types: unknown, value: unknown) => Promise<string> },

    cEthAddress: string,

    chainId: bigint,

    params: {

        user: string;

        destination: string;

        amountCommitment: string;

        nonce: bigint;

        deadline: bigint;

    }

): Promise<string> {

    return signer.signTypedData(

        {

            name: "MedVault ConfidentialETH",

            version: CONFIDENTIAL_ETH_EIP712_VERSION,

            chainId,

            verifyingContract: cEthAddress,

        },

        {

            WithdrawTo: [

                { name: "user", type: "address" },

                { name: "destination", type: "address" },

                { name: "amountCommitment", type: "bytes32" },

                { name: "nonce", type: "uint256" },

                { name: "deadline", type: "uint256" },

            ],

        },

        params

    );

}



export async function buildWithdrawToAuthorization(

    confidentialETH: Contract,

    userSigner: Signer,

    destination: string,

    encrypted: { handle: string; inputProof: string },

    deadlineOffsetSec = 3600

) {

    const user = await userSigner.getAddress();

    const cEthAddress = await confidentialETH.getAddress();

    const network = await userSigner.provider!.getNetwork();

    const chainId = network.chainId;

    const nonce = await confidentialETH.withdrawToNonces(user);

    const deadline = BigInt((await time.latest()) + deadlineOffsetSec);

    const amountCommitment = computeEncryptedAmountCommitment(encrypted.handle, encrypted.inputProof);

    const signature = await signWithdrawToAuthorization(userSigner, cEthAddress, chainId, {

        user,

        destination,

        amountCommitment,

        nonce,

        deadline,

    });

    return { nonce, deadline, signature, amountCommitment };

}



export async function requestEncryptedWithdraw(

    confidentialETH: Contract,

    user: Signer,

    units: number | bigint

) {

    const userAddress = await user.getAddress();

    const contractAddress = await confidentialETH.getAddress();

    const encrypted = await createEncryptedUint64(contractAddress, userAddress, units);

    return confidentialETH.connect(user).requestWithdraw(encrypted.handle, encrypted.inputProof);

}



export async function completeEncryptedWithdraw(

    confidentialETH: Contract,

    user: Signer,

    stageReceipt: { logs: Array<{ topics: readonly string[]; data: string }> }

) {

    const contractAddress = await confidentialETH.getAddress();

    const transferableHandle = parseEventArg(

        stageReceipt,

        confidentialETH.interface,

        "WithdrawRequested",

        "transferableHandle"

    );

    const transferable = await mockPublicDecryptProof(transferableHandle);

    return confidentialETH

        .connect(user)

        .completeWithdraw(transferable.cleartexts, transferable.proof);

}



export async function requestEncryptedWithdrawTo(

    confidentialETH: Contract,

    authorized: Signer,

    userAddress: string,

    destination: string,

    units: number | bigint,

    userSigner?: Signer

) {

    const contractAddress = await confidentialETH.getAddress();

    const authAddress = await authorized.getAddress();

    const encrypted = await createEncryptedUint64(contractAddress, authAddress, units);

    const signer = userSigner;

    if (!signer) {

        throw new Error("userSigner required for withdraw-to EIP-712 authorization");

    }

    const { nonce, deadline, signature } = await buildWithdrawToAuthorization(

        confidentialETH,

        signer,

        destination,

        encrypted

    );

    return confidentialETH

        .connect(authorized)

        .requestWithdrawTo(

            userAddress,

            destination,

            encrypted.handle,

            encrypted.inputProof,

            nonce,

            deadline,

            signature

        );

}



export async function completeEncryptedWithdrawTo(

    confidentialETH: Contract,

    vaultAddress: string,

    caller: Signer,

    userAddress: string,

    stageReceipt: { logs: Array<{ topics: readonly string[]; data: string }> }

) {

    const transferableHandle = parseEventArg(

        stageReceipt,

        confidentialETH.interface,

        "WithdrawToRequested",

        "transferableHandle"

    );

    const transferable = await mockPublicDecryptProof(transferableHandle);

    const { impersonateAccount } = await import("./signers");

    const vaultSigner = await impersonateAccount(vaultAddress);

    return confidentialETH

        .connect(vaultSigner)

        .completeWithdrawTo(userAddress, transferable.cleartexts, transferable.proof);

}



export async function createEncryptedClaimUnits(

    cEthAddress: string,

    vaultAddress: string,

    units: number | bigint

) {

    return createEncryptedUint64(cEthAddress, vaultAddress, units);

}



export async function dummyWithdrawToArgs(deadlineOffsetSec = 3600) {

    const deadline = BigInt((await time.latest()) + deadlineOffsetSec);

    return {

        nonce: 0n,

        deadline,

        signature: ("0x" + "00".repeat(130)) as `0x${string}`,

    };

}



export async function claimParticipantRewardsTx(

    confidentialETH: Contract,

    vault: Contract,

    claimSigner: Signer,

    trialId: bigint,

    nullifier: bigint,

    destination: string,

    units: number | bigint

) {

    const vaultAddress = await vault.getAddress();

    const encrypted = await createEncryptedClaimUnits(

        await confidentialETH.getAddress(),

        vaultAddress,

        units

    );

    const withdrawTo = await buildWithdrawToAuthorization(

        confidentialETH,

        claimSigner,

        destination,

        encrypted

    );

    return vault

        .connect(claimSigner)

        .claimParticipantRewards(

            trialId,

            nullifier,

            destination,

            encrypted.handle,

            encrypted.inputProof,

            withdrawTo.nonce,

            withdrawTo.deadline,

            withdrawTo.signature

        );

}



export async function signPublicExitAuthorization(

    signer: { signTypedData: (...args: unknown[]) => Promise<string> },

    params: {

        contractAddress: string;

        chainId: bigint;

        owner: string;

        stealthRecipient: string;

        transferableHandle: string;

        exitMode: 0 | 1;

        nonce: bigint;

        deadline: bigint;

    }

) {

    const domain = {

        name: "MedVault ConfidentialETH",

        version: CONFIDENTIAL_ETH_EIP712_VERSION,

        chainId: params.chainId,

        verifyingContract: params.contractAddress,

    };

    const types = {

        WithdrawAuthorization: [

            { name: "owner", type: "address" },

            { name: "stealthRecipient", type: "address" },

            { name: "transferableHandle", type: "bytes32" },

            { name: "exitMode", type: "uint8" },

            { name: "nonce", type: "uint256" },

            { name: "deadline", type: "uint256" },

        ],

    };

    const value = {

        owner: params.owner,

        stealthRecipient: params.stealthRecipient,

        transferableHandle: params.transferableHandle,

        exitMode: params.exitMode,

        nonce: params.nonce,

        deadline: params.deadline,

    };

    return signer.signTypedData(domain, types, value);

}



export async function completePublicExit(

    confidentialETH: Contract,

    relayer: Signer,

    owner: Signer,

    stageReceipt: { logs: Array<{ topics: readonly string[]; data: string }> },

    stealthRecipient: string,

    exitMode: 0 | 1 = 0

) {

    const contractAddress = await confidentialETH.getAddress();

    const ownerAddress = await owner.getAddress();

    const transferableHandle = parseEventArg(

        stageReceipt,

        confidentialETH.interface,

        "WithdrawRequested",

        "transferableHandle"

    );

    const transferable = await mockPublicDecryptProof(transferableHandle);



    const network = await confidentialETH.runner?.provider?.getNetwork();

    const chainId = network?.chainId ?? 31337n;

    const nonce = await confidentialETH.withdrawNonces(ownerAddress);

    const deadline = BigInt((await time.latest()) + 3600);

    const signature = await signPublicExitAuthorization(owner, {

        contractAddress,

        chainId,

        owner: ownerAddress,

        stealthRecipient,

        transferableHandle,

        exitMode,

        nonce,

        deadline,

    });



    return confidentialETH

        .connect(relayer)

        .completePublicExit(

            ownerAddress,

            stealthRecipient,

            exitMode,

            nonce,

            deadline,

            signature,

            transferable.cleartexts,

            transferable.proof

        );

}


