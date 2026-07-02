import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { expectRevert } from "../../test-support/assertions";
import { resetHardhatFheMockNetwork } from "../../test-support/hardhatNetwork";
import { DEFAULT_TRIAL_PARAMS, ETHEREUM_SEPOLIA_CHAIN_ID } from "../../test-support/constants";

const FORK_URL = process.env.SEPOLIA_RPC_URL || "";
const FORK_ENABLED = Boolean(FORK_URL) && process.env.TEST_SUITE === "fork";

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

(FORK_ENABLED ? describe : describe.skip)("Fork: trial plaintext gate (LEG-01)", function () {
    this.timeout(300_000);

    after(async function () {
        await resetHardhatFheMockNetwork();
    });

    before(async function () {
        if (!FORK_URL) this.skip();
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: FORK_URL,
                        blockNumber: Number(process.env.SEPOLIA_FORK_BLOCK || 7_500_000),
                    },
                },
            ],
        });
        const net = await ethers.provider.getNetwork();
        if (net.chainId !== BigInt(ETHEREUM_SEPOLIA_CHAIN_ID)) {
            this.skip();
        }
    });

    it("LEG-01: createTrial reverts off Hardhat chainid (Sepolia fork)", async function () {
        const [owner, sponsor] = await ethers.getSigners();
        const sponsorRegistry = await (await ethers.getContractFactory("SponsorRegistry")).deploy();
        await sponsorRegistry.waitForDeployment();
        const trialManager = await (
            await ethers.getContractFactory("TrialManager")
        ).deploy(await sponsorRegistry.getAddress(), true);
        await trialManager.waitForDeployment();
        await sponsorRegistry.connect(owner).addSponsor(sponsor.address, "Fork Sponsor");

        await expectRevert(
            trialManager.connect(sponsor).createTrial(...trialArgs),
            /Use createTrialWithEncryptedCriteria on mainnet\/testnet/
        );
    });
});
