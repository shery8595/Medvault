# MedVault FHE Audit Map (Zama Builder Track)

One-page map of every **Zama FHE** primitive in MedVault and where it lives. For judges verifying the submission without reading the full repo.

**Live demo:** https://med-vault.xyz · **Network:** Ethereum Sepolia · **Tests:** 483 passing (`npm test`; see `src/lib/docsStats.ts`)

## What is encrypted vs public

| Data | Encrypted (FHE) | Public on-chain |
|------|-----------------|-----------------|
| Patient vitals (age, Hb, BMI flags) | Yes — `euint8` / `euint16` / `ebool` in `AnonymousPatientRegistry` | Never plaintext |
| Sponsor trial criteria (min age, max weight, …) | Yes — **`createTrialWithEncryptedCriteria`** (the only production path; SDK `createTrialEncrypted`, MCP on non-Hardhat chains) | Legacy **`createTrial`** stores plaintext bounds but is **Hardhat-only** (`chainid 31337` gate; reverts on Sepolia/mainnet); trial name/phase/location always public |
| Eligibility result | Yes — `ebool` per nullifier×trial in `EligibilityEngine` | Never plaintext |
| Propensity score | Yes — `euint8` in `EligibilityEngine` | Never plaintext |
| Aggregate match stats | Yes — `euint64` sum + `euint32` count in `EncryptedScoreLeaderboard` | Never per-patient |
| Incentive balances | Yes — `euint64` in `ConfidentialETH7984` (IERC7984) | Native ETH `msg.value` visible at tx layer |
| Trial metadata (name, sponsor address) | No | Public by design |

## FHE primitive → file map

| Primitive | Contract / module | Usage |
|-----------|-------------------|--------|
| `FHE.ge` / `FHE.le` | `EligibilityEngine.sol` ~420–447 | Encrypted patient vs encrypted/plain criteria |
| `FHE.eq` | `EligibilityEngine.sol` ~426–447 | Diabetes, gender, smoker, BP flags |
| `FHE.and` / `FHE.or` | `EligibilityEngine.sol` ~420–474 | Combine encrypted booleans |
| `FHE.select` | `EligibilityEngine.sol` ~451–458 | Encrypted scoring rubric |
| `FHE.add` / `FHE.mul` | `EligibilityEngine.sol` ~451–465; `EncryptedScoreLeaderboard.sol` | Score + aggregate sums |
| `FHE.gt` | `EncryptedScoreLeaderboard.sol` ~174 | Blind pairwise ranking |
| `FHE.allow` / `FHE.allowThis` | All FHE contracts | ACL for patient/sponsor decrypt |
| `fromExternal` / `inputProof` | `AnonymousPatientRegistry.sol`, `TrialManager.sol` | Browser → chain ciphertext ingress |
| `@zama-fhe/sdk` encrypt | `src/lib/fhe.ts` | Patient profile + sponsor criteria batch encrypt |
| `@zama-fhe/sdk` decrypt | `src/lib/fhe.ts` | `decryptValues` + `grantPermit` for local decrypt |
| `@fhevm/hardhat-plugin` mocks | `test-support/fhe.ts` | Default suite (`docsStats.testSuiteDefaultPassing`) |

## End-to-end FHE flow (judge checklist)

1. **Encrypt profile** — Browser `buildPatientProfileInputs()` → `MedVaultRegistry.registerPatient(..., profileSaltCommitment, ...)` (or relayer `POST /relay/register` with server-generated salt). Production rejects zero/deterministic salts; use `randomProfileSalt()` + `profileSaltCommitment()` (see `test-support/profileCommitment.ts`).
2. **Encrypt criteria** — Sponsor `buildSponsorCriteriaInputs()` → `TrialManager.createTrialWithEncryptedCriteria` (recommended). Legacy `createTrial` accepts plaintext bounds for tests/SDK.
3. **Homomorphic match** — `EligibilityEngine.stageAnonymousEligibility` → `_computeEligibility` on ciphertext.
4. **Local decrypt** — Patient `decryptForView(finalCt)` with ACL permit.
5. **FHE-bound seal** — Noir attestation: private `staged_fhe_handle` must equal public `fhe_stage_handle_hash`; on-chain `_verifyEligibilityProofCore` checks hash vs staged `finalCt`.
6. **Aggregate analytics** — `EncryptedScoreLeaderboard.addToAggregate` homomorphic sum without revealing individual scores.

