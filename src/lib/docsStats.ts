/**
 * Canonical repository statistics for documentation (Plan 00 audit baseline).
 * Every count is backed by verifiable file paths — see `docs/AUDIT.md` and `STAT_BACKING`.
 */

import { PROTOCOL_CONTRACTS } from "./protocolContracts";

/** How a statistic was derived from the repository. */
export interface StatBacking {
    /** Human-readable metric name */
    label: string;
    /** Verified numeric value */
    value: number;
    /** Repository paths used to derive the value */
    backing: readonly string[];
    /** Optional note when sources disagree or the metric has nuance */
    note?: string;
}

/** Verified 2026-06-30 — reproduce via Glob/Grep commands in docs/AUDIT.md */
export const STAT_BACKING = {
    productionContracts: {
        label: "Production Solidity contracts",
        value: 17,
        backing: ["contracts/*.sol"],
        note: "15 protocol contracts + HonkVerifier + ConfidentialETH 1-line alias (ConfidentialETH7984 is canonical implementation).",
    },
    protocolCatalogEntries: {
        label: "PROTOCOL_CONTRACTS catalog entries",
        value: PROTOCOL_CONTRACTS.length,
        backing: ["src/lib/protocolContracts.ts"],
        note: "15 production entries (ids 01–15) + optional HonkVerifier + HonkVerifierEncrypted (ids ZK, ZK-ENC).",
    },
    testHelperContracts: {
        label: "Test/helper contracts",
        value: 8,
        backing: ["contracts/test/*.sol"],
        note: "Includes APR/EE test harnesses (Poseidon + differential helpers), mocks, and TestHelpers.",
    },
    noirCircuits: {
        label: "Noir circuits",
        value: 2,
        backing: ["circuits/eligibility_plaintext/", "circuits/eligibility_encrypted/"],
        note: "Legacy `circuits/eligibility_proof/` retained for reference; build uses the split circuits.",
    },
    packages: {
        label: "Workspace packages",
        value: 2,
        backing: ["packages/medvault-core/", "packages/medvault-sdk/"],
    },
    services: {
        label: "Runtime services (+ auxiliary)",
        value: 5,
        backing: [
            "relayer/",
            "ai-service/",
            "indexer/",
            "mcp-server/",
            "src/ (frontend)",
            "subgraph/",
            "sepolia-faucet/",
            "android/",
        ],
        note: "5 primary services; subgraph, sepolia-faucet, and android shell counted separately in audit narrative.",
    },
    appPages: {
        label: "App pages (non-docs)",
        value: 25,
        backing: ["src/App.tsx"],
        note: "Landing (5) + patient (9) + sponsor (9) + admin (2); excludes /docs routes and Navigate aliases.",
    },
    inAppDocPages: {
        label: "In-app documentation React pages",
        value: 32,
        backing: ["src/pages/docs/**/*.tsx"],
        note: "32 routed doc pages + DocsLayout.tsx shell (33 TSX files total).",
    },
    docsNavItems: {
        label: "Documentation nav entries",
        value: 48,
        backing: ["src/lib/docsNav.ts (DOCS_NAV_ITEMS)"],
        note: "Includes external GitHub markdown links in sidebar/search.",
    },
    components: {
        label: "React components",
        value: 95,
        backing: ["src/components/**/*.tsx"],
    },
    hooks: {
        label: "React hooks",
        value: 27,
        backing: ["src/hooks/**/*.ts"],
    },
    libModules: {
        label: "Lib modules (top-level)",
        value: 64,
        backing: ["src/lib/*.{ts,tsx}"],
        note: "Excludes src/lib/contracts/ ABI subtree and __tests__.",
    },
    httpRoutes: {
        label: "HTTP routes (backend)",
        value: 21,
        backing: [
            "relayer/server.js (10)",
            "ai-service/src/server.ts (4)",
            "indexer/src/api.ts (5)",
            "mcp-server/src/http.ts (2)",
        ],
    },
    mcpTools: {
        label: "MCP tools",
        value: 33,
        backing: ["mcp-server/src/server.ts"],
        note: "23 read + 10 write (medvault_create_trial … medvault_claim_reclaimed_pool).",
    },
    backgroundJobs: {
        label: "Background jobs",
        value: 5,
        backing: [
            "relayer/watcher.mjs",
            "relayer/batch-exit-queue.mjs",
            "indexer/src/sync.ts",
            "indexer/src/reconcile.ts",
            "contracts/MedVaultAutomation.sol (Chainlink upkeep)",
        ],
    },
    scripts: {
        label: "Root scripts",
        value: 36,
        backing: ["scripts/*", "scripts/lib/*"],
        note: "33 root scripts + 3 scripts/lib/ helpers.",
    },
    testFiles: {
        label: "TypeScript test files",
        value: 96,
        backing: [
            "test/**/*.test.ts",
            "packages/**/tests/**/*.test.ts",
            "src/lib/__tests__/**/*.test.ts",
        ],
        note: "87 under test/ (76 in default npm test); +9 package/Vitest files.",
    },
    testCasesLiteral: {
        label: "Literal it() blocks in default-suite files",
        value: 438,
        backing: ["grep '\\bit\\s*\\(' across default-suite globs in hardhat-test-suite.mjs"],
        note: "76 Hardhat files in default suite; loop-expanded cases (OWN-*, P1–P3 PROP) exceed literal count.",
    },
    testCasesParametricFuzz: {
        label: "Parametric fuzz matrix cases",
        value: 832,
        backing: [
            "test/fuzz/edge-case-parametric.test.ts (20×10×4 = 800)",
            "test/fuzz/gas-stress-fuzz.test.ts (min(runs,32) vault loop)",
        ],
    },
    testCasesRegistered: {
        label: "Registered test cases (incl. loop expansion)",
        value: 2020,
        backing: [
            "491 literal it() (all TS test files)",
            "832 parametric ECM matrix",
            "hardhat.config.ts fuzz.runs loop expansion",
        ],
        note: "Approximate total; default CI suite runs 483 passing (excludes fuzz/fork/Honk). Recompute: scripts in docs/AUDIT.md.",
    },
    testSuiteDefaultPassing: {
        label: "Default suite passing (npm test)",
        value: 483,
        backing: [
            "scripts/hardhat-test-suite.mjs (default suite)",
            "src/pages/docs/testing/testSuiteData.ts (SUITE_STATS)",
        ],
        note: "Verified 2026-07-02: 483 = 395 unit + 85 integration + 3 crypto; 6 pending in unit suite.",
    },
    testSuiteUnitPassing: {
        label: "Unit + smoke + staking passing (npm run test:unit)",
        value: 395,
        backing: ["scripts/hardhat-test-suite.mjs (unit suite)"],
    },
    testSuiteIntegrationPassing: {
        label: "Integration passing (npm run test:integration)",
        value: 85,
        backing: ["test/integration/**/*.ts"],
    },
    testSuiteCryptoPassing: {
        label: "Noir nullifier crypto passing (npm run test:crypto)",
        value: 3,
        backing: ["test/crypto/noir-nullifier.test.ts"],
    },
    testSuiteUnitPending: {
        label: "Unit suite pending (it.skip + conditional)",
        value: 6,
        backing: ["test/unit/**/*.ts", "test/smoke/**/*.ts", "test/staking/**/*.ts"],
        note: "4 permanent it.skip (EE-11, EE-12, TM-03, SIV-10) + 2 conditional (SDD-01, INFO-2 when RUN_LARGE_POOL_TEST unset).",
    },
    ciWorkflows: {
        label: "CI workflows",
        value: 4,
        backing: [
            ".github/workflows/contracts-test.yml",
            ".github/workflows/docker-smoke.yml",
            ".github/workflows/frontend.yml",
            ".github/workflows/mcp.yml",
        ],
        note: "No CD workflow.",
    },
    dockerfiles: {
        label: "Dockerfiles",
        value: 3,
        backing: ["Dockerfile", "relayer/Dockerfile", "indexer/Dockerfile"],
    },
    composeServices: {
        label: "Docker Compose services",
        value: 10,
        backing: ["docker-compose.yml"],
        note: "Profiles: default (frontend), relayer, graph (5), indexer (3).",
    },
    markdownFiles: {
        label: "Repository Markdown files",
        value: 33,
        backing: ["**/*.md (repo root, docs/, internal-docs/, package READMEs)"],
    },
    eligibilityPublicInputs: {
        label: "Eligibility proof public inputs (plaintext)",
        value: 25,
        backing: ["circuits/eligibility_plaintext/src/main.nr"],
        note: "Encrypted mode uses 15 public inputs (circuits/eligibility_encrypted). HonkVerifier on-chain = 33 (= 25 + 8 pairing points).",
    },
    docsContractCount: {
        label: "DOCS_CONTRACT_COUNT",
        value: 15,
        backing: ["src/lib/docsNav.ts"],
        note: `Matches PROTOCOL_CONTRACTS.length (${PROTOCOL_CONTRACTS.length}); + alias + optional Honk = 17 Solidity artifacts in catalog.`,
    },
} as const satisfies Record<string, StatBacking>;

