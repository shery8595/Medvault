# Data Flow Diagrams (DFD)

Canonical counts: [`src/lib/docsStats.ts`](../src/lib/docsStats.ts) (`httpRoutes: 21`, `backgroundJobs: 5`).

## DFD-1 Patient registration

```mermaid
flowchart LR
    Browser["Patient browser"] -->|"encrypt vitals"| FHE_SDK["@zama-fhe/sdk"]
    FHE_SDK -->|"ciphertext + inputProof"| Registry["MedVaultRegistry"]
    Registry --> APR["AnonymousPatientRegistry"]
    Registry --> Semaphore["Semaphore group (MedVaultRegistry admin)"]
    Registry --> DAL["DataAccessLog"]
    Relayer["relayer POST /relay/register-anon"] -.->|"optional gas-sponsored"| Registry
```

## DFD-2 Anonymous apply (stage → finalize)

Two on-chain transactions; eligibility FHE is staged in tx 1 and finalized with a Noir/Honk proof in tx 2. No on-chain KMS decrypt of the eligibility bit.

```mermaid
sequenceDiagram
    participant P as Patient wallet
    participant SDK as @zama-fhe/sdk
    participant R as relayer
    participant MVR as MedVaultRegistry
    participant EE as EligibilityEngine
    participant HV as HonkVerifier / HonkVerifierEncrypted

    P->>SDK: encrypt profile + build Semaphore proof
    alt gas-sponsored path
        P->>R: POST /relay/apply-stage
        R->>MVR: stageAnonymousApply(...)
    else direct wallet
        P->>MVR: stageAnonymousApply(...)
    end
    MVR->>EE: stageAnonymousEligibility(...)
    EE-->>MVR: FHE stage handle

    P->>SDK: local FHE decrypt + Noir proof
    alt gas-sponsored path
        P->>R: POST /relay/apply-finalize
        R->>MVR: finalizeAnonymousApplyWithProof(...)
    else direct wallet
        P->>MVR: finalizeAnonymousApplyWithProof(...)
    end
    MVR->>EE: finalizeAnonymousEligibilityWithProof(...)
    EE->>HV: verify Honk proof
    EE-->>MVR: SilentApply / status update
```

**Relayer routes:** `POST /relay/apply-stage`, `POST /relay/apply-finalize` (legacy `POST /relay/apply` returns deprecation notice).

## DFD-3 Sponsor fund → claim → private withdraw

```mermaid
flowchart LR
    Sponsor -->|"native ETH"| Vault["SponsorIncentiveVault"]
    Vault -->|"depositFor"| CETH["ConfidentialETH7984"]
    Patient -->|"EIP-712 ClaimAuthorization"| Vault
  Vault -->|"requestWithdrawTo"| CETH
    Relayer -->|"reveal + completeWithdrawTo"| CETH
    CETH -->|"native ETH"| Destination["Stealth destination"]
```

**Relayer routes:** `POST /relay/claim`, `POST /relay/completion-proof`, `POST /relay/public-exit`.

## DFD-4 Relayer watcher + batch exit queue

Two cooperating background jobs in `relayer/`:

```mermaid
flowchart TD
    Subgraph["Graph Studio / subgraph"] --> Watcher["relayer/watcher.mjs"]
    RPC["Sepolia RPC logs"] --> Watcher
    Watcher -->|"revealWithdrawToAmountFor"| CETH["ConfidentialETH7984"]
    Watcher -->|"completeWithdrawTo"| CETH
    Watcher -->|"completePublicExit"| CETH
    Watcher -->|"completeUnstake / completePrivateUnstake"| SM["StakingManager"]
    Watcher --> BatchQ["batch-exit-queue.mjs"]
    BatchQ -->|"batched completePublicExit"| CETH
```

| Job | File | Trigger |
|-----|------|---------|
| Withdraw watcher | `relayer/watcher.mjs` | Poll interval (`pollMs`, default 15s) |
| Batch exit queue | `relayer/batch-exit-queue.mjs` | `minBatchSize` or `maxWaitMs` flush |

See [docs/PRIVATE_WITHDRAWALS.md](../docs/PRIVATE_WITHDRAWALS.md) for withdraw state machines.

## DFD-5 Indexer sync and reconcile

