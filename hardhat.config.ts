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
    if (suite === "fuzz") {
        return ["test/fuzz/**/*.ts", "test/invariants/**/*.ts"];
    }
    if (suite === "fork") {
        return ["test/fork/**/*.ts"];
    }
    if (suite === "sepolia") {
        return ["test/sepolia/**/*.ts"];
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
            "contracts/HonkVerifierEncrypted.sol": {
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
            allowUnlimitedContractSize: true,
            ...(process.env.SOLIDITY_COVERAGE === "true"
                ? {
                      blockGasLimit: 0x1fffffffffffff,
                      gas: 0xffffffffff,
                      gasPrice: 1,
                      initialBaseFeePerGas: 0,
                  }
                : {}),
            ...(process.env.RUN_LARGE_POOL_TEST
                ? {
                      accounts: {
                          count: 60,
                          accountsBalance: "10000000000000000000",
                      },
                  }
                : {}),
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 11155111,
        },
        sepoliaFork: {
            url: SEPOLIA_RPC_URL || "http://127.0.0.1:8545",
            forking: SEPOLIA_RPC_URL
                ? {
                      url: SEPOLIA_RPC_URL,
                      blockNumber: process.env.SEPOLIA_FORK_BLOCK
                          ? Number(process.env.SEPOLIA_FORK_BLOCK)
                          : undefined,
                  }
                : undefined,
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
    fuzz: {
        runs: 256,
    },
};

export default config;
