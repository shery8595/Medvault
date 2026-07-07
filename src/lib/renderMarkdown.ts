import { marked } from "marked";
import DOMPurify from "dompurify";

/** Map repo-relative / GitHub markdown links to in-app doc routes. */
const DOC_LINK_TARGETS: Record<string, string> = {
    "/docs/index": "/docs/index",
    "/docs/local-development": "/docs/local-development",
    "/docs/docker": "/docs/docker",
    "/docs/erc7984-confidential-token": "/docs/erc7984-confidential-token",
    "/docs/hybrid-storage": "/docs/hybrid-storage",
    "/docs/atomic-flows": "/docs/atomic-flows",
    "/docs/zero-revelation-rewards": "/docs/zero-revelation-rewards",
    "/docs/formal-verification/eligibility-engine-spec": "/docs/formal-verification/eligibility-engine-spec",
    "/docs/formal-verification/certora-halmos-results": "/docs/formal-verification/certora-halmos-results",
    "/docs/subgraph-sync": "/docs/subgraph-sync",
    "/docs/archive": "/docs/archive",
    "/docs/security-notes": "/docs/security-notes",
    "/docs/internal": "/docs/internal",
    "/docs/ai-service": "/docs/ai-service",
    "/docs/hybrid-indexer": "/docs/hybrid-indexer",
    "/docs/judge-brief": "/docs/judge-brief",
    "/docs/trust-architecture": "/docs/trust-architecture",
    "/docs/glossary": "/docs/glossary",
    "/docs/security-model": "/docs/security-model",
    "/docs/compliance": "/docs/compliance",
    "/docs/relayer-trust-boundaries": "/docs/relayer-trust-boundaries",
    "/docs/p3-3-threshold-attestation": "/docs/p3-3-threshold-attestation",
    "/docs/private-withdrawals": "/docs/private-withdrawals",
    "/docs/subgraph": "/docs/subgraph",
    "/docs/deployment": "/docs/deployment",
    "/docs/timelock-wiring": "/docs/timelock-wiring",
    "/docs/automation": "/docs/automation",
    "/docs/mcp": "/docs/mcp",
};

const MARKDOWN_FILE_TO_ROUTE: Record<string, string> = {
    "README.md": "/docs/index",
    "docs/README.md": "/docs/index",
    "../README.md": "/docs/index",
    "LOCAL_DEVELOPMENT.md": "/docs/local-development",
    "docs/LOCAL_DEVELOPMENT.md": "/docs/local-development",
    "./LOCAL_DEVELOPMENT.md": "/docs/local-development",
    "DOCKER.md": "/docs/docker",
    "docs/DOCKER.md": "/docs/docker",
    "./DOCKER.md": "/docs/docker",
    "ERC7984_CONFIDENTIAL_TOKEN.md": "/docs/erc7984-confidential-token",
    "docs/ERC7984_CONFIDENTIAL_TOKEN.md": "/docs/erc7984-confidential-token",
    "./ERC7984_CONFIDENTIAL_TOKEN.md": "/docs/erc7984-confidential-token",
    "HYBRID_STORAGE.md": "/docs/hybrid-storage",
    "docs/HYBRID_STORAGE.md": "/docs/hybrid-storage",
    "./HYBRID_STORAGE.md": "/docs/hybrid-storage",
    "ATOMIC_FLOWS.md": "/docs/atomic-flows",
    "docs/ATOMIC_FLOWS.md": "/docs/atomic-flows",
    "./ATOMIC_FLOWS.md": "/docs/atomic-flows",
    "ZERO_REVELATION_REWARDS.md": "/docs/zero-revelation-rewards",
    "docs/ZERO_REVELATION_REWARDS.md": "/docs/zero-revelation-rewards",
    "./ZERO_REVELATION_REWARDS.md": "/docs/zero-revelation-rewards",
    "SUBGRAPH_SYNC.md": "/docs/subgraph-sync",
    "docs/SUBGRAPH_SYNC.md": "/docs/subgraph-sync",
    "./SUBGRAPH_SYNC.md": "/docs/subgraph-sync",
    "SECURITY.md": "/docs/security-notes",
    "../SECURITY.md": "/docs/security-notes",
    "JUDGE_BRIEF.md": "/docs/judge-brief",
    "./JUDGE_BRIEF.md": "/docs/judge-brief",
    "TRUST_ARCHITECTURE.md": "/docs/trust-architecture",
    "./TRUST_ARCHITECTURE.md": "/docs/trust-architecture",
    "GLOSSARY.md": "/docs/glossary",
    "./GLOSSARY.md": "/docs/glossary",
    "RELAYER_TRUST_BOUNDARIES.md": "/docs/relayer-trust-boundaries",
    "docs/RELAYER_TRUST_BOUNDARIES.md": "/docs/relayer-trust-boundaries",
    "P3_3_THRESHOLD_ATTESTATION.md": "/docs/p3-3-threshold-attestation",
    "docs/P3_3_THRESHOLD_ATTESTATION.md": "/docs/p3-3-threshold-attestation",
    "PRIVATE_WITHDRAWALS.md": "/docs/private-withdrawals",
    "docs/PRIVATE_WITHDRAWALS.md": "/docs/private-withdrawals",
    "TIMELOCK_WIRING.md": "/docs/timelock-wiring",
    "docs/TIMELOCK_WIRING.md": "/docs/timelock-wiring",
    "formal-verification/eligibility-engine.spec.md": "/docs/formal-verification/eligibility-engine-spec",
    "docs/formal-verification/eligibility-engine.spec.md": "/docs/formal-verification/eligibility-engine-spec",
    "./formal-verification/eligibility-engine.spec.md": "/docs/formal-verification/eligibility-engine-spec",
    "formal-verification/certora-halmos-results.md": "/docs/formal-verification/certora-halmos-results",
    "docs/formal-verification/certora-halmos-results.md": "/docs/formal-verification/certora-halmos-results",
    "./formal-verification/certora-halmos-results.md": "/docs/formal-verification/certora-halmos-results",
    "internal-docs/README.md": "/docs/internal",
    "docs/archive/README.md": "/docs/archive",
    "archive/README.md": "/docs/archive",
    "./archive/README.md": "/docs/archive",
    "ai-service/README.md": "/docs/ai-service",
    "indexer/README.md": "/docs/hybrid-indexer",
};

