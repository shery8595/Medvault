/**
 * Create a test trial as a verified sponsor (testnet).
 *
 * Usage:
 *   MEDVAULT_SUBGRAPH_URL=https://...
 *   PRIVATE_KEY=0x...
 *   MEDVAULT_SPONSOR_OPEN_ACCESS=true   # optional testnet bypass
 *   node packages/medvault-sdk/examples/sponsor-create-trial.mjs
 */
import { ethers } from "ethers";
import { MedVaultSDK } from "../dist/index.js";

const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const pk = process.env.PRIVATE_KEY || process.env.MCP_PRIVATE_KEY;

if (!pk) {
  console.error("Set PRIVATE_KEY or MCP_PRIVATE_KEY");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(pk, provider);

const sdk = MedVaultSDK.create({
  signer,
  sponsorOpenAccess: process.env.MEDVAULT_SPONSOR_OPEN_ACCESS === "true",
});

async function main() {
  const result = await sdk.sponsor.createTrial({
    name: `SDK Trial ${Date.now()}`,
    phase: "Phase 1",
    location: "Remote",
    compensation: "Testnet",
    minAge: 18,
    maxAge: 99,
    requiresDiabetes: false,
    minHb: 0,
    genderRequirement: 0,
    minHeight: 0,
    maxWeight: 300,
    requiresNonSmoker: false,
    requiresNormalBP: false,
    durationSeconds: 86400 * 14,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
