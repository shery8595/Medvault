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
                    MedVault keeps withdrawal <strong>amounts encrypted</strong> through request staging and pending
                    accounting. Only the <strong>sufficiency bit</strong> is publicly decryptable at request time.
                    Native ETH settlement is a separate, explicit public-exit path with optional relayer submission and
                    stealth recipients.
                </p>

                <div className="not-prose grid sm:grid-cols-3 gap-3 my-8">
                    {[
                        {
                            title: "Encrypted staging",
                            desc: "requestWithdraw / requestWithdrawTo take externalEuint64 + inputProof; pending amounts are euint64.",
                        },
                        {
                            title: "Two-phase complete",
                            desc: "reveal*Amount → KMS amount proof → completeWithdraw / completeWithdrawTo.",
                        },
                        {
                            title: "Public exit (optional)",
                            desc: "EIP-712 signed completePublicExit to a stealth address via relayer (fast or batched).",
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
                    filename="Private withdrawal lifecycle"
                    code={`1. Client encryptUint64(contract, proofAccount, units)
2. requestWithdraw(encryptedUnits, inputProof)
   → FHE.ge(balance, amount); only sufficient ebool is publicly decryptable
3. publicDecrypt(sufficientHandle) → revealWithdrawAmount
4. publicDecrypt(amountHandle) → completeWithdraw(amountProof)
   OR sign EIP-712 + relayer → completePublicExit(stealthRecipient)

Reward claims (authorized):
  SponsorIncentiveVault.claimParticipantRewards(..., encryptedUnits, inputProof)
  → ConfidentialETH.requestWithdrawTo (encrypt with vault address as proof account)

Private staking:
  stakeFromConfidential → requestPrivateUnstake → completePrivateUnstake
  (value returns to encrypted cETH; no Aave exit)`}
                />

                <h2>II. ConfidentialETH API (v0.9)</h2>
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
                                ["requestWithdraw(enc, proof)", "Patient", "Stage encrypted wallet withdraw"],
                                ["requestWithdrawTo(user, dest, enc, proof)", "Authorized vault", "Stage claim payout to destination"],
                                ["revealWithdrawAmount / *For", "Patient or authorized relayer", "Make amount handle publicly decryptable"],
                                ["completeWithdraw(amountProof)", "Patient", "Subtract encrypted balance; send ETH to msg.sender"],
                                ["completeWithdrawTo(user, amountProof)", "Anyone after reveal", "Send ETH to stored destination"],
                                ["completePublicExit(...)", "Relayer with EIP-712 sig", "Send ETH to signed stealth recipient"],
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

                <h2>III. Client encryption binding</h2>
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
await cEth.requestWithdraw(encrypted.handle, encrypted.inputProof);`}
                />

                <h2>IV. Exit modes (UI)</h2>
                <p>
                    The Financial Enclave exposes three modes via <code>WithdrawModeSelector</code> (
                    <code>src/components/dashboard/WithdrawModeSelector.tsx</code>):
                </p>
                <ul>
                    <li>
                        <strong>Wallet</strong> — patient completes reveal + <code>completeWithdraw</code> from their
                        wallet after KMS proofs (amount visible at settlement).
                    </li>
                    <li>
                        <strong>Fast exit</strong> — patient signs EIP-712 authorization; relayer submits{" "}
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

                <h2>V. EIP-712 public exit</h2>
                <p>
                    Domain: <code>MedVault ConfidentialETH</code> v1. Struct{" "}
                    <code>WithdrawAuthorization(owner, stealthRecipient, sufficientHandle, exitMode, nonce, deadline)</code>
                    . The contract verifies the signature, sufficiency proof, and amount proof, increments{" "}
                    <code>withdrawNonces[owner]</code>, and sends wei to <code>stealthRecipient</code> only.
                </p>
                <p>
                    Client signing: <code>signPublicExitAuthorization</code> in <code>src/lib/withdrawFlow.ts</code>.
                    Stealth key generation: <code>src/lib/stealthAddress.ts</code>. Relayer endpoint:{" "}
                    <code>POST /relay/public-exit</code> (<code>relayer/server.js</code>).
                </p>

                <h2>VI. Private staking (no Aave exit)</h2>
                <p>
                    See also{" "}
                    <Link to="/docs/staking" className="font-semibold text-[#00685f] hover:underline">
                        Private staking
                    </Link>
                    .
                </p>
                <ul>
                    <li>
                        <code>stakeFromConfidential</code> — moves encrypted cETH into encrypted stake ledger (no Aave
                        deposit).
                    </li>
                    <li>
                        <code>requestPrivateUnstake</code> / <code>completePrivateUnstake</code> — releases stake back
                        to cETH via <code>transferEncrypted</code>.
                    </li>
                    <li>
                        <code>requestPublicUnstake</code> / <code>completePublicUnstake</code> — explicit Aave unwind;
                        amounts visible via ERC-20 / gateway events. Aliases <code>requestUnstake</code> /{" "}
                        <code>completeUnstake</code> map here for back-compat.
                    </li>
                </ul>

                <h2>VII. Relayer responsibilities</h2>
                <ul>
                    <li>
                        <code>/relay/completion-proof</code> — unchanged shape for sufficiency KMS proofs on withdraw,
                        withdrawTo, and unstake watchers.
                    </li>
                    <li>
                        <code>/relay/public-exit</code> — accepts signed authorization + KMS proofs; submits{" "}
                        <code>completePublicExit</code>.
                    </li>
                    <li>
                        Relayer wallet must be <code>authorizeContract</code> on ConfidentialETH for{" "}
                        <code>revealWithdrawAmountFor</code> / <code>revealWithdrawToAmountFor</code> when auto-completing
                        claims.
                    </li>
                </ul>

                <h2>VIII. Tests</h2>
                <p>
                    Case IDs: <code>V09-*</code> (encrypted staging + completion), <code>PEX-*</code> (EIP-712 public
                    exit), <code>BEX-*</code> (batch queue), <code>PRIV-*</code> (event privacy),{" "}
                    <code>FLOW-07–09</code> (encrypted claims). Helpers: <code>test-support/withdraw.ts</code>.
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
