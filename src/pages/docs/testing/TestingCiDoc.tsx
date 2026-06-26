import { Prose } from "../../../components/docs/Prose";
import { Callout } from "../../../components/docs/Callout";
import { CodeBlock } from "../../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { NPM_SCRIPTS, PINNED_DEPS, SUITE_STATS } from "./testSuiteData";

export function TestingCiDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <h2>npm scripts</h2>
                <p>
                    Suites are selected by <code>scripts/hardhat-test-suite.mjs</code> (uses{" "}
                    <code>glob</code> so paths work on Windows and Unix).
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

                <h2>GitHub Actions</h2>
                <p>
                    Workflow: <code>.github/workflows/contracts-test.yml</code>
                </p>
                <ol>
                    <li><code>npm ci</code></li>
                    <li><code>npm run compile</code></li>
                    <li><code>npm run test:unit</code></li>
                    <li><code>npm run test:integration</code></li>
                    <li><code>npm run test:crypto</code></li>
                </ol>
                <p>
                    Honk (<code>CRYPTO-HONK-01</code>) is <strong>not</strong> in CI due to runtime (~3–5 min) and
                    circuit build dependency. Run locally or on a nightly job after{" "}
                    <code>npm run build:circuit</code>.
                </p>

                <h2>Hardhat configuration</h2>
                <ul>
                    <li>
                        <code>@fhevm/hardhat-plugin</code> — auto-deploys Zama FHE mocks before <code>hardhat test</code>
                    </li>
                    <li>
                        Mocha timeout: 120s (Honk file sets 300s locally)
                    </li>
                    <li>
                        <code>solidity-coverage</code> via <code>npm run test:coverage</code>
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

  Smoke: Hardhat + Zama FHE          4 passing
  Unit: *                         140+ passing
  Staking: StakingManager         8 passing
  Integration: *                  40 passing
  Crypto: Noir nullifier          3 passing

  ${SUITE_STATS.totalPassing} passing (approx.)`}
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
                                    <code>src/lib/circuits/eligibility_proof.json</code> exists
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
                    the Vite app — not required for CI.
                </Callout>
            </Prose>
        </motion.div>
    );
}
