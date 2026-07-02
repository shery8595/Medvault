import { spawnSync } from "node:child_process";
import { sync as globSync } from "glob";

const suites = {
    unit: ["test/smoke/**/*.ts", "test/unit/**/*.ts", "test/staking/**/*.ts"],
    integration: ["test/integration/**/*.ts"],
    crypto: ["test/crypto/noir-nullifier.test.ts"],
    honk: ["test/crypto/honk-pipeline.test.ts"],
    fuzz: ["test/fuzz/**/*.ts", "test/invariants/**/*.ts"],
    fork: ["test/fork/**/*.ts"],
    sepolia: ["test/sepolia/**/*.ts"],
    default: [
        "test/smoke/**/*.ts",
        "test/unit/**/*.ts",
        "test/staking/**/*.ts",
        "test/integration/**/*.ts",
        "test/crypto/noir-nullifier.test.ts",
    ],
};

const name = process.argv[2] ?? "default";
const patterns = suites[name] ?? suites.default;
const files = globSync(patterns, { windowsPathsNoEscape: true });

if (files.length === 0) {
    console.error(`No test files matched suite "${name}"`);
    process.exit(1);
}

const result = spawnSync("npx", ["hardhat", "test", ...files], {
    stdio: "inherit",
    shell: true,
});

process.exit(result.status ?? 1);
