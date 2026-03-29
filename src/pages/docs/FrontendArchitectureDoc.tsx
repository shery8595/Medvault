import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Layers, Settings, Shield, Zap, Loader2 } from "lucide-react";

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
    { name: "Web3Context.tsx", responsibility: "MetaMask connection, Ethers.js provider, account/chain tracking, fhevmjs initialization, isFHEReady flag.", exposes: "account, provider, signer, fhevmInstance, isFHEReady, connectWallet()" },
    { name: "EncryptedDataContext.tsx", responsibility: "Business logic layer. Wraps all FHE-aware contract interactions (patient vault writes, trial creation, eligibility compute).", exposes: "updatePatientInfo(), createTrial(), computeEligibility(), decryptScore()" },
];

const designRules = [
    { rule: "Never Show Stale UI", desc: "When a transaction is pending, all dependent views must show explicit loading/skeleton states. No component may display data from a previous block while awaiting confirmation.", color: "teal" },
    { rule: "Glassmorphism Depth", desc: "Dark backgrounds (bg-[#020810]) with backdrop-blur-xl and bg-white/5 layers create floating panel depth without relying on opaque borders.", color: "purple" },
    { rule: "Readable Typography", desc: "max-w-prose limits all text columns to 65-75 characters per line — the optimal reading width for reducing ocular fatigue on large monitors.", color: "blue" },
    { rule: "State-Locked Buttons", desc: "Any button triggering an async operation must be disabled with an isLoading spinner immediately upon click, and only re-enabled in the finally block.", color: "amber" },
    { rule: "Spring Animations", desc: "Framer Motion AnimatePresence wraps all conditional renders and route transitions. Status text updates fade/slide in smoothly to signal async progress.", color: "rose" },
];

export function FrontendArchitectureDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-blue-500 font-bold tracking-widest uppercase text-xs">Integration</span>
                <h1 className="mt-2 text-5xl">Frontend React Architecture</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    The MedVault SPA is built using Vite + React 18, using a carefully layered context architecture to manage the complex, asynchronous interplay between MetaMask, the Fhenix fhEVM coprocessor, and the live GraphQL Subgraph simultaneously.
                </p>

                {/* Tech Stack Row */}
                <div className="flex flex-wrap gap-3 my-8 not-prose">
                    {["Vite 6", "React 18", "TypeScript 5", "Tailwind CSS 4", "Framer Motion", "Ethers.js 6", "fhevmjs", "React Router 7", "The Graph"].map(t => (
                        <span key={t} className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm">
                            {t}
                        </span>
                    ))}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>I. Provider / Context Hierarchy</h2>
                <p>
                    Rather than a monolithic state store (like Redux), MedVault uses a <strong>layered React Context</strong> architecture. Each context layer has a specific responsibility, and lower layers can safely assume the upper layers are already initialized.
                </p>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">React Component Context Tree</h3>
                    <div className="text-slate-300 space-y-2">
                        <p className="font-mono text-indigo-400">1. Web3Provider (WAGMI/RainbowKit)</p>
                        <p className="font-mono pl-4 text-emerald-400">2. ApolloProvider (GraphQL Subgraph)</p>
                        <p className="font-mono pl-8 text-sky-400">3. AuthProvider (Role & Session Management)</p>
                        <p className="font-mono pl-12 text-violet-400">4. FhevmProvider (Fhenix FHE Instance & Keys)</p>
                        <p className="font-mono pl-16 text-rose-400">5. NotificationProvider (Toast Alerts)</p>
                        <p className="font-mono pl-20 text-slate-300">6. React Router & Pages</p>
                    </div>
                </div>

                <div className="not-prose my-8 space-y-4">
                    {contexts.map(ctx => (
                        <div key={ctx.name} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <code className="font-bold text-slate-900 dark:text-white">{ctx.name}</code>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{ctx.responsibility}</p>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                                <div className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-widest">Exposes:</div>
                                <code className="text-xs text-blue-600 dark:text-blue-400">{ctx.exposes}</code>
                            </div>
                        </div>
                    ))}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>II. FHE-Aware Transaction Lifecycle</h2>
                <p>
                    FHE transactions take significantly longer to confirm than standard EVM operations due to background polynomial computation in the Fhenix coprocessor. Every user-facing transaction must move through a well-defined stage machine to prevent UI freeze perception.
                </p>

                <div className="not-prose flex flex-col sm:flex-row items-stretch gap-3 my-10">
                    {[
                        { step: "1", label: "User Triggers", desc: "Button clicked, UI immediately locked via isLoading state.", color: "slate", icon: <Zap className="w-4 h-4" /> },
                        { step: "2", label: "Local Encrypt", desc: "fhevmjs generates ciphertexts + ZK proofs in the browser.", color: "teal", icon: <Shield className="w-4 h-4" /> },
                        { step: "3", label: "Wallet Sign", desc: "MetaMask popup shown. Script execution halts awaiting approval.", color: "purple", icon: <Shield className="w-4 h-4" /> },
                        { step: "4", label: "FHE Processing", desc: "Transaction submitted. Fhenix coprocessor runs FHE (15–60s).", color: "amber", icon: <Loader2 className="w-4 h-4" /> },
                        { step: "5", label: "Confirmed", desc: "Receipt received. Toast shown. Subgraph refetch triggered.", color: "emerald", icon: <Layers className="w-4 h-4" /> },
                    ].map((s, i) => (
                        <div key={s.step} className="flex-1 relative">
                            <div className={`p-4 rounded-2xl border border-${s.color}-200 dark:border-${s.color}-900/40 bg-${s.color}-50 dark:bg-${s.color}-950/10 h-full`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`text-xs font-bold text-${s.color}-600 dark:text-${s.color}-400 font-mono`}>Step {s.step}</div>
                                </div>
                                <div className={`font-bold text-slate-900 dark:text-white text-sm mb-1`}>{s.label}</div>
                                <div className="text-xs text-slate-500">{s.desc}</div>
                            </div>
                            {i < 4 && <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 hidden sm:block text-slate-300 dark:text-slate-700 z-10">▶</div>}
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

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>III. Visual Design Rules</h2>
                <p>
                    The MedVault frontend strictly adheres to a premium UI/UX ruleset (<code>ui-ux-pro-max</code> guidelines). These rules ensure the interface feels trustworthy, enterprise-grade, and consistent across all components.
                </p>

                <div className="not-prose space-y-4 my-8">
                    {designRules.map(r => (
                        <div key={r.rule} className={`p-5 rounded-2xl border border-${r.color}-200 dark:border-${r.color}-900/40 bg-${r.color}-50/50 dark:bg-${r.color}-950/10 flex gap-4 items-start`}>
                            <div className={`p-2 rounded-xl bg-${r.color}-100 dark:bg-${r.color}-900/30 shrink-0 mt-0.5`}>
                                <Shield className={`w-4 h-4 text-${r.color}-600 dark:text-${r.color}-400`} />
                            </div>
                            <div>
                                <div className={`font-bold text-${r.color}-700 dark:text-${r.color}-400 text-sm mb-1`}>{r.rule}</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">{r.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <Callout type="tip" title="Route-Level Code Splitting">
                    All documentation pages and non-critical dashboard routes are wrapped in React's <code>Suspense</code> with <code>lazy()</code> for code-splitting. This ensures the initial JavaScript bundle is as small as possible — critical for users on slower connections attempting to download the FHE WASM modules.
                </Callout>

            </Prose>
        </motion.div>
    );
}
