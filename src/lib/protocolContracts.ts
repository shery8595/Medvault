/** Canonical protocol contract catalog for docs (Architecture + Contract reference). */

export type ContractAccent = "emerald" | "blue" | "purple" | "amber" | "teal" | "rose" | "violet";

export interface ProtocolContractEntry {
    id: string;
    name: string;
    accent: ContractAccent;
    role: string;
    summary: string;
    keyFunctions: string[];
    related?: string[];
    /** Non-obvious behavior, quirks, or legacy notes surfaced in docs. */
    quirks?: string[];
}

export const PROTOCOL_CONTRACTS: ProtocolContractEntry[] = [
    {
        id: "01",
        name: "TrialManager.sol",
        accent: "emerald",
        role: "Trial lifecycle",
        summary:
            "Inherits `ZamaEthereumConfig`. Creates and manages trials: public metadata (name, phase, location) plus eligibility bounds via **two paths** — `createTrialWithEncryptedCriteria` (FHE ciphertext handles; **required** on Sepolia/mainnet) or legacy `createTrial` (plaintext bounds; **Hardhat-only**, chainid 31337). Calls `SponsorRegistry` before trial creation on non-Sepolia networks. `EligibilityEngine` compares trial bounds against encrypted patient profiles homomorphically in both modes.",
        keyFunctions: [
            "createTrialWithEncryptedCriteria(...)",
            "createTrial(...)",
            "getTrial(trialId)",
            "getTrialEncryptedRequirements(trialId)",
            "deactivateTrial(trialId)",
            "scheduleAutomationContract / applyAutomationContract",
            "scheduleEligibilityEngine / applyEligibilityEngine",
            "scheduleSponsorRegistry / applySponsorRegistry",
        ],
        related: ["SponsorRegistry", "Chainlink price feeds (compensation)", "MedVaultAutomation"],
        quirks: [
            "Plaintext `createTrial` is Hardhat-only (chainid 31337); production and Sepolia must use `createTrialWithEncryptedCriteria`.",
            "Instant setters (`setAutomationContract`, `setEligibilityEngine`, `setSponsorRegistry`) hard-revert — use 2-day schedule/apply pairs.",
            "`isSponsorStillVerified(trialId)` soft-gates payouts when registry is configured (M-3).",
        ],
    },
    {
        id: "02",
        name: "MedVaultRegistry.sol",
        accent: "blue",
        role: "Patient vault & Semaphore bridge",
        summary:
            "Inherits `ZamaEthereumConfig`. Patient-facing registry: validates Semaphore proofs, forwards encrypted profiles to `AnonymousPatientRegistry`, and orchestrates anonymous stage/finalize flows with `EligibilityEngine`. Uses Zama FHE `InEuint` inputs + proofs from `@zama-fhe/sdk`. Semaphore group admin with extended Merkle root duration.",
        keyFunctions: [
            "registerPatient(commitment, permitRecipient, profileCommitment, profileSaltCommitment, ...)",
            "registerPatientViaRelayer(...) **onlyAuthorizedRelayer**",
            "stageAnonymousApply(...)",
            "finalizeAnonymousApplyWithProof(...) **open (P3.2)**",
            "finalizeAnonymousApplyWithConsent(...) **onlyAuthorizedRelayer**",
            "cancelAnonymousApplyStage(...) **onlyAuthorizedRelayer**",
            "scheduleRelayerAuth / applyRelayerAuth (P3.1 timelock)",
            "applyToTrial(...) **deprecated — reverts**",
        ],
        related: ["AnonymousPatientRegistry", "MockSemaphore / ISemaphore", "EligibilityEngine", "HonkVerifier"],
        quirks: [
            "`applyToTrial` reverts with \"Deprecated: use stageAnonymousApply + finalizeAnonymousApplyWithProof\".",
            "**P3.1 multi-relayer:** `authorizedRelayers` mapping with 2-day timelock (`scheduleRelayerAuth` / `applyRelayerAuth`). Registration/cancel/consent-finalize require `onlyAuthorizedRelayer`.",
            "**P3.2 open finalize:** `finalizeAnonymousApplyWithProof` has no relayer gate — patient EOAs may submit directly. Payout integrity is ciphertext-gated via `FHE.select` (P2). Relayer remains optional for gasless finalize when patient uses relayer as `permitRecipient` (P0.2 decrypt).",
            "Gasless cancel/register: `POST /relay/cancel-stage`, `POST /relay/register` via authorized relayer.",
        ],
    },
    {
        id: "03",
        name: "AnonymousPatientRegistry.sol",
        accent: "teal",
        role: "Commitment-keyed ciphertext store",
        summary:
            "Inherits `ZamaEthereumConfig`. Stores encrypted health profiles keyed by Semaphore identity commitment (not wallet address). Requires `authorizedEngine != address(0)` before `registerPatient` (MH-1). Only authorized `MedVaultRegistry` and `EligibilityEngine` may read profiles for FHE evaluation.",
        keyFunctions: [
            "registerPatient(commitment, permitRecipient, profileCommitment, profileSaltCommitment, ...)",
            "registerPatientClear(...) **Hardhat test helper only**",
            "getPatient(commitment)",
            "getProfileCommitment(commitment)",
            "checkRegistration(commitment)",
            "setAuthorizedEngine (one-time)",
            "scheduleTestHelpersEnabled / applyTestHelpersEnabled (testnet only)",
        ],
        related: ["MedVaultRegistry", "EligibilityEngine", "DataAccessLog"],
        quirks: [
            "**Profile salt (MED-1):** production `registerPatient` requires `profileSaltCommitment = keccak256(salt)`; rejects zero and the deterministic `keccak256(abi.encodePacked(defaultSalt(commitment)))` pattern. Use high-entropy random salt off-chain; store `profileSaltCommitments[commitment]` on-chain.",
            "`registerPatientClear` uses deterministic per-commitment salt on chainid 31337 only.",
            "Test helper toggles use schedule/apply (not production wiring timelock).",
        ],
    },
    {
        id: "04",
        name: "EligibilityEngine.sol",
        accent: "purple",
        role: "FHE matching core",
        summary:
            "Inherits `ZamaEthereumConfig`. Homomorphic scoring over encrypted patient metrics vs trial bounds (CMUX-weighted rubric). Anonymous nullifier flow: stage FHE → Noir proof finalize. FHE scoring is authoritative; Noir attestation is optional compliance seal. `ELIGIBILITY_PUBLIC_INPUT_COUNT = 25`.",
        keyFunctions: [
            "stageAnonymousEligibility(...)",
            "finalizeAnonymousEligibilityWithProof(...)",
            "finalizeAnonymousEligibilityWithConsent(...)",
            "getAnonymousScore(nullifier, trialId)",
            "scheduleAuthorizedReader(role, addr) / applyAuthorizedReader(role)",
            "checkEligibility(...) **deprecated — reverts**",
            "applyToTrial(...) **deprecated — reverts**",
            "checkAnonymousEligibilityWithConsent(...) **deprecated — reverts**",
        ],
        related: [
            "AnonymousPatientRegistry",
            "ConsentManager",
            "EncryptedConsentGate",
            "HonkVerifier",
            "PatientDocumentStore",
        ],
        quirks: [
            "**Silent rejection:** ineligible proofs finalize without revert; `silentApplyOutcome` set to `SilentRejected` (no on-chain plaintext eligibility bit).",
            "**7-day staging TTL:** `STAGING_TTL = 7 days` on pending anonymous eligibility.",
            "**Batch one-shot max 16:** `checkEligibilityBatch` allows 1–16 trials per commitment; `batchEligibilityChecked` flag is one-shot per pair.",
            "Instant reader setters hard-revert — use `scheduleAuthorizedReader` / `applyAuthorizedReader` (2-day delay).",
            "Reader role `patientDocumentStore` wires `PatientDocumentStore` address.",
        ],
    },
    {
        id: "05",
        name: "ConsentManager.sol",
        accent: "blue",
        role: "Encrypted consent ACL",
        summary:
            "Inherits `ZamaEthereumConfig`. Per-trial encrypted consent (`InEbool` / legacy duration overload). Revocation bumps `patientConsentEpoch`; consumers must use `getActiveConsent()` which gates on epoch equality.",
        keyFunctions: [
            "grantConsent(trialId, InEbool)",
            "revokeConsent(trialId)",
            "getActiveConsent(patient, trialId)",
            "recordConsentGrant(...) (engine-only, used by consent-at-finalize)",
            "scheduleConsentGate / applyConsentGate",
        ],
        related: ["DataAccessLog", "EligibilityEngine", "EncryptedConsentGate"],
        quirks: [
            "`revokeConsent` bumps `patientConsentEpoch`; `getActiveConsent` returns encrypted-false when epoch mismatched. Prior `FHE.allow` on old handles persists — forward-only; new attestations must use epoch-gated reads.",
            "`setConsentGate` instant setter hard-reverts.",
        ],
    },
    {
        id: "06",
        name: "SponsorRegistry.sol",
        accent: "amber",
        role: "Sponsor allowlist",
        summary:
            "Inherits `ZamaEthereumConfig`. Two-step Ownable allowlist of verified sponsors with encrypted institutional IDs (`euint64`). `TrialManager` requires `isVerifiedSponsor(msg.sender)` before trial creation.",
        keyFunctions: [
            "addSponsor(address)",
            "removeSponsor(address)",
            "isVerifiedSponsor(address)",
            "requestSponsorship(...)",
            "getEncryptedInstitutionId(sponsor)",
            "scheduleAuditor(auditor) / applyAuditor()",
        ],
        quirks: [
            "**Auditor role (LOW-2):** `scheduleAuditor` / `applyAuditor` use 6-hour `READER_CHANGE_DELAY`. Assigned auditor may read `getEncryptedInstitutionId` / `getRequestEncryptedId`.",
        ],
    },
    {
        id: "07",
        name: "EncryptedConsentGate.sol",
        accent: "violet",
        role: "Consent + eligibility gate",
        summary:
            "Inherits `ZamaEthereumConfig`. Combines `EligibilityEngine` results with `ConsentManager` active consent before sensitive downstream actions (encrypted gate on `ebool`). Consent wallet bound at apply finalize (M-2).",
        keyFunctions: [
            "computeGateWithActiveConsent(...)",
            "verifyGatePassed(...)",
            "computeGate(...) **legacy — reverts**",
        ],
        related: ["EligibilityEngine", "ConsentManager"],
        quirks: ["`computeGate` reverts — use `computeGateWithActiveConsent` only."],
    },
    {
        id: "08",
        name: "EncryptedScoreLeaderboard.sol",
        accent: "violet",
        role: "Encrypted rankings",
        summary:
            "Inherits `ZamaEthereumConfig`. Aggregates encrypted scores from `EligibilityEngine` for leaderboard-style views without revealing plaintext rankings on-chain.",
        keyFunctions: ["addApplicant(trialId, nullifier)", "compareApplicants(...)", "batchCompare(...)"],
        related: ["EligibilityEngine"],
    },
    {
        id: "09",
        name: "SponsorIncentiveVault.sol",
        accent: "purple",
        role: "Escrow & payouts",
        summary:
            "Trial incentive escrow, anonymous participant registration, and phased reward distribution coordinated with `TrialMilestoneManager` and automation. Distribution **stages entitlements**; patients **confirmReceipt** before cETH is credited; then claim via withdraw-to.",
        keyFunctions: [
            "fundTrial(...)",
            "fundTrialAndSetMilestones(...)",
            "registerAnonymousParticipant(trialId, nullifier) **permit holder only**",
            "registerAnonymousParticipantFor(...) **EIP-712 gasless**",
            "distributePartial(trialId, milestoneIndex)",
            "distributePartialPaginated(trialId, milestone, startIndex, batchSize)",
            "prepareEntitlementProof(trialId, milestoneIndex)",
            "confirmReceipt(trialId, milestoneIndex, cleartexts, decryptionProof)",
            "pruneUnconfirmedSlots(trialId, milestoneIndex)",
            "claimParticipantRewards(..., encryptedUnits, inputProof, withdrawToNonce, deadline, sig)",
            "recoverStrandedCeth(recipient) **owner**",
            "resetPaginationState(trialId, milestoneIndex)",
            "scheduleAutomationContract / applyAutomationContract",
            "registerParticipant(...) **deprecated — reverts**",
        ],
        related: ["TrialMilestoneManager", "MedVaultAutomation", "StakingManager", "ConfidentialETH"],
        quirks: [
            "`registerParticipant` (legacy address flow) hard-reverts with \"Deprecated\".",
            "**Pull-claim (P0-1):** `distributePartial*` stages entitlements only — cETH moves on `confirmReceipt`. Reclaim accounting uses `confirmedDistributedWei`.",
            "**Challenge window:** `CHALLENGE_WINDOW = 7 days` — sponsor `pruneUnconfirmedSlots` after deadline for unconfirmed patients.",
            "**Pool enrollment (MED-3):** `registerAnonymousParticipant` requires `msg.sender == decrypt permit holder`. Trial sponsor **cannot** enroll on behalf of patient — use `registerAnonymousParticipantFor` or relayer `POST /relay/register-anon`.",
            "**Pagination (LOW-3):** `distributePartial` reverts when `pCount > DISTRIBUTE_BATCH_SIZE (20)` — use sequential `distributePartialPaginated` batches; `lastProcessedIndex` commits only in `_finalizePaginatedBatch`.",
            "**Pagination resilience (MED-2 / P3):** per-participant credit failures emit `ParticipantCreditFailed` and no longer revert the batch — automation and paginated distribution advance `lastProcessedIndex`; sponsor UI surfaces partial-failure warnings from receipt logs.",
            "**Confidential cETH funding (LOW-2):** `onConfidentialTransferReceived` reverts `ConfidentialFundingDisabled` until `confidentialFundingEnabled` and `confidentialFundingAccountingReady` are both true. Production funding uses `fundTrial` / `fundTrialAndSetMilestones` (plain ETH).",
        ],
    },
    {
        id: "10",
        name: "TrialMilestoneManager.sol",
        accent: "emerald",
        role: "Milestone scheduling",
        summary:
            "Tracks trial milestones and participant progress; enforces participant checks before payouts (audit H-4). Milestones set by sponsor or vault callback.",
        keyFunctions: [
            "defineMilestones(...)",
            "setMilestonesFromVault(...)",
            "markMilestoneComplete(...)",
            "scheduleVault / applyVault",
            "scheduleTrialManager / applyTrialManager",
        ],
        related: ["TrialManager", "SponsorIncentiveVault"],
        quirks: ["Instant `setVault` / `setTrialManager` hard-revert."],
    },
    {
        id: "11",
        name: "StakingManager.sol",
        accent: "emerald",
        role: "Private yield",
        summary:
            "Inherits `ZamaEthereumConfig`, `IERC7984Receiver`. Dual staking paths: public Aave V3 stake/unstake (amounts visible) and confidential `stakeFromConfidential` / private unstake (encrypted cETH ledger, no Aave exit).",
        keyFunctions: [
            "stake()",
            "stakeAndLock(encryptedUnits, inputProof)",
            "requestConfidentialStake / completeConfidentialStake **deprecated — revert Use stakeAndLock**",
            "requestPrivateUnstake / completePrivateUnstake",
            "requestPublicUnstake / completePublicUnstake",
            "getEncryptedTotalStaked(address)",
        ],
        related: ["ConfidentialETH"],
        quirks: [
            "**Confidential stake (HIGH-2):** `requestConfidentialStake` and `completeConfidentialStake` hard-revert `\"Use stakeAndLock\"`. Canonical path: `cETH.setOperator(stakingManager)` then `stakeAndLock` (ERC-7984 operator pull).",
            "`event Unstaked` is declared but **never emitted** — use `PrivateUnstaked` or `PublicUnstaked` instead.",
        ],
    },
    {
        id: "12",
        name: "ConfidentialETH7984.sol",
        accent: "blue",
        role: "IERC7984 encrypted ETH wrapper",
        summary:
            "Extends OpenZeppelin `ERC7984` confidential token. `euint64` balances, `UNIT_SCALE = 1e12` wei per unit. Native-ETH deposit, multi-phase withdraw, EIP-712 withdraw-to/public exit, lock/unlock, KMS-gated `transferEncrypted`. Primary implementation; see `ConfidentialETH.sol` alias.",
        keyFunctions: [
            "name() / symbol() / decimals() / confidentialBalanceOf()",
            "confidentialTransfer / setOperator",
            "deposit() / depositFor()",
            "requestWithdraw / completeWithdraw",
            "requestWithdrawTo(user, dest, enc, proof, nonce, deadline, signature)",
            "completeWithdrawTo (authorized contract only)",
            "completePublicExit (EIP-712 + relayer)",
            "claimFailedWithdraw()",
            "scheduleContractAuth / applyContractAuth",
            "transferEncrypted(from, to, amount)",
        ],
        related: ["StakingManager", "SponsorIncentiveVault"],
        quirks: [
            "**Failed withdraw escrow (LOW-1):** if ETH send fails in `completeWithdraw` / `completeWithdrawTo`, amount is credited to `pendingFailedWithdrawWei[recipient]`; if `completePublicExit` fails, escrow goes to `pendingFailedWithdrawWei[owner]` (not `stealthRecipient`) and `withdrawNonces[owner]` is preserved. `FailedWithdrawEscrowed` is emitted; burn still completes. Recover via `claimFailedWithdraw()`.",
            "Instant `authorizeContract` / `deauthorizeContract` hard-revert — use `scheduleContractAuth` / `applyContractAuth` (2-day delay).",
            "EIP-712 domain string: \"MedVault ConfidentialETH\" (unchanged for signature compatibility).",
        ],
    },
    {
        id: "13",
        name: "MedVaultAutomation.sol",
        accent: "rose",
        role: "Chainlink Automation",
        summary:
            "Implements `AutomationCompatibleInterface`. `checkUpkeep` scans pending milestone payouts; `performUpkeep` triggers vault distribution. Constructor requires non-zero forwarder placeholder; real forwarder set via `scheduleChainlinkForwarder`.",
        keyFunctions: [
            "checkUpkeep(bytes)",
            "performUpkeep(bytes)",
            "scheduleVault / applyVault",
            "scheduleChainlinkForwarder / applyChainlinkForwarder",
        ],
        related: ["SponsorIncentiveVault", "TrialManager"],
        quirks: [
            "**Prune cap (INFO-1):** `_pruneExpiredTrials` processes at most `MAX_PRUNE_PER_UPKEEP = 10` expired trials per `performUpkeep` call.",
            "Type 0 upkeep (legacy eligibility check) removed — called deprecated `EligibilityEngine.checkEligibility`.",
            "Instant `setVault` / `setChainlinkForwarder` hard-revert.",
            "`performUpkeep` accepts trials in `expiredTrialIds` queue after prune (not only `activeTrialIds`).",
        ],
    },
    {
        id: "14",
        name: "DataAccessLog.sol",
        accent: "amber",
        role: "Audit trail",
        summary:
            "Authorized loggers only (`scheduleAuthorizeLogger` / `applyAuthorizeLogger`). Records anonymized `keccak256` hashes for registration, eligibility, consent, status, reward, and hybrid document events.",
        keyFunctions: [
            "logAction(ActionType, trialId, hash)",
            "scheduleAuthorizeLogger / applyAuthorizeLogger",
            "cancelAuthorizeLogger (pending cancel)",
        ],
        quirks: ["Instant `authorizeLogger` removed — production must use schedule/apply."],
    },
    {
        id: "15",
        name: "PatientDocumentStore.sol",
        accent: "teal",
        role: "Hybrid IPFS + FHE document keys",
        summary:
            "Inherits `ZamaEthereumConfig`. Stores IPFS CID + FHE-wrapped AES-256 key (4×`euint64`). Sponsor decrypt ACL deferred to per-access `pullSponsorKeyAccess` after `authorizeSponsorOnAccept` on Accepted. Document binding hashes feed Noir public inputs 17–24 (`has_document`, `doc_cid_hash`, etc.).",
        keyFunctions: [
            "recordDocumentCid(nullifier, trialId, cid, aesKeyCtHash, keyChunks, inputProof)",
            "authorizeSponsorOnAccept(trialId, nullifier) (engine-only, marks eligible)",
            "pullSponsorKeyAccess(nullifier, trialId) (sponsor pull)",
            "revokeAccess(nullifier, trialId, newCid, newAesKeyCtHash, keyChunks, inputProof) **atomic rotate**",
            "getKeyForSponsor(nullifier, trialId)",
            "setUnpinIndexer(indexer, trusted) **owner**",
            "postIndexerHeartbeat() / attestLegacyCidUnpinned(...) **trusted indexer**",
            "rotateDocument(...) / updateDocumentKey(...) **deprecated — reverts Use revokeAccess**",
            "getDocumentBindingForEngine(nullifier, trialId)",
        ],
        related: ["EligibilityEngine", "TrialManager", "DataAccessLog"],
        quirks: [
            "**Atomic revoke+rotate (H-2 / P4):** `revokeAccess` requires new CID + key chunks. Emits `DocumentLegacyHandleRevoked` with `oldCid`; trusted indexer unpins via Pinata and posts `attestLegacyCidUnpinned`. Contracts cannot revoke already-decrypted files — old IPFS CID must be unpinned off-chain.",
            "Per-access sponsor pull: `authorizeSponsorOnAccept` does not grant FHE.allow; sponsor calls `pullSponsorKeyAccess` on first decrypt. Patient may revoke before pull.",
            "Forward-only ACL: `revokeAccess` bumps `documentEpoch`; sponsor reads require matching `sponsorGrantEpoch` after pull.",
        ],
    },
];

