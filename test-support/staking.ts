import type { Contract, Signer } from "ethers";
import { createEncryptedUint64, mockPublicDecryptProof, parseEventArg } from "./fhe";

/** requestConfidentialStake → completeConfidentialStake with runtime transfer proof. */
export async function confidentialStakeAndComplete(
    stakingManager: Contract,
    cETH: Contract,
    patient: Signer,
    patientAddress: string,
    units: bigint | number
) {
    const stakingAddr = await stakingManager.getAddress();
    const encStake = await createEncryptedUint64(stakingAddr, patientAddress, units);
    await (
        await stakingManager
            .connect(patient)
            .requestConfidentialStake(encStake.handle, encStake.inputProof)
    ).wait();

    const previewTx = await stakingManager.connect(patient).previewConfidentialStakeTransfer();
    const previewRc = await previewTx.wait();
    if (!previewRc) throw new Error("previewConfidentialStakeTransfer receipt missing");
    const transferHandle = parseEventArg(
        previewRc,
        cETH.interface,
        "TransferSufficiencyPrepared",
        "sufficientHandle"
    );
    const transfer = await mockPublicDecryptProof(transferHandle);

    return stakingManager
        .connect(patient)
        .completeConfidentialStake(transfer.cleartexts, transfer.proof);
}

/** requestPrivateUnstake → completePrivateUnstake with sufficiency + transfer proofs. */
export async function completePrivateUnstakeFromReceipt(
    stakingManager: Contract,
    cETH: Contract,
    patient: Signer,
    requestReceipt: { logs: readonly { topics: readonly string[]; data: string }[] }
) {
    const sufficientHandle = parseEventArg(
        requestReceipt,
        stakingManager.interface,
        "PrivateUnstakeRequested",
        "sufficientHandle"
    );
    const sufficient = await mockPublicDecryptProof(sufficientHandle);

    const previewTx = await stakingManager.connect(patient).previewPrivateUnstakeTransfer();
    const previewRc = await previewTx.wait();
    if (!previewRc) throw new Error("previewPrivateUnstakeTransfer receipt missing");
    const transferHandle = parseEventArg(
        previewRc,
        cETH.interface,
        "TransferSufficiencyPrepared",
        "sufficientHandle"
    );
    const transfer = await mockPublicDecryptProof(transferHandle);

    return stakingManager
        .connect(patient)
        .completePrivateUnstake(
            sufficient.cleartexts,
            sufficient.proof,
            transfer.cleartexts,
            transfer.proof
        );
}
