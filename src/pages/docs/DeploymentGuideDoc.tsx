import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, GitBranch } from "lucide-react";
import { PRODUCTION_APP_URL } from "../../lib/docsNav";
import { Link } from "react-router-dom";

const envVars = [
    { key: "VITE_PRIVY_APP_ID", required: true, desc: "Privy app ID (dashboard) for sign-in and embedded EOA wallets on Ethereum Sepolia." },
    { key: "VITE_SUBGRAPH_URL", required: true, desc: "Graph Studio query URL — canonical slug medvault, version v0.2.0." },
    { key: "VITE_INDEXER_URL", required: false, desc: "Hybrid indexer API (default http://localhost:3300 in Docker indexer profile)." },
    { key: "PRIVATE_KEY", required: true, desc: "Deployer EOA for Hardhat scripts only. Never commit. Not read by Vite." },
    { key: "SEPOLIA_RPC_URL", required: true, desc: "JSON-RPC for Sepolia deploy, fork tests, and on-chain verification scripts." },
    { key: "GRAPH_STUDIO_DEPLOY_KEY", required: false, desc: "Graph Studio API key for subgraph deploy (or GRAPH_DEPLOY_KEY)." },
    { key: "GRAPH_SUBGRAPH_SLUG", required: false, desc: "Studio subgraph slug — default medvault." },
    { key: "CHAINLINK_FORWARDER", required: false, desc: "Per-upkeep Chainlink Automation forwarder for set-chainlink-forwarder.ts." },
    { key: "TRUSTED_RELAYER_ADDRESS", required: false, desc: "Relayer EOA to schedule cETH contract auth during deploy/wire." },
    { key: "RELAYER_PRIVATE_KEY", required: false, desc: "Relayer service signing key (relayer/.env, not Vite)." },
    { key: "COVERAGE_MIN_PCT", required: false, desc: "CI coverage gate threshold (default 85)." },
];

const depChecklist = [
    { label: "Privy app ID + login methods enabled in dashboard", cat: "Pre-deploy" },
    { label: "Testnet: embedded wallet funded with Ethereum Sepolia ETH (e.g. public faucet) for on-chain actions", cat: "Pre-deploy" },
    { label: "MetaMask or external wallet (optional) if you link it in Privy", cat: "Pre-deploy" },
    { label: ".env file populated from .env.example", cat: "Pre-deploy" },
    { label: "Node.js ≥ 20 installed", cat: "Pre-deploy" },
    { label: "`npm install` completed", cat: "Contract" },
    { label: "`npx hardhat compile` exits with 0 errors", cat: "Contract" },
    { label: "Contract addresses captured from deploy log", cat: "Contract" },
    { label: ".env updated with contract addresses", cat: "Contract" },
    { label: "subgraph.yaml updated with contract addresses", cat: "Subgraph" },
    { label: "`npm run codegen` completed in /subgraph", cat: "Subgraph" },
    { label: "`npm run build` completed in /subgraph", cat: "Subgraph" },
    { label: "`graph auth --studio <KEY>` authenticated", cat: "Subgraph" },
    { label: "Subgraph slug medvault + version v0.2.0 deployed to Graph Studio", cat: "Subgraph" },
    { label: "`graph deploy --studio medvault --version-label v0.2.0`", cat: "Subgraph" },
    { label: "VITE_SUBGRAPH_URL updated with Studio URL", cat: "Frontend" },
    { label: "`npm run dev` serves on localhost", cat: "Frontend" },
    { label: "App loads and shows FHE Ready indicator", cat: "Frontend" },
    { label: "Production frontend live at med-vault.xyz (Vercel custom domain)", cat: "Frontend" },
    { label: "HTTP relayer live (RPC, relayer key, REGISTRY_ADDRESS, SEMAPHORE_ADDRESS, FRONTEND_URL / CORS)", cat: "Ops" },
    { label: "ConfidentialETH scheduleContractAuth(relayer) for claim/withdraw *For helpers", cat: "Ops" },
    { label: "After deploy: npm run deploy:wiring:sepolia once 2-day timelock elapses", cat: "Ops" },
    { label: "Relayer FRONTEND_URL=https://med-vault.xyz (CORS for production)", cat: "Ops" },
    { label: "Optional: private drip service + `VITE_TESTNET_FAUCET_URL` (Ethereum Sepolia)", cat: "Ops" },
    { label: "Optional: `VITE_RELAYER_URL` or Vite `/relay` proxy for local CORS", cat: "Ops" },
    { label: "Relayer FRONTEND_URL includes https://localhost (Capacitor APK CORS)", cat: "Ops" },
    { label: "Privy dashboard allows https://localhost (Android WebView origin)", cat: "Ops" },
    { label: "Android: android/local.properties → SDK path; JDK 21 for Gradle", cat: "Mobile" },
    { label: "Android: `npm run mobile:apk:debug` produces app-debug.apk", cat: "Mobile" },
    { label: "Optional: Chainlink Automation upkeep for MedVaultAutomation + `setChainlinkForwarder`", cat: "Ops" },
];

