import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Terminal, Database, Server, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { PRODUCTION_APP_URL } from "../../lib/docsNav";

const envVars = [
    { key: "VITE_PRIVY_APP_ID", required: true, desc: "Privy app ID (dashboard) for sign-in and embedded EOA wallets on Arbitrum Sepolia." },
    { key: "VITE_REGISTRY_ADDRESS", required: true, desc: "MedVaultRegistry (or related registry) address from deploy output / addresses.json." },
    { key: "VITE_TRIAL_MANAGER_ADDRESS", required: true, desc: "TrialManager proxy contract address." },
    { key: "VITE_ELIGIBILITY_ENGINE_ADDRESS", required: true, desc: "EligibilityEngine contract address." },
    { key: "VITE_SPONSOR_REGISTRY_ADDRESS", required: true, desc: "SponsorRegistry contract address." },
    { key: "VITE_SUBGRAPH_URL", required: true, desc: "The Graph Studio deployment URL for the medvault-subgraph. Found in Studio dashboard after deploy." },
    { key: "VITE_CHAIN_ID", required: true, desc: "Chain ID for Arbitrum Sepolia: 421614." },
    { key: "DEPLOY_PRIVATE_KEY", required: true, desc: "Private key of the deployer EOA. Never commit to git. Used only by Hardhat." },
    { key: "GRAPH_STUDIO_DEPLOY_KEY", required: false, desc: "Your Graph Studio API key for `graph deploy`. Found in Studio settings." },
];

const depChecklist = [
    { label: "Privy app ID + login methods enabled in dashboard", cat: "Pre-deploy" },
    { label: "Testnet: embedded wallet funded with Arbitrum Sepolia ETH (e.g. public faucet) for on-chain actions", cat: "Pre-deploy" },
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
    { label: "`graph deploy --studio medvault-subgraph`", cat: "Subgraph" },
    { label: "VITE_SUBGRAPH_URL updated with Studio URL", cat: "Frontend" },
    { label: "`npm run dev` serves on localhost", cat: "Frontend" },
    { label: "App loads and shows FHE Ready indicator", cat: "Frontend" },
    { label: "Production frontend live at med-vault.xyz (Vercel custom domain)", cat: "Frontend" },
    { label: "HTTP relayer live (RPC, relayer key, REGISTRY_ADDRESS, SEMAPHORE_ADDRESS, FRONTEND_URL / CORS)", cat: "Ops" },
    { label: "Relayer FRONTEND_URL=https://med-vault.xyz (CORS for production)", cat: "Ops" },
    { label: "Optional: private faucet (`arb-sepolia-faucet`) + `VITE_TESTNET_FAUCET_URL`", cat: "Ops" },
    { label: "Optional: `VITE_RELAYER_URL` or Vite `/relay` proxy for local CORS", cat: "Ops" },
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
                    The Hardhat project is pre-configured with a custom <code>fhenixSepolia</code> network entry pointing to Fhenix's testnet RPC. Contracts use <code>@fhenixprotocol/fhevm</code>, which is a drop-in replacement for standard Solidity but includes the FHE precompile importers.
                </p>

                <CodeBlock
                    filename="Terminal — Contract Compilation & Deploy"
                    language="bash"
                    code={`# Install all dependencies
npm install

# Clean previous compilation artifacts
npx hardhat clean

# Compile all contracts (includes @fhenixprotocol/fhevm and @chainlink/contracts)
npx hardhat compile

# Deploy to the Fhenix Sepolia testnet
# This runs scripts/deploy.js which deploys all contracts in order:
# 1. SponsorRegistry, 2. MedVaultRegistry, 3. TrialManager, 4. EligibilityEngine
npx hardhat deploy --network fhenixSepolia`}
                />

                <Callout type="warning" title="Capture Contract Addresses Immediately">
                    After a successful deploy, Hardhat will print each contract's address to the console. Copy them now — they are needed for <strong>both</strong> the frontend <code>.env</code> file and the Subgraph's <code>subgraph.yaml</code>. If you lose them, you can re-query them via Hardhat's artifact files in <code>./deployments/fhenixSepolia/</code>.
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
graph deploy --studio medvault-subgraph --version-label v0.1.7`}
                />

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
                    After launching, sign in with Privy and ensure the app finishes wallet + FHE setup. If CoFHE stays disconnected, verify <code>VITE_PRIVY_APP_ID</code>, Arbitrum Sepolia as the active chain, and optional <code>VITE_RPC_URL</code> for reads.
                </Callout>

            </Prose>
        </motion.div>
    );
}
