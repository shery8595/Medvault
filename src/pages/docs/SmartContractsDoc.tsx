import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { ProtocolContractSection } from "../../components/docs/ProtocolContractSection";
import {
    CONTRACT_INTERACTION_ROWS,
    PROTOCOL_CONTRACTS,
    PROTOCOL_OPTIONAL_CONTRACTS,
} from "../../lib/protocolContracts";
import { DOCS_CONTRACT_COUNT } from "../../lib/docsNav";
import { motion } from "framer-motion";
import { FileCode2, FlaskConical } from "lucide-react";

export function SmartContractsDoc() {
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
                                {DOCS_CONTRACT_COUNT} production contracts + Honk verifier
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
                        258+ Hardhat tests
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
                        Chainlink Automation
                    </Link>
                    .
                </p>

                <div className="not-prose space-y-4 my-8">
                    {PROTOCOL_CONTRACTS.map((c) => (
                        <ProtocolContractSection key={c.name} contract={c} />
                    ))}
                </div>

                <h2>Optional: Noir attestation verifier</h2>
                <div className="not-prose space-y-4 my-6">
                    {PROTOCOL_OPTIONAL_CONTRACTS.map((c) => (
                        <ProtocolContractSection key={c.name} contract={c} />
                    ))}
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
                                        key={`${row.caller}-${row.callee}`}
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
            </Prose>
        </motion.div>
    );
}
