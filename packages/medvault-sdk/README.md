# @medvault/sdk

TypeScript SDK for **MedVault** — private, FHE-powered clinical trials on **Ethereum Sepolia**.

No hosting required: install the package and call subgraph, RPC, or your deployed **relayer** from Node, scripts, or MCP.

**In-app documentation:** [med-vault.xyz/docs/mcp/sdk](https://med-vault.xyz/docs/mcp/sdk)

## Install (monorepo)

```bash
npm install
npm run sdk:build
```

From another project (after publish):

```bash
npm install @medvault/sdk ethers
```

## Quick start

```typescript
import { MedVaultSDK } from "@medvault/sdk";

const sdk = MedVaultSDK.create({
  rpcUrl: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  subgraphUrl: process.env.MEDVAULT_SUBGRAPH_URL!,
  relayerUrl: "https://medvault-relayer-production.up.railway.app",
});

const trials = await sdk.trials.listActive({ first: 10 });
console.log(trials);

const health = await sdk.relayer.health();
console.log(health);
```

Environment variables (optional): `SEPOLIA_RPC_URL`, `MEDVAULT_SUBGRAPH_URL`, `MEDVAULT_RELAYER_URL`, `MEDVAULT_SPONSOR_OPEN_ACCESS`.

## Modules

| Module | Purpose |
|--------|---------|
| `sdk.trials` | List active trials, trials by sponsor (subgraph) |
| `sdk.sponsor` | Verification, stats, audit logs, pool status (amounts sponsor-only on-chain); writes need `signer` |
| `sdk.protocol` | Contract addresses, catalog, wiring check |
| `sdk.relayer` | Gasless anonymous apply (`/health`, `/relay/apply-stage`, `/relay/apply-finalize`) |

## Sponsor writes

Pass a wallet `signer` and ensure the address is verified on `SponsorRegistry` (or set `sponsorOpenAccess: true` on testnet only):

```typescript
import { ethers } from "ethers";
import { MedVaultSDK } from "@medvault/sdk";

const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const sdk = MedVaultSDK.create({ subgraphUrl: "...", signer });

const { trialId, txHashes } = await sdk.sponsor.createTrial({
  name: "SDK Test Trial",
  phase: "Phase 1",
  location: "Remote",
  compensation: "0.01 ETH",
  minAge: 18,
  maxAge: 65,
  requiresDiabetes: false,
  minHb: 0,
  genderRequirement: 0,
  minHeight: 0,
  maxWeight: 300,
  requiresNonSmoker: false,
  requiresNormalBP: false,
  durationSeconds: 86400 * 30,
});
```

## Examples

```bash
# List trials (needs MEDVAULT_SUBGRAPH_URL)
node packages/medvault-sdk/examples/list-trials.mjs

# Relayer health (needs MEDVAULT_RELAYER_URL or default in example)
node packages/medvault-sdk/examples/relayer-health.mjs

# Create trial (needs PRIVATE_KEY + subgraph)
node packages/medvault-sdk/examples/sponsor-create-trial.mjs
```

## Security

- Never commit `PRIVATE_KEY` or relayer keys.
- SDK does **not** decrypt patient health data or run Semaphore identity generation.
- Relayer `finalizeApply` requires `decryptedEligible: true` and a valid threshold decrypt signature from the client.

## Related

- [`@medvault/core`](../medvault-core/) — low-level protocol helpers (used by this SDK)
- [`mcp-server`](../../mcp-server/) — MCP tools for sponsors
- [`relayer`](../../relayer/) — hosted gasless anonymous apply service

After contract deploys, sync packaged assets:

```bash
npm run sync-sdk-assets
```
