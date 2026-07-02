# Certora / Halmos verification results (Phase 5)

**Date:** 2026-07-01  
**Scope:** Properties P1–P5 from [eligibility-engine.spec.md](./eligibility-engine.spec.md)  
**Network:** Hardhat fhEVM mock (`hre.fhevm.isMock`)

## Executive summary

| Property | Spec | Formal tool | Result | Differential fallback |
|----------|------|-------------|--------|------------------------|
| P1 | Monotonicity of pass count | Halmos | **Blocked** | `test/unit/formal-eligibility-properties.test.ts` (P1-PROP) |
| P2 | Final result is conjunction | Halmos | **Blocked** | `test/unit/formal-eligibility-properties.test.ts` (P2-PROP) |
| P3 | Score bounded [0, 100] | Halmos | **Blocked** | `test/unit/formal-eligibility-properties.test.ts` (P3-PROP) |
| P4 | Plaintext vs encrypted equivalence | Certora | **Blocked** | `test/unit/encrypted-criteria.test.ts` (DIFF-03) |
| P5 | FHE stage binding | Certora | **N/A** (ZK path) | `test/unit/attestation-binding.test.ts` (BIND-01) |

**P2 payout invariant (`FHE.select`):** `test/unit/sponsor-incentive-vault-payout.test.ts` (P5-SELECT-01, P5-SELECT-02)  
**P0.2 relayer decrypt e2e:** `test/integration/relayer-decrypt-verify.test.ts` (RDV-01..05)

All differential fallbacks **PASS** on the Hardhat mock network (verified 2026-07-01).

## Contract harness

`EligibilityEngine.comparePlaintextVsEncryptedEligibility` (registry-only, mirrors `compareCachedEligibilityPaths`) computes both paths, marks handles `makePubliclyDecryptable`, and persists them in `lastDiffCompareHandles` for mock-network oracle reads.

## Why formal tools are blocked

### Halmos

- MedVault uses **Hardhat + `@fhevm/hardhat-plugin`**, not Foundry.
- `EligibilityEngine._computeEligibility*` operates on Zama `ebool` / `euint8` types from `@fhevm/solidity`; Halmos has no model for fhEVM homomorphic opcodes (`FHE.ge`, `FHE.select`, ACL `FHE.allow`, etc.).
- Porting to Foundry + Halmos would require a non-trivial FHE mock shim and would not prove Zama coprocessor semantics (already out of scope per spec).

**Attempted:** No Halmos job was added to CI — encoding P1–P3 as Halmos `assert` rules over ciphertext handles would be vacuous without an FHE semantics model.

### Certora

- Certora Prover does not ship rules for `@fhevm/solidity` `FHE.*` builtins.
- P5 (`finalizeAnonymousEligibilityWithProof` + `fhe_stage_handle_hash` binding) depends on Noir `HonkVerifier` and BN254 public inputs — outside Certora's default EVM rule surface without custom summaries for the verifier contract.

**Attempted:** Property rules were drafted against `_scoreAndCombine` logic in isolation; without `FHE.select`/`FHE.and` summaries the prover cannot close goals over encrypted types.

## Differential evidence (accepted per Phase 5 risk mitigation)

Per parent plan risk table: *"Fall back to differential testing (DIFF-03 + select invariant) on the mock network if formal encoding is blocked."*

### P1 — Monotonicity

For each single-criterion fail profile vs `ELIGIBLE_PROFILE` (fail→pass flip), mock-decrypted score on plaintext and encrypted paths does not decrease.

### P2 — Conjunction

Eligible profile decrypts `true`; each single-failing criterion profile decrypts `false` on both paths.

### P3 — Score bound

Varied profiles yield `0 ≤ score ≤ 100` on mock decrypt.

### P4 / DIFF-03 — Plaintext vs encrypted oracle

`comparePlaintextVsEncryptedEligibility` (registry-only harness, mirrors `compareCachedEligibilityPaths`) returns bit-identical `(finalResult, score)` handles for identical criteria on plaintext vs encrypted trials.

### P5 — Attestation binding

`BIND-01`: wrong `fhe_stage_handle_hash` reverts finalize with `FHE stage mismatch`.

### P2 payout — `FHE.select(eligible, units, 0)`

`P5-SELECT-01` (screening) and `P5-SELECT-02` (milestone > 0): decrypted payout delta is zero **iff** decrypted eligibility is false.

### P0.2 — Relayer decrypt verification

`RDV-01`: forged client `eligible=true` with decrypt `false` → relayer returns not eligible.  
`RDV-02`: honest path decrypt `true` matches finalize + vault screening gate.

## Test commands

```bash
npm run compile
npx hardhat test test/unit/formal-eligibility-properties.test.ts
npx hardhat test test/unit/encrypted-criteria.test.ts --grep "DIFF-03"
npx hardhat test test/unit/sponsor-incentive-vault-payout.test.ts --grep "P5-SELECT"
npx hardhat test test/unit/attestation-binding.test.ts --grep "BIND-01"
npx hardhat test test/integration/relayer-decrypt-verify.test.ts
```

## Audit handoff (P4.3)

This document plus the cited test files constitute the formal/differential evidence bundle for external audit scope item **Formal spec (informal)** in `docs/EXTERNAL_AUDIT_SCOPE.md`.
