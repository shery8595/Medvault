import { Prose } from "../../components/docs/Prose";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

const entries: { date: string; title: string; items: string[] }[] = [
    {
        date: "2026-06",
        title: "Android demo APK (Capacitor)",
        items: [
            "Capacitor Android shell (xyz.medvault.app) bundles Vite dist/ in WebView with https://localhost origin.",
            "src/lib/mobile.ts — native detection, direct HTTPS relayer URLs when Vite/Vercel proxies unavailable.",
            "Mobile UX: back button, offline banner, launch redirect to patient dashboard, FHE/wallet hints.",
            "npm scripts: mobile:studio, mobile:build, mobile:apk:debug; docs at /docs/mobile/android-apk and docs/ANDROID_APK.md.",
            "Ops: Privy + relayer must allow https://localhost; android/local.properties + JDK 21 for Gradle.",
        ],
    },
    {
        date: "2026-06",
        title: "Private withdrawals (encrypted staging + public exit modes)",
        items: [
            "ConfidentialETH: encrypted requestWithdraw / requestWithdrawTo, euint64 pending state, two-phase reveal + complete.",
            "EIP-712 completePublicExit to stealth recipients; fast vs private-batch relayer settlement.",
            "SponsorIncentiveVault.claimParticipantRewards uses externalEuint64; vault address as FHE proof account.",
            "StakingManager: stakeFromConfidential, requestPrivateUnstake / completePrivateUnstake (no Aave); public unstake kept separate.",
            "Client: encryptUint64, withdrawFlow.ts, WithdrawModeSelector UI, stealthAddress.ts.",
            "Relayer: POST /relay/public-exit, batch-exit-queue.mjs, updated watcher ABIs.",
            "Tests: V09-09–13, PEX-01–05, BEX-01–03; docs at /docs/private-withdrawals and docs/PRIVATE_WITHDRAWALS.md.",
        ],
    },
    {
        date: "2026-06",
        title: "Noir attestation repositioning & Sepolia upgrade",
        items: [
            "Noir reframed as public compliance attestation seal — Zama FHE remains authoritative compute.",
            "eligibility_proof circuit: 16 public inputs (FHE stage handle + criteria schema hash binding).",
            "EligibilityEngine: attestationReceipt(), finalizeWithProof stage binding, extended EligibilityProofVerified event.",
            "Frontend sealResult() API, sponsor audit bundle export, subgraph attestation fields.",
            "Sepolia redeploy: HonkVerifier + EligibilityEngine + rewired registry/vault; subgraph v0.1.1.",
            "test/unit/attestation-binding.test.ts — FHE vs Noir differential and anti-replay coverage.",
        ],
    },
    {
        date: "2026-06",
        title: "TypeScript SDK & MCP",
        items: [
            "Added @medvault/sdk (packages/medvault-sdk/) — MedVaultSDK facade for trials, sponsor ops, protocol metadata, and relayer HTTP.",
            "Self-contained @medvault/core data/ assets; npm run sync-sdk-assets after contract deploys.",
            "MCP server (mcp-server/) and packages/medvault-core/ — Model Context Protocol tools for sponsors and developers.",
            "In-app docs: /docs/mcp, /docs/mcp/sdk, /docs/mcp/setup, /docs/mcp/tools; no production MCP hosting required.",
        ],
    },
    {
        date: "2026-05",
        title: "One-week incorporation wave",
        items: [
            "Eligibility engine emits indexer-only AnonymousEncryptedPropensityCommitted hooks; subgraph aggregates TrialPropensitySignals for operators who redeploy.",
            "Sponsor analytics: aggregate representation prompts plus Aave pool–backed APR snapshots with explicit fallback modes.",
            "Patient vault: MVP FHIR R4 JSON importer for Patient/Observation/Condition subsets with form prefill.",
            "Reclaim attestation categories (lab/provider/general) with client-side TTL and migration from legacy session keys.",
            "ConsentManager legacy grantConsent(uint256,uint256) path restored for tests/SDK flows alongside encrypted proofs.",
            "Explicit roadmap deferrals: confidential training, MPC custody, cross-chain hub, DAO transition — documented in Compliance + README.",
        ],
    },
    {
        date: "2026-04",
        title: "Documentation & routing",
        items: [
            "Added tabbed documentation shell with search and per-page copy link.",
            "Aligned technical copy with Ethereum Sepolia and AnonymousPatientRegistry / MedVaultRegistry naming.",
        ],
    },
    {
        date: "Ongoing",
        title: "Protocol",
        items: [
            "fhEVM FHE types and EligibilityEngine remain the core matching layer.",
            "Subgraph and ConsentManager integrations evolve with contract upgrades—check addresses.json for your deployment.",
        ],
    },
];

export function ChangelogDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />
                <div className="not-prose space-y-8 max-w-3xl">
                    {entries.map((e) => (
                        <section key={e.title}>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#00685f] m-0 mb-1">
                                {e.date}
                            </p>
                            <h2 className="text-lg font-bold text-slate-900 m-0 mb-3">{e.title}</h2>
                            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2 m-0">
                                {e.items.map((t) => (
                                    <li key={t}>{t}</li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </Prose>
        </motion.div>
    );
}
