import { Prose } from "../../components/docs/Prose";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

const entries: { date: string; title: string; items: string[] }[] = [
    {
        date: "2026-07",
        title: "Vault P5: confidential cETH funding guard (LOW-2)",
        items: [
            "Contract: `onConfidentialTransferReceived` reverts `ConfidentialFundingDisabled` until `confidentialFundingEnabled` and `confidentialFundingAccountingReady` are both true; `creditConfidentialFund` documented as FHE-only (no `totalDepositedWei` sync).",
            "Tests: RCV-01/02/06, ATOM-04, TOK-INV-02 — revert + `totalDepositedWei` unchanged.",
            "Docs: `SECURITY.md`, `FHE_AUDIT_README.md`, `ATOMIC_FLOWS.md`, `/docs/zama-fhe`, contract catalog quirks.",
            "ABI: `SponsorIncentiveVault.json` synced (`confidentialFundingAccountingReady`, `ConfidentialFundingDisabled`).",
        ],
    },
    {
        date: "2026-07",
        title: "cETH P4: failed public-exit escrow (LOW-1)",
        items: [
            "Contract: failed `completePublicExit` escrows to `owner_` (not `stealthRecipient`); `withdrawNonces[owner]` preserved on transfer failure.",
            "Tests: PEX-06 in `test/unit/public-exit.test.ts`.",
            "Docs: `docs/PRIVATE_WITHDRAWALS.md`, `/docs/private-withdrawals`, `protocolContracts.ts`, test matrix, `SECURITY.md`.",
        ],
    },
    {
        date: "2026-07",
        title: "Vault P3: pagination stall fix (MED-2)",
        items: [
            "Contracts: `payEligibleBatchWithCheckpoint` wraps per-participant credit in try/catch; `ParticipantCreditFailed` event; `creditParticipantRewardForBatch` wrapper on `SponsorIncentiveVault`.",
            "Frontend: `vaultDistributionEvents.ts` parses partial credit failures from distribution receipts; sponsor trial page shows warning when some participants were skipped.",
            "ABI: `SponsorIncentiveVault.json` synced (`ParticipantCreditFailed`, `creditParticipantRewardForBatch`).",
            "Tests: `test/unit/pagination-stall-fix.test.ts` (P3-01 paginated batch, P3-02 performUpkeep).",
        ],
    },
    {
        date: "2026-07",
        title: "Vault P0-1: pull-claim receipt confirmation",
        items: [
            "Contracts: distribution stages entitlements only (`entitlementStaged`, `stagedShareWei`, `challengeDeadline`); cETH credited on `confirmReceipt` with KMS decryption proof; `pruneUnconfirmedSlots` after `CHALLENGE_WINDOW` (7 days); reclaim uses `confirmedDistributedWei`; owner `recoverStrandedCeth`.",
            "Frontend: `confirmReceiptFlow.ts` + `claimFlow` confirm step; `ClaimModal` / `ClaimWizard`; sponsor UI shows staged vs confirmed; patient claim gated on staged/confirmed balance.",
            "ABI: `SponsorIncentiveVault.json` synced (`prepareEntitlementProof`, `confirmReceipt`, `entitlementStaged`, `confirmedPayout`).",
            "Docs: `ZERO_REVELATION_REWARDS.md`, `PRIVATE_WITHDRAWALS.md`, `ATOMIC_FLOWS.md`, contract catalog quirks.",
            "Tests: `test/unit/sponsor-incentive-vault-claim-prune.test.ts` (P01-01..05); helper `test-support/claimReceipt.ts`.",
        ],
    },
    {
        date: "2026-07",
        title: "Vault P2: abandoned pool recovery (sponsor removed mid-trial)",
        items: [
            "Contract: `reclaimAbandonedToOwner` bypasses screening/milestone distribution gates when `SponsorRegistry.isVerifiedSponsor(trial.sponsor)` is false; keeps grace-period, challenge-window, and `reclaimFinalized` checks. Verified-sponsor `reclaimUndistributed` unchanged.",
            "Frontend: `/admin/sponsors` abandoned-pool recovery card (trial ID → schedule → claim); sponsor trial page shows unverified-sponsor blocked message.",
            "Adapters: `reclaimAbandonedToOwnerPool`, extended `getTrialPoolReclaimStatus` (`sponsorVerified`, `canAbandonedReclaim`, `vaultOwnerAuthorized`).",
            "SDK: `sdk.sponsor.reclaimAbandonedPool`, `claimReclaimedPool`. MCP: `medvault_reclaim_abandoned_pool`, `medvault_claim_reclaimed_pool`.",
            "Tests: `test/unit/vault-security-fixes.test.ts` — P2 / HIGH-1 positive + negative reclaim paths.",
        ],
    },
    {
        date: "2026-07",
        title: "Medium findings closeout + full test suite re-verification",
        items: [
            "Security: M-AUDIT-1 resolved (`SponsorRegistry.scheduleAuditor` zero-address guard + SRA-01–05); M-SILENT-1 closed Informational; M-REGCON-1 closed Low (SDK-blocked). Canonical record: docs/MEDIUM_FINDINGS_CLOSEOUT.md.",
            "Docs: internal-docs/threat-model.md rows 36/37/47 + SECURITY.md RegConsistency cross-link synced.",
            "Tests: npm test → 483 passing (395 unit + 85 integration + 3 crypto), 6 unit pending; `test/unit/sponsor-registry-auditor.test.ts` added.",
            "Docs: docsStats / TEST_MATRIX / README / in-app Security + Smart Contracts pages aligned to 483 default suite.",
        ],
    },
    {
        date: "2026-07",
        title: "EIP-170 shrink, Sepolia redeploy, subgraph v0.2.0",
        items: [
            "Contracts: EligibilityComputeLib + VaultDistributionLib + VaultConfidentialLib; production APR Poseidon-free; EE/Vault test harnesses on Hardhat (chain 31337).",
            "Sepolia: clean full deploy (new addresses in addresses.json); timelock wiring scheduled — apply via scripts/finish-wiring.ts after ~2 days.",
            "Subgraph: Graph Studio medvault/v0.2.0; VITE_SUBGRAPH_URL canonical query URL updated.",
            "Tests: npm test → 428 passing (341 unit + 84 integration + 3 crypto), 6 unit pending; vault custom-error assertions in unit/integration specs.",
            "Docs: docsStats suite breakdown + SUBGRAPH_STUDIO_VERSION; TEST_MATRIX / SUBGRAPH_SYNC / Deployment guide aligned.",
        ],
    },
    {
        date: "2026-07",
        title: "Post-audit remediation (docs + integrator alignment)",
        items: [
            "HIGH-1: finalize/cancel/registerPatientViaRelayer gated by `onlyTrustedRelayer`; production path is relayer `POST /relay/apply-finalize` and `/relay/cancel-stage`.",
            "HIGH-2: confidential stake uses `stakeAndLock` (+ `cETH.setOperator` or `confidentialTransferAndCall`); `requestConfidentialStake` / `completeConfidentialStake` revert.",
            "MED-1: `registerPatient` requires `profileSaltCommitment` (random salt); deterministic salts rejected on production.",
            "MED-3: `registerAnonymousParticipant` is permit-holder-only; sponsor accept no longer auto-enrolls — patient enrolls via Applied Trials UI.",
            "MED-2: `rotateDocument` + `DocumentLegacyHandleRevoked`; `updateDocumentKey` deprecated.",
            "LOW-1/2/3 + INFO: `claimFailedWithdraw`, `scheduleAuditor`/`applyAuditor`, `distributePartialPaginated` (batch 20), `MAX_PRUNE_PER_UPKEEP=10`.",
            "Regression: test/unit/remediation-vuln-fixes.test.ts; docs synced via scripts/verify-doc-consistency.mjs.",
        ],
    },
    {
        date: "2026-06",
        title: "Plan 05b: Hybrid document UI wiring",
        items: [
            "Patient: HybridDocumentUploader on trial apply + vault (?trialId=) — encrypt → IPFS → pending binding.",
            "Apply: submitViaRelayer records document after stage + passes documentBinding to Noir.",
            "Sponsor: SponsorDocumentPanel decrypt on accepted anonymous matches (EIP-712 FHE unwrap + AES).",
            "Relayer: POST /relay/pin-document (optional RELAYER_PIN_SECRET); browser pin falls back when Pinata env unset.",
            "Contracts: PatientDocumentStore ABI + addresses.json entry; configure via VITE_PATIENT_DOCUMENT_STORE.",
            "Docs: docs/HYBRID_STORAGE.md; Vitest patient-document-upload tests.",
        ],
    },
    {
        date: "2026-06",
        title: "Parity improvements: IERC7984, Docker Compose, internal-docs",
        items: [
            "ConfidentialETH7984: OpenZeppelin ERC7984 + MedVault withdraw/exit/lock extensions; ConfidentialETH alias preserved.",
            "Dependencies: @openzeppelin/confidential-contracts ^0.5.1, @openzeppelin/contracts ^5.6.1.",
            "Docker: docker compose up --build (frontend :3000); optional --profile relayer and --profile graph.",
            "Docs: docs/DOCKER.md, docs/ERC7984_CONFIDENTIAL_TOKEN.md, docs/README.md index; internal-docs/ SRS/DFD/threat model.",
            "Tests: CET-13/14 IERC7984 conformance; npm test → 348 passing (June 2026 re-verify), 4 permanent pending + 1 conditional; npm run docker:smoke.",
        ],
    },
    {
        date: "2026-06",
        title: "Frontend: post-upgrade contract integration",
        items: [
            "Claim flow: WithdrawTo + ClaimAuthorization EIP-712 (encryptedAmountCommitment); relayer /relay/claim forwards new fields.",
            "Sponsor reclaim UI: schedule reclaim → claimReclaimed pull pattern with pendingReclaimWei widget.",
            "Attestation: sealResult routes via MedVaultRegistry.finalizeAnonymousApplyWithProof (verifyEligibilityProof removed).",
            "Admin /admin/wiring timelock panel; audit log getTotalLogCount stat; staking split public/private FHE reads.",
            "Stale stage permit auto-retry with fresh deadline; friendly contract error surfacing on registration flows.",
        ],
    },
    {
        date: "2026-06",
        title: "Security hardening: timelock wiring & withdraw-to auth",
        items: [
            "2-day READER_CHANGE_DELAY on admin wiring: schedule* / apply* replaces instant setters on TrialManager, EligibilityEngine, SponsorIncentiveVault, TrialMilestoneManager, MedVaultAutomation, ConfidentialETH, ConsentManager, DataAccessLog.",
            "Sepolia deploy flow: deploy:sepolia → deploy:wire:sepolia → deploy:wiring:sepolia after delay; scripts/lib/timelockWiring.ts + ensureFhevmInitialized() for live FHEVM.",
            "ConfidentialETH.requestWithdrawTo requires patient EIP-712 WithdrawTo signature; claimParticipantRewards forwards nonce/deadline/signature; claim EIP-712 binds encryptedAmountCommitment.",
            "MH-1: AnonymousPatientRegistry requires authorizedEngine before registerPatient; MedVaultAutomation constructor requires non-zero forwarder placeholder.",
            "Subgraph v0.1.23 on Sepolia (historical); npm test → 348 passing, 5 pending (June 2026 baseline); new TL-01–TL-06 in test/unit/timelock-wiring.test.ts.",
            "Docs: /docs/timelock-wiring, docs/TIMELOCK_WIRING.md; updated deployment, private withdrawals, test matrix.",
        ],
    },
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
