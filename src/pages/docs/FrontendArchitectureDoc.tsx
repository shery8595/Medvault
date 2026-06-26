import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Layers, Settings, Shield, Zap, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { Link } from "react-router-dom";

const RULE_STYLES: Record<string, { row: string; icon: string; shield: string; title: string }> = {
    teal: {
        row: "border-teal-200 bg-teal-50/50",
        icon: "bg-teal-100",
        shield: "text-teal-600",
        title: "text-teal-800",
    },
    purple: {
        row: "border-purple-200 bg-purple-50/50",
        icon: "bg-purple-100",
        shield: "text-purple-600",
        title: "text-purple-800",
    },
    blue: {
        row: "border-blue-200 bg-blue-50/50",
        icon: "bg-blue-100",
        shield: "text-blue-600",
        title: "text-blue-800",
    },
    amber: {
        row: "border-amber-200 bg-amber-50/50",
        icon: "bg-amber-100",
        shield: "text-amber-600",
        title: "text-amber-900",
    },
    rose: {
        row: "border-rose-200 bg-rose-50/50",
        icon: "bg-rose-100",
        shield: "text-rose-600",
        title: "text-rose-800",
    },
};

const contextTreeChart = `
graph TD
    A[App.tsx / BrowserRouter] --> B[Web3Context.tsx]
    B --> C[EncryptedDataContext.tsx]
    C --> D[DashboardLayout.tsx]
    D --> E[PatientDashboard]
    D --> F[SponsorDashboard]
    D --> G[DocsLayout]
    E --> H[TrialList]
    E --> I[PatientProfile]
    F --> J[CreateTrial]
    F --> K[SponsorTrialDetails]
`;

const contexts = [
    { name: "Web3Context.tsx", responsibility: "Privy auth + embedded/link EVM wallet, Ethers.js provider, account/chain tracking, @zama-fhe/sdk initialization, isFHEReady flag.", exposes: "account, provider, signer, isFHEReady, connect(), logout()" },
    { name: "EncryptedDataContext.tsx", responsibility: "Business logic layer. Wraps all FHE-aware contract interactions (patient vault writes, trial creation, eligibility compute).", exposes: "updatePatientInfo(), createTrial(), computeEligibility(), decryptScore()" },
];

const designRules = [
    { rule: "Never Show Stale UI", desc: "When a transaction is pending, all dependent views must show explicit loading/skeleton states. No component may display data from a previous block while awaiting confirmation.", color: "teal" },
    { rule: "Layered surfaces", desc: "Light shell (#f7f9fb) with white cards, subtle borders, and calibrated shadows—consistent with the public marketing and dashboard UIs.", color: "purple" },
    { rule: "Readable Typography", desc: "max-w-prose limits all text columns to 65-75 characters per line — the optimal reading width for reducing ocular fatigue on large monitors.", color: "blue" },
    { rule: "State-Locked Buttons", desc: "Any button triggering an async operation must be disabled with an isLoading spinner immediately upon click, and only re-enabled in the finally block.", color: "amber" },
    { rule: "Spring Animations", desc: "Framer Motion AnimatePresence wraps all conditional renders and route transitions. Status text updates fade/slide in smoothly to signal async progress.", color: "rose" },
];