```mermaid
flowchart TD
    Subgraph["The Graph subgraph"] --> Sync["indexer/src/sync.ts"]
    RPC["Sepolia RPC events"] --> Sync
    Sync --> Mongo["MongoDB"]
    Sync --> Cache["Redis/in-memory cache"]
    API["indexer HTTP API"] --> Cache
    API --> Mongo
    Reconcile["indexer/src/reconcile.ts"] --> Subgraph
    Reconcile --> Mongo
    Reconcile -->|"desync alert"| Alerts["GET /alerts"]
```

| Job | File | Trigger |
|-----|------|---------|
| Indexer sync | `indexer/src/sync.ts` | Startup + periodic sync loop |
| Indexer reconcile | `indexer/src/reconcile.ts` | `reconcileIntervalMs` timer |

**Indexer HTTP routes (5):** `GET /health`, `/alerts`, `/trials`, `/sponsor/:addr/stats`, `/trial/:id/applications`.

## DFD-6 Chainlink CRE trial finalization

```mermaid
flowchart LR
    CRE["CRE cron workflow"] --> MVA["MedVaultAutomation.checkUpkeep"]
    CRE --> AR["AutomationReceiver.onReport"]
    AR -->|"performUpkeep"| MVA
    MVA --> Vault["SponsorIncentiveVault"]
    MVA --> TM["TrialManager"]
    TM -->|"trial lifecycle hooks"| MVA
```

Background job: CRE workflow + on-chain `MedVaultAutomation.sol` (no separate MedVault Node cron).

## DFD-7 MCP tool flows

```mermaid
flowchart TD
    Client["ChatGPT / OpenClaw / IDE MCP client"] --> HTTP["mcp-server GET/POST /mcp"]
    HTTP --> Tools["33 MCP tools (23 read + 10 write)"]
    Tools --> Relayer["relayer /health + relay routes"]
    Tools --> Subgraph["medvault_subgraph_query"]
    Tools --> AI["ai-service /ai/*"]
    Tools --> RPC["medvault_read_contract_view"]
    Tools --> Signer["MCP_PRIVATE_KEY writes"]
    Signer --> Chain["Sepolia contracts"]
```

**MCP HTTP routes (2):** `GET /health`, streamable `POST/GET /mcp`.

Representative read tools: `medvault_get_active_trials`, `medvault_get_sponsor_matches`, `medvault_get_audit_logs`, `medvault_check_wiring`.

Representative write tools: `medvault_create_trial`, `medvault_fund_trial_pool`, `medvault_update_application_status`, `medvault_reclaim_trial_pool`, `medvault_reclaim_abandoned_pool`.

## HTTP route inventory (21 total)

| # | Method | Path | Service |
|---|--------|------|---------|
| 1 | GET | `/health` | relayer |
| 2 | POST | `/relay/pin-document` | relayer |
| 3 | POST | `/relay/apply-stage` | relayer |
| 4 | POST | `/relay/apply-finalize` | relayer |
| 5 | POST | `/relay/cancel-stage` | relayer |
| 6 | POST | `/relay/register` | relayer |
| 7 | POST | `/relay/claim` | relayer |
| 8 | POST | `/relay/register-anon` | relayer |
| 9 | POST | `/relay/completion-proof` | relayer |
| 10 | POST | `/relay/public-exit` | relayer |
| 11 | GET | `/transparency` | relayer |
| 12 | POST | `/relay/apply` | relayer (deprecated) |
| 11 | GET | `/health` | ai-service |
| 12 | POST | `/ai/extract-criteria` | ai-service |
| 13 | POST | `/ai/audit-logs` | ai-service |
| 14 | POST | `/ai/validate-criteria` | ai-service |
| 15 | GET | `/health` | indexer |
| 16 | GET | `/alerts` | indexer |
| 17 | GET | `/trials` | indexer |
| 18 | GET | `/sponsor/:addr/stats` | indexer |
| 19 | GET | `/trial/:id/applications` | indexer |
| 20 | GET | `/health` | mcp-server |
| 21 | * | `/mcp` | mcp-server |

## Background job inventory (5 total)

| # | Job | Location |
|---|-----|----------|
| 1 | Withdraw watcher | `relayer/watcher.mjs` |
| 2 | Batch exit queue | `relayer/batch-exit-queue.mjs` |
| 3 | Indexer sync | `indexer/src/sync.ts` |
| 4 | Indexer reconcile | `indexer/src/reconcile.ts` |
| 5 | Chainlink CRE | `contracts/MedVaultAutomation.sol`, `contracts/cre/AutomationReceiver.sol`, `cre/my-workflow` |
