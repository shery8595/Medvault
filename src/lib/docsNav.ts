/**
 * Documentation IA: top tabs, path→tab, sidebar grouping, client search index.
 */

/** Public production site (custom domain on Vercel). */
export const PRODUCTION_APP_URL = "https://med-vault.xyz";

export type DocsTabId =
    | "getting-started"
    | "protocol"
    | "zama"
    | "semaphore"
    | "noir"
    | "clients"
    | "mcp"
    | "operations"
    | "testing"
    | "security";

export interface DocsTab {
    id: DocsTabId;
    label: string;
    subtitle: string;
}

export const DOCS_TABS: DocsTab[] = [
    {
        id: "getting-started",
        label: "Getting started",
        subtitle: "What MedVault is, how to use the app, and where to go first.",
    },
    {
        id: "protocol",
        label: "Protocol & contracts",
        subtitle: "Architecture, eligibility engine, contract reference, and automation.",
    },
    {
        id: "zama",
        label: "Zama FHE",
        subtitle: "How Zama FHE is used on Ethereum Sepolia: SDK, coprocessor, ACL, and proof accounts.",
    },
    {
        id: "semaphore",
        label: "Semaphore",
        subtitle: "Anonymous identity, nullifiers, ephemeral decrypt wallet, and apply flow.",
    },
    {
        id: "noir",
        label: "Noir / Honk",
        subtitle: "Public compliance attestation seal — binds Zama FHE stages to Semaphore identity (not the compute layer).",
    },
    {
        id: "clients",
        label: "Clients & indexing",
        subtitle: "Encryption in the browser, subgraph, frontend structure, and identity tooling.",
    },
    {
        id: "mcp",
        label: "MCP & SDK",
        subtitle: "TypeScript SDK for integrators, local MCP server for AI assistants, setup, and sponsor workflows.",
    },
    {
        id: "operations",
        label: "Operations",
        subtitle: "Workflows, staking, deployment, and release notes.",
    },
    {
        id: "testing",
        label: "Tests & verification",
        subtitle: "Hardhat suite, Zama FHE mocks, test matrix, fixtures, and CI.",
    },
    {
        id: "security",
        label: "Security & trust",
        subtitle: "Threat model, compliance, and audit posture.",
    },
];

export interface DocsNavItem {
    title: string;
    href: string;
    tabId: DocsTabId;
    section: string;
    keywords: string[];
    /** Shown under the title when using DocsPageHeaderForRoute */
    pageDescription?: string;
    /** Optional longer H1 when different from sidebar `title` */
    pageTitle?: string;
}

