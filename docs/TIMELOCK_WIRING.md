# Timelock wiring (schedule / apply)

MedVault admin wiring no longer uses instant setters on live networks. Sensitive cross-contract references use a **6-hour timelock** (`READER_CHANGE_DELAY = 6 hours`): owner calls `schedule*`, waits, then `apply*`.

On **Hardhat**, deploy scripts and `test-support/timelock.ts` fast-forward time automatically. On **Sepolia**, schedule during deploy and apply after ~6 hours.

In-app docs: `/docs/timelock-wiring`.

## Contracts affected

| Contract | Instant setter (reverts) | Timelocked replacement |
|----------|-------------------------|------------------------|
| `TrialManager` | `setAutomationContract`, `setEligibilityEngine`, `setSponsorRegistry` | `scheduleAutomationContract` / `applyAutomationContract`, etc. |
| `EligibilityEngine` | `setScoreLeaderboard`, `setConsentGate`, … | `scheduleAuthorizedReader(role, addr)` / `applyAuthorizedReader(role)` |
| `SponsorIncentiveVault` | `setAutomationContract`, `setMilestoneManager`, `setSponsorRegistry` | `schedule*` / `apply*` pairs |
| `TrialMilestoneManager` | `setVault`, `setTrialManager` | `scheduleVault` / `applyVault`, etc. |
| `MedVaultAutomation` | `setVault`, `setChainlinkForwarder` | `scheduleVault` / `applyVault`, `scheduleChainlinkForwarder` / `applyChainlinkForwarder` |
| `ConfidentialETH` | `authorizeContract` | `scheduleContractAuth(contract, bool)` / `applyContractAuth(contract)` |
| `ConsentManager` | `setConsentGate` | `scheduleConsentGate` / `applyConsentGate` |
| `DataAccessLog` | `authorizeLogger` | `scheduleAuthorizeLogger` / `applyAuthorizeLogger` |
| `SponsorRegistry` | (none instant) | `scheduleAuditor` / `applyAuditor` (6-hour delay) |

`EligibilityEngine` reader roles (bytes32): see `ENGINE_READER_ROLES` in `scripts/lib/timelockWiring.ts` (includes `patientDocumentStore`, `consentGate`, `scoreLeaderboard`, `dataAccessLog`, etc.).

**Not a wiring timelock:** `AnonymousPatientRegistry.scheduleTestHelpersEnabled` is a testnet-only toggle with its own schedule/apply pair — not used for production cross-contract references.

## Deploy flow (Sepolia)

```bash
# 1. Deploy all contracts (may schedule wiring; FHEVM plugin must init on live network)
npm run deploy:sepolia

# 2. If wiring failed mid-flight or deploy skipped wiring, run wire script
npm run deploy:wire:sepolia

# 3. After READER_CHANGE_DELAY (~6 hours), apply pending changes
npm run deploy:wiring:sepolia

# 4. Verify on-chain references
npm run deploy:check-wiring:sepolia
```

Scripts:

| Script | Purpose |
|--------|---------|
| `scripts/deploy.ts` | Full deploy + `wireAllContracts()` via `timelockWiring.ts` |
| `scripts/wire-sepolia.ts` | Wire already-deployed addresses; updates `addresses.json` / subgraph blocks |
| `scripts/finish-wiring.ts` | Apply all pending timelocks (`npm run deploy:wiring:sepolia`) |
| `scripts/lib/timelockWiring.ts` | Shared schedule/apply helpers + `ensureFhevmInitialized()` for Sepolia |

**FHEVM on live networks:** call `ensureFhevmInitialized()` before txs so `@fhevm/hardhat-plugin` can format gas estimation errors.

## Trial automation (CRE or owner cron)

`MedVaultAutomation` finalizes expired trials via `checkUpkeep` / `performUpkeep`. MedVault supports:

| Path | Docs |
|------|------|
| **Chainlink CRE** | Below + `cre/README.md`, in-app `/docs/automation` |
| **Owner cron** | [AUTOMATION_CRON.md](./AUTOMATION_CRON.md) — Railway Cron `*/5 * * * *`, owner `performUpkeep` |

