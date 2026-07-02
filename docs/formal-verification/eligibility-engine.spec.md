# Formal verification spec: `EligibilityEngine._computeEligibility`

Lightweight property spec for Certora / Halmos review of homomorphic eligibility logic.

## Scope

- `_computeEligibilityPlaintext`
- `_computeEligibilityEncrypted`
- `_scoreAndCombine`

## Assumed mock semantics

On the FHE mock network, `mockDecryptBool` / `mockGetPlaintext` provide ground-truth plaintext for test oracles.

## Properties

### P1 — Monotonicity of pass count

For fixed patient profile `P` and trial criteria `C`, if criterion `k` flips from fail→pass (all others fixed), then `passCount'` ≥ `passCount`.

### P2 — Final result is conjunction

`finalResult` decrypts to true iff all eight sub-boolean checks decrypt to true.

### P3 — Score bounded

`score` decrypts to a value in `[0, 100]` for any inputs (enforced by `FHE.select(FHE.le(score, 100), score, 100)`).

### P4 — Plaintext vs encrypted criteria equivalence

For identical numeric/boolean criteria values, `_computeEligibilityPlaintext` and `_computeEligibilityEncrypted` yield identical mock-decrypted `(finalResult, score)` for the same patient profile.

**Test:** `test/unit/encrypted-criteria.test.ts` (ECR-01, DIFF-03).

### P5 — FHE stage binding (attestation)

`finalizeAnonymousEligibilityWithProof` reverts when public input `fhe_stage_handle_hash` ≠ field(`staged finalCt`).

**Test:** `test/unit/attestation-binding.test.ts` (BIND-01).

## Verification results

See [certora-halmos-results.md](./certora-halmos-results.md) for Certora/Halmos run status and differential fallbacks (Phase 5).

## Out of scope

- Zama coprocessor correctness (assumed by `@fhevm/hardhat-plugin`)
- Noir circuit completeness vs FHE plaintext (see DIFF-01/DIFF-02 differential tests)