/** One-line deployment alias — not a separate implementation. */
export const PROTOCOL_ALIAS_CONTRACTS: ProtocolContractEntry[] = [
    {
        id: "—",
        name: "ConfidentialETH.sol",
        accent: "blue",
        role: "Backward-compatible alias",
        summary:
            "`contract ConfidentialETH is ConfidentialETH7984 {}` — single-line alias for ABI/address compatibility. Deploy scripts use `ConfidentialETH7984` factory; `addresses.json` key remains **`ConfidentialETH`**. No additional logic.",
        keyFunctions: ["(inherits all ConfidentialETH7984 functions)"],
        related: ["ConfidentialETH7984"],
    },
];

export const PROTOCOL_OPTIONAL_CONTRACTS: ProtocolContractEntry[] = [
    {
        id: "ZK",
        name: "HonkVerifier.sol",
        accent: "rose",
        role: "Noir / Honk attestation (plaintext criteria)",
        summary:
            "Generated Barretenberg Honk verifier for `circuits/eligibility_plaintext`. **25 user public inputs** in `EligibilityEngine`; on-chain `NUMBER_OF_PUBLIC_INPUTS = 33` (= 25 user + 8 pairing points). Wired to `eligibilityVerifier`. Build with `npm run build:circuit` before deployment.",
        keyFunctions: ["verify(bytes proof, bytes32[] publicInputs)"],
        related: ["EligibilityEngine", "HonkVerifierEncrypted.sol"],
        quirks: [
            "Canonical deploy copy: `contracts/HonkVerifier.sol` (from `circuits/eligibility_plaintext/target/`).",
            "Regenerate via `npm run generate:honk-verifier`; verify with `scripts/verify-honk-verifier.mjs`.",
        ],
    },
    {
        id: "ZK-ENC",
        name: "HonkVerifierEncrypted.sol",
        accent: "rose",
        role: "Noir / Honk attestation (encrypted criteria)",
        summary:
            "Honk verifier for `circuits/eligibility_encrypted`. **15 user public inputs**; FHE is the sole eligibility authority — circuit binds identity, nullifier, staged FHE handle, and encrypted criteria hash. Wired to `eligibilityVerifierEncrypted`.",
        keyFunctions: ["verify(bytes proof, bytes32[] publicInputs)"],
        related: ["EligibilityEngine", "HonkVerifier.sol"],
        quirks: [
            "Deploy + wire: `npm run deploy:sepolia` or `npm run deploy:encrypted-verifier:sepolia` + timelock apply.",
        ],
    },
];

