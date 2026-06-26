# Testing Guide — MedVault Smart Contracts

MedVault uses **Hardhat 2**, **Mocha/Chai**, and **@fhevm/hardhat-plugin** (Zama FHE local mocks) for Solidity tests. The default suite has **259+ passing** cases (+ **2 pending**, **1 optional** Honk), including unit/smoke/staking, integration (v0.9 complete flow), encrypted withdrawal/public-exit tests (`test/unit/public-exit.test.ts`, `test/unit/batch-exit-queue.test.ts`), attestation binding, direct-apply FHE stage binding (`test/unit/direct-apply-fhe-stage.test.ts`), and crypto nullifier tests.

In-app documentation: open the dapp **Docs → Tests & verification** tab (`/docs/testing`).

## Repository layout

```
test/
  smoke/                    # Zama FHE + deployMedVaultStack (4 cases)
  unit/                     # Per-contract tests (170+ cases)
  integration/              # Cross-contract + E2E (62 cases)
  staking/                  # StakingManager + MockAave (8 cases)
  crypto/                   # Nullifier alignment + Honk (3 + 1 optional)

test-support/               # Shared helpers (imported by tests, not executed as tests)
  deployments.ts            # deployMedVaultStack(), registerPatientOnRegistry()
  fhe.ts                    # Zama FHE encryption + mock decrypt (hre.fhevm)
  journey.ts                # Stage/finalize/claim journey helpers
  consent.ts                # grantConsent overload disambiguation
  signers.ts                # impersonateAccount()
  semaphore.ts              # MockSemaphore proofs, nullifiers
  assertions.ts             # expectRevert
  constants.ts
  fixtures/profiles.ts      # ELIGIBLE_PROFILE, PROFILE_FAIL_*

scripts/
  hardhat-test-suite.mjs    # Suite runner (Windows-safe file globs)

docs/
  TESTING_GUIDE.md          # This file
  TEST_MATRIX.md            # Case ID catalog
  PRIVATE_WITHDRAWALS.md    # Encrypted withdraw + public exit architecture
```

**Do not run** legacy files at the repo root of `test/` (e.g. `comprehensive_medvault.test.js`) — they are retired.

## Requirements

- Node.js **20+**
- `npm ci`
- `npm run compile`

## Commands

| Script | What runs |
|--------|-----------|
| `npm run compile` | Compile contracts (required first) |
| `npm test` | Default: smoke + unit + staking + integration + nullifier crypto |
| `npm run test:unit` | `test/smoke/**`, `test/unit/**`, `test/staking/**` |
| `npm run test:integration` | `test/integration/**` |
| `npm run test:crypto` | `test/crypto/noir-nullifier.test.ts` |
| `npm run test:honk` | `test/crypto/honk-pipeline.test.ts` (~3–5 min) |
| `npm run test:coverage` | `solidity-coverage` report |

Implementation: `node scripts/hardhat-test-suite.mjs <suite>` resolves files with `glob` (works on Windows).

## CI

GitHub Actions: `.github/workflows/contracts-test.yml`

1. `npm ci`
2. `npm run compile`
3. `npm run test:unit`
4. `npm run test:integration`
5. `npm run test:crypto`

Honk is excluded from CI (circuit build + runtime). Run locally after `npm run build:circuit`.

## Shared fixture: `deployMedVaultStack()`

`test-support/deployments.ts` deploys and wires:

- `DataAccessLog`, `ConsentManager`, `SponsorRegistry`, `TrialManager`
- `AnonymousPatientRegistry`, `HonkVerifier`, `EligibilityEngine`
- `EncryptedConsentGate`, `EncryptedScoreLeaderboard`
- `MockSemaphore`, `MedVaultRegistry`
- `ConfidentialETH`, `TrialMilestoneManager`, `SponsorIncentiveVault`, `MedVaultAutomation`

Also calls `consentManager.setEligibilityEngine`, authorizes loggers on `DataAccessLog`, and pre-approves `stack.sponsor` for trials on Hardhat (chain id 31337).

Signers: `owner`, `patient`, `sponsor`, `sponsor2`, `stranger`.

## FHE helpers (Zama fhEVM)

`test-support/fhe.ts` uses **`hre.fhevm`** from `@fhevm/hardhat-plugin` (mock network only).

```typescript
import hre from "hardhat";

assertFhevmMock(); // hre.fhevm.isMock === true

const input = hre.fhevm.createEncryptedInput(contractAddress, userAddress);
input.add8(BigInt(age));
const encrypted = await input.encrypt();
// encrypted.handles[0], encrypted.inputProof → contract call

// Decrypt in tests (never on production eligibility path)
await hre.fhevm.userDecryptEuint(FhevmType.euint8, handle, contract, user);
```

| Call site | `userAddress` in `createEncryptedInput` |
|-----------|----------------------------------------|
| `MedVaultRegistry.registerPatient` → APR | Patient EOA |
| `SponsorRegistry.requestSponsorship` | Sponsor EOA |
| `ConsentManager.grantConsent` | Patient EOA |

Integration helpers: `test-support/journey.ts` (`stageSemaphoreApply`, `claimAndCompleteRewards`, etc.).

## Consent in tests

Use `grantConsentLegacy` / `grantConsentEncrypted` from `test-support/consent.ts` to avoid ethers v6 overload ambiguity.

## Contract callers

When the caller must be a contract (e.g. registry staging eligibility):

```typescript
import { impersonateAccount } from "../../test-support/signers";
const signer = await impersonateAccount(await stack.medVaultRegistry.getAddress());
await stack.eligibilityEngine.connect(signer).stageAnonymousEligibility(...);
```

## Skipped tests

| ID | Reason |
|----|--------|
| TM-03 | Requires `hardhat_setChainId` (not on default Hardhat provider) |
| SIV-10 | Reclaim fixture needs refinement |
| CRYPTO-HONK-01 | Optional; excluded from `npm test` |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `InvalidSigner` | Wrong `proofAccount` in encrypt helper |
| `contract runner does not support sending transactions` | Use `impersonateAccount`, not `.connect(contractInstance)` |
| `ambiguous function description` for `grantConsent` | Use `test-support/consent.ts` helpers |
| Honk fails | `npm run build:circuit`; need `src/lib/circuits/eligibility_proof.json` |
| Module not found for `test-support` | Ensure `ts-node` CommonJS register in `hardhat.config.ts` |

## Remote networks

Default tests use **Hardhat + Zama FHE mocks**. Ethereum Sepolia is for deploy scripts and the Vite app, not CI.

See also [TEST_MATRIX.md](./TEST_MATRIX.md) for every case ID.
