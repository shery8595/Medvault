import { expect } from "chai";
import {
    freshTrialWithPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
} from "../../test-support/journey";
import { assertFhevmMock } from "../../test-support/fhe";

describe("Gas: anonymous eligibility pipeline", function () {
    before(function () {
        assertFhevmMock();
    });

    it("GAS-01: stage + Noir finalize gas snapshot", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const stageGas = staged.stageReceipt.gasUsed;
        expect(stageGas).to.be.gt(0n);

        const finalizeTx = await finalizeSemaphoreApply(stack, staged, patient);
        const finalizeGas = finalizeTx.receipt?.gasUsed ?? 0n;
        expect(finalizeGas).to.be.gt(0n);

        // Noir finalize should avoid KMS publicDecrypt overhead from the old path.
        expect(finalizeGas).to.be.lt(stageGas * 3n);
    });
});
