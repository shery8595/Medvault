import { expect } from "chai";
import { deployMedVaultStack } from "../../test-support/deployments";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";

describe("Unit: DataAccessLog", function () {
    it("DAL-01: authorized logger writes", async function () {
        const stack = await deployMedVaultStack();
        const hash = "0x" + "ab".repeat(32);
        await stack.dataAccessLog
            .connect(stack.owner)
            .logAction(0, 1, hash);
        expect(await stack.dataAccessLog.getLogCount()).to.equal(1n);
    });

    it("DAL-02: unauthorized logger reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.dataAccessLog.connect(stack.stranger).logAction(0, 1, "0x" + "00".repeat(32)),
            /Not authorized logger|reverted/
        );
    });

    it("DAL-03: ring buffer at MAX_LOG_ENTRIES", async function () {
        const stack = await deployMedVaultStack();
        const max = await stack.dataAccessLog.MAX_LOG_ENTRIES();
        const hash = "0x" + "cd".repeat(32);
        for (let i = 0; i < Number(max) + 5; i++) {
            await stack.dataAccessLog.connect(stack.owner).logAction(0, i, hash);
        }
        expect(await stack.dataAccessLog.getLogCount()).to.equal(max);
    });

    it("DAL-04: getLog returns fields", async function () {
        const stack = await deployMedVaultStack();
        const hash = "0x" + "ef".repeat(32);
        await stack.dataAccessLog.connect(stack.owner).logAction(1, 2, hash);
        const entry = await stack.dataAccessLog.getLog(0);
        expect(entry.trialId).to.equal(2n);
        expect(entry.patientHash).to.equal(hash);
    });

    it("DAL-05: owner schedules and applies authorized logger", async function () {
        const stack = await deployMedVaultStack();
        const { time } = await import("@nomicfoundation/hardhat-network-helpers");
        await stack.dataAccessLog
            .connect(stack.owner)
            .scheduleAuthorizedLogger(stack.stranger.address, true);
        await time.increase(Number(await stack.dataAccessLog.LOGGER_CHANGE_DELAY()) + 1);
        await stack.dataAccessLog.connect(stack.owner).applyAuthorizedLogger(stack.stranger.address);
        expect(await stack.dataAccessLog.isAuthorizedLogger(stack.stranger.address)).to.equal(true);
    });

    it("DAL-06: performer is msg.sender", async function () {
        const stack = await deployMedVaultStack();
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await stack.dataAccessLog.connect(engineSigner).logAction(2, 1, "0x" + "11".repeat(32));
        const entry = await stack.dataAccessLog.getLog(0);
        expect(entry.performer).to.equal(await stack.eligibilityEngine.getAddress());
    });
});