/** Flat list for search + sidebar assembly. Order matches sidebar intent. */
export const DOCS_NAV_ITEMS: DocsNavItem[] = [
    {
        title: "Introduction",
        href: "/docs",
        tabId: "getting-started",
        section: "Overview",
        keywords: ["overview", "medvault", "fhe", "fhEVM", "start"],
        pageDescription: "What MedVault is, how FHE matching works, and how the system is organized.",
    },
    {
        title: "Documentation index",
        href: "/docs/index",
        tabId: "getting-started",
        section: "Overview",
        keywords: ["docs", "index", "readme", "markdown", "github"],
        pageDescription: "Central index for all repository markdown documentation.",
    },
    {
        title: "User workflows",
        href: "/docs/guides",
        tabId: "getting-started",
        section: "First steps",
        keywords: ["guide", "patient", "sponsor", "workflow", "tutorial", "chainlink", "relayer"],
        pageTitle: "User workflows & state machines",
        pageDescription:
            "Patient and sponsor journeys, state machines, and edge cases developers should handle in the UI.",
    },
    {
        title: "FAQ",
        href: "/docs/faq",
        tabId: "getting-started",
        section: "First steps",
        keywords: ["questions", "wallet", "testnet", "latency", "help", "privy", "faucet", "relayer", "Ethereum Sepolia", "noir", "semaphore", "chainlink", "ephemeral", "docker", "compose"],
        pageDescription: "Short answers to common questions about wallets, testnet, FHE latency, and consent.",
    },
    {
        title: "Local development & Docker",
        href: "/docs/local-development",
        tabId: "getting-started",
        section: "First steps",
        keywords: ["docker", "compose", "local", "dev", "setup", "npm", "smoke", "sepolia"],
        pageDescription: "One-command docker compose up --build, optional relayer/graph profiles, and legacy npm workflow.",
    },
    {
        title: "Docker Compose guide",
        href: "/docs/docker",
        tabId: "getting-started",
        section: "First steps",
        keywords: ["docker", "dockerfile", "compose", "profile", "graph", "relayer", "troubleshooting", "production"],
        pageDescription: "Docker architecture, env vars, production build target, smoke test, and troubleshooting.",
    },
    {
        title: "Architecture",
        href: "/docs/architecture",
        tabId: "protocol",
        section: "Core concepts",
        keywords: ["system", "layers", "diagram", "registry"],
        pageTitle: "Architecture & Zama FHE integration",
        pageDescription:
            "How the client, contracts, Zama FHE coprocessor, Semaphore identity, and indexing fit together on Ethereum Sepolia.",
    },
    {
        title: "Overview",
        href: "/docs/zama-fhe",
        tabId: "zama",
        section: "Zama FHE",
        keywords: ["zama", "fhe", "coprocessor", "sdk", "relayer", "encrypt", "decrypt", "ethereum sepolia"],
        pageTitle: "How Zama FHE is used",
        pageDescription:
            "Zama FHE on Ethereum Sepolia: browser SDK, proof accounts, coprocessor, ACL, ephemeral decrypt, and Hardhat mocks.",
    },
    {
        title: "FHE primitives",
        href: "/docs/fhe-primitives",
        tabId: "zama",
        section: "Zama FHE",
        keywords: ["euint", "fhe", "encrypt", "coprocessor", "cmux", "acl"],
        pageTitle: "Zama FHE primitives & FHE operations",
        pageDescription: "Encrypted types (euint/ebool), ACL, proof accounts, and operations used in MedVault contracts.",
    },
    {
        title: "Client encryption",
        href: "/docs/client-encryption",
        tabId: "zama",
        section: "Zama FHE",
        keywords: ["sdk", "browser", "encrypt", "decrypt"],
        pageTitle: "Client-side encryption with @zama-fhe/sdk",
        pageDescription: "Encrypting inputs in the browser, viewing keys, and what never leaves the client in plaintext.",
    },
    {
        title: "Overview",
        href: "/docs/semaphore",
        tabId: "semaphore",
        section: "Identity",
        keywords: ["semaphore", "anonymous", "nullifier", "commitment", "ephemeral", "group", "zk", "profileSaltCommitment", "onlyTrustedRelayer"],
        pageTitle: "Semaphore anonymous identity",
        pageDescription:
            "Identity commitments, anonymous apply, nullifiers, ephemeral permit wallet, and relayer stage/finalize.",
    },
    {
        title: "Overview",
        href: "/docs/noir",
        tabId: "noir",
        section: "Proofs",
        keywords: ["noir", "honk", "ultrahonk", "circuit", "verifier", "zk", "barretenberg"],
        pageTitle: "Noir compliance attestation & Honk verifier",
        pageDescription:
            "Zama FHE computes privately; Noir seals a public attestation bound to nullifier, profile commitment, FHE stage handle, and trial schema.",
    },
    {
        title: "Eligibility engine",
        href: "/docs/engine",
        tabId: "noir",
        section: "Proofs",
        keywords: ["finalizeAnonymousApplyWithProof", "onlyTrustedRelayer", "score", "fhe", "relayer"],
        pageTitle: "Eligibility engine mechanics",
        pageDescription: "FHE scoring authority plus finalizeWithProof attestation binding and attestationReceipt.",
    },
    {
        title: "Contract reference",
        href: "/docs/contracts",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["solidity", "abi", "addresses", "contracts", "chainlink", "automation", "price feed"],
        pageTitle: "Core logic contracts",
        pageDescription:
            "Reference for the main MedVault contracts: trials, engine, consent, vaults, and automation.",
    },
    {
        title: "IERC7984 confidential token",
        href: "/docs/erc7984-confidential-token",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["erc7984", "ierc7984", "confidential", "ceth", "openzeppelin", "7984", "confidentialTransfer"],
        pageTitle: "ConfidentialETH7984 (IERC7984)",
        pageDescription: "OpenZeppelin ERC7984 implementation with MedVault native-ETH deposit, withdraw-to, and lock extensions.",
    },
    {
        title: "Hybrid document storage",
        href: "/docs/hybrid-storage",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["ipfs", "pinata", "patientdocumentstore", "aes", "document", "hybrid", "cid", "revokeAccess", "pullSponsorKeyAccess", "DocumentLegacyHandleRevoked"],
        pageTitle: "Hybrid storage (IPFS + FHE)",
        pageDescription: "PatientDocumentStore: IPFS ciphertext + FHE-wrapped AES keys bound into Noir attestation.",
    },
    {
        title: "Atomic flows",
        href: "/docs/atomic-flows",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["atomic", "stage", "finalize", "consent", "fundTrialAndSetMilestones", "stakeAndLock", "onlyTrustedRelayer", "cancelAnonymousApplyStage"],
        pageTitle: "Atomic wallet-visible flows",
        pageDescription: "Single-tx sponsor funding, staking, and consent-at-finalize vs canonical 2-tx anonymous apply.",
    },
    {
        title: "Zero-revelation rewards",
        href: "/docs/zero-revelation-rewards",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["rewards", "screening", "fhe", "milestone", "confidentialtransfer", "zero revelation", "distributePartialPaginated", "confirmReceipt", "prepareEntitlementProof", "pruneUnconfirmedSlots", "pull claim"],
        pageTitle: "Zero-revelation screening rewards",
        pageDescription: "FHE-gated staging; patients confirmReceipt before cETH; sponsor prune after challenge window.",
    },
    {
        title: "EligibilityEngine formal spec",
        href: "/docs/formal-verification/eligibility-engine-spec",
        tabId: "security",
        section: "Formal verification",
        keywords: ["certora", "halmos", "formal", "verification", "spec", "properties"],
        pageTitle: "EligibilityEngine formal specification",
        pageDescription: "Property specification for homomorphic eligibility logic (_computeEligibility, score bounds, attestation binding).",
    },
    {
        title: "Certora / Halmos results (Phase 5)",
        href: "/docs/formal-verification/certora-halmos-results",
        tabId: "security",
        section: "Formal verification",
        keywords: ["certora", "halmos", "formal", "verification", "differential", "phase 5", "diff-03", "p5-select"],
        pageTitle: "Formal verification results (Phase 5)",
        pageDescription: "Certora/Halmos blocked on fhEVM FHE.* types; differential fallbacks PASS on mock network.",
    },
    {
        title: "Sponsor system",
        href: "/docs/sponsor-system",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["sponsor", "kyc", "registry", "escrow"],
        pageTitle: "Sponsor verification & trial funding",
        pageDescription: "How sponsors are verified, how trials are funded, and registry controls.",
    },
    {
        title: "Chainlink CRE",
        href: "/docs/automation",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: [
            "chainlink",
            "cre",
            "keeper",
            "automation",
            "checkUpkeep",
            "performUpkeep",
            "MedVaultAutomation",
            "AutomationReceiver",
            "forwarder",
            "cron",
            "railway",
            "owner cron",
            "finalize",
            "trial expiry",
        ],
        pageTitle: "Chainlink CRE (Trial Finalization)",
        pageDescription:
            "Trial finalization via MedVaultAutomation: Chainlink CRE + AutomationReceiver, or owner cron scheduler. checkUpkeep/performUpkeep, vault distribution, TrialManager hooks.",
    },
    {
        title: "Subgraph indexing",
        href: "/docs/subgraph",
        tabId: "clients",
        section: "Integration",
        keywords: ["the graph", "events", "entities", "query"],
        pageTitle: "The Graph: subgraph indexing",
        pageDescription: "Which events are indexed, core entities, and how the app queries trial data.",
    },
    {
        title: "Frontend architecture",
        href: "/docs/frontend",
        tabId: "clients",
        section: "Integration",
        keywords: ["react", "privy", "context", "hooks"],
        pageTitle: "Frontend React architecture",
        pageDescription: "App structure, providers, and how the dApp talks to wallets and contracts.",
    },
    {
        title: "Identity & privacy",
        href: "/docs/identity-privacy",
        tabId: "clients",
        section: "Integration",
        keywords: [
            "semaphore",
            "reclaim",
            "noir",
            "honk",
            "anonymous",
            "zk",
            "relayer",
            "privy",
            "faucet",
            "private faucet",
            "ethereum sepolia",
            "testnet",
            "gasless",
            "embedded wallet",
            "ephemeral",
            "ephemeral wallet",
            "permit recipient",
            "decrypt for tx",
            "stage finalize",
        ],
        pageTitle: "Identity, relayer & tooling hub",
        pageDescription:
            "Privy, faucet, HTTP relayer — with deep dives in Semaphore, Noir, and Zama FHE docs.",
    },
    {
        title: "Private withdrawals",
        href: "/docs/private-withdrawals",
        tabId: "operations",
        section: "Runbooks",
        keywords: [
            "withdraw",
            "unshield",
            "ceth",
            "encrypted",
            "eip-712",
            "stealth",
            "relayer",
            "public exit",
            "batch",
            "claim",
            "claimFailedWithdraw",
            "pendingFailedWithdrawWei",
        ],
        pageTitle: "Private withdrawals & public exit modes",
        pageDescription:
            "Encrypted withdraw staging, KMS completion, EIP-712 stealth exits, fast vs batched relayer settlement, and claim encryption binding.",
    },
    {
        title: "Private staking",
        href: "/docs/staking",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["aave", "yield", "confidential", "ceth", "unstake", "stakeFromConfidential"],
        pageTitle: "Private yield staking (dual paths)",
        pageDescription:
            "Confidential cETH staking vs public Aave path; private unstake returns to encrypted MedVault balance.",
    },
    {
        title: "Overview",
        href: "/docs/testing",
        tabId: "testing",
        section: "Suite",
        keywords: ["hardhat", "tests", "ci", "verify", "491", "mocha", "timelock", "docker", "smoke", "relayer"],
        pageTitle: "Contract test suite overview",
        pageDescription:
            "491 Hardhat tests with Zama FHE mocks: suite breakdown, pillars, relayer adversarial REL-*, trust-gap payout gating, Phase 5 differential, timelock wiring, IERC7984 CET-13/14, and CI.",
    },
    {
        title: "Test matrix",
        href: "/docs/testing/matrix",
        tabId: "testing",
        section: "Suite",
        keywords: ["matrix", "case id", "EE", "MVR", "SIV", "SMOKE"],
        pageTitle: "Test matrix & case IDs",
        pageDescription: "Full catalog of test files, case ID prefixes, pillars, and audit traceability.",
    },
    {
        title: "Infrastructure & fixtures",
        href: "/docs/testing/infrastructure",
        tabId: "testing",
        section: "Suite",
        keywords: ["deployMedVaultStack", "fhe", "zama", "semaphore", "impersonate"],
        pageTitle: "Test infrastructure & fixtures",
        pageDescription:
            "test-support helpers: deployments, Zama FHE encryption, consent overloads, and MockSemaphore.",
    },
    {
        title: "CI & commands",
        href: "/docs/testing/ci",
        tabId: "testing",
        section: "Suite",
        keywords: ["npm test", "github actions", "coverage", "honk"],
        pageTitle: "Running tests & CI",
        pageDescription: "npm scripts, GitHub Actions workflow, troubleshooting, and optional Honk pipeline.",
    },
    {
        title: "Deployment guide",
        href: "/docs/deployment",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["deploy", "subgraph", "script", "network", "relayer", "faucet", "chainlink"],
        pageDescription:
            "Deploying contracts, subgraph, and production frontend at med-vault.xyz (Vercel + relayer CORS).",
    },
    {
        title: "Timelock wiring",
        href: "/docs/timelock-wiring",
        tabId: "operations",
        section: "Runbooks",
        keywords: [
            "timelock",
            "schedule",
            "apply",
            "wiring",
            "finish-wiring",
            "deploy:wire:sepolia",
            "READER_CHANGE_DELAY",
            "authorizeContract",
        ],
        pageTitle: "Timelock wiring (schedule / apply)",
        pageDescription:
            "2-day admin delay for cross-contract wiring: deploy flow, finish-wiring, FHEVM init, and TL-* tests.",
    },
    {
        title: "Android APK",
        href: "/docs/mobile/android-apk",
        tabId: "operations",
        section: "Runbooks",
        keywords: [
            "android",
            "apk",
            "mobile",
            "capacitor",
            "play store",
            "sideload",
            "webview",
            "install",
            "gradle",
            "studio",
        ],
        pageTitle: "Android APK (demo)",
        pageDescription:
            "Build and distribute an internal demo APK with Capacitor — Privy, Zama FHE, SDK setup, and troubleshooting.",
    },
    {
        title: "Overview",
        href: "/docs/mcp",
        tabId: "mcp",
        section: "MCP server",
        keywords: [
            "mcp",
            "model context protocol",
            "overview",
            "medvault",
            "ai",
            "agent",
            "local",
        ],
        pageTitle: "MCP server for developers & sponsors",
        pageDescription:
            "Local Model Context Protocol bridge: read trials/matches/audit data and sponsor writes — no production hosting.",
    },
    {
        title: "TypeScript SDK",
        href: "/docs/mcp/sdk",
        tabId: "mcp",
        section: "MCP server",
        keywords: [
            "sdk",
            "typescript",
            "npm",
            "medvault-sdk",
            "integrator",
            "relayer",
            "api",
            "MedVaultSDK",
        ],
        pageTitle: "TypeScript SDK (@medvault/sdk)",
        pageDescription:
            "MedVaultSDK facade: trials, sponsor ops, protocol metadata, and relayer HTTP client — no hosting required.",
    },
    {
        title: "Setup & clients",
        href: "/docs/mcp/setup",
        tabId: "mcp",
        section: "MCP server",
        keywords: [
            "cursor",
            "codex",
            "claude",
            "chatgpt",
            "antigravity",
            "openclaw",
            "env",
            "config",
            "stdio",
            "http",
            "export",
        ],
        pageTitle: "MCP setup & AI clients",
        pageDescription:
            "Build the server, set environment variables, and connect Cursor, Codex, Claude Code, ChatGPT, Antigravity, and OpenClaw.",
    },
    {
        title: "Tool reference",
        href: "/docs/mcp/tools",
        tabId: "mcp",
        section: "Reference",
        keywords: [
            "tools",
            "medvault_get_config",
            "medvault_create_trial",
            "subgraph",
            "sponsor",
            "write",
            "read",
        ],
        pageTitle: "MCP tool reference",
        pageDescription: "All medvault_* read and sponsor write tools exposed by the local MCP server (v1).",
    },
    {
        title: "Subgraph deploy & sync",
        href: "/docs/subgraph-sync",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["subgraph", "the graph", "studio", "deploy", "version", "medvault", "v0.2.0", "sync"],
        pageTitle: "Subgraph deploy & version sync",
        pageDescription:
            "Graph Studio slug medvault/v0.2.0, deploy commands, reconcile scripts, and manifest baseline.",
    },
    {
        title: "AI service",
        href: "/docs/ai-service",
        tabId: "operations",
        section: "Backend services",
        keywords: ["ai", "openai", "phi", "redaction", "criteria", "extract", "3200", "ai-service"],
        pageTitle: "AI service (@medvault/ai)",
        pageDescription: "PHI-safe criteria extraction and audit-log summarization (port 3200).",
    },
    {
        title: "Hybrid indexer",
        href: "/docs/hybrid-indexer",
        tabId: "clients",
        section: "Integration",
        keywords: ["indexer", "mongodb", "redis", "3300", "hybrid", "rpc", "alerts", "desync"],
        pageTitle: "Hybrid indexer API",
        pageDescription: "Subgraph + RPC indexer with MongoDB, Redis cache, and desync alerts.",
    },
    {
        title: "Archived design proposals",
        href: "/docs/archive",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["archive", "historical", "new contracts", "upgrade", "v1.1", "milestone", "dataaccesslog"],
        pageDescription: "Historical milestone/audit trail design notes — contracts now shipped in production.",
    },
    {
        title: "Changelog",
        href: "/docs/changelog",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["release", "version", "notes", "updates"],
        pageDescription: "High-level release notes for the documentation and major contract or app milestones.",
    },
    {
        title: "Security notes (Noir–FHE gap)",
        href: "/docs/security-notes",
        tabId: "security",
        section: "Assurance",
        keywords: ["noir", "fhe", "integrity", "attestation", "criteria", "createTrial", "encrypted criteria"],
        pageTitle: "Security notes",
        pageDescription:
            "Repository SECURITY.md: Noir–FHE integrity gap, encrypted vs legacy trial criteria paths, and operational guidance.",
    },
    {
        title: "Judge brief",
        href: "/docs/judge-brief",
        tabId: "security",
        section: "Assurance",
        keywords: ["judge", "brief", "auditor", "core protocol", "platform services"],
        pageTitle: "Judge brief — technical summary",
        pageDescription: "2-page summary: core FHE innovation, layered architecture, trust register, roadmap, demo path.",
    },
    {
        title: "Trust architecture",
        href: "/docs/trust-architecture",
        tabId: "security",
        section: "Assurance",
        keywords: ["trust", "architecture", "layered", "core protocol", "platform services", "assurance register"],
        pageTitle: "Trust & assurance architecture",
        pageDescription:
            "Layered responsibility model, Trust & Assurance Register, compliance roadmap, and Core Protocol vs Platform Services.",
    },
    {
        title: "Glossary",
        href: "/docs/glossary",
        tabId: "security",
        section: "Assurance",
        keywords: ["glossary", "terminology", "encrypted", "anonymous", "attested", "end-to-end"],
        pageTitle: "Canonical terminology glossary",
        pageDescription: "Precisely scoped terms for MedVault docs and UI — single source of language.",
    },
    {
        title: "Relayer trust boundaries",
        href: "/docs/relayer-trust-boundaries",
        tabId: "security",
        section: "Assurance",
        keywords: ["relayer", "trust", "censor", "forge", "p3.1", "multi-relayer", "equivocation", "patient-decrypt", "pdv"],
        pageTitle: "Relayer trust boundaries",
        pageDescription:
            "Proof-style bounds: relayer cannot steal vault funds, cannot forge eligibility, and can only censor or delay. Test-backed claims.",
    },
    {
        title: "P3.3 threshold attestation",
        href: "/docs/p3-3-threshold-attestation",
        tabId: "security",
        section: "Assurance",
        keywords: ["threshold", "p3.3", "co-sign", "attestation", "equivocation", "2-of-2", "visibility", "relayer sees eligibility"],
        pageTitle: "P3.3 threshold attestation (spec)",
        pageDescription: "Deferred M-of-N relayer co-sign design. Requires agreement among M relayers; does not hide eligibility bit from co-signing relayers.",
    },
    {
        title: "Security model",
        href: "/docs/security-model",
        tabId: "security",
        section: "Assurance",
        keywords: ["threat", "model", "fhe", "acl"],
        pageTitle: "Security model & threat analysis",
        pageDescription: "Threat vectors, mitigations, and how FHE + ACL reduce exposure for patients and sponsors.",
    },
    {
        title: "Compliance & audit",
        href: "/docs/compliance",
        tabId: "security",
        section: "Assurance",
        keywords: ["hipaa", "gdpr", "audit", "log"],
        pageTitle: "Regulatory compliance & audit trail",
        pageDescription: "How audit logs, consent, and data minimization relate to common compliance frameworks.",
    },
    {
        title: "Internal docs (SRS, DFD)",
        href: "/docs/internal",
        tabId: "security",
        section: "Assurance",
        keywords: ["srs", "dfd", "threat model", "zama integration", "internal-docs"],
        pageDescription: "Formal SRS, data-flow diagrams, threat model, and Zama integration guide (repository markdown).",
    },
];

