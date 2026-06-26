import { Prose } from "../../../components/docs/Prose";
import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { TEST_FILES, AUDIT_TRACEABILITY, SUITE_STATS } from "./testSuiteData";

const pillarColors: Record<string, string> = {
    Infra: "bg-slate-100 text-slate-700",
    ACL: "bg-blue-100 text-blue-800",
    FHE: "bg-teal-100 text-teal-800",
    "FHE/ETH": "bg-purple-100 text-purple-800",
    "ETH/FHE": "bg-purple-100 text-purple-800",
    ETH: "bg-amber-100 text-amber-800",
    ZK: "bg-indigo-100 text-indigo-800",
    "ZK/FHE": "bg-indigo-100 text-indigo-800",
    E2E: "bg-rose-100 text-rose-800",
};

export function TestingMatrixDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p>
                    Every automated case has a stable ID prefix (e.g. <code>EE-03</code>,{" "}
                    <code>MVR-09</code>) for audit traceability. This table mirrors{" "}
                    <code>docs/TEST_MATRIX.md</code> in the repository.
                </p>

                <div className="not-prose overflow-x-auto my-8 border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-white text-left">
                            <tr>
                                <th className="px-4 py-3 font-semibold">File</th>
                                <th className="px-4 py-3 font-semibold">Contracts</th>
                                <th className="px-4 py-3 font-semibold w-16">Cases</th>
                                <th className="px-4 py-3 font-semibold">Pillar</th>
                                <th className="px-4 py-3 font-semibold">IDs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {TEST_FILES.map((row) => (
                                <tr key={row.path} className="hover:bg-slate-50/80">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.path}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.contracts}</td>
                                    <td className="px-4 py-3 font-semibold">{row.cases}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${pillarColors[row.pillar] ?? "bg-slate-100"}`}
                                        >
                                            {row.pillar}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.ids}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-emerald-50 font-semibold text-slate-800">
                            <tr>
                                <td className="px-4 py-3" colSpan={2}>
                                    Total (default CI)
                                </td>
                                <td className="px-4 py-3">{SUITE_STATS.totalPassing}</td>
                                <td className="px-4 py-3" colSpan={2}>
                                    + {SUITE_STATS.honkPassing} optional Honk
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <h2>Highlighted scenarios</h2>
                <ul>
                    <li>
                        <strong>Eligibility (EE-01–09):</strong> Encrypted profile vs trial criteria; mock decrypt on
                        staged <code>finalCt</code>.
                    </li>
                    <li>
                        <strong>Registry (MVR-01–12):</strong> Semaphore member add, anonymous apply stage/cancel,
                        consent-gated wallet apply.
                    </li>
                    <li>
                        <strong>Vault (SIV, INT-VAULT):</strong> Fund, register participant, distribute, milestones,
                        automation upkeep.
                    </li>
                    <li>
                        <strong>Consent (CM, INT-EE):</strong> Legacy and InEbool grants, epoch revoke, engine
                        composition.
                    </li>
                    <li>
                        <strong>E2E (E2E-01–08):</strong> Full patient journey including sponsor reject and consent
                        revoke paths.
                    </li>
                </ul>

                <h2>Audit traceability</h2>
                <div className="not-prose overflow-x-auto my-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Topic</th>
                                <th className="px-4 py-3 text-left font-semibold">Test IDs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {AUDIT_TRACEABILITY.map((row) => (
                                <tr key={row.finding}>
                                    <td className="px-4 py-3 text-slate-800">{row.finding}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.tests}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Skipped / optional</h2>
                <ul>
                    <li>
                        <code>TM-03</code> — Ethereum Sepolia chain-id bypass (requires{" "}
                        <code>hardhat_setChainId</code>, not on default provider).
                    </li>
                    <li>
                        <code>SIV-10</code> — Reclaim with empty pool (scenario needs funded-then-reclaim fixture).
                    </li>
                    <li>
                        <code>CRYPTO-HONK-01</code> — Excluded from default <code>npm test</code>; run via{" "}
                        <code>npm run test:honk</code> after <code>npm run build:circuit</code>.
                    </li>
                </ul>
            </Prose>
        </motion.div>
    );
}
