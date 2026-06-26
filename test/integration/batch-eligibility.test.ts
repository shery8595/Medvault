import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import { assertFhevmMock } from "../../test-support/fhe";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { impersonateAccount } from "../../test-support/signers";
import { deriveNullifier } from "../../test-support/semaphore";

describe("Integration: batch eligibility", function () {
    before(function () {
        assertFhevmMock();
    });

    it("BAT-01: batch computes eligibility for multiple trials", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialA = await createTrialForSponsor(stack);
        const trialB = await createTrialForSponsor(stack, stack.sponsor, {
            name: "Second Trial",
        });

        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        await expect(
            stack.eligibilityEngine
                .connect(registrySigner)
                .checkEligibilityBatch(
                    id.commitment,
                    [trialA, trialB],
                    [deriveNullifier(id, trialA), deriveNullifier(id, trialB)],
                    stack.patient.address
                )
        )
            .to.emit(stack.eligibilityEngine, "BatchEligibilityComputed")
            .withArgs(id.commitment, 2);
    });
});