const pathToTab = new Map<string, DocsTabId>();
const pathToItem = new Map<string, DocsNavItem>();
for (const item of DOCS_NAV_ITEMS) {
    pathToTab.set(item.href, item.tabId);
    pathToItem.set(item.href, item);
}

export function getDocNavItem(href: string): DocsNavItem | undefined {
    return pathToItem.get(href);
}

/** Default tab when path is unknown */
const DEFAULT_TAB: DocsTabId = "getting-started";

export function getTabForPath(pathname: string): DocsTabId {
    if (pathname.startsWith("/docs/testing")) {
        return "testing";
    }
    if (pathname.startsWith("/docs/formal-verification")) {
        return "security";
    }
    if (
        pathname === "/docs/index" ||
        pathname === "/docs/local-development" ||
        pathname === "/docs/docker"
    ) {
        return "getting-started";
    }
    if (pathname.startsWith("/docs/zama-fhe") || pathname.startsWith("/docs/fhe-primitives") || pathname.startsWith("/docs/client-encryption")) {
        return "zama";
    }
    if (pathname.startsWith("/docs/semaphore")) {
        return "semaphore";
    }
    if (pathname.startsWith("/docs/noir")) {
        return "noir";
    }
    if (pathname.startsWith("/docs/mcp")) {
        return "mcp";
    }
    return pathToTab.get(pathname) ?? DEFAULT_TAB;
}

