import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { motion } from "framer-motion";
import { Terminal, Database, Server, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

const envVars = [
    { key: "VITE_REGISTRY_ADDRESS", required: true, desc: "PatientRegistry proxy contract address from Hardhat deploy output." },
    { key: "VITE_TRIAL_MANAGER_ADDRESS", required: true, desc: "TrialManager proxy contract address." },
    { key: "VITE_ELIGIBILITY_ENGINE_ADDRESS", required: true, desc: "EligibilityEngine contract address." },
    { key: "VITE_SPONSOR_REGISTRY_ADDRESS", required: true, desc: "SponsorRegistry contract address." },
    { key: "VITE_SUBGRAPH_URL", required: true, desc: "The Graph Studio deployment URL for the medvault-subgraph. Found in Studio dashboard after deploy." },
    { key: "VITE_CHAIN_ID", required: true, desc: "Chain ID for the target Fhenix testnet (e.g., 9001 for Fhenix Sepolia)." },
    { key: "DEPLOY_PRIVATE_KEY", required: true, desc: "Private key of the deployer EOA. Never commit to git. Used only by Hardhat." },
    { key: "GRAPH_STUDIO_DEPLOY_KEY", required: false, desc: "Your Graph Studio API key for `graph deploy`. Found in Studio settings." },
];

const depChecklist = [
    { label: "MetaMask funded with Sepolia ETH", cat: "Pre-deploy" },
    { label: "Fhenix Sepolia RPC added to MetaMask", cat: "Pre-deploy" },
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
];

const catColorStyles: Record<string, { bg: string; text: string }> = {
    "Pre-deploy": {
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-700 dark:text-slate-300"
    },
    "Contract": {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400"
    },
    "Subgraph": {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400"
    },
    "Frontend": {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400"
    }
};

export function DeploymentGuideDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Operations</span>
                <h1 className="mt-2 text-5xl">Deployment Guide</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    Deploying MedVault involves three independent but tightly coupled systems: <strong>smart contracts</strong> on the Fhenix Sepolia testnet, a <strong>Subgraph</strong> on The Graph Studio, and the <strong>Vite frontend</strong>. They must be deployed in strict order, with addresses propagated between each step.
                </p>

                {/* Pre-deploy checklist */}
                <div className="not-prose my-10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        Full Deployment Checklist
                    </h3>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                        {depChecklist.map((item, i) => {
                            const styles = catColorStyles[item.cat];
                            return (
                                <div key={i} className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{item.label}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}>{item.cat}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

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
# 1. SponsorRegistry, 2. PatientRegistry, 3. TrialManager, 4. EligibilityEngine
npx hardhat deploy --network fhenixSepolia`}
                />

                <Callout type="warning" title="Capture Contract Addresses Immediately">
                    After a successful deploy, Hardhat will print each contract's address to the console. Copy them now — they are needed for <strong>both</strong> the frontend <code>.env</code> file and the Subgraph's <code>subgraph.yaml</code>. If you lose them, you can re-query them via Hardhat's artifact files in <code>./deployments/fhenixSepolia/</code>.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

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

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>III. Step 3 — Frontend Environment Setup</h2>
                <p>
                    The Vite frontend reads all contract addresses and network configuration from a <code>.env</code> file at the project root. All variables are prefixed with <code>VITE_</code> to be exposed to the browser bundle by Vite's environment system.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Environment Variable Reference</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 dark:text-slate-300 text-xs">Variable</th>
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 dark:text-slate-300 text-xs">Required</th>
                                    <th className="text-left px-4 py-2 font-bold text-slate-700 dark:text-slate-300 text-xs">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {envVars.map((v, i) => (
                                    <tr key={v.key} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400 text-xs align-top">{v.key}</td>
                                        <td className="px-4 py-2 text-xs align-top">
                                            {v.required
                                                ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">Required</span>
                                                : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">Optional</span>
                                            }
                                        </td>
                                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">{v.desc}</td>
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
npm run build && npm run preview`}
                />

                <Callout type="tip" title="Verify FHE Readiness in the Browser">
                    After launching, look for the <strong>FHE Ready</strong> green badge in the top-right corner of the Dashboard header. If it shows <strong>FHE Initializing</strong> or an error, the frontend failed to connect to the Fhenix RPC — double-check your MetaMask network configuration and the <code>VITE_CHAIN_ID</code> variable.
                </Callout>

            </Prose>
        </motion.div>
    );
}
