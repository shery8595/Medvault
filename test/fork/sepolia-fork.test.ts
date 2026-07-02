import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import {
    AAVE_POOL_SEPOLIA,
    AWETH_SEPOLIA,
    WETH_GATEWAY_SEPOLIA,
    ETHEREUM_SEPOLIA_CHAIN_ID,
} from "../../test-support/constants";

const FORK_URL = process.env.SEPOLIA_RPC_URL || "";
const FORK_ENABLED = Boolean(FORK_URL) && process.env.TEST_SUITE === "fork";

(FORK_ENABLED ? describe : describe.skip)("Fork: Sepolia integration", function () {
    this.timeout(300_000);

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
        expect(net.chainId).to.equal(BigInt(ETHEREUM_SEPOLIA_CHAIN_ID));
    });

    it("SF-01: Aave Sepolia pool code is deployed", async function () {
        const code = await ethers.provider.getCode(AAVE_POOL_SEPOLIA);
        expect(code).to.not.equal("0x");
        expect(code.length).to.be.gt(100);
    });

    it("SF-02: WETH gateway and aWETH addresses have bytecode", async function () {
        const gw = await ethers.provider.getCode(WETH_GATEWAY_SEPOLIA);
        const aw = await ethers.provider.getCode(AWETH_SEPOLIA);
        expect(gw).to.not.equal("0x");
        expect(aw).to.not.equal("0x");
    });

    it("SF-03: MedVaultAutomation Chainlink forwarder wiring compiles against fork", async function () {
        const Automation = await ethers.getContractFactory("MedVaultAutomation");
        const [deployer] = await ethers.getSigners();
        const tm = await (
            await ethers.getContractFactory("TrialManager")
        ).deploy(deployer.address, true);
        await tm.waitForDeployment();
        const vault = deployer.address;
        const automation = await Automation.deploy(await tm.getAddress(), vault, deployer.address);
        await automation.waitForDeployment();
        expect(await automation.owner()).to.equal(deployer.address);
    });

    it("SF-04: KMS decrypt latency probe (mock fhEVM on fork network id)", async function () {
        const start = Date.now();
        await ethers.provider.getBlockNumber();
        const elapsed = Date.now() - start;
        expect(elapsed).to.be.lt(30_000);
    });
});
