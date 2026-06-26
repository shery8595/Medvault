import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const QUICK_START = `import { MedVaultSDK } from "@medvault/sdk";

const sdk = MedVaultSDK.create({
  rpcUrl: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  subgraphUrl: process.env.MEDVAULT_SUBGRAPH_URL!,
  relayerUrl: process.env.MEDVAULT_RELAYER_URL,
});

const trials = await sdk.trials.listActive({ first: 10 });
const health = await sdk.relayer.health();`;

const SPONSOR_WRITE = `import { ethers } from "ethers";
import { MedVaultSDK } from "@medvault/sdk";

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL!);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const sdk = MedVaultSDK.create({
  subgraphUrl: process.env.MEDVAULT_SUBGRAPH_URL!,
  signer,
  sponsorOpenAccess: process.env.MEDVAULT_SPONSOR_OPEN_ACCESS === "true",
});

const { trialId, txHashes } = await sdk.sponsor.createTrial({
  name: "Integrator Trial",
  phase: "Phase 1",
  location: "Remote",
  compensation: "Testnet",
  minAge: 18,
  maxAge: 65,
  requiresDiabetes: false,
  minHb: 0,
  genderRequirement: 0,
  minHeight: 0,
  maxWeight: 300,
  requiresNonSmoker: false,
  requiresNormalBP: false,
  durationSeconds: 86400 * 30,
});`;

