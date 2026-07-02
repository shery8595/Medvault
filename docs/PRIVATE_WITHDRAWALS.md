# Private withdrawals (ConfidentialETH7984 / IERC7984)

MedVault encrypts withdrawal **amounts** at request time on `ConfidentialETH7984` (alias `ConfidentialETH`). Pending state stores homomorphic `transferable = FHE.select(ge(balance, units), units, 0)` — **no sufficiency boolean** is publicly decryptable at request. **Completion** is a single KMS-gated decrypt of `transferable` (`completeWithdraw` / `completeWithdrawTo` / `completePublicExit`). When `transferable` decrypts to `0`, the contract emits `InsufficientWithdrawNoop` and returns without revert.

See [ERC7984_CONFIDENTIAL_TOKEN.md](./ERC7984_CONFIDENTIAL_TOKEN.md) for the full IERC7984 + extension reference.

## Paths

| Path | Amount privacy | Settlement |
|------|----------------|------------|
| Encrypted staging + wallet complete | Hidden until KMS completion | ETH to patient wallet (amount public at `completeWithdraw`) |
| Reward claim → `requestWithdrawTo` | Encrypted units from vault | ETH to chosen destination after single completion — **user EIP-712 required** |
| Private unstake | Stays in encrypted ledger | cETH balance increases (no Aave) |
| Public unstake | Public Aave path | aWETH / gateway events reveal amounts |
| Fast / batched public exit | Encrypted until completion | ETH to stealth recipient via relayer |

## Contract flow (v2 — single completion)

```
encryptUint64 → requestWithdraw(enc, proof)
→ emit transferableHandle (euint64, publicly decryptable)
→ publicDecrypt(transferable) → completeWithdraw(transferableProof)
   → units > 0: burn + transfer ETH
   → units == 0: InsufficientWithdrawNoop (no revert)
```

`transferEncrypted` between authorized contracts uses homomorphic `FHE.select` only — **no public decrypt** on that path.

Claims (vault-initiated) — **pull receipt before claim**:

```
Sponsor stages entitlement (distributePartial*) — no cETH push at distribute
Patient (permit holder):
  prepareEntitlementProof(trialId, milestoneIndex)
  → publicDecrypt(entitlement ebool) → cleartexts + decryptionProof
  → confirmReceipt(trialId, milestoneIndex, cleartexts, proof)  // cETH credited
patient signs WithdrawTo EIP-712
→ claimParticipantRewards(..., enc, proof, nonce, deadline, sig)
→ requestWithdrawTo(user, dest, enc, proof, nonce, deadline, sig)
→ authorized contract completeWithdrawTo (single transferable proof)
```

After `CHALLENGE_WINDOW` (7 days), sponsor may call `pruneUnconfirmedSlots` for participants who never confirmed.

Optional public exit: EIP-712 `WithdrawAuthorization` → relayer `completePublicExit` → stealth recipient.

## Encryption binding (InvalidSigner if wrong)

| Operation | Contract address | Proof account |
|-----------|------------------|---------------|
| `requestWithdraw` | ConfidentialETH | Patient EOA |
| `requestWithdrawTo` (claims) | ConfidentialETH | SponsorIncentiveVault |
| `stakeFromConfidential` / `requestPrivateUnstake` | StakingManager | Patient EOA |

## Withdraw-to authorization

Domain: `MedVault ConfidentialETH` v1. Struct `WithdrawTo(user, destination, encryptedUnitsHandle, nonce, deadline)`.

Gasless claims also bind `encryptedAmountCommitment = keccak256(encryptedHandle ‖ inputProof)` in the vault claim EIP-712 struct.

## Exit modes

