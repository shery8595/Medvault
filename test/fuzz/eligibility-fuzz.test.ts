import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createEncryptedTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { impersonateAccount } from "../../test-support/signers";
import { Identity } from "@semaphore-protocol/identity";

const RUNS = Number((hre.config as { fuzz?: { runs?: number } }).fuzz?.runs ?? 64);

describe("Fuzz: eligibility cached vs refreshed paths", function () {
    this.timeout(300_000);

    for (let i = 0; i < RUNS; i++) {
        it(`ELIG-FUZZ-${i}: bit-identical encrypted eligibility`, async function () {
            const stack = await deployMedVaultStack();
            const age = 18 + (i % 50);
            const weight = 50 + (i % 80);
            const profile = {
                ...ELIGIBLE_PROFILE,
                age,
                weight,
                hasDiabetes: i % 3 === 0,
                isSmoker: i % 5 === 0,
            };

            const id = new Identity();
            await registerPatientOnRegistry(
                stack,
                stack.patient,
                id.commitment,
                stack.patient.address,
                profile
            );

            const trialId = await createEncryptedTrialForSponsor(stack, stack.sponsor, {
                minAge: 18,
                maxAge: 80,
                minHb: 5,
                maxWeight: 200,
            });
            const registry = await impersonateAccount(await stack.medVaultRegistry.getAddress());
            const result = await stack.eligibilityEngine
                .connect(registry)
                .compareCachedEligibilityPaths(id.commitment, trialId);
            const cached = result.cachedFinal ?? result[0];
            const refreshed = result.refreshedFinal ?? result[1];
            expect(cached).to.equal(refreshed);
        });
    }
});
