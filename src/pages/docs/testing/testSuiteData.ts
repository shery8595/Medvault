/**
 * Shared facts for the in-app Testing documentation section.
 * Counts sourced from `src/lib/docsStats.ts` (Plan 00 manifest) and verified via `npm test` (June 2026).
 * Keep in sync with `docs/TEST_MATRIX.md` and `docs/TESTING_GUIDE.md`.
 */
import { REPO_STATS } from "../../../lib/docsStats";
/** Repository-wide test inventory (manifest). */
export const TEST_MANIFEST = {
    testFilesTotal: REPO_STATS.testFiles,
    hardhatTestFiles: 77,
    vitestFiles: 3,
    vitestCases: 13,
    nodeTestFiles: 4,
    nodeTestCases: 14,
    sdkNodeTestFiles: 3,
    sdkNodeTestCases: 11,
    coreNodeTestFiles: 1,
    coreNodeTestCases: 3,
    coreTestsCiWired: false,
    foundryTestContracts: 0,
    testHelperFiles: 19,
    testCasesRegistered: REPO_STATS.testCasesRegistered,
    testCasesParametricFuzz: REPO_STATS.testCasesParametricFuzz,
    testCasesLiteral: REPO_STATS.testCasesLiteral,
} as const;
/** Hardhat `test/` file counts by directory (not case counts). */
export const HARDHAT_FILE_COUNTS = {
    unit: 62,
    integration: 14,
    fuzz: 5,
    invariants: 2,
    crypto: 2,
    fork: 1,
    smoke: 1,
    staking: 1,
} as const;
/** Mocha `for`-loop fuzz generators (`hardhat.config.ts` `fuzz.runs: 256`). Not Foundry `vm.assume`. */
export const FUZZ_GENERATORS = [
    { file: "test/fuzz/edge-case-parametric.test.ts", cases: 832, ids: "ECM-*" },
    { file: "test/fuzz/gas-stress-fuzz.test.ts", cases: 288, ids: "GAS-FUZZ-*" },
    { file: "test/fuzz/reward-distribution-fuzz.test.ts", cases: 256, ids: "ZR-FUZZ-*" },
    { file: "test/fuzz/eligibility-fuzz.test.ts", cases: 256, ids: "ELIG-FUZZ-*" },
    { file: "test/fuzz/criteria-bounds.test.ts", cases: 256, ids: "CRIT-FUZZ-*" },
] as const;
export const SUITE_STATS = {
    totalPassing: REPO_STATS.testSuiteDefaultPassing,
    unitPassing: REPO_STATS.testSuiteUnitPassing,
    integrationPassing: REPO_STATS.testSuiteIntegrationPassing,
    cryptoPassing: REPO_STATS.testSuiteCryptoPassing,
    honkPassing: 1,
    skippedPermanent: 4,
    skippedConditional: 2,
    skippedForkSuite: 4,
    unitPending: REPO_STATS.testSuiteUnitPending,
    lastVerified: "2026-07-04 (dual relayer + relayer-adversarial REL-* suite)",
} as const;
export const NPM_SCRIPTS = [
    { cmd: "npm run compile", desc: "Compile Solidity (required before tests)" },
    {
        cmd: "npm test",
        desc: `Default suite: smoke + unit + staking + integration + nullifier crypto (${SUITE_STATS.totalPassing} passing; excludes fuzz/fork/Honk)`,
    },
    { cmd: "npm run test:unit", desc: `Smoke, all unit tests, and StakingManager tests (${SUITE_STATS.unitPassing} passing)` },
    { cmd: "npm run test:integration", desc: `Cross-contract and E2E integration flows (${SUITE_STATS.integrationPassing} passing)` },
    { cmd: "npm run test:crypto", desc: `Off-chain Semaphore / Noir nullifier alignment (${SUITE_STATS.cryptoPassing} cases)` },
    { cmd: "npm run test:fuzz", desc: "Mocha loop fuzz + invariant suites (separate CI job)" },
    { cmd: "npm run test:fork", desc: "Sepolia fork tests (requires SEPOLIA_RPC_URL; separate CI job)" },
    { cmd: "npm run test:honk", desc: "Slow UltraHonk pipeline (~3–5 min; not in CI; requires `npm run build:circuit`)" },
    { cmd: "npm run test:coverage", desc: "solidity-coverage report" },
    { cmd: "npm run test:coverage:gate", desc: "Coverage + ≥85% statement gate on 4 named contracts (COVERAGE_MIN_PCT override)" },
    { cmd: "npm run test:frontend", desc: "Vitest 3.x (node env): 3 files, 13 cases" },
    { cmd: "npm run docker:smoke", desc: "Docker Compose frontend health check (requires Docker daemon)" },
] as const;
export const COVERAGE_GATE = {
    minPct: 85,
    envOverride: "COVERAGE_MIN_PCT",
    contracts: [
        "PatientDocumentStore.sol",
        "MedVaultAutomation.sol",
        "AnonymousPatientRegistry.sol",
        "ConfidentialETH7984.sol",
    ],
    script: "scripts/check-coverage-gate.mjs",
    vitestCoverage: false,
    sdkCoverage: false,
} as const;
export const CI_WORKFLOWS = [
    {
        file: ".github/workflows/contracts-test.yml",
        jobs: ["test (unit, integration, crypto, fuzz)", "fork (Sepolia)", "coverage (gate)"],
        runs: ["test:unit", "test:integration", "test:crypto", "test:fuzz", "test:fork", "test:coverage:gate"],
        excludes: ["npm test (default aggregate)", "test:honk"],
    },
    {
        file: ".github/workflows/frontend.yml",
        jobs: ["build (tsc, vite build, Vitest)"],
        runs: ["test:frontend"],
        excludes: [],
    },
    {
        file: ".github/workflows/docker-smoke.yml",
        jobs: ["smoke"],
        runs: ["docker:smoke"],
        excludes: [],
    },
    {
        file: ".github/workflows/mcp.yml",
        jobs: ["mcp (build, validate, smoke, SDK tests)"],
        runs: ["mcp:build", "mcp:smoke", "npm run test -w @medvault/sdk"],
        excludes: ["@medvault/core tests (no test script in package.json)"],
    },
] as const;
export const SKIPPED_TESTS = [
    { id: "EE-11", reason: "Public verifyEligibilityProof API removed (permanent it.skip)" },
    { id: "EE-12", reason: "Public verifyEligibilityProof API removed (permanent it.skip)" },
    { id: "TM-03", reason: "Requires hardhat_setChainId — not on default provider (permanent it.skip)" },
    { id: "SIV-10", reason: "Reclaim edge case pending fixture refinement (permanent it.skip)" },
    { id: "SDD-01", reason: "Large-pool distribution — skipped unless RUN_LARGE_POOL_TEST=1 (conditional)" },
    { id: "SF-01–04", reason: "Entire fork suite skipped unless SEPOLIA_RPC_URL is set (conditional describe.skip)" },
] as const;
export const REPO_LAYOUT = `medvault/
  test/                     # 77 Hardhat/Mocha files in default suite (60 unit + 1 smoke + 1 staking, 14 integration, 5 fuzz, 2 invariants, 2 crypto, 1 fork)
    smoke/                  # Zama fhEVM + deployMedVaultStack (4 cases)
    unit/                   # Per-contract unit tests (incl. relayer-adversarial, p3-relayer-trust-reduction, timelock-wiring, Phase 5)
    integration/            # Cross-contract + named E2E (e2e-patient-to-claim, hybrid-storage.e2e)
    fuzz/                   # Mocha for-loop generators (fuzz.runs: 256 in hardhat.config.ts)
    invariants/             # Token + PatientDocumentStore invariants
    fork/                   # Sepolia fork (conditional on SEPOLIA_RPC_URL)
    staking/                # StakingManager + MockAave (8 cases)
    crypto/                 # Nullifier + Honk pipeline (3 + 1 optional)
  test-support/             # 19 shared helper modules (not executed as tests)
  src/lib/__tests__/        # 3 Vitest files (13 cases)
  packages/medvault-sdk/tests/   # 3 node:test files (11 cases)
  packages/medvault-core/tests/  # 1 node:test file (3 cases; not CI-wired)
  scripts/
    hardhat-test-suite.mjs  # Suite runner (Windows-safe globs)
  docs/
    TESTING_GUIDE.md
    TEST_MATRIX.md`;
