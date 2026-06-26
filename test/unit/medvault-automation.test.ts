import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { expectRevert } from "../../test-support/assertions";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";

describe("Unit: MedVaultAutomation", function () {
    it("MVA-01: onTrialCreated tracks trial", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        expect(await stack.medVaultAutomation.activeTrialIds(0)).to.equal(trialId);
    });

    it("MVA-02: checkUpkeep true when trial expired", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [needed, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        expect(needed).to.equal(true);
        expect(data).to.not.equal("0x");
    });

    it("MVA-03: performUpkeep only forwarder or owner", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await expectRevert(
            stack.medVaultAutomation.connect(stack.stranger).performUpkeep(data),
            "Only forwarder or owner"
        );
    });

    it("MVA-04: owner performUpkeep deactivates trial without participants", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(data);
        expect(await stack.medVaultAutomation.finalized(trialId)).to.equal(false);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.active).to.equal(false);
    });

    it("MVA-05: finalized prevents duplicate upkeep need", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(data);
        const [needed] = await stack.medVaultAutomation.checkUpkeep("0x");
        expect(needed).to.equal(false);
    });

    it("MVA-06: setChainlinkForwarder and forwarder performUpkeep deactivates trial", async function () {
        const stack = await deployMedVaultStack();
        await stack.medVaultAutomation
            .connect(stack.owner)
            .setChainlinkForwarder(stack.stranger.address);
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.stranger).performUpkeep(data);
        expect(await stack.medVaultAutomation.finalized(trialId)).to.equal(false);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.active).to.equal(false);
    });
});
