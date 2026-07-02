import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import {
    ELIGIBLE_PROFILE,
    PROFILE_FAIL_AGE,
    PROFILE_FAIL_DIABETES,
    PROFILE_FAIL_HB,
    PROFILE_FAIL_GENDER,
    PROFILE_FAIL_HEIGHT,
    PROFILE_FAIL_WEIGHT,
    PROFILE_FAIL_SMOKER,
    PROFILE_FAIL_HYPERTENSION,
} from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";
import { mockDecryptBool, parseEventArg } from "../../test-support/fhe";
import { impersonateAccount } from "../../test-support/signers";

describe("Unit: EligibilityEngine", function () {
    async function stageEligibility(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        profile: typeof ELIGIBLE_PROFILE,
        trialOverrides?: Parameters<typeof createTrialForSponsor>[2]
    ) {
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            profile
        );
        const trialId = await createTrialForSponsor(stack, stack.sponsor, trialOverrides);
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
        return { id, trialId, nullifier, finalCt, engine: await stack.eligibilityEngine.getAddress() };
    }

    const criteriaCases: Array<{ id: string; profile: typeof ELIGIBLE_PROFILE; overrides?: object }> = [
        { id: "EE-01", profile: PROFILE_FAIL_AGE },
        { id: "EE-02", profile: ELIGIBLE_PROFILE, overrides: { requiresDiabetes: true } },
        { id: "EE-03", profile: PROFILE_FAIL_HB },
        { id: "EE-04", profile: PROFILE_FAIL_GENDER, overrides: { genderReq: 1 } },
        { id: "EE-05", profile: PROFILE_FAIL_HEIGHT, overrides: { minHeight: 160 } },
        { id: "EE-06", profile: PROFILE_FAIL_WEIGHT, overrides: { maxWeight: 80 } },
        { id: "EE-07", profile: PROFILE_FAIL_SMOKER, overrides: { requiresNonSmoker: true } },
        { id: "EE-08", profile: PROFILE_FAIL_HYPERTENSION, overrides: { requiresNormalBP: true } },
    ];

    for (const { id, profile, overrides } of criteriaCases) {
        it(`${id}: failing criterion yields ineligible on decrypt`, async function () {
            const stack = await deployMedVaultStack();
            const { finalCt, engine } = await stageEligibility(stack, profile, overrides as any);
            expect(await mockDecryptBool(finalCt, engine, stack.patient.address)).to.equal(false);
        });
    }

    it("EE-09: all criteria pass yields eligible on decrypt", async function () {
        const stack = await deployMedVaultStack();
        const { finalCt, engine } = await stageEligibility(stack, ELIGIBLE_PROFILE);
        expect(await mockDecryptBool(finalCt, engine, stack.patient.address)).to.equal(true);
    });

    it("EE-10: inactive trial reverts on stage", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.trialManager.connect(stack.sponsor).deactivateTrial(trialId);
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .stageAnonymousEligibility(
                    id.commitment,
                    trialId,
                    nullifier,
                    stack.patient.address
                ),
            /Trial is not active|reverted/
        );
    });

    it.skip("EE-11: verifyEligibilityProof removed from public API", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.eligibilityEngine.verifyEligibilityProof(
                "0x00",
                [],
                1,
                1,
                1,
                true
            ),
            /Expected 17 public inputs|reverted/
        );
    });

    it.skip("EE-12: verifyEligibilityProof removed from public API", async function () {
        const stack = await deployMedVaultStack();
        const publicInputs = Array.from({ length: 17 }, (_, i) =>
            `0x${(i + 1).toString(16).padStart(64, "0")}`
        );
        await expectRevert(
            stack.eligibilityEngine.verifyEligibilityProof("0x" + "00".repeat(64), publicInputs, 1, 2, 1, true),
            /Commitment required|No FHE application found|Not authorized/
        );
    });

    it("EE-13: unauthorized registry cannot stage", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.eligibilityEngine
                .connect(stack.stranger)
                .stageAnonymousEligibility(1, 1, 1, stack.patient.address),
            "Only authorized registry"
        );
    });

    it("EE-14: stranger cannot update anonymous application status", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.eligibilityEngine
                .connect(stack.stranger)
                .updateAnonymousApplicationStatus(trialId, 999n, 2),
            "Only sponsor"
        );
    });
});
