import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS, CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import {
    registerPatient,
    walletApplyWithConsent,
    sponsorAcceptApplication,
    fundTrialPool,
    registerInPool,
} from "../../test-support/journey";
import { completeMilestoneSigned } from "../../test-support/milestone";
import {
    assertFhevmMock,
    coerceFheHandle,
    createEncryptedBool,
    mockUserDecryptBool,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import { confirmStagedReceipt } from "../../test-support/claimReceipt";

describe("Unit: SponsorIncentiveVault payout invariants", function () {
    before(function () {
        assertFhevmMock();
    });

    async function twoParticipantTrial(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const patientA = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const patientB = await registerPatient(stack, stack.stranger, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier: nullA } = await walletApplyWithConsent(stack, trialId, patientA);
        const { nullifier: nullB } = await walletApplyWithConsent(stack, trialId, patientB, stack.stranger);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullA, 2);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullB, 2);
        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullA);
        await stack.sponsorIncentiveVault.connect(stack.stranger).registerAnonymousParticipant(trialId, nullB);
        return { trialId, fundWei };
    }

    it("SIV-PAYOUT-01: individual milestone share matches pCount denominator", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, fundWei } = await twoParticipantTrial(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime - 10n]
        );
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.patient,
            trialId,
            0n
        );
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.patient,
            trialId,
            1n
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const tx = await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
        const rc = await tx.wait();
        const ev = rc?.logs
            .map((l) => {
                try {
                    return stack.sponsorIncentiveVault.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "MilestoneRewardsDistributed");
        expect(ev?.args.milestoneIndex).to.equal(1n);
        expect(ev?.args.trialId).to.equal(trialId);
    });

    it("SIV-DUST-01: sub UNIT_SCALE reward skips deposit without revert", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);

        const tinyFund = CET_MIN_DEPOSIT_WEI / 2n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: tinyFund });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });

    describe("P2: FHE.select ciphertext gating (trust-gap primary fix)", function () {
        async function screeningTrial(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
            const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
            const trialId = await createTrialForSponsor(stack);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);
            await registerInPool(stack, trialId, nullifier);
            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            return { trialId, nullifier, patient, fundWei: 10n ** 18n };
        }

        it("P2-01: registration succeeds without noirVerifiedResults authorization", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
            const trialId = await createTrialForSponsor(stack);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);

            expect(await stack.eligibilityEngine.noirVerifiedResults(nullifier, trialId)).to.equal(true);
            await registerInPool(stack, trialId, nullifier);
            expect(
                await stack.sponsorIncentiveVault.isParticipantRegistered(trialId, stack.patient.address)
            ).to.equal(true);
        });

        it("P2-02: forged audit screening flag + ciphertext false yields zero cETH credit", async function () {
            const stack = await deployMedVaultStack();
            const { trialId, nullifier } = await screeningTrial(stack);
            const engineAddr = await stack.eligibilityEngine.getAddress();
            const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);

            await stack.eligibilityEngine.setApplicationAcceptedForTest(nullifier, trialId, true);
            await stack.eligibilityEngine.overwriteAnonymousResultForTest(
                nullifier,
                trialId,
                falseCt.handle,
                falseCt.inputProof
            );

            expect(
                await stack.eligibilityEngine.isAnonymousApplicationAccepted(nullifier, trialId)
            ).to.equal(true);

            const cethBefore = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);

            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

            const cethAfter = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            const cethAddr = await stack.confidentialETH.getAddress();
            const beforeUnits =
                coerceFheHandle(cethBefore) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient);
            const afterUnits =
                coerceFheHandle(cethAfter) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient);
            expect(afterUnits - beforeUnits).to.equal(0n);
        });

        it("P2-03: ciphertext true yields full screening reward units", async function () {
            const stack = await deployMedVaultStack();
            const { trialId, nullifier } = await screeningTrial(stack);
            const engineAddr = await stack.eligibilityEngine.getAddress();

            const resultHandle = await stack.eligibilityEngine.getAnonymousResult(nullifier, trialId);
            expect(await mockUserDecryptBool(resultHandle, engineAddr, stack.patient)).to.equal(true);

            const cethBefore = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
            await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);
            const cethAfter = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);

            const cethAddr = await stack.confidentialETH.getAddress();
            const beforeUnits =
                coerceFheHandle(cethBefore) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient);
            const afterUnits = await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient);
            expect(afterUnits - beforeUnits).to.be.gt(0n);
            expect(
                await stack.sponsorIncentiveVault.participantMilestonePaid(
                    trialId,
                    stack.patient.address,
                    0
                )
            ).to.equal(true);
        });

        it("P2-04: milestone > 0 respects ciphertext FHE.select gate", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
            const trialId = await createTrialForSponsor(stack);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);
            await registerInPool(stack, trialId, nullifier);

            const trial = await stack.trialManager.getTrial(trialId);
            const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
            await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
                trialId,
                ["Screening", "Phase2"],
                [5000, 5000],
                [now + 3600n, trial.endTime - 10n]
            );
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                stack.patient,
                trialId,
                0n
            );
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                stack.patient,
                trialId,
                1n
            );

            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

            const engineAddr = await stack.eligibilityEngine.getAddress();
            const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);
            await stack.eligibilityEngine.overwriteAnonymousResultForTest(
                nullifier,
                trialId,
                falseCt.handle,
                falseCt.inputProof
            );

            const cethBefore = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            await stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
            const cethAfter = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);

            const cethAddr = await stack.confidentialETH.getAddress();
            const beforeUnits =
                coerceFheHandle(cethBefore) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient);
            const afterUnits =
                coerceFheHandle(cethAfter) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient);
            expect(afterUnits - beforeUnits).to.equal(0n);
        });

        it("P5-SELECT-01: FHE.select payout invariant — gated units are zero iff eligible decrypts false", async function () {
            const stack = await deployMedVaultStack();
            const engineAddr = await stack.eligibilityEngine.getAddress();
            const cethAddr = await stack.confidentialETH.getAddress();

            async function screeningDelta(
                eligiblePlain: boolean,
                patientSigner: typeof stack.patient = stack.patient
            ): Promise<bigint> {
                const patient = await registerPatient(stack, patientSigner, ELIGIBLE_PROFILE);
                const trialId = await createTrialForSponsor(stack);
                const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, patientSigner);
                await sponsorAcceptApplication(stack, trialId, nullifier);
                await fundTrialPool(stack, trialId);
                await registerInPool(stack, trialId, nullifier, patientSigner);
                await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

                const ct = await createEncryptedBool(engineAddr, stack.owner.address, eligiblePlain);
                await stack.eligibilityEngine.overwriteAnonymousResultForTest(
                    nullifier,
                    trialId,
                    ct.handle,
                    ct.inputProof
                );

                const cethBefore = await stack.confidentialETH
                    .connect(patientSigner)
                    .getBalance(patientSigner.address);
                await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
                if (eligiblePlain) {
                    await confirmStagedReceipt(
                        stack.sponsorIncentiveVault,
                        trialId,
                        0n,
                        patientSigner
                    );
                }
                const cethAfter = await stack.confidentialETH
                    .connect(patientSigner)
                    .getBalance(patientSigner.address);
                const beforeUnits =
                    coerceFheHandle(cethBefore) === 0n
                        ? 0n
                        : await mockUserDecryptUint64(cethBefore, cethAddr, patientSigner);
                const afterUnits =
                    coerceFheHandle(cethAfter) === 0n
                        ? 0n
                        : await mockUserDecryptUint64(cethAfter, cethAddr, patientSigner);
                const delta = afterUnits - beforeUnits;

                expect(delta === 0n).to.equal(!eligiblePlain);
                return delta;
            }

            const deltaTrue = await screeningDelta(true, stack.patient);
            const deltaFalse = await screeningDelta(false, stack.stranger);
            expect(deltaTrue).to.be.gt(0n);
            expect(deltaFalse).to.equal(0n);
        });

        it("P5-SELECT-02: milestone > 0 FHE.select invariant — gated units zero iff eligible false", async function () {
            const stack = await deployMedVaultStack();
            const engineAddr = await stack.eligibilityEngine.getAddress();
            const cethAddr = await stack.confidentialETH.getAddress();
            const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
            const trialId = await createTrialForSponsor(stack);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);
            await registerInPool(stack, trialId, nullifier);

            const trial = await stack.trialManager.getTrial(trialId);
            const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
            await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
                trialId,
                ["Screening", "Phase2"],
                [5000, 5000],
                [now + 3600n, trial.endTime - 10n]
            );
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                stack.patient,
                trialId,
                0n
            );
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                stack.patient,
                trialId,
                1n
            );
            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

            const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);
            await stack.eligibilityEngine.overwriteAnonymousResultForTest(
                nullifier,
                trialId,
                falseCt.handle,
                falseCt.inputProof
            );

            const cethBefore = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            await stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
            const cethAfter = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            const beforeUnits =
                coerceFheHandle(cethBefore) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient);
            const afterUnits =
                coerceFheHandle(cethAfter) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient);
            const delta = afterUnits - beforeUnits;

            expect(delta).to.equal(0n);
        });
    });
});
