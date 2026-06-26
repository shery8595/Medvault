import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

export function SemaphoreDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
                    MedVault uses <strong>Semaphore v4</strong> so patients can prove group membership and apply to
                    trials without revealing <em>which</em> registered member they are. Wallet-linked registration stores
                    encrypted health data; anonymous apply uses Semaphore proofs plus an <strong>ephemeral decrypt
                    wallet</strong> for Zama FHE permits.
                </p>

                <Callout type="info" title="Related docs">
                    <Link to="/docs/zama-fhe" className="font-semibold text-[#00685f] hover:underline">
                        Zama FHE
                    </Link>{" "}
                    for encryption and decrypt-for-tx,{" "}
                    <Link to="/docs/noir" className="font-semibold text-[#00685f] hover:underline">
                        Noir &amp; Honk
                    </Link>{" "}
                    for optional compliance attestation after FHE matching, and{" "}
                    <Link to="/docs/identity-privacy" className="font-semibold text-[#00685f] hover:underline">
                        Identity &amp; privacy
                    </Link>{" "}
                    for relayer and faucet wiring.
                </Callout>

                <h2>What Semaphore does in MedVault</h2>
                <ul className="text-sm">
                    <li>
                        <strong>Registration (linkable):</strong> Patient wallet signs{" "}
                        <code>MedVaultRegistry.registerPatient</code> with a public <strong>identity commitment</strong>{" "}
                        and Zama FHE-encrypted profile fields.
                    </li>
                    <li>
                        <strong>Anonymous apply (unlinkable):</strong> A Semaphore proof shows the caller is in the
                        on-chain patient group for a trial scope without revealing the commitment in the transaction
                        sender.
                    </li>
                    <li>
                        <strong>Nullifier per trial:</strong> Each application consumes a unique nullifier derived from{" "}
                        <code>scope_internal</code> + identity secret — prevents double-apply while staying anonymous.
                    </li>
                </ul>

                <h2>On-chain contracts</h2>
                <div className="not-prose overflow-hidden rounded-xl border border-slate-200 text-sm my-6">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold text-slate-700">Contract</th>
                                <th className="text-left px-3 py-2 font-bold text-slate-700">Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["ISemaphore / Semaphore", "Verify membership proofs; group Merkle tree"],
                                ["MedVaultRegistry", "Patient group, registerPatient, stage/finalize anonymous apply"],
                                ["AnonymousPatientRegistry", "Stores encrypted metrics keyed by commitment"],
                                ["EligibilityEngine", "Reads profiles by commitment; stages FHE eligibility"],
                            ].map(([c, r], i) => (
                                <tr key={c} className={i % 2 ? "bg-slate-50/50" : "bg-white"}>
                                    <td className="px-3 py-2 font-mono text-xs text-[#00685f]">{c}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{r}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm">
                    Addresses: <code>src/lib/contracts/addresses.json</code> (
                    <code>Semaphore</code>, <code>MedVaultRegistry</code>). Tests use{" "}
                    <code>contracts/test/MockSemaphore.sol</code> via <code>test-support/semaphore.ts</code>.
                </p>

                <h2>Frontend: identity lifecycle</h2>
                <p className="text-sm">
                    Primary module: <code>src/lib/semaphore.ts</code> (uses <code>@semaphore-protocol/identity</code>,{" "}
                    <code>group</code>, <code>proof</code>).
                </p>

                <CodeBlock
                    language="typescript"
                    filename="Identity storage & commitment"
                    code={`const IDENTITY_STORAGE_KEY = 'medvault_identity';

// Create or load — export() format for Semaphore v4
export function getOrCreateIdentity(): Identity { ... }

// Public value sent at registration (never the secret)
export function getIdentityCommitment(identity: Identity): bigint {
  return identity.commitment;
}`}
                />

                <h3>Ephemeral permit wallet (H-2)</h3>
                <p className="text-sm">
                    The main Privy wallet must not receive <code>FHE.allow</code> for anonymous scores — that would
                    link identity. Instead, each Semaphore identity deterministically derives an <strong>ephemeral
                    EOA</strong>:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="src/lib/semaphore.ts"
                    code={`export async function generateEphemeralAddress(identity: Identity): Promise<string> {
  const identitySecret = identity.secretScalar.toString();
  const privateKey = ethers.keccak256(
    ethers.toUtf8Bytes(\`medvault:ephemeral:\${identitySecret}\`)
  );
  return new ethers.Wallet(privateKey).address;
}`}
                />
                <p className="text-sm">
                    This address is encoded in the Semaphore proof <strong>signal</strong> as{" "}
                    <code>permitRecipient</code> and receives decrypt rights for staged ciphertexts during{" "}
                    <code>finalizeAnonymousApply</code>.
                </p>

                <Callout type="warning" title="Same browser profile">
                    Clearing <code>medvault_identity</code> from localStorage breaks ephemeral key alignment. Patients
                    must use the same browser where they registered to decrypt scores or finalize apply.
                </Callout>

                <h2>Scope &amp; nullifier alignment</h2>
                <p className="text-sm">
                    Trial scope for Semaphore v4 uses an internal field compatible with the circuit:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="semaphoreScopeField"
                    code={`export function semaphoreScopeField(scope: bigint): bigint {
  return BigInt(keccak256(toBeHex(scope, 32))) >> 8n;
}`}
                />
                <p className="text-sm">
                    After apply, the frontend stores per-trial nullifiers in{" "}
                    <code>medvault_anon_nullifiers</code> for fast UI lookups and for{" "}
                    <Link to="/docs/noir">Noir attestation</Link> witness alignment (
                    <code>deriveProofInputsWithStoredNullifier</code>).
                </p>

                <h2>Anonymous apply flow (stage → finalize)</h2>
                <ol className="text-sm space-y-2">
                    <li>
                        Build Semaphore proof for trial <code>scope</code> with signal including consent bit +{" "}
                        ephemeral address.
                    </li>
                    <li>
                        <strong>Stage:</strong> <code>stageAnonymousApply</code> — verifies proof, runs FHE eligibility
                        staging on <code>EligibilityEngine</code>, stores encrypted boolean result keyed by nullifier.
                    </li>
                    <li>
                        <strong>Decrypt-for-tx (browser):</strong> Ephemeral signer + Zama SDK client decrypts staged{" "}
                        <code>ebool</code> (see <Link to="/docs/zama-fhe">Zama doc</Link>).
                    </li>
                    <li>
                        <strong>Finalize:</strong> Submit plaintext boolean + permit signature to mark application
                        applied (relayer may pay gas via <code>POST /relay/apply-finalize</code>). Optionally bundle a
                        Noir attestation via <code>finalizeAnonymousApplyWithProof</code> to bind the Zama{" "}
                        <code>finalCt</code> stage handle.
                    </li>
                </ol>

                <h2>HTTP relayer (optional gas sponsorship)</h2>
                <p className="text-sm">
                    <code>src/lib/relayer.ts</code> posts to <code>/relay/apply-stage</code> then{" "}
                    <code>/relay/apply-finalize</code>. The relayer holds a hot wallet; it never receives the
                    patient&apos;s Semaphore secret or ephemeral private key. Deprecated <code>POST /relay/apply</code>{" "}
                    returns HTTP 410.
                </p>

                <h2>Security properties</h2>
                <div className="not-prose grid sm:grid-cols-2 gap-3 my-6 text-sm">
                    {[
                        ["Unlinkability", "Apply tx sender ≠ registration wallet; commitment hidden in proof."],
                        ["Nullifier uniqueness", "One active application per (identity, trial scope) on-chain."],
                        ["Consent in signal", "Encrypted consent bound to proof path for gate checks."],
                        ["Merkle root expiry", "Registry sets longer merkleTreeDuration than Semaphore default 1h."],
                    ].map(([t, d]) => (
                        <div key={t} className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="font-bold text-slate-900 m-0 text-xs">{t}</p>
                            <p className="text-slate-600 m-0 mt-1 text-xs leading-relaxed">{d}</p>
                        </div>
                    ))}
                </div>

                <h2>Testing</h2>
                <p className="text-sm">
                    Hardhat: <code>buildMockSemaphoreProof</code> in <code>test-support/semaphore.ts</code>. Integration:{" "}
                    <code>MVR-*</code>, <code>INT-EE-*</code>, <code>E2E-*</code> in{" "}
                    <Link to="/docs/testing/matrix">test matrix</Link>.
                </p>
            </Prose>
        </motion.div>
    );
}
