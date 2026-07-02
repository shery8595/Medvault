# Subgraph sync (Graph Studio)

## Canonical identity

| Field | Value |
|-------|-------|
| Studio slug | `medvault` |
| Current version | `v0.2.0` |
| Query URL | `https://api.studio.thegraph.com/query/1755644/medvault/v0.2.0` |
| Network | `sepolia` (chain ID `11155111`) |

Set in `.env.example`, `docker-compose.yml`, and frontend `VITE_SUBGRAPH_URL`. Local Graph Node (Compose `graph` profile) deploys to `http://localhost:8000/subgraphs/name/medvault/medvault`.

```env
GRAPH_SUBGRAPH_SLUG=medvault
GRAPH_SUBGRAPH_NETWORK=sepolia
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1755644/medvault/v0.2.0
```

Match the Studio Playground **Query URL** exactly (subgraph ID + slug + version).

## Is the subgraph “too heavy”?

**Usually no.** `MedVaultAutomation` (Chainlink) is **not** indexed. Vault milestone/automation changes only add light event handlers.

The main cost drivers are:

| Source | Cost | Used by app UI? |
|--------|------|------------------|
| `DataAccessLog` | **High** — one entity per `logAction` (eligibility, vault, registry) | **No** — audit page uses RPC (`useAuditLogs`) |
| `StakingManager` | Low | **No** — staking uses RPC (`useStaking`) |
| `TrialManager` | Medium — `getTrial()` eth_call per `TrialCreated` | Yes |
| `TrialMilestoneManager` | Medium — `getMilestones()` eth_call per `MilestonesSet` | Yes (milestone weights in sponsor UI) |

If Studio shows **99%** but **blocks behind keeps growing** while `_meta.block.number` **does not move**, the indexer is **stuck or not assigned** — not “too heavy to catch up.”

## Deploy commands

```bash
# Full redeploy (sync ABIs, codegen, build, Studio deploy)
npm run subgraph:deploy

# Custom version label
node scripts/redeploy-subgraph.js 0.1.24

# Near chain head (smaller sync window — only events after start blocks)
npm run subgraph:deploy:near-head -- 0.1.24

# Refresh start blocks from Sepolia deploy receipts, then update yaml
npm run subgraph:fetch-start-blocks
```

Requires `GRAPH_STUDIO_DEPLOY_KEY` or `GRAPH_DEPLOY_KEY` in `.env`. Optional: `GRAPH_STUDIO_DEPLOY_NODE` (default `https://api.studio.thegraph.com/deploy/`).

### Fast deploy (near chain head)

```bash
npm run subgraph:deploy:near-head -- 0.1.24
```

This sets all start blocks to `latest - 500` and deploys. **Only events after that block appear** in the subgraph.

## Subgraph manifest (verified baseline)

Source of truth: `subgraph/subgraph.yaml` + `subgraph/schema.graphql`.

| Metric | Count |
|--------|------:|
| Data sources | **14** |
| Event handlers | **38** |
| Entity types | **26** |
| Mapping files | **15** |
| ABIs in `subgraph/abis/` | **16** |

### Data sources and start blocks

Refresh with `npm run subgraph:fetch-start-blocks` after a Sepolia redeploy. Baseline (verify against current deployment):

| Data source | Start block |
|-------------|------------:|
| AnonymousPatientRegistry | 11141076 |
| TrialManager | 11141076 |
| ConsentManager | 11141076 |
| EligibilityEngine | 11141076 |
| SponsorIncentiveVault | **11141550** |
| TrialMilestoneManager | 11141076 |
| DataAccessLog | 11141076 |
| SponsorRegistry | 11141076 |
| MedVaultRegistry | 11141076 |
| StakingManager | 11141076 |
| ConfidentialETH | **11146545** |
| MedVaultAutomation | 11146548 |
| EncryptedConsentGate | 11141076 |
| EncryptedScoreLeaderboard | 11141076 |

### Orphan mapping (engineering note)

`subgraph/src/mappings/patient-registry.ts` and `subgraph/abis/PatientRegistry.json` exist but **no data source** references them in `subgraph.yaml`. The live registry is indexed via `AnonymousPatientRegistry` / `MedVaultRegistry`. Remediation is a code task (Plan 10), not a docs change.

### RPC-only events (not in subgraph)

The hybrid indexer (`indexer/`) supplements the subgraph for:

- `EligibilityEngine.SilentApply`
- `PatientDocumentStore.DocumentRecorded`

See [indexer/README.md](../indexer/README.md).

## Ops scripts

| Script | Purpose |
|--------|---------|
| `scripts/redeploy-subgraph.js` | Sync ABIs, codegen, build, `graph deploy --studio` |
| `scripts/update-subgraph-yaml.js` | Patch `subgraph.yaml` addresses from `addresses.json` |
| `scripts/fetch-sepolia-start-blocks.mjs` | Resolve creation blocks via Etherscan; write `subgraph/start-blocks.json` |
| `scripts/set-subgraph-start-near-head.mjs` | Set all start blocks to `latest - 500` |
| `scripts/verify-subgraph-schema.mjs` | Smoke-test deployed schema fields via GraphQL |
| `scripts/find-registration-block.mjs` | Locate patient registration block for start-block tuning |

## Post-deploy checklist

1. `npm run sync-abis` — align `subgraph/abis/` with Hardhat artifacts
2. `npm run subgraph:fetch-start-blocks` — refresh start blocks after contract redeploy
3. `node scripts/update-subgraph-yaml.js sepolia` — patch addresses in manifest
4. `npm run subgraph:deploy` or `graph deploy --studio medvault --version-label v0.2.0`
5. Update `VITE_SUBGRAPH_URL` in Vercel / `.env.local` to match Playground URL
6. `node scripts/verify-subgraph-schema.mjs` — confirm schema fields on live deployment
