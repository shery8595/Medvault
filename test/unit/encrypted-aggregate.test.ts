import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import {
    assertFhevmMock,
    mockUserDecryptUint32,
    parseEventArg,
} from "../../test-support/fhe";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import {
    generateTestEligibilityProof,
    trialCriteriaFromDefaults,
} from "../../test-support/noirProof";

describe("Unit: encrypted aggregate analytics", function () {
    before(function () {
        assertFhevmMock();
    });

    it("AGG-01: finalize increments homomorphic aggregate count", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        await stack.encryptedScoreLeaderboard.setTrialSponsor(trialId, stack.sponsor.address);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());

        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(
                id.commitment,
                trialId,
                nullifier,
                stack.patient.address
            );
        const stageRc = await stageTx.wait();
        const finalCt = parseEventArg(
            stageRc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            eligible: true,
            fheStageHandle: finalCt,
        });

        await stack.eligibilityEngine
            .connect(registrySigner)
            .finalizeAnonymousEligibilityWithProof(
                id.commitment,
                nullifier,
                trialId,
                stack.patient.address,
                stack.patient.address,
                proofBytes,
                publicInputs,
                true
            );

        const countCt = await stack.encryptedScoreLeaderboard.getAggregateApplicantCount(trialId);
        const count = await mockUserDecryptUint32(
            countCt,
            await stack.encryptedScoreLeaderboard.getAddress(),
            stack.sponsor.address
        );
        expect(count).to.equal(1n);
    });
});
