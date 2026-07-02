import type { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { createEncryptedUint64 } from "./fhe";

/** stakeAndLock via ERC-7984 operator pull (replaces deprecated request/complete path). */
export async function confidentialStakeAndComplete(
    stakingManager: Contract,
    cETH: Contract,
    patient: Signer,
    _patientAddress: string,
    units: bigint | number
) {
    const stakingAddr = await stakingManager.getAddress();
    const cethAddr = await cETH.getAddress();
    const until = BigInt((await time.latest()) + 86400);
    await cETH.connect(patient).setOperator(stakingAddr, until);
    const encStake = await createEncryptedUint64(cethAddr, stakingAddr, units);
    return stakingManager.connect(patient).stakeAndLock(encStake.handle, encStake.inputProof);
}

/** requestPrivateUnstake → completePrivateUnstake with single transferable proof. */
export async function completePrivateUnstakeFromReceipt(
    stakingManager: Contract,
    _cETH: Contract,
    patient: Signer,
    requestReceipt: { logs: readonly { topics: readonly string[]; data: string }[] }
) {
    const { mockPublicDecryptProof, parseEventArg } = await import("./fhe");
    const transferableHandle = parseEventArg(
        requestReceipt,
        stakingManager.interface,
        "PrivateUnstakeRequested",
        "transferableHandle"
    );
    const transferable = await mockPublicDecryptProof(transferableHandle);

    return stakingManager
        .connect(patient)
        .completePrivateUnstake(transferable.cleartexts, transferable.proof);
}

/** requestPublicUnstake → completePublicUnstake with single transferable proof. */
export async function completePublicUnstakeFromReceipt(
    stakingManager: Contract,
    patient: Signer,
    requestReceipt: { logs: readonly { topics: readonly string[]; data: string }[] }
) {
    const { mockPublicDecryptProof, parseEventArg } = await import("./fhe");
    const transferableHandle = parseEventArg(
        requestReceipt,
        stakingManager.interface,
        "PublicUnstakeRequested",
        "transferableHandle"
    );
    const transferable = await mockPublicDecryptProof(transferableHandle);

    return stakingManager
        .connect(patient)
        .completePublicUnstake(transferable.cleartexts, transferable.proof);
}