export function getNavItemsForTab(tabId: DocsTabId): DocsNavItem[] {
    return DOCS_NAV_ITEMS.filter((i) => i.tabId === tabId);
}

export interface SearchHit {
    item: DocsNavItem;
    score: number;
}

export function searchDocsNav(query: string, limit = 12): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const hits: SearchHit[] = [];
    for (const item of DOCS_NAV_ITEMS) {
        const hay = [
            item.title,
            item.section,
            ...item.keywords,
            item.href.replace("/docs", ""),
        ]
            .join(" ")
            .toLowerCase();

        let score = 0;
        if (hay.includes(q)) {
            score += 10;
        }
        if (item.title.toLowerCase().startsWith(q)) {
            score += 8;
        }
        for (const kw of item.keywords) {
            if (kw.startsWith(q) || kw.includes(q)) {
                score += 3;
            }
        }
        if (q.length >= 2) {
            for (const part of q.split(/\s+/)) {
                if (part && hay.includes(part)) {
                    score += 2;
                }
            }
        }
        if (score > 0) {
            hits.push({ item, score });
        }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
}

/** Canonical doc page count (routes with content) */
export const DOCS_PAGE_COUNT = DOCS_NAV_ITEMS.length;

/** Production Solidity contracts (exclude test mocks) — update when the set changes */
export const DOCS_CONTRACT_COUNT = 15;
