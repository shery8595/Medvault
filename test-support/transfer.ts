import type { Contract, Signer } from "ethers";

/** Homomorphic transferEncrypted — no public sufficiency decrypt on this path. */
export async function transferEncryptedWithProof(
    cETH: Contract,
    caller: Signer,
    from: string,
    to: string,
    amount: unknown
) {
    return cETH.connect(caller).transferEncrypted(from, to, amount);
}