export const CONTRACT_INTERACTION_ROWS = [
    {
        caller: "MedVaultRegistry",
        callee: "AnonymousPatientRegistry, EligibilityEngine",
        purpose: "Register profiles; stage/finalize anonymous eligibility",
    },
    {
        caller: "MedVaultRegistry",
        callee: "HonkVerifier / HonkVerifierEncrypted (via EligibilityEngine)",
        purpose: "Noir proof verification at finalizeAnonymousApplyWithProof (mode-specific verifier)",
    },
    {
        caller: "EligibilityEngine",
        callee: "AnonymousPatientRegistry, TrialManager",
        purpose: "Read encrypted patient metrics and trial bounds",
    },
    {
        caller: "EligibilityEngine",
        callee: "ConsentManager, EncryptedConsentGate",
        purpose: "Consent-gated eligibility and score access",
    },
    {
        caller: "EligibilityEngine",
        callee: "PatientDocumentStore",
        purpose: "Document binding cross-check + authorizeSponsorOnAccept on Accepted",
    },
    {
        caller: "TrialManager",
        callee: "SponsorRegistry",
        purpose: "Verify sponsor before createTrial",
    },
    {
        caller: "SponsorIncentiveVault",
        callee: "TrialMilestoneManager, StakingManager",
        purpose: "Milestone payouts and yield routing",
    },
    {
        caller: "MedVaultAutomation",
        callee: "SponsorIncentiveVault",
        purpose: "Keeper-triggered distributions",
    },
    {
        caller: "SponsorIncentiveVault",
        callee: "ConfidentialETH",
        purpose: "Encrypted claim staging via requestWithdrawTo",
    },
    {
        caller: "StakingManager",
        callee: "ConfidentialETH",
        purpose: "stakeFromConfidential / private unstake transferEncrypted",
    },
    {
        caller: "ConsentManager / MedVaultRegistry / EligibilityEngine / PatientDocumentStore",
        callee: "DataAccessLog",
        purpose: "Immutable audit entries",
    },
];

