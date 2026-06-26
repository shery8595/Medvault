import type { Contract } from "ethers";
import type { ZamaEncryptedField } from "./fhe";

/** Disambiguate ConsentManager overloads for ethers v6. */
export function grantConsentLegacy(consentManager: Contract, trialId: bigint) {
    return consentManager.getFunction("grantConsent(uint256,uint256)")(trialId, 0n);
}

export function grantConsentEncrypted(
    consentManager: Contract,
    trialId: bigint,
    encrypted: ZamaEncryptedField
) {
    return consentManager.getFunction("grantConsent(uint256,bytes32,bytes)")(
        trialId,
        encrypted.handle,
        encrypted.inputProof
    );
}
