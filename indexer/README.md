# MedVault Indexer (`@medvault/indexer`)

Hybrid **subgraph + RPC** indexer with MongoDB persistence, Redis response cache, and desync alerting. Exposes a small read-only HTTP API for trials, sponsor stats, and applications.

**Stack:** TypeScript, Express, MongoDB, Redis, ethers v6, `@medvault/core`.

**Port:** `3300` (default via `INDEXER_PORT`).

**Authentication:** When `INDEXER_API_SECRET` is set, data routes require `Authorization: Bearer <secret>`. `GET /health` stays public by default (`INDEXER_HEALTH_PUBLIC` ≠ `false`) so Docker/orchestration probes work without credentials. **Set `INDEXER_API_SECRET` in production.**

## Quick start

```bash
# Requires MongoDB + Redis
npm run indexer:start
# GET http://127.0.0.1:3300/health
```

Docker Compose (from repo root): see `docker-compose.yml` indexer service.

## HTTP API (5 routes)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ "ok": true, "service": "medvault-indexer" }` — public when `INDEXER_HEALTH_PUBLIC` (default) |
| `GET` | `/alerts` | In-memory `IndexerDesync` alerts (max 100) — **auth required when secret set** |
| `GET` | `/trials` | Trial list (`?active=true` optional) — **auth required when secret set** |
| `GET` | `/sponsor/:addr/stats` | Sponsor dashboard aggregates — **auth required when secret set** |
| `GET` | `/trial/:id/applications` | Applications for one trial — **auth required when secret set** |

### `GET /trials`

Query: `active=true` filters `active: true` in Mongo.

Cached key: `trials:active` or `trials:all`. Limit **500**, sorted by `createdAt` desc.

### `GET /sponsor/:addr/stats`

Returns trials, nested applications/consents, and aggregate counts.

**Documented limitations:**

- `eligibilityResults` is always **`[]`** (not populated from Mongo).
- `propensitySignals` is always **`[]`** (not populated).
- Sponsor `name` fields are empty strings (subgraph name not denormalized).

### `GET /trial/:id/applications`

Returns applications sorted by `submittedAt` desc.

### `GET /alerts`

```json
{
  "alerts": [
    {
      "type": "IndexerDesync",
      "at": 1710000000000,
      "entity": "trials",
      "mongoCount": 10,
      "subgraphCount": 12,
      "details": "Trial count mismatch: mongo=10 subgraph=12"
    }
  ]
}
```

## Background jobs

### Sync (`sync.ts`) — every `INDEXER_SYNC_INTERVAL_MS` (default **15s**)

Two parallel paths:

1. **Subgraph** — paginated GraphQL (`first: 100`, up to 10k rows) for trials, applications, consents, rewards.
2. **RPC** — `getLogs` in **2000-block** windows from `lastSyncedBlock`.

#### RPC-indexed events (6 event types → 5 collections)

| Event | Contract | Mongo collection | Subgraph? |
|-------|----------|------------------|-----------|
| `TrialCreated` | TrialManager | `trials` | Also in subgraph |
| `EligibilityProofVerified` | EligibilityEngine | `applications` | Also in subgraph |
| `SilentApply` | EligibilityEngine | `applications` | **RPC-only** |
| `ConsentChanged` | ConsentManager | `consents` | Partial (see below) |
| `RewardsDistributed` | SponsorIncentiveVault | `rewards` | Also via audit logs |
| `MilestoneRewardsDistributed` | SponsorIncentiveVault | `rewards` | Also via audit logs |
| `DocumentRecorded` | PatientDocumentStore | `documents` | **RPC-only** |
| `DocumentLegacyHandleRevoked` | PatientDocumentStore | triggers unpin worker | **RPC-only** |

#### IPFS unpin attestation (P7)

When `INDEXER_PRIVATE_KEY` is set and the wallet is `setUnpinIndexer` on `PatientDocumentStore`, the sync loop:

