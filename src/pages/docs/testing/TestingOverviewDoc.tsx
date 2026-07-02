import { Link } from "react-router-dom";

import { Prose } from "../../../components/docs/Prose";

import { Callout } from "../../../components/docs/Callout";

import { CodeBlock } from "../../../components/docs/CodeBlock";

import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";

import { motion } from "framer-motion";

import { CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

import {

    SUITE_STATS,

    REPO_LAYOUT,

    TEST_MANIFEST,

    HARDHAT_FILE_COUNTS,

    FUZZ_GENERATORS,

} from "./testSuiteData";



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

                                {TEST_MANIFEST.testFilesTotal} TypeScript test files, ~

                                {TEST_MANIFEST.testCasesRegistered.toLocaleString()} registered cases (incl.{" "}

                                {TEST_MANIFEST.testCasesParametricFuzz} ECM parametric). Real Mocha/Chai assertions

                                with <strong>@fhevm/hardhat-plugin</strong> mocks — no placeholder{" "}

                                <code>expect(true)</code> loops. Last verified {SUITE_STATS.lastVerified}.

                            </p>

                        </div>

                    </div>

                </div>



                <h2>What this section covers</h2>

                <p>

                    Use the <strong>Tests</strong> tab for Hardhat layout, case IDs, shared fixtures, Zama FHE helpers,

                    CI, and audit traceability. Additional runners: Vitest ({TEST_MANIFEST.vitestFiles} files,{" "}

                    {TEST_MANIFEST.vitestCases} cases) and node:test (SDK {TEST_MANIFEST.sdkNodeTestCases}, core{" "}

                    {TEST_MANIFEST.coreNodeTestCases} — core not CI-wired). Markdown references:{" "}

                    <code>docs/TESTING_GUIDE.md</code> and <code>docs/TEST_MATRIX.md</code>.

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

                            <code>deployMedVaultStack()</code>, {TEST_MANIFEST.testHelperFiles} test-support helpers.

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

                            4 GitHub Actions workflows, coverage gate, fuzz model.

                        </p>

                    </Link>

                </div>



                <h2>Hardhat file layout</h2>

                <div className="not-prose overflow-x-auto my-6">

                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">

                        <thead className="bg-slate-50 text-left">

                            <tr>

                                <th className="px-4 py-3 font-semibold text-slate-700">Directory</th>

                                <th className="px-4 py-3 font-semibold text-slate-700">Files</th>

                            </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-100">

                            {Object.entries(HARDHAT_FILE_COUNTS).map(([dir, count]) => (

                                <tr key={dir}>

                                    <td className="px-4 py-3 font-mono text-xs">test/{dir}/</td>

                                    <td className="px-4 py-3">{count}</td>

                                </tr>

                            ))}

                            <tr className="bg-emerald-50/50 font-semibold">

                                <td className="px-4 py-3">Total Hardhat</td>

                                <td className="px-4 py-3">{TEST_MANIFEST.hardhatTestFiles}</td>

                            </tr>

                        </tbody>

                    </table>

                </div>

                <p className="text-sm text-slate-500">

                    {TEST_MANIFEST.foundryTestContracts} Foundry/Solidity test contracts —{" "}

                    <code>contracts/test/</code> contains helpers/mocks only.

                </p>



                <h2>Suite breakdown (default CI path)</h2>

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

                                <td className="px-4 py-3">Default total</td>

                                <td className="px-4 py-3">{SUITE_STATS.totalPassing}</td>

                                <td className="px-4 py-3 font-mono text-xs">npm test</td>

                            </tr>

                        </tbody>

                    </table>

                </div>

                <p className="text-sm text-slate-500">

                    {SUITE_STATS.skippedPermanent} permanent <code>it.skip</code> (EE-11, EE-12, TM-03, SIV-10) + up to{" "}

                    {SUITE_STATS.skippedConditional} conditional (SDD-01 large-pool). Fork suite ({SUITE_STATS.skippedForkSuite}{" "}

                    cases) skipped without <code>SEPOLIA_RPC_URL</code>.

                </p>



                <h2>Fuzz generators</h2>

                <p>

                    Mocha <code>for</code> loops — not Foundry <code>vm.assume</code>. Config:{" "}

                    <code>fuzz.runs: 256</code> in <code>hardhat.config.ts</code>.

                </p>

                <div className="not-prose overflow-x-auto my-4">

                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">

                        <thead className="bg-slate-50">

                            <tr>

                                <th className="px-4 py-3 text-left font-semibold">File</th>

                                <th className="px-4 py-3 text-left font-semibold">Cases</th>

                                <th className="px-4 py-3 text-left font-semibold">IDs</th>

                            </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-100">

                            {FUZZ_GENERATORS.map((g) => (

                                <tr key={g.file}>

                                    <td className="px-4 py-3 font-mono text-xs">{g.file}</td>

                                    <td className="px-4 py-3">{g.cases}</td>

                                    <td className="px-4 py-3 font-mono text-xs">{g.ids}</td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>



                <h2>E2E note</h2>

                <p>

                    No Playwright/Cypress. Named E2E flows (<code>e2e-patient-to-claim</code>,{" "}

                    <code>hybrid-storage.e2e</code>) are Hardhat integration tests under <code>test/integration/</code>.

                </p>



                <h2>Quick start</h2>

                <CodeBlock

                    language="bash"

                    filename="terminal"

                    code={`npm ci

npm run compile

npm run test:unit          # ${SUITE_STATS.unitPassing} passing (~8 min)

npm run test:integration   # ${SUITE_STATS.integrationPassing} passing

npm test                   # ${SUITE_STATS.totalPassing} passing (default suite)`}

                />



                <Callout type="info" title="Zama FHE (not legacy fhevm)">

                    Tests use <code>hre.fhevm.createClientWithBatteries()</code> and{" "}

                    <code>@zama-fhe/sdk</code> <code>Encryptable</code> types. See{" "}

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


