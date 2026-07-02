# Testing Guide — MedVault Smart Contracts

MedVault uses **Hardhat 2**, **Mocha/Chai** (120s timeout), and **@fhevm/hardhat-plugin** (Zama FHE local mocks) for Solidity tests. There are **0 Foundry/Solidity test contracts** — the five files in `contracts/test/` are helpers/mocks only.

**Inventory (canonical — `src/lib/docsStats.ts`, verified 2026-07-02):** **87** Hardhat test files under `test/` (**76** in default `npm test`), **~2,020** registered cases (incl. **832** parametric ECM matrix), **19** `test-support/` helpers. The default suite has **483 passing** cases (**395** unit + **85** integration + **3** crypto; **6** unit pending: **4** permanent `it.skip`, **2** conditional when `RUN_LARGE_POOL_TEST` unset; **1** optional Honk), including timelock wiring, IERC7984 conformance (CET-13/14), hybrid document storage, trust-gap payout gating, sponsor-registry auditor (SRA-*), and Phase 5 differential eligibility tests.

Additional runners: **Vitest 3.x** (3 files, 13 cases in `src/lib/__tests__/`), **node:test** (SDK: 3 files / 11 cases; core: 1 file / 3 cases — **not CI-wired**).

In-app documentation: open the dapp **Docs → Tests & verification** tab (`/docs/testing`).

## Repository layout

```
test/                       # 76 Hardhat files in default suite: unit 61 (59+smoke+staking), integration 14, fuzz 5, invariants 2, crypto 2, fork 1
  smoke/                    # Zama FHE + deployMedVaultStack (4 cases)
  unit/                     # Per-contract tests (incl. timelock-wiring, PDS, HCU, v0.9, trust-gap, Phase 5)
  integration/              # Cross-contract + named E2E (e2e-patient-to-claim, hybrid-storage.e2e)
  fuzz/                     # Mocha for-loop generators (not Foundry vm.assume)
  invariants/               # Token + PatientDocumentStore invariants
  fork/                     # Sepolia fork (conditional on SEPOLIA_RPC_URL)
  staking/                  # StakingManager + MockAave (8 cases)
  crypto/                   # Nullifier alignment + Honk (3 + 1 optional)

test-support/               # 19 shared helper modules (imported by tests, not executed as tests)
  deployments.ts            # deployMedVaultStack() with full timelock wiring
  timelock.ts               # scheduleAndApply, advanceTimelock, authorizeCethContract
  fhe.ts                    # Zama FHE encryption + mock decrypt (hre.fhevm)
  journey.ts                # Stage/finalize/claim journey helpers
  withdraw.ts               # buildWithdrawToAuthorization, claimParticipantRewardsTx
  vaultEip712.ts            # Claim EIP-712 with encryptedAmountCommitment
  consent.ts                # grantConsent overload disambiguation
  signers.ts                # impersonateAccount()
  semaphore.ts              # MockSemaphore proofs, nullifiers
  assertions.ts               # expectRevert
  constants.ts
  fixtures/profiles.ts      # ELIGIBLE_PROFILE, PROFILE_FAIL_*

src/lib/__tests__/          # Vitest (3 files, 13 cases)
packages/medvault-sdk/tests/    # node:test (3 files, 11 cases)
packages/medvault-core/tests/   # node:test (1 file, 3 cases; no test script — gap)

scripts/
  hardhat-test-suite.mjs    # Suite runner (Windows-safe file globs)
  check-coverage-gate.mjs   # ≥85% statement gate on 4 contracts

docs/
  TESTING_GUIDE.md          # This file
  TEST_MATRIX.md            # Case ID catalog
```

**Do not run** legacy files at the repo root of `test/` (e.g. `comprehensive_medvault.test.js`) — they are retired.

**E2E:** No Playwright/Cypress. Named E2E flows (`e2e-patient-to-claim`, `hybrid-storage.e2e`) are Hardhat integration tests.

## Requirements

- Node.js **20+**
- `npm ci`
- `npm run compile`

## Commands

