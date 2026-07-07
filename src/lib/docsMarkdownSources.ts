/**
 * In-app markdown doc sources (bundled at build time via Vite ?raw imports).
 * Keys must match `href` in docsNav.ts and App routes.
 */
import docsReadme from "../../docs/README.md?raw";
import localDevelopment from "../../docs/LOCAL_DEVELOPMENT.md?raw";
import dockerGuide from "../../docs/DOCKER.md?raw";
import erc7984 from "../../docs/ERC7984_CONFIDENTIAL_TOKEN.md?raw";
import hybridStorage from "../../docs/HYBRID_STORAGE.md?raw";
import atomicFlows from "../../docs/ATOMIC_FLOWS.md?raw";
import zeroRevelationRewards from "../../docs/ZERO_REVELATION_REWARDS.md?raw";
import eligibilityEngineSpec from "../../docs/formal-verification/eligibility-engine.spec.md?raw";
import certoraHalmosResults from "../../docs/formal-verification/certora-halmos-results.md?raw";
import subgraphSync from "../../docs/SUBGRAPH_SYNC.md?raw";
import archiveReadme from "../../docs/archive/README.md?raw";
import securityNotes from "../../SECURITY.md?raw";
import internalDocsReadme from "../../internal-docs/README.md?raw";
import aiServiceReadme from "../../ai-service/README.md?raw";
import indexerReadme from "../../indexer/README.md?raw";

export const MARKDOWN_DOC_SOURCES: Record<string, string> = {
    "/docs/index": docsReadme,
    "/docs/local-development": localDevelopment,
    "/docs/docker": dockerGuide,
    "/docs/erc7984-confidential-token": erc7984,
    "/docs/hybrid-storage": hybridStorage,
    "/docs/atomic-flows": atomicFlows,
    "/docs/zero-revelation-rewards": zeroRevelationRewards,
    "/docs/formal-verification/eligibility-engine-spec": eligibilityEngineSpec,
    "/docs/formal-verification/certora-halmos-results": certoraHalmosResults,
    "/docs/subgraph-sync": subgraphSync,
    "/docs/archive": archiveReadme,
    "/docs/security-notes": securityNotes,
    "/docs/internal": internalDocsReadme,
    "/docs/ai-service": aiServiceReadme,
    "/docs/hybrid-indexer": indexerReadme,
};

export const MARKDOWN_DOC_ROUTES = Object.keys(MARKDOWN_DOC_SOURCES);
