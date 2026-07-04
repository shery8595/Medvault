import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";

const ProtocolFlowDiagram = lazy(() =>
    import("../../components/docs/ProtocolFlowDiagram").then((m) => ({ default: m.ProtocolFlowDiagram }))
);
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { CONTRACT_INTERACTION_ROWS, PROTOCOL_CONTRACTS } from "../../lib/protocolContracts";
import { REPO_STATS } from "../../lib/docsStats";
import { motion } from "framer-motion";
import { Database, Shield, Activity, Users, Server, Fingerprint, Layers, Coins } from "lucide-react";
import { cn } from "../../lib/utils";

const LAYER_STYLES: Record<string, { box: string; icon: string }> = {
    blue: { box: "bg-blue-50 border-blue-200", icon: "bg-blue-100 text-blue-700" },
    teal: { box: "bg-teal-50 border-teal-200", icon: "bg-teal-100 text-teal-700" },
    purple: { box: "bg-violet-50 border-violet-200", icon: "bg-violet-100 text-violet-700" },
    amber: { box: "bg-amber-50 border-amber-200", icon: "bg-amber-100 text-amber-800" },
    rose: { box: "bg-rose-50 border-rose-200", icon: "bg-rose-100 text-rose-700" },
};

const layers = [
    {
        color: "blue",
        icon: <Users className="h-4 w-4" />,
        title: "Client layer",
        body: "React + Vite, Privy wallets, @zama-fhe/sdk for encryption and proofs. Plaintext health metrics never leave the browser unencrypted.",
    },
    {
        color: "teal",
        icon: <Fingerprint className="h-4 w-4" />,
        title: "Identity & vault layer",
        body: "MedVaultRegistry + AnonymousPatientRegistry + Semaphore: commitment-based profiles, encrypted euint32 metrics, DataAccessLog on registration.",
    },
    {
        color: "purple",
        icon: <Activity className="h-4 w-4" />,
        title: "FHE computation layer",
        body: "EligibilityEngine, ConsentManager, EncryptedConsentGate, EncryptedScoreLeaderboard — homomorphic scoring and consent-gated access on Ethereum Sepolia via Zama FHE.",
    },
    {
        color: "amber",
        icon: <Coins className="h-4 w-4" />,
        title: "DeFi & automation layer",
        body: "SponsorIncentiveVault, TrialMilestoneManager, StakingManager, ConfidentialETH7984 (IERC7984 encrypted withdraw + EIP-712 public exit), MedVaultAutomation (CRE or owner cron).",
    },
    {
        color: "rose",
        icon: <Server className="h-4 w-4" />,
        title: "Indexing & audit",
        body: "The Graph subgraph for trials/applications; DataAccessLog for immutable anonymized audit hashes (compliance-oriented record-keeping, not HIPAA/GDPR certification).",
    },
];