| Script | What runs |
|--------|-----------|
| `npm run compile` | Compile contracts (required first) |
| `npm test` | Default: smoke + unit + staking + integration + nullifier crypto (**483** = 395 + 85 + 3) |
| `npm run test:unit` | `test/smoke/**`, `test/unit/**`, `test/staking/**` (**395 passing**, 6 pending) |
| `npm run test:integration` | `test/integration/**` (**85 passing**) |
| `npm run test:crypto` | `test/crypto/noir-nullifier.test.ts` (3 cases) |
| `npm run test:fuzz` | `test/fuzz/**` + `test/invariants/**` (Mocha loops; separate CI job) |
| `npm run test:fork` | `test/fork/**` (requires `SEPOLIA_RPC_URL`; separate CI job) |
| `npm run test:honk` | `test/crypto/honk-pipeline.test.ts` (~3–5 min; **not in CI**) |
| `npm run test:coverage` | solidity-coverage report |
| `npm run test:coverage:gate` | Coverage + ≥85% statement gate (see below) |
| `npm run test:frontend` | Vitest 3.x (3 files, 13 cases) |
| `npm run docker:smoke` | Docker Compose frontend health check (requires Docker) |

Implementation: `node scripts/hardhat-test-suite.mjs <suite>` resolves files with `glob` (works on Windows).

## Fuzz model

Fuzz is implemented as **Mocha `for` loops**, not Foundry `vm.assume`. `hardhat.config.ts` sets `fuzz.runs: 256`.

| Generator | Registered cases (at `fuzz.runs: 256`) |
|-----------|----------------------------------------|
| `edge-case-parametric.test.ts` | 832 (20×10×4 ECM matrix) |
| `gas-stress-fuzz.test.ts` | 288 (256 deposit cycles + 32 vault loops) |
| `reward-distribution-fuzz.test.ts` | 256 |
| `eligibility-fuzz.test.ts` | 256 |
| `criteria-bounds.test.ts` | 256 |

## CI

Four GitHub Actions workflows (no CD workflow):

| Workflow | Runs | Does **not** run |
|----------|------|------------------|
| `contracts-test.yml` | `test:unit`, `test:integration`, `test:crypto`, `test:fuzz`, `test:fork`, `test:coverage:gate` | `npm test` aggregate, `test:honk` |
| `frontend.yml` | `tsc`, `build:prebuilt`, `test:frontend` (Vitest) | Hardhat suites |
| `docker-smoke.yml` | `docker:smoke` | — |
| `mcp.yml` | `mcp:build`, `mcp:smoke`, SDK `node:test` | `@medvault/core` tests (unwired) |

Honk is excluded from CI (circuit build + runtime). Run locally after `npm run build:circuit`.

## Coverage gate

`npm run test:coverage:gate` enforces **≥85% statement** coverage on:

- `PatientDocumentStore.sol`
- `MedVaultAutomation.sol`
- `AnonymousPatientRegistry.sol`
- `ConfidentialETH7984.sol`

Override threshold via `COVERAGE_MIN_PCT`. Script: `scripts/check-coverage-gate.mjs`. No Vitest or SDK coverage config.

## Shared fixture: `deployMedVaultStack()`

`test-support/deployments.ts` deploys and wires the full stack, including **timelocked** cross-contract references via `test-support/timelock.ts` (`scheduleAndApply` fast-forwards 6 hours on Hardhat):

- `DataAccessLog`, `ConsentManager`, `SponsorRegistry`, `TrialManager`
- `AnonymousPatientRegistry`, `HonkVerifier`, `EligibilityEngine`
- `EncryptedConsentGate`, `EncryptedScoreLeaderboard`
- `MockSemaphore`, `MedVaultRegistry`
- `ConfidentialETH`, `TrialMilestoneManager`, `SponsorIncentiveVault`, `MedVaultAutomation`

Also calls `consentManager.setEligibilityEngine`, schedules logger auth on `DataAccessLog`, and pre-approves `stack.sponsor` for trials on Hardhat (chain id 31337).

Signers: `owner`, `patient`, `sponsor`, `sponsor2`, `stranger`.

## Timelock tests (TL-01–TL-06)

`test/unit/timelock-wiring.test.ts` verifies:

- Instant setters revert with "Use schedule…" messages
- `schedule*` cannot `apply` before delay
- `deployMedVaultStack()` wires automation, engine readers, and cETH vault auth end-to-end
- `requestWithdrawTo` requires valid user EIP-712 signature (TL-05)
- MH-1: fresh APR rejects registration without engine (TL-04)

## FHE helpers (Zama fhEVM)

`test-support/fhe.ts` uses **`hre.fhevm`** from `@fhevm/hardhat-plugin` (mock network only).

| Call site | `proofAccount` in encrypt helper |
|-----------|----------------------------------|
| `MedVaultRegistry.registerPatient` → APR | MedVaultRegistry address; pass `profileSaltCommitment` from `test-support/profileCommitment.ts` |
| `SponsorRegistry.requestSponsorship` | Sponsor EOA |
| `ConsentManager.grantConsent` | Patient EOA |
| `claimParticipantRewards` → `requestWithdrawTo` | SponsorIncentiveVault address |

