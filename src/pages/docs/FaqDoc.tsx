import type { ReactNode } from "react";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { PRODUCTION_APP_URL } from "../../lib/docsNav";

const faqs: { q: string; a: ReactNode }[] = [
    {
        q: "Is there an Android app?",
        a: (
            <>
                Yes — an internal <strong>demo APK</strong> built with Capacitor (same web dapp in a WebView). Build
                instructions:{" "}
                <Link to="/docs/mobile/android-apk" className="text-[#00685f] font-semibold">
                    Android APK docs
                </Link>
                . You need Privy to allow <code>https://localhost</code> and Sepolia testnet ETH. Browser wallet
                extensions do not work inside the APK — use Privy embedded wallets.
            </>
        ),
    },
    {
        q: "Where is the public MedVault app?",
        a: (
            <>
                Production is at{" "}
                <a href={PRODUCTION_APP_URL} className="text-[#00685f] font-semibold hover:underline">
                    med-vault.xyz
                </a>
                . Local development uses <code>http://localhost:3000</code>. Semaphore identity and vault backups in{" "}
                <code>localStorage</code> are per-origin — restore your identity backup on production if you registered on
                localhost.
            </>
        ),
    },
    {
        q: "Which network does MedVault use?",
        a: (
            <>
                The app is configured for <strong>Ethereum Sepolia</strong> (chain ID <code>11155111</code>) with Privy
                embedded wallets. Use a faucet for test ETH before sending FHE-heavy transactions.
            </>
        ),
    },
    {
        q: "Why do some transactions take a long time?",
        a: "FHE operations are evaluated by the fhEVM coprocessor. Latency is higher than a simple transfer; the UI should show pending states until the receipt confirms.",
    },
    {
        q: "Where is my health data decrypted?",
        a: "Only in contexts authorized by FHE ACL and, where applicable, patient-signed viewing flows. Ciphertexts live on-chain; plaintext should only exist in the patient-controlled client when deliberately decrypted.",
    },
    {
        q: "What replaced the old PatientRegistry?",
        a: (
            <>
                The system uses <code>AnonymousPatientRegistry</code> for private identity membership and{" "}
                <code>MedVaultRegistry</code> for encrypted health vault state. See the{" "}
                <Link to="/docs/contracts" className="text-blue-600 font-semibold">
                    contract reference
                </Link>{" "}
                and{" "}
                <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold">
                    identity &amp; privacy
                </Link>{" "}
                pages.
            </>
        ),
    },
    {
        q: "How do sponsors get verified?",
        a: "Trials are gated through SponsorRegistry allowlisting. The exact admin flow depends on your deployment; see the sponsor system and deployment docs.",
    },
    {
        q: "What is Privy used for?",
        a: (
            <>
                <strong>Privy</strong> handles sign-in and issues the embedded EVM wallet the app uses by default, wired
                through <code>Web3Context.tsx</code>. You need <code>VITE_PRIVY_APP_ID</code> in <code>.env</code> from
                the Privy dashboard.
            </>
        ),
    },
    {
        q: "How do I get test ETH on Ethereum Sepolia?",
        a: (
            <>
                Use a public Ethereum Sepolia ETH faucet (QuickNode, Alchemy, Chainlink), or run the optional drip
                microservice and set <code>VITE_TESTNET_FAUCET_URL</code> for in-app drips. See{" "}
                <code>src/lib/testnetFaucet.ts</code> and the{" "}
                <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold">
                    identity &amp; tooling
                </Link>{" "}
                page.
            </>
        ),
    },
    {
        q: "Are withdrawals private?",
        a: (
            <>
                <strong>Amounts are encrypted</strong> when you stage a withdraw or claim: the contract stores{" "}
                <code>euint64</code> pending values and only exposes a sufficiency bit for KMS proof. Completing a
                native ETH exit still reveals the final wei sent on-chain. For better recipient unlinkability, choose{" "}
                <strong>Fast exit</strong> or <strong>Private exit</strong> (batched) in the Financial Enclave — the
                relayer submits to a one-time stealth address. Private staking unstake returns value to encrypted cETH
                without exiting Aave. Details:{" "}
                <Link to="/docs/private-withdrawals" className="text-[#00685f] font-semibold hover:underline">
                    Private withdrawals
                </Link>
                .
            </>
        ),
    },
    {
        q: "What does the MedVault relayer do?",
        a: (
            <>
                The <strong>HTTP relayer</strong> pays gas for the anonymous apply flow and optional withdrawal
                completion. Apply: <code>submitViaRelayer</code> in <code>src/lib/relayer.ts</code> →{" "}
                <code>POST /relay/apply-stage</code> then (after Zama FHE decrypt in-wallet){" "}
                <code>POST /relay/apply-finalize</code>. Withdrawals: <code>POST /relay/completion-proof</code> and{" "}
                <code>POST /relay/public-exit</code> for EIP-712 stealth exits. Host it yourself in production; set{" "}
                <code>FRONTEND_URL</code> to{" "}
                <a href={PRODUCTION_APP_URL} className="text-[#00685f] font-semibold hover:underline">
                    https://med-vault.xyz
                </a>{" "}
                for CORS. Configure <code>VITE_RELAYER_URL</code> or the Vite <code>/relay</code> proxy for local dev.
            </>
        ),
    },
    {
        q: "What is the MedVault MCP server?",
        a: (
            <>
                A <strong>local</strong> Model Context Protocol server in <code>mcp-server/</code> for developers and sponsors
                to query trials, matches, and audit data and run sponsor transactions from AI tools (Cursor, Codex, etc.). It
                is <strong>not hosted</strong> on Vercel and does not replace the browser app. Setup:{" "}
                <Link to="/docs/mcp" className="text-[#00685f] font-semibold hover:underline">
                    MCP server docs
                </Link>
                .
            </>
        ),
    },
    {
        q: "What is the ephemeral wallet?",
        a: (
            <>
                It is a deterministic address derived from your Semaphore identity secret — used as the Zama FHE{" "}
                <strong>permit recipient</strong> so decrypt-for-tx runs without tying ciphertext ACL to your main Privy EOA.
                See{" "}
                <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold">
                    Identity &amp; privacy
                </Link>
                .
            </>
        ),
    },
    {
        q: "Where are Noir / Semaphore documented?",
        a: (
            <>
                Semaphore flows live in <code>src/lib/semaphore.ts</code>; Noir attestation circuits live under{" "}
                <code>circuits/eligibility_proof</code> with frontend <code>sealResult()</code> in{" "}
                <code>useEligibilityProof.ts</code> / <code>src/lib/noir.ts</code>. Zama FHE computes; Noir seals. Overview:{" "}
                <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold">
                    Identity &amp; privacy
                </Link>
                .
            </>
        ),
    },
    {
        q: "Does MedVault use Chainlink?",
        a: (
            <>
                Yes — <strong>MedVaultAutomation</strong> implements Chainlink Automation for trial expiry finalization, and{" "}
                <strong>TrialManager</strong> can use Chainlink price feeds for compensation math. Details:{" "}
                <Link to="/docs/automation" className="text-blue-600 font-semibold">
                    Chainlink Automation
                </Link>{" "}
                and the{" "}
                <Link to="/docs/contracts" className="text-blue-600 font-semibold">
                    contract reference
                </Link>
                .
            </>
        ),
    },
];

export function FaqDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />
                <div className="not-prose space-y-6">
                    {faqs.map((item) => (
                        <div
                            key={item.q}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <h2 className="text-base font-bold text-slate-900 m-0 mb-2">{item.q}</h2>
                            <p className="text-sm text-slate-600 m-0 leading-relaxed">{item.a}</p>
                        </div>
                    ))}
                </div>
                <Callout type="tip" title="Still stuck?">
                    Read the <Link to="/docs/guides">user workflows</Link> or{" "}
                    <Link to="/docs/security-model">security model</Link> for deeper context.
                </Callout>
            </Prose>
        </motion.div>
    );
}
