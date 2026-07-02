import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    seedPatientForAnonymousApply,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { Identity } from "@semaphore-protocol/identity";
import { walletApplyWithConsent } from "../../test-support/journey";
import { deriveNullifier } from "../../test-support/semaphore";
import type { RegisteredPatient } from "../../test-support/journey";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { mockUserDecryptUint64 } from "../../test-support/fhe";

const RUNS = Number((hre.config as { fuzz?: { runs?: number } }).fuzz?.runs ?? 256);

describe("Fuzz: zero-revelation reward distribution", function () {
    this.timeout(600_000);

    for (let i = 0; i < RUNS; i++) {
        it(`ZR-FUZZ-${i}: screening reward without pool size revelation to patient`, async function () {
            const stack = await deployMedVaultStack();
            const id = new Identity();
            const profile = {
                ...ELIGIBLE_PROFILE,
                age: 20 + (i % 45),
                weight: 55 + (i % 60),
                isSmoker: i % 4 === 0,
            };
            await seedPatientForAnonymousApply(
                stack,
                id.commitment,
                stack.patient.address,
                profile
            );
            const trialId = await createTrialForSponsor(stack, stack.sponsor, {
                minAge: 18,
                maxAge: 80,
            });

            const patient: RegisteredPatient = {
                identity: id,
                commitment: id.commitment,
                profile,
                nullifierFor: (tid: bigint) => deriveNullifier(id, tid),
            };
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);

            const fundWei = BigInt(10 ** 18) + BigInt(i % 1000);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
            await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);

            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

            const balHandle = await stack.confidentialETH.confidentialBalanceOf(stack.patient.address);
            const units = await mockUserDecryptUint64(
                balHandle,
                await stack.confidentialETH.getAddress(),
                stack.patient.address
            );
            expect(units).to.be.gt(0n);

            const pool = await stack.sponsorIncentiveVault.getEncryptedPoolSize(trialId);
            expect(pool).to.not.equal(ethers.ZeroHash);
        });
    }
});
