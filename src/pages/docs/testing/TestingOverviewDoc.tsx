import { Link } from "react-router-dom";
import { Prose } from "../../../components/docs/Prose";
import { Callout } from "../../../components/docs/Callout";
import { CodeBlock } from "../../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { CheckCircle2, Layers, ShieldCheck, ArrowRight } from "lucide-react";
import { SUITE_STATS, REPO_LAYOUT } from "./testSuiteData";

const pillars = [
    { label: "Infra", count: 4, desc: "Hardhat signers, Zama FHE plugin, full stack deploy" },
    { label: "ACL / ownership", count: 34, desc: "Two-step ownership, DAL loggers, TM/SR access" },
    { label: "Zama FHE", count: 90, desc: "Encrypted profiles, consent, eligibility, v0.9 proofs" },
    { label: "ZK / Semaphore", count: 22, desc: "MockSemaphore apply/stage, nullifier, attestation binding (ATT-*), Honk optional" },
    { label: "ETH / vault", count: 50, desc: "ConfidentialETH, incentive vault, milestones, staking" },
    { label: "E2E", count: 25, desc: "Patient register → apply → fund → claim (FLOW-*)" },
];

export function TestingOverviewDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose my-5 p-4 sm:p-5 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />
                    <div className="relative flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
                                Contract verification suite
                            </p>
                            <h2 className="text-lg font-bold text-slate-900 mt-0 mb-1">
                                {SUITE_STATS.totalPassing} passing Hardhat tests
                            </h2>
                            <p className="text-slate-600 m-0 text-xs leading-relaxed">
                                Real Mocha/Chai assertions on the local Hardhat network with{" "}
                                <strong>@fhevm/hardhat-plugin</strong> mocks — no placeholder{" "}
                                <code>expect(true)</code> loops. Last verified {SUITE_STATS.lastVerified}.
                            </p>
                        </div>
                    </div>
                </div>

                <h2>What this section covers</h2>
                <p>
                    Use the <strong>Tests</strong> tab in this documentation for everything on the Hardhat side:
                    layout, case IDs, shared fixtures, Zama FHE encryption helpers, CI, and how tests map to audit
                    findings. The repo also ships markdown references at{" "}
                    <code>docs/TESTING_GUIDE.md</code> and <code>docs/TEST_MATRIX.md</code> for auditors who prefer
                    GitHub.
                </p>

                <div className="not-prose grid sm:grid-cols-2 gap-4 my-8">
                    <Link
                        to="/docs/testing/matrix"
                        className="group p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900">Test matrix</span>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                        </div>
                        <p className="text-sm text-slate-500 m-0">Every file, case ID prefix, and pillar tag.</p>
                    </Link>
                    <Link
                        to="/docs/testing/infrastructure"
                        className="group p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900">Infrastructure</span>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                        </div>
                        <p className="text-sm text-slate-500 m-0">
                            <code>deployMedVaultStack()</code>, FHE helpers, Semaphore mocks.
                        </p>
                    </Link>
                    <Link
                        to="/docs/testing/ci"
                        className="group p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all sm:col-span-2"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900">CI & commands</span>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                        </div>
                        <p className="text-sm text-slate-500 m-0">
                            npm scripts, GitHub Actions workflow, Honk optional job.
                        </p>
                    </Link>
                </div>

                <h2>Suite breakdown</h2>
                <div className="not-prose overflow-x-auto my-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700">Suite</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Passing</th>
                                <th className="px-4 py-3 font-semibold text-slate-700">Command</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="px-4 py-3">Unit + smoke + staking</td>
                                <td className="px-4 py-3">{SUITE_STATS.unitPassing}</td>
                                <td className="px-4 py-3 font-mono text-xs">npm run test:unit</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3">Integration</td>
                                <td className="px-4 py-3">{SUITE_STATS.integrationPassing}</td>
                                <td className="px-4 py-3 font-mono text-xs">npm run test:integration</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3">Crypto (nullifier)</td>
                                <td className="px-4 py-3">{SUITE_STATS.cryptoPassing}</td>
                                <td className="px-4 py-3 font-mono text-xs">npm run test:crypto</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3">Honk pipeline (optional)</td>
                                <td className="px-4 py-3">{SUITE_STATS.honkPassing}</td>
                                <td className="px-4 py-3 font-mono text-xs">npm run test:honk</td>
                            </tr>
                            <tr className="bg-emerald-50/50 font-semibold">
                                <td className="px-4 py-3">Default CI total</td>
                                <td className="px-4 py-3">{SUITE_STATS.totalPassing}</td>
                                <td className="px-4 py-3 font-mono text-xs">npm test</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-slate-500">
                    {SUITE_STATS.skipped} tests are intentionally skipped (chain-id fork and reclaim edge case).
                </p>

                <h2>Coverage by pillar</h2>
                <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
                    {pillars.map((p) => (
                        <div key={p.label} className="p-4 rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-2 mb-1">
                                <Layers className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-slate-900">{p.label}</span>
                                <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    ~{p.count}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 m-0">{p.desc}</p>
                        </div>
                    ))}
                </div>

                <h2>Contracts under test</h2>
                <p>
                    <code>deployMedVaultStack()</code> wires the production architecture used in the app:{" "}
                    <code>MedVaultRegistry</code>, <code>AnonymousPatientRegistry</code>,{" "}
                    <code>EligibilityEngine</code>, <code>ConsentManager</code>,{" "}
                    <code>SponsorIncentiveVault</code>, <code>ConfidentialETH</code>,{" "}
                    <code>TrialManager</code>, <code>EncryptedConsentGate</code>,{" "}
                    <code>EncryptedScoreLeaderboard</code>, <code>MedVaultAutomation</code>, and{" "}
                    <code>MockSemaphore</code> (test double replacing live Semaphore on Hardhat).
                </p>

                <h2>Quick start</h2>
                <CodeBlock
                    language="bash"
                    filename="terminal"
                    code={`npm ci
npm run compile
npm run test:unit          # fast feedback (~2 min)
npm run test:integration   # flows (~40s)
npm test                   # full CI-equivalent suite`}
                />

                <Callout type="info" title="Zama FHE (not legacy fhevm)">
                    Tests use <code>hre.fhevm.createClientWithBatteries()</code> and{" "}
                    <code>@zama-fhe/sdk</code> <code>Encryptable</code> types. Encryption proofs must bind to the
                    Solidity <code>msg.sender</code> at the FHE verify site (e.g. MedVaultRegistry for patient
                    registration). See{" "}
                    <Link to="/docs/testing/infrastructure" className="text-[#00685f] font-semibold">
                        Infrastructure
                    </Link>
                    .
                </Callout>

                <h2>Repository layout</h2>
                <CodeBlock language="text" code={REPO_LAYOUT} />

                <div className="not-prose mt-12 pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Last verified
                        </div>
                        <div className="text-slate-900 font-medium">{SUITE_STATS.lastVerified}</div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-700 rounded-full text-xs font-bold border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                        {SUITE_STATS.totalPassing} PASSING
                    </div>
                </div>
            </Prose>
        </motion.div>
    );
}
