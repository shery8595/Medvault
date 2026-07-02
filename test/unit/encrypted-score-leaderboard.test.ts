import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";
import { mockUserDecryptBool } from "../../test-support/fhe";
import { impersonateAccount } from "../../test-support/signers";

describe("Unit: EncryptedScoreLeaderboard", function () {
    it("ESL-01: authorize caller and add applicant", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeCaller(await stack.eligibilityEngine.getAddress());
        const trialId = await createTrialForSponsor(stack);
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
        await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(
                id.commitment,
                trialId,
                nullifier,
                stack.patient.address
            );
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard
            .connect(engineSigner)
            .addApplicant(trialId, nullifier);
        expect(await stack.encryptedScoreLeaderboard.isApplicant(trialId, nullifier)).to.equal(true);
    });

    it("ESL-02: duplicate applicant reverts", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeCaller(await stack.eligibilityEngine.getAddress());
        const trialId = await createTrialForSponsor(stack);
        const nullifier = 42n;
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, nullifier);
        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, nullifier),
            "revert"
        );
    });

    it("ESL-03: getApplicantCount", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeCaller(await stack.eligibilityEngine.getAddress());
        const trialId = await createTrialForSponsor(stack);
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, 1n);
        expect(await stack.encryptedScoreLeaderboard.getApplicantCount(trialId)).to.equal(1n);
    });

    it("ESL-04: unauthorized sponsor compare reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.encryptedScoreLeaderboard
                .connect(stack.stranger)
                .compareApplicants(trialId, 1n, 2n),
            "Not authorized"
        );
    });

    it("ESL-05: authorize sponsor and set trial sponsor", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeSponsor(stack.sponsor.address);
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .setTrialSponsor(1, stack.sponsor.address);
        expect(await stack.encryptedScoreLeaderboard.trialSponsor(1)).to.equal(stack.sponsor.address);
    });

    it("ESL-06: getApplicants returns array", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeCaller(await stack.eligibilityEngine.getAddress());
        const trialId = await createTrialForSponsor(stack);
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, 5n);
        const list = await stack.encryptedScoreLeaderboard.getApplicants(trialId);
        expect(list.length).to.equal(1);
    });

    it("ESL-07: batchCompare unknown applicant reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .setTrialSponsor(trialId, stack.sponsor.address);
        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(stack.sponsor).batchCompare(trialId, 999n, 0, 1),
            /Applicant not found|reverted/
        );
    });

    it("ESL-08: deauthorize sponsor", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeSponsor(stack.sponsor.address);
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .deauthorizeSponsor(stack.sponsor.address);
        expect(await stack.encryptedScoreLeaderboard.globalAuthorizedSponsors(stack.sponsor.address)).to.equal(
            false
        );
    });

    it("ESL-09: owner cannot add applicant (engine-only)", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(stack.owner).addApplicant(trialId, 99n),
            /Only eligibility engine/
        );
    });

    it("ESL-10: globalAuthorizedSponsor decrypts comparison after compareApplicants", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeCaller(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard
            .connect(stack.owner)
            .authorizeSponsor(stack.sponsor2.address);
        const trialId = await createTrialForSponsor(stack);
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, 1n);
        await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, 2n);
        await stack.encryptedScoreLeaderboard
            .connect(stack.sponsor2)
            .compareApplicants(trialId, 1n, 2n);
        const comparison = await stack.encryptedScoreLeaderboard
            .connect(stack.sponsor2)
            .getComparison(trialId, 1n, 2n);
        const leaderboardAddr = await stack.encryptedScoreLeaderboard.getAddress();
        const decrypted = await mockUserDecryptBool(comparison, leaderboardAddr, stack.sponsor2);
        expect(typeof decrypted).to.equal("boolean");
    });
});