const catColorStyles: Record<string, { bg: string; text: string }> = {
    "Pre-deploy": {
        bg: "bg-slate-100",
        text: "text-slate-700"
    },
    "Contract": {
        bg: "bg-blue-100",
        text: "text-blue-700"
    },
    "Subgraph": {
        bg: "bg-blue-100",
        text: "text-blue-700"
    },
    "Frontend": {
        bg: "bg-purple-100",
        text: "text-purple-700"
    },
    Ops: {
        bg: "bg-amber-100",
        text: "text-amber-800"
    },
    Mobile: {
        bg: "bg-teal-100",
        text: "text-teal-800"
    }
};

export function DeploymentGuideDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <Callout type="info" title="Production URL">
                    The public app is deployed at{" "}
                    <a href={PRODUCTION_APP_URL} className="font-semibold text-[#00685f] underline-offset-2 hover:underline">
                        med-vault.xyz
                    </a>
                    . Set the relayer&apos;s <code>FRONTEND_URL</code> to that origin (see{" "}
                    <code>relayer/.env.example</code>) so browser clients on production can call{" "}
                    <code>/relay/*</code> without CORS errors.
                </Callout>

                <Callout type="warning" title="Manual deployment — no CD">
                    GitHub Actions runs four CI workflows (contracts, frontend, docker-smoke, MCP). There is{" "}
                    <strong>no continuous deployment</strong> workflow. Production is released manually: Hardhat scripts
                    for contracts, Vercel for the frontend (<code>npm run vercel:ship</code>), Railway for the relayer,
                    and Graph Studio for the subgraph.
                </Callout>

                {/* CI workflows */}
                <div className="not-prose my-10">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-slate-600" />
                        CI workflows (no deploy step)
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-2 font-bold text-xs">Workflow</th>
                                    <th className="text-left px-4 py-2 font-bold text-xs">Trigger</th>
                                    <th className="text-left px-4 py-2 font-bold text-xs">Jobs</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs text-slate-600">
                                <tr className="border-b border-slate-100">
                                    <td className="px-4 py-2 font-mono">contracts-test.yml</td>
                                    <td className="px-4 py-2">push/PR main, master</td>
                                    <td className="px-4 py-2">test (unit, integration, crypto, fuzz), fork (needs SEPOLIA_RPC_URL secret), coverage gate</td>
                                </tr>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <td className="px-4 py-2 font-mono">frontend.yml</td>
                                    <td className="px-4 py-2">push/PR main, master</td>
                                    <td className="px-4 py-2">tsc --noEmit, build:prebuilt, Vitest</td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                    <td className="px-4 py-2 font-mono">docker-smoke.yml</td>
                                    <td className="px-4 py-2">push/PR main, master</td>
                                    <td className="px-4 py-2">docker:smoke (frontend Compose health)</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-mono">mcp.yml</td>
                                    <td className="px-4 py-2">path-filtered push/PR</td>
                                    <td className="px-4 py-2">mcp:build, export/validate config, smoke, @medvault/sdk tests</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Networks */}
                <h2>Networks</h2>
                <div className="not-prose overflow-x-auto my-6 rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold text-xs">Network</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Hardhat</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Chain ID</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-slate-600">
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-semibold">Ethereum Sepolia</td>
                                <td className="px-3 py-2 font-mono">sepolia</td>
                                <td className="px-3 py-2 font-mono">11155111</td>
                                <td className="px-3 py-2">Production testnet — deploy, frontend, relayer, subgraph</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2">Hardhat local</td>
                                <td className="px-3 py-2 font-mono">hardhat</td>
                                <td className="px-3 py-2 font-mono">31337</td>
                                <td className="px-3 py-2">Tests with auto timelock fast-forward</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2">Sepolia fork</td>
                                <td className="px-3 py-2 font-mono">sepoliaFork</td>
                                <td className="px-3 py-2 font-mono">11155111</td>
                                <td className="px-3 py-2">Fork tests (SEPOLIA_RPC_URL)</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2">Arbitrum</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">Reclaim + Semaphore addresses only — no full deploy</td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2">Mainnet</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">Not supported</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Pre-deploy checklist */}
                <div className="not-prose my-10">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        Full Deployment Checklist
                    </h3>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
                        {depChecklist.map((item, i) => {
                            const styles = catColorStyles[item.cat];
                            return (
                                <div key={i} className="flex items-center gap-4 px-5 py-3 bg-white hover:bg-slate-50 transition-colors">
                                    <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                                    <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>{item.cat}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>I. Step 1 — Smart Contract Deployment</h2>
                <p>
                    The Hardhat project targets <strong>Ethereum Sepolia</strong> (<code>chainId 11155111</code>). Contracts
                    use <code>@fhevm/solidity</code> for encrypted types and FHE precompiles. Set{" "}
                    <code>SEPOLIA_RPC_URL</code> and <code>PRIVATE_KEY</code> in <code>.env</code> before deploying.
                </p>

                <CodeBlock
                    filename="Terminal — Contract Compilation & Deploy"
                    language="bash"
                    code={`# Install all dependencies
npm install

# Clean previous compilation artifacts
npx hardhat clean

# Compile all contracts (@fhevm/solidity + @chainlink/contracts)
npx hardhat compile

# Deploy to Ethereum Sepolia (scripts/deploy.ts)
npm run deploy:sepolia

# If wiring did not finish (FHEVM init), complete cross-contract schedule*
npm run deploy:wire:sepolia

# After READER_CHANGE_DELAY (~2 days), apply pending wiring
npm run deploy:wiring:sepolia

# Verify on-chain references
npm run deploy:check-wiring:sepolia

# or: npx hardhat run scripts/deploy.ts --network sepolia`}
                />

                <Callout type="info" title="Timelock wiring">
                    Live networks use <code>schedule*</code> / <code>apply*</code> with a 2-day delay — not instant{" "}
                    <code>setAutomationContract</code> or <code>authorizeContract</code>. See{" "}
                    <a href="/docs/timelock-wiring" className="font-semibold text-[#00685f] underline-offset-2 hover:underline">
                        Timelock wiring
                    </a>{" "}
                    and <code>docs/TIMELOCK_WIRING.md</code>.
                </Callout>

                <Callout type="warning" title="Capture Contract Addresses Immediately">
                    After deploy, copy each contract address into <code>src/lib/contracts/addresses.json</code> (sepolia
                    key), <code>subgraph/subgraph.yaml</code>, and <code>relayer/.env</code>. Use{" "}
                    <code>scripts/fetch-sepolia-start-blocks.mjs</code> to refresh subgraph start blocks.
                </Callout>

                <hr className="my-12 border-slate-200" />

                <h2>II. Step 2 — Subgraph Deployment</h2>
                <p>
                    The Subgraph must be updated with the freshly deployed contract addresses before being re-deployed. The <code>subgraph.yaml</code> file is the primary configuration file — it maps contract addresses to their ABIs and specifies which events to listen to.
                </p>

                <CodeBlock
                    filename="subgraph/subgraph.yaml — Address Configuration"
                    language="yaml"
                    code={`specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: TrialManager
    network: sepolia
    source:
      # Paste the address from Hardhat deploy output here
      address: "0x000...000"
      abi: TrialManager
      startBlock: 0
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Trial
        - EligibilityResult
      abis:
        - name: TrialManager
          file: ./abis/TrialManager.json
      eventHandlers:
        - event: TrialCreated(indexed uint256,indexed address,string,string)
          handler: handleTrialCreated
      file: ./src/mappings/trial-manager.ts`}
                />

                <CodeBlock
                    filename="Terminal — Subgraph Build & Deploy"
                    language="bash"
                    code={`cd subgraph

# Install subgraph dependencies
npm install

# Generate typed AssemblyScript wrappers from ABIs
npm run codegen

# Compile mapping handlers into WASM
npm run build

# Authenticate with The Graph Studio
graph auth --studio <YOUR_DEPLOY_KEY>

# Deploy to your Studio subgraph slug
graph deploy --studio medvault --version-label v0.2.0`}
                />

                <Callout type="info" title="Canonical subgraph identity">
                    Slug <code>medvault</code>, version <code>v0.2.0</code>. See <code>docs/SUBGRAPH_SYNC.md</code> for
                    deploy commands, start blocks, and ops scripts.
                </Callout>

                <hr className="my-12 border-slate-200" />

                <h2>III. Step 3 — Frontend Environment Setup</h2>
                <p>
                    The Vite frontend reads all contract addresses and network configuration from a <code>.env</code> file at the project root. All variables are prefixed with <code>VITE_</code> to be exposed to the browser bundle by Vite's environment system.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-sm text-slate-700">Environment Variable Reference</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 text-xs">Variable</th>
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 text-xs">Required</th>
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 text-xs">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {envVars.map((v, i) => (
                                    <tr key={v.key} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                                        <td className="px-4 py-2 font-mono text-blue-600 text-xs align-top">{v.key}</td>
                                        <td className="px-4 py-2 text-xs align-top">
                                            {v.required
                                                ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Required</span>
                                                : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Optional</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-600">{v.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <CodeBlock
                    filename="Terminal — Launch Frontend Dev Server"
                    language="bash"
                    code={`# From the project root:
npm install

# Starts Vite on port 3000 with HMR enabled
# The app will be accessible at http://localhost:3000
npm run dev

# OR for production bundle (runs after full deployment validation):
npm run build && npm run preview

# Ship to Vercel (prebuilt; see README "Deployment"):
npm run vercel:ship`}
                />

                <Callout type="tip" title="Production hosting">
                    Configure <strong>med-vault.xyz</strong> as a custom domain on the Vercel project. Prebuilt deploys
                    use <code>npm run vercel:build</code> + <code>npm run vercel:deploy</code>; bake all{" "}
                    <code>VITE_*</code> variables at build time (GitHub Actions or <code>vercel pull</code> locally).
                </Callout>

                <Callout type="tip" title="Verify FHE Readiness in the Browser">
                    After launching, sign in with Privy and ensure the app finishes wallet + FHE setup. If Zama FHE stays disconnected, verify <code>VITE_PRIVY_APP_ID</code>, Ethereum Sepolia as the active chain, and optional <code>VITE_RPC_URL</code> for reads.
                </Callout>

                <Callout type="warning" title="Env vars used in code but easy to miss">
                    See <code>.env.example</code> for the full list. Gaps operators often forget:{" "}
                    <code>PRIVATE_KEY</code>, <code>GRAPH_STUDIO_DEPLOY_KEY</code> / <code>GRAPH_DEPLOY_KEY</code>,{" "}
                    <code>GRAPH_STUDIO_DEPLOY_NODE</code>, <code>GRAPH_SUBGRAPH_NETWORK</code>,{" "}
                    <code>VERIFY_DEPLOY_RPC_URL</code>, <code>COVERAGE_MIN_PCT</code>, <code>TRUSTED_RELAYER_ADDRESS</code>,{" "}
                    <code>MEDVAULT_NETWORK</code>, <code>MCP_HTTP_PORT</code>, <code>MCP_HTTP_HOST</code>,{" "}
                    <code>MCP_AUDIT_LOG</code>, <code>MCP_AUDIT_LOG_PATH</code>, <code>WATCHER_*</code>,{" "}
                    <code>BATCH_EXIT_*</code>, <code>GEMINI_API_KEY</code>, <code>CAPACITOR_BUILD</code>,{" "}
                    <code>DISABLE_HMR</code>, <code>AAVE_POOL</code>, <code>WETH_GATEWAY</code>, <code>AWETH</code>.
                </Callout>

                <hr className="my-12 border-slate-200" />

                <h2>V. Docker Compose (local ops)</h2>
                <p>
                    Three Dockerfiles (root frontend, <code>relayer/</code>, <code>indexer/</code>), ten Compose services,
                    four profiles: default frontend, <code>relayer</code>, <code>graph</code>, <code>indexer</code>.{" "}
                    <code>ai-service</code> and <code>mcp-server</code> are not containerized.
                </p>
                <CodeBlock
                    language="bash"
                    filename="Terminal — Docker profiles"
                    code={`cp .env.docker.example .env.local
docker compose up --build                                    # frontend :3000
docker compose --profile relayer up --build                  # + relayer :8787
docker compose --profile graph up --build                      # + local Graph Node
docker compose --profile indexer up --build                  # + Mongo, Redis, indexer :3300
npm run docker:smoke                                           # CI smoke test`}
                />
                <p>
                    Full reference: <code>docs/DOCKER.md</code> and <code>docs/LOCAL_DEVELOPMENT.md</code>.
                </p>

                <hr className="my-12 border-slate-200" />

                <h2>VI. Script inventory (36)</h2>
                <p>
                    All operational scripts under <code>scripts/</code> (33) plus <code>scripts/lib/</code> (3 shared modules).
                    Contract addresses ship in <code>packages/medvault-core/data/addresses.json</code> after deploy.
                </p>

                <h3>Deploy &amp; wiring (Sepolia)</h3>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2">Script</th><th className="text-left px-3 py-2">Purpose</th></tr></thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b"><td className="px-3 py-2 font-mono">deploy.ts</td><td className="px-3 py-2">Full stack deploy + schedule timelock wiring</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">wire-sepolia.ts</td><td className="px-3 py-2">Wire already-deployed contracts; refresh addresses.json + start blocks</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">finish-wiring.ts</td><td className="px-3 py-2">Apply pending timelocks after ~2 days</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">resume-sepolia-deploy.ts</td><td className="px-3 py-2">Resume partial deploy after RPC disconnect</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">check-wiring-status.ts</td><td className="px-3 py-2">Print on-chain wiring references</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">set-chainlink-forwarder.ts</td><td className="px-3 py-2">Schedule/apply Chainlink forwarder on MedVaultAutomation</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">diagnose-automation-upkeep.ts</td><td className="px-3 py-2">Debug why Chainlink upkeep is not firing</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">upgrade-attestation-sepolia.ts</td><td className="px-3 py-2">Noir attestation + gasless-claim stack upgrade</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">finish-attestation-upgrade-sepolia.ts</td><td className="px-3 py-2">Complete interrupted attestation upgrade wiring</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">redeploy-screening-vault.ts</td><td className="px-3 py-2">Redeploy SponsorIncentiveVault (screening fix)</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">deploy-verifier.ts</td><td className="px-3 py-2">Deploy both Honk verifiers; update addresses.json + VK fingerprints</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">approve-deployer-sponsor.ts</td><td className="px-3 py-2">Add deployer to SponsorRegistry allowlist</td></tr>
                            <tr><td className="px-3 py-2 font-mono">data-access-log-wiring.ts</td><td className="px-3 py-2">Authorize DataAccessLog loggers (imported by deploy scripts)</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3>Subgraph &amp; assets</h3>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2">Script</th><th className="text-left px-3 py-2">Purpose</th></tr></thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b"><td className="px-3 py-2 font-mono">redeploy-subgraph.js</td><td className="px-3 py-2">Sync ABIs, codegen, build, Graph Studio deploy</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">update-subgraph-yaml.js</td><td className="px-3 py-2">Patch subgraph.yaml from addresses.json</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">fetch-sepolia-start-blocks.mjs</td><td className="px-3 py-2">Resolve creation blocks; write start-blocks.json</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">set-subgraph-start-near-head.mjs</td><td className="px-3 py-2">Set start blocks to latest − 500</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">verify-subgraph-schema.mjs</td><td className="px-3 py-2">GraphQL smoke test on live deployment</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">find-registration-block.mjs</td><td className="px-3 py-2">Locate patient registration block</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">sync-abis.js</td><td className="px-3 py-2">Hardhat artifacts → frontend + subgraph ABIs</td></tr>
                            <tr><td className="px-3 py-2 font-mono">sync-sdk-assets.mjs</td><td className="px-3 py-2">Copy ABIs/addresses into @medvault packages</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3>CI, circuits, frontend ship, mobile</h3>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2">Script</th><th className="text-left px-3 py-2">Purpose</th></tr></thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b"><td className="px-3 py-2 font-mono">verify-production-deploy.mjs</td><td className="px-3 py-2">CI guard: no Mock* in deploy scripts; optional on-chain testHelpers check</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">verify-honk-verifier.mjs</td><td className="px-3 py-2">CI guard: both Honk verifiers match circuit artifacts</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">check-coverage-gate.mjs</td><td className="px-3 py-2">Enforce COVERAGE_MIN_PCT (default 85%)</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">hardhat-test-suite.mjs</td><td className="px-3 py-2">TEST_SUITE router for npm test scripts</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">docker-compose-smoke.mjs</td><td className="px-3 py-2">Frontend Compose health check</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">compile-circuit.js</td><td className="px-3 py-2">Build both Noir circuits (plaintext + encrypted)</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">compile-circuit-wsl.sh</td><td className="px-3 py-2">nargo compile both circuits → src/lib/circuits/</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">generate-honk-verifier.js</td><td className="px-3 py-2">Generate HonkVerifier.sol + HonkVerifierEncrypted.sol</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">deploy-encrypted-verifier-sepolia.ts</td><td className="px-3 py-2">Deploy HonkVerifierEncrypted + schedule engine wiring</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">wsl-install-nargo.sh</td><td className="px-3 py-2">Install Noir toolchain on WSL</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">pack-vercel-static-output.mjs</td><td className="px-3 py-2">Package Vercel prebuilt static output</td></tr>
                            <tr className="border-b"><td className="px-3 py-2 font-mono">android-apk.mjs</td><td className="px-3 py-2">Build debug/release APK via Gradle</td></tr>
                            <tr><td className="px-3 py-2 font-mono">setup-android-sdk.mjs</td><td className="px-3 py-2">Write android/local.properties SDK path</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3>Shared libraries (scripts/lib/)</h3>
                <ul className="text-sm">
                    <li><code>timelockWiring.ts</code> — schedule/apply helpers, <code>wireAllContracts()</code>, FHEVM init</li>
                    <li><code>networkAddresses.ts</code> — load <code>addresses.json</code> by network key</li>
                    <li><code>deployAnonymousPatientRegistry.ts</code> — Poseidon-linked registry deploy</li>
                </ul>

                <hr className="my-12 border-slate-200" />

                <h2>VII. Production runbooks</h2>

                <h3>Full Sepolia deploy (greenfield)</h3>
                <CodeBlock
                    language="bash"
                    filename="Runbook — full deploy"
                    code={`npm run build:circuit                    # if circuit changed
npm run deploy:sepolia                     # deploy + schedule wiring
npm run deploy:wire:sepolia                # if wiring failed mid-flight
# wait ~2 days
npm run deploy:wiring:sepolia              # apply timelocks
npm run deploy:check-wiring:sepolia
npm run sync-abis && npm run sync-sdk-assets
npm run subgraph:fetch-start-blocks
npm run subgraph:deploy                    # Graph Studio medvault/v0.2.0
# optional Chainlink:
CHAINLINK_FORWARDER=0x... npm run deploy:chainlink-forwarder:sepolia
# frontend:
npm run vercel:ship
# relayer: deploy relayer/ to Railway; set relayer/.env from addresses.json`}
                />

                <h3>Attestation upgrade</h3>
                <CodeBlock
                    language="bash"
                    code={`npm run build:circuit
npm run deploy:upgrade:sepolia             # upgrade-attestation-sepolia.ts
npm run deploy:finish-upgrade:sepolia      # if interrupted
npm run subgraph:fetch-start-blocks && npm run subgraph:deploy`}
                />

                <h3>Screening vault redeploy</h3>
                <CodeBlock
                    language="bash"
                    code={`npm run deploy:vault:sepolia             # redeploy-screening-vault.ts
npm run subgraph:fetch-start-blocks && npm run subgraph:deploy`}
                />

                <h3>Partial deploy resume</h3>
                <CodeBlock
                    language="bash"
                    code={`npx hardhat run scripts/resume-sepolia-deploy.ts --network sepolia
# Edit PARTIAL addresses in script if resuming from a different checkpoint`}
                />

                <h3>Chainlink Automation ops</h3>
                <p>
                    Task type <strong>1 only</strong>: finalize expired trials (distribute screening + deactivate).{" "}
                    <code>performUpkeep</code> is <code>onlyForwarder</code>. Forwarder and vault pointers use 2-day timelock.
                    See <Link to="/docs/automation" className="font-semibold text-[#00685f] hover:underline">Chainlink Automation</Link>.
                </p>
                <CodeBlock
                    language="bash"
                    code={`npx hardhat run scripts/diagnose-automation-upkeep.ts --network sepolia
CHAINLINK_FORWARDER=0x... npm run deploy:chainlink-forwarder:sepolia`}
                />

                <hr className="my-12 border-slate-200" />

                <h2>VIII. Android demo APK (Capacitor)</h2>
                <p>
                    The same Vite frontend can be packaged as an installable Android APK for internal demos. See the{" "}
                    <a href="/docs/mobile/android-apk" className="font-semibold text-[#00685f] underline-offset-2 hover:underline">
                        Android APK runbook
                    </a>{" "}
                    and repo <code>docs/ANDROID_APK.md</code>.
                </p>
                <CodeBlock
                    language="bash"
                    filename="Terminal — Android APK"
                    code={`# Android Studio (recommended):
npm run mobile:studio
# → Run ▶ or Build → Build APK(s)

# CLI only:
npm run mobile:apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk`}
                />
                <Callout type="warning" title="Mobile-specific ops">
                    Add <code>https://localhost</code> to Privy allowed origins and relayer{" "}
                    <code>FRONTEND_URL</code> (comma-separated with production). Create{" "}
                    <code>android/local.properties</code> with your SDK path; Gradle needs JDK 21.
                </Callout>

            </Prose>
        </motion.div>
    );
}