| Mode | Value | Client | Relayer behavior |
|------|------:|--------|------------------|
| **Wallet** | — | Patient calls `completeWithdraw` / `completeUnstake` from wallet after staging | Watcher caches KMS proof; client fetches via `POST /relay/completion-proof` |
| **Fast** | `0` (`EXIT_MODE_FAST`) | Patient signs EIP-712 `WithdrawAuthorization`, calls `POST /relay/public-exit` | Relayer executes `completePublicExit` immediately |
| **Private batch** | `1` (`EXIT_MODE_PRIVATE_BATCH`) | Same signed payload | Queued in `relayer/batch-exit-queue.mjs` until `BATCH_EXIT_MIN_SIZE` (default **2**) or `BATCH_EXIT_MAX_WAIT_MS` (default **120s**) |

Frontend hook: `useConfidentialBalance` maps these to `wallet`, `fast`, and `private_batch` respectively.

### EIP-712 binding (public exit)

Domain: `MedVault ConfidentialETH` **v2**. Struct `WithdrawAuthorization(owner, stealthRecipient, transferableHandle, exitMode, nonce, deadline)`.

Relayer `POST /relay/public-exit` requires: `owner`, `stealthRecipient`, `exitMode`, `nonce`, `deadline`, `signature`, `transferableHandle`.

### KMS proof caching (relayer watcher)

The relayer watcher (`relayer/watcher.mjs`) polls every `WATCHER_POLL_MS` (default **15s**) with confirmation depth `WATCHER_CONFIRMATION_DEPTH` (default **3**):

| Event | Watcher action |
|-------|----------------|
| `WithdrawRequested` | Cache transferable `uint64` proof for user `completeWithdraw` |
| `WithdrawToRequested` | Auto `completeWithdrawTo` when transferable > 0 (claim payouts) |
| `PublicUnstakeRequested` / `PrivateUnstakeRequested` | Cache proof for user `completeUnstake` / `completePrivateUnstake` |

`POST /relay/completion-proof` returns cached `{ transferable, units, cleartexts, decryptionProof }` after EIP-191 `callerSignature` over `keccak256(kind, user, handle, stageTxHash)`.

Failed handlers retry with exponential backoff (`WATCHER_RETRY_BASE_MS`, max `WATCHER_MAX_RETRIES`).

## Rollout

Breaking change: redeploy `ConfidentialETH7984` + `StakingManager` on Sepolia, rewire via 2-day timelock (`docs/TIMELOCK_WIRING.md`), deploy subgraph **v0.2.0**, and cut over frontend + relayer together (EIP-712 v2). Update `VITE_SUBGRAPH_URL` after subgraph deploy.

## Failed ETH settlement (escrow recovery)

When `completeWithdraw` or `completeWithdrawTo` cannot deliver ETH (recipient rejects transfer), the contract credits **`pendingFailedWithdrawWei[recipient]`** and emits **`FailedWithdrawEscrowed`**. The failed recipient calls **`claimFailedWithdraw()`** to pull escrowed wei.

When **`completePublicExit`** cannot deliver ETH to the signed `stealthRecipient`, escrow credits **`pendingFailedWithdrawWei[owner]`** (the cETH balance owner, not the stealth address) and emits **`FailedWithdrawEscrowed(owner, …)`**. The owner calls **`claimFailedWithdraw()`**. On this failure path, **`withdrawNonces[owner]` is not incremented**, so a fresh authorization can be signed if needed. Burn still completes.

Tests: `test/unit/remediation-vuln-fixes.test.ts` (LOW-1, `completeWithdraw`); `test/unit/public-exit.test.ts` (PEX-06, `completePublicExit`).

## Honest limits

- At **completion**, decrypted `transferable` reveals whether the request was sufficient (`units == 0` vs `units > 0`). This is not a new leak versus the prior two-step flow, which also revealed the amount at completion.
- Insufficient requests settle to `0` with `InsufficientWithdrawNoop` — no on-chain sufficiency boolean is emitted or decrypted at request time.
- Native ETH settlement still requires a public wei transfer; see [ZERO_REVELATION_REWARDS.md](./ZERO_REVELATION_REWARDS.md).