### Chainlink CRE

Legacy **Chainlink Automation (CLA) upkeeps are sunset** (2026). CRE uses an `AutomationReceiver` bridge:

1. `npm run deploy:cre-receiver:sepolia` — deploy receiver (Sepolia `KeystoneForwarder` in constructor).
2. `npm run wire:cre-receiver:sepolia` — `setCallAllowed(performUpkeep)`, workflow identity, schedule forwarder on `MedVaultAutomation`.
3. After `READER_CHANGE_DELAY` (~6 hours): `npm run deploy:wiring:sepolia` — applies `chainlinkForwarder` → `AutomationReceiver`.
4. `cre login` → `npm run cre:simulate` → `npm run cre:deploy`.

`MedVaultAutomation.chainlinkForwarder` must point at **`AutomationReceiver`** (the address that calls `performUpkeep`), not the Keystone forwarder directly.

Legacy CLA-only path (deprecated): `CHAINLINK_FORWARDER=0xYourClaForwarder npm run deploy:chainlink-forwarder:sepolia`

Full CRE guide: `cre/README.md`, in-app `/docs/automation`. Owner cron: `docs/AUTOMATION_CRON.md`.

## Other security-related API changes

- **HIGH-1 (authorized relayers):** `MedVaultRegistry.finalizeAnonymousApplyWith*`, `cancelAnonymousApplyStage`, and `registerPatientViaRelayer` require `msg.sender` in `authorizedRelayers`. Wire with `RELAYER_ADDRESSES=0xRelayerA,0xRelayerB` (or legacy `TRUSTED_RELAYER_ADDRESS` for a single relayer). Each relayer wallet must match its Railway `RELAYER_PRIVATE_KEY` and receive `ensureCethContractAuth` via `wireAllContracts`.
- **MED-1 (profile salt):** production `registerPatient` requires `profileSaltCommitment`; deterministic salts rejected.
- **MED-3 (pool enrollment):** `registerAnonymousParticipant` is permit-holder-only; use `registerAnonymousParticipantFor` or relayer `POST /relay/register-anon`.
- **LOW-1 (failed withdraw):** `pendingFailedWithdrawWei` + `claimFailedWithdraw()` on failed ETH send. `completePublicExit` failures escrow to `owner_` (not `stealthRecipient`); `withdrawNonces[owner]` preserved on that path.
- **LOW-3 / INFO:** `distributePartialPaginated` for pools > 20; `MAX_PRUNE_PER_UPKEEP = 10` on automation.
- **MH-1:** `AnonymousPatientRegistry.registerPatient` requires `authorizedEngine != address(0)` before registration.
- **Withdraw-to auth:** `ConfidentialETH.requestWithdrawTo` requires patient EIP-712 `WithdrawTo` signature (`nonce`, `deadline`, `signature`).
- **Claims:** `confirmReceipt` (patient permit holder + KMS proof) credits cETH after sponsor staging; then `claimParticipantRewards` / `claimParticipantRewardsFor` pass through withdraw-to signature args; claim EIP-712 includes `encryptedAmountCommitment`.
- **Prune:** `pruneUnconfirmedSlots` after `CHALLENGE_WINDOW` (7 days) for unconfirmed entitlements.
- **Fund movement:** `completeWithdrawTo` and similar paths use `onlyAuthorizedContract`; owner cannot complete vault payouts directly.
- **Reclaim (two-step pull):** `reclaimUndistributed` / `reclaimAbandonedToOwner` schedule; `claimReclaimed` delivers ETH. Failed transfers re-route to owner.
- **Abandoned pool (vault P2 / HIGH-1):** When `SponsorRegistry.isVerifiedSponsor(trial.sponsor)` is false, distribution and sponsor reclaim are blocked. After `endTime + RECLAIM_GRACE_PERIOD`, vault `onlyOwner` may call `reclaimAbandonedToOwner` without screening/milestone distribution gates, then `claimReclaimed`. Verified-sponsor `reclaimUndistributed` still requires full distribution readiness.

## Production runbooks

