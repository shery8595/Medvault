import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createEncryptedTrialForSponsor,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { parseEventArg, mockUserDecryptBool } from "../../test-support/fhe";
import {
    generateTestEncryptedEligibilityProof,
    generateTestEligibilityProof,
    BN254_FIELD_ORDER,
    ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT,
} from "../../test-support/noirProof";
import { expectRevert } from "../../test-support/assertions";

describe("Unit: H-1 encrypted eligibility redesign", function () {
    it("H1-01: encrypted ineligible FHE still accepts application identity proof", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            PROFILE_FAIL_AGE
        );
        const trialId = await createEncryptedTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());

        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);
        const stageRc = await stageTx.wait();
        const finalCt = parseEventArg(
            stageRc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );
        expect(
            await mockUserDecryptBool(
                finalCt,
                await stack.eligibilityEngine.getAddress(),
                stack.patient
            )
        ).to.equal(false);

        const bindingField =
            BigInt(await stack.eligibilityEngine.encryptedCriteriaBindingHash(trialId)) %
            BN254_FIELD_ORDER;
        const { proofBytes, publicInputs } = await generateTestEncryptedEligibilityProof({
            identity: id,
            trialId,
            fheStageHandle: finalCt,
            encryptedCriteriaBindingHash: bindingField,
        });
        expect(publicInputs.length).to.equal(ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT);

        await stack.eligibilityEngine
            .connect(registrySigner)
            .finalizeAnonymousEligibilityWithProof(
                id.commitment,
                nullifier,
                trialId,
                stack.patient.address,
                stack.patient.address,
                proofBytes,
                publicInputs
            );

        expect(await stack.eligibilityEngine.silentApplyOutcome(nullifier, trialId)).to.equal(1);
        expect(await stack.eligibilityEngine.isAnonymousApplicationAccepted(nullifier, trialId)).to.equal(
            true
        );
        expect(await stack.eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId)).to.equal(1); // Pending
    });

    it("H1-02: plaintext ineligible proof still silent-rejects", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            PROFILE_FAIL_AGE
        );
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());

        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);
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
            profile: PROFILE_FAIL_AGE,
            profileSalt,
            eligible: false,
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
                publicInputs
            );

        expect(await stack.eligibilityEngine.silentApplyOutcome(nullifier, trialId)).to.equal(2);
        expect(await stack.eligibilityEngine.isAnonymousApplicationAccepted(nullifier, trialId)).to.equal(
            false
        );
    });

    it("H1-03: encrypted public inputs omit profile_commitment and eligible slots", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createEncryptedTrialForSponsor(stack);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const nullifier = deriveNullifier(id, trialId);
        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);
        const stageRc = await stageTx.wait();
        const finalCt = parseEventArg(
            stageRc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );
        const bindingField =
            BigInt(await stack.eligibilityEngine.encryptedCriteriaBindingHash(trialId)) %
            BN254_FIELD_ORDER;
        const { publicInputs } = await generateTestEncryptedEligibilityProof({
            identity: id,
            trialId,
            fheStageHandle: finalCt,
            encryptedCriteriaBindingHash: bindingField,
        });
        expect(publicInputs.length).to.equal(15);
        expect(BigInt(publicInputs[6]!)).to.equal(1n); // criteria_mode
        expect(BigInt(publicInputs[5]!)).to.equal(bindingField);
        // Plaintext-only slots are absent: index 2 is result_hash, index 3 is fhe stage (not profile_commitment / eligible).
        expect(publicInputs[2]).to.not.equal(publicInputs[3]);
    });

    it("H1-04: plaintext finalize reverts on commitment mismatch", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);
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
            profileSalt,
            eligible: true,
            fheStageHandle: finalCt,
        });

        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    id.commitment + 1n,
                    nullifier,
                    trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    publicInputs
                ),
            /Commitment mismatch/
        );
    });
});