/** Legacy entry points that hard-revert — do not call from new integrations. */
export const DEPRECATED_CONTRACT_FUNCTIONS = [
    { contract: "EligibilityEngine", fn: "checkEligibility(address,uint256)", replacement: "Anonymous flow via MedVaultRegistry.stageAnonymousApply" },
    { contract: "EligibilityEngine", fn: "applyToTrial(...)", replacement: "MedVaultRegistry.stageAnonymousApply + finalizeAnonymousApplyWithProof" },
    { contract: "EligibilityEngine", fn: "checkAnonymousEligibilityWithConsent(...)", replacement: "finalizeAnonymousEligibilityWithProof or finalizeAnonymousEligibilityWithConsent" },
    { contract: "MedVaultRegistry", fn: "applyToTrial(...)", replacement: "stageAnonymousApply + finalizeAnonymousApplyWithProof" },
    { contract: "EncryptedConsentGate", fn: "computeGate(...)", replacement: "computeGateWithActiveConsent" },
    { contract: "SponsorIncentiveVault", fn: "registerParticipant(uint256,address)", replacement: "registerAnonymousParticipant (permit holder) or registerAnonymousParticipantFor after accepted apply" },
    { contract: "StakingManager", fn: "requestConfidentialStake / completeConfidentialStake", replacement: "stakeAndLock(encryptedUnits, inputProof) after cETH.setOperator" },
    { contract: "PatientDocumentStore", fn: "updateDocumentKey(...)", replacement: "revokeAccess (atomic with new CID + key)" },
    { contract: "PatientDocumentStore", fn: "rotateDocument(...)", replacement: "revokeAccess (atomic with new CID + key)" },
];

