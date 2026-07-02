# @medvault/sdk

[![npm version](https://img.shields.io/npm/v/@medvault/sdk.svg)](https://www.npmjs.com/package/@medvault/sdk)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](../../LICENSE)

TypeScript SDK for **MedVault** — private, FHE-powered clinical trials on **Ethereum Sepolia**.

No hosting required: install the package and call subgraph, RPC, or your deployed **relayer** from Node, scripts, or MCP.

**In-app documentation:** [med-vault.xyz/docs/mcp/sdk](https://med-vault.xyz/docs/mcp/sdk)  
**MCP server (wraps SDK write tools):** [mcp-server/README.md](../../mcp-server/README.md)

## Install

**Peer dependency:** `ethers@6.16.0` (required for sponsor writes and silent-failure guard).

```bash
# Monorepo
npm install
npm run sdk:build

# External project (after publish)
npm install @medvault/sdk ethers@6.16.0
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

Environment variables (optional): `SEPOLIA_RPC_URL`, `MEDVAULT_SUBGRAPH_URL`, `MEDVAULT_RELAYER_URL`, `MEDVAULT_SPONSOR_OPEN_ACCESS`, `MEDVAULT_NETWORK`.

## Public exports (`src/index.ts`)

| Export | Kind |
|--------|------|
| `MedVaultSDK` | class |
| `MedVaultSDKConfig` | type |
| `RelayerSemaphoreProof`, `RelayerStageApplyParams`, `RelayerFinalizeApplyParams` | types |
| `NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE`, `serializeProofForRelay` | relayer helpers |
| `SilentFailureDetected` | error class |
| `captureRecipientBalanceBefore`, `assertConfidentialTransferSucceeded`, `guardConfidentialTransfer` | silent-failure guard |
| `SilentFailureGuardOptions`, `ZamaDecryptSdk` | types |
| `CreateTrialParams`, `CreateTrialResult` | re-exported from `@medvault/core` |

## `MedVaultSDK`

```typescript
class MedVaultSDK {
  static create(input?: MedVaultSDKConfig): MedVaultSDK;

  readonly config: MedVaultConfig;
  readonly provider: ethers.Provider;
  readonly signer: ethers.Signer | null;
  readonly trials: TrialsModule;
  readonly sponsor: SponsorModule;
  readonly protocol: ProtocolModule;
  readonly relayer: RelayerModule;

  get chainId(): bigint; // 11155111n (Sepolia)
  getSignerAddress(): Promise<string | null>;
}
```

### `MedVaultSDKConfig`

| Field | Env fallback | Purpose |
|-------|--------------|---------|
| `rpcUrl` | `SEPOLIA_RPC_URL` | JSON-RPC for on-chain reads/writes |
| `subgraphUrl` | `MEDVAULT_SUBGRAPH_URL` | Required for trial/sponsor subgraph reads |
| `relayerUrl` | `MEDVAULT_RELAYER_URL` | Base URL for `sdk.relayer.*` |
| `networkKey` | `MEDVAULT_NETWORK` | `"sepolia"` (default) or `"hardhat"` |
| `sponsorOpenAccess` | `MEDVAULT_SPONSOR_OPEN_ACCESS` | Testnet bypass of `SponsorRegistry` |
| `maxEthPerTx` | `MCP_MAX_ETH_PER_TX` | Optional sponsor write cap |
| `provider` | — | Override auto-built `JsonRpcProvider` |
| `signer` | — | Required for sponsor write methods |

## Modules

### `sdk.trials` (subgraph)

| Method | Signature |
|--------|-----------|
| `listActive` | `(options?: { first?: number; skip?: number }) => Promise<unknown>` |
| `getBySponsor` | `(sponsor: string) => Promise<unknown>` |

### `sdk.sponsor`

**Reads** (subgraph + RPC; pool amounts are sponsor-authorized on-chain):

| Method | Signature |
|--------|-----------|
| `getVerification` | `(sponsor: string) => Promise<SponsorVerificationResult>` |
| `getStats` | `(sponsor: string) => Promise<unknown>` |
| `getMatches` | `(sponsor: string) => Promise<unknown>` |
| `getAuditLogs` | `(sponsor: string, options?: { first?: number }) => Promise<{ trialIds; subgraph; chain }>` |
| `getTrialPoolStatus` | `(trialId: string, trialEndTimeSec?: string \| number \| null) => Promise<TrialPoolReclaimStatus>` |

**Writes** (require `signer`; same rules as [MCP sponsor tools](../../mcp-server/README.md)):

| Method | Signature |
|--------|-----------|
| `createTrial` | `(params: CreateTrialParams) => Promise<CreateTrialResult>` |
| `setMilestones` | `(trialId, durationSeconds, milestones[]) => Promise<{ trialId; deadlines }>` |
| `fundPool` | `(trialId, amountEth) => Promise<{ trialId; totalFunded }>` |
| `updateApplicationStatus` | `(trialId, patientAddress, newStatus, decisionMessage?) => Promise<{ trialId; patientAddress; newStatus }>` |
| `deactivate` | `(trialId) => Promise<{ trialId }>` |
| `distributeMilestone` | `(trialId, milestoneIndex) => Promise<{ trialId; milestoneIndex }>` |
| `reclaimPool` | `(trialId) => Promise<{ trialId }>` |

### `sdk.patient`

| Method | Signature |
|--------|-----------|
| `enrollInRewardPool` | `(trialId, nullifier, options?: { identitySecret?: bigint \| string }) => Promise<{ trialId; nullifier }>` — MED-3 patient pool enrollment; pass Semaphore `identity.secretScalar` when EOA ≠ permit holder |

### `sdk.protocol`

| Method | Signature |
|--------|-----------|
| `getAddresses` | `() => Record<string, string>` — from `packages/medvault-core/data/addresses.json` |
| `listContracts` | `() => ProtocolContractEntry[]` |
| `checkWiring` | `() => Promise<WiringCheckResult>` |

### `sdk.relayer` (HTTP to hosted relayer)

| Method | HTTP route | Returns |
|--------|------------|---------|
| `health` | `GET /health` | `RelayerHealthResponse` |
| `stageApply` | `POST /relay/apply-stage` | tx hash `string` |
| `finalizeApply` | `POST /relay/apply-finalize` | tx hash `string` |
| `relayClaim` | `POST /relay/claim` | tx hash `string` |

`finalizeApply` requires `eligible: true` and a valid threshold-decrypt signature from the client.  
`NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE` is thrown when the relayer returns `code: "NOT_ELIGIBLE"`.

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

The MCP server exposes the same write surface as tools — see [mcp-server/README.md](../../mcp-server/README.md) for tool names and env setup.

## Silent-failure guard

FHE confidential transfers can succeed on-chain while the recipient's plaintext balance does not change. The guard detects this by decrypting the recipient balance before and after the transfer (via Zama `grantPermit` + `decryptValues`), not by comparing raw ciphertext handles.

```typescript
import {
  captureRecipientBalanceBefore,
  guardConfidentialTransfer,
  SilentFailureDetected,
} from "@medvault/sdk";

const balanceBefore = await captureRecipientBalanceBefore(
  zamaSdk,
  confidentialEthAddress,
  recipient,
  provider
);

// ... send confidential transfer tx, await receipt ...

try {
  const delta = await guardConfidentialTransfer({
    tokenAddress: confidentialEthAddress,
    recipient,
    intendedAmount: 5n,
    provider,
    sdk: zamaSdk,
    balanceBefore,
    receipt,
  });
  console.log("Transferred", delta.toString());
} catch (err) {
  if (err instanceof SilentFailureDetected) {
    console.error("Silent transfer failure", err.plaintextDelta, err.intendedAmount);
  }
  throw err;
}
```

## Examples

Build first (`npm run sdk:build`). Examples import from `../dist/index.js` and use current Sepolia addresses via `@medvault/core`.

```bash
# List trials (needs MEDVAULT_SUBGRAPH_URL)
MEDVAULT_SUBGRAPH_URL=https://... node packages/medvault-sdk/examples/list-trials.mjs

# Relayer health (needs MEDVAULT_RELAYER_URL or built-in default)
node packages/medvault-sdk/examples/relayer-health.mjs

# Create trial (needs PRIVATE_KEY + subgraph; optional MEDVAULT_SPONSOR_OPEN_ACCESS=true)
PRIVATE_KEY=0x... MEDVAULT_SUBGRAPH_URL=https://... node packages/medvault-sdk/examples/sponsor-create-trial.mjs
```

Run unit tests: `npm run sdk:test` (11 tests across facade, pool privacy, silent-failure guard).

## Security

- Never commit `PRIVATE_KEY` or relayer keys.
- SDK does **not** decrypt patient health data or run Semaphore identity generation.
- Relayer `finalizeApply` requires `eligible: true` and a valid threshold decrypt signature from the client.

## Related

- [`@medvault/core`](../medvault-core/README.md) — low-level protocol helpers (used by this SDK)
- [`mcp-server`](../../mcp-server/README.md) — MCP tools wrapping SDK sponsor writes
- [`relayer`](../../relayer/README.md) — hosted gasless anonymous apply service

After contract deploys, sync packaged assets:

```bash
npm run sync-sdk-assets
```
