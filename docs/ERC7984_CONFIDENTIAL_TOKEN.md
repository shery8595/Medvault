# ERC-7984 confidential token (ConfidentialETH7984)

MedVault implements the OpenZeppelin **IERC7984** confidential fungible token standard for native ETH balances, while preserving MedVault-specific withdraw, exit, lock, and KMS-gated transfer extensions in the same contract.

## Contract layout

| Artifact | Role |
|----------|------|
| `contracts/ConfidentialETH7984.sol` | Primary implementation (extends OZ `ERC7984`) |
| `contracts/ConfidentialETH.sol` | Backward-compatible alias: `contract ConfidentialETH is ConfidentialETH7984 {}` |

Deploy script uses the `ConfidentialETH7984` factory; `addresses.json` keeps the key **`ConfidentialETH`** for ABI/address compatibility.

## Dependencies

```json
"@openzeppelin/confidential-contracts": "^0.5.1",
"@openzeppelin/contracts": "^5.6.1",
"@fhevm/solidity": "^0.11.1"
```

Import paths (no `contracts/` prefix in npm package):

- `@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol`
- `@openzeppelin/confidential-contracts/interfaces/IERC7984.sol`

## IERC7984 surface

| Function / event | MedVault value / behavior |
|------------------|---------------------------|
| `name()` | `"Confidential ETH"` |
| `symbol()` | `"cETH"` |
| `decimals()` | `6` (1 unit = 1 micro-ETH; `UNIT_SCALE = 1e12` wei per unit) |
| `contractURI()` | `""` |
| `confidentialTotalSupply()` | OZ encrypted supply via `_mint` / `_burn` |
| `confidentialBalanceOf(account)` | Same store as legacy `getBalance(account)` |
| `confidentialTransfer(to, amount, proof)` | Standard OZ FHE transfer |
| `confidentialTransferFrom(from, to, amount, proof)` | Operator-delegated transfer |
| `setOperator(operator, until)` / `isOperator` | Delegated transfer until timestamp |
| `supportsInterface(IERC7984)` | Yes — tested in **CET-14** |
| `ConfidentialTransfer` event | On standard transfers |

## MedVault extensions (same contract)

These are **not** part of IERC7984 but remain on `ConfidentialETH7984` for protocol integration:

| Extension | Used by |
|-----------|---------|
| `deposit()` / `depositFor()` / `receive()` | Sponsors, vault funding — `receive()` auto-deposits plain ETH (L1 amount visible) |
| `requestWithdraw` → `completeWithdraw` | Patient private exit (single KMS decrypt of homomorphic `transferable`; EIP-712 v2 `completePublicExit`) |
| `requestWithdrawTo` → `completeWithdrawTo` | `SponsorIncentiveVault` claim bridge (EIP-712 `WithdrawTo`) |
| `completePublicExit` | Relayer batched stealth exit (EIP-712 `WithdrawAuthorization` v2, `transferableHandle`) |
| `lockBalance` / `unlockBalance` | `StakingManager` stake mutex |
| `transferEncrypted(from, to, amount)` | Homomorphic inter-contract transfer via `FHE.select` — no public sufficiency decrypt |
| `previewTransferSufficiency` | Staking / vault pre-checks (emits `transferableHandle`) |
| `scheduleContractAuth` / `applyContractAuth` | 6-hour timelock for `authorizedContracts` |

Instant `authorizeContract` / `deauthorizeContract` hard-revert on live deployments — use schedule/apply ([TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md)).

EIP-712 domain string remains **`"MedVault ConfidentialETH"`** — `WithdrawAuthorization` uses **version `"2"`** with `transferableHandle` (breaking change from v1 `sufficientHandle`); `WithdrawTo` remains v1.

## Integrator notes

### Reading balances

```typescript
// Prefer IERC7984 name; alias still works
const handle = await cETH.confidentialBalanceOf(userAddress);
// or: await cETH.getBalance(userAddress);
```

### Standard confidential transfer

Operators (or self) can use OZ `confidentialTransfer` / `confidentialTransferFrom` with encrypted inputs from `@zama-fhe/sdk`.

Protocol contracts (`StakingManager`, `SponsorIncentiveVault`) continue to use **`transferEncrypted`** and **`requestWithdrawTo`** — no migration required if ABIs are synced.

### ABI sync

After contract changes:

```bash
npm run compile
npm run sync-abis
npm run sync-sdk-assets
```

Frontend imports: `src/lib/contracts/abis/ConfidentialETH7984.json` (synced as `ConfidentialETH.json` for subgraph).

## Tests

| Case ID | Coverage |
|---------|----------|
| CET-01–12 | Deposit, withdraw, lock, auth, KMS transfer (legacy suite) |
| CET-13 | IERC7984 metadata, `decimals() === 6`, `confidentialBalanceOf` |
| CET-14 | IERC165, `setOperator` / `isOperator` |

Run: `npm test -- test/unit/confidential-eth.test.ts`

## Deployment

1. Deploy via `scripts/deploy.ts` (step 10: `ConfidentialETH7984`).
2. Run timelock wiring: authorize vault, staking manager, relayer on cETH ([TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md)).
3. Update relayer `CONFIDENTIAL_ETH_ADDRESS` and redeploy subgraph if events changed.

**Sepolia redeploy required** for on-chain IERC7984 — existing deployments use the legacy custom implementation until upgraded.

## Related documentation

- [FHE_AUDIT_README.md](./FHE_AUDIT_README.md) — judge-facing FHE + ERC-7984 summary
- [PRIVATE_WITHDRAWALS.md](./PRIVATE_WITHDRAWALS.md) — withdraw-to and public exit flows
- [internal-docs/zama-integration.md](../internal-docs/zama-integration.md) — SDK + handle ACL model
- [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md) — conformance verification record