export function ArchitectureDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose mb-6 p-4 rounded-xl border border-[#00685f]/20 bg-gradient-to-br from-[#00685f]/5 to-white">
                    <p className="text-sm text-slate-700 m-0 leading-relaxed">
                        MedVault on <strong>Ethereum Sepolia</strong> combines{" "}
                        <strong>Semaphore</strong> identity, <strong>Zama FHE</strong> homomorphic eligibility (authoritative compute), optional{" "}
                        <strong>Noir/Honk</strong> compliance attestation seals, and{" "}
                        <strong>{REPO_STATS.productionContracts}</strong> production Solidity contracts. Addresses:{" "}
                        <code>src/lib/contracts/addresses.json</code>.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <Link
                            to="/docs/contracts"
                            className="text-xs font-bold text-white bg-[#00685f] px-3 py-1 rounded-full hover:bg-[#005a52]"
                        >
                            Contract reference →
                        </Link>
                        <Link
                            to="/docs/zama-fhe"
                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50"
                        >
                            Zama FHE
                        </Link>
                        <Link
                            to="/docs/semaphore"
                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50"
                        >
                            Semaphore
                        </Link>
                        <Link
                            to="/docs/testing"
                            className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-100"
                        >
                            Test suite ({REPO_STATS.testSuiteDefaultPassing})
                        </Link>
                    </div>
                </div>

                <div className="my-6 not-prose">
                    <Suspense
                        fallback={
                            <div className="h-[380px] rounded-2xl border border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center text-xs text-slate-400">
                                Loading protocol diagram…
                            </div>
                        }
                    >
                        <ProtocolFlowDiagram />
                    </Suspense>
                </div>

                <div className="not-prose p-4 rounded-xl border border-slate-200 bg-slate-50/80 mb-8">
                    <h3 className="text-base font-semibold text-slate-900 mb-2 m-0 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#00685f]" />
                        Stack at a glance
                    </h3>
                    <ul className="text-slate-600 space-y-1.5 list-disc list-inside text-sm m-0">
                        <li>
                            <strong>Frontend:</strong> React, Privy, @zama-fhe/sdk (encryptInputs + proofAccount binding).
                        </li>
                        <li>
                            <strong>Contracts:</strong> Zama FHE Solidity ({PROTOCOL_CONTRACTS.length} core contracts in
                            catalog).
                        </li>
                        <li>
                            <strong>Indexing:</strong> Subgraph for trials, applications, anonymous propensity signals.
                        </li>
                        <li>
                            <strong>Automation:</strong> MedVaultAutomation — Chainlink CRE or owner cron.
                        </li>
                    </ul>
                </div>

                <h2>Four layers + audit</h2>
                <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-3 my-6">
                    {layers.map((layer) => {
                        const s = LAYER_STYLES[layer.color];
                        return (
                            <div
                                key={layer.title}
                                className={cn("rounded-xl border p-4", s.box)}
                            >
                                <h3 className="flex items-center gap-2 mt-0 text-base text-slate-900">
                                    <div className={cn("p-1.5 rounded-lg", s.icon)}>{layer.icon}</div>
                                    {layer.title}
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed m-0">{layer.body}</p>
                            </div>
                        );
                    })}
                </div>

                <h2>Patient apply flow (anonymous path)</h2>
                <ol className="text-sm space-y-2 max-w-prose">
                    <li>
                        <strong>Encrypt in browser:</strong> @zama-fhe/sdk builds InEuint inputs + proofs; proof account
                        matches the contract that will verify (often MedVaultRegistry).
                    </li>
                    <li>
                        <strong>Register / update vault:</strong> MedVaultRegistry forwards ciphertexts to
                        AnonymousPatientRegistry under a Semaphore commitment.
                    </li>
                    <li>
                        <strong>Stage eligibility:</strong> EligibilityEngine reads encrypted profile + trial bounds,
                        computes CMUX-weighted <code>euint8</code> score in ciphertext.
                    </li>
                    <li>
                        <strong>Consent gate:</strong> ConsentManager <code>grantConsent(trialId, InEbool)</code>;
                        <code>checkAnonymousEligibilityWithConsent</code> for sponsor-visible flows.
                    </li>
                    <li>
                        <strong>Decrypt (off-chain):</strong> Patient uses Zama SDK client decrypt — scores are never
                        plaintext on-chain.
                    </li>
                    <li>
                        <strong>Rewards:</strong> SponsorIncentiveVault + TrialMilestoneManager + optional
                        MedVaultAutomation payouts.
                    </li>
                </ol>

                <h2>Contract interaction matrix</h2>
                <div className="not-prose my-6 overflow-hidden rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">Caller</th>
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">Callee</th>
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CONTRACT_INTERACTION_ROWS.map((row, i) => (
                                    <tr
                                        key={row.caller}
                                        className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-[#00685f] font-bold">
                                            {row.caller}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.callee}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{row.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Callout type="info" title="Gas & coprocessor">
                    FHE ops run in the Zama FHE coprocessor — gas is dominated by comparison + CMUX calls. MedVault
                    batches scoring per application and stores handles in mappings rather than emitting ciphertexts in
                    events.
                </Callout>

                <Callout type="warning" title="Threat model note">
                    EligibilityEngine is trusted bytecode deployed by the protocol admin. Mitigations: fixed deployment,
                    FHE ACL on handles, DataAccessLog for every sensitive action. See{" "}
                    <Link to="/docs/security-model" className="font-semibold underline">
                        security model
                    </Link>
                    .
                </Callout>

                <h2>Documentation &amp; asset sync</h2>
                <p className="text-sm">
                    MedVault uses a <strong>dual-doc model</strong>: in-app pages under <code>src/pages/docs/</code> mirror
                    repo markdown in <code>docs/</code> and <code>internal-docs/</code>. Canonical counts import from{" "}
                    <code>src/lib/docsStats.ts</code> (methodology in repo{" "}
                    <code>docs/AUDIT.md</code>).
                </p>
                <ul className="text-sm space-y-1.5 max-w-prose">
                    <li>
                        <code>npm run sync-abis</code> — compile artifacts → <code>src/lib/contracts/abis/</code> and{" "}
                        <code>subgraph/abis/</code>
                    </li>
                    <li>
                        <code>npm run sync-sdk-assets</code> — addresses + ABIs → <code>packages/medvault-core/data/</code>
                    </li>
                    <li>
                        <code>node scripts/update-subgraph-yaml.js</code> — subgraph contract addresses / start blocks
                    </li>
                    <li>
                        Circuit compile — dual Noir artifacts → <code>HonkVerifier.sol</code> +{" "}
                        <code>HonkVerifierEncrypted.sol</code>
                    </li>
                </ul>
                <p className="text-sm">
                    Off-chain surface: <strong>{REPO_STATS.httpRoutes}</strong> HTTP routes across relayer, ai-service,
                    indexer, and MCP; <strong>{REPO_STATS.backgroundJobs}</strong> background jobs (relayer watcher, batch
                    exit queue, indexer sync/reconcile, trial automation — CRE or owner cron). See{" "}
                    <Link to="/docs/frontend" className="font-semibold underline">
                        frontend architecture
                    </Link>{" "}
                    for provider nesting and routing.
                </p>
            </Prose>
        </motion.div>
    );
}