/** Contracts using owner schedule* → wait READER_CHANGE_DELAY (6 hours) → apply* for cross-contract wiring. */
export const TIMELOCK_WIRED_CONTRACTS = [
    "TrialManager",
    "EligibilityEngine",
    "SponsorIncentiveVault",
    "TrialMilestoneManager",
    "MedVaultAutomation",
    "ConsentManager",
    "ConfidentialETH7984",
    "DataAccessLog",
    "SponsorRegistry",
];

export const ACCENT_STYLES: Record<
    ContractAccent,
    { badge: string; border: string; number: string }
> = {
    emerald: {
        badge: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
        border: "border-emerald-100",
        number: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    blue: {
        badge: "bg-blue-500/10 text-blue-700 border-blue-200",
        border: "border-blue-100",
        number: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    purple: {
        badge: "bg-purple-500/10 text-purple-700 border-purple-200",
        border: "border-purple-100",
        number: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
    amber: {
        badge: "bg-amber-500/10 text-amber-800 border-amber-200",
        border: "border-amber-100",
        number: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    teal: {
        badge: "bg-teal-500/10 text-teal-700 border-teal-200",
        border: "border-teal-100",
        number: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    },
    rose: {
        badge: "bg-rose-500/10 text-rose-700 border-rose-200",
        border: "border-rose-100",
        number: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
    violet: {
        badge: "bg-violet-500/10 text-violet-700 border-violet-200",
        border: "border-violet-100",
        number: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    },
};