| Runbook | Scripts / commands |
|---------|-------------------|
| **Full Sepolia deploy** | `deploy.ts` → `wire-sepolia.ts` (if needed) → wait 6 hours → `finish-wiring.ts` → `check-wiring-status.ts` → `sync-abis` → `sync-sdk-assets` → `subgraph:fetch-start-blocks` → `subgraph:deploy` → `deploy:cre-receiver:sepolia` → `wire:cre-receiver:sepolia` → wait timelock → `finish-wiring.ts` → `cre:deploy` |
| **Post-deploy wiring only** | `wire-sepolia.ts` |
| **Apply timelocks** | `finish-wiring.ts` (`npm run deploy:wiring:sepolia`) |
| **Attestation upgrade** | `upgrade-attestation-sepolia.ts` → `finish-attestation-upgrade-sepolia.ts` (if interrupted) |
| **Screening vault redeploy** | `redeploy-screening-vault.ts` |
| **Partial deploy resume** | `resume-sepolia-deploy.ts` (edit `PARTIAL` checkpoint) |
| **Chainlink CRE** | `deploy:cre-receiver:sepolia` → `wire:cre-receiver:sepolia` → wait timelock → `finish-wiring.ts` → `verify:cre-receiver:sepolia` → `cre:simulate` / `cre:deploy` |
| **Owner cron** | Standalone `medvault-automation-cron` package → Railway Cron `*/5 * * * *` — see `docs/AUTOMATION_CRON.md` |
| **Frontend ship** | `npm run vercel:ship` (Vercel prebuilt) |
| **Relayer** | Deploy `relayer/` to Railway (one service per relayer key); `relayer/.env` from `addresses.json`; `RELAYER_ADDRESSES` in wiring env; timelock cETH auth per relayer |
| **Subgraph near-head** | `subgraph:deploy:near-head` |
| **Android APK** | `android-apk.mjs`, `setup-android-sdk.mjs` |

## Dual relayer deployment (P3.1)

Run **two independent** `relayer/server.js` instances with different hot wallets:

| Target | Service | Port / URL | Env file |
|--------|---------|------------|----------|
| Local Docker | `relayer` (a) | `8787` | `relayer/.env` |
| Local Docker | `relayer-b` | `8788` | `relayer/.env.relayer-b` (copy from `.env.relayer-b.example`) |
| Railway | `medvault-relayer-a` | public URL A | `RELAYER_PRIVATE_KEY` = key A |
| Railway | `medvault-relayer-b` | public URL B | `RELAYER_PRIVATE_KEY` = key B |

Shared per instance: `REGISTRY_ADDRESS`, `SEMAPHORE_ADDRESS`, `RPC_URL`, `ZAMA_RELAYER_URL`, `FRONTEND_URL`.

On-chain wiring (after deploy):

```bash
RELAYER_ADDRESSES=0xRelayerA,0xRelayerB npm run deploy:wire:sepolia
# wait READER_CHANGE_DELAY (~6 hours) if schedule-only
npm run deploy:wiring:sepolia
```

Frontend: `VITE_RELAYER_URLS=https://relayer-a...,https://relayer-b...` (comma-separated). See [RELAYER_TRUST_BOUNDARIES.md](./RELAYER_TRUST_BOUNDARIES.md).

**Note:** Only one instance should run the chain watcher (`WATCHER_ENABLED=true`) to avoid duplicate `completeWithdrawTo` submissions; set `WATCHER_ENABLED=false` on relayer-b.

## Tests

| ID | File | Coverage |
|----|------|----------|
| TL-01–TL-06 | `test/unit/timelock-wiring.test.ts` | Instant setter reverts, schedule/apply, MH-1, withdraw-to sig, stack wiring |
| — | `test-support/timelock.ts` | `advanceTimelock`, `scheduleAndApply`, `authorizeCethContract` |
| — | `test-support/deployments.ts` | Full timelock wiring in `deployMedVaultStack()` |

Run: `npm test` (**491** passing = 403 unit + 85 integration + 3 crypto; **6** unit pending as of July 2026).
