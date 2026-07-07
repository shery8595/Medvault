import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { ProtocolContractSection } from "../../components/docs/ProtocolContractSection";
import {
    CONTRACT_INTERACTION_ROWS,
    DEPRECATED_CONTRACT_FUNCTIONS,
    PROTOCOL_ALIAS_CONTRACTS,
    PROTOCOL_CONTRACTS,
    PROTOCOL_OPTIONAL_CONTRACTS,
    TIMELOCK_WIRED_CONTRACTS,
} from "../../lib/protocolContracts";
import { DOCS_CONTRACT_COUNT } from "../../lib/docsNav";
import { REPO_STATS } from "../../lib/docsStats";
import { motion } from "framer-motion";
import { FileCode2, FlaskConical } from "lucide-react";

export function SmartContractsDoc() {
    const totalArtifacts =
        DOCS_CONTRACT_COUNT + PROTOCOL_ALIAS_CONTRACTS.length + PROTOCOL_OPTIONAL_CONTRACTS.length;

    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose mb-6 p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-[#00685f]/10 text-[#00685f]">
                            <FileCode2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 m-0">
                                {totalArtifacts} production Solidity artifacts ({DOCS_CONTRACT_COUNT} core + cETH
                                alias + Honk verifier)
                            </p>
                            <p className="text-xs text-slate-500 m-0">
                                Ethereum Sepolia · Solidity 0.8.24+ ·{" "}
                                <code>@fhevm/solidity</code>
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/docs/testing"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full hover:bg-emerald-100 shrink-0"
                    >
                        <FlaskConical className="w-3.5 h-3.5" />
                        {REPO_STATS.testSuiteDefaultPassing} Hardhat tests
                    </Link>
                </div>

                <Callout type="info" title="Addresses & deployment">
                    Live addresses live in <code>src/lib/contracts/addresses.json</code>. Deploy scripts wire
                    dependencies in the same order as <code>test-support/deployments.ts</code> (
                    <code>deployMedVaultStack()</code>). The dApp defaults to chainId <strong>11155111</strong> via
                    Privy.
                </Callout>

                <p className="text-sm text-slate-600">
                    Contracts are grouped below by role. For FHE type semantics see{" "}
                    <Link to="/docs/fhe-primitives" className="font-semibold text-[#00685f] hover:underline">
                        FHE primitives
                    </Link>
                    ; for scoring mechanics see{" "}
                    <Link to="/docs/engine" className="font-semibold text-[#00685f] hover:underline">
                        Eligibility engine
                    </Link>
                    ; for keepers see{" "}
                    <Link to="/docs/automation" className="font-semibold text-[#00685f] hover:underline">
                        Chainlink CRE
                    </Link>
                    .
                </p>

                <h2>Schedule / apply timelock (2-day wiring)</h2>
                <p className="text-sm">
                    Sensitive cross-contract references no longer use instant owner setters on live networks. The owner
                    calls <code>schedule*</code>, waits <code>READER_CHANGE_DELAY</code> (typically <strong>2 days</strong>
                    ), then <code>apply*</code>. This is an in-contract admin delay pattern — not a separate governance
                    timelock contract. On Hardhat, tests fast-forward via <code>test-support/timelock.ts</code>.
                </p>
                <p className="text-sm">
                    Contracts using this pattern:{" "}
                    <code>{TIMELOCK_WIRED_CONTRACTS.join(", ")}</code>. Full deploy flow and TL-* tests:{" "}
                    <Link to="/docs/timelock-wiring" className="font-semibold text-[#00685f] hover:underline">
                        Timelock wiring
                    </Link>
                    .
                </p>

                <h2>Core protocol contracts</h2>
                <div className="not-prose space-y-4 my-8">
                    {PROTOCOL_CONTRACTS.map((c) => (
                        <ProtocolContractSection key={c.name} contract={c} />
                    ))}
                </div>

                <h2>Deployment alias</h2>
                <div className="not-prose space-y-4 my-6">
                    {PROTOCOL_ALIAS_CONTRACTS.map((c) => (
                        <ProtocolContractSection key={c.name} contract={c} />
                    ))}
                </div>

                <h2>Optional: Noir attestation verifier</h2>
                <div className="not-prose space-y-4 my-6">
                    {PROTOCOL_OPTIONAL_CONTRACTS.map((c) => (
                        <ProtocolContractSection key={c.name} contract={c} />
                    ))}
                </div>

                <h3>HonkVerifier generation pipeline</h3>
                <ol className="text-sm">
                    <li>
                        <code>npm run build:circuit</code> — <code>compile-circuit-wsl.sh</code> compiles{" "}
                        <code>eligibility_plaintext</code> + <code>eligibility_encrypted</code> →{" "}
                        <code>src/lib/circuits/*.json</code> (plus <code>eligibility_proof.json</code> plaintext alias).
                    </li>
                    <li>
                        <code>npm run generate:honk-verifier</code> — emits{" "}
                        <code>contracts/HonkVerifier.sol</code>, <code>contracts/HonkVerifierEncrypted.sol</code>, and{" "}
                        <code>vk_fingerprint.json</code> (plaintext + encrypted keys).
                    </li>
                    <li>
                        <code>node scripts/verify-honk-verifier.mjs</code> — asserts both verifiers: plaintext 25 user
                        inputs, encrypted 15 user inputs, aligned with <code>EligibilityEngine</code> constants.
                    </li>
                </ol>

                <h2>Known quirks</h2>
                <ul className="text-sm">
                    <li>
                        <strong>SponsorRegistry.auditor</strong> — off-chain attestation role with read-only access to encrypted institution IDs; set via{" "}
                        <code>scheduleAuditor</code> / <code>applyAuditor</code> (6h timelock). Zero-address schedule reverts. See{" "}
                        <code>test/unit/sponsor-registry-auditor.test.ts</code> (SRA-01–05).
                    </li>
                    <li>
                        <strong>EligibilityEngine silent rejection</strong> — ineligible anonymous finalize does not revert (privacy-by-design; no plaintext eligibility bit on-chain); outcome stored as{" "}
                        <code>SilentRejected</code>. Re-classified Informational — see{" "}
                        <code>docs/MEDIUM_FINDINGS_CLOSEOUT.md</code>.
                    </li>
                    <li>
                        <strong>StakingManager.Unstaked</strong> — event declared, never emitted; use{" "}
                        <code>PrivateUnstaked</code> or <code>PublicUnstaked</code>.
                    </li>
                    <li>
                        <strong>Consent / document revocation vs FHE persistence</strong> —{" "}
                        <code>ConsentManager.revokeConsent</code> and atomic{" "}
                        <code>PatientDocumentStore.revokeAccess</code> (new CID + key required) update epochs and rotate
                        bindings; prior <code>FHE.allow</code> grants persist on fhEVM. Sponsors use per-access{" "}
                        <code>pullSponsorKeyAccess</code> before decrypt; consumers must gate on consent epoch / document
                        epoch before new reads.
                    </li>
                    <li>
                        <strong>7-day staging TTL</strong> — <code>STAGING_TTL</code> on pending anonymous eligibility.
                    </li>
                    <li>
                        <strong>Batch one-shot max 16</strong> — <code>checkEligibilityBatch</code> accepts 1–16 trial IDs
                        per commitment; each pair can only be batch-checked once unless owner resets the flag.
                    </li>
                </ul>

                <h2>Deprecated functions (hard-revert)</h2>
                <p className="text-sm">
                    Legacy wallet-linked and pre-attestation entry points remain in ABI for compatibility but always
                    revert. Do not call from new integrations:
                </p>
                <div className="not-prose my-4 overflow-hidden rounded-xl border border-amber-200 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-amber-100 bg-amber-50">
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">Contract</th>
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">Function</th>
                                    <th className="text-left px-3 py-2 font-bold text-slate-700 text-xs">
                                        Use instead
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {DEPRECATED_CONTRACT_FUNCTIONS.map((row, i) => (
                                    <tr
                                        key={`${row.contract}-${row.fn}`}
                                        className={`border-b border-amber-50 ${i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-[#00685f] font-bold">
                                            {row.contract}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.fn}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{row.replacement}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <h2>Cross-contract interaction matrix</h2>
                <p className="text-sm">
                    Primary call paths (read-only views and state-changing flows used in integration tests):
                </p>

                <div className="not-prose my-6 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
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
                                        key={`${row.caller}-${row.callee}-${i}`}
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

                <Callout type="warning" title="Zama FHE ACL & proof accounts">
                    Client encryption must set the correct <strong>proof account</strong> in{" "}
                    <code>@zama-fhe/sdk</code> (must match <code>msg.sender</code> at the FHE verify site). Example:
                    MedVaultRegistry address when registering through the vault; patient EOA for direct consent grants.
                    See <Link to="/docs/testing/infrastructure">test infrastructure docs</Link> for mock patterns.
                </Callout>

                <h2>Related deep dives</h2>
                <ul className="text-sm">
                    <li>
                        <Link
                            to="/docs/hybrid-storage"
                            className="font-semibold text-[#00685f] hover:underline"
                        >
                            Hybrid storage
                        </Link>{" "}
                        — IPFS + FHE document keys (<code>PatientDocumentStore</code>)
                    </li>
                    <li>
                        <Link
                            to="/docs/atomic-flows"
                            className="font-semibold text-[#00685f] hover:underline"
                        >
                            Atomic flows
                        </Link>{" "}
                        — wallet-visible single-tx optimizations vs 2-tx anonymous apply
                    </li>
                    <li>
                        <Link
                            to="/docs/zero-revelation-rewards"
                            className="font-semibold text-[#00685f] hover:underline"
                        >
                            Zero-revelation rewards
                        </Link>{" "}
                        — FHE-gated screening payouts
                    </li>
                    <li>
                        <Link
                            to="/docs/formal-verification/eligibility-engine-spec"
                            className="font-semibold text-[#00685f] hover:underline"
                        >
                            EligibilityEngine formal spec
                        </Link>{" "}
                        — property specification for Certora / Halmos review
                    </li>
                    <li>
                        <Link
                            to="/docs/formal-verification/certora-halmos-results"
                            className="font-semibold text-[#00685f] hover:underline"
                        >
                            Formal verification results (Phase 5)
                        </Link>{" "}
                        — Certora/Halmos blocked on fhEVM; differential fallbacks pass
                    </li>
                </ul>
            </Prose>
        </motion.div>
    );
}