/** Flat numeric exports for doc pages and badges */
export const REPO_STATS = {
    productionContracts: STAT_BACKING.productionContracts.value,
    protocolCatalogEntries: STAT_BACKING.protocolCatalogEntries.value,
    protocolProductionEntries: PROTOCOL_CONTRACTS.filter((c) => c.id !== "ZK").length,
    testHelperContracts: STAT_BACKING.testHelperContracts.value,
    noirCircuits: STAT_BACKING.noirCircuits.value,
    packages: STAT_BACKING.packages.value,
    appPages: STAT_BACKING.appPages.value,
    inAppDocPages: STAT_BACKING.inAppDocPages.value,
    docsNavItems: STAT_BACKING.docsNavItems.value,
    components: STAT_BACKING.components.value,
    hooks: STAT_BACKING.hooks.value,
    libModules: STAT_BACKING.libModules.value,
    httpRoutes: STAT_BACKING.httpRoutes.value,
    mcpTools: STAT_BACKING.mcpTools.value,
    mcpToolsRead: 23,
    mcpToolsWrite: 8,
    backgroundJobs: STAT_BACKING.backgroundJobs.value,
    scripts: STAT_BACKING.scripts.value,
    testFiles: STAT_BACKING.testFiles.value,
    testCasesLiteral: STAT_BACKING.testCasesLiteral.value,
    testCasesParametricFuzz: STAT_BACKING.testCasesParametricFuzz.value,
    testCasesRegistered: STAT_BACKING.testCasesRegistered.value,
    testSuiteDefaultPassing: STAT_BACKING.testSuiteDefaultPassing.value,
    testSuiteUnitPassing: STAT_BACKING.testSuiteUnitPassing.value,
    testSuiteIntegrationPassing: STAT_BACKING.testSuiteIntegrationPassing.value,
    testSuiteCryptoPassing: STAT_BACKING.testSuiteCryptoPassing.value,
    testSuiteUnitPending: STAT_BACKING.testSuiteUnitPending.value,
    ciWorkflows: STAT_BACKING.ciWorkflows.value,
    dockerfiles: STAT_BACKING.dockerfiles.value,
    composeServices: STAT_BACKING.composeServices.value,
    markdownFiles: STAT_BACKING.markdownFiles.value,
    eligibilityPublicInputs: STAT_BACKING.eligibilityPublicInputs.value,
    docsContractCount: STAT_BACKING.docsContractCount.value,
} as const;

export const SUBGRAPH_STUDIO_VERSION = "v0.2.0" as const;

export const SUBGRAPH_QUERY_URL =
    "https://api.studio.thegraph.com/query/1755644/medvault/v0.2.0" as const;

export const REPO_NETWORKS = ["sepolia (11155111)", "hardhat (31337)", "sepoliaFork", "arbitrum (addresses key only)"] as const;

export const REPO_INTEGRATIONS = [
    "Zama FHE",
    "Noir/Honk",
    "Chainlink Automation",
    "Chainlink price feeds",
    "IPFS/Pinata",
    "The Graph",
    "OpenAI",
    "MCP",
    "Semaphore",
    "Privy",
    "Aave V3",
    "Reclaim",
] as const;

/** Audit artifact path (markdown source of truth for methodology) */
export const AUDIT_DOC_PATH = "docs/AUDIT.md";
