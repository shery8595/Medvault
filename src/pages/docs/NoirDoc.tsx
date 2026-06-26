import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

export function NoirDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
                    <strong>Zama FHE</strong> is MedVault&apos;s compute authority: encrypted eligibility, scoring, and
                    consent run on ciphertext in <code>EligibilityEngine</code>. <strong>Noir</strong> is a narrow{" "}
                    <strong>public attestation seal</strong> — it does not replace FHE matching. The circuit (
                    <code>circuits/eligibility_proof</code>) produces a compliance receipt that binds Semaphore
                    identity, profile commitment, trial scope, criteria schema version, and the staged Zama FHE result
                    handle. Proofs verify on-chain via <code>HonkVerifier.sol</code> (UltraHonk, EVM Keccak transcript).
                </p>

                <Callout type="info" title="Related docs">
                    <Link to="/docs/zama-fhe" className="font-semibold text-[#00685f] hover:underline">
                        Zama FHE
                    </Link>{" "}
                    (private compute),{" "}
                    <Link to="/docs/semaphore" className="font-semibold text-[#00685f] hover:underline">
                        Semaphore
                    </Link>{" "}
                    (anonymous identity),{" "}
                    <Link to="/docs/engine" className="font-semibold text-[#00685f] hover:underline">
                        Eligibility engine
                    </Link>{" "}
                    (<code>stageAnonymousEligibility</code>, <code>finalizeAnonymousEligibilityWithProof</code>,{" "}
                    <code>attestationReceipt</code>).
                </Callout>

                <h2>Zama computes · Noir attests</h2>
                <div className="not-prose grid sm:grid-cols-2 gap-3 my-6 text-sm">
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                        <p className="font-bold text-violet-900 m-0">Zama FHE (authoritative)</p>
                        <ul className="text-slate-600 m-0 mt-2 text-xs space-y-1 list-disc pl-4">
                            <li>Encrypted profile storage and trial criteria</li>
                            <li>Homomorphic eligibility + propensity scoring</li>
                            <li>User-local decrypt of match/score</li>
                            <li>Sponsor encrypted ranking handles</li>
                        </ul>
                    </div>
                    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                        <p className="font-bold text-teal-900 m-0">Noir attestation (public seal)</p>
                        <ul className="text-slate-600 m-0 mt-2 text-xs space-y-1 list-disc pl-4">
                            <li>Semaphore nullifier + profile commitment binding</li>
                            <li>Trial scope + criteria schema version</li>
                            <li>Bind to staged Zama <code>finalCt</code> handle</li>
                            <li>Sponsor audit receipt — no PHI on-chain</li>
                        </ul>
                    </div>
                </div>

                <h2>Patient flow</h2>
                <ol className="text-sm space-y-2">
                    <li>
                        <strong>Stage (Zama):</strong> <code>MedVaultRegistry.stageAnonymousApply</code> → FHE
                        eligibility staged; <code>finalCt</code> handle emitted.
                    </li>
                    <li>
                        <strong>Decrypt (local):</strong> Patient decrypts match/score with Zama SDK — plaintext never hits
                        chain events.
                    </li>
                    <li>
                        <strong>Finalize (Zama + Noir):</strong> Browser generates Noir proof bound to{" "}
                        <code>finalCt</code> → <code>finalizeAnonymousApplyWithProof</code> persists FHE ciphertexts and
                        records attestation metadata.
                    </li>
                    <li>
                        <strong>Optional seal (post-apply):</strong>{" "}
                        <code>verifyEligibilityProof</code> for a standalone compliance seal on an existing FHE
                        application.
                    </li>
                </ol>

                <h2>What the circuit attests</h2>
                <p className="text-sm">
                    From <code>circuits/eligibility_proof/src/main.nr</code> — compliance mirror, not the product&apos;s
                    primary gate:
                </p>
                <ol className="text-sm space-y-2">
                    <li>
                        <strong>Nullifier binding:</strong>{" "}
                        <code>nullifier = Poseidon([scope_internal, secret])</code> matches the Semaphore application
                        for this trial.
                    </li>
                    <li>
                        <strong>Profile commitment:</strong> private vitals hash to the registered{" "}
                        <code>profile_commitment</code> on-chain.
                    </li>
                    <li>
                        <strong>Result receipt:</strong>{" "}
                        <code>result_hash = Poseidon([eligible, scope, secret])</code>.
                    </li>
                    <li>
                        <strong>FHE stage binding:</strong> public <code>fhe_stage_handle_hash</code> must match the
                        staged Zama <code>finalCt</code> being finalized (mod BN254 field).
                    </li>
                    <li>
                        <strong>Criteria schema:</strong> public <code>criteria_schema_hash</code> pins the trial rule
                        version (<code>medvault.eligibility.criteria.v1</code>).
                    </li>
                    <li>
                        <strong>Compliance mirror:</strong> eight trial predicates are checked in-circuit to mirror FHE
                        rule logic — differential tests keep both paths aligned.
                    </li>
                </ol>

                <h2>Public inputs (16)</h2>
                <div className="not-prose overflow-hidden rounded-xl border border-slate-200 text-sm my-6">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold">Index</th>
                                <th className="text-left px-3 py-2 font-bold">Field</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-mono">
                            {[
                                ["0", "scope (trialId)"],
                                ["1", "nullifier"],
                                ["2", "profile_commitment"],
                                ["3", "result_hash"],
                                ["4", "eligible"],
                                ["5", "fhe_stage_handle_hash"],
                                ["6", "criteria_schema_hash"],
                                ["7–15", "trial criteria (minAge … requires_normal_bp)"],
                            ].map(([idx, field], i) => (
                                <tr key={idx} className={i % 2 ? "bg-slate-50/50" : "bg-white"}>
                                    <td className="px-3 py-2">{idx}</td>
                                    <td className="px-3 py-2">{field}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>On-chain attestation API</h2>
                <p className="text-sm">
                    <code>EligibilityEngine.attestationReceipt(nullifier, trialId)</code> returns verified flag,{" "}
                    <code>resultHash</code>, <code>profileCommitment</code>, <code>criteriaSchemaHash</code>, and{" "}
                    <code>fheStageHash</code> — metadata only, no medical fields.
                </p>
                <p className="text-sm">
                    <code>verifyEligibilityProof</code> and <code>finalizeAnonymousEligibilityWithProof</code> both
                    require the proof&apos;s FHE stage public input to match the persisted or staged Zama handle.
                </p>

                <Callout type="warning" title="Residual binding caveat">
                    The seal is <strong>operationally</strong> bound to the Zama <code>finalCt</code> handle hash.
                    Full cryptographic proof that FHE ciphertext plaintext equals the Noir witness requires Zama
                    input-proof primitives not yet wired in this repo. See README &quot;Known privacy limits&quot;.
                </Callout>

                <h2>Browser proving stack</h2>
                <ul className="text-sm">
                    <li>
                        <code>src/lib/noir.ts</code> — witness + UltraHonk prove; passes staged FHE handle from chain or
                        staging event
                    </li>
                    <li>
                        <code>src/hooks/useEligibilityProof.ts</code> — <code>sealResult()</code> (alias{" "}
                        <code>certifyResult</code>)
                    </li>
                    <li>
                        <code>@noir-lang/noir_js</code> + <code>@aztec/bb.js</code> with{" "}
                        <code>verifierTarget: &quot;evm-no-zk&quot;</code>
                    </li>
                    <li>
                        <code>src/lib/attestationExport.ts</code> — sponsor audit bundle JSON (trial, nullifier, hashes)
                    </li>
                </ul>

                <h2>Sponsor &amp; subgraph surfaces</h2>
                <ul className="text-sm">
                    <li>Sponsor matches UI shows <strong>Zama match sealed</strong> when attestation is recorded.</li>
                    <li>
                        Subgraph <code>AnonymousSubmission</code> indexes{" "}
                        <code>attestationResultHash</code>, <code>attestationFheStageHash</code>,{" "}
                        <code>attestationCriteriaSchemaHash</code> from <code>EligibilityProofVerified</code>.
                    </li>
                    <li>No profile fields, wallet addresses, or plaintext eligibility in attestation events.</li>
                </ul>

                <h2>Build &amp; deploy pipeline</h2>
                <CodeBlock
                    language="bash"
                    filename="From repo root"
                    code={`npm run build:circuit
# → circuits/eligibility_proof/target/eligibility_proof.json
# → contracts/HonkVerifier.sol
# → src/lib/circuits/eligibility_proof.json

npx hardhat run scripts/upgrade-attestation-sepolia.ts --network sepolia
# Deploy HonkVerifier + EligibilityEngine + rewire registry/vault

node scripts/redeploy-subgraph.js v0.1.1`}
                />
                <p className="text-sm">
                    Tests: <code>test/unit/attestation-binding.test.ts</code> (FHE vs Noir differential + anti-replay),{" "}
                    <code>npm run test:crypto</code> (nullifier alignment), optional{" "}
                    <code>npm run test:honk</code>.
                </p>

                <h2>Prerequisites before sealing</h2>
                <ul className="text-sm">
                    <li>Stored Semaphore identity and per-trial nullifier (anonymous apply completed).</li>
                    <li>Zama FHE result staged or persisted for the nullifier/trial pair.</li>
                    <li>
                        Local profile plaintext matches registered commitment (used as Noir private witness).
                    </li>
                    <li>
                        Deployed <code>HonkVerifier</code> VK fingerprint matches{" "}
                        <code>src/lib/circuits/vk_fingerprint.json</code>.
                    </li>
                </ul>

                <h2>Troubleshooting</h2>
                <div className="not-prose space-y-2 text-sm my-4">
                    {[
                        ["FHE stage mismatch", "Proof must use the same finalCt handle as the staged Zama result."],
                        ["Criteria schema mismatch", "Redeploy engine after build:circuit; schema hash is versioned."],
                        ["SumcheckFailed / VK mismatch", "Run build:circuit and redeploy HonkVerifier on Sepolia."],
                        ["Nullifier mismatch", "Re-apply anonymously; recover nullifier in semaphore.ts if needed."],
                        ["No Zama FHE result handle", "Complete stage/finalize or ensure getAnonymousResult is set."],
                    ].map(([issue, fix]) => (
                        <div key={issue} className="flex gap-2 rounded-lg border border-slate-200 p-2.5 bg-white">
                            <span className="font-bold text-slate-800 shrink-0">{issue}:</span>
                            <span className="text-slate-600">{fix}</span>
                        </div>
                    ))}
                </div>
            </Prose>
        </motion.div>
    );
}
