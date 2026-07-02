import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createEncryptedTrialForSponsor,
    seedPatientClear,
    mintClearCeth,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { Identity } from "@semaphore-protocol/identity";
import { impersonateAccount } from "../../test-support/signers";
import type { PatientProfileValues } from "../../test-support/fhe";

const AGE_RANGE = Array.from({ length: 20 }, (_, i) => 18 + i * 2);
const WEIGHT_RANGE = Array.from({ length: 10 }, (_, i) => 50 + i * 5);

function profileVariant(age: number, weight: number, flags: number): PatientProfileValues {
    return {
        age,
        gender: flags % 2 === 0,
        weight,
        height: 160 + (flags % 30),
        hasDiabetes: flags % 3 === 0,
        hbLevel: 100 + (flags % 80),
        isSmoker: flags % 5 === 0,
        hasHypertension: flags % 7 === 0,
    };
}

describe("Unit: Edge-case parametric matrix", function () {
    this.timeout(600_000);

    let caseIdx = 0;
    for (const age of AGE_RANGE) {
        for (const weight of WEIGHT_RANGE) {
            for (const flags of [0, 1, 2, 3]) {
                const idx = caseIdx++;
                it(`ECM-${idx}: profile age=${age} weight=${weight} flags=${flags} registers and reads`, async function () {
                    const stack = await deployMedVaultStack();
                    const id = new Identity();
                    const profile = profileVariant(age, weight, flags);
                    await seedPatientClear(stack, id.commitment, stack.patient.address, profile);
                    const registry = await impersonateAccount(
                        await stack.medVaultRegistry.getAddress()
                    );
                    const trialId = await createEncryptedTrialForSponsor(stack, stack.sponsor, {
                        minAge: 18,
                        maxAge: 90,
                        maxWeight: 200,
                    });
                    const result = await stack.eligibilityEngine
                        .connect(registry)
                        .compareCachedEligibilityPaths(id.commitment, trialId);
                    const cached = result.cachedFinal ?? result[0];
                    const refreshed = result.refreshedFinal ?? result[1];
                    expect(cached).to.equal(refreshed);
                });
            }
        }
    }

    const mintCases = Array.from({ length: 32 }, (_, i) => 1n + BigInt(i) * 3n);
    for (const units of mintCases) {
        it(`ECM-MINT-${units}: mintClear ${units} units`, async function () {
            const stack = await deployMedVaultStack();
            await mintClearCeth(stack, stack.stranger.address, units);
            const bal = await stack.confidentialETH.confidentialBalanceOf(stack.stranger.address);
            expect(bal).to.not.equal(ethers.ZeroHash);
        });
    }
});
