# Subgraph sync (Graph Studio)

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

## Fast deploy (near chain head)

```bash
npm run subgraph:deploy:near-head -- 0.1.2
```

This sets all start blocks to `latest - 500` and deploys. **Only events after that block appear** in the subgraph.

## Env

```env
GRAPH_SUBGRAPH_SLUG=medvault-final
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<id>/medvault-final/<version>
```

Match the Playground query URL exactly.

### Version notes (medvault-final)

| Version | Status | Use |
|---------|--------|-----|
| **v0.1.4** | Start **272205848** (Med ID block **272207848**) | **Default** — registration + recent events |
| v0.1.2 | Synced near head, start **after** Med ID | Fallback if v0.1.4 stalls |
| v0.1.3 | Stuck at **272207848** | Deprecated |
| v0.1.1 | Attestation fields on `AnonymousSubmission` (`attestationResultHash`, `attestationFheStageHash`, `attestationCriteriaSchemaHash`) | Sepolia attestation upgrade deploy |
| v0.1.0 / older | Pre-attestation schema | Superseded |

Patient “registered” in the UI uses **on-chain** `isRegistered()` when the subgraph has no `Patient` row (v0.1.2 starts after some registrations).

If Studio never advances a version for 30+ minutes, that deployment is stuck on Graph’s side — switch version, publish **v0.1.2**, or contact [Graph Discord](https://thegraph.com/discord).
