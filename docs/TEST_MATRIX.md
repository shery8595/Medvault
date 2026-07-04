# MedVault Test Matrix

**Plan 08 — ~2,028 registered cases** across **97** TypeScript test files (incl. **832** parametric ECM matrix). **0 Foundry test contracts.**

| Suite | Files | Passing (verified) | Command |
|-------|-------|-------------------|---------|
| Unit + smoke + staking | 62 | **403** (+ 6 pending) | `npm run test:unit` |
| Integration | 14 | **85** | `npm run test:integration` |
| Crypto (nullifier) | 1 | **3** | `npm run test:crypto` |
| Fuzz + invariants | 7 | loop-expanded | `npm run test:fuzz` |
| Sepolia fork | 1 | 4 (conditional) | `npm run test:fork` (requires `SEPOLIA_RPC_URL`) |
| Honk (optional) | 1 | 1 | `npm run test:honk` (not in CI) |
| Vitest (frontend lib) | 3 | 13 | `npm run test:frontend` |
| node:test (SDK) | 3 | 11 | `npm run test -w @medvault/sdk` |
| node:test (core) | 1 | 3 | not CI-wired |
| **Default `npm test`** | **77** | **491** (403+85+3) | excludes fuzz/fork/Honk |

Fuzz uses **Mocha `for` loops** (not Foundry `vm.assume`). `hardhat.config.ts` sets `fuzz.runs: 256`.

| Generator | Cases (at `fuzz.runs: 256`) |
|-----------|----------------------------|
| `edge-case-parametric.test.ts` | 832 |
| `gas-stress-fuzz.test.ts` | 288 |
| `reward-distribution-fuzz.test.ts` | 256 |
| `eligibility-fuzz.test.ts` | 256 |
| `criteria-bounds.test.ts` | 256 |

`test-support/`: **19** helper modules (not executed as tests).

In-app catalog: **Docs → Tests & verification → Test matrix**.

## File catalog

