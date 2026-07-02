import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import { parseEventArg } from "../../test-support/fhe";
import { defaultApplyDeadline, signAnonymousApplyPermit, signConsentWalletBinding } from "../../test-support/anonymousApply";
import { semaphoreProofFor } from "../../test-support/journey";

describe("Unit: Silent failure apply", function () {
    async function stageOnly(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        profile: typeof ELIGIBLE_PROFILE,
        trialOverrides?: object
    ) {
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            profile
        );
        const trialId = await createTrialForSponsor(stack, stack.sponsor, trialOverrides as any);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const tx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);
        const rc = await tx.wait();
        const finalCt = parseEventArg(
            rc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );
        return { id, trialId, nullifier, finalCt, profileSalt };
    }

    it("SF-01: ineligible finalize records SilentRejected without revert", async function () {
        const stack = await deployMedVaultStack();
        const { id, trialId, nullifier, finalCt, profileSalt } = await stageOnly(stack, PROFILE_FAIL_AGE);

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: PROFILE_FAIL_AGE,
            profileSalt,
            eligible: false,
            fheStageHandle: finalCt,
        });

        const registry = stack.relayer;
        const deadline = await defaultApplyDeadline();
        const permitSignature = await signAnonymousApplyPermit(stack.patient, await stack.medVaultRegistry.getAddress(), {
            trialId,
            commitment: id.commitment,
            nullifier,
            permitRecipient: stack.patient.address,
            deadline,
        });
        const consentWalletSignature = await signConsentWalletBinding(stack.patient, await stack.medVaultRegistry.getAddress(), {
            nullifier,
            trialId,
            consentWallet: stack.patient.address,
            deadline,
        });
        const proof = semaphoreProofFor(trialId, nullifier, id.commitment, stack.patient.address);

        await stack.medVaultRegistry
            .connect(registry)
            .finalizeAnonymousApplyWithProof(
                trialId,
                proof,
                id.commitment,
                stack.patient.address,
                stack.patient.address,
                deadline,
                permitSignature,
                consentWalletSignature,
                proofBytes,
                publicInputs
            );

        expect(await stack.eligibilityEngine.silentApplyOutcome(nullifier, trialId)).to.equal(2); // SilentRejected
        expect(await stack.medVaultRegistry.trialApplications(trialId, nullifier)).to.equal(false);
    });

    it("SF-02: eligible finalize records Accepted", async function () {
        const stack = await deployMedVaultStack();
        const { id, trialId, nullifier, finalCt, profileSalt } = await stageOnly(stack, ELIGIBLE_PROFILE);

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            profileSalt,
            eligible: true,
            fheStageHandle: finalCt,
        });

        const registry = stack.relayer;
        const deadline = await defaultApplyDeadline();
        const permitSignature = await signAnonymousApplyPermit(stack.patient, await stack.medVaultRegistry.getAddress(), {
            trialId,
            commitment: id.commitment,
            nullifier,
            permitRecipient: stack.patient.address,
            deadline,
        });
        const consentWalletSignature = await signConsentWalletBinding(stack.patient, await stack.medVaultRegistry.getAddress(), {
            nullifier,
            trialId,
            consentWallet: stack.patient.address,
            deadline,
        });
        const proof = semaphoreProofFor(trialId, nullifier, id.commitment, stack.patient.address);

        await stack.medVaultRegistry
            .connect(registry)
            .finalizeAnonymousApplyWithProof(
                trialId,
                proof,
                id.commitment,
                stack.patient.address,
                stack.patient.address,
                deadline,
                permitSignature,
                consentWalletSignature,
                proofBytes,
                publicInputs
            );

        expect(await stack.eligibilityEngine.silentApplyOutcome(nullifier, trialId)).to.equal(1); // Accepted
    });
});
