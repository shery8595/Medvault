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

const SILENT_FAILURE_GUARD = `import {
  captureRecipientBalanceBefore,
  guardConfidentialTransfer,
  SilentFailureDetected,
} from "@medvault/sdk";

const balanceBefore = await captureRecipientBalanceBefore(
  zamaSdk,
  confidentialEthAddress,
  recipient,
  provider
);

// ... send confidential transfer tx, await receipt ...

try {
  const delta = await guardConfidentialTransfer({
    tokenAddress: confidentialEthAddress,
    recipient,
    intendedAmount: 5n,
    provider,
    sdk: zamaSdk,
    balanceBefore,
    receipt,
  });
  console.log("Transferred", delta.toString());
} catch (err) {
  if (err instanceof SilentFailureDetected) {
    console.error("Silent transfer failure", err.plaintextDelta, err.intendedAmount);
  }
  throw err;
}`;

const CORE_CONFIG = `import { loadConfigFromEnv, type MedVaultConfig } from "@medvault/core";

const config = loadConfigFromEnv();
// rpcUrl, subgraphUrl, networkKey, sponsorOpenAccess, relayerUrl, maxEthPerTx, readOnly`;

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
                <p>
                    Peer dependency: <code>ethers@6.16.0</code> (required for sponsor writes and the silent-failure guard).
                </p>
                <CodeBlock
                    language="bash"
                    code={`npm install
npm run sdk:build
npm run sdk:test   # 11 unit tests

# After contract deploy / sync-abis:
npm run sync-sdk-assets`}
                />

                <p>
                    Monorepo path: <code>packages/medvault-sdk/</code>. Maintainer README:{" "}
                    <code>packages/medvault-sdk/README.md</code>.
                </p>

                <h2>Quick start</h2>
                <CodeBlock language="typescript" code={QUICK_START} />

                <h2>Public exports</h2>
                <p>
                    Matches <code>packages/medvault-sdk/src/index.ts</code> exactly:
                </p>
                <ul>
                    <li>
                        <code>MedVaultSDK</code>, <code>MedVaultSDKConfig</code>
                    </li>
                    <li>
                        <code>RelayerSemaphoreProof</code>, <code>RelayerStageApplyParams</code>,{" "}
                        <code>RelayerFinalizeApplyParams</code>
                    </li>
                    <li>
                        <code>NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE</code>, <code>serializeProofForRelay</code>
                    </li>
                    <li>
                        <code>SilentFailureDetected</code>, <code>captureRecipientBalanceBefore</code>,{" "}
                        <code>assertConfidentialTransferSucceeded</code>, <code>guardConfidentialTransfer</code>
                    </li>
                    <li>
                        <code>SilentFailureGuardOptions</code>, <code>ZamaDecryptSdk</code>
                    </li>
                    <li>
                        <code>CreateTrialParams</code>, <code>CreateTrialResult</code> (re-exported from{" "}
                        <code>@medvault/core</code>)
                    </li>
                </ul>

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
                                <td className="p-3 font-mono text-xs">networkKey / MEDVAULT_NETWORK</td>
                                <td className="p-3">
                                    <code>sepolia</code> (default) or <code>hardhat</code>
                                </td>
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

                <h2>MedVaultSDK class</h2>
                <ul>
                    <li>
                        <code>static create(input?: MedVaultSDKConfig)</code>
                    </li>
                    <li>
                        <code>config</code>, <code>provider</code>, <code>signer</code>, <code>trials</code>,{" "}
                        <code>sponsor</code>, <code>protocol</code>, <code>relayer</code>
                    </li>
                    <li>
                        <code>chainId</code> — <code>11155111n</code> (Sepolia)
                    </li>
                    <li>
                        <code>getSignerAddress()</code> — <code>Promise&lt;string | null&gt;</code>
                    </li>
                </ul>

                <h2>Modules</h2>
                <div className="not-prose overflow-x-auto my-4">
                    <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Module</th>
                                <th className="text-left p-3 font-semibold">Methods</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="p-3 font-mono text-xs align-top">sdk.trials</td>
                                <td className="p-3">
                                    <code>listActive(options?: {"{ first?, skip? }"})</code>,{" "}
                                    <code>getBySponsor(sponsor)</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs align-top">sdk.sponsor</td>
                                <td className="p-3">
                                    Reads: <code>getVerification</code>, <code>getStats</code>, <code>getMatches</code>,{" "}
                                    <code>getAuditLogs</code>, <code>getTrialPoolStatus</code>. Writes (signer):{" "}
                                    <code>createTrial</code>, <code>setMilestones</code>, <code>fundPool</code>,{" "}
                                    <code>updateApplicationStatus</code>, <code>deactivate</code>,{" "}
                                    <code>distributeMilestone</code> (paginated when pool &gt; 20),{" "}
                                    <code>reclaimPool</code> (verified sponsor),{" "}
                                    <code>reclaimAbandonedPool</code> (vault owner),{" "}
                                    <code>claimReclaimedPool</code>.
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs align-top">sdk.patient</td>
                                <td className="p-3">
                                    <code>enrollInRewardPool(trialId, nullifier, {"{ identitySecret? }"})</code> — MED-3
                                    pool enrollment after sponsor acceptance; pass Semaphore{" "}
                                    <code>identity.secretScalar</code> when patient EOA ≠ permit holder.
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs align-top">sdk.protocol</td>
                                <td className="p-3">
                                    <code>getAddresses()</code>, <code>listContracts()</code>, <code>checkWiring()</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs align-top">sdk.relayer</td>
                                <td className="p-3">
                                    <code>health()</code>, <code>stageApply(params)</code>,{" "}
                                    <code>finalizeApply(params)</code>, <code>relayClaim(params)</code>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Sponsor writes</h2>
                <p>
                    The wallet must be verified on <code>SponsorRegistry</code> (or use open-access on testnet). Same rules
                    and operations as{" "}
                    <Link to="/docs/mcp/tools" className="text-[#00685f] font-semibold hover:underline">
                        MCP sponsor tools
                    </Link>{" "}
                    — the MCP server wraps <code>sdk.sponsor.*</code> write methods for AI agents.
                </p>
                <CodeBlock language="typescript" code={SPONSOR_WRITE} />

                <h2>Silent-failure guard</h2>
                <p>
                    FHE confidential transfers can succeed on-chain while the recipient&apos;s plaintext balance does not
                    change. The guard decrypts the recipient balance before and after the transfer (Zama{" "}
                    <code>grantPermit</code> + <code>decryptValues</code>) — it does <em>not</em> compare raw ciphertext
                    handles. Throws <code>SilentFailureDetected</code> when <code>intendedAmount &gt; 0</code> but the
                    plaintext delta is zero.
                </p>
                <CodeBlock language="typescript" code={SILENT_FAILURE_GUARD} />

                <h2>Relayer client</h2>
                <p>
                    <code>sdk.relayer</code> mirrors the production relayer HTTP API. Full reference:{" "}
                    <code>relayer/README.md</code> in the repo.
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
                        <code>eligible: true</code> and threshold decrypt signature from the client)
                    </li>
                    <li>
                        <code>POST /relay/claim</code> — <code>sdk.relayer.relayClaim(...)</code>
                    </li>
                    <li>
                        <code>POST /relay/completion-proof</code> — KMS proof for withdraw/unstake completion
                    </li>
                    <li>
                        <code>POST /relay/public-exit</code> — fast (<code>exitMode=0</code>) or batched private exit (
                        <code>exitMode=1</code>)
                    </li>
                    <li>
                        <code>POST /relay/pin-document</code> — server-side IPFS pin (Pinata)
                    </li>
                    <li>
                        <code>POST /relay/apply</code> — deprecated (410); use stage + finalize
                    </li>
                </ul>
                <p>
                    Export <code>NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE</code> and <code>serializeProofForRelay</code> from{" "}
                    <code>@medvault/sdk</code> when building custom anonymous-apply UIs.
                </p>

                <h2>@medvault/core</h2>
                <p>
                    Low-level protocol library used by the SDK, MCP server, indexer, and AI service. Full reference:{" "}
                    <code>packages/medvault-core/README.md</code>.
                </p>
                <CodeBlock language="typescript" code={CORE_CONFIG} />
                <p>Key exports from <code>packages/medvault-core/src/index.ts</code>:</p>
                <ul>
                    <li>
                        Config: <code>loadConfigFromEnv</code>, <code>MedVaultConfig</code>, <code>NetworkKey</code>,{" "}
                        <code>ETHEREUM_SEPOLIA_CHAIN_ID</code>, <code>DEFAULT_RPC_URL</code>
                    </li>
                    <li>
                        Contracts: <code>getContract</code>, <code>getContractAddresses</code>,{" "}
                        <code>resolveNetworkKey</code>, <code>addresses</code>, <code>ContractName</code>, convenience
                        getters (<code>getTrialManager</code>, etc.)
                    </li>
                    <li>
                        Subgraph: <code>SUBGRAPH_QUERIES</code>, <code>ALLOWED_SUBGRAPH_QUERY_NAMES</code>,{" "}
                        <code>postSubgraph</code>
                    </li>
                    <li>
                        Sponsor: <code>createTrialOnChain</code>, <code>fundTrialPool</code>,{" "}
                        <code>assertSponsorCanWrite</code>, <code>getSponsorVerification</code>, and related ops
                    </li>
                    <li>
                        Audit: <code>fetchAuditLogsFromChain</code>, <code>AUDIT_ACTION_TYPES</code>
                    </li>
                    <li>
                        Wiring: <code>checkWiring</code>, <code>PROTOCOL_CONTRACTS</code>
                    </li>
                    <li>
                        Errors: <code>normalizeTxError</code>, <code>friendlyTrialManagerRevert</code>
                    </li>
                </ul>
                <Callout type="warning" title="Engineering gap — core tests not CI-wired">
                    <code>packages/medvault-core/tests/resolveNetworkKey.test.ts</code> exists but the package has no{" "}
                    <code>test</code> script in <code>package.json</code>. Wire it into CI as a separate engineering task.
                </Callout>

                <h2>Examples</h2>
                <p>
                    Build first (<code>npm run sdk:build</code>). Examples use Sepolia addresses from{" "}
                    <code>packages/medvault-core/data/addresses.json</code>.
                </p>
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
packages/medvault-core/    # contracts, subgraph, sponsor ops — packages/medvault-core/README.md
mcp-server/                # MCP tools wrapping sdk.sponsor writes
relayer/                   # gasless relay — relayer/README.md
ai-service/                # @medvault/ai — ai-service/README.md
indexer/                   # hybrid indexer API — indexer/README.md`}
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
