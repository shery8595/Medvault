import { expect } from "chai";
import hre from "hardhat";
import { deployMedVaultStack } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";

const RUNS = Number((hre.config as { fuzz?: { runs?: number } }).fuzz?.runs ?? 64);

describe("Fuzz: encrypted criteria bounds", function () {
    this.timeout(300_000);

    for (let i = 0; i < RUNS; i++) {
        it(`CRIT-FUZZ-${i}: criteria within fhEVM bounds do not revert on trial create`, async function () {
            const stack = await deployMedVaultStack();
            const minAge = i % 100;
            const maxAge = Math.min(255, minAge + (i % 50));
            const minHb = i % 500;
            const maxWeight = 100 + (i % 1000);

            const enc = await (
                await import("../../test-support/fhe")
            ).buildSponsorCriteriaInputs(
                await stack.trialManager.getAddress(),
                stack.sponsor.address,
                {
                    minAge,
                    maxAge,
                    requiresDiabetes: i % 2 === 0,
                    minHb,
                    genderReq: i % 3,
                    minHeight: 100 + (i % 100),
                    maxWeight,
                    requiresNonSmoker: i % 2 === 1,
                    requiresNormalBP: i % 4 === 0,
                }
            );

            const tx = await stack.trialManager
                .connect(stack.sponsor)
                .createTrialWithEncryptedCriteria(
                    `Fuzz ${i}`,
                    "P1",
                    "EU",
                    "100",
                    enc.minAge.handle,
                    enc.maxAge.handle,
                    enc.requiresDiabetes.handle,
                    enc.minHb.handle,
                    enc.genderRequirement.handle,
                    enc.minHeight.handle,
                    enc.maxWeight.handle,
                    enc.requiresNonSmoker.handle,
                    enc.requiresNormalBP.handle,
                    enc.inputProof,
                    86400
                );
            await tx.wait();
        });
    }
});
