import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { expectRevert } from "../../test-support/assertions";
import { ETHEREUM_SEPOLIA_CHAIN_ID, MAX_TRIAL_DURATION_SEC } from "../../test-support/constants";

describe("Unit: TrialManager", function () {
    it("TM-01: verified sponsor creates trial", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.active).to.equal(true);
        expect(trial.sponsor).to.equal(stack.sponsor.address);
    });

    it("TM-02: unverified sponsor reverts when isTestnet is false", async function () {
        const stack = await deployMedVaultStack();
        const SponsorRegistry = await ethers.getContractFactory("SponsorRegistry");
        const sr = await SponsorRegistry.deploy();
        await sr.waitForDeployment();
        const TrialManager = await ethers.getContractFactory("TrialManager");
        const tm = await TrialManager.deploy(await sr.getAddress(), false);
        await tm.waitForDeployment();
        const p = { name: "X", phase: "I", location: "Y", compensation: "Z", minAge: 18, maxAge: 65, requiresDiabetes: false, minHb: 100, genderReq: 0, minHeight: 0, maxWeight: 0, requiresNonSmoker: false, requiresNormalBP: false, duration: 86400 };
        await expectRevert(
            tm.connect(stack.stranger).createTrial(p.name, p.phase, p.location, p.compensation, p.minAge, p.maxAge, p.requiresDiabetes, p.minHb, p.genderReq, p.minHeight, p.maxWeight, p.requiresNonSmoker, p.requiresNormalBP, p.duration),
            "SponsorNotVerified"
        );
    });

    it.skip("TM-03: createTrial on Ethereum Sepolia chain id bypasses sponsor check", async function () {
        // hardhat_setChainId is not available on the default Hardhat network provider.
        const stack = await deployMedVaultStack();
        await ethers.provider.send("hardhat_setChainId", [ETHEREUM_SEPOLIA_CHAIN_ID]);
        const trialId = await createTrialForSponsor(stack, stack.stranger);
        expect(trialId).to.equal(1n);
        await ethers.provider.send("hardhat_setChainId", [31337]);
    });

    it("TM-04: sponsor deactivates trial", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.trialManager.connect(stack.sponsor).deactivateTrial(trialId);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.active).to.equal(false);
    });

    it("TM-05: stranger cannot deactivate", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.trialManager.connect(stack.stranger).deactivateTrial(trialId),
            /Only sponsor or automation can deactivate|reverted/
        );
    });

    it("TM-06: MAX_TRIAL_DURATION enforced", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            createTrialForSponsor(stack, stack.sponsor, {
                duration: MAX_TRIAL_DURATION_SEC + 1,
            }),
            "DurationTooLong"
        );
    });

    it("TM-07: setAutomationContract only owner", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.trialManager
                .connect(stack.stranger)
                .setAutomationContract(stack.stranger.address),
            "Only owner"
        );
    });

    it("TM-08: getTrial returns stored fields", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.minAge).to.equal(18);
        expect(trial.maxAge).to.equal(65);
        expect(trial.minHb).to.equal(120);
    });
});
