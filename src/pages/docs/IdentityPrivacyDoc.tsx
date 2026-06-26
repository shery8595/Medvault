import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export function IdentityPrivacyDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-4 gap-3 my-6">
                    {[
                        { href: "/docs/zama-fhe", title: "Zama FHE", desc: "SDK, coprocessor, ACL, proof accounts" },
                        { href: "/docs/semaphore", title: "Semaphore", desc: "Anonymous apply, nullifiers, ephemeral wallet" },
                        { href: "/docs/noir", title: "Noir & Honk", desc: "Compliance attestation seal — binds FHE stage to Semaphore identity" },
                        { href: "/docs/mcp", title: "MCP server", desc: "Local AI tools for sponsors & devs (Cursor, Codex, …)" },
                    ].map((card) => (
                        <Link
                            key={card.href}
                            to={card.href}
                            className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-[#00685f]/40 hover:shadow-sm transition-all"
                        >
                            <p className="text-sm font-bold text-slate-900 m-0">{card.title}</p>
                            <p className="text-xs text-slate-500 mt-1 m-0">{card.desc}</p>
                        </Link>
                    ))}
                </div>

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    This hub covers <strong>Privy</strong>, the <strong>HTTP relayer</strong>, the optional{" "}
                    <strong>private faucet</strong>, and <strong>Reclaim</strong>. For encryption and ZK identity, use the
                    dedicated pages above. <strong>Chainlink Automation</strong> is on its{" "}
                    <Link to="/docs/automation" className="text-[#00685f] font-semibold hover:underline">
                        automation page
                    </Link>
                    .
                </p>

                <h2>Privy (authentication &amp; embedded wallets)</h2>
                <p>
                    The dApp wraps the tree in <code>@privy-io/react-auth</code> (see <code>App.tsx</code>).{" "}
                    <code>VITE_PRIVY_APP_ID</code> must be set; users get an embedded EVM wallet on Ethereum Sepolia by
                    default. <code>Web3Context.tsx</code> bridges Privy&apos;s wallet to <code>ethers.js</code>, keeps the
                    chain on <strong>11155111</strong>, and initializes the FHE client when ready (<code>isFHEReady</code>
                    ).
                </p>
                <ul>
                    <li>
                        <strong>Sign-in:</strong> email / social / wallet link — whatever you enable in the Privy
                        dashboard.
                    </li>
                    <li>
                        <strong>Gas:</strong> users still need Ethereum Sepolia ETH for transactions; use the faucet
                        section below.
                    </li>
                </ul>

                <h2>Testnet ETH (Ethereum Sepolia)</h2>
                <p>
                    Users need native Sepolia ETH for gas. The app links to public faucets via{" "}
                    <code>src/lib/network.ts</code> (<code>SEPOLIA_FAUCET_LINKS</code>, QuickNode / Alchemy / Chainlink).
                    Optional in-app drips use <code>src/lib/testnetFaucet.ts</code>:
                </p>
                <ul>
                    <li>
                        <code>VITE_TESTNET_FAUCET_URL</code> — base URL for <code>POST /drip</code> on your own drip
                        service (must target <strong>Ethereum Sepolia</strong>, chain ID <code>11155111</code>). In dev,
                        if unset, the code may default to a local port (see that file).
                    </li>
                    <li>
                        <code>VITE_TESTNET_FAUCET_PAGE_URL</code> — optional link to a public faucet page (e.g.
                        QuickNode) when no API is configured.
                    </li>
                </ul>

                <h2>MedVault HTTP relayer</h2>
                <h3>Gas-sponsored Semaphore apply</h3>
                <p>
                    Anonymous trial apply uses a <strong>two-step</strong> relay: <code>POST /relay/apply-stage</code>{" "}
                    (registry stages FHE eligibility + Semaphore verify) then <code>POST /relay/apply-finalize</code> after the
                    browser runs Zama FHE <strong>decrypt-for-tx</strong> on the staged boolean (only if eligible). Client entry:{" "}
                    <code>src/lib/relayer.ts</code> → <code>submitViaRelayer(...)</code>. Deprecated{" "}
                    <code>POST /relay/apply</code> returns HTTP 410 — do not document it as the live path.
                </p>
                <h3>Withdrawal completion &amp; public exit</h3>
                <p>
                    The relayer also supports encrypted withdrawal completion and optional stealth ETH exits:
                </p>
                <ul>
                    <li>
                        <code>POST /relay/completion-proof</code> — KMS sufficiency proofs for{" "}
                        <code>completeWithdraw</code>, <code>completeWithdrawTo</code>, and unstake watchers (
                        <code>relayer/watcher.mjs</code>).
                    </li>
                    <li>
                        <code>POST /relay/public-exit</code> — accepts EIP-712 signed{" "}
                        <code>completePublicExit</code> authorization + KMS proofs; submits from the relayer wallet.
                        Fast mode submits immediately; private-batch mode queues in{" "}
                        <code>relayer/batch-exit-queue.mjs</code>.
                    </li>
                </ul>
                <p>
                    Authorize the relayer on <code>ConfidentialETH</code> via <code>authorizeContract</code> when using{" "}
                    <code>revealWithdrawAmountFor</code> / <code>revealWithdrawToAmountFor</code> for claim auto-completion.
                    See <Link to="/docs/private-withdrawals" className="font-semibold text-[#00685f]">Private withdrawals</Link>.
                </p>
                <p>
                    In local dev, Vite can proxy <code>/relay</code> to your Railway/host URL to avoid CORS; optional{" "}
                    <code>VITE_RELAYER_URL</code> overrides the base URL (see <code>.env.example</code>). On production (
                    <a href="https://med-vault.xyz" className="font-semibold text-[#00685f] hover:underline">
                        med-vault.xyz
                    </a>
                    ), set the relayer&apos;s <code>FRONTEND_URL</code> to that origin for CORS, or terminate relay traffic
                    through a same-origin proxy.
                </p>
                <p>
                    Env vars on the server typically include <code>RELAYER_PRIVATE_KEY</code>, <code>RPC_URL</code>,{" "}
                    <code>REGISTRY_ADDRESS</code>, <code>SEMAPHORE_ADDRESS</code>, and <code>FRONTEND_URL</code> for CORS.
                    Never send user private keys to the relayer.
                </p>

                <Callout type="info" title="Semaphore &amp; Zama FHE depth">
                    See <Link to="/docs/semaphore" className="font-semibold text-[#00685f]">Semaphore identity</Link> and{" "}
                    <Link to="/docs/zama-fhe" className="font-semibold text-[#00685f]">Zama FHE</Link> for
                    full flows (ephemeral wallet, stage/finalize, proof accounts).
                </Callout>

                <h2>Reclaim (attestations)</h2>
                <p>
                    <code>src/lib/reclaim.ts</code> integrates Reclaim&rsquo;s flow when you need off-chain or OAuth-style
                    attestations bridged to the chain. Proofs must be checked against the verifier addresses you deploy
                    (see <code>addresses.json</code> and Reclaim&rsquo;s address book for your chain).
                </p>

                <Callout type="info" title="Noir depth">
                    Attestation circuit, 16 public inputs, FHE stage binding, and{" "}
                    <code>attestationReceipt</code> are documented on{" "}
                    <Link to="/docs/noir" className="font-semibold text-[#00685f]">Noir compliance attestation</Link>.
                </Callout>

                <CodeBlock
                    language="text"
                    filename="Stack at a glance"
                    code={`Privy (login + sponsor/patient EOA) → Web3Context → ethers + @zama-fhe/sdk
Ethereum Sepolia RPC + contracts (addresses.json)
testnet faucet POST /drip OR public Sepolia faucet page → test ETH
relayer.ts → POST /relay/apply-stage then /relay/apply-finalize (after browser Zama FHE decrypt)
withdrawFlow.ts → encryptUint64 + optional POST /relay/public-exit (fast or batched stealth exit)
semaphore.ts → Semaphore identity + ephemeral signer + proofs
reclaim.ts → optional attestations
useEligibilityProof.ts + noir.ts → sealResult() attestation after Zama FHE decrypt`}
                />

                <Callout type="info" title="Read next">
                    <Link to="/docs/frontend" className="text-blue-700 font-semibold">
                        Frontend architecture
                    </Link>{" "}
                    for provider order,{" "}
                    <Link to="/docs/client-encryption" className="text-blue-700 font-semibold">
                        client encryption
                    </Link>{" "}
                    for FHE,{" "}
                    <Link to="/docs/automation" className="text-blue-700 font-semibold">
                        Chainlink Automation
                    </Link>{" "}
                    for keeper finalization, and{" "}
                    <Link to="/docs/deployment" className="text-blue-700 font-semibold">
                        deployment
                    </Link>{" "}
                    for env vars.
                </Callout>
            </Prose>
        </motion.div>
    );
}