| File | Contract(s) | Cases | Pillar | IDs |
|------|-------------|-------|--------|-----|
| [test/smoke/hardhat-fhevm.test.ts](../test/smoke/hardhat-fhevm.test.ts) | Stack | 4 | Infra | SMOKE-01–04 |
| [test/unit/ownership.two-step.test.ts](../test/unit/ownership.two-step.test.ts) | 12 ownable | 24 | ACL | OWN-*-01/02 |
| [test/unit/deprecated-entrypoints.test.ts](../test/unit/deprecated-entrypoints.test.ts) | EE, SIV | 4 | ACL | DEP-01–04 |
| [test/unit/timelock-wiring.test.ts](../test/unit/timelock-wiring.test.ts) | TM, EE, cETH, APR | 6 | ACL | TL-01–TL-06 |
| [test/unit/trial-manager.test.ts](../test/unit/trial-manager.test.ts) | TrialManager | 7 | ACL | TM-01–08 |
| [test/unit/trial-plaintext-gate.test.ts](../test/unit/trial-plaintext-gate.test.ts) | TrialManager | 4 | ACL | LEG-01–04 (LEG-01 conditional on `SEPOLIA_RPC_URL`) |
| [test/unit/sponsor-registry.test.ts](../test/unit/sponsor-registry.test.ts) | SponsorRegistry | 10 | FHE | SR-01–10 |
| [test/unit/sponsor-registry-auditor.test.ts](../test/unit/sponsor-registry-auditor.test.ts) | SponsorRegistry | 5 | ACL | SRA-01–05 |
| [test/unit/consent-manager.test.ts](../test/unit/consent-manager.test.ts) | ConsentManager | 10 | FHE | CM-01–10 |
| [test/unit/data-access-log.test.ts](../test/unit/data-access-log.test.ts) | DataAccessLog | 6 | ACL | DAL-01–06 |
| [test/unit/anonymous-patient-registry.test.ts](../test/unit/anonymous-patient-registry.test.ts) | AnonymousPatientRegistry | 8 | FHE | APR-01–08 |
| [test/unit/confidential-eth.test.ts](../test/unit/confidential-eth.test.ts) | ConfidentialETH7984 | 14 | FHE/ETH | CET-01–14 |
| [test/unit/eligibility-engine.test.ts](../test/unit/eligibility-engine.test.ts) | EligibilityEngine | 5 | FHE | EE-01–14 |
| [test/unit/formal-eligibility-properties.test.ts](../test/unit/formal-eligibility-properties.test.ts) | EligibilityEngine | 18 | FHE/Formal | P1–P3 PROP |
| [test/unit/encrypted-criteria.test.ts](../test/unit/encrypted-criteria.test.ts) | TrialManager, EE | 4 | FHE | ECR-01–03, DIFF-03 |
| [test/unit/sponsor-incentive-vault-payout.test.ts](../test/unit/sponsor-incentive-vault-payout.test.ts) | SIV, EE | 8 | FHE/ZR | SIV-PAYOUT-01, SIV-DUST-01, P2-01..04, P5-SELECT-01/02 |
| [test/unit/attestation-binding.test.ts](../test/unit/attestation-binding.test.ts) | EligibilityEngine | 6 | ZK/FHE | DIFF-*, BIND-01–04 |
| [test/unit/encrypted-consent-gate.test.ts](../test/unit/encrypted-consent-gate.test.ts) | EncryptedConsentGate | 6 | FHE | ECG-01–06 |
| [test/unit/encrypted-score-leaderboard.test.ts](../test/unit/encrypted-score-leaderboard.test.ts) | EncryptedScoreLeaderboard | 8 | FHE | ESL-01–08 |
| [test/unit/sponsor-incentive-vault.test.ts](../test/unit/sponsor-incentive-vault.test.ts) | SponsorIncentiveVault | 17 | ETH/FHE | SIV-01–18 |
| [test/unit/vault-security-fixes.test.ts](../test/unit/vault-security-fixes.test.ts) | SIV, cETH | 6 | ETH/FHE | VSEC-*, P2/HIGH-1 abandoned reclaim |
| [test/unit/gasless-claim.test.ts](../test/unit/gasless-claim.test.ts) | SIV, cETH | 3 | ETH/FHE | GCL-* |
| [test/unit/security-regression.test.ts](../test/unit/security-regression.test.ts) | MVR, EE | 3 | ACL | SEC-REG-* |
| [test/unit/trial-milestone-manager.test.ts](../test/unit/trial-milestone-manager.test.ts) | TrialMilestoneManager | 6 | ACL | TMM-01–06 |
| [test/unit/medvault-automation.test.ts](../test/unit/medvault-automation.test.ts) | MedVaultAutomation | 6 | ACL | MVA-01–06 |
| [test/unit/patient-document-store.test.ts](../test/unit/patient-document-store.test.ts) | PatientDocumentStore | 5 | FHE/Hybrid | PDS-01–05 |
| [test/unit/zero-revelation-rewards.test.ts](../test/unit/zero-revelation-rewards.test.ts) | SIV, cETH | 2 | FHE/ZR | ZR-01–02 |
| [test/unit/test-helpers.test.ts](../test/unit/test-helpers.test.ts) | cETH, APR | 6 | Infra | HCU-01–06 |
| [test/unit/high-concurrency-registrations.test.ts](../test/unit/high-concurrency-registrations.test.ts) | APR | 6 | FHE | HCR-* |
| [test/unit/direct-apply-fhe-stage.test.ts](../test/unit/direct-apply-fhe-stage.test.ts) | Off-chain | 2 | FHE | SEMA-PROOF-01–02 |
| [test/unit/medvault-registry-finalize.test.ts](../test/unit/medvault-registry-finalize.test.ts) | MedVaultRegistry | 6 | FHE | MVR-FIN-01–06 |
| [test/unit/document-revoke.test.ts](../test/unit/document-revoke.test.ts) | PatientDocumentStore | 4 | ACL | ACL-01–04 |
| [test/unit/v09-proof-of-computation.test.ts](../test/unit/v09-proof-of-computation.test.ts) | cETH, Staking, EE | 18 | FHE | SUF-01..07, V09-02..13 |
| [test/unit/public-exit.test.ts](../test/unit/public-exit.test.ts) | ConfidentialETH | 6 | ETH/FHE | SUF-05 / PEX-01–06 |
| [test/unit/batch-exit-queue.test.ts](../test/unit/batch-exit-queue.test.ts) | Relayer queue | 3 | Infra | BEX-01–03 |
| [test/unit/privacy-events.test.ts](../test/unit/privacy-events.test.ts) | cETH, SIV, Staking | 7 | FHE | PRIV-01–05, SUF-06, ACL-05 |
| [test/unit/apply-wizard.test.ts](../test/unit/apply-wizard.test.ts) | UI state | 2 | UI | UI-APPLY-* |
| [test/fuzz/eligibility-fuzz.test.ts](../test/fuzz/eligibility-fuzz.test.ts) | EE, APR | 256 | FHE | ELIG-FUZZ-* |
| [test/fuzz/criteria-bounds.test.ts](../test/fuzz/criteria-bounds.test.ts) | TrialManager | 256 | FHE | CRIT-FUZZ-* |
| [test/fuzz/reward-distribution-fuzz.test.ts](../test/fuzz/reward-distribution-fuzz.test.ts) | SIV, cETH | 256 | ZR | ZR-FUZZ-* |
| [test/fuzz/gas-stress-fuzz.test.ts](../test/fuzz/gas-stress-fuzz.test.ts) | cETH, SIV | 288 | Infra | GAS-FUZZ-* |
| [test/fuzz/edge-case-parametric.test.ts](../test/fuzz/edge-case-parametric.test.ts) | EE, APR, cETH | 832 | FHE | ECM-* |
| [test/invariants/token-invariants.test.ts](../test/invariants/token-invariants.test.ts) | cETH | 2 | FHE | TOK-INV-* |
| [test/invariants/document-store-invariants.test.ts](../test/invariants/document-store-invariants.test.ts) | PatientDocumentStore | 19 | FHE/Hybrid | PDS-INV-* |
| [test/fork/sepolia-fork.test.ts](../test/fork/sepolia-fork.test.ts) | Aave, AT | 4 | Infra | SF-01–04 |
| [test/integration/medvault-registry.test.ts](../test/integration/medvault-registry.test.ts) | MedVaultRegistry | 12 | ZK/FHE | MVR-01–12 |
| [test/integration/eligibility-anonymous.test.ts](../test/integration/eligibility-anonymous.test.ts) | EE, MVR, CM | 11 | FHE | INT-EE-01–11 |
| [test/integration/consent-gate-flow.test.ts](../test/integration/consent-gate-flow.test.ts) | ECG, CM | 4 | FHE | CG-INT-01–04 |
| [test/integration/vault-funding-distribution.test.ts](../test/integration/vault-funding-distribution.test.ts) | SIV, TMM, MVA | 10 | ETH | INT-VAULT-01–10 |
| [test/integration/e2e-patient-to-claim.test.ts](../test/integration/e2e-patient-to-claim.test.ts) | Full stack | 9 | E2E | E2E-01–09 |
| [test/integration/v09-complete-flow.test.ts](../test/integration/v09-complete-flow.test.ts) | Full stack v0.9 | 16 | E2E | FLOW-01–16 |
| [test/integration/batch-eligibility.test.ts](../test/integration/batch-eligibility.test.ts) | EligibilityEngine | 1 | FHE | BAT-01 |
| [test/integration/relayer-registration.test.ts](../test/integration/relayer-registration.test.ts) | MedVaultRegistry | 1 | Privacy | REL-REG-01 |
| [test/integration/relayer-decrypt-verify.test.ts](../test/integration/relayer-decrypt-verify.test.ts) | MVR, relayer | 5 | Privacy | RDV-01–05 |
| [test/unit/p3-relayer-trust-reduction.test.ts](../test/unit/p3-relayer-trust-reduction.test.ts) | MVR, Vault | 5 | Privacy | P3-01–P3-05 |
| [test/unit/relayer-adversarial.test.ts](../test/unit/relayer-adversarial.test.ts) | MVR, relayer | 8 | Privacy | REL-EQV-01–02, REL-REP-01–02, REL-FF-01–02, REL-STALE-01–02 |
| [test/integration/ai-criteria-roundtrip.test.ts](../test/integration/ai-criteria-roundtrip.test.ts) | @medvault/ai | 7 | AI | AI-01–07 |
| [test/integration/indexer-sync.test.ts](../test/integration/indexer-sync.test.ts) | @medvault/indexer | 5 | IDX | IDX-01–05 |
| [test/integration/hybrid-storage.e2e.test.ts](../test/integration/hybrid-storage.e2e.test.ts) | Full stack + IPFS | 1 | E2E | HYB-01 |
| [test/integration/anonymous-apply-cancel.test.ts](../test/integration/anonymous-apply-cancel.test.ts) | MVR, EE | 2 | E2E | AAC-01–02 |
| [test/staking/staking-manager.test.ts](../test/staking/staking-manager.test.ts) | StakingManager | 8 | ETH/FHE | STK-01–08 |
| [test/crypto/noir-nullifier.test.ts](../test/crypto/noir-nullifier.test.ts) | Off-chain | 3 | ZK | CRYPTO-NULL-01–03 |
| [test/crypto/honk-pipeline.test.ts](../test/crypto/honk-pipeline.test.ts) | HonkVerifier | 1 | ZK | CRYPTO-HONK-01 |

