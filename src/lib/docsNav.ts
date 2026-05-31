/**
 * Documentation IA: top tabs, path→tab, sidebar grouping, client search index.
 */

/** Public production site (custom domain on Vercel). */
export const PRODUCTION_APP_URL = "https://med-vault.xyz";

export type DocsTabId =
    | "getting-started"
    | "protocol"
    | "fhenix"
    | "semaphore"
    | "noir"
    | "clients"
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
        id: "fhenix",
        label: "Fhenix / CoFHE",
        subtitle: "How CoFHE is used on Arbitrum Sepolia: SDK, coprocessor, ACL, and proof accounts.",
    },
    {
        id: "semaphore",
        label: "Semaphore",
        subtitle: "Anonymous identity, nullifiers, ephemeral decrypt wallet, and apply flow.",
    },
    {
        id: "noir",
        label: "Noir / Honk",
        subtitle: "Eligibility ZK circuit, browser proving, and HonkVerifier on-chain.",
    },
    {
        id: "clients",
        label: "Clients & indexing",
        subtitle: "Encryption in the browser, subgraph, frontend structure, and identity tooling.",
    },
    {
        id: "operations",
        label: "Operations",
        subtitle: "Workflows, staking, deployment, and release notes.",
    },
    {
        id: "testing",
        label: "Tests & verification",
        subtitle: "Hardhat suite, CoFHE mocks, test matrix, fixtures, and CI.",
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
        keywords: ["questions", "wallet", "testnet", "latency", "help", "privy", "faucet", "relayer", "arbitrum sepolia", "noir", "semaphore", "chainlink", "ephemeral"],
        pageDescription: "Short answers to common questions about wallets, testnet, FHE latency, and consent.",
    },
    {
        title: "Architecture",
        href: "/docs/architecture",
        tabId: "protocol",
        section: "Core concepts",
        keywords: ["system", "layers", "diagram", "registry"],
        pageTitle: "Architecture & CoFHE integration",
        pageDescription:
            "How the client, contracts, CoFHE coprocessor, Semaphore identity, and indexing fit together on Arbitrum Sepolia.",
    },
    {
        title: "Overview",
        href: "/docs/fhenix-cofhe",
        tabId: "fhenix",
        section: "CoFHE",
        keywords: ["fhenix", "cofhe", "coprocessor", "sdk", "vrf", "encrypt", "decrypt", "arb sepolia"],
        pageTitle: "How Fhenix & CoFHE are used",
        pageDescription:
            "CoFHE on Arbitrum Sepolia: browser SDK, proof accounts, coprocessor, ACL, ephemeral decrypt, and Hardhat mocks.",
    },
    {
        title: "FHE primitives",
        href: "/docs/fhe-primitives",
        tabId: "fhenix",
        section: "CoFHE",
        keywords: ["euint", "cofhe", "encrypt", "coprocessor", "cmux", "acl"],
        pageTitle: "CoFHE primitives & FHE operations",
        pageDescription: "Encrypted types (euint/ebool), ACL, proof accounts, and operations used in MedVault contracts.",
    },
    {
        title: "Client encryption",
        href: "/docs/client-encryption",
        tabId: "fhenix",
        section: "CoFHE",
        keywords: ["sdk", "browser", "encrypt", "decrypt"],
        pageTitle: "Client-side encryption with @cofhe/sdk",
        pageDescription: "Encrypting inputs in the browser, viewing keys, and what never leaves the client in plaintext.",
    },
    {
        title: "Overview",
        href: "/docs/semaphore",
        tabId: "semaphore",
        section: "Identity",
        keywords: ["semaphore", "anonymous", "nullifier", "commitment", "ephemeral", "group", "zk"],
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
        pageTitle: "Noir eligibility proofs & Honk verifier",
        pageDescription:
            "eligibility_proof circuit, browser proving, HonkVerifier.sol, and verifyEligibilityProof on-chain.",
    },
    {
        title: "Eligibility engine",
        href: "/docs/engine",
        tabId: "noir",
        section: "Proofs",
        keywords: ["verifyEligibilityProof", "score", "fhe"],
        pageTitle: "Eligibility engine mechanics",
        pageDescription: "Scoring model and verifyEligibilityProof integration with HonkVerifier.",
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
        title: "Sponsor system",
        href: "/docs/sponsor-system",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: ["sponsor", "kyc", "registry", "escrow"],
        pageTitle: "Sponsor verification & trial funding",
        pageDescription: "How sponsors are verified, how trials are funded, and registry controls.",
    },
    {
        title: "Chainlink Automation",
        href: "/docs/automation",
        tabId: "protocol",
        section: "Smart contracts",
        keywords: [
            "chainlink",
            "keeper",
            "automation",
            "checkUpkeep",
            "performUpkeep",
            "MedVaultAutomation",
            "forwarder",
            "finalize",
            "trial expiry",
        ],
        pageTitle: "Chainlink Automation (MedVaultAutomation)",
        pageDescription:
            "Keeper upkeep for trial finalization: checkUpkeep/performUpkeep, vault distribution, and TrialManager hooks.",
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
            "arb-sepolia-faucet",
            "arbitrum",
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
            "Privy, faucet, HTTP relayer — with deep dives in Semaphore, Noir, and Fhenix/CoFHE docs.",
    },
    {
        title: "Private staking",
        href: "/docs/staking",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["aave", "yield", "confidential", "ceth"],
        pageTitle: "Private yield staking (Aave integration)",
        pageDescription: "How ConfidentialETH interacts with staking routes and yield expectations on testnet.",
    },
    {
        title: "Overview",
        href: "/docs/testing",
        tabId: "testing",
        section: "Suite",
        keywords: ["hardhat", "tests", "ci", "verify", "191", "mocha"],
        pageTitle: "Contract test suite overview",
        pageDescription:
            "191+ Hardhat tests with CoFHE mocks: suite breakdown, pillars, and quick start commands.",
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
        keywords: ["deployMedVaultStack", "fhe", "cofhe", "semaphore", "impersonate"],
        pageTitle: "Test infrastructure & fixtures",
        pageDescription:
            "test-support helpers: deployments, CoFHE 0.5 encryption, consent overloads, and MockSemaphore.",
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
        title: "Changelog",
        href: "/docs/changelog",
        tabId: "operations",
        section: "Runbooks",
        keywords: ["release", "version", "notes", "updates"],
        pageDescription: "High-level release notes for the documentation and major contract or app milestones.",
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
    if (pathname.startsWith("/docs/fhenix-cofhe")) {
        return "fhenix";
    }
    if (pathname.startsWith("/docs/semaphore")) {
        return "semaphore";
    }
    if (pathname.startsWith("/docs/noir")) {
        return "noir";
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
export const DOCS_CONTRACT_COUNT = 14;
