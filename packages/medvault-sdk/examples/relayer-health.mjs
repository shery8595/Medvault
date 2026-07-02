/**
 * Check MedVault anonymous-apply relayer health.
 *
 * Prerequisites:
 *   npm run sdk:build          # builds @medvault/core + @medvault/sdk
 *   peer: ethers@6.16.0
 *
 * Usage:
 *   MEDVAULT_RELAYER_URL=https://... node packages/medvault-sdk/examples/relayer-health.mjs
 *
 * Falls back to the production relayer URL when MEDVAULT_RELAYER_URL is unset.
 */
import { MedVaultSDK } from "../dist/index.js";

const DEFAULT_RELAYER = "https://medvault-relayer-production.up.railway.app";

const sdk = MedVaultSDK.create({
  relayerUrl: process.env.MEDVAULT_RELAYER_URL?.trim() || DEFAULT_RELAYER,
  rpcUrl: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  subgraphUrl: process.env.MEDVAULT_SUBGRAPH_URL || "https://example.com",
});

async function main() {
  const health = await sdk.relayer.health();
  console.log(JSON.stringify(health, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