## Skipped tests

| ID | Type | Reason |
|----|------|--------|
| EE-11, EE-12 | Permanent `it.skip` | Public `verifyEligibilityProof` API removed |
| TM-03 | Permanent `it.skip` | Requires `hardhat_setChainId` |
| LEG-01 | Conditional | Skipped unless `SEPOLIA_RPC_URL` set (Sepolia fork for chainid != 31337) |
| SIV-10 | Permanent `it.skip` | Reclaim edge case pending refinement |
| SDD-01 | Conditional | Skipped unless `RUN_LARGE_POOL_TEST=1` |
| SF-01–04 | Conditional | Fork suite skipped unless `SEPOLIA_RPC_URL` set |

## Audit traceability

| Topic | Test IDs |
|-------|----------|
| Timelock wiring | TL-01–TL-06 |
| Withdraw-to EIP-712 | TL-05, FLOW-09, E2E-09 |
| MH-1 engine before registration | TL-04, APR-* |
| H-4 milestone participant check | TMM-03 |
| M-2 consent gate / revoked consent | CM-07, ECG-05, INT-EE-04, E2E-05 |
| Two-step ownership | OWN-*-* |
| Deprecated legacy entrypoints | DEP-01–04 |
| Sponsor verification (Hardhat) | TM-02, SR-*, SRA-01–05 |
| Plaintext trial criteria gate (Hardhat-only) | LEG-01–04 |
| Forward-only document revocation | ACL-01–05 |
| Homomorphic transferable withdraw/stake (no public sufficiency bool) | SUF-01..07 |
| Zama FHE encrypt / ACL binding | APR-01, SR-01, CM-01, SEMA-PROOF-01–02 |
| EligibilityEngine ↔ ConsentManager FHE ACL | INT-EE-03, SIV-05+ |
| Transferable-amount KMS completion | SUF-*, FLOW-07–08 |
| Encrypted withdraw + EIP-712 v2 public exit | SUF-05 / PEX-*, BEX-*, PRIV-*, SUF-06 |
| Gasless claim commitment | GCL-* |
| Private unstake (no Aave) | V09-09–10 |
| PatientDocumentStore hybrid storage | PDS-*, PDS-INV-*, HYB-01 |
| Zero-revelation screening rewards | ZR-*, ZR-FUZZ-* |
| Cleartext test helpers (Hardhat-only) | HCU-* |
| Sepolia fork (Aave / Chainlink) | SF-* |
| AI criteria extraction | AI-* |
| Indexer sync | IDX-* |
| High-concurrency registration | HCR-* |
| Trust-gap P2 `FHE.select` payout gating | P2-01..04, P5-SELECT-01/02 |
| Relayer re-decrypt defense-in-depth (P0.2) | RDV-01–05 |
| Phase 5 differential (plaintext vs encrypted oracle) | P1–P3 PROP, DIFF-03 |
| Noir attestation ↔ FHE stage binding | DIFF-*, BIND-* |