export function SdkDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    <strong>@medvault/sdk</strong> is a TypeScript library for integrators, scripts, and the local{" "}
                    <Link to="/docs/mcp" className="text-[#00685f] font-semibold hover:underline">
                        MCP server
                    </Link>
                    . It wraps <code>@medvault/core</code> with a single <code>MedVaultSDK.create()</code> entry point.
                    <strong> No hosting required</strong> — unlike the gasless relayer, the SDK runs wherever you run Node.
                </p>

                <Callout type="info" title="Separate from the browser dApp">
                    The React portal at med-vault.xyz does not import the SDK. Patient FHE, Semaphore, and Noir flows stay
                    in the browser. The SDK covers subgraph reads, sponsor operations, protocol metadata, and HTTP calls to
                    your deployed relayer.
                </Callout>

                <h2>Install &amp; build</h2>
                <CodeBlock
                    language="bash"
                    code={`npm install
npm run sdk:build
npm run sdk:test   # optional — 6 unit tests

# After contract deploy / sync-abis:
npm run sync-sdk-assets`}
                />

                <p>
                    Monorepo path: <code>packages/medvault-sdk/</code>. Maintainer README:{" "}
                    <code>packages/medvault-sdk/README.md</code>.
                </p>

                <h2>Quick start</h2>
                <CodeBlock language="typescript" code={QUICK_START} />

                <h2>Configuration</h2>
                <p>
                    Pass options to <code>MedVaultSDK.create()</code> or rely on process env (same names as MCP where
                    applicable):
                </p>
                <div className="not-prose overflow-x-auto my-4">
                    <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Field / env</th>
                                <th className="text-left p-3 font-semibold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="p-3 font-mono text-xs">subgraphUrl / MEDVAULT_SUBGRAPH_URL</td>
                                <td className="p-3">Required for trial &amp; sponsor subgraph reads</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">rpcUrl / SEPOLIA_RPC_URL</td>
                                <td className="p-3">JSON-RPC for on-chain reads and sponsor writes</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">relayerUrl / MEDVAULT_RELAYER_URL</td>
                                <td className="p-3">Base URL for <code>sdk.relayer.*</code> (gasless anonymous apply)</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">signer</td>
                                <td className="p-3">ethers Signer — required for sponsor write methods</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">sponsorOpenAccess</td>
                                <td className="p-3">Testnet-only bypass of SponsorRegistry verification</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Modules</h2>
                <div className="not-prose overflow-x-auto my-4">
                    <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Module</th>
                                <th className="text-left p-3 font-semibold">Methods (summary)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="p-3 font-mono text-xs">sdk.trials</td>
                                <td className="p-3">
                                    <code>listActive</code>, <code>getBySponsor</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">sdk.sponsor</td>
                                <td className="p-3">
                                    <code>getVerification</code>, <code>getStats</code>, <code>getMatches</code>,{" "}
                                    <code>getAuditLogs</code>, <code>getTrialPoolStatus</code>; writes:{" "}
                                    <code>createTrial</code>, <code>fundPool</code>, <code>setMilestones</code>,{" "}
                                    <code>updateApplicationStatus</code>, <code>deactivate</code>,{" "}
                                    <code>distributeMilestone</code>, <code>registerAnonymousParticipant</code>,{" "}
                                    <code>reclaimPool</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">sdk.protocol</td>
                                <td className="p-3">
                                    <code>getAddresses</code>, <code>listContracts</code>, <code>checkWiring</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">sdk.relayer</td>
                                <td className="p-3">
                                    <code>health</code>, <code>stageApply</code>, <code>finalizeApply</code> — HTTP to your
                                    hosted relayer
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Sponsor writes</h2>
                <p>
                    The wallet must be verified on <code>SponsorRegistry</code> (or use open-access on testnet). Same rules
                    as{" "}
                    <Link to="/docs/mcp/tools" className="text-[#00685f] font-semibold hover:underline">
                        MCP sponsor tools
                    </Link>
                    .
                </p>
                <CodeBlock language="typescript" code={SPONSOR_WRITE} />

                <h2>Relayer client</h2>
                <p>
                    <code>sdk.relayer</code> mirrors the production relayer routes documented under{" "}
                    <Link to="/docs/identity-privacy" className="text-[#00685f] font-semibold hover:underline">
                        Identity &amp; privacy
                    </Link>
                    :
                </p>
                <ul>
                    <li>
                        <code>GET /health</code> — <code>sdk.relayer.health()</code>
                    </li>
                    <li>
                        <code>POST /relay/apply-stage</code> — <code>sdk.relayer.stageApply(...)</code>
                    </li>
                    <li>
                        <code>POST /relay/apply-finalize</code> — <code>sdk.relayer.finalizeApply(...)</code> (requires{" "}
                        <code>decryptedEligible: true</code> and threshold decrypt signature from the client)
                    </li>
                </ul>
                <p>
                    Export <code>NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE</code> and <code>serializeProofForRelay</code> from{" "}
                    <code>@medvault/sdk</code> when building custom anonymous-apply UIs.
                </p>

                <h2>Examples</h2>
                <CodeBlock
                    language="bash"
                    code={`npm run sdk:build

MEDVAULT_SUBGRAPH_URL=https://... \\
  node packages/medvault-sdk/examples/list-trials.mjs

MEDVAULT_RELAYER_URL=https://... \\
  node packages/medvault-sdk/examples/relayer-health.mjs

PRIVATE_KEY=0x... MEDVAULT_SUBGRAPH_URL=https://... \\
  node packages/medvault-sdk/examples/sponsor-create-trial.mjs`}
                />

                <h2>Repository layout</h2>
                <CodeBlock
                    language="text"
                    code={`packages/medvault-sdk/   # @medvault/sdk — public facade
packages/medvault-core/    # contracts, subgraph, sponsor ops (SDK dependency)
mcp-server/                # uses SDK in medvault_get_config`}
                />

                <h2>Security</h2>
                <ul>
                    <li>Never commit <code>PRIVATE_KEY</code> or relayer operator keys.</li>
                    <li>SDK does not decrypt patient vitals or generate Semaphore identities.</li>
                    <li>Relayer finalize only succeeds when the client attests FHE eligibility.</li>
                </ul>

                <Callout type="warning" title="Not a hosted API">
                    The SDK is an npm workspace package. You still host the relayer and faucet separately if you use those
                    features.
                </Callout>

                <p>
                    See also:{" "}
                    <Link to="/docs/mcp" className="text-[#00685f] font-semibold hover:underline">
                        MCP overview
                    </Link>
                    ,{" "}
                    <Link to="/docs/mcp/setup" className="text-[#00685f] font-semibold hover:underline">
                        MCP setup
                    </Link>
                    ,{" "}
                    <Link to="/docs/mcp/tools" className="text-[#00685f] font-semibold hover:underline">
                        MCP tools
                    </Link>
                    .
                </p>
            </Prose>
        </motion.div>
    );
}