Integration helpers: `test-support/journey.ts` (`claimAndCompleteRewards` includes withdraw-to sigs). Pull-claim tests use `test-support/claimReceipt.ts` (`confirmStagedReceipt`) before claim in `sponsor-incentive-vault-claim-prune.test.ts` (P01-01..05). Anonymous apply **finalize** and **cancel** must use `stack.relayer` (`onlyTrustedRelayer`); patient EOA calls revert. Registration uses `registerPatientOnRegistry` with `randomProfileSalt()` from `test-support/profileCommitment.ts`.

## Consent in tests

Use `grantConsentLegacy` / `grantConsentEncrypted` from `test-support/consent.ts` to avoid ethers v6 overload ambiguity.

## Contract callers

When the caller must be a contract (e.g. vault completing withdraw-to):

```typescript
import { impersonateAccount } from "../../test-support/signers";
const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
await stack.confidentialETH.connect(vaultSigner).completeWithdrawTo(user, amountProof);
```

## Trust-gap & Phase 5 tests (rows 12–14)

Shipped trust-gap remediation and formal/differential fallbacks. Evidence: [formal-verification/certora-halmos-results.md](./formal-verification/certora-halmos-results.md).

| File | IDs | What it proves |
|------|-----|----------------|
| `test/unit/sponsor-incentive-vault-payout.test.ts` | P2-01..04, P5-SELECT-01/02 | `FHE.select` payout gating — decrypted payout delta is zero iff decrypted eligibility is false (screening + milestone > 0) |
| `test/integration/relayer-decrypt-verify.test.ts` | RDV-01–05 | Relayer re-decrypts staged `finalCt` and ignores forged client `eligible` (defense-in-depth) |
| `test/unit/formal-eligibility-properties.test.ts` | P1–P3 PROP | Differential properties: score monotonicity, conjunction, bounded score |
| `test/unit/encrypted-criteria.test.ts` | DIFF-03 | Plaintext vs encrypted criteria oracle via `comparePlaintextVsEncryptedEligibility` |
| `test/unit/attestation-binding.test.ts` | DIFF-*, BIND-01–04 | Noir attestation ↔ FHE stage binding |

```bash
# Phase 5 differential subset (26 cases)
npx hardhat test \
  test/unit/formal-eligibility-properties.test.ts \
  test/unit/encrypted-criteria.test.ts \
  test/unit/sponsor-incentive-vault-payout.test.ts \
  test/integration/relayer-decrypt-verify.test.ts \
  --grep "DIFF-03|P2-PROP|P1-PROP|P3-PROP|P5-SELECT|RDV-"
```

## Skipped / pending tests

| ID | Reason |
|----|--------|
| EE-11, EE-12 | Permanent `it.skip` — public `verifyEligibilityProof` API removed |
| TM-03 | Permanent `it.skip` — requires `hardhat_setChainId` (not on default provider) |
| SIV-10 | Permanent `it.skip` — reclaim edge case pending refinement |
| SDD-01 | Conditional — skipped unless `RUN_LARGE_POOL_TEST=1` |
| SF-01–04 | Conditional — entire fork suite skipped unless `SEPOLIA_RPC_URL` is set |
| CRYPTO-HONK-01 | Optional; excluded from `npm test` |

## Engineering gap

`packages/medvault-core/tests/resolveNetworkKey.test.ts` (3 cases) has **no `test` script** in `packages/medvault-core/package.json` and is **not CI-wired**. Wire separately.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `InvalidSigner` | Wrong `proofAccount` in encrypt helper |
| `Use scheduleAutomationContract` | Use `scheduleAndApply` or `deployMedVaultStack()` |
| `Invalid withdraw-to signature` | Call `buildWithdrawToAuthorization` before `requestWithdrawTo` |
| `contract runner does not support sending transactions` | Use `impersonateAccount`, not `.connect(contractInstance)` |
| `ambiguous function description` for `grantConsent` | Use `test-support/consent.ts` helpers |
| Honk fails | `npm run build:circuit`; need `src/lib/circuits/eligibility_plaintext.json` and `eligibility_encrypted.json` |

## Remote networks

Default tests use **Hardhat + Zama FHE mocks**. Ethereum Sepolia is for deploy scripts and the Vite app, not the default CI path. Live deploy wiring: [TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md).

See also [TEST_MATRIX.md](./TEST_MATRIX.md) for every case ID.
