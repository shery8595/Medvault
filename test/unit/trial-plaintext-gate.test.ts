import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { deployMedVaultStack, createEncryptedTrialForSponsor } from "../../test-support/deployments";
import { buildSponsorCriteriaInputs } from "../../test-support/fhe";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";

const trialArgs = [
    DEFAULT_TRIAL_PARAMS.name,
    DEFAULT_TRIAL_PARAMS.phase,
    DEFAULT_TRIAL_PARAMS.location,
    DEFAULT_TRIAL_PARAMS.compensation,
    DEFAULT_TRIAL_PARAMS.minAge,
    DEFAULT_TRIAL_PARAMS.maxAge,
    DEFAULT_TRIAL_PARAMS.requiresDiabetes,
    DEFAULT_TRIAL_PARAMS.minHb,
    DEFAULT_TRIAL_PARAMS.genderReq,
    DEFAULT_TRIAL_PARAMS.minHeight,
    DEFAULT_TRIAL_PARAMS.maxWeight,
    DEFAULT_TRIAL_PARAMS.requiresNonSmoker,
    DEFAULT_TRIAL_PARAMS.requiresNormalBP,
    DEFAULT_TRIAL_PARAMS.duration,
] as const;

describe("Unit: trial plaintext gate (LEG)", function () {
    it("LEG-02: createTrial succeeds on chainid 31337", async function () {
        const stack = await deployMedVaultStack();
        const network = await ethers.provider.getNetwork();
        expect(network.chainId).to.equal(31337n);

        const tx = await stack.trialManager.connect(stack.sponsor).createTrial(...trialArgs);
        const rc = await tx.wait();
        const created = rc?.logs
            .map((l) => {
                try {
                    return stack.trialManager.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "TrialCreated");
        expect(created).to.not.equal(undefined);
        expect(created!.args.encryptedCriteria).to.equal(false);
    });

    it("LEG-03: createTrialWithEncryptedCriteria succeeds on Hardhat (no plaintext gate)", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createEncryptedTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.encryptedCriteria).to.equal(true);
    });

    it("LEG-04: encrypted criteria handles bind to TrialManager address", async function () {
        const stack = await deployMedVaultStack();
        const tmAddr = await stack.trialManager.getAddress();
        const inputs = await buildSponsorCriteriaInputs(tmAddr, stack.sponsor.address, {
            minAge: DEFAULT_TRIAL_PARAMS.minAge,
            maxAge: DEFAULT_TRIAL_PARAMS.maxAge,
            requiresDiabetes: DEFAULT_TRIAL_PARAMS.requiresDiabetes,
            minHb: DEFAULT_TRIAL_PARAMS.minHb,
            genderReq: DEFAULT_TRIAL_PARAMS.genderReq,
            minHeight: DEFAULT_TRIAL_PARAMS.minHeight,
            maxWeight: DEFAULT_TRIAL_PARAMS.maxWeight > 0 ? DEFAULT_TRIAL_PARAMS.maxWeight : 65535,
            requiresNonSmoker: DEFAULT_TRIAL_PARAMS.requiresNonSmoker,
            requiresNormalBP: DEFAULT_TRIAL_PARAMS.requiresNormalBP,
        });
        expect(inputs.inputProof).to.be.a("string");
        expect(inputs.inputProof.length).to.be.greaterThan(10);
    });
});
