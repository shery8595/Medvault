# Atomic flows (wallet-visible paths only)

See also: [Smart Contracts](https://med-vault.xyz/docs/contracts) · [HYBRID_STORAGE.md](./HYBRID_STORAGE.md) · [SECURITY.md](../SECURITY.md).

MedVault reduces gas and confirmation latency where FHE ciphertext flows allow single-transaction composition. Atomic optimizations are **scoped to wallet-visible paths** (sponsor funding, staking, consent+apply). The anonymous eligibility path **remains the canonical 2-transaction flow**.

## Anonymous apply: 2-tx canonical (do not collapse)

| Step | Function | Caller | Purpose |
|------|----------|--------|---------|
| 1 | `MedVaultRegistry.stageAnonymousApply` | Permit holder (patient wallet) | Semaphore proof + FHE eligibility staging |
| 2 | Client `decryptForTx` off-chain | — | Obtain Noir attestation inputs from staged `finalCt` |
| 3 | `MedVaultRegistry.finalizeAnonymousApplyWithProof` (or `finalizeAnonymousApplyWithConsent`) | **Trusted relayer only** | Noir proof finalize + mark applied |
| (opt) | `MedVaultRegistry.cancelAnonymousApplyStage` | **Trusted relayer only** | Cancel staged apply (cancel EIP-712 + Semaphore proof) |

**Patient EOA finalize/cancel reverts** (`Only trusted relayer`). Production paths:

- `POST /relay/apply-finalize` — see [relayer/README.md](../relayer/README.md)
- `POST /relay/cancel-stage` — trusted relayer + cancel signature

**`stageAndFinalizeAnonymousApply` is intentionally NOT shipped.** Zama FHE ciphertext handles incorporate transient transaction state and KMS signature inputs, so the staged `ebool` handle hash is **non-deterministic at the client** before `stageAnonymousApply` executes. A single-tx stage+finalize cannot predict the handle hash required for Noir public input binding.

## Wallet-visible atomic paths

### `finalizeAnonymousApplyWithConsent`

Eliminates the separate `ConsentManager.grantConsent` transaction when the consent wallet is already public at finalize time.

- **Before:** `grantConsent` → `stageAnonymousApply` → relayer finalize (3 tx)
- **After:** `stageAnonymousApply` → relayer `finalizeAnonymousApplyWithConsent` (2 tx)

Consent is inlined via `ConsentManager.recordConsentGrant`, called from `EligibilityEngine.finalizeAnonymousEligibilityWithConsent` after `MedVaultRegistry` verifies the external FHE consent input. Relies on Plan 00a `FHE.allow(finalResult, consentGate)` at persist time.

### `fundTrialAndSetMilestones`

Atomic sponsor trial funding + milestone definition.

- **ETH path (production):** `SponsorIncentiveVault.fundTrialAndSetMilestones(trialId, names, weights, deadlines)` with `msg.value` — one transaction.
- **cETH path (disabled, LOW-2):** `cETH.confidentialTransferAndCall(vault, amount, proof, vault.encodeConfidentialFundAndMilestonesData(...))` would atomically fund the encrypted pool and invoke `TrialMilestoneManager.setMilestonesFromVault`. **`onConfidentialTransferReceived` currently reverts `ConfidentialFundingDisabled`** until both `confidentialFundingEnabled` and `confidentialFundingAccountingReady` are true — `creditConfidentialFund` only updates FHE `encryptedPoolSize`, not plaintext `totalDepositedWei` used by distribution/reclaim. See [SECURITY.md](../SECURITY.md#confidential-ceth-trial-funding-low-2).

### `stakeAndLock`

Atomic confidential stake + balance lock via ERC-7984 `confidentialTransferAndCall` or operator pull.

1. User sets `StakingManager` as cETH operator: `cETH.setOperator(stakingManager, until)` (one-time), **or** calls `cETH.confidentialTransferAndCall` directly with lock callback data.
2. User calls `StakingManager.stakeAndLock(encryptedUnits, inputProof)` — uses `confidentialTransferFromAndCall` as operator.
3. `onConfidentialTransferReceived` credits `_privateStakedGwei` and calls `cETH.lockBalance(from)` when callback data contains the stake-and-lock flag.

**Deprecated:** `requestConfidentialStake` and `completeConfidentialStake` hard-revert `"Use stakeAndLock"` (HIGH-2).

## What stays multi-tx

| Flow | Why |
|------|-----|
| Anonymous apply (stage → relayer finalize) | FHE handle non-determinism + trusted relayer gate |
| KMS-gated `requestPrivateUnstake` + `completePrivateUnstake` | Locked-balance two-phase KMS sufficiency proof |
| Public Aave stake / unstake | Plaintext amount visibility by design |
| Large pool milestone payout (`pCount > 20`) | Sequential `distributePartialPaginated` batches |
| Patient reward receipt + claim | **Pull model:** `confirmReceipt` (ephemeral permit holder + KMS proof) before `claimParticipantRewards` → `completeWithdrawTo` |
| Sponsor prune after challenge window | `pruneUnconfirmedSlots` when patients never confirm within 7 days |
