# Private withdrawals (ConfidentialETH v0.9)

MedVault encrypts withdrawal **amounts** at request time. Pending state stores `euint64`, not plaintext `uint64`. Only the **sufficiency boolean** is publicly decryptable when staging a request.

## Paths

| Path | Amount privacy | Settlement |
|------|----------------|------------|
| Encrypted staging + wallet complete | Hidden until KMS reveal | ETH to patient wallet (amount public at `completeWithdraw`) |
| Reward claim → `requestWithdrawTo` | Encrypted units from vault | ETH to chosen destination after reveal |
| Private unstake | Stays in encrypted ledger | cETH balance increases (no Aave) |
| Public unstake | Public Aave path | aWETH / gateway events reveal amounts |
| Fast / batched public exit | Encrypted until reveal | ETH to stealth recipient via relayer |

## Contract flow

```
encryptUint64 → requestWithdraw(enc, proof)
→ publicDecrypt(sufficient) → revealWithdrawAmount
→ publicDecrypt(amount) → completeWithdraw(amountProof)
```

Optional public exit: EIP-712 `WithdrawAuthorization` → relayer `completePublicExit` → stealth recipient.

## Encryption binding (InvalidSigner if wrong)

| Operation | Contract address | Proof account |
|-----------|------------------|---------------|
| `requestWithdraw` | ConfidentialETH | Patient EOA |
| `requestWithdrawTo` (claims) | ConfidentialETH | SponsorIncentiveVault |
| `stakeFromConfidential` / `requestPrivateUnstake` | StakingManager | Patient EOA |

## Exit modes

- **Wallet** — patient completes from wallet (`useConfidentialBalance` mode `wallet`).
- **Fast** — `EXIT_MODE_FAST = 0`, relayer submits immediately (`POST /relay/public-exit`).
- **Private batch** — `EXIT_MODE_PRIVATE_BATCH = 1`, queued in `relayer/batch-exit-queue.mjs`.

## Honest limits

- Native ETH `call{value}` requires plaintext wei at settlement.
- Relayer hides `tx.from`; stealth addresses reduce recipient linkage; batching reduces timing linkage.
- Batching does **not** hide final transfer amounts.

## Code map

| Area | Location |
|------|----------|
| Contracts | `contracts/ConfidentialETH.sol`, `contracts/StakingManager.sol`, `contracts/SponsorIncentiveVault.sol` |
| Client | `src/lib/fhe.ts`, `src/lib/withdrawFlow.ts`, `src/lib/claimFlow.ts` |
| Hooks | `src/hooks/useConfidentialBalance.ts`, `src/hooks/useStaking.ts` |
| Relayer | `relayer/watcher.mjs`, `relayer/batch-exit-queue.mjs`, `relayer/server.js` |
| Tests | `test/unit/v09-proof-of-computation.test.ts`, `test/unit/public-exit.test.ts`, `test/unit/batch-exit-queue.test.ts`, `test-support/withdraw.ts` |

In-app docs: `/docs/private-withdrawals`.
