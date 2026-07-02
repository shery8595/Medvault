# Verification snapshot

Recorded after MedVault parity improvements (IERC7984, Docker Compose, internal-docs). Test counts reconciled in Plan 08 (June 2026).

| Item | Result |
|------|--------|
| **Date** | 2026-06-30 |
| **Node** | 20+ (see `package.json` engines) |
| **Network** | Ethereum Sepolia (`11155111`) — redeploy required for IERC7984 cETH |

## Parity workstreams completed

| Workstream | Deliverable |
|------------|-------------|
| WS1 ERC-7984 | `ConfidentialETH7984.sol` (OZ `ERC7984`), deps `@openzeppelin/confidential-contracts ^0.5.1`, `@openzeppelin/contracts ^5.6.1` |
| WS2 Docker | `Dockerfile`, `relayer/Dockerfile`, `docker-compose.yml`, `.env.docker.example`, `docs/LOCAL_DEVELOPMENT.md`, `npm run docker:smoke` |
| WS3 Docs | `internal-docs/` (SRS, DFD, threat model, Zama guide, architecture) |

## Commands run

```bash
npm install
npm run compile
npm test
npm run sync-abis
npm run sync-sdk-assets
```

## Test results (current — Plan 08)

| Suite | Command | Passing | Skipped / notes |
|-------|---------|---------|-----------------|
| Default suite | `npm test` | **483** | 4 permanent `it.skip` + 2 conditional (SDD-01, LEG-01); fuzz/fork/Honk excluded |
| Unit + smoke + staking | `npm run test:unit` | **395** | 6 pending (4 permanent `it.skip` + 2 conditional: SDD-01, INFO-2) |
| Integration | `npm run test:integration` | **85** | incl. AI-*, IDX-*, HYB-01, AAC-*, RDV-* |
| Crypto nullifier | `npm run test:crypto` | **3** | — |
| Vitest (frontend lib) | `npm run test:frontend` | **13** | 3 files |
| SDK node:test | `npm run test -w @medvault/sdk` | **11** | MCP workflow |
| IERC7984 conformance | `CET-13`, `CET-14` | included | metadata + operator model |

**Inventory:** 96 TypeScript test files, ~2,020 registered cases (incl. 832 ECM parametric), 76 Hardhat files in default suite, 0 Foundry tests, 19 `test-support/` helpers.

## CI (4 workflows)

| Workflow | Jobs | Runs | Does **not** run |
|----------|------|------|------------------|
| `contracts-test.yml` | test, fork, coverage | `test:unit`, `test:integration`, `test:crypto`, `test:fuzz`, `test:fork`, `test:coverage:gate` | `npm test`, `test:honk` |
| `frontend.yml` | build | `test:frontend` (Vitest) | Hardhat |
| `docker-smoke.yml` | smoke | `docker:smoke` | — |
| `mcp.yml` | mcp | SDK `node:test`, MCP smoke | `@medvault/core` tests (unwired) |

## Coverage gate

`npm run test:coverage:gate` — **≥85% statement** on `PatientDocumentStore`, `MedVaultAutomation`, `AnonymousPatientRegistry`, `ConfidentialETH7984` (`COVERAGE_MIN_PCT` override via `scripts/check-coverage-gate.mjs`). No Vitest/SDK coverage config.

## Build results

| Target | Command | Status |
|--------|---------|--------|
| Solidity compile | `npm run compile` | Success (ConfidentialETH7984 + alias) |
| Docker smoke | `npm run docker:smoke` | Manual — requires Docker daemon |

## GLM 5.2 final review (2026-06-27)

| Area | Result |
|------|--------|
| Contract correctness | `ConfidentialETH7984` extends OZ ERC7984; MedVault extensions preserved; StakingManager/SponsorIncentiveVault ABI unchanged |
| Off-chain parity | ABIs synced (frontend, medvault-core, subgraph); deploy uses `ConfidentialETH7984` under `ConfidentialETH` key |
| Docker | Dockerfile + compose + smoke script present; manual smoke requires Docker daemon |
| Docs | `internal-docs/` consistent with IERC7984 flows |
| Test integrity | **483 passing** (395 unit + 85 integration + 3 crypto; verified 2026-07-02), 6 unit pending; CET-13/14 IERC7984 conformance |

**Findings:** No blocking issues. Low-severity pre-existing notes (withdraw-time balance drift without lock, minor observability gaps) — accepted as-is; not introduced by parity work.

## Workstream Audit Log

