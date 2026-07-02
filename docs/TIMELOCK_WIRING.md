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

## Chainlink forwarder

`MedVaultAutomation` constructor requires a **non-zero** forwarder placeholder at deploy. After registering upkeep in the Chainlink UI, set the real forwarder (also timelocked):

```bash
CHAINLINK_FORWARDER=0xYourForwarder npm run deploy:chainlink-forwarder:sepolia
```

## Other security-related API changes

- **HIGH-1 (trusted relayer):** `MedVaultRegistry.finalizeAnonymousApplyWith*`, `cancelAnonymousApplyStage`, and `registerPatientViaRelayer` require `msg.sender == trustedRelayer`. Set `TRUSTED_RELAYER_ADDRESS` to match relayer `RELAYER_PRIVATE_KEY`.
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
| **Full Sepolia deploy** | `deploy.ts` → `wire-sepolia.ts` (if needed) → wait 6 hours → `finish-wiring.ts` → `check-wiring-status.ts` → `sync-abis` → `sync-sdk-assets` → `subgraph:fetch-start-blocks` → `subgraph:deploy` → optional `set-chainlink-forwarder.ts` |
| **Post-deploy wiring only** | `wire-sepolia.ts` |
| **Apply timelocks** | `finish-wiring.ts` (`npm run deploy:wiring:sepolia`) |
| **Attestation upgrade** | `upgrade-attestation-sepolia.ts` → `finish-attestation-upgrade-sepolia.ts` (if interrupted) |
| **Screening vault redeploy** | `redeploy-screening-vault.ts` |
| **Partial deploy resume** | `resume-sepolia-deploy.ts` (edit `PARTIAL` checkpoint) |
| **Chainlink forwarder** | Register upkeep in Chainlink UI → `set-chainlink-forwarder.ts` → wait timelock → diagnose with `diagnose-automation-upkeep.ts` |
| **Frontend ship** | `npm run vercel:ship` (Vercel prebuilt) |
| **Relayer** | Deploy `relayer/` to Railway; `relayer/.env` from `addresses.json`; timelock cETH auth for relayer |
| **Subgraph near-head** | `subgraph:deploy:near-head` |
| **Android APK** | `android-apk.mjs`, `setup-android-sdk.mjs` |

## Tests

| ID | File | Coverage |
|----|------|----------|
| TL-01–TL-06 | `test/unit/timelock-wiring.test.ts` | Instant setter reverts, schedule/apply, MH-1, withdraw-to sig, stack wiring |
| — | `test-support/timelock.ts` | `advanceTimelock`, `scheduleAndApply`, `authorizeCethContract` |
| — | `test-support/deployments.ts` | Full timelock wiring in `deployMedVaultStack()` |

Run: `npm test` (**483** passing = 395 unit + 85 integration + 3 crypto; **6** unit pending as of July 2026).
