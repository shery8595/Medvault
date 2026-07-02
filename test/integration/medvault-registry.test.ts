import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { buildAnonymousApplyArgs, cancelAnonymousApplyStage, stageAnonymousApply } from "../../test-support/anonymousApply";
import { buildMockSemaphoreProof, consentMessage, deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";

describe("Integration: MedVaultRegistry", function () {
    it("MVR-01: registerPatient adds semaphore member", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.medVaultRegistry.isRegisteredMember(id.commitment)).to.equal(true);
    });

    it("MVR-02: stageAnonymousApply emits staged event", async function () {
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
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        await expect(
            stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    args.proof,
                    args.commitment,
                    args.permitRecipient,
                    args.deadline,
                    args.permitSignature
                )
        ).to.emit(stack.medVaultRegistry, "AnonymousApplyStaged");
    });

    it("MVR-03: cancelAnonymousApplyStage", async function () {
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
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        await cancelAnonymousApplyStage(
            stack.medVaultRegistry,
            stack.relayer,
            trialId,
            id,
            stack.patient.address
        );
    });

    it("MVR-04: hasAppliedToTrial false before finalize", async function () {
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
        const nullifier = deriveNullifier(id, trialId);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, nullifier)).to.equal(false);
    });

    it("MVR-05: invalid proof when mock disabled", async function () {
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
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        await stack.mockSemaphore.setProofsValid(false);
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    args.proof,
                    args.commitment,
                    args.permitRecipient,
                    args.deadline,
                    args.permitSignature
                ),
            "Invalid Semaphore proof"
        );
        await stack.mockSemaphore.setProofsValid(true);
    });

    it("MVR-06: scope mismatch reverts", async function () {
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
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        const badProof = buildMockSemaphoreProof(
            trialId + 99n,
            deriveNullifier(id, trialId),
            id.commitment,
            stack.patient.address
        );
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    badProof,
                    args.commitment,
                    args.permitRecipient,
                    args.deadline,
                    args.permitSignature
                ),
            "Scope mismatch"
        );
    });

    it("MVR-07: commitment/signal mismatch reverts", async function () {
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
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        const mismatched = { ...args.proof, message: id.commitment + 1n };
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    mismatched,
                    args.commitment,
                    args.permitRecipient,
                    args.deadline,
                    args.permitSignature
                ),
            "Commitment/signal mismatch"
        );
    });

    it("MVR-08: wallet isRegistered after register", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.medVaultRegistry.connect(stack.patient).isRegistered()).to.equal(true);
    });

    it("MVR-09: applyToTrialWithConsent is deprecated", async function () {
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
        const nullifier = deriveNullifier(id, trialId);
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .applyToTrialWithConsent(trialId, id.commitment, nullifier),
            /Deprecated: use stageAnonymousApply/
        );
    });

    it("MVR-10: duplicate register reverts", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        await expectRevert(
            registerPatientOnRegistry(
                stack,
                stack.patient,
                id.commitment,
                stack.patient.address,
                ELIGIBLE_PROFILE
            ),
            /Already registered|reverted/
        );
    });

    it("MVR-11: getCommitmentForWallet self only", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.medVaultRegistry.connect(stack.patient).getCommitmentForWallet(stack.patient.address)).to.equal(
            id.commitment
        );
    });

    it("MVR-12: owner updates merkle tree duration", async function () {
        const stack = await deployMedVaultStack();
        await stack.medVaultRegistry.connect(stack.owner).updateMerkleTreeDuration(2 * 24 * 60 * 60);
    });
});