export const TEST_FILES: Array<{
    path: string;
    contracts: string;
    cases: number;
    pillar: string;
    ids: string;
}> = [
    { path: "test/smoke/hardhat-fhevm.test.ts", contracts: "Stack", cases: 4, pillar: "Infra", ids: "SMOKE-01–04" },
    { path: "test/unit/ownership.two-step.test.ts", contracts: "12 ownable contracts", cases: 24, pillar: "ACL", ids: "OWN-*-01/02" },
    { path: "test/unit/deprecated-entrypoints.test.ts", contracts: "EE, SIV", cases: 4, pillar: "ACL", ids: "DEP-01–04" },
    { path: "test/unit/timelock-wiring.test.ts", contracts: "TM, EE, cETH, APR", cases: 6, pillar: "ACL", ids: "TL-01–TL-06" },
    { path: "test/unit/trial-plaintext-gate.test.ts", contracts: "TrialManager", cases: 4, pillar: "ACL", ids: "LEG-01–04" },
    { path: "test/unit/document-revoke.test.ts", contracts: "PatientDocumentStore", cases: 4, pillar: "ACL", ids: "ACL-01–04" },
    { path: "test/unit/trial-manager.test.ts", contracts: "TrialManager", cases: 8, pillar: "ACL", ids: "TM-01–08" },
    { path: "test/unit/sponsor-registry.test.ts", contracts: "SponsorRegistry", cases: 10, pillar: "FHE", ids: "SR-01–10" },
    { path: "test/unit/sponsor-registry-auditor.test.ts", contracts: "SponsorRegistry", cases: 5, pillar: "ACL", ids: "SRA-01–05" },
    { path: "test/unit/consent-manager.test.ts", contracts: "ConsentManager", cases: 14, pillar: "FHE", ids: "CM-01–14" },
    { path: "test/unit/data-access-log.test.ts", contracts: "DataAccessLog", cases: 6, pillar: "ACL", ids: "DAL-01–06" },
    { path: "test/unit/anonymous-patient-registry.test.ts", contracts: "AnonymousPatientRegistry", cases: 8, pillar: "FHE", ids: "APR-01–08" },
    { path: "test/unit/confidential-eth.test.ts", contracts: "ConfidentialETH7984", cases: 14, pillar: "FHE/ETH", ids: "CET-01–14" },
    { path: "test/unit/eligibility-engine.test.ts", contracts: "EligibilityEngine", cases: 7, pillar: "FHE", ids: "EE-01–14" },
    { path: "test/unit/formal-eligibility-properties.test.ts", contracts: "EligibilityEngine", cases: 18, pillar: "FHE/Formal", ids: "P1–P3 PROP" },
    { path: "test/unit/encrypted-consent-gate.test.ts", contracts: "EncryptedConsentGate", cases: 8, pillar: "FHE", ids: "ECG-01–08" },
    { path: "test/unit/encrypted-score-leaderboard.test.ts", contracts: "EncryptedScoreLeaderboard", cases: 8, pillar: "FHE", ids: "ESL-01–08" },
    { path: "test/unit/sponsor-incentive-vault.test.ts", contracts: "SponsorIncentiveVault", cases: 18, pillar: "ETH/FHE", ids: "SIV-01–18" },
    { path: "test/unit/sponsor-incentive-vault-payout.test.ts", contracts: "SIV, EE", cases: 8, pillar: "FHE/ZR", ids: "SIV-PAYOUT-01, SIV-DUST-01, P2-01..04, P5-SELECT-01/02" },
    { path: "test/unit/vault-security-fixes.test.ts", contracts: "SIV, cETH", cases: 6, pillar: "ETH/FHE", ids: "VSEC-*, P2/HIGH-1" },
    { path: "test/unit/gasless-claim.test.ts", contracts: "SIV, cETH", cases: 3, pillar: "ETH/FHE", ids: "GCL-*" },
    { path: "test/unit/security-regression.test.ts", contracts: "MVR, EE", cases: 3, pillar: "ACL", ids: "SEC-REG-*" },
    { path: "test/unit/trial-milestone-manager.test.ts", contracts: "TrialMilestoneManager", cases: 6, pillar: "ACL", ids: "TMM-01–06" },
    { path: "test/unit/medvault-automation.test.ts", contracts: "MedVaultAutomation", cases: 6, pillar: "ACL", ids: "MVA-01–06" },
    { path: "test/unit/patient-document-store.test.ts", contracts: "PatientDocumentStore", cases: 5, pillar: "FHE/Hybrid", ids: "PDS-01–05" },
    { path: "test/unit/zero-revelation-rewards.test.ts", contracts: "SIV, cETH", cases: 2, pillar: "FHE/ZR", ids: "ZR-01–02" },
    { path: "test/unit/test-helpers.test.ts", contracts: "cETH, APR", cases: 6, pillar: "Infra", ids: "HCU-01–06" },
    { path: "test/unit/high-concurrency-registrations.test.ts", contracts: "APR", cases: 6, pillar: "FHE", ids: "HCR-*" },
    { path: "test/unit/direct-apply-fhe-stage.test.ts", contracts: "Off-chain", cases: 2, pillar: "FHE", ids: "SEMA-PROOF-01–02" },
    { path: "test/unit/medvault-registry-finalize.test.ts", contracts: "MedVaultRegistry", cases: 6, pillar: "FHE", ids: "MVR-FIN-01–06" },
    { path: "test/unit/v09-proof-of-computation.test.ts", contracts: "cETH, Staking, EE", cases: 18, pillar: "FHE", ids: "SUF-01..07, V09-02..13" },
    { path: "test/unit/public-exit.test.ts", contracts: "ConfidentialETH", cases: 6, pillar: "ETH/FHE", ids: "PEX-01–06" },
    { path: "test/unit/batch-exit-queue.test.ts", contracts: "Relayer (off-chain)", cases: 3, pillar: "Infra", ids: "BEX-01–03" },
    { path: "test/unit/privacy-events.test.ts", contracts: "cETH, SIV, Staking", cases: 7, pillar: "FHE", ids: "PRIV-01–05, SUF-06, ACL-05" },
    { path: "test/unit/apply-wizard.test.ts", contracts: "UI state", cases: 2, pillar: "UI", ids: "UI-APPLY-01–02" },
    { path: "test/unit/attestation-binding.test.ts", contracts: "EligibilityEngine", cases: 6, pillar: "ZK/FHE", ids: "DIFF-*, BIND-01–04" },
    { path: "test/unit/encrypted-criteria.test.ts", contracts: "TrialManager, EE", cases: 4, pillar: "FHE", ids: "ECR-01–03, DIFF-03" },
    { path: "test/unit/encrypted-aggregate.test.ts", contracts: "EncryptedScoreLeaderboard", cases: 1, pillar: "FHE", ids: "AGG-01" },
    { path: "test/fuzz/eligibility-fuzz.test.ts", contracts: "EE, APR", cases: 256, pillar: "FHE", ids: "ELIG-FUZZ-*" },
    { path: "test/fuzz/criteria-bounds.test.ts", contracts: "TrialManager", cases: 256, pillar: "FHE", ids: "CRIT-FUZZ-*" },
    { path: "test/fuzz/reward-distribution-fuzz.test.ts", contracts: "SIV, cETH", cases: 256, pillar: "ZR", ids: "ZR-FUZZ-*" },
    { path: "test/fuzz/gas-stress-fuzz.test.ts", contracts: "cETH, SIV", cases: 288, pillar: "Infra", ids: "GAS-FUZZ-*" },
    { path: "test/fuzz/edge-case-parametric.test.ts", contracts: "EE, APR, cETH", cases: 832, pillar: "FHE", ids: "ECM-*" },
    { path: "test/invariants/token-invariants.test.ts", contracts: "cETH", cases: 2, pillar: "FHE", ids: "TOK-INV-*" },
    { path: "test/invariants/document-store-invariants.test.ts", contracts: "PatientDocumentStore", cases: 19, pillar: "FHE/Hybrid", ids: "PDS-INV-*" },
    { path: "test/fork/sepolia-fork.test.ts", contracts: "Aave, AT", cases: 4, pillar: "Infra", ids: "SF-01–04" },
    { path: "test/integration/medvault-registry.test.ts", contracts: "MedVaultRegistry", cases: 12, pillar: "ZK/FHE", ids: "MVR-01–12" },
    { path: "test/integration/eligibility-anonymous.test.ts", contracts: "EE, MVR, CM", cases: 11, pillar: "FHE", ids: "INT-EE-01–11" },
    { path: "test/integration/consent-gate-flow.test.ts", contracts: "ECG, CM", cases: 4, pillar: "FHE", ids: "CG-INT-01–04" },
    { path: "test/integration/vault-funding-distribution.test.ts", contracts: "SIV, TMM, MVA", cases: 10, pillar: "ETH", ids: "INT-VAULT-01–10" },
    { path: "test/integration/e2e-patient-to-claim.test.ts", contracts: "Full stack", cases: 9, pillar: "E2E", ids: "E2E-01–09" },
    { path: "test/integration/v09-complete-flow.test.ts", contracts: "Full stack v0.9", cases: 16, pillar: "E2E", ids: "FLOW-01–16" },
    { path: "test/integration/batch-eligibility.test.ts", contracts: "EligibilityEngine", cases: 1, pillar: "FHE", ids: "BAT-01" },
    { path: "test/integration/relayer-registration.test.ts", contracts: "MedVaultRegistry", cases: 1, pillar: "Privacy", ids: "REL-REG-01" },
    { path: "test/integration/relayer-decrypt-verify.test.ts", contracts: "MVR, relayer", cases: 5, pillar: "Privacy", ids: "RDV-01–05" },
    { path: "test/unit/p3-relayer-trust-reduction.test.ts", contracts: "MVR, Vault", cases: 5, pillar: "Privacy", ids: "P3-01–P3-05" },
    { path: "test/unit/relayer-adversarial.test.ts", contracts: "MVR, relayer", cases: 8, pillar: "Privacy", ids: "REL-EQV-01–02, REL-REP-01–02, REL-FF-01–02, REL-STALE-01–02" },
    { path: "test/integration/ai-criteria-roundtrip.test.ts", contracts: "@medvault/ai", cases: 7, pillar: "AI", ids: "AI-01–07" },
    { path: "test/integration/indexer-sync.test.ts", contracts: "@medvault/indexer", cases: 5, pillar: "IDX", ids: "IDX-01–05" },
    { path: "test/integration/hybrid-storage.e2e.test.ts", contracts: "Full stack + IPFS", cases: 1, pillar: "E2E", ids: "HYB-01" },
    { path: "test/integration/anonymous-apply-cancel.test.ts", contracts: "MVR, EE", cases: 2, pillar: "E2E", ids: "AAC-01–02" },
    { path: "test/staking/staking-manager.test.ts", contracts: "StakingManager", cases: 8, pillar: "ETH/FHE", ids: "STK-01–08" },
    { path: "test/crypto/noir-nullifier.test.ts", contracts: "Off-chain", cases: 3, pillar: "ZK", ids: "CRYPTO-NULL-01–03" },
    { path: "test/crypto/honk-pipeline.test.ts", contracts: "HonkVerifier", cases: 1, pillar: "ZK", ids: "CRYPTO-HONK-01" },
];
export const AUDIT_TRACEABILITY: Array<{ finding: string; tests: string }> = [
    { finding: "Timelock wiring (instant setter reverts)", tests: "TL-01–TL-06" },
    { finding: "Withdraw-to EIP-712 user authorization", tests: "TL-05, FLOW-09, E2E-09" },
    { finding: "MH-1 engine before patient registration", tests: "TL-04, APR-*" },
    { finding: "H-4 milestone participant check", tests: "TMM-03" },
    { finding: "M-2 consent gate / revoked consent", tests: "CM-07, ECG-05, INT-EE-04, E2E-05" },
    { finding: "Two-step ownership", tests: "OWN-*-*" },
    { finding: "Deprecated legacy entrypoints", tests: "DEP-01–04" },
    { finding: "Sponsor verification on Hardhat", tests: "TM-02, SR-*" },
    { finding: "SponsorRegistry auditor timelock (M-AUDIT-1)", tests: "SRA-01–05, LOW-2" },
    { finding: "Zama FHE encrypt / ACL binding", tests: "APR-01, SR-01, CM-01, SEMA-PROOF-01–02" },
    { finding: "EligibilityEngine ↔ ConsentManager FHE ACL", tests: "INT-EE-03, SIV-05+" },
    { finding: "Noir attestation ↔ Zama FHE stage binding", tests: "DIFF-*, BIND-*" },
    { finding: "P2 FHE.select payout gating (trust-gap)", tests: "P2-01..04, P5-SELECT-01/02" },
    { finding: "Relayer re-decrypt defense-in-depth (P0.2)", tests: "RDV-01–05, REL-FF-01" },
    { finding: "Multi-relayer + adversarial bounds (P3.1)", tests: "P3-01–P3-05, REL-EQV/REP/FF/STALE" },
    { finding: "Phase 5 differential eligibility properties", tests: "P1–P3 PROP, DIFF-03" },
    { finding: "Homomorphic transferable withdraw/stake (no public sufficiency bool)", tests: "SUF-01..07" },
    { finding: "Encrypted withdraw staging & public exit", tests: "PEX-*, BEX-*, PRIV-01–04" },
    { finding: "Gasless claim encryptedAmountCommitment", tests: "GCL-*, SIV-*" },
    { finding: "Encrypted sponsor criteria + aggregates", tests: "ECR-*, AGG-01" },
    { finding: "IERC7984 metadata and operator model", tests: "CET-13, CET-14" },
    { finding: "Relayer registration privacy", tests: "REL-REG-01" },
    { finding: "Batch FHE eligibility", tests: "BAT-01" },
    { finding: "PatientDocumentStore hybrid storage", tests: "PDS-*, PDS-INV-*, HYB-01" },
    { finding: "Zero-revelation screening rewards", tests: "ZR-*, ZR-FUZZ-*" },
    { finding: "Cleartext test helpers (Hardhat-only)", tests: "HCU-*" },
    { finding: "Sepolia fork (Aave / Chainlink)", tests: "SF-*" },
    { finding: "AI criteria extraction", tests: "AI-*" },
    { finding: "Indexer sync", tests: "IDX-*" },
    { finding: "High-concurrency registration", tests: "HCR-*" },
];
export const PINNED_DEPS = [
    { pkg: "@fhevm/hardhat-plugin", version: "^0.3.x" },
    { pkg: "@zama-fhe/sdk", version: "^0.4.x" },
    { pkg: "@fhevm/solidity", version: "^0.9.x" },
    { pkg: "hardhat", version: "^2.26.x" },
    { pkg: "ethers", version: "^6.16.x" },
    { pkg: "@nomicfoundation/hardhat-ethers", version: "^3.x" },
    { pkg: "vitest", version: "^3.x (node env)" },
] as const;
