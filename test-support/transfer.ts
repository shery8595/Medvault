import type { Contract, Signer } from "ethers";
import { mockPublicDecryptProof, parseEventArg } from "./fhe";

export async function transferEncryptedWithProof(
    cETH: Contract,
    caller: Signer,
    from: string,
    to: string,
    amount: unknown
) {
    const tx = await cETH.connect(caller).previewTransferSufficiency(from, amount);
    const rc = await tx.wait();
    if (!rc) throw new Error("previewTransferSufficiency receipt missing");
    const sufficientHandle = parseEventArg(
        rc,
        cETH.interface,
        "TransferSufficiencyPrepared",
        "sufficientHandle"
    );
    const { cleartexts, proof } = await mockPublicDecryptProof(sufficientHandle);
    return cETH
        .connect(caller)
        .transferEncrypted(from, to, amount, cleartexts, proof);
}
