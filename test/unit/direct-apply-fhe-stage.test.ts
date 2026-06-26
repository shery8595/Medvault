import { expect } from "chai";
import { ethers } from "ethers";
import { fheStageHandleToField } from "../../src/lib/criteriaSchema";
import {
    buildEligibilityPublicInputs,
    fheStageHandleToField as testSupportFheStageField,
    trialCriteriaFromDefaults,
} from "../../test-support/noirProof";

/**
 * Guards the direct-wallet anonymous apply path in src/lib/semaphore.ts:
 * generateEligibilityProof must receive the staged finalCt so public input index 5
 * matches EligibilityEngine._verifyEligibilityProofCore FHE stage check.
 */
describe("Unit: direct wallet apply FHE stage binding", function () {
    it("SEMA-PROOF-01: staged finalCt maps to public input index 5", function () {
        const finalCt = ethers.hexlify(ethers.randomBytes(32));
        const criteria = trialCriteriaFromDefaults();
        const publicInputs = buildEligibilityPublicInputs(
            7n,
            42n,
            99n,
            12345n,
            true,
            finalCt,
            criteria
        );

        expect(publicInputs).to.have.length(17);
        expect(BigInt(publicInputs[5]!)).to.equal(fheStageHandleToField(finalCt));
        expect(BigInt(publicInputs[5]!)).to.equal(testSupportFheStageField(finalCt));
    });

    it("SEMA-PROOF-02: omitting finalCt (zero handle) does not match staged ciphertext", function () {
        const stagedFinalCt = ethers.hexlify(ethers.randomBytes(32));
        const criteria = trialCriteriaFromDefaults();
        const wrongInputs = buildEligibilityPublicInputs(
            1n,
            2n,
            3n,
            4n,
            true,
            ethers.ZeroHash,
            criteria
        );
        const correctField = fheStageHandleToField(stagedFinalCt);

        expect(BigInt(wrongInputs[5]!)).to.not.equal(correctField);
    });
});
