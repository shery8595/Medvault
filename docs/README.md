# MedVault documentation index

Central index for repository markdown documentation. In-app docs live at `/docs` in the dApp ([med-vault.xyz/docs](https://med-vault.xyz/docs)).

Canonical statistics (contract counts, test matrix totals): [`src/lib/docsStats.ts`](../src/lib/docsStats.ts) · methodology and QA coverage: [AUDIT.md](./AUDIT.md).

## Glossary (canonical terminology)

| Term | Use this | Not this | Notes |
|------|----------|----------|-------|
| Patient apply flow | **anonymous apply** | anonymous application | Semaphore nullifier + relayer stage/finalize |
| Encrypted token | **cETH** (symbol) / **ConfidentialETH7984** (implementation) | bare `ConfidentialETH` in new prose | `ConfidentialETH.sol` is a **deploy alias** only |
| Trial payout contract | **SponsorIncentiveVault** | "the vault" alone | Disambiguate from `StakingManager` / Aave |
| Milestone-0 payout | **zero-revelation reward** (or **zero-revelation screening reward**) | "screening reward" alone | FHE-gated; see [ZERO_REVELATION_REWARDS.md](./ZERO_REVELATION_REWARDS.md) |
| Contract catalog count | **15** production entries in `PROTOCOL_CONTRACTS` | "14 contracts" | + alias + optional Honk = **17** Solidity artifacts |
| Default test suite | **491 passing** (`npm test`) | 283 / 285 / ~330 / 369 / 401 / 428 / 483 | Source: `docsStats.testSuiteDefaultPassing` (verified 2026-07-04) |
| Eligibility public inputs | **25** (plaintext) / **15** (encrypted) | 16 / 17 | `circuits/eligibility_plaintext`, `circuits/eligibility_encrypted` |
| FHE core story (canonical) | Homomorphic match of encrypted patient vitals vs encrypted sponsor criteria on Sepolia | — | README header + [LIGHTPAPER.md](./LIGHTPAPER.md) |

## Dual-doc sync rule

MedVault maintains **two documentation layers**. Each topic has **one canonical owner**; the other layer links to it.

| Layer | Path | Audience | Owns |
|-------|------|----------|------|
| **Repo markdown** | `docs/`, `internal-docs/`, package READMEs | Auditors, GitHub, CI | Runbooks, env templates, verification snapshots, formal specs |
| **In-app docs** | `src/pages/docs/` (`PascalCaseDoc.tsx`) | dApp users & integrators browsing `/docs` | UX narratives, diagrams, quick-start flows |

**Maintenance:** When you change code in an owning area, update the canonical doc in the same PR. Cross-link the other layer; do not duplicate prose.

**PR checklist (documentation):**

- [ ] Touched contracts → update `/docs/contracts` and/or `protocolContracts.ts` quirks
- [ ] Touched relayer/indexer/ai-service/MCP → update service README + in-app ops/MCP page if user-facing
- [ ] Touched tests → update `testSuiteData.ts` / `docsStats.ts` if counts change; run `npm test`
- [ ] Touched subgraph → update `SUBGRAPH_SYNC.md` and `/docs/subgraph`
- [ ] New markdown in `docs/` → add row here and entry in `src/lib/docsNav.ts`
- [ ] Statistics in prose → import from `docsStats` / `testSuiteData`, not hard-coded literals

**Release gate:** Run Plan 10 verification in [AUDIT.md](./AUDIT.md) before major releases.

## Getting started

| Document | Description |
|----------|-------------|
| [LIGHTPAPER.md](./LIGHTPAPER.md) | Judge/investor lightpaper — problem, FHE core, roadmap, business model |
| [PITCH_DECK.md](./PITCH_DECK.md) | 10–15 slide pitch outline (render externally) |
| [FHE_AUDIT_README.md](./FHE_AUDIT_README.md) | FHE primitive map for Zama Builder Track judges |
| [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) | Docker Compose one-command setup + legacy `npm run dev` |
| [DOCKER.md](./DOCKER.md) | Docker architecture, profiles, production build, troubleshooting |
| [../README.md](../README.md) | Project overview, capabilities, environment variables |
| [AUDIT.md](./AUDIT.md) | Verified repository statistics, QA coverage table, audit methodology |

## Protocol & contracts

| Document | Description |
|----------|-------------|
| [../SECURITY.md](../SECURITY.md) | Noir–FHE gap, remediation mitigations (HIGH-1 … INFO), operational guidance |
| [MEDIUM_FINDINGS_CLOSEOUT.md](./MEDIUM_FINDINGS_CLOSEOUT.md) | Closeout for 3 open Medium threat-model rows (auditor, silent reject, RegConsistency) |
| [REGCONSISTENCY_B_FINDING.md](./REGCONSISTENCY_B_FINDING.md) | P5 SDK investigation — registration consistency binding **not available**; RegConsistency-A blocked |
| [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md) | HIPAA/IRB/GDPR scope — **not a certified clinical system** |
| [PRODUCTION_READINESS_COMPLIANCE.md](./PRODUCTION_READINESS_COMPLIANCE.md) | Judge-skimmable HIPAA/BAA/GDPR/Part 11 gap checklist |
| [EXTERNAL_AUDIT_SUMMARY.md](./EXTERNAL_AUDIT_SUMMARY.md) | Public external security audit status |
| [EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md) | Third-party audit RFP scope (finalize → vault → relayer) |
| [ATOMIC_FLOWS.md](./ATOMIC_FLOWS.md) | Relayer-gated finalize, `stakeAndLock`, atomic sponsor flows |
| [ERC7984_CONFIDENTIAL_TOKEN.md](./ERC7984_CONFIDENTIAL_TOKEN.md) | OpenZeppelin IERC7984 implementation (`ConfidentialETH7984`) |
| [FHE_AUDIT_README.md](./FHE_AUDIT_README.md) | FHE audit map for judges (includes ERC-7984 summary) |
| [PRIVATE_WITHDRAWALS.md](./PRIVATE_WITHDRAWALS.md) | Encrypted withdraw, withdraw-to, public exit, relayer |
| [RELAYER_TRUST_BOUNDARIES.md](./RELAYER_TRUST_BOUNDARIES.md) | Relayer trust bounds + REL-* test matrix |
| [P3_3_THRESHOLD_ATTESTATION.md](./P3_3_THRESHOLD_ATTESTATION.md) | Deferred M-of-N relayer co-sign spec |
| [TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md) | Schedule/apply wiring for cross-contract auth; dual relayer deploy; CRE + owner cron runbooks |
| [AUTOMATION_CRON.md](./AUTOMATION_CRON.md) | Owner cron scheduler for `MedVaultAutomation` (Railway `*/5 * * * *`) |
| [HYBRID_STORAGE.md](./HYBRID_STORAGE.md) | IPFS + FHE document keys (`PatientDocumentStore`) |
| [ATOMIC_FLOWS.md](./ATOMIC_FLOWS.md) | End-to-end atomic patient/sponsor flows |
| [ZERO_REVELATION_REWARDS.md](./ZERO_REVELATION_REWARDS.md) | FHE-gated zero-revelation milestone payouts |
| [archive/](./archive/) | **Historical** milestone/audit design proposals (shipped) |

## Testing & verification

| Document | Description |
|----------|-------------|
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Hardhat suite layout, commands, fixtures |
| [TEST_MATRIX.md](./TEST_MATRIX.md) | Case IDs (CET-*, TL-*, FLOW-*, …) |
| [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md) | Dated compile/test/build/docker results |

## Operations & integration

| Document | Description |
|----------|-------------|
| [SUBGRAPH_SYNC.md](./SUBGRAPH_SYNC.md) | The Graph Studio versioning and deploy |
| [MCP_SERVER.md](./MCP_SERVER.md) | Local MCP server for AI assistants |
| [ANDROID_APK.md](./ANDROID_APK.md) | Capacitor Android demo APK |
| [MOBILE_ARCHITECTURE.md](./MOBILE_ARCHITECTURE.md) | Mobile WebView + Privy + FHE notes |
| [../ai-service/README.md](../ai-service/README.md) | PHI-safe criteria extraction API (port 3200) |
| [../indexer/README.md](../indexer/README.md) | Hybrid subgraph+RPC indexer API (port 3300) |
| [../relayer/README.md](../relayer/README.md) | HTTP relayer for gasless apply/claim/withdraw |

## Security & assurance

| Document | Description |
|----------|-------------|
| [../SECURITY.md](../SECURITY.md) | Plaintext trial criteria Hardhat-only; forward-only revocation; no public sufficiency bit. Noir-FHE binding deferred (Zama SDK tooling gap). |
| [../internal-docs/threat-model.md](../internal-docs/threat-model.md) | STRIDE threat model (maps to contract/indexer findings) |
| [../internal-docs/zama-integration.md](../internal-docs/zama-integration.md) | Zama FHE + ERC-7984 integrator guide |

## Formal verification & internal specs

| Document | Description |
|----------|-------------|
| [formal-verification/eligibility-engine.spec.md](./formal-verification/eligibility-engine.spec.md) | EligibilityEngine formal property specification (P1–P5) |
| [formal-verification/certora-halmos-results.md](./formal-verification/certora-halmos-results.md) | Phase 5 Certora/Halmos results + differential evidence |
| [DOC_CONSISTENCY_CHANGELOG.md](./DOC_CONSISTENCY_CHANGELOG.md) | Post–Phase 5 documentation reframe changelog |
| [../internal-docs/README.md](../internal-docs/README.md) | Engineering specs index |
| [../internal-docs/srs.md](../internal-docs/srs.md) | Software Requirements Specification |
| [../internal-docs/dfd.md](../internal-docs/dfd.md) | Data flow diagrams |
| [../internal-docs/architecture.md](../internal-docs/architecture.md) | System architecture |

## Environment templates

| File | Use |
|------|-----|
| [../.env.example](../.env.example) | Legacy npm / Vite local dev |
| [../.env.docker.example](../.env.docker.example) | Docker Compose (copy → `.env.local`) |
| [../relayer/.env.example](../relayer/.env.example) | Optional local relayer profile |

## Non-doc assets

Untracked `.tmp-build-review/images/*` are **build-review artifacts**, not documentation. The only in-app doc image is `public/assets/images/medvault_fhe_hero.png` (referenced from `/docs` introduction).
