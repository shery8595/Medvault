import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";

import { motion } from "framer-motion";

export function EligibilityEngineDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <Callout type="info" title="Production path: anonymous + consent">
                    Patients register via <code>MedVaultRegistry</code> → <code>AnonymousPatientRegistry</code> (Semaphore
                    commitment). Eligibility uses <code>stageAnonymousEligibility</code> /{" "}
                    <code>finalizeAnonymousEligibility</code> and optional{" "}
                    <code>checkAnonymousEligibilityWithConsent</code>. Legacy address-only{" "}
                    <code>checkEligibility</code> is deprecated.
                </Callout>

                <h2>Computation flow</h2>
                <p className="text-sm">
                    FHE work is batched in <code>_computeEligibility</code>: read encrypted profile + trial bounds, run
                    comparisons, accumulate a weighted <code>euint8</code> score with <code>FHE.cmux</code>. Nothing is
                    decrypted on-chain.
                </p>

                <div className="not-prose bg-gradient-to-br from-violet-50 to-white p-4 rounded-xl border border-violet-200 mb-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-3 m-0">Anonymous apply sequence</h3>
                    <ol className="text-slate-600 text-sm space-y-2 m-0 pl-4 list-decimal">
                        <li>Patient encrypts metrics with <code>@zama-fhe/sdk</code> (proof account = MedVaultRegistry when registering).</li>
                        <li><code>MedVaultRegistry</code> stores ciphertexts under Semaphore commitment in <code>AnonymousPatientRegistry</code>.</li>
                        <li><code>stageAnonymousEligibility</code> runs FHE scoring (registry or engine caller per ACL).</li>
                        <li>Patient grants <code>grantConsent(trialId, InEbool)</code> on <code>ConsentManager</code>.</li>
                        <li><code>checkAnonymousEligibilityWithConsent</code> gates sponsor-facing flows; score stays encrypted.</li>
                        <li>Patient decrypts score off-chain via Zama SDK client — plaintext never appears in events or storage.</li>
                    </ol>
                </div>

                <CodeBlock
                    filename="EligibilityEngine.sol (scoring pattern)"
                    language="solidity"
                    code={`// Simplified — actual contract uses euint8 total score + anonymous mappings
euint8 score = FHE.asEuint8(0);
ebool ageOk = FHE.and(FHE.ge(age, minAge), FHE.le(age, maxAge));
score = FHE.add(score, FHE.cmux(ageOk, FHE.asEuint8(40), FHE.asEuint8(0)));
// + blood pressure (+30) and HbA1c (+30) via CMUX — all in ciphertext`}
                />

                <hr className="my-12 border-slate-200" />

                <h2>Scoring Rubric & Weighted Dimensions</h2>

                <p>
                    The EligibilityEngine evaluates patients across three health dimensions, each contributing a weighted portion of the total 100-point score. This scoring rubric is hardcoded into the contract logic and applies uniformly to all trials.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 text-xs">Dimension</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 text-xs">Weight</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 text-xs">FHE Operation</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 text-xs">Condition</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 text-xs">CMUX Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { dim: "Age", weight: "40%", op: "FHE.ge() AND FHE.le()", cond: "minAge ≤ age ≤ maxAge", pts: "+40 / +0" },
                                    { dim: "Blood Pressure", weight: "30%", op: "FHE.ge() AND FHE.le()", cond: "minBP ≤ bp ≤ maxBP", pts: "+30 / +0" },
                                    { dim: "HbA1c", weight: "30%", op: "FHE.le()", cond: "hba1c ≤ maxHba1c", pts: "+30 / +0" },
                                ].map((row, i) => (
                                    <tr key={row.dim} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                                        <td className="px-4 py-3 font-bold text-blue-600 text-xs">{row.dim}</td>
                                        <td className="px-4 py-3 font-bold text-slate-900 text-xs">{row.weight}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.op}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{row.cond}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-emerald-600">{row.pts}</td>
                                    </tr>
                                ))}
                                <tr className="bg-blue-50 border-t-2 border-blue-500">
                                    <td className="px-4 py-3 font-bold text-blue-700 text-xs">Total</td>
                                    <td className="px-4 py-3 font-bold text-blue-700 text-xs">100%</td>
                                    <td className="px-4 py-3 text-xs text-blue-600 font-mono">5 FHE ops + 3 CMUX</td>
                                    <td className="px-4 py-3 text-xs text-blue-600">All dimensions pass</td>
                                    <td className="px-4 py-3 font-bold font-mono text-blue-700 text-xs">= 100</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
                        Table 1. A score of 100 indicates a perfect match across all health dimensions. Partial matches yield 40, 30, 60, 70, etc.
                    </div>
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>Understanding the Score State</h2>

                <p>
                    Notice how the resulting score accumulates up to a perfectly matching <code>100</code>. But what happens to this score?
                </p>

                <p>
                    In a traditional Solidity contract, determining the outcome of this function would involve emitting an event: <code>emit ScoreCalculated(score)</code>. However, doing so would expose the ciphertext on the public ledger. While technically secure because only the user has the decryption key, tracking ciphertexts in event logs is an anti-pattern for FHE data density.
                </p>

                <Callout type="danger" title="The Event Anti-Pattern">
                    <strong>Never emit encrypted types in standard events.</strong> Doing so forces indexers to parse massive byte arrays and creates unnecessary ciphertext exposure surface. Store ciphertexts securely in contract state mappings instead, and emit only non-sensitive metadata (trial ID, patient address, status enum).
                </Callout>

                <p>Scores are stored in encrypted mappings (address or nullifier keyed) with <code>FHE.allow</code> / <code>FHE.allowThis</code> for authorized contracts only.</p>

                <hr className="my-12 border-slate-200" />

                <h2>Threshold & Boundary Behavior</h2>
                <p>
                    Understanding what happens at the exact boundary values is critical for both patients and auditors:
                </p>

                <ul>
                    <li><strong>Exact boundary match passes:</strong> If a trial requires <code>minAge = 18</code> and the patient's encrypted age is exactly <code>18</code>, the <code>FHE.ge(age, minAge)</code> check returns <code>ebool(true)</code>. The patient receives the full 40 points for that dimension.</li>
                    <li><strong>Off-by-one fails:</strong> If a trial requires <code>maxAge = 65</code> and the patient's age is <code>66</code>, the <code>FHE.le(age, maxAge)</code> returns <code>ebool(false)</code>. The CMUX adds 0 points. The sponsor never learns the patient's actual age — only the aggregate score reflects the mismatch.</li>
                    <li><strong>Partial matches are informative:</strong> A score of <code>70</code> tells the patient they passed the Age and BP checks (40+30) but failed HbA1c. A score of <code>60</code> means BP + HbA1c passed but Age was out of range. This partial information helps patients identify which health factors need attention.</li>
                </ul>

                <hr className="my-12 border-slate-200" />

                <h2>Multi-Trial Concurrent Applications</h2>
                <p>
                    A single patient can apply to multiple trials simultaneously. The <code>EligibilityEngine</code> evaluates each application independently because the scoring mapping is keyed by <code>(trialId, patientAddress)</code>. This design means:
                </p>
                <ul>
                    <li><strong>No re-encryption needed:</strong> Profile ciphertexts live once in <code>AnonymousPatientRegistry</code>; each trial application reuses handles with ACL.</li>
                    <li><strong>Independent scoring:</strong> Scores are keyed by <code>(trialId, nullifier)</code> or legacy address — trials do not leak across each other.</li>
                    <li><strong>Gas per application:</strong> Dominated by FHE comparison + CMUX count; see <Link to="/docs/testing" className="font-semibold text-[#00685f]">test suite</Link> for regression coverage (EE-* cases).</li>
                </ul>

                <Callout type="tip" title="Gas & latency">
                    FHE transactions on Ethereum Sepolia are significantly more expensive than plain transfers. Expect variable confirmation time while the coprocessor evaluates ciphertexts. Profile with <code>npm run test:unit</code> locally using Zama FHE mocks before testnet experiments.
                </Callout>

                <hr className="my-12 border-slate-200" />

                <h2>Noir attestation (optional seal)</h2>
                <p className="text-sm">
                    FHE scoring is authoritative. After staging/finalize, patients may call{" "}
                    <code>verifyEligibilityProof</code> or use{" "}
                    <code>finalizeAnonymousEligibilityWithProof</code> to record a public compliance receipt bound to
                    the staged <code>finalCt</code> handle, Semaphore nullifier, and criteria schema version.
                </p>
                <ul className="text-sm">
                    <li>
                        <code>attestationReceipt(nullifier, trialId)</code> — sponsor-safe metadata (no PHI).
                    </li>
                    <li>
                        <code>ELIGIBILITY_PUBLIC_INPUT_COUNT = 16</code> — includes{" "}
                        <code>fhe_stage_handle_hash</code> and <code>criteria_schema_hash</code>.
                    </li>
                    <li>
                        See <Link to="/docs/noir" className="font-semibold text-[#00685f]">Noir compliance attestation</Link>{" "}
                        for circuit inputs, browser <code>sealResult()</code>, and residual FHE↔ZK binding caveat.
                    </li>
                </ul>

            </Prose>
        </motion.div>
    );
}
