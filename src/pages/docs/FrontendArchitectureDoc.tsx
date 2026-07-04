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

import { REPO_STATS } from "../../lib/docsStats";

const providerStack = [
    { level: 1, label: "PrivyProvider", detail: "Root auth + embedded Ethereum Sepolia wallet (App.tsx)" },
    { level: 2, label: "Web3Provider", detail: "src/lib/Web3Context.tsx — Ethers provider/signer, chain enforcement" },
    { level: 3, label: "ZamaSDKProvider", detail: "src/lib/ZamaSDKProvider.tsx — QueryClientProvider + @zama-fhe/react-sdk" },
    { level: 4, label: "EncryptedDataProvider", detail: "src/lib/EncryptedDataContext.tsx — revealed-score cache" },
    { level: 5, label: "BrowserRouter + MobileAppShell", detail: "Routes declared inline in App.tsx (~58 Route elements)" },
];

const contexts = [
    {
        name: "Web3Context.tsx",
        path: "src/lib/Web3Context.tsx",
        responsibility:
            "Privy auth + embedded/link EVM wallet, Ethers.js provider and signer, Sepolia chain enforcement, isFHEReady flag.",
        exposes: "account, provider, signer, readOnlyProvider, ethereum, chainId, isFHEReady, connect(), logout()",
    },
    {
        name: "ZamaSDKProvider.tsx",
        path: "src/lib/ZamaSDKProvider.tsx",
        responsibility:
            "Wires @zama-fhe/react-sdk when wallet is connected; hosts TanStack QueryClient for subgraph and indexer hooks.",
        exposes: "useZamaSDK() (via @zama-fhe/react-sdk), QueryClient scope for useQuery hooks",
    },
    {
        name: "EncryptedDataContext.tsx",
        path: "src/lib/EncryptedDataContext.tsx",
        responsibility:
            "Lightweight in-memory cache of sponsor-decrypted eligibility scores (revealedScores map). Contract calls live in hooks and page components.",
        exposes: "revealedScores, setRevealedScore(), getRevealedScore()",
    },
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
                    wraps <code>Web3Provider</code> before any routed UI. Users authenticate with Privy; the embedded
                    wallet is switched to <strong>Ethereum Sepolia</strong> inside <code>Web3Context.tsx</code>.
                    For Semaphore, ephemeral decrypt wallet, HTTP relayer (<code>/relay/apply-stage</code> / finalize),
                    private faucet, Noir/Honk, and Chainlink CRE pointers, see the{" "}
                    <Link to="/docs/identity-privacy" className="text-blue-600 font-semibold no-underline hover:underline">
                        identity, relayer &amp; testnet
                    </Link>{" "}
                    and{" "}
                    <Link to="/docs/automation" className="text-blue-600 font-semibold no-underline hover:underline">
                        Chainlink CRE
                    </Link>{" "}
                    docs.
                </p>

                <h2>II. Provider / context hierarchy</h2>
                <p>
                    There is <strong>no</strong> <code>src/contexts/</code> directory — all React contexts live under{" "}
                    <code>src/lib/</code>. Routing is also inline in <code>App.tsx</code> (no <code>src/routes/</code>{" "}
                    module). MedVault uses three context providers plus page-local state instead of a global Redux store.
                </p>

                <div className="not-prose bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 m-0">React provider stack (outer → inner)</h3>
                    <div className="text-slate-600 text-sm space-y-2">
                        {providerStack.map((row) => (
                            <p key={row.label} className="m-0" style={{ paddingLeft: `${(row.level - 1) * 1}rem` }}>
                                <span className="font-mono text-indigo-700">{row.level}. {row.label}</span>
                                <span className="text-slate-500"> — {row.detail}</span>
                            </p>
                        ))}
                    </div>
                </div>

                <div className="not-prose my-8 space-y-4">
                    {contexts.map((ctx) => (
                        <div key={ctx.name} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-blue-100 rounded-xl">
                                    <Settings className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <code className="font-bold text-slate-900">{ctx.name}</code>
                                    <div className="text-xs text-slate-400 font-mono">{ctx.path}</div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">{ctx.responsibility}</p>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-widest">Exposes:</div>
                                <code className="text-xs text-blue-600">{ctx.exposes}</code>
                            </div>
                        </div>
                    ))}
                </div>

                <h3>Routing</h3>
                <p>
                    All routes are declared inline in <code>src/App.tsx</code> (no <code>src/routes/</code> module) using
                    React Router 7 nested layouts. There is <strong>no</strong> <code>src/contexts/</code> directory — all
                    React contexts live under <code>src/lib/</code>.
                </p>
                <p>
                    <strong>58 routable paths</strong> (5 public + 9 patient + 9 sponsor + 2 admin + 32 docs + 1 global
                    redirect). Nested layout shells and legacy alias redirects are additional <code>&lt;Route&gt;</code>{" "}
                    elements in the same file (70 total <code>&lt;Route&gt;</code> declarations).
                </p>

                <h4>Public (5)</h4>
                <div className="not-prose overflow-x-auto mb-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-3 font-semibold">Path</th>
                                <th className="p-3 font-semibold">Page</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[
                                ["/", "LandingPage (+ MobileLaunchRedirect on native)"],
                                ["/how-it-works", "HowItWorksPage"],
                                ["/technology", "TechnologyPage"],
                                ["/security", "SecurityPage"],
                                ["/privacy", "PrivacyPage"],
                            ].map(([path, page]) => (
                                <tr key={path}>
                                    <td className="p-3 font-mono text-xs text-indigo-700">{path}</td>
                                    <td className="p-3 text-slate-600">{page}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h4>Patient (9 pages + aliases)</h4>
                <p>
                    Shell: <code>DashboardLayout role=&quot;patient&quot;</code> via <code>PatientShell</code>. Index{" "}
                    <code>/patient</code> → <code>/patient/dashboard</code>.
                </p>
                <div className="not-prose overflow-x-auto mb-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-3 font-semibold">Path</th>
                                <th className="p-3 font-semibold">Page</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[
                                ["/patient/dashboard", "PatientDashboard"],
                                ["/patient/medical-vault", "PatientVaultPage"],
                                ["/patient/find-trials", "PatientTrialsPage"],
                                ["/patient/consent-logs", "ConsentLogPage"],
                                ["/patient/applications", "PatientAppliedTrialsPage"],
                                ["/patient/results", "PatientResultsPage"],
                                ["/patient/identity", "PatientIdentityPage"],
                                ["/patient/privacy-tour", "PatientPrivacyTourPage"],
                                ["/patient/settings", "PatientSettingsPage"],
                            ].map(([path, page]) => (
                                <tr key={path}>
                                    <td className="p-3 font-mono text-xs text-indigo-700">{path}</td>
                                    <td className="p-3 text-slate-600">{page}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-slate-600">
                    Legacy aliases (all <code>&lt;Navigate replace /&gt;</code>):{" "}
                    <code>/patient/vault</code> → medical-vault, <code>/patient/trials</code> → find-trials,{" "}
                    <code>/patient/applied</code> → applications, <code>/patient/consent</code> → consent-logs.
                </p>

                <h4>Sponsor (9 pages + aliases)</h4>
                <p>
                    Shell: <code>SponsorGuard</code> → <code>DashboardLayout role=&quot;sponsor&quot;</code>. Index{" "}
                    <code>/sponsor</code> → <code>/sponsor/dashboard</code>.
                </p>
                <div className="not-prose overflow-x-auto mb-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-3 font-semibold">Path</th>
                                <th className="p-3 font-semibold">Page</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[
                                ["/sponsor/dashboard", "SponsorDashboard"],
                                ["/sponsor/active-trials", "SponsorTrialsPage"],
                                ["/sponsor/patient-matches", "SponsorMatchesPage"],
                                ["/sponsor/analytics", "SponsorAnalyticsPage"],
                                ["/sponsor/audit-logs", "SponsorAuditLogPage"],
                                ["/sponsor/profile-settings", "SponsorSettingsPage"],
                                ["/sponsor/verification", "SponsorVerificationPage"],
                                ["/sponsor/trials/create", "SponsorCreateTrialPage"],
                                ["/sponsor/trials/:id", "SponsorTrialDetailsPage"],
                            ].map(([path, page]) => (
                                <tr key={path}>
                                    <td className="p-3 font-mono text-xs text-indigo-700">{path}</td>
                                    <td className="p-3 text-slate-600">{page}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-slate-600">
                    Legacy aliases: <code>/sponsor/trials</code> → active-trials, <code>/sponsor/matches</code> →
                    patient-matches, <code>/sponsor/audit</code> → audit-logs, <code>/sponsor/settings</code> →
                    profile-settings.
                </p>

                <h4>Admin (2) — no SponsorGuard</h4>
                <p>
                    Both use <code>DashboardLayout role=&quot;sponsor&quot;</code> but are <strong>outside</strong>{" "}
                    <code>SponsorGuard</code> so unverified wallets can reach the public sponsor application form.
                </p>
                <div className="not-prose overflow-x-auto mb-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl">
                        <tbody className="divide-y divide-slate-100 text-sm">
                            <tr>
                                <td className="p-3 font-mono text-xs text-indigo-700">/admin/sponsors</td>
                                <td className="p-3 text-slate-600">AdminSponsorsPage — public application form + owner ops</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs text-indigo-700">/admin/wiring</td>
                                <td className="p-3 text-slate-600">AdminWiringPage — timelock schedule/apply (owner writes only)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h4>Documentation ({REPO_STATS.inAppDocPages} routes)</h4>
                <p>
                    All wrapped in <code>DocsLayout</code>. Index <code>/docs</code> → IntroductionDoc; see{" "}
                    <code>src/lib/docsNav.ts</code> for sidebar order.
                </p>
                <div className="not-prose text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 columns-2 gap-x-6">
                    {[
                        "/docs",
                        "/docs/architecture",
                        "/docs/fhe-primitives",
                        "/docs/engine",
                        "/docs/contracts",
                        "/docs/sponsor-system",
                        "/docs/automation",
                        "/docs/client-encryption",
                        "/docs/subgraph",
                        "/docs/frontend",
                        "/docs/guides",
                        "/docs/staking",
                        "/docs/private-withdrawals",
                        "/docs/deployment",
                        "/docs/timelock-wiring",
                        "/docs/mobile/android-apk",
                        "/docs/mcp",
                        "/docs/mcp/sdk",
                        "/docs/mcp/setup",
                        "/docs/mcp/tools",
                        "/docs/testing",
                        "/docs/testing/matrix",
                        "/docs/testing/infrastructure",
                        "/docs/testing/ci",
                        "/docs/security-model",
                        "/docs/compliance",
                        "/docs/faq",
                        "/docs/changelog",
                        "/docs/identity-privacy",
                        "/docs/zama-fhe",
                        "/docs/semaphore",
                        "/docs/noir",
                    ].map((p) => (
                        <div key={p} className="py-0.5">
                            {p}
                        </div>
                    ))}
                </div>
                <p className="text-sm text-slate-600">
                    Global legacy redirect: <code>/consent</code> → <code>/patient/consent-logs</code>.
                </p>

                <h3>State model</h3>
                <ul>
                    <li>
                        <strong>Page-local</strong> <code>useState</code> for forms, transaction status, and UI toggles
                    </li>
                    <li>
                        <strong>Three contexts</strong> (Web3, ZamaSDK, EncryptedData) for wallet, FHE SDK, and decrypted-score cache
                    </li>
                    <li>
                        <strong>TanStack Query</strong> — <code>QueryClient</code> created inside <code>ZamaSDKProvider</code>;
                        hooks such as <code>useSubgraph</code>, <code>useAuditLogs</code>, and <code>useEncryptedTrialAggregates</code>{" "}
                        scope cache/refetch
                    </li>
                    <li>
                        <strong>localStorage</strong> — Semaphore identity (<code>medvault_identity</code>), anonymous nullifiers,
                        pending hybrid document uploads (<code>pendingHybridDocument.ts</code>), sidebar collapse, sponsor applications
                    </li>
                </ul>

                <h3>Hooks catalog ({REPO_STATS.hooks})</h3>
                <p>
                    All hooks live in <code>src/hooks/</code>. They bind to contracts via <code>getContract</code> /{" "}
                    <code>src/lib/contracts</code>, subgraph via <code>useSubgraph</code>, FHE via <code>src/lib/fhe</code>
                    , or HTTP via <code>src/lib/relayer.ts</code> / <code>aiServiceClient.ts</code>.
                </p>
                <div className="not-prose overflow-x-auto mb-8">
                    <table className="w-full text-xs border border-slate-200 rounded-xl">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="p-2 font-semibold">Hook</th>
                                <th className="p-2 font-semibold">Bindings</th>
                                <th className="p-2 font-semibold">Returns</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                            {[
                                ["useAaveYield", "Aave subgraph / fallback APY", "{ apy, loading, error, source, lastUpdatedMs }"],
                                ["useAiLogSummary", "ai-service POST /audit-summary", "{ summary, loading, error, configured, refresh }"],
                                ["useAnonymousCertification", "EligibilityEngine.noirVerifiedResults", "{ certified, eligible, fheCommitted, loading }"],
                                ["useAnonymousEligibility", "Zama decrypt + EligibilityEngine", "{ decryptResult, decryptScore, getApplicationStatus, results, scores, decrypting, error }"],
                                ["useAnonymousRegistration", "Semaphore + MedVaultRegistry + relayer", "registration + application workflow (checkRegistration, submitApplication, applyToTrial, …)"],
                                ["useAuditLogs", "Subgraph auditLogs + DataAccessLog on-chain", "{ logs, loading, error, refetch, trialCount, totalLogCount, bufferedLogCount }"],
                                ["useConfidentialBalance", "ConfidentialETH + withdrawFlow + relayer", "{ balanceEth, walletBalanceEth, rewardBalanceEth, isRevealed, loading, error, revealBalance, hideBalance, withdraw, … }"],
                                ["useConsent", "Subgraph consents + applications", "{ consents, applications, patientConsentEpoch, loading, error, refetch }"],
                                ["useEligibility", "Subgraph eligibilityResults + Zama decrypt", "{ matches, decryptResult, decryptedResults, decrypting, loading, error, refetch }"],
                                ["useEligibilityProof", "EligibilityEngine (read-only seal status)", "{ status, error, sealResult, isNullifierSealed, reset }"],
                                ["useEncryptedTrialAggregates", "EncryptedScoreLeaderboard + Zama decrypt", "{ aggregates, loading, decryptError, decryptAggregates }"],
                                ["useMatchHasDocument", "PatientDocumentStore.documentExists", "{ hasDocument, loading, revoked }"],
                                ["useMatches", "Subgraph applications + eligibility", "{ matches, loading, error, refetch }"],
                                ["useNativeEthBalance", "ethers provider getBalance", "{ balanceWei, loading, refresh }"],
                                ["usePatientDashboard", "Subgraph patient events", "{ loading, error, refetch, activitySeries, hasActivity, statusDistribution, funnelData, recentEvents }"],
                                ["usePatientProfile", "Subgraph patient + on-chain registry", "{ profile, hasProfile, hasProfileFromGraph, onChainRegistered, loading, error, refetch }"],
                                ["useSponsorApplicationActions", "TrialManager / EligibilityEngine status updates (anonymous accept does not vault-register — MED-3)", "{ updatingId, error, updateApplicationStatus, updateAnonymousApplicationStatus }"],
                                ["useSponsorDashboard", "Subgraph sponsor trials + applications", "{ stats, trials, recentActivity, loading, error, refetch }"],
                                ["useSponsorDocumentDecrypt", "PatientDocumentStore + FHE unwrap + IPFS", "{ loading, error, revoked, plaintext, filename, decrypt }"],
                                ["useSponsorPortfolioMetrics", "useTrials + useSponsorDashboard", "{ metrics, charts, biasIndicators, recentActivity, loading, error, formatEthCompact }"],
                                ["useSponsorProfile", "SponsorRegistry.sponsors", "{ currentName, loadingCurrentName, isSaving, success, error, refreshCurrentName, updateSponsorName }"],
                                ["useSponsorTrialCreation", "TrialManager + SponsorIncentiveVault + milestones", "{ status, isSubmitting, setStatus, submitTrial }"],
                                ["useSponsorVerification", "SponsorRegistry + VITE_SPONSOR_OPEN_ACCESS", "{ isVerified, isAdmin, isLoading, sponsorName, error }"],
                                ["useStaking", "StakingManager + Zama FHE", "{ stakedBalanceEth, isRevealed, loading, error, revealBalance, hideBalance, unstake, privateUnstake, … }"],
                                ["useSubgraph", "The Graph + optional indexer fallback", "{ data, loading, error, refetch }"],
                                ["useTimelockWiring", "8 protocol contracts (timelock readers)", "{ rows, loading, error, actionStatus, refresh, schedule, apply, cancel, formatEtaCountdown }"],
                                ["useTrials", "Subgraph trials + on-chain enrichment", "{ trials, loading, refreshing, error, refetch }"],
                            ].map(([hook, bindings, returns]) => (
                                <tr key={hook}>
                                    <td className="p-2 font-mono text-indigo-700 align-top">{hook}</td>
                                    <td className="p-2 align-top">{bindings}</td>
                                    <td className="p-2 font-mono text-[10px] align-top">{returns}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-slate-600">
                    <code>useAnonymousRegistration.ts</code> also exports <code>useAnonymousApplication</code> and{" "}
                    <code>useAnonymousTrialWorkflow</code>; <code>useAnonymousEligibility.ts</code> exports{" "}
                    <code>useSponsorAnonymousView</code>; <code>useAnonymousCertification.ts</code> exports deprecated{" "}
                    <code>useIsNullifierCertified</code>.
                </p>

                <h3>High-value UI workflows</h3>
                <p>
                    These flows are implemented in components and <code>src/lib/</code> modules but were previously
                    under-documented. See also{" "}
                    <Link to="/docs/guides" className="text-[#00685f] font-semibold hover:underline">
                        User guide
                    </Link>{" "}
                    and{" "}
                    <Link to="/docs/sponsor-system" className="text-[#00685f] font-semibold hover:underline">
                        Sponsor system
                    </Link>
                    .
                </p>
                <ol className="space-y-4 text-sm">
                    <li>
                        <strong>Hybrid document upload</strong> — <code>HybridDocumentUploader</code> →{" "}
                        <code>prepareHybridDocumentUpload</code> in <code>patientDocumentUpload.ts</code> (AES-256-GCM
                        encrypt → IPFS pin → <code>pendingHybridDocument</code> in localStorage). After anonymous apply
                        stage: <code>recordHybridDocumentOnChain</code> FHE-wraps the AES key in 4 chunks →{" "}
                        <code>PatientDocumentStore.recordDocumentCid</code> → Noir document binding in eligibility
                        proof.
                    </li>
                    <li>
                        <strong>Sponsor document decrypt</strong> — <code>SponsorDocumentPanel</code> on accepted anonymous
                        matches → <code>useMatchHasDocument</code> → <code>useSponsorDocumentDecrypt</code> →{" "}
                        <code>fetchAndDecryptSponsorDocument</code>: <code>pullSponsorKeyAccess</code> on first view, then{" "}
                        <code>getKeyForSponsor</code>, Zama FHE unwrap, IPFS fetch, local AES decrypt.
                    </li>
                    <li>
                        <strong>Anonymous apply finalize</strong> — relayer stage → browser FHE decrypt of staged
                        eligibility → <code>generateEligibilityProof</code> (Noir UltraHonk + optional document binding) →{" "}
                        <code>finalizeAnonymousApplyWithProof</code>. <code>AnonymousApplyWizard</code> surfaces these phases.
                    </li>
                    <li>
                        <strong>Blind ranking</strong> — <code>BlindRankingPanel</code> reads{" "}
                        <code>EncryptedScoreLeaderboard.getApplicantCount</code> on-chain (no individual scores). Shows
                        pool size and comparison-ready state when count ≥ 2; pairs with{" "}
                        <code>useEncryptedTrialAggregates</code> for sponsor-decrypted averages.
                    </li>
                    <li>
                        <strong>Admin wiring page</strong> — <code>/admin/wiring</code> has no <code>SponsorGuard</code>;
                        any wallet can view timelock rows. <code>useTimelockWiring</code> schedule/apply/cancel writes
                        require contract <code>owner()</code> === connected account.
                    </li>
                    <li>
                        <strong>Admin sponsors page</strong> — <code>/admin/sponsors</code> is public: anyone can submit an
                        off-chain application (encrypted to subgraph). Protocol owner can{" "}
                        <code>addSponsor</code> / <code>removeSponsor</code> and review pending requests. Vault owner
                        (may differ from registry owner) uses <strong>Abandoned pool recovery (P2)</strong>: trial ID →
                        <code>reclaimAbandonedToOwnerPool</code> → <code>claimReclaimedPool</code>.
                    </li>
                    <li>
                        <strong>AI-assisted trial creation</strong> — <code>SponsorCreateTrialPage</code> uploads protocol
                        PDF → <code>extractCriteriaFromProtocolPdf</code> via <code>aiServiceClient</code> (proxied{" "}
                        <code>/ai-service</code> in dev) → pre-fills <code>CriteriaBuilder</code> →{" "}
                        <code>useSponsorTrialCreation.submitTrial</code>.
                    </li>
                    <li>
                        <strong>Indexer health banner</strong> — <code>IndexerHealthBanner</code> on{" "}
                        <code>PatientDashboard</code> compares subgraph <code>_meta.block.number</code> to{" "}
                        <code>eth_blockNumber</code>; warns when lag exceeds threshold.
                    </li>
                    <li>
                        <strong>Reclaim attestations</strong> — <code>ReclaimUploadPreflight</code> +{" "}
                        <code>src/lib/reclaim.ts</code> for OAuth-style off-chain proofs bridged to on-chain verifiers.
                    </li>
                    <li>
                        <strong>FHIR import</strong> — <code>PatientVaultPage</code> imports FHIR R4 JSON via{" "}
                        <code>fhirImport.ts</code> → prefill <code>PatientRecordForm</code> (manual review before FHE
                        encrypt).
                    </li>
                    <li>
                        <strong>Sponsor open-access flag</strong> — <code>VITE_SPONSOR_OPEN_ACCESS</code> (default{" "}
                        <code>true</code>): when not <code>false</code>, <code>useSponsorVerification</code> treats all
                        wallets as verified for trial creation. Set to <code>false</code> for production allowlist
                        enforcement via <code>SponsorRegistry</code>.
                    </li>
                </ol>
                <p className="text-sm text-slate-600">
                    Identity flows (Semaphore, relayer, Reclaim detail):{" "}
                    <Link to="/docs/identity-privacy" className="text-[#00685f] font-semibold hover:underline">
                        Identity &amp; privacy
                    </Link>
                    .
                </p>

                <hr className="my-12 border-slate-200" />

                <h2>III. Vite build configuration</h2>
                <p>
                    <code>vite.config.ts</code> targets React 19 + crypto-heavy WASM bundles. Key settings:
                </p>
                <ul>
                    <li>
                        <strong>Capacitor:</strong> <code>CAPACITOR_BUILD=true</code> → <code>base: &apos;./&apos;</code>{" "}
                        (relative asset paths for WebView).
                    </li>
                    <li>
                        <strong>WASM / top-level await:</strong> <code>vite-plugin-wasm</code> +{" "}
                        <code>vite-plugin-top-level-await</code> for Noir (<code>@noir-lang/noir_js</code>) and Barretenberg (
                        <code>@aztec/bb.js</code>). <code>assetsInclude: [&apos;**/*.wasm&apos;]</code>.
                    </li>
                    <li>
                        <strong>Node polyfills:</strong> <code>vite-plugin-node-polyfills</code> — Buffer, crypto, stream,
                        process for Semaphore / keccak / ethers browser paths.
                    </li>
                    <li>
                        <strong>Aliases:</strong> <code>@aztec/bb.js</code> → browser bundle; <code>keccak</code> →{" "}
                        <code>js.js</code>; <code>readable-stream</code> → stream-browserify&apos;s v3 copy;{" "}
                        <code>crypto</code> → crypto-browserify.
                    </li>
                    <li>
                        <strong>optimizeDeps.exclude:</strong> Zama SDK, Noir, bb.js (loaded as WASM, not pre-bundled).
                    </li>
                    <li>
                        <strong>Dev proxies:</strong> <code>/api/relayer/11155111</code> → Zama fhEVM relayer;{" "}
                        <code>/relay</code> → MedVault relayer; <code>/ai-service</code> → local ai-service (
                        <code>127.0.0.1:3200</code>). Not available in Capacitor APK — use direct URLs from{" "}
                        <code>src/lib/mobile.ts</code>.
                    </li>
                    <li>
                        <strong>COOP/COEP:</strong> intentionally <em>not</em> set — cross-origin isolation breaks Privy
                        embedded wallets and smart-wallet popups.
                    </li>
                </ul>

                <hr className="my-12 border-slate-200" />

                <h2>IV. FHE-Aware transaction lifecycle</h2>
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

                <h2>V. Mobile shell (Capacitor 8 Android)</h2>
                <p>
                    The same Vite bundle ships as an Android APK. Capacitor <strong>8.x</strong> wraps the SPA in a
                    WebView; mobile-specific code lives in <code>src/lib/mobile.ts</code> and{" "}
                    <code>src/components/mobile/</code>.
                </p>
                <ul>
                    <li>
                        <strong>Detection:</strong> <code>isNativeApp()</code> → <code>Capacitor.isNativePlatform()</code>;
                        <code>needsDirectApiUrls()</code> for relayer/Zama URL resolution without Vite proxy.
                    </li>
                    <li>
                        <strong>Build:</strong> <code>CAPACITOR_BUILD=true</code> sets Vite <code>base: &apos;./&apos;</code>;
                        assets sync to <code>android/app/src/main/assets/public/</code>
                    </li>
                    <li>
                        <strong>Origin:</strong> <code>https://localhost</code> — Privy and relayer CORS must allow it
                    </li>
                    <li>
                        <strong>APIs:</strong> Zama and MedVault relayers use direct HTTPS (no Vite/Vercel proxy)
                    </li>
                    <li>
                        <strong>Shell:</strong> <code>MobileAppShell</code> — Android back button, status bar, splash hide;{" "}
                        <code>MobileNetworkBanner</code> offline warning; <code>MobileLaunchRedirect</code> skips
                        marketing landing on native; <code>CryptoFallbackBanner</code> when WebCrypto AES-GCM is unavailable
                        (uses <code>@noble/ciphers</code> fallback)
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

                <h2>VI. Visual design rules</h2>
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
