import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createEncryptedTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { impersonateAccount } from "../../test-support/signers";
import { Identity } from "@semaphore-protocol/identity";

describe("Unit: HCU cache", function () {
    it("HCU-01: patient handles cached at registration", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.anonymousPatientRegistry.isPatientHandlesCached(id.commitment)).to.equal(true);
    });

    it("HCU-02: compareCachedEligibilityPaths is bit-identical", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createEncryptedTrialForSponsor(stack, stack.sponsor);
        const registry = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const result = await stack.eligibilityEngine
            .connect(registry)
            .compareCachedEligibilityPaths(id.commitment, trialId);
        const cached = result.cachedFinal ?? result[0];
        const refreshed = result.refreshedFinal ?? result[1];
        expect(cached).to.equal(refreshed);
    });
});
