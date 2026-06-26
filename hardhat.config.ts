import { register } from "ts-node";
register({
    transpileOnly: true,
    compilerOptions: {
        module: "commonjs",
        moduleResolution: "node",
        esModuleInterop: true,
    },
});

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "@fhevm/hardhat-plugin";
import "solidity-coverage";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

function mochaSpecs(): string[] | undefined {
    const suite = process.env.TEST_SUITE;
    if (suite === "unit") {
        return ["test/smoke/**/*.ts", "test/unit/**/*.ts", "test/staking/**/*.ts"];
    }
    if (suite === "integration") {
        return ["test/integration/**/*.ts"];
    }
    if (suite === "crypto") {
        return ["test/crypto/noir-nullifier.test.ts"];
    }
    if (suite === "honk") {
        return ["test/crypto/honk-pipeline.test.ts"];
    }
    // Default `npm test`: full suite except slow Honk pipeline
    return [
        "test/smoke/**/*.ts",
        "test/unit/**/*.ts",
        "test/staking/**/*.ts",
        "test/integration/**/*.ts",
        "test/crypto/noir-nullifier.test.ts",
    ];
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        compilers: [
            {
                version: "0.8.27",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                    evmVersion: "cancun",
                    metadata: {
                        bytecodeHash: "none",
                    },
                },
            },
        ],
        // HonkVerifier uses raw EVM assembly that is not annotated with
        // "memory-safe", so the Yul optimizer (viaIR) rejects it.
        // Compile it without viaIR so assembly goes through the classic
        // EVM code-gen path instead.
        overrides: {
            "contracts/HonkVerifier.sol": {
                version: "0.8.27",
                settings: {
                    viaIR: false,
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                    evmVersion: "cancun",
                },
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 11155111,
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    },
    mocha: {
        timeout: 120_000,
        spec: mochaSpecs(),
    },
};

export default config;
