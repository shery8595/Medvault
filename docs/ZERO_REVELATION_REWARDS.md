# Zero-revelation screening rewards

See also: [Smart Contracts](https://med-vault.xyz/docs/contracts) catalog (`SponsorIncentiveVault`) · [ATOMIC_FLOWS.md](./ATOMIC_FLOWS.md) · [PRIVATE_WITHDRAWALS.md](./PRIVATE_WITHDRAWALS.md).

## Scope

Screening rewards (**milestone 0**) and post-screening milestones (**milestone > 0**) use homomorphic gating on encrypted eligibility ciphertext:

```solidity
ebool eligible = eligibilityEngine.getAnonymousResultForVault(nullifier, trialId);
euint64 gated = FHE.select(eligible, rewardUnits, 0);
// Distribution stages entitlement; cETH moves only on patient confirmReceipt
```

Milestone 0 uses `eligibleAndAccepted` conjunction in `_creditScreeningRewardEncrypted`; milestone > 0 uses `_creditMilestoneRewardEncrypted` with the same `FHE.select` gate. Tests: P2-01..04, P5-SELECT-01 (screening), P5-SELECT-02 (milestone > 0), P01-01..05 (pull-claim + prune).

## Pull-claim distribution (P0-1)

Sponsor/automation **staging** no longer pushes cETH or sets `participantMilestonePaid` at distribute time.

| Phase | Who | On-chain effect |
|-------|-----|-----------------|
| **Stage** | Sponsor / automation (`distributePartial*`) | `entitlementStaged = true`, `challengeOpen`, `stagedShareWei` recorded; encrypted entitlement ebool stored |
| **Confirm** | Patient permit holder (`prepareEntitlementProof` → KMS proof → `confirmReceipt`) | cETH credited; `confirmedPayout = true`; `participantMilestonePaid = true`; `confirmedDistributedWei` incremented |
| **Claim** | Patient (`claimParticipantRewards` → `requestWithdrawTo` → `completeWithdrawTo`) | Confidential units exit to chosen destination (existing withdraw-to pipeline) |
| **Prune** | Sponsor / owner after `CHALLENGE_WINDOW` (7 days) | `pruneUnconfirmedSlots` removes unconfirmed slots (milestone 0: full slot removal; milestone > 0: clears staged state) |

### Patient client flow

```
1. Sponsor stages entitlements (distributePartialPaginated)
2. Patient: prepareEntitlementProof(trialId, milestoneIndex)   // ephemeral permit holder
3. Patient: publicDecrypt(staged entitlement ebool) → cleartexts + decryptionProof
4. Patient: confirmReceipt(trialId, milestoneIndex, cleartexts, proof)
5. Patient: claimParticipantRewards → relayer completeWithdrawTo → ETH at destination
```

Frontend: `src/lib/confirmReceiptFlow.ts`, `src/lib/claimFlow.ts`, `ClaimModal` / `ClaimWizard`.  
Tests: `test-support/claimReceipt.ts`, `test/unit/sponsor-incentive-vault-claim-prune.test.ts`.

**Gas note:** `prepareEntitlementProof` and `confirmReceipt` require `msg.sender` to be the registered permit holder (typically the Semaphore-derived ephemeral address). That address needs native ETH for gas unless a future gasless meta-tx path is added.

## Honest limitations

1. **Recipients learn their own reward** by decrypting their cETH balance (or staged share preview). Zero-revelation targets third-party observers, not the recipient.

2. **Ciphertext-gated milestones** — both screening and post-screening payouts gate on `anonymousResults` ciphertext via `FHE.select`; audit-only flags (`noirVerifiedResults`, `anonymousVaultScreeningEligible`) do not gate value movement.

3. **`reclaimPool`** uses plaintext accounting on **`confirmedDistributedWei`** (not inflated staging totals). Residual ETH stays in the vault until sponsor reclaim. Unconfirmed entitlements block reclaim until pruned or confirmed.

4. **Distribution path** — screening pools with **> 20** participants require sequential `distributePartialPaginated(trialId, milestone, startIndex, batchSize)` batches (`DISTRIBUTE_BATCH_SIZE = 20`). Plain `distributePartial` reverts when `pCount > 20`. Global `lastProcessedIndex` advances only in `_finalizePaginatedBatch`.

5. **Challenge window** — forged or ineligible attestations can be pruned after 7 days; patients who never confirm lose the slot (milestone 0) or staged state (milestone > 0).

## Funding model

`fundTrial` keeps ETH in the vault for accounting. At **confirmReceipt**, the vault `deposit`s per credit into its confidential balance, then `confidentialTransfer`s the FHE-selected amount to the participant. Staging alone does not move cETH.

Owner recovery: `recoverStrandedCeth(recipient)` sweeps vault cETH balance when accounting and on-chain balance diverge (operational safety valve).
