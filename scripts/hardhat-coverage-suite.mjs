#!/usr/bin/env node
/**
 * Run solidity-coverage on the same file set as `npm test` (default suite).
 * Fuzz/fork/Honk are excluded so coverage completes in CI-sized time.
 */
import { spawnSync } from "node:child_process";

const testGlob =
    "{test/smoke,test/unit,test/staking,test/integration}/**/*.ts,test/crypto/noir-nullifier.test.ts";

const result = spawnSync("npx", ["hardhat", "coverage", "--testfiles", testGlob], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, SOLIDITY_COVERAGE: "true" },
});

process.exit(result.status ?? 1);