| Gate | Workstream | Verdict | Date | Notes |
|------|------------|---------|------|-------|
| 0a | Plan 00a — Existing Bug Fixes (Contracts) | PASS | 2026-06-29 | GLM 5.2 high audit PASS. *Historical snapshot:* 290 passing, 5 pending (incl. SDD-01 opt-in). |
| 0b | Plan 00b — Existing Bug Fixes (Off-chain + Hardening) | PASS | 2026-06-29 | GLM 5.2 high audit PASS. *Historical snapshot:* 293 passing, 5 pending. |
| 1 | Plan 01 — PatientDocumentStore contract + hybrid crypto | PASS | 2026-06-29 | GLM 5.2 high audit PASS. PDS-01–05 unit coverage. |
| 2 | Plan 02 — ERC-7984 standard receiver | PASS | 2026-06-29 | *Historical snapshot:* 299 passing, 5 pending. |
| 3 | Plan 03 — HCU cache + silent failure + zero-revelation + early fuzz | PASS | 2026-06-29 | *Historical snapshot:* ~300+ unit, 82 fuzz (runs:64 eligibility). |
| 4 | Plan 04 — Single-transaction atomic flows | PASS | 2026-06-29 | *Historical snapshot:* 311 passing, 5 pending. |
| 5 | Plan 05 — Hybrid document storage E2E | PASS | 2026-06-29 | `hybrid-storage.e2e.test.ts`, document binding attestation tests. |
| 5b | Plan 05b — Hybrid document UI wiring | PASS | 2026-06-29 | Vitest upload tests + HYB-01 integration. |
| 6 | Plan 06 — Off-Chain Indexer | PASS | 2026-06-29 | IDX-01–05 integration tests passing. |
| 7 | Plan 07 — OpenAI AI pre-screening + PHI redaction | PASS | 2026-06-29 | `ai-criteria-roundtrip` tests. |
| 8 | Plan 08 — Final QA Expansion | PASS | 2026-06-29 | *Historical snapshot at merge:* registered matrix expanding toward ~1,908 cases (fuzz runs:256). CI: fuzz, fork, coverage gate, frontend, docker-smoke. Default suite grew **348 → 428** — see `docsStats`. |
| 9 | Phase 1 — Plaintext trial criteria gate (crypto fix) | PASS | 2026-07-01 | `TrialManager.createTrial` gated to chainid 31337; SDK `createTrialEncrypted` + MCP route to encrypted path on non-Hardhat. Tests: LEG-01..04 (LEG-01 conditional on `SEPOLIA_RPC_URL`). Default suite **348 → 351** (historical). Phase 2 (Noir-FHE binding) deferred — Zama SDK exposes a `FHE.checkSignatures` proof only via public decrypt, not user decrypt. |
| 10 | Phase 3 — Forward-only document revocation (crypto fix) | PASS | 2026-07-01 | `PatientDocumentStore` epoch gating + `rotateDocument` / `DocumentLegacyHandleRevoked`; sponsor UI revoke/rotate. Tests: ACL-01..05. Default suite **351 → 356**. |
| 11 | Phase 4 — No public sufficiency boolean (crypto fix) | PASS | 2026-07-01 | `FHE.select` transferable path; EIP-712 v2; single-step completion; subgraph v0.2.0. Tests: SUF-01..07 (incl. staking insufficient). Default suite **356 → 369** (incl. Plan 07 AI). Sepolia redeploy of cETH + StakingManager required for production cutover. |
| 12 | Phase 0 — Trust-gap disclosure + relayer re-decrypt (P0.2 interim) | PASS | 2026-07-01 | Honest Limitations & Trust Model in README/LIGHTPAPER/VISION/SecurityModelDoc. `relayFinalize` user-decrypts staged `finalCt` via `@zama-fhe/sdk` and ignores client `eligible`. Relayer transparency (`GET /transparency`, `server.js` sha256, logging policy). Tests: RDV-01..05, P0-2 in remediation-vuln-fixes. P0.2 remains defense-in-depth; structural fix (P2) shipped — see row 13. |
| 13 | Phase 2 — FHE.select payout gating (crypto fix) | PASS | 2026-07-01 | `SponsorIncentiveVault._gatedRewardUnits` — `FHE.select(eligible, units, 0)` on screening (milestone 0) and milestone > 0. Forged audit flags cannot authorize payout. Tests: P2-01..04, P5-SELECT-01/02. |
| 14 | Phase 5 — Formal verification + differential testing | PASS | 2026-07-01 | Certora/Halmos blocked on fhEVM `FHE.*` → differential fallbacks PASS. [certora-halmos-results.md](./formal-verification/certora-halmos-results.md). Harness: `comparePlaintextVsEncryptedEligibility`. Tests: P1–P3 PROP, DIFF-03, P5-SELECT, RDV-01..05, BIND-01. Default suite **369 → 401 → 428** (stale-test sweep). |
| 15 | EIP-170 contract shrink + clean Sepolia redeploy | PASS | 2026-07-01 | `EligibilityComputeLib`, `VaultDistributionLib`, `VaultConfidentialLib`; Poseidon moved to `AnonymousPatientRegistryTestHarness`; EE/Vault test harnesses on Hardhat. Sepolia addresses + subgraph **v0.2.0**. Default suite **428** re-verified (341 + 84 + 3); integration assertions updated for vault custom errors. Run `scripts/finish-wiring.ts` after 2-day timelocks. |
| 16 | Medium findings closeout + full suite re-run | PASS | 2026-07-02 | [MEDIUM_FINDINGS_CLOSEOUT.md](./MEDIUM_FINDINGS_CLOSEOUT.md): M-AUDIT-1 resolved (auditor zero-address guard + SRA-01–05); M-SILENT-1 Informational; M-REGCON-1 Low/SDK-blocked. Default suite **483** (395 + 85 + 3), 6 unit pending. `docsStats` + TEST_MATRIX + in-app docs synced. |

## Plan 08 fuzz model

Fuzz is **Mocha `for` loops**, not Foundry. `fuzz.runs: 256` in `hardhat.config.ts`.

| Generator | Cases |
|-----------|-------|
| `edge-case-parametric` | 832 |
| `gas-stress-fuzz` | 288 |
| `reward-distribution-fuzz` | 256 |
| `eligibility-fuzz` | 256 |
| `criteria-bounds` | 256 |

## Notes

- Deploy script uses `ConfidentialETH7984` factory; addresses.json key remains `ConfidentialETH`.
- Frontend/SDK ABI synced from `ConfidentialETH7984.json` artifact.
- Sepolia redeploy required for on-chain IERC7984 cETH.
- `@medvault/core` tests exist but are not CI-wired (engineering gap).
