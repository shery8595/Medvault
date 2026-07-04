# MedVault external security audit — scope document

> **Status:** Scoped for commissioning (2026-07-01). External firm engagement is planned; this document is the RFP-ready scope derived from the trust-gap remediation program.

## Objectives

1. Validate that encrypted-criteria finalize and payout paths cannot be abused via forged witness bits (post-P2 `FHE.select` gating).
2. Review FHE ACL, consent, and hybrid document flows for unauthorized decryption.
3. Review relayer and Noir public-input alignment for identity binding — not fhEVM execution proof.
4. Produce a public summary suitable for integrators and sponsors ([EXTERNAL_AUDIT_SUMMARY.md](./EXTERNAL_AUDIT_SUMMARY.md)).

## Out of scope

- Formal FDA / HIPAA compliance certification (see [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md))
- Economic audit of tokenomics or Aave integration yields
- Zama fhEVM protocol layer (assumed correct per Zama network)
- Frontend UX / accessibility

## Audit phases (priority order)

### Phase A — Finalize + eligibility + vault gating (highest risk)

**Contracts:**

| Contract | Focus areas |
|----------|-------------|
| `EligibilityEngine.sol` | `stageAnonymousEligibility`, `finalizeAnonymousEligibilityWithProof`, `_verifyEligibilityProofCore`, `anonymousResults` ciphertext, `noirVerifiedResults` / `anonymousVaultScreeningEligible` audit-only usage |
| `MedVaultRegistry.sol` | `finalizeAnonymousApplyWithProof`, `onlyAuthorizedRelayer`, relayer registration paths |
| `SponsorIncentiveVault.sol` | `_creditScreeningRewardEncrypted` (`FHE.select`), `_creditReward` milestone>0, `_registerParticipant`, distribution accounting |
| `EncryptedConsentGate.sol` | `getAnonymousResult`, value-moving `FHE.select` paths |

**Tests to reproduce:**

- `test/unit/sponsor-incentive-vault-payout.test.ts` (P2 invariants, P5-SELECT-01/02)
- `test/unit/formal-eligibility-properties.test.ts` (P1–P3 PROP)
- `test/unit/encrypted-criteria.test.ts` (DIFF-03)
- `test/unit/encrypted-consent-gate.test.ts`
- `test/integration/e2e-patient-to-claim.test.ts`
- `test/integration/relayer-decrypt-verify.test.ts`
- `test/unit/remediation-vuln-fixes.test.ts`

**Key properties:**

1. Forged Noir `eligible` + ciphertext `false` → zero payout (ciphertext-zero select).
2. No `require` on `noirVerifiedResults` / `anonymousVaultScreeningEligible` for value movement.
3. Staging TTL and cancel semantics cannot be bypassed for payout.

### Phase B — Confidential token + vault accounting

**Contracts:**

| Contract | Focus areas |
|----------|-------------|
| `ConfidentialETH7984.sol` | Deposit/withdraw staging, `FHE.select` transferable gate, `FHE.checkSignatures`, EIP-712 withdraw-to |
| `SponsorIncentiveVault.sol` | `totalDistributedWei`, milestone paid flags, sponsor reclaim, `reclaimAbandonedToOwner` (vault P2), nullifier replay (HIGH-3) |

**Tests:**

- `test/unit/remediation-vuln-fixes.test.ts` (SUF-*, CRIT-2)
- `test/integration/*withdraw*`

### Phase C — Relayer + Noir alignment

**Off-chain + circuits:**

| Component | Focus areas |
|-----------|-------------|
| `relayer/server.js` | `relayFinalize` re-decrypt (P0.2), ignores client `eligible`, logging policy |
| `relayer/eligibility-decrypt.mjs` | permitRecipient user-decrypt, cache TTL |
| `circuits/eligibility_plaintext/src/main.nr` | 25 public inputs, document binding indices 17–24 |
| `circuits/eligibility_encrypted/src/main.nr` | 15 public inputs, identity + FHE stage + encrypted criteria binding |
| `contracts/HonkVerifier.sol` | Plaintext criteria verification key |
| `contracts/HonkVerifierEncrypted.sol` | Encrypted criteria verification key |

**Tests:**

- `test/unit/attestation-binding.test.ts`
- `test/integration/relayer-decrypt-verify.test.ts`
- `test/integration/eligibility-anonymous.test.ts`

## Deliverables requested from auditor

1. Executive summary (public-safe)
2. Severity-rated findings (Critical / High / Medium / Low / Informational)
3. Proof-of-concept for Critical/High where feasible
4. Remediation recommendations with effort estimates
5. Re-review of fixed Critical/High items (one round included)

## Internal pre-audit checklist (completed before external engagement)

| Item | Status |
|------|--------|
| Trust-gap remediation P0 (disclosure + relayer re-decrypt) | Documented / implemented per [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md) |
| P2 FHE.select payout gating | Shipped + Phase 5 differential evidence — [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md) rows 13–14, [certora-halmos-results.md](./formal-verification/certora-halmos-results.md) |
| Threat model updated | [internal-docs/threat-model.md](../internal-docs/threat-model.md) |
| Regulatory posture | [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md) |
| Default test suite | 491+ cases — `npm test` |
| Formal spec (informal) | [formal-verification/eligibility-engine.spec.md](./formal-verification/eligibility-engine.spec.md) |
| Formal / differential results (Phase 5) | [formal-verification/certora-halmos-results.md](./formal-verification/certora-halmos-results.md) |

## Engagement logistics

- **Target network:** Ethereum Sepolia (chainid 11155111) + Hardhat local (31337)
- **Code freeze:** Tag release candidate before Phase A review
- **Access:** GitHub read access; optional Sepolia test wallet for live finalize demos
- **Timeline estimate:** 3–4 weeks Phase A; +2 weeks Phase B; +1 week Phase C

## References

- [SECURITY.md](../SECURITY.md)
- [FHE_AUDIT_README.md](./FHE_AUDIT_README.md)
- [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md)
- Parent remediation plan: trust-gap P0–P5
