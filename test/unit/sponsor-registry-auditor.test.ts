import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack } from "../../test-support/deployments";
import { expectRevert } from "../../test-support/assertions";
import { advanceTimelock, scheduleAndApply } from "../../test-support/timelock";

describe("Unit: SponsorRegistry auditor role", function () {
    it("SRA-01: scheduleAuditor(ZERO) reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.sponsorRegistry.connect(stack.owner).scheduleAuditor(ethers.ZeroAddress),
            "Zero auditor"
        );
    });

    it("SRA-02: applyAuditor before timelock reverts", async function () {
        const stack = await deployMedVaultStack();
        await stack.sponsorRegistry
            .connect(stack.owner)
            .scheduleAuditor(stack.stranger.address);
        await expectRevert(
            stack.sponsorRegistry.connect(stack.owner).applyAuditor(),
            "Timelock active"
        );
    });

    it("SRA-03: after timelock applyAuditor sets auditor", async function () {
        const stack = await deployMedVaultStack();
        await scheduleAndApply(
            () =>
                stack.sponsorRegistry
                    .connect(stack.owner)
                    .scheduleAuditor(stack.stranger.address),
            () => stack.sponsorRegistry.connect(stack.owner).applyAuditor()
        );
        expect(await stack.sponsorRegistry.auditor()).to.equal(stack.stranger.address);
    });

    it("SRA-04: auditor can read encrypted institution ID; stranger reverts", async function () {
        const stack = await deployMedVaultStack();
        await scheduleAndApply(
            () =>
                stack.sponsorRegistry
                    .connect(stack.owner)
                    .scheduleAuditor(stack.stranger.address),
            () => stack.sponsorRegistry.connect(stack.owner).applyAuditor()
        );

        await stack.sponsorRegistry
            .connect(stack.stranger)
            .getEncryptedInstitutionId(stack.sponsor.address);

        await expectRevert(
            stack.sponsorRegistry
                .connect(stack.sponsor2)
                .getEncryptedInstitutionId(stack.sponsor.address),
            "Not authorized"
        );
    });

    it("SRA-05: applyAuditor clears pendingAuditor and auditorChangeEta", async function () {
        const stack = await deployMedVaultStack();
        await stack.sponsorRegistry
            .connect(stack.owner)
            .scheduleAuditor(stack.stranger.address);
        await advanceTimelock();
        await stack.sponsorRegistry.connect(stack.owner).applyAuditor();

        expect(await stack.sponsorRegistry.pendingAuditor()).to.equal(ethers.ZeroAddress);
        expect(await stack.sponsorRegistry.auditorChangeEta()).to.equal(0n);
    });
});
