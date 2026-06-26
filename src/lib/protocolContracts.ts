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
}

export const PROTOCOL_CONTRACTS: ProtocolContractEntry[] = [
    {
        id: "01",
        name: "TrialManager.sol",
        accent: "emerald",
        role: "Trial lifecycle",
        summary:
            "Creates and manages trials: public metadata (name, phase, location) plus **public** eligibility bounds (age, Hb, flags) in `TrialManager`. Calls SponsorRegistry before createTrial on non-Sepolia networks. `EligibilityEngine` compares these bounds against encrypted patient profiles.",
        keyFunctions: ["createTrial(...)", "getTrial(trialId)", "deactivateTrial(trialId)"],
        related: ["SponsorRegistry", "Chainlink price feeds (compensation)"],
    },
    {
        id: "02",
        name: "MedVaultRegistry.sol",
        accent: "blue",
        role: "Patient vault & Semaphore bridge",
        summary:
            "Patient-facing registry: validates Semaphore proofs, forwards encrypted profiles to AnonymousPatientRegistry, and orchestrates apply/stage flows with EligibilityEngine. Uses Zama FHE InEuint inputs + proofs from @zama-fhe/sdk.",
        keyFunctions: ["registerPatient(...)", "applyToTrial(...)", "stageEligibility(...)"],
        related: ["AnonymousPatientRegistry", "MockSemaphore / ISemaphore", "EligibilityEngine"],
    },
    {
        id: "03",
        name: "AnonymousPatientRegistry.sol",
        accent: "teal",
        role: "Commitment-keyed ciphertext store",
        summary:
            "Stores encrypted health profiles keyed by Semaphore identity commitment (not wallet address). Only authorized MedVaultRegistry and EligibilityEngine may read profiles for FHE evaluation.",
        keyFunctions: ["registerPatient(commitment, ...)", "getPatient(commitment)", "checkRegistration(commitment)"],
        related: ["MedVaultRegistry", "EligibilityEngine"],
    },
    {
        id: "04",
        name: "EligibilityEngine.sol",
        accent: "purple",
        role: "FHE matching core",
        summary:
            "Homomorphic scoring over encrypted patient metrics vs trial bounds (CMUX-weighted rubric). Supports legacy address flow and anonymous nullifier flow with staging/finalize, consent-gated checks, and optional Noir attestation via verifyEligibilityProof / finalizeWithProof (FHE stage binding).",
        keyFunctions: [
            "stageAnonymousEligibility(...)",
            "finalizeAnonymousEligibility(...)",
            "checkAnonymousEligibilityWithConsent(...)",
            "getAnonymousScore(nullifier, trialId)",
        ],
        related: ["AnonymousPatientRegistry", "ConsentManager", "EncryptedConsentGate", "HonkVerifier"],
    },
    {
        id: "05",
        name: "ConsentManager.sol",
        accent: "blue",
        role: "Encrypted consent ACL",
        summary:
            "Per-trial encrypted consent (InEbool / legacy duration overload). Revocation bumps consent epoch. getActiveConsent re-allows consumers (e.g. EligibilityEngine) for applyToTrialWithConsent flows.",
        keyFunctions: [
            "grantConsent(trialId, InEbool)",
            "revokeConsent(trialId)",
            "getActiveConsent(patient, trialId)",
            "setEligibilityEngine(address)",
        ],
        related: ["DataAccessLog", "EligibilityEngine", "EncryptedConsentGate"],
    },
    {
        id: "06",
        name: "SponsorRegistry.sol",
        accent: "amber",
        role: "Sponsor allowlist",
        summary:
            "Two-step Ownable allowlist of verified sponsors. TrialManager requires isVerifiedSponsor(msg.sender) before trial creation.",
        keyFunctions: ["addSponsor(address)", "removeSponsor(address)", "isVerifiedSponsor(address)"],
    },
    {
        id: "07",
        name: "EncryptedConsentGate.sol",
        accent: "violet",
        role: "Consent + eligibility gate",
        summary:
            "Combines EligibilityEngine results with ConsentManager active consent before sensitive downstream actions (encrypted gate on ebool).",
        keyFunctions: ["computeGate(...)", "computeGateWithActiveConsent(...)", "verifyGatePassed(...)"],
        related: ["EligibilityEngine", "ConsentManager"],
    },
    {
        id: "08",
        name: "EncryptedScoreLeaderboard.sol",
        accent: "violet",
        role: "Encrypted rankings",
        summary:
            "Aggregates encrypted scores from EligibilityEngine for leaderboard-style views without revealing plaintext rankings on-chain.",
        keyFunctions: ["addApplicant(trialId, nullifier)", "compareApplicants(...)", "batchCompare(...)"],
        related: ["EligibilityEngine"],
    },
    {
        id: "09",
        name: "SponsorIncentiveVault.sol",
        accent: "purple",
        role: "Escrow & payouts",
        summary:
            "Trial incentive escrow, participant registration, and phased reward distribution coordinated with TrialMilestoneManager and automation.",
        keyFunctions: [
            "fundTrial(...)",
            "registerAnonymousParticipant(...)",
            "claimParticipantRewards(..., encryptedUnits, inputProof)",
            "distributePartial(...)",
        ],
        related: ["TrialMilestoneManager", "MedVaultAutomation", "StakingManager"],
    },
    {
        id: "10",
        name: "TrialMilestoneManager.sol",
        accent: "emerald",
        role: "Milestone scheduling",
        summary:
            "Tracks trial milestones and participant progress; enforces participant checks before payouts (audit H-4).",
        keyFunctions: ["defineMilestones(...)", "markMilestoneComplete(...)"],
        related: ["TrialManager", "SponsorIncentiveVault"],
    },
    {
        id: "11",
        name: "StakingManager.sol",
        accent: "emerald",
        role: "Private yield",
        summary:
            "Dual staking paths: public Aave V3 stake/unstake (amounts visible) and confidential stakeFromConfidential / private unstake (encrypted cETH ledger, no Aave exit).",
        keyFunctions: [
            "stake()",
            "stakeFromConfidential(encryptedUnits, inputProof)",
            "requestPrivateUnstake / completePrivateUnstake",
            "requestPublicUnstake / completePublicUnstake",
            "getEncryptedTotalStaked(address)",
        ],
        related: ["ConfidentialETH"],
    },
    {
        id: "12",
        name: "ConfidentialETH.sol",
        accent: "blue",
        role: "Encrypted ETH wrapper",
        summary:
            "Encrypted ETH wrapper (euint64 balances, UNIT_SCALE = 1e12 wei per unit). Encrypted requestWithdraw / requestWithdrawTo staging, two-phase KMS completion, EIP-712 completePublicExit to stealth recipients.",
        keyFunctions: [
            "deposit() / depositFor()",
            "requestWithdraw(encryptedUnits, inputProof)",
            "requestWithdrawTo(user, dest, encryptedUnits, inputProof)",
            "revealWithdrawAmount / completeWithdraw",
            "completePublicExit (EIP-712 + relayer)",
            "transferEncrypted(from, to, amount)",
        ],
    },
    {
        id: "13",
        name: "MedVaultAutomation.sol",
        accent: "rose",
        role: "Chainlink Automation",
        summary:
            "AutomationCompatibleInterface: checkUpkeep scans pending milestone payouts; performUpkeep triggers vault distribution.",
        keyFunctions: ["checkUpkeep(bytes)", "performUpkeep(bytes)"],
        related: ["SponsorIncentiveVault"],
    },
    {
        id: "14",
        name: "DataAccessLog.sol",
        accent: "amber",
        role: "Audit trail",
        summary:
            "Authorized loggers only. Records anonymized keccak256 hashes for registration, eligibility, consent, status, and reward events.",
        keyFunctions: ["log(ActionType, trialId, hash)", "authorizeLogger(address)"],
    },
];

export const PROTOCOL_OPTIONAL_CONTRACTS: ProtocolContractEntry[] = [
    {
        id: "ZK",
        name: "HonkVerifier.sol",
        accent: "rose",
        role: "Noir / Honk attestation",
        summary:
            "On-chain verifier for eligibility_proof compliance seal (16 public inputs). Binds Semaphore nullifier and Zama FHE stage handle. Build with npm run build:circuit before deployment.",
        keyFunctions: ["verify(bytes proof, bytes32[] publicInputs)"],
        related: ["EligibilityEngine"],
    },
];

export const CONTRACT_INTERACTION_ROWS = [
    {
        caller: "MedVaultRegistry",
        callee: "AnonymousPatientRegistry, EligibilityEngine",
        purpose: "Register profiles; stage/finalize anonymous eligibility",
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
        caller: "ConsentManager / MedVaultRegistry / EligibilityEngine",
        callee: "DataAccessLog",
        purpose: "Immutable audit entries",
    },
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
