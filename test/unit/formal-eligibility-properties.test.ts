import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    createEncryptedTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import {
    ELIGIBLE_PROFILE,
    PROFILE_FAIL_AGE,
    PROFILE_FAIL_HB,
    PROFILE_FAIL_GENDER,
    PROFILE_FAIL_HEIGHT,
    PROFILE_FAIL_WEIGHT,
    PROFILE_FAIL_SMOKER,
    PROFILE_FAIL_HYPERTENSION,
} from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { assertFhevmMock, mockDecryptBool, mockGetPlaintext } from "../../test-support/fhe";
import { impersonateAccount } from "../../test-support/signers";
import type { PatientProfileValues } from "../../test-support/fhe";

describe("Unit: formal eligibility properties (P1–P3 differential)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function comparePaths(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        commitment: bigint,
        plaintextTrialId: bigint,
        encryptedTrialId: bigint
    ) {
        const registry = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        await stack.eligibilityEngine
            .connect(registry)
            .comparePlaintextVsEncryptedEligibility(commitment, plaintextTrialId, encryptedTrialId);
        const handles = await stack.eligibilityEngine.lastDiffCompareHandles();
        const plaintextFinal = handles.plaintextFinal ?? handles[0];
        const encryptedFinal = handles.encryptedFinal ?? handles[1];
        const plaintextScore = handles.plaintextScore ?? handles[2];
        const encryptedScore = handles.encryptedScore ?? handles[3];
        return {
            plaintextEligible: await mockDecryptBool(plaintextFinal),
            encryptedEligible: await mockDecryptBool(encryptedFinal),
            plaintextScore: await mockGetPlaintext(plaintextScore),
            encryptedScore: await mockGetPlaintext(encryptedScore),
        };
    }

    async function registerAndCompare(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        profile: PatientProfileValues,
        trialOverrides?: Partial<typeof DEFAULT_TRIAL_PARAMS>,
        patientSigner: typeof stack.patient = stack.patient
    ) {
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            patientSigner,
            id.commitment,
            patientSigner.address,
            profile
        );
        const plaintextTrialId = await createTrialForSponsor(stack, stack.sponsor, trialOverrides);
        const encryptedTrialId = await createEncryptedTrialForSponsor(stack, stack.sponsor, trialOverrides);
        return comparePaths(stack, id.commitment, plaintextTrialId, encryptedTrialId);
    }

    it("P2-PROP: finalResult is conjunction — eligible profile decrypts true on both paths", async function () {
        const stack = await deployMedVaultStack();
        const result = await registerAndCompare(stack, ELIGIBLE_PROFILE);
        expect(result.plaintextEligible).to.equal(true);
        expect(result.encryptedEligible).to.equal(true);
    });

    const singleFailCases: Array<{
        id: string;
        profile: PatientProfileValues;
        overrides?: Partial<typeof DEFAULT_TRIAL_PARAMS>;
    }> = [
        { id: "age", profile: PROFILE_FAIL_AGE },
        { id: "diabetes", profile: ELIGIBLE_PROFILE, overrides: { requiresDiabetes: true } },
        { id: "hb", profile: PROFILE_FAIL_HB },
        { id: "gender", profile: PROFILE_FAIL_GENDER, overrides: { genderReq: 1 } },
        { id: "height", profile: PROFILE_FAIL_HEIGHT, overrides: { minHeight: 160 } },
        { id: "weight", profile: PROFILE_FAIL_WEIGHT, overrides: { maxWeight: 80 } },
        { id: "smoker", profile: PROFILE_FAIL_SMOKER, overrides: { requiresNonSmoker: true } },
        { id: "bp", profile: PROFILE_FAIL_HYPERTENSION, overrides: { requiresNormalBP: true } },
    ];

    for (const { id, profile, overrides } of singleFailCases) {
        it(`P2-PROP: single-fail (${id}) decrypts false on both paths`, async function () {
            const stack = await deployMedVaultStack();
            const result = await registerAndCompare(stack, profile, overrides);
            expect(result.plaintextEligible).to.equal(false);
            expect(result.encryptedEligible).to.equal(false);
        });
    }

    for (const { id, profile, overrides } of singleFailCases) {
        it(`P1-PROP: fail→pass flip (${id}) does not decrease score`, async function () {
            const stack = await deployMedVaultStack();
            const fail = await registerAndCompare(stack, profile, overrides, stack.patient);
            const pass = await registerAndCompare(stack, ELIGIBLE_PROFILE, overrides, stack.stranger);
            expect(pass.plaintextScore).to.be.gte(fail.plaintextScore);
            expect(pass.encryptedScore).to.be.gte(fail.encryptedScore);
        });
    }

    it("P3-PROP: score decrypts within [0, 100] for varied profiles", async function () {
        const stack = await deployMedVaultStack();
        const profiles: Array<{ profile: PatientProfileValues; signer: typeof stack.patient }> = [
            { profile: ELIGIBLE_PROFILE, signer: stack.patient },
            { profile: PROFILE_FAIL_AGE, signer: stack.stranger },
            { profile: { ...ELIGIBLE_PROFILE, age: 18, weight: 50, hbLevel: 120 }, signer: stack.sponsor2 },
            { profile: { ...ELIGIBLE_PROFILE, age: 65, weight: 200, hbLevel: 200 }, signer: stack.relayer },
        ];
        for (const { profile, signer } of profiles) {
            const result = await registerAndCompare(stack, profile, undefined, signer);
            expect(result.plaintextScore).to.be.lte(100n);
            expect(result.encryptedScore).to.be.lte(100n);
            expect(result.plaintextScore).to.be.gte(0n);
            expect(result.encryptedScore).to.be.gte(0n);
        }
    });
});
