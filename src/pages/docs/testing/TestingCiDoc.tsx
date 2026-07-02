import { Prose } from "../../../components/docs/Prose";
import { Callout } from "../../../components/docs/Callout";
import { CodeBlock } from "../../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import {
    NPM_SCRIPTS,
    PINNED_DEPS,
    SUITE_STATS,
    CI_WORKFLOWS,
    COVERAGE_GATE,
    TEST_MANIFEST,
} from "./testSuiteData";

export function TestingCiDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <h2>npm scripts</h2>
                <p>
                    Suites are selected by <code>scripts/hardhat-test-suite.mjs</code> (uses{" "}
                    <code>glob</code> so paths work on Windows and Unix). Runners: Hardhat/Mocha (120s timeout),
                    Vitest 3.x (node env), node:test (SDK).
                </p>
                <div className="not-prose overflow-x-auto my-6 border border-slate-200 rounded-2xl">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Command</th>
                                <th className="px-4 py-3 text-left font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {NPM_SCRIPTS.map((row) => (
                                <tr key={row.cmd}>
                                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{row.cmd}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>GitHub Actions — 4 workflows</h2>
                <p>There is no CD workflow. CI does <strong>not</strong> run the default <code>npm test</code> aggregate or <code>test:honk</code>.</p>
                <div className="not-prose space-y-4 my-6">
                    {CI_WORKFLOWS.map((wf) => (
                        <div key={wf.file} className="p-4 rounded-xl border border-slate-200 bg-white">
                            <p className="font-mono text-xs font-bold text-slate-800 m-0 mb-2">{wf.file}</p>
                            <p className="text-sm text-slate-600 m-0 mb-1">
                                <strong>Jobs:</strong> {wf.jobs.join(", ")}
                            </p>
                            <p className="text-sm text-slate-600 m-0 mb-1">
                                <strong>Runs:</strong> {wf.runs.join(", ")}
                            </p>
                            {wf.excludes.length > 0 && (
                                <p className="text-sm text-amber-800 m-0">
                                    <strong>Does not run:</strong> {wf.excludes.join(", ")}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <h2>Coverage gate</h2>
                <p>
                    <code>npm run test:coverage:gate</code> enforces <strong>≥{COVERAGE_GATE.minPct}% statement</strong>{" "}
                    coverage on:
                </p>
                <ul>
                    {COVERAGE_GATE.contracts.map((c) => (
                        <li key={c}>
                            <code>{c}</code>
                        </li>
                    ))}
                </ul>
                <p>
                    Override via <code>{COVERAGE_GATE.envOverride}</code>. Script:{" "}
                    <code>{COVERAGE_GATE.script}</code>. No Vitest or SDK coverage configuration.
                </p>

                <h2>Hardhat configuration</h2>
                <ul>
                    <li>
                        <code>@fhevm/hardhat-plugin</code> — auto-deploys Zama FHE mocks before <code>hardhat test</code>
                    </li>
                    <li>Mocha timeout: 120s (Honk file sets 300s locally)</li>
                    <li>
                        <code>fuzz.runs: 256</code> — Mocha loop generators (not Foundry)
                    </li>
                    <li>
                        <code>solidity-coverage</code> via <code>npm run test:coverage</code>
                    </li>
                </ul>

                <h2>Frontend & package tests</h2>
                <ul>
                    <li>
                        <code>frontend.yml</code> — Vitest: {TEST_MANIFEST.vitestFiles} files,{" "}
                        {TEST_MANIFEST.vitestCases} cases (<code>src/lib/__tests__/</code>)
                    </li>
                    <li>
                        <code>mcp.yml</code> — SDK node:test: {TEST_MANIFEST.sdkNodeTestFiles} files,{" "}
                        {TEST_MANIFEST.sdkNodeTestCases} cases
                    </li>
                    <li>
                        <code>@medvault/core</code> — {TEST_MANIFEST.coreNodeTestFiles} file,{" "}
                        {TEST_MANIFEST.coreNodeTestCases} cases; <strong>not CI-wired</strong> (no{" "}
                        <code>test</code> script in package.json)
                    </li>
                </ul>

                <h2>Pinned toolchain</h2>
                <div className="not-prose my-6 rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left">Package</th>
                                <th className="px-4 py-3 text-left">Version</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {PINNED_DEPS.map((d) => (
                                <tr key={d.pkg}>
                                    <td className="px-4 py-3 font-mono text-xs">{d.pkg}</td>
                                    <td className="px-4 py-3">{d.version}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Expected CI output (summary)</h2>
                <CodeBlock
                    language="text"
                    code={`✓ @fhevm/hardhat-plugin :: mocks deployed

  Unit + smoke + staking     ${SUITE_STATS.unitPassing} passing (${SUITE_STATS.skippedPermanent} permanent skip + conditional)
  Integration                ${SUITE_STATS.integrationPassing} passing
  Crypto: Noir nullifier     ${SUITE_STATS.cryptoPassing} passing
  Fuzz + invariants          (separate job; loop-expanded)
  Fork                       (separate job; requires SEPOLIA_RPC_URL)

  Default aggregate (npm test): ${SUITE_STATS.totalPassing} passing — not run as single CI step`}
                />

                <h2>Troubleshooting</h2>
                <div className="not-prose overflow-x-auto">
                    <table className="w-full text-sm border border-slate-200 rounded-xl my-4">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Issue</th>
                                <th className="px-4 py-3 text-left">Fix</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="px-4 py-3 font-mono text-xs">InvalidSigner</td>
                                <td className="px-4 py-3">
                                    Wrong <code>proofAccount</code> in encrypt helper — see Infrastructure page
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-mono text-xs">contract runner does not support sending</td>
                                <td className="px-4 py-3">
                                    Use <code>impersonateAccount</code> instead of <code>.connect(contract)</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-mono text-xs">ambiguous grantConsent</td>
                                <td className="px-4 py-3">Use <code>grantConsentLegacy</code> / <code>grantConsentEncrypted</code></td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-mono text-xs">Honk fails</td>
                                <td className="px-4 py-3">
                                    Run <code>npm run build:circuit</code>; ensure{" "}
                                    <code>src/lib/circuits/eligibility_plaintext.json</code> and{" "}
                                    <code>eligibility_encrypted.json</code> exist
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3">Stale tests in repo root</td>
                                <td className="px-4 py-3">
                                    Ignore <code>test/comprehensive_medvault.test.js</code> — use{" "}
                                    <code>test/unit/**</code> only
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <Callout type="info" title="Remote networks">
                    Default tests run on Hardhat with Zama FHE mocks. Ethereum Sepolia is for manual deploy scripts and
                    the Vite app — fork tests require <code>SEPOLIA_RPC_URL</code> in a separate CI job.
                </Callout>
            </Prose>
        </motion.div>
    );
}