const GITHUB_BLOB_PREFIX = "https://github.com/shery8595/Med-Vault/blob/main/";

function resolveMarkdownHref(href: string): string | null {
    if (href.startsWith("/docs/")) {
        return DOC_LINK_TARGETS[href] ?? href;
    }

    const decoded = decodeURIComponent(href);
    if (decoded.startsWith(GITHUB_BLOB_PREFIX)) {
        const repoPath = decoded.slice(GITHUB_BLOB_PREFIX.length);
        return MARKDOWN_FILE_TO_ROUTE[repoPath] ?? null;
    }

    const normalized = decoded.replace(/^\.\//, "");
    if (MARKDOWN_FILE_TO_ROUTE[decoded]) {
        return MARKDOWN_FILE_TO_ROUTE[decoded];
    }
    if (MARKDOWN_FILE_TO_ROUTE[normalized]) {
        return MARKDOWN_FILE_TO_ROUTE[normalized];
    }
    if (normalized.startsWith("docs/") && MARKDOWN_FILE_TO_ROUTE[normalized.slice(5)]) {
        return MARKDOWN_FILE_TO_ROUTE[normalized.slice(5)];
    }
    if (normalized.endsWith(".md")) {
        const basename = normalized.split("/").pop()!;
        if (MARKDOWN_FILE_TO_ROUTE[basename]) {
            return MARKDOWN_FILE_TO_ROUTE[basename];
        }
    }

    return null;
}

function rewriteDocHtmlLinks(html: string): string {
    return html.replace(/href="([^"]+)"/g, (match, href: string) => {
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http://localhost")) {
            return match;
        }
        const internal = resolveMarkdownHref(href);
        if (internal) {
            return `href="${internal}"`;
        }
        if (href.startsWith("http://") || href.startsWith("https://")) {
            return `href="${href}" target="_blank" rel="noopener noreferrer"`;
        }
        return match;
    });
}

export function renderMarkdownToSafeHtml(markdown: string): string {
    const rawHtml = marked.parse(markdown, {
        gfm: true,
        breaks: false,
    }) as string;

    const linked = rewriteDocHtmlLinks(rawHtml);
    return DOMPurify.sanitize(linked, {
        ADD_ATTR: ["target", "rel"],
    });
}