1. Scans `DocumentLegacyHandleRevoked` (includes `oldCid` string).
2. Calls Pinata `DELETE /pinning/unpin/{cid}` (requires `PINATA_API_KEY` / `PINATA_API_SECRET`).
3. Posts `postIndexerHeartbeat` then `attestLegacyCidUnpinned` on-chain.

Owner must call `setUnpinIndexer(indexer, true)` after deploy. Heartbeats expire after `INDEXER_HEARTBEAT_MAX_AGE` (7 days).

#### Undocumented / surprising behaviors

**`SilentApply` and `DocumentRecorded` are RPC-only** — they are not emitted into the hosted subgraph schema. The indexer is the primary source for these rows.

**`ConsentChanged` RPC handler writes placeholder records:**

- `trialId: "0"`
- `patient: 0x0000000000000000000000000000000000000000`
- `granted: true`

Use subgraph-synced consents for real trial/patient linkage; RPC rows signal that a consent epoch changed on-chain.

### Reconcile (`reconcile.ts`) — every `INDEXER_RECONCILE_INTERVAL_MS` (default **60s**)

Compares Mongo trial count and IDs against subgraph `trials(first: 1000)`. Emits `IndexerDesync` alerts on mismatch (surfaced at `GET /alerts`).

## MongoDB collections

| Collection | Upsert key | Idempotency index |
|------------|------------|-------------------|
| `trials` | `trialId` | `{ trialId: 1 }` unique |
| `applications` | `eventKey` | `{ eventKey: 1 }` unique |
| `consents` | `eventKey` | `{ eventKey: 1 }` unique |
| `rewards` | `eventKey` | `{ eventKey: 1 }` unique |
| `documents` | `eventKey` | `{ trialId: 1, nullifier: 1 }`, `{ eventKey: 1 }` unique |

`eventKey` = `txHash:logIndex` (see `types.eventKey`).

Each document includes `source: "subgraph" | "rpc"` and `updatedAt`.

## Redis cache

Tag-based invalidation on sync:

| Tag pattern | Invalidated when |
|-------------|------------------|
| `trials` | Trial writes |
| `trial:{id}` | Trial-specific rewards |
| `sponsor:{addr}` | Sponsor-related writes |
| `applications:{trialId}` | Application/document writes |

Default TTL: `INDEXER_CACHE_TTL_SEC` (default **60s**).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `INDEXER_PORT` | `3300` | HTTP port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/medvault` | Mongo connection |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection |
| `MEDVAULT_SUBGRAPH_URL` | core / `VITE_SUBGRAPH_URL` | Subgraph endpoint |
| `SEPOLIA_RPC_URL` | via `@medvault/core` | RPC for `getLogs` |
| `MEDVAULT_NETWORK` | `sepolia` | `sepolia` or `hardhat` |
| `INDEXER_SYNC_INTERVAL_MS` | `15000` | Sync loop interval |
| `INDEXER_RECONCILE_INTERVAL_MS` | `60000` | Reconcile interval |
| `INDEXER_CACHE_TTL_SEC` | `60` | Redis entry TTL |
| `INDEXER_API_SECRET` | — | Bearer token for `/alerts`, `/trials`, `/sponsor/*`, `/trial/*` (recommended in production) |
| `INDEXER_HEALTH_PUBLIC` | `true` | When `true`, `GET /health` skips auth even if secret is set |
| `INDEXER_PRIVATE_KEY` | — | Wallet for `postIndexerHeartbeat` + `attestLegacyCidUnpinned` (must be `setUnpinIndexer`) |
| `PINATA_API_KEY` / `PINATA_API_SECRET` | — | Required for automatic legacy CID unpin after rotation |

Contract addresses resolve from `@medvault/core` `getContractAddresses(networkKey)`.

## Related

- [docs/SUBGRAPH_SYNC.md](../docs/SUBGRAPH_SYNC.md) — subgraph deployment
- [packages/medvault-core/README.md](../packages/medvault-core/README.md) — shared config and addresses
