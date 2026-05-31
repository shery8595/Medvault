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

                <div className="not-prose grid sm:grid-cols-3 gap-3 my-6">
                    {[
                        { href: "/docs/fhenix-cofhe", title: "Fhenix & CoFHE", desc: "SDK, coprocessor, ACL, proof accounts" },
                        { href: "/docs/semaphore", title: "Semaphore", desc: "Anonymous apply, nullifiers, ephemeral wallet" },
                        { href: "/docs/noir", title: "Noir & Honk", desc: "Circuit, browser prove, on-chain verify" },
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
                    <code>VITE_PRIVY_APP_ID</code> must be set; users get an embedded EVM wallet on Arbitrum Sepolia by
                    default. <code>Web3Context.tsx</code> bridges Privy&apos;s wallet to <code>ethers.js</code>, keeps the
                    chain on <strong>421614</strong>, and initializes the FHE client when ready (<code>isFHEReady</code>
                    ).
                </p>
                <ul>
                    <li>
                        <strong>Sign-in:</strong> email / social / wallet link — whatever you enable in the Privy
                        dashboard.
                    </li>
                    <li>
                        <strong>Gas:</strong> users still need Sepolia ETH on Arbitrum for transactions; use the faucet
                        section below.
                    </li>
                </ul>

                <h2>Private testnet faucet (<code>arb-sepolia-faucet</code>)</h2>
                <p>
                    The repo includes a small Node server under <code>arb-sepolia-faucet/</code> that exposes{" "}
                    <code>POST /drip</code> with rate limits — useful when public faucets are flaky or you want a branded in-app
                    “Request drip” button. The UI wires this through <code>src/lib/testnetFaucet.ts</code>:
                </p>
                <ul>
                    <li>
                        <code>VITE_TESTNET_FAUCET_URL</code> — base URL for <code>POST /drip</code> (e.g. your deployed{" "}
                        <code>arb-sepolia-faucet</code> service). In dev, if unset, the code may default to a local port
                        (see that file).
                    </li>
                    <li>
                        <code>VITE_TESTNET_FAUCET_PAGE_URL</code> — optional link to a public faucet page (e.g.
                        QuickNode) when no API is configured.
                    </li>
                </ul>

                <h2>MedVault HTTP relayer (gas-sponsored Semaphore apply)</h2>
                <p>
                    Anonymous trial apply uses a <strong>two-step</strong> relay: <code>POST /relay/apply-stage</code>{" "}
                    (registry stages FHE eligibility + Semaphore verify) then <code>POST /relay/apply-finalize</code> after the
                    browser runs CoFHE <strong>decrypt-for-tx</strong> on the staged boolean (only if eligible). Client entry:{" "}
                    <code>src/lib/relayer.ts</code> → <code>submitViaRelayer(...)</code>. Deprecated{" "}
                    <code>POST /relay/apply</code> returns HTTP 410 — do not document it as the live path.
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

                <Callout type="info" title="Semaphore &amp; CoFHE depth">
                    See <Link to="/docs/semaphore" className="font-semibold text-[#00685f]">Semaphore identity</Link> and{" "}
                    <Link to="/docs/fhenix-cofhe" className="font-semibold text-[#00685f]">Fhenix &amp; CoFHE</Link> for
                    full flows (ephemeral wallet, stage/finalize, proof accounts).
                </Callout>

                <h2>Reclaim (attestations)</h2>
                <p>
                    <code>src/lib/reclaim.ts</code> integrates Reclaim&rsquo;s flow when you need off-chain or OAuth-style
                    attestations bridged to the chain. Proofs must be checked against the verifier addresses you deploy
                    (see <code>addresses.json</code> and Reclaim&rsquo;s address book for your chain).
                </p>

                <Callout type="info" title="Noir depth">
                    Circuit design, build pipeline, and <code>verifyEligibilityProof</code> are documented on{" "}
                    <Link to="/docs/noir" className="font-semibold text-[#00685f]">Noir &amp; Honk proofs</Link>.
                </Callout>

                <CodeBlock
                    language="text"
                    filename="Stack at a glance"
                    code={`Privy (login + sponsor/patient EOA) → Web3Context → ethers + @cofhe/sdk
Arbitrum Sepolia RPC + contracts (addresses.json)
arb-sepolia-faucet POST /drip OR public faucet page → test ETH
relayer.ts → POST /relay/apply-stage then /relay/apply-finalize (after browser CoFHE decrypt)
semaphore.ts → Semaphore identity + ephemeral signer + proofs
reclaim.ts → optional attestations
useEligibilityProof.ts + noir.ts → Noir circuit / Honk verifier path`}
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
