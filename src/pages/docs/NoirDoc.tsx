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
                    consent run on ciphertext in <code>EligibilityEngine</code>.                     <strong>Noir</strong> is a narrow{" "}
                    <strong>public attestation seal</strong> — it does not replace FHE matching. MedVault ships{" "}
                    <strong>two circuits</strong>: <code>eligibility_plaintext</code> (25 public inputs, eligibility bit
                    in-circuit) and <code>eligibility_encrypted</code> (15 public inputs, FHE-only eligibility). Proofs
                    verify on-chain via <code>HonkVerifier.sol</code> or <code>HonkVerifierEncrypted.sol</code>{" "}
                    (UltraHonk, EVM Keccak transcript), selected by <code>trial.encryptedCriteria</code>.
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

                <h2>What the circuits attest</h2>
                <p className="text-sm">
                    <strong>Plaintext mode</strong> (<code>circuits/eligibility_plaintext</code>) — compliance mirror
                    with in-circuit <code>eligible</code> bit. <strong>Encrypted mode</strong> (
                    <code>circuits/eligibility_encrypted</code>) — identity + binding only; Zama FHE decides eligibility.
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

                <h2>Public inputs — plaintext (25)</h2>
                <p className="text-sm">
                    Solidity-facing count: <code>ELIGIBILITY_PUBLIC_INPUT_COUNT = 25</code> in{" "}
                    <code>src/lib/noir.ts</code>. Wired to <code>eligibilityVerifier</code>. Document bindings (indices
                    17–24) are zero when <code>has_document = 0</code>.
                </p>
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
                                ["7", "min_age"],
                                ["8", "max_age"],
                                ["9", "requires_diabetes"],
                                ["10", "min_hb"],
                                ["11", "gender_requirement"],
                                ["12", "min_height"],
                                ["13", "max_weight"],
                                ["14", "requires_non_smoker"],
                                ["15", "requires_normal_bp"],
                                ["16", "criteria_mode (0)"],
                                ["17", "doc_cid_hash"],
                                ["18", "aes_key_ct_hash"],
                                ["19–22", "aes_key_fhe_handle_hash_0 … _3"],
                                ["23", "doc_schema_hash"],
                                ["24", "has_document"],
                            ].map(([idx, field], i) => (
                                <tr key={idx} className={i % 2 ? "bg-slate-50/50" : "bg-white"}>
                                    <td className="px-3 py-2">{idx}</td>
                                    <td className="px-3 py-2">{field}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Public inputs — encrypted (15)</h2>
                <p className="text-sm">
                    <code>ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT = 15</code>. Wired to{" "}
                    <code>eligibilityVerifierEncrypted</code>. No in-circuit <code>eligible</code> bit — FHE{" "}
                    <code>finalCt</code> is authoritative.
                </p>
                <ul className="text-xs font-mono text-sm space-y-1">
                    <li>0 scope · 1 nullifier · 2 result_hash · 3 fhe_stage_handle_hash</li>
                    <li>4 criteria_schema_hash · 5 encrypted_criteria_binding_hash · 6 criteria_mode (= 1)</li>
                    <li>7–13 document binding (same layout as plaintext) · 14 has_document</li>
                </ul>

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
                    input-proof primitives not yet wired in this repo. See{" "}
                    <a
                        href="https://github.com/shery8595/Med-Vault/blob/main/SECURITY.md"
                        className="font-semibold text-[#00685f] hover:underline"
                    >
                        SECURITY.md
                    </a>{" "}
                    (Noir–FHE integrity gap).
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
# → src/lib/circuits/eligibility_plaintext.json
# → src/lib/circuits/eligibility_encrypted.json
# → contracts/HonkVerifier.sol + HonkVerifierEncrypted.sol

npm run deploy:sepolia
# Deploy both verifiers + schedule engine wiring

npm run deploy:wiring:sepolia
# After 6h timelock — apply eligibilityVerifier + eligibilityVerifierEncrypted`}
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
                        Deployed <code>HonkVerifier</code> / <code>HonkVerifierEncrypted</code> VK fingerprints match{" "}
                        <code>src/lib/circuits/vk_fingerprint.json</code> (plaintext + encrypted keys).
                    </li>
                </ul>

                <h2>Troubleshooting</h2>
                <div className="not-prose space-y-2 text-sm my-4">
                    {[
                        ["FHE stage mismatch", "Proof must use the same finalCt handle as the staged Zama result."],
                        ["Criteria schema mismatch", "Redeploy engine after build:circuit; schema hash is versioned."],
                        ["SumcheckFailed / VK mismatch", "Run build:circuit and redeploy both Honk verifiers on Sepolia."],
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
