# MedVault Relayer (`medvault-relayer`)

Gasless relay service for Ethereum Sepolia + Zama fhEVM v0.9. Submits sponsor-paid transactions for anonymous eligibility staging, patient registration, vault claims, IPFS pinning, and confidential exit completion.

**Stack:** Node 20+ (ESM), Express, ethers v6, `@zama-fhe/sdk` (via `zama-client.mjs`).

**Default port:** `8787` in Docker Compose; `PORT` env defaults to `3000` when run directly.

## Quick start

```bash
cd relayer
cp ../.env.example .env   # set RELAYER_PRIVATE_KEY, contract addresses, RPC
npm install
node server.js
```

Docker (from repo root):

```bash
docker compose --profile relayer up relayer
# http://127.0.0.1:8787/health
```

## HTTP API (12 routes)

All `POST /relay/*` routes use a rate limiter: **10 requests per minute** per IP.

**Authorized relayers (P3.1):** `finalizeAnonymousApplyWithConsent`, `cancelAnonymousApplyStage`, and `registerPatientViaRelayer` require `msg.sender` in `MedVaultRegistry.authorizedRelayers` (timelock-governed allowlist). **`finalizeAnonymousApplyWithProof` is open (P3.2)** — patient EOAs may submit directly; payout integrity is ciphertext-gated via `FHE.select` (Phase 2).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness + pinned contract addresses + relayer wallet + `server.js` sha256 |
| `GET` | `/transparency` | Pinned addresses, deploy hash, logging policy, P0.2 decrypt config |
| `POST` | `/relay/pin-document` | Pin base64 or JSON to IPFS (Pinata) |
| `POST` | `/relay/apply-stage` | Stage FHE anonymous eligibility (Semaphore verified) |
| `POST` | `/relay/apply-finalize` | **Only production finalize path** — Noir proof (client decrypts locally) |
| `POST` | `/relay/cancel-stage` | Cancel staged apply (cancel EIP-712 + Semaphore proof) |
| `POST` | `/relay/register` | Register patient via relayer (`profileSaltCommitment` required) |
| `POST` | `/relay/claim` | Claim participant rewards via vault |
| `POST` | `/relay/register-anon` | Register anonymous participant in vault |
| `POST` | `/relay/completion-proof` | Lookup KMS proof for withdraw/unstake completion |
| `POST` | `/relay/public-exit` | Submit signed public exit (fast or batched) |
| `POST` | `/relay/apply` | **Deprecated** — returns `410 Gone` |

> The file header in `server.js` documents only three routes; the table above is the full verified surface.

### `GET /health`

**Response:**

```json
{
  "status": "ok",
  "registry": "0x...",
  "semaphore": "0x...",
  "eligibilityEngine": "0x...",
  "relayerWallet": "0x...",
  "chainId": 11155111,
  "serverJsSha256": "abc123..."
}
```

### `GET /transparency`

Published operator transparency bundle (addresses, deploy hash, logging policy).

**Response fields:** `pinnedContracts`, `serverJsSha256`, `loggingPolicy`, `eligibilityDecrypt` (P0.2 interim config).

### `POST /relay/pin-document`

Optional auth: when `RELAYER_PIN_SECRET` is set, require `Authorization: Bearer <secret>`.

**Request body (JSON):**

| Field | Type | Notes |
|-------|------|-------|
| `dataBase64` | string | Base64 file bytes (mutually exclusive with `json`) |
| `json` | object | Serialized as UTF-8 JSON |
| `name` | string | Pinata filename (default `medvault-document`) |

**Response:** `{ "success": true, "cid": "Qm...", "IpfsHash": "Qm..." }`

### `POST /relay/apply-stage`

Validates Semaphore proof + consent message binding, then calls `registry.stageAnonymousApply`.

**Request body:** `trialId`, `proof` (Semaphore struct), `commitment`, `permitRecipient`, `deadline`, `permitSignature`.

**Response:** `{ "success": true, "txHash": "0x..." }`

**Errors:** `400` for invalid proof, already applied, or static-call revert; `500` on relay failure.

### `POST /relay/apply-finalize`

**Optional gasless finalize path** when `permitRecipient` is the relayer wallet (P0.2 decrypt verification). Patients may also call `finalizeAnonymousApplyWithProof` directly on-chain (P3.2 open finalize).

Requires client-side Noir proof. **P0.2:** relayer user-decrypts staged `finalCt` as `permitRecipient` and **ignores** client-supplied `eligible` when authorizing relayed finalize. Rejects decrypt=false with `code: "NOT_ELIGIBLE"`. `permitRecipient` must be the relayer wallet for this route.

**Request body:** stage fields plus `noirProof`, `publicInputs`, `eligible` (client hint for proof generation — not authoritative), `consentWallet`, `consentWalletSignature`.

**Response:** `{ "success": true, "txHash": "0x...", "eligible": <relayer-verified boolean> }`

### `POST /relay/cancel-stage`

Calls `cancelAnonymousApplyStage` as trusted relayer.

