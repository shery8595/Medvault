# MedVault FHE Audit Map (Zama Builder Track)

One-page map of every **Zama FHE** primitive in MedVault and where it lives. For judges verifying the submission without reading the full repo.

**Live demo:** https://med-vault.xyz · **Network:** Ethereum Sepolia · **Tests:** 265 passing (`npm test`)

## What is encrypted vs public

| Data | Encrypted (FHE) | Public on-chain |
|------|-----------------|-----------------|
| Patient vitals (age, Hb, BMI flags) | Yes — `euint8` / `euint16` / `ebool` in `AnonymousPatientRegistry` | Never plaintext |
| Sponsor trial criteria (min age, max weight, …) | Yes — `createTrialWithEncryptedCriteria` in `TrialManager` | Trial name/phase/location only |
| Eligibility result | Yes — `ebool` per nullifier×trial in `EligibilityEngine` | Never plaintext |
| Propensity score | Yes — `euint8` in `EligibilityEngine` | Never plaintext |
| Aggregate match stats | Yes — `euint64` sum + `euint32` count in `EncryptedScoreLeaderboard` | Never per-patient |
| Incentive balances | Yes — `euint64` in `ConfidentialETH` | Native ETH `msg.value` visible at tx layer |
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
| `@fhevm/hardhat-plugin` mocks | `test-support/fhe.ts` | 265 CI tests |

## End-to-end FHE flow (judge checklist)

1. **Encrypt profile** — Browser `buildPatientProfileInputs()` → `MedVaultRegistry.registerPatient` (or relayer path).
2. **Encrypt criteria** — Sponsor `buildSponsorCriteriaInputs()` → `TrialManager.createTrialWithEncryptedCriteria`.
3. **Homomorphic match** — `EligibilityEngine.stageAnonymousEligibility` → `_computeEligibility` on ciphertext.
4. **Local decrypt** — Patient `decryptForView(finalCt)` with ACL permit.
5. **FHE-bound seal** — Noir attestation: private `staged_fhe_handle` must equal public `fhe_stage_handle_hash`; on-chain `_verifyEligibilityProofCore` checks hash vs staged `finalCt`.
6. **Aggregate analytics** — `EncryptedScoreLeaderboard.addToAggregate` homomorphic sum without revealing individual scores.

## Residual privacy limits (honest)

- Registration via wallet (not relayer) links `tx.from` ↔ Semaphore commitment in one tx.
- Native ETH amounts visible at transaction layer for `fundTrial` / `deposit`.
- Noir attestation binds identity + plaintext witness to staged handle hash; full proof that FHE ciphertext plaintext equals witness requires Zama input-proof in circuit (future).

## Test coverage

| Suite | Command | Focus |
|-------|---------|-------|
| Unit + integration | `npm test` | FHE eligibility, encrypted criteria, attestation binding, aggregates, batch, relayer registration |
| Crypto | `npm run test:crypto` | Noir nullifier alignment |
| Honk (slow) | `npm run test:honk` | Full browser-compatible proof pipeline |

See [TEST_MATRIX.md](TEST_MATRIX.md) for case IDs.