## Sample checklist

- [ ] SMOKE-01–04
- [ ] TL-01–TL-06
- [ ] TM-01–08 (TM-03 skipped)
- [ ] LEG-01–04 (LEG-01 conditional on Sepolia fork)
- [ ] EE-01–14 (EE-11/12 pending — removed public verify API)
- [ ] SIV-01–18
- [ ] PDS-01–05, PDS-INV-*
- [ ] HCU-01–06 (test helpers gated)
- [ ] ZR-01–02, ZR-FUZZ-0–255
- [ ] SF-01–04 (fork job)
- [ ] AI-01–07, IDX-01–05, HYB-01, AAC-01–02
- [ ] MVR-FIN-01–06, FLOW-01–16
- [ ] INT-EE-01–11
- [ ] E2E-01–09
- [ ] STK-01–08
- [ ] CRYPTO-NULL-01–03
- [ ] ACL-01–05 (document revoke + consent epoch)
- [ ] SUF-01..07 (transferable completion; SUF-05 aliases PEX-01..05)
- [ ] P2-01..04, P5-SELECT-01/02 (ciphertext-gated payout)
- [ ] RDV-01–05 (relayer decrypt-verify)
- [ ] P3-01–P3-05, REL-EQV/REP/FF/STALE (relayer adversarial)
- [ ] P1–P3 PROP, DIFF-03 (formal/differential eligibility)
- [ ] ECR-01–03, BIND-01–04 (encrypted criteria + attestation binding)

See also [TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md) and [TESTING_GUIDE.md](./TESTING_GUIDE.md).