**Request body:** `trialId`, `proof`, `commitment`, `permitRecipient`, `deadline`, `permitSignature`, `cancelSignature` (EIP-712 cancel permit).

**Response:** `{ "success": true, "txHash": "0x..." }`

### `POST /relay/register`

Calls `registerPatientViaRelayer` (trusted relayer only).

**Request body:** `patientWallet`, `identityCommitment`, `viewPermitRecipient`, `profileCommitment`, **`profileSaltCommitment`** (`keccak256(high-entropy salt)` — client must retain `profileSalt` for Noir proofs), `encryptedFields` (age, gender, weight, height, hasDiabetes, hbLevel, isSmoker, hasHypertension), `inputProof`, `nonce`, `signature`.

**Response:** `{ "success": true, "txHash": "0x..." }`

### `POST /relay/claim`

Calls `SponsorIncentiveVault.claimParticipantRewardsFor` (address from body or `SPONSOR_INCENTIVE_VAULT_ADDRESS`).

**Request body:** `trialId`, `nullifier`, `permitHolder`, `destination`, `units`, `encryptedAmountCommitment`, `encryptedUnitsHandle`, `inputProof`, `nonce`, `deadline`, `signature`, `withdrawToNonce`, `withdrawToDeadline`, `withdrawToSignature`; optional `vaultAddress`.

### `POST /relay/register-anon`

Calls `registerAnonymousParticipantFor` on the vault.

**Request body:** `trialId`, `nullifier`, `permitHolder`, `nonce`, `deadline`, `signature`; optional `vaultAddress`.

### `POST /relay/completion-proof`

Returns cached KMS decryption proof for user-submitted `completeWithdraw` / `completeUnstake`.

**Request body:** `kind` (`withdraw` | `unstake` | `withdrawTo`), `user`, `handle`, optional `stageTxHash`, `callerSignature` (EIP-191 over packed digest).

**Response:** `{ "success": true, "eligible": bool, "cleartexts": "...", "decryptionProof": "..." }`

**Errors:** `503` if watcher disabled; `400` for auth/handle resolution failures.

### `POST /relay/public-exit`

Submits `ConfidentialETH.completePublicExit` via watcher (immediate or batched).

**Request body:** `owner`, `stealthRecipient`, `exitMode` (`0` = fast, `1` = private batch), `nonce`, `deadline`, `signature`, `transferableHandle`.

**Response:** `{ "success": true, "queued": bool, "queueSize"?: number, "txHash"?: "0x..." }`

### `POST /relay/apply` (deprecated)

```json
{
  "error": "Deprecated: use POST /relay/apply-stage then POST /relay/apply-finalize (Noir proof gate)."
}
```

HTTP status: **410**.

## Background jobs

### Watcher (`watcher.mjs`)

Polls chain logs when `WATCHER_ENABLED` is not `false` (default: enabled).

| Setting | Default | Purpose |
|---------|---------|---------|
| `WATCHER_POLL_MS` | `15000` | Poll interval |
| `WATCHER_CONFIRMATION_DEPTH` | `3` | Blocks behind head before processing |
| `WATCHER_MAX_RETRIES` | `5` | Per-handler retry cap |
| `WATCHER_RETRY_BASE_MS` | `5000` | Exponential backoff base |

**Events handled:**

| Event | Contract | Action |
|-------|----------|--------|
| `WithdrawToRequested` | ConfidentialETH | Auto `completeWithdrawTo` when transferable &gt; 0 (claim payouts) |
| `WithdrawRequested` | ConfidentialETH | Cache KMS proof (user calls `completeWithdraw`) |
| `PublicUnstakeRequested` | StakingManager | Cache unstake proof |
| `PrivateUnstakeRequested` | StakingManager | Cache unstake proof |

On reorg, the watcher clears caches and re-scans from a lookback window (`2000` blocks).

### Batch exit queue (`batch-exit-queue.mjs`)

When `exitMode === 1` (`EXIT_MODE_PRIVATE_BATCH`), exits enqueue until:

| Env | Default | Behavior |
|-----|---------|----------|
| `BATCH_EXIT_MIN_SIZE` | `2` | Flush when queue reaches this size |
| `BATCH_EXIT_MAX_WAIT_MS` | `120000` | Flush after max wait even if below min size |

Failed items are re-enqueued with a new flush timer.

## IPFS pinning (`ipfs.cjs`)

Uses Pinata `pinFileToIPFS`. Credentials resolve in order:

1. `PINATA_API_KEY` + `PINATA_API_SECRET`
2. Fallback: `VITE_PINATA_API_KEY` + `VITE_PINATA_API_SECRET` (shared with frontend `.env`)

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `RELAYER_PRIVATE_KEY` | **Yes** | Hot wallet paying gas; must match `MedVaultRegistry.trustedRelayer` |
| `REGISTRY_ADDRESS` | **Yes** | `AnonymousPatientRegistry` / MedVault registry |
| `SEMAPHORE_ADDRESS` | **Yes** | Must match `registry.semaphore()` |
| `RPC_URL` | No | Sepolia RPC (fallback chain below) |
| `SEPOLIA_RPC_URL` | No | Alias for RPC |
| `ETHEREUM_SEPOLIA_RPC_URL` | No | Alias for RPC |
| `ZAMA_RELAYER_URL` | No | Zama relayer override |
| `FRONTEND_URL` | Prod | CORS origins (comma-separated); required in `NODE_ENV=production` |
| `PORT` | No | Listen port (default `3000`; Docker sets `8787`) |
| `CONFIDENTIAL_ETH_ADDRESS` | Watcher | Enables withdraw/exit automation |
| `STAKING_MANAGER_ADDRESS` | Watcher | Enables unstake proof caching |
| `ELIGIBILITY_ENGINE_ADDRESS` | No | Parse `AnonymousEligibilityStaged` logs on stage |
| `SPONSOR_INCENTIVE_VAULT_ADDRESS` | Claim routes | Default vault for claim/register-anon |
| `WATCHER_ENABLED` | No | `false` disables watcher |
| `WATCHER_POLL_MS` | No | Poll interval (ms) |
| `WATCHER_CONFIRMATION_DEPTH` | No | Confirmation depth |
| `WATCHER_MAX_RETRIES` | No | Handler retry limit |
| `WATCHER_RETRY_BASE_MS` | No | Retry backoff base |
| `BATCH_EXIT_MIN_SIZE` | No | Batch queue min size |
| `BATCH_EXIT_MAX_WAIT_MS` | No | Batch queue max wait |
| `RELAYER_PIN_SECRET` | No | Bearer token for `/relay/pin-document` |
| `PINATA_API_KEY` | Pin routes | Pinata API key |
| `PINATA_API_SECRET` | Pin routes | Pinata secret |
| `VITE_PINATA_API_KEY` | Pin routes | Frontend env fallback |
| `VITE_PINATA_API_SECRET` | Pin routes | Frontend env fallback |

## Startup checks

On boot the relayer verifies:

- Valid `REGISTRY_ADDRESS` and `SEMAPHORE_ADDRESS`
- Chain id `11155111` (Sepolia)
- `registry.semaphore()` matches `SEMAPHORE_ADDRESS`
- `registry.eligibilityEngine()` is non-zero
- Zama SDK client initializes

Failure exits with code `1`.

## Related docs

- [docs/PRIVATE_WITHDRAWALS.md](../docs/PRIVATE_WITHDRAWALS.md) — exit modes, EIP-712, KMS proof flow
- [docs/DOCKER.md](../docs/DOCKER.md) — Compose profile
- [packages/medvault-sdk/README.md](../packages/medvault-sdk/README.md) — `sdk.relayer.*` client
- [SECURITY.md](../SECURITY.md) — Noir–FHE integrity gap and P0.2 interim mitigation

## Transparency & logging policy

| Item | Where |
|------|-------|
| Pinned contract addresses | `GET /health`, `GET /transparency`, env vars below |
| Deployed `server.js` integrity | `serverJsSha256` in `/health` and `/transparency` (sha256 of on-disk `server.js` at process start) |
| Relayer wallet | `relayerWallet` in `/transparency` — must be in `MedVaultRegistry.authorizedRelayers` |

### What we log

- Route kind (`STAGE`, `FINALIZE`, `CANCEL`), public `trialId`, transaction hashes, redacted revert reasons

### What we do **not** log

- Patient vitals or health fields
- Full ciphertext handles (truncated via `relayer/redaction.mjs`)
- IPFS payloads, Noir witness plaintext
- Email / phone / SSN patterns (redacted if present in error strings)

### P0.2 eligibility decrypt (interim)

- Relayer is `permitRecipient` from `stageAnonymousApply`
- User-decrypt via `@zama-fhe/sdk` (`permits.grantPermit` + `decryption.decryptValues`)
- Result cached per `(nullifier, trialId)` for `STAGING_TTL` (7 days); invalidated on cancel
- **Structural fix (P2) shipped:** `FHE.select` payout gating — see [SECURITY.md](../SECURITY.md) and [docs/formal-verification/certora-halmos-results.md](../docs/formal-verification/certora-halmos-results.md)

### P3.1 multi-relayer allowlist

- `authorizedRelayers` mapping on `MedVaultRegistry` — add/remove via `scheduleRelayerAuth` + `applyRelayerAuth` (2-day timelock)
- Patients choose among authorized relayers for gasless registration/cancel; every relayer must implement P0.2 decrypt verification on relayed finalize
- Check authorization: `authorizedRelayers(relayerAddress)` on-chain

### P3.2 open finalize

- `finalizeAnonymousApplyWithProof` has no relayer gate — patient EOAs submit directly (`src/lib/relayer.ts` → `finalizeAnonymousApplyDirect`)
- Forged `eligible` witness cannot authorize payout; vault reads ciphertext via `FHE.select` (P2 completeness: registration, screening, milestone > 0, consent-gated flows)

### P3.3 threshold decrypt committee (deferred)

- **Not implemented** — 2-of-3 relayer co-sign finalize after independent decrypt is deferred until an institutional pilot requires it
