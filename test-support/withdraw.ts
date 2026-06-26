import type { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    createEncryptedUint64,
    mockPublicDecryptProof,
    parseEventArg,
} from "./fhe";

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
    const sufficientHandle = parseEventArg(
        stageReceipt,
        confidentialETH.interface,
        "WithdrawRequested",
        "sufficientHandle"
    );
    const sufficient = await mockPublicDecryptProof(sufficientHandle);

    const revealTx = await confidentialETH
        .connect(user)
        .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
    const revealRc = await revealTx.wait();
    if (!revealRc) throw new Error("Reveal receipt missing");

    const amountHandle = parseEventArg(
        revealRc,
        confidentialETH.interface,
        "WithdrawAmountRevealed",
        "amountHandle"
    );
    const amount = await mockPublicDecryptProof(amountHandle);
    return confidentialETH.connect(user).completeWithdraw(amount.cleartexts, amount.proof);
}

export async function requestEncryptedWithdrawTo(
    confidentialETH: Contract,
    authorized: Signer,
    userAddress: string,
    destination: string,
    units: number | bigint
) {
    const contractAddress = await confidentialETH.getAddress();
    const authAddress = await authorized.getAddress();
    const encrypted = await createEncryptedUint64(contractAddress, authAddress, units);
    return confidentialETH
        .connect(authorized)
        .requestWithdrawTo(userAddress, destination, encrypted.handle, encrypted.inputProof);
}

export async function completeEncryptedWithdrawTo(
    confidentialETH: Contract,
    caller: Signer,
    userAddress: string,
    stageReceipt: { logs: Array<{ topics: readonly string[]; data: string }> }
) {
    const contractAddress = await confidentialETH.getAddress();
    const sufficientHandle = parseEventArg(
        stageReceipt,
        confidentialETH.interface,
        "WithdrawToRequested",
        "sufficientHandle"
    );
    const sufficient = await mockPublicDecryptProof(sufficientHandle);

    const revealTx = await confidentialETH
        .connect(caller)
        .revealWithdrawToAmount(userAddress, sufficient.cleartexts, sufficient.proof);
    const revealRc = await revealTx.wait();
    if (!revealRc) throw new Error("Reveal receipt missing");

    const amountHandle = parseEventArg(
        revealRc,
        confidentialETH.interface,
        "WithdrawAmountRevealed",
        "amountHandle"
    );
    const amount = await mockPublicDecryptProof(amountHandle);
    return confidentialETH
        .connect(caller)
        .completeWithdrawTo(userAddress, amount.cleartexts, amount.proof);
}

export async function createEncryptedClaimUnits(
    cEthAddress: string,
    vaultAddress: string,
    units: number | bigint
) {
    return createEncryptedUint64(cEthAddress, vaultAddress, units);
}

export async function signPublicExitAuthorization(
    signer: { signTypedData: (...args: unknown[]) => Promise<string> },
    params: {
        contractAddress: string;
        chainId: bigint;
        owner: string;
        stealthRecipient: string;
        sufficientHandle: string;
        exitMode: 0 | 1;
        nonce: bigint;
        deadline: bigint;
    }
) {
    const domain = {
        name: "MedVault ConfidentialETH",
        version: "1",
        chainId: params.chainId,
        verifyingContract: params.contractAddress,
    };
    const types = {
        WithdrawAuthorization: [
            { name: "owner", type: "address" },
            { name: "stealthRecipient", type: "address" },
            { name: "sufficientHandle", type: "bytes32" },
            { name: "exitMode", type: "uint8" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };
    const value = {
        owner: params.owner,
        stealthRecipient: params.stealthRecipient,
        sufficientHandle: params.sufficientHandle,
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
    const sufficientHandle = parseEventArg(
        stageReceipt,
        confidentialETH.interface,
        "WithdrawRequested",
        "sufficientHandle"
    );
    const sufficient = await mockPublicDecryptProof(sufficientHandle);

    const revealTx = await confidentialETH
        .connect(owner)
        .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
    const revealRc = await revealTx.wait();
    if (!revealRc) throw new Error("Reveal receipt missing");

    const amountHandle = parseEventArg(
        revealRc,
        confidentialETH.interface,
        "WithdrawAmountRevealed",
        "amountHandle"
    );
    const amount = await mockPublicDecryptProof(amountHandle);

    const network = await confidentialETH.runner?.provider?.getNetwork();
    const chainId = network?.chainId ?? 31337n;
    const nonce = await confidentialETH.withdrawNonces(ownerAddress);
    const deadline = BigInt((await time.latest()) + 3600);
    const signature = await signPublicExitAuthorization(owner, {
        contractAddress,
        chainId,
        owner: ownerAddress,
        stealthRecipient,
        sufficientHandle,
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
            sufficient.cleartexts,
            sufficient.proof,
            amount.cleartexts,
            amount.proof
        );
}
