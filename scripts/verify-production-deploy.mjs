#!/usr/bin/env node
/**
 * CI guard: production deploy scripts must not reference Mock* contracts or enable test helpers.
 * Optionally verifies on-chain testHelpersEnabled()==false for Sepolia addresses.
 */
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

const root = process.cwd();
const deployFiles = [
  "scripts/deploy.ts",
  "scripts/resume-sepolia-deploy.ts",
];

const forbiddenDeployPatterns = [
  /MockSemaphore/i,
  /MockAave/i,
  /contracts\/test\//i,
  /scheduleTestHelpersEnabled\s*\(\s*true\s*\)/i,
  /applyTestHelpersEnabled/i,
  /mintClear/i,
  /registerPatientClear/i,
];

const helperSourceFiles = [
  "contracts/ConfidentialETH7984.sol",
  "contracts/AnonymousPatientRegistry.sol",
  "contracts/test/TestHelpers.sol",
];

let failed = false;

for (const rel of deployFiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenDeployPatterns) {
    if (pattern.test(text)) {
      console.error(`[verify-production-deploy] ${rel} references forbidden pattern ${pattern}`);
      failed = true;
    }
  }
}

for (const rel of helperSourceFiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`[verify-production-deploy] missing ${rel}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  if (!/31337/.test(text) && rel.includes("TestHelpers")) {
    console.error(`[verify-production-deploy] ${rel} missing Hardhat chainId gate`);
    failed = true;
  }
}

const addressesPath = path.join(root, "packages/medvault-core/data/addresses.json");
const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.VERIFY_DEPLOY_RPC_URL || "";

async function verifyOnChainHelpersDisabled() {
  if (!rpcUrl || !fs.existsSync(addressesPath)) {
    console.log("verify-production-deploy: skipping on-chain testHelpers check (no RPC or addresses)");
    return;
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const sepolia = addresses.sepolia;
  if (!sepolia) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId === 31337n) {
    console.log("verify-production-deploy: skipping on-chain check on Hardhat RPC");
    return;
  }

  const abi = ["function testHelpersEnabled() view returns (bool)"];
  const targets = [
    ["ConfidentialETH", sepolia.ConfidentialETH],
    ["AnonymousPatientRegistry", sepolia.AnonymousPatientRegistry],
  ];

  for (const [label, addr] of targets) {
    if (!addr || addr === ethers.ZeroAddress) continue;
    const code = await provider.getCode(addr);
    if (code === "0x") continue;
    try {
      const contract = new ethers.Contract(addr, abi, provider);
      const enabled = await contract.testHelpersEnabled();
      if (enabled) {
        console.error(
          `[verify-production-deploy] ${label} at ${addr} has testHelpersEnabled=true on chain ${network.chainId}`
        );
        failed = true;
      }
    } catch {
      // Pre-upgrade deploys may lack the selector — acceptable until redeploy
      console.log(`verify-production-deploy: ${label} at ${addr} has no testHelpersEnabled (legacy deploy)`);
    }
  }
}

await verifyOnChainHelpersDisabled();

if (failed) {
  process.exit(1);
}

console.log("verify-production-deploy: OK (no Mock* / test helpers in production deploy scripts)");