## Residual privacy limits (honest)

- Registration via wallet (not relayer) links `tx.from` ↔ Semaphore commitment in one tx.
- Native ETH amounts visible at transaction layer for `fundTrial` / `deposit`.
- Noir attestation binds identity + plaintext witness to staged handle hash; full proof that FHE ciphertext plaintext equals witness requires Zama input-proof in circuit (future). Contract-level `FHE.checkSignatures` binding was **deferred** — Zama SDK exposes KMS `decryptionProof` only via public decrypt, which would re-leak the eligibility bit; frontend + relayer remain trusted for encrypted-criteria eligibility attestation. **P2 shipped:** `FHE.select` payout gating prevents forged witnesses from authorizing incentive payouts. **Phase 5:** differential evidence in [formal-verification/certora-halmos-results.md](formal-verification/certora-halmos-results.md).
- Forward-only document revocation: sponsors who already decrypted may retain AES keys off-chain; epoch gating blocks new reads; **`rotateDocument`** emits `DocumentLegacyHandleRevoked` with `oldCid` for indexer unpin + on-chain `attestLegacyCidUnpinned` (P7).
- Withdraw/stake sufficiency is homomorphic (`FHE.select`); no pre-settlement boolean leak — final wei amount still public at settlement.

## Test coverage

| Suite | Command | Focus |
|-------|---------|-------|
| Unit + integration | `npm test` | FHE eligibility, encrypted criteria, attestation binding, aggregates, batch, relayer registration |
| Crypto | `npm run test:crypto` | Noir nullifier alignment |
| Honk (slow) | `npm run test:honk` | Full browser-compatible proof pipeline |

See [TEST_MATRIX.md](TEST_MATRIX.md) for case IDs.

## ERC-7984 conformance (OpenZeppelin confidential token standard)

MedVault's native-ETH wrapper implements **IERC7984** via OpenZeppelin `@openzeppelin/confidential-contracts` `ERC7984` (`ConfidentialETH7984.sol`). This aligns with the Zama fhEVM canonical confidential fungible token interface (same pattern as Circux/Covalent).

| IERC7984 surface | MedVault implementation |
|------------------|-------------------------|
| `name()` / `symbol()` / `decimals()` / `contractURI()` | `"Confidential ETH"`, `"cETH"`, `6`, `""` |
| `confidentialTotalSupply()` | OZ `ERC7984` encrypted supply tracking via `_mint` / `_burn` |
| `confidentialBalanceOf(account)` | Same balance store as legacy `getBalance(account)` |
| `confidentialTransfer` / `confidentialTransferFrom` | Standard OZ overflow-safe FHE transfers + operator model |
| `setOperator` / `isOperator` | Delegated transfer until timestamp |
| `supportsInterface(IERC7984)` | Yes — verified in `CET-14` |
| Event `ConfidentialTransfer` | Emitted on standard transfers |

**MedVault extensions (same contract, not a separate adapter):** native-ETH `deposit()` / `depositFor()`, single-step `requestWithdraw` → `completeWithdraw` (homomorphic `FHE.select`, EIP-712 v2 public exit), EIP-712 `requestWithdrawTo` / `completeWithdrawTo`, stealth `completePublicExit`, `lockBalance` / `unlockBalance`, timelocked `authorizedContracts`, and homomorphic `transferEncrypted` (no public sufficiency decrypt) for `StakingManager`.

**Vault confidential funding (LOW-2, disabled):** `SponsorIncentiveVault.onConfidentialTransferReceived` reverts `ConfidentialFundingDisabled` until both `confidentialFundingEnabled` and `confidentialFundingAccountingReady` are true. `creditConfidentialFund` only updates FHE `encryptedPoolSize`; plaintext `totalDepositedWei` (distribution/reclaim) cannot be synced from `euint64` without leaking. Re-enable only after FHE-sum accounting redesign — see [SECURITY.md](../SECURITY.md#confidential-ceth-trial-funding-low-2).

See [ERC7984_CONFIDENTIAL_TOKEN.md](ERC7984_CONFIDENTIAL_TOKEN.md) for the full IERC7984 reference.

**Dependency pin:** `@openzeppelin/confidential-contracts ^0.5.1` with `@fhevm/solidity ^0.11.1` and `@openzeppelin/contracts ^5.6.1`.
