# MedVault external security audit — public summary

> **Last updated:** 2026-07-01  
> **Status:** Audit **scoped and commissioned** (internal pre-review complete; external firm engagement in progress)

MedVault publishes this summary for integrators, sponsors, and patients evaluating the protocol's security posture. Full findings will be appended when the external review completes.

## Executive summary

MedVault is an fhEVM clinical-trial matching reference architecture on Ethereum Sepolia. The highest-risk areas are **encrypted-criteria finalize**, **FHE-gated incentive payouts**, and **hybrid document key handling**. An external security audit has been scoped in three phases ([EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md)) following the trust-gap remediation program (P0–P5).

**This is not a regulatory compliance certification.** See [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md) for HIPAA/IRB/GDPR boundaries.

## Audit scope (commissioned)

| Phase | Components | Priority |
|-------|------------|----------|
| **A** | `EligibilityEngine`, `MedVaultRegistry` finalize, `SponsorIncentiveVault` FHE.select gating, `EncryptedConsentGate` | **Highest** |
| **B** | `ConfidentialETH7984`, vault accounting, withdrawal staging | High |
| **C** | Relayer re-decrypt finalize, Noir circuit public inputs, Honk verifier alignment | Medium |

## Internal pre-audit mitigations (already shipped)

| Finding family | Mitigation | Verification |
|----------------|------------|--------------|
| Noir–FHE integrity gap (forged `eligible` witness) | P0.2 relayer re-decrypt (defense-in-depth); **P2 `FHE.select` ciphertext gating** (shipped) | `test/integration/relayer-decrypt-verify.test.ts`, `test/unit/sponsor-incentive-vault-payout.test.ts`, `test/unit/formal-eligibility-properties.test.ts`, `test/unit/encrypted-criteria.test.ts` (DIFF-03) |
| Trusted relayer TCB | P0.2 defense-in-depth + P3.1 multi-relayer + REL-* adversarial tests; P3.3 threshold spec (deferred); P2 payout gating shipped | [relayer/README.md](../relayer/README.md), [RELAYER_TRUST_BOUNDARIES.md](./RELAYER_TRUST_BOUNDARIES.md) |
| AI protocol PHI leakage | Redaction before every LLM call; no-retention policy | `ai-service/src/redaction.ts`, `ai-service/src/retention.ts` |
| Indexer data exposure | Bearer auth on data routes (`INDEXER_API_SECRET`) | [indexer/README.md](../indexer/README.md) |
| Sponsor incentive accounting | CRIT-2 / HIGH-3 remediations | `test/unit/remediation-vuln-fixes.test.ts` |

## Findings (external review)

> **Pending external firm delivery.** This section will be updated with severity-rated findings and remediation status.

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| — | — | *External review in progress* | — |

## Post-audit commitment

1. Publish Critical/High remediation PRs within agreed SLA with auditor.
2. Re-run default test suite (`npm test`) and update [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md).
3. Link final report summary here and from [README.md](../README.md#documentation).

## How to reproduce security tests locally

```bash
npm test                                    # default suite (491 cases)
npm run test:integration                    # relayer + e2e paths
npx hardhat test test/unit/sponsor-incentive-vault-payout.test.ts
npx hardhat test test/integration/relayer-decrypt-verify.test.ts
npx hardhat test test/unit/formal-eligibility-properties.test.ts
npx hardhat test test/unit/encrypted-criteria.test.ts --grep "DIFF-03"
npx hardhat test test/unit/attestation-binding.test.ts --grep "BIND-01"
```

## Contact

Security disclosures: see [SECURITY.md](../SECURITY.md#reporting).

## Related

- [EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md) — full RFP scope
- [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md) — HIPAA/IRB/GDPR scope boundaries
- [FHE_AUDIT_README.md](./FHE_AUDIT_README.md) — FHE primitive map