export function FrontendArchitectureDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                {/* Tech Stack Row */}
                <div className="flex flex-wrap gap-3 my-8 not-prose">
                    {["Vite 6", "React 19", "TypeScript 5", "Tailwind CSS 4", "Privy", "Capacitor", "Framer Motion", "Ethers.js 6", "@zama-fhe/sdk", "React Router 7", "The Graph"].map(t => (
                        <span key={t} className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-700 shadow-sm">
                            {t}
                        </span>
                    ))}
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>I. Privy &amp; Web3</h2>
                <p>
                    The root <code>PrivyProvider</code> in <code>App.tsx</code> (with <code>VITE_PRIVY_APP_ID</code>)
                    must wrap the tree before <code>Web3Provider</code>. Users authenticate with Privy; the embedded
                    wallet is then switched to <strong>Ethereum Sepolia</strong> inside <code>Web3Context.tsx</code> for
                    For Semaphore, ephemeral decrypt wallet, HTTP relayer (<code>/relay/apply-stage</code> / finalize),
                    private faucet, Noir/Honk, and Chainlink Automation pointers, see the{" "}
                    <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold no-underline hover:underline">
                        identity, relayer &amp; testnet
                    </Link>{" "}
                    and{" "}
                    <Link to="/docs/automation" className="text-blue-600 font-semibold no-underline hover:underline">
                        Chainlink Automation
                    </Link>{" "}
                    docs.
                </p>

                <h2>II. Provider / context hierarchy</h2>
                <p>
                    Rather than a monolithic state store (like Redux), MedVault uses a <strong>layered React Context</strong> architecture. Each context layer has a specific responsibility, and lower layers can safely assume the upper layers are already initialized.
                </p>

                <div className="not-prose bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 m-0">React component / provider stack</h3>
                    <div className="text-slate-600 text-sm space-y-2">
                        <p className="font-mono text-indigo-700">1. PrivyProvider + Web3Provider</p>
                        <p className="font-mono pl-4 text-emerald-700">2. Data / FHE business context as needed</p>
                        <p className="font-mono pl-8 text-sky-700">3. Encrypted data + trial flows</p>
                        <p className="font-mono pl-12 text-violet-700">4. Router + dashboard layouts</p>
                    </div>
                </div>

                <div className="not-prose my-8 space-y-4">
                    {contexts.map(ctx => (
                        <div key={ctx.name} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-blue-100 rounded-xl">
                                    <Settings className="w-4 h-4 text-blue-600" />
                                </div>
                                <code className="font-bold text-slate-900">{ctx.name}</code>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">{ctx.responsibility}</p>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-widest">Exposes:</div>
                                <code className="text-xs text-blue-600">{ctx.exposes}</code>
                            </div>
                        </div>
                    ))}
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>III. FHE-Aware transaction lifecycle</h2>
                <p>
                    FHE transactions take significantly longer to confirm than standard EVM operations due to background polynomial computation in the Zama FHE coprocessor. Every user-facing transaction must move through a well-defined stage machine to prevent UI freeze perception.
                </p>

                <div className="not-prose flex flex-col sm:flex-row items-stretch gap-3 my-10">
                    {[
                        { step: "1", label: "User Triggers", desc: "Button clicked, UI immediately locked via isLoading state.", color: "slate", icon: <Zap className="w-4 h-4" /> },
                        { step: "2", label: "Local Encrypt", desc: "@zama-fhe/sdk generates ciphertexts + ZK proofs in the browser.", color: "teal", icon: <Shield className="w-4 h-4" /> },
                        { step: "3", label: "Wallet Sign", desc: "MetaMask popup shown. Script execution halts awaiting approval.", color: "purple", icon: <Shield className="w-4 h-4" /> },
                        { step: "4", label: "FHE Processing", desc: "Transaction submitted. Zama FHE coprocessor runs FHE (15–60s).", color: "amber", icon: <Loader2 className="w-4 h-4" /> },
                        { step: "5", label: "Confirmed", desc: "Receipt received. Toast shown. Subgraph refetch triggered.", color: "emerald", icon: <Layers className="w-4 h-4" /> },
                    ].map((s, i) => (
                        <div key={s.step} className="flex-1 relative">
                            <div className={`p-4 rounded-2xl border border-${s.color}-200 bg-${s.color}-50 h-full`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`text-xs font-bold text-${s.color}-600 font-mono`}>Step {s.step}</div>
                                </div>
                                <div className={`font-bold text-slate-900 text-sm mb-1`}>{s.label}</div>
                                <div className="text-xs text-slate-500">{s.desc}</div>
                            </div>
                            {i < 4 && <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 hidden sm:block text-slate-300 z-10">▶</div>}
                        </div>
                    ))}
                </div>

                <CodeBlock
                    filename="Pattern: handleApply() in Patient Dashboard"
                    language="typescript"
                    code={`const handleApply = async () => {
    try {
        setIsApplying(true);
        setTxStatus("Encrypting parameters locally...");

        // Step 2: Local encryption (browser-only, never touches network)
        const encData = await encryptApplicationData();

        setTxStatus("Awaiting wallet signature...");
        // Step 3: This call BLOCKS until user approves/rejects in MetaMask
        const tx = await contract.applyForTrial(trialId, encData.handles, encData.inputProof);

        setTxStatus("FHE matching in progress (~15-30s)...");
        // Step 4: await .wait() blocks until the block is mined
        await tx.wait();

        toast.success("Application submitted successfully!");
        // Step 5: Force The Graph to re-poll for updated eligibility state
        await refetchTrials();
    } catch (err) {
        toast.error("Transaction failed or rejected.");
    } finally {
        // Always release locks in finally — even if thrown
        setIsApplying(false);
        setTxStatus("");
    }
};`}
                />

                <hr className="my-12 border-slate-200" />

                <h2>IV. Mobile shell (Capacitor Android)</h2>
                <p>
                    The same Vite bundle can ship as an Android APK. Capacitor wraps the SPA in a WebView; mobile-specific
                    code lives in <code>src/lib/mobile.ts</code> and <code>src/components/mobile/</code>.
                </p>
                <ul>
                    <li>
                        <strong>Build:</strong> <code>CAPACITOR_BUILD=true</code> sets Vite <code>base: &apos;./&apos;</code>;
                        assets sync to <code>android/app/src/main/assets/</code>
                    </li>
                    <li>
                        <strong>Origin:</strong> <code>https://localhost</code> — Privy and relayer CORS must allow it
                    </li>
                    <li>
                        <strong>APIs:</strong> Zama and MedVault relayers use direct HTTPS (no Vite/Vercel proxy)
                    </li>
                    <li>
                        <strong>UX:</strong> native launch skips marketing landing; Android back button; offline banner
                    </li>
                </ul>
                <p>
                    Full build guide:{" "}
                    <Link to="/docs/mobile/android-apk" className="text-[#00685f] font-semibold no-underline hover:underline">
                        Android APK runbook
                    </Link>
                    ; repo <code>docs/MOBILE_ARCHITECTURE.md</code>.
                </p>

                <hr className="my-12 border-slate-200" />

                <h2>V. Visual design rules</h2>
                <p>
                    The MedVault frontend strictly adheres to a premium UI/UX ruleset (<code>ui-ux-pro-max</code> guidelines). These rules ensure the interface feels trustworthy, enterprise-grade, and consistent across all components.
                </p>

                <div className="not-prose space-y-4 my-8">
                    {designRules.map((r) => {
                        const st = RULE_STYLES[r.color] ?? RULE_STYLES.teal;
                        return (
                            <div key={r.rule} className={cn("p-5 rounded-2xl border flex gap-4 items-start", st.row)}>
                                <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", st.icon)}>
                                    <Shield className={cn("w-4 h-4", st.shield)} />
                                </div>
                                <div>
                                    <div className={cn("font-bold text-sm mb-1", st.title)}>{r.rule}</div>
                                    <div className="text-sm text-slate-600">{r.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Callout type="tip" title="Route-Level Code Splitting">
                    All documentation pages and non-critical dashboard routes are wrapped in React's <code>Suspense</code> with <code>lazy()</code> for code-splitting. This ensures the initial JavaScript bundle is as small as possible — critical for users on slower connections attempting to download the FHE WASM modules.
                </Callout>

            </Prose>
        </motion.div>
    );
}
