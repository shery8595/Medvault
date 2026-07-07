import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

export function PrivateWithdrawalsDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    MedVault encrypts withdrawal <strong>amounts</strong> at request time. The sufficiency comparison is
                    computed homomorphically via <code>FHE.select</code> and never surfaces as a public boolean; only the{" "}
                    <strong>transferable amount</strong> is KMS-decrypted at single-step completion. Native ETH settlement
                    uses optional relayer public exit with stealth recipients (EIP-712 v2).
                </p>

                <div className="not-prose grid sm:grid-cols-3 gap-3 my-8">
                    {[
                        {
                            title: "Encrypted staging",
                            desc: "requestWithdraw / requestWithdrawTo take externalEuint64 + inputProof; pending transferable is euint64.",
                        },
                        {
                            title: "Single-step complete",
                            desc: "completeWithdraw / completeWithdrawTo with one transferable KMS proof (no reveal phase).",
                        },
                        {
                            title: "Public exit (optional)",
                            desc: "EIP-712 v2 signed completePublicExit to a stealth address via relayer (fast or batched).",
                        },
                    ].map((c) => (
                        <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-bold text-slate-900 m-0">{c.title}</p>
                            <p className="text-xs text-slate-500 mt-1 m-0">{c.desc}</p>
                        </div>
                    ))}
                </div>

                <h2>I. End-to-end flow</h2>
                <CodeBlock
                    language="text"
                    filename="Private withdrawal lifecycle (v2)"
                    code={`1. Client encryptUint64(contract, proofAccount, units)
2. requestWithdraw(encryptedUnits, inputProof)
   → transferable = FHE.select(ge(balance, units), units, 0)
   → emit transferableHandle (no public sufficiency boolean)
3. publicDecrypt(transferable) → completeWithdraw(transferableProof)
   → units > 0: burn + transfer ETH
   → units == 0: InsufficientWithdrawNoop (no revert)
   OR sign EIP-712 v2 + relayer → completePublicExit(stealthRecipient)

Reward claims (authorized) — pull receipt, then withdraw-to:
  Sponsor: distributePartial* → entitlementStaged (no cETH at distribute)
  Patient confirm: prepareEntitlementProof → publicDecrypt → confirmReceipt
  Patient claim: claimParticipantRewards → requestWithdrawTo → completeWithdrawTo

Private staking:
  stakeAndLock (cETH operator or confidentialTransferAndCall)
  requestPrivateUnstake → completePrivateUnstake`}
                />

                <h2>II. ConfidentialETH API</h2>
                <div className="not-prose overflow-x-auto my-6 rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold text-xs">Function</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Who calls</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-slate-600">
                            {[
                                ["requestWithdraw(enc, proof)", "Patient", "Stage homomorphic transferable withdraw"],
                                ["requestWithdrawTo(user, dest, enc, proof, nonce, deadline, sig)", "Authorized vault", "Stage claim payout — user must sign WithdrawTo EIP-712"],
                                ["completeWithdraw(transferableProof)", "Patient", "KMS verify transferable; burn + send ETH or noop"],
                                ["completeWithdrawTo(user, transferableProof)", "Authorized contract only", "Send ETH to stored destination"],
                                ["completePublicExit(..., transferableProof)", "Relayer with EIP-712 v2 sig", "Send ETH to signed stealth recipient"],
                                ["claimFailedWithdraw()", "Balance owner or failed recipient", "Pull escrowed wei — owner on failed public exit; direct recipient on withdraw paths"],
                                ["transferEncrypted(from, to, amount)", "Authorized contract", "Homomorphic transfer — no public decrypt"],
                            ].map(([fn, who, purpose]) => (
                                <tr key={fn} className="border-b border-slate-100">
                                    <td className="px-3 py-2 font-mono text-[#00685f]">{fn}</td>
                                    <td className="px-3 py-2">{who}</td>
                                    <td className="px-3 py-2">{purpose}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Callout type="warning" title="UNIT_SCALE">
                    1 encrypted unit = <code>UNIT_SCALE</code> wei (1e12 wei = 1 micro-ETH). Client helpers in{" "}
                    <code>src/lib/fhe.ts</code> and <code>withdrawFlow.ts</code> use the same micro-ETH mapping as
                    deposits.
                </Callout>

                <h2>III. Withdraw-to authorization (claims)</h2>
                <p>
                    When an authorized vault calls <code>requestWithdrawTo</code>, the <strong>user</strong> (balance owner)
                    must sign EIP-712 <code>WithdrawTo(user, destination, encryptedUnitsHandle, nonce, deadline)</code>.
                    The contract verifies the signature before staging encrypted pending state. Reward claims pass the same{" "}
                    <code>nonce</code>, <code>deadline</code>, and <code>signature</code> through{" "}
                    <code>SponsorIncentiveVault.claimParticipantRewards</code> /{" "}
                    <code>claimParticipantRewardsFor</code>.
                </p>
                <p>
                    Gasless claims additionally bind <code>encryptedAmountCommitment = keccak256(encryptedHandle ‖ inputProof)</code>{" "}
                    in the vault claim EIP-712 struct so relayers cannot swap ciphertexts.
                </p>

                <h2>IV. Client encryption binding</h2>
                <p>
                    Zama input proofs are scoped to <code>(verifyingContract, proofAccount)</code>. Wrong binding
                    causes <code>InvalidSigner()</code> on-chain.
                </p>
                <ul>
                    <li>
                        <strong>Wallet withdraw:</strong> encrypt with <code>(ConfidentialETH, patient EOA)</code>
                    </li>
                    <li>
                        <strong>Reward claim → withdrawTo:</strong> encrypt with{" "}
                        <code>(ConfidentialETH, SponsorIncentiveVault)</code> — the vault is the authorized caller
                    </li>
                    <li>
                        <strong>Private stake / unstake:</strong> encrypt with{" "}
                        <code>(StakingManager, patient EOA)</code>
                    </li>
                </ul>

                <CodeBlock
                    language="typescript"
                    filename="src/lib/withdrawFlow.ts"
                    code={`import { encryptUint64 } from "./fhe";

// Wallet withdraw
const encrypted = await encryptUint64(cEthAddress, patientAddress, units);
await cEth.requestWithdraw(encrypted.handle, encrypted.inputProof);
// Later: single completeWithdraw(transferableCleartexts, transferableProof)`}
                />

                <h2>VI. Pull receipt before claim (P0-1)</h2>
                <p>
                    Sponsor <code>distributePartial*</code> only <strong>stages</strong> entitlements. Patients must confirm
                    before cETH exists in their confidential balance:
                </p>
                <ul>
                    <li><code>prepareEntitlementProof</code> — makes the staged entitlement ebool publicly decryptable</li>
                    <li><code>publicDecrypt</code> via <code>@zama-fhe/sdk</code> — returns <code>cleartexts</code> + <code>decryptionProof</code></li>
                    <li><code>confirmReceipt</code> — verifies proof, credits cETH, sets <code>confirmedPayout</code></li>
                </ul>
                <p>
                    Client: <code>src/lib/confirmReceiptFlow.ts</code> (confirm helpers), integrated in{" "}
                    <code>src/lib/claimFlow.ts</code> before <code>claimParticipantRewards</code>. Confirm txs are sent from
                    the Semaphore ephemeral permit holder; FHE public decrypt uses the connected main wallet SDK.
                </p>
                <p>
                    After <code>CHALLENGE_WINDOW</code> (7 days), sponsors call <code>pruneUnconfirmedSlots</code> for
                    patients who never confirmed. See{" "}
                    <Link to="/docs/zero-revelation-rewards" className="font-semibold text-[#00685f] hover:underline">
                        zero-revelation rewards
                    </Link>.
                </p>

                <h2>VII. Exit modes (UI)</h2>
                <p>
                    The Financial Enclave exposes three modes via <code>WithdrawModeSelector</code> (
                    <code>src/components/dashboard/WithdrawModeSelector.tsx</code>):
                </p>
                <ul>
                    <li>
                        <strong>Wallet</strong> — patient calls <code>completeWithdraw</code> from their wallet after
                        staging (amount visible at settlement).
                    </li>
                    <li>
                        <strong>Fast exit</strong> — patient signs EIP-712 v2 authorization; relayer submits{" "}
                        <code>completePublicExit</code> immediately to a one-time stealth address (
                        <code>EXIT_MODE_FAST = 0</code>).
                    </li>
                    <li>
                        <strong>Private exit</strong> — same signature path, but relayer queues in{" "}
                        <code>batch-exit-queue.mjs</code> until <code>minBatchSize</code> or <code>maxWaitMs</code> (
                        <code>EXIT_MODE_PRIVATE_BATCH = 1</code>) for timing unlinkability.
                    </li>
                </ul>

                <Callout type="info" title="What batching does not hide">
                    Final native ETH transfer amounts remain public on L1. Batching improves{" "}
                    <em>timing</em> correlation resistance, not amount privacy. Stealth addresses improve recipient
                    unlinkability; relayer submission hides <code>tx.from</code> as gas payer.
                </Callout>

                <h2>VIII. EIP-712 public exit (v2)</h2>
                <p>
                    Domain: <code>MedVault ConfidentialETH</code> <strong>v2</strong>. Struct{" "}
                    <code>WithdrawAuthorization(owner, stealthRecipient, transferableHandle, exitMode, nonce, deadline)</code>
                    . The contract verifies the signature and a single transferable KMS proof, then sends wei to{" "}
                    <code>stealthRecipient</code> only. On success (or <code>units == 0</code> noop),{" "}
                    <code>withdrawNonces[owner]</code> increments.
                </p>
                <p>
                    If the ETH transfer to <code>stealthRecipient</code> fails, escrow credits{" "}
                    <code>pendingFailedWithdrawWei[owner]</code> (not the stealth address),{" "}
                    <code>withdrawNonces[owner]</code> is <strong>not</strong> consumed, and the owner recovers via{" "}
                    <code>claimFailedWithdraw()</code>. Burn still completes.
                </p>
                <p>
                    Client signing: <code>signPublicExitAuthorization</code> in <code>src/lib/withdrawFlow.ts</code> (
                    <code>CONFIDENTIAL_ETH_EIP712_VERSION = &quot;2&quot;</code>). Stealth key generation:{" "}
                    <code>src/lib/stealthAddress.ts</code>. Relayer endpoint:{" "}
                    <code>POST /relay/public-exit</code> with <code>transferableHandle</code> (
                    <code>relayer/server.js</code>).
                </p>

                <h2>IX. Private staking (no Aave exit)</h2>
                <p>
                    See also{" "}
                    <Link to="/docs/staking" className="font-semibold text-[#00685f] hover:underline">
                        Private staking
                    </Link>
                    .
                </p>
                <ul>
                    <li>
                        <code>stakeAndLock</code> — canonical confidential stake via ERC-7984{" "}
                        <code>confidentialTransferFromAndCall</code> (set cETH operator first, or use{" "}
                        <code>confidentialTransferAndCall</code> with <code>stakeAndLockCallbackData</code>).{" "}
                        Deprecated: <code>requestConfidentialStake</code> / <code>completeConfidentialStake</code> /{" "}
                        <code>stakeFromConfidential</code> revert <code>Use stakeAndLock</code>.
                    </li>
                    <li>
                        <code>requestPrivateUnstake</code> / <code>completePrivateUnstake</code> — releases stake back
                        to cETH via homomorphic <code>transferEncrypted</code>.
                    </li>
                    <li>
                        <code>requestPublicUnstake</code> / <code>completePublicUnstake</code> — explicit Aave unwind;
                        amounts visible via ERC-20 / gateway events.
                    </li>
                </ul>

                <h2>X. Relayer responsibilities</h2>
                <ul>
                    <li>
                        <code>/relay/completion-proof</code> — returns cached transferable <code>uint64</code> KMS proof
                        for withdraw, withdrawTo, and unstake watchers.
                    </li>
                    <li>
                        <code>/relay/public-exit</code> — accepts signed EIP-712 v2 authorization + transferable proof;
                        submits <code>completePublicExit</code>.
                    </li>
                    <li>
                        Relayer wallet must be authorized on ConfidentialETH via{" "}
                        <code>scheduleContractAuth</code> / <code>applyContractAuth</code> for auto{" "}
                        <code>completeWithdrawTo</code> on claim payouts.
                    </li>
                </ul>

                <h2>XI. Honest limits</h2>
                <ul>
                    <li>Insufficient requests settle to <code>0</code> with <code>InsufficientWithdrawNoop</code> — no on-chain sufficiency boolean at request time.</li>
                    <li>Final ETH transfer amount remains public at settlement (L1 limitation).</li>
                </ul>

                <h2>XII. Tests</h2>
                <p>
                    Case IDs: <code>P01-01..05</code> (pull receipt + prune), <code>TL-05</code> (withdraw-to sig),{" "}
                    <code>SUF-01..07</code> (transferable completion),{" "}
                    <code>SUF-05 / PEX-*</code> (EIP-712 v2 public exit, including PEX-06 failed-exit escrow), <code>BEX-*</code> (batch queue),{" "}
                    <code>PRIV-*</code> + <code>SUF-06</code> (event privacy), <code>FLOW-07–09</code>,{" "}
                    <code>E2E-09</code> (encrypted claims). Helpers: <code>test-support/withdraw.ts</code>.
                </p>

                <Callout type="tip" title="Read next">
                    <Link to="/docs/client-encryption" className="text-[#00685f] font-semibold">
                        Client encryption
                    </Link>
                    ,{" "}
                    <Link to="/docs/identity-privacy" className="text-[#00685f] font-semibold">
                        Identity &amp; relayer
                    </Link>
                    ,{" "}
                    <Link to="/docs/contracts" className="text-[#00685f] font-semibold">
                        Contract reference
                    </Link>
                    ,{" "}
                    <Link to="/docs/testing/matrix" className="text-[#00685f] font-semibold">
                        Test matrix
                    </Link>
                    .
                </Callout>
            </Prose>
        </motion.div>
    );
}
