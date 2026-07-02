# Software Requirements Specification (SRS)

## 1. Purpose

MedVault is a privacy-preserving clinical trial matching and incentive protocol on Ethereum Sepolia using Zama fhEVM (FHE), Semaphore anonymous identity, and Noir/Honk attestation.

## 2. Actors

| Actor | Role |
|-------|------|
| Patient | Registers encrypted profile, applies to trials anonymously, claims rewards, withdraws privately |
| Sponsor | Verified via `SponsorRegistry`; creates trials, funds incentives, releases milestones |
| Relayer | Gasless registration/apply; completes KMS-gated withdraw-to and public exit |
| Automation | Chainlink Automation finalizes expired trials |
| Protocol owner | Timelocked wiring, sponsor verification, emergency controls |

## 3. Functional requirements

### FR-1 Patient registration
- Patient encrypts vitals in browser (`@zama-fhe/sdk`) and registers via `MedVaultRegistry` or relayer path.
- Semaphore commitment stored in `AnonymousPatientRegistry`.

### FR-2 Sponsor trial creation
- Verified sponsor creates trial with public metadata and encrypted eligibility criteria in `TrialManager`.

### FR-3 Anonymous apply
- Patient proves Semaphore membership and submits encrypted eligibility staging to `EligibilityEngine`.
- Optional Noir attestation binds staged FHE handle hash.

### FR-4 Incentive funding and distribution
- Sponsor funds trial via native ETH → `SponsorIncentiveVault` (cETH credits via `ConfidentialETH7984`).
- Milestone-gated distribution; screening auto-pay on trial end via automation.

### FR-5 Private claim and withdraw
- Patient authorizes claim via EIP-712; vault calls `requestWithdrawTo` on IERC7984 cETH wrapper.
- Relayer completes KMS reveal + `completeWithdrawTo` to destination.

### FR-6 Confidential staking (optional)
- `StakingManager` locks cETH balance and transfers encrypted stake to Aave integration.

## 4. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Patient health fields never stored as plaintext on-chain |
| NFR-2 | cETH implements OpenZeppelin **IERC7984** (`ConfidentialETH7984`) |
| NFR-3 | Cross-contract wiring changes use 2-day timelock on live networks |
| NFR-4 | Test suite (`npm test`) passes on Hardhat FHE mocks |
| NFR-5 | Demo runnable via `docker compose up --build` (Sepolia-first) — see [docs/DOCKER.md](../docs/DOCKER.md) |

## 5. Out of scope (current)

- Per-trial vault clone factory (singleton `SponsorIncentiveVault` with `trialId` pools).
- Local fhEVM node in Docker (uses hosted Zama relayer on Sepolia).

## 6. Documentation map

| Topic | Document |
|-------|----------|
| Docker Compose | [docs/DOCKER.md](../docs/DOCKER.md) |
| IERC7984 cETH | [docs/ERC7984_CONFIDENTIAL_TOKEN.md](../docs/ERC7984_CONFIDENTIAL_TOKEN.md) |
| Private withdrawals | [docs/PRIVATE_WITHDRAWALS.md](../docs/PRIVATE_WITHDRAWALS.md) |
| Test matrix | [docs/TEST_MATRIX.md](../docs/TEST_MATRIX.md) |
