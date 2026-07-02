// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./AnonymousPatientRegistry.sol";
import "./TrialManager.sol";
import "./ConsentManager.sol";
import "./DataAccessLog.sol";
import "./EncryptedConsentGate.sol";
import "./PatientDocumentStore.sol";
import {EligibilityComputeLib} from "./lib/EligibilityComputeLib.sol";
import {EligibilityProofLib} from "./lib/EligibilityProofLib.sol";
import {FheAclEpochLib} from "./lib/FheAclEpochLib.sol";

/**
 * @dev Plaintext attestation: HonkVerifier.sol (circuits/eligibility_plaintext).
 *      Encrypted attestation: HonkVerifierEncrypted.sol (circuits/eligibility_encrypted).
 *      Regenerate both with `npm run build:circuit` whenever circuits change.
 */
interface IHonkVerifier {
    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}

interface IAnonymousPatientRegistry {
    struct EncryptedPatient {
        euint8 age;
        ebool gender;
        euint16 weight;
        euint8 height;
        ebool hasDiabetes;
        euint16 hbLevel;
        ebool isSmoker;
        ebool hasHypertension;
        bytes32 profileCommitment;
        bool exists;
    }
    function getPatient(uint256 _commitment) external returns (EncryptedPatient memory);
    function getCachedPatientFields(uint256 _commitment) external returns (EncryptedPatient memory);
    function getProfileCommitment(uint256 _commitment) external view returns (bytes32);
}

interface ITrialManagerExtended {
    struct Trial {
        string name;
        string phase;
        string location;
        string compensation;
        address sponsor;
        bool active;
        uint8 minAge;
        uint8 maxAge;
        bool requiresDiabetes;
        uint16 minHb;
        uint8 genderRequirement;
        uint8 minHeight;
        uint16 maxWeight;
        bool requiresNonSmoker;
        bool requiresNormalBP;
        uint256 endTime;
        bool encryptedCriteria;
    }
    struct EncryptedCriteria {
        euint8 minAge;
        euint8 maxAge;
        ebool requiresDiabetes;
        euint16 minHb;
        euint8 genderRequirement;
        euint8 minHeight;
        euint16 maxWeight;
        ebool requiresNonSmoker;
        ebool requiresNormalBP;
    }
    function getTrial(uint256 _trialId) external view returns (Trial memory);
    function getEncryptedCriteria(uint256 _trialId) external view returns (EncryptedCriteria memory);
}

interface IEncryptedScoreLeaderboard {
    function addToAggregate(uint256 _trialId, uint256 _nullifier) external;
    function addApplicant(uint256 _trialId, uint256 _nullifier) external;
}

// Anonymous apply: stage FHE → Noir proof finalize (no on-chain KMS decrypt).
interface IEligibilityEngine {
    enum ApplicationStatus { None, Pending, Accepted, Rejected }
    function stageAnonymousEligibility(
        uint256 _commitment,
        uint256 _trialId,
        uint256 _nullifier,
        address _permitRecipient
    ) external returns (bytes32 finalCt);
    function finalizeAnonymousEligibilityWithProof(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (ebool);
    function cancelStagedAnonymousEligibility(uint256 _nullifier, uint256 _trialId, address _permitRecipient) external;
    function updateAnonymousApplicationStatus(
        uint256 _trialId,
        uint256 _nullifier,
        ApplicationStatus _status
    ) external;
}

/**
 * @title EligibilityEngine
 * @notice Performs privacy-preserving eligibility computation with expanded medical fields
 * @dev Supports both wallet-based (legacy) and anonymous (Semaphore-based) eligibility checks
 */
contract EligibilityEngine is ZamaEthereumConfig {
    // Anonymous architecture: commitment -> data
    IAnonymousPatientRegistry public patientRegistry;
    // Legacy support: address -> data (optional, for backwards compatibility)
    address public legacyPatientRegistry;

    TrialManager public trialManager;
    /// @dev Eligibility paths MUST NOT read raw `encryptedConsent`; use EncryptedConsentGate
    ///      `computeGateWithActiveConsent` → ConsentManager.getActiveConsent (epoch-gated).
    ConsentManager public consentManager;
    DataAccessLog public dataAccessLog;
    EncryptedConsentGate public consentGate; // Zama FHE: Optional consent gate for FHE composition
    address public scoreLeaderboard; // EncryptedScoreLeaderboard — FHE.allow on persisted scores
    address public sponsorIncentiveVault;
    PatientDocumentStore public patientDocumentStore;
    address public automationContract;
    address public owner;
    address public pendingOwner; // FINDING 11: Two-step ownership transfer
    address public authorizedRegistry;

    /// @notice L-6: Timelock before changing PHI reader / trusted contract addresses.
    uint256 public constant READER_CHANGE_DELAY = 6 hours;
    mapping(bytes32 => address) public pendingReaderChanges;
    mapping(bytes32 => uint256) public readerChangeEta;
    FheAclEpochLib.EpochState private _aclEpoch;
    address public pendingDataAccessLog;
    uint256 public dataAccessLogChangeEta;

    // ── Noir / HonkVerifier integration ──────────────────────────────────────
    IHonkVerifier public eligibilityVerifier;
    IHonkVerifier public eligibilityVerifierEncrypted;

    /// @notice Public input count for eligibility_plaintext attestation circuit.
    uint256 public constant ELIGIBILITY_PUBLIC_INPUT_COUNT = 25;

    /// @notice Public input count for eligibility_encrypted attestation circuit.
    uint256 public constant ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT = 15;

    /// @notice Versioned criteria schema hash (field-safe: keccak mod BN254 scalar field).
    bytes32 public constant CRITERIA_SCHEMA_HASH = bytes32(
        uint256(keccak256("medvault.eligibility.criteria.v1")) % 21888242871839275222246405745257275088548364400416034343698204186575808495617
    );

    /// @notice Document binding schema hash for hybrid IPFS + FHE storage attestation.
    bytes32 public constant DOC_SCHEMA_HASH = bytes32(
        uint256(keccak256("medvault.document.v1")) % 21888242871839275222246405745257275088548364400416034343698204186575808495617
    );

    // nullifier => trialId => whether a valid Noir attestation seal was recorded (audit-only after P2; not authorization)
    mapping(uint256 => mapping(uint256 => bool)) public noirVerifiedResults;

    // nullifier => trialId => attestation receipt fields (no PHI)
    mapping(uint256 => mapping(uint256 => bytes32)) public noirResultHashes;
    mapping(uint256 => mapping(uint256 => bytes32)) public attestationProfileCommitments;
    mapping(uint256 => mapping(uint256 => bytes32)) public attestationFheStageHashes;
    mapping(uint256 => mapping(uint256 => bytes32)) public attestationCriteriaSchemaHashes;

    struct AttestationReceipt {
        bool verified;
        bytes32 resultHash;
        bytes32 profileCommitment;
        bytes32 criteriaSchemaHash;
        bytes32 fheStageHash;
    }

    enum ApplicationStatus { None, Pending, Accepted, Rejected }

    enum SilentApplyOutcome { None, Accepted, SilentRejected }

    struct Application {
        ApplicationStatus status;
        bytes encryptedMessage;
    }

    // Legacy: address-based results
    // AUDIT-LOW: demoted from public to internal so the auto-generated getter
    // no longer exposes ciphertext handles to arbitrary readers. ACL still
    // controls decryption, but exposing handles freely is unnecessary surface.
    mapping(address => mapping(uint256 => ebool)) internal encryptedResults;
    mapping(address => mapping(uint256 => euint8)) internal encryptedScores;
    mapping(uint256 => mapping(address => Application)) internal applications;
    mapping(uint256 => address[]) internal trialAppliedPatients;

    // Anonymous: nullifier × trialId keyed results (scope must match trialId per Semaphore proof)
    mapping(uint256 => mapping(uint256 => ebool)) internal anonymousResults;
    mapping(uint256 => mapping(uint256 => euint8)) internal anonymousScores;

    // Anonymous application tracking by nullifier
    mapping(uint256 => mapping(uint256 => ApplicationStatus)) public anonymousApplications;

    /// @notice Silent apply outcome per nullifier × trial (Plan 03 — no on-chain plaintext eligibility bit).
    mapping(uint256 => mapping(uint256 => SilentApplyOutcome)) public silentApplyOutcome;

    /// @notice Application identity attestation accepted (not medical eligibility — vault uses FHE `anonymousResults`).
    mapping(uint256 => mapping(uint256 => bool)) public anonymousApplicationAccepted;

    // Tracks which address has decrypt rights per nullifier × trialId
    mapping(uint256 => mapping(uint256 => address)) private _decryptPermitHolder;

    /// @notice M-2: Wallet that granted consent, bound to nullifier at finalize (not caller-supplied at gate time).
    mapping(uint256 => mapping(uint256 => address)) private _consentWalletForNullifier;

    /// @notice Staged FHE eligibility awaiting Noir proof finalize (encrypted, no public KMS decrypt).
    struct PendingAnonymous {
        bytes32 finalCt;
        bytes32 scoreCt;
        address permitRecipient;
        uint256 timestamp;
        uint256 stagedCommitment;
    }

    mapping(uint256 => mapping(uint256 => PendingAnonymous)) internal pendingAnonymousEligibility;

    event AnonymousEligibilityStaged(uint256 indexed nullifier, uint256 indexed trialId, bytes32 finalCt);
    event AnonymousEligibilityStageCancelled(uint256 indexed nullifier, uint256 indexed trialId);

    /// @notice Indexer hook: encrypted euint8 propensity score is persisted for anonymous flow (no score plaintext).
    event AnonymousEncryptedPropensityCommitted(uint256 indexed nullifier, uint256 indexed trialId);
    event ScoreLeaderboardApplicantFailed(uint256 indexed trialId, uint256 indexed nullifier);
    event ScoreLeaderboardAggregateFailed(uint256 indexed trialId, uint256 indexed nullifier);

    event EligibilityComputed(address indexed patient, uint256 indexed trialId);
    event EligibilityScoreComputed(address indexed patient, uint256 indexed trialId);
    event AppliedToTrial(address indexed patient, uint256 indexed trialId);
    event ApplicationStatusUpdated(address indexed patient, uint256 indexed trialId, ApplicationStatus status, bytes message);
    event AnonymousApplicationStatusUpdated(uint256 indexed nullifier, uint256 indexed trialId, ApplicationStatus status);
    event DocumentSponsorAuthorizeSkipped(uint256 indexed nullifier, uint256 indexed trialId);
    /// @notice Emitted on finalize (accepted or silent-rejected) — no plaintext eligibility bit.
    event SilentApply(uint256 indexed nullifier, uint256 indexed trialId);
    event OwnershipProposed(address indexed proposedOwner); // FINDING 11
    event OwnershipAccepted(address indexed newOwner); // FINDING 11
    event AuthorizedReaderChanged(bytes32 indexed role, address oldAddr, address newAddr);

    /// @notice Emitted when a Zama FHE match is sealed with a Noir compliance attestation.
    event EligibilityProofVerified(
        uint256 indexed nullifier,
        uint256 indexed trialId,
        bytes32 resultHash,
        bytes32 fheStageHash,
        bytes32 criteriaSchemaHash,
        bool eligible
    );

    constructor(address _registry, address _trialManager, address _consentManager) {
        require(_registry != address(0) && _trialManager != address(0) && _consentManager != address(0), "Zero address");
        owner = msg.sender;
        patientRegistry = IAnonymousPatientRegistry(_registry);
        trialManager = TrialManager(_trialManager);
        consentManager = ConsentManager(_consentManager);
    }

    /**
     * @notice Set the legacy patient registry (for backwards compatibility)
     * @param _legacy Address of the legacy PatientRegistry
     */
    function setLegacyPatientRegistry(address _legacy) external onlyOwner {
        legacyPatientRegistry = _legacy;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // FINDING 11: Two-step ownership transfer
    function proposeOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        pendingOwner = _newOwner;
        emit OwnershipProposed(_newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not proposed owner");
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipAccepted(owner);
    }

    function setAutomationContract(address _automation) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function setAuthorizedRegistry(address _registry) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function setConsentGate(address _gate) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function setScoreLeaderboard(address _leaderboard) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function setSponsorIncentiveVault(address _vault) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function scheduleAuthorizedReader(bytes32 _role, address _newAddr) external onlyOwner {
        require(_newAddr != address(0), "Zero address");
        pendingReaderChanges[_role] = _newAddr;
        readerChangeEta[_role] = block.timestamp + READER_CHANGE_DELAY;
    }

    function cancelAuthorizedReaderSchedule(bytes32 _role) external onlyOwner {
        readerChangeEta[_role] = 0;
        pendingReaderChanges[_role] = address(0);
    }

    function applyAuthorizedReader(bytes32 _role) external onlyOwner {
        require(readerChangeEta[_role] != 0 && block.timestamp >= readerChangeEta[_role], "Timelock active");
        address newAddr = pendingReaderChanges[_role];
        readerChangeEta[_role] = 0;
        pendingReaderChanges[_role] = address(0);

        if (_role == keccak256("automation")) {
            emit AuthorizedReaderChanged(_role, automationContract, newAddr);
            automationContract = newAddr;
        } else if (_role == keccak256("authorizedRegistry")) {
            emit AuthorizedReaderChanged(_role, authorizedRegistry, newAddr);
            authorizedRegistry = newAddr;
        } else if (_role == keccak256("consentGate")) {
            emit AuthorizedReaderChanged(_role, address(consentGate), newAddr);
            consentGate = EncryptedConsentGate(newAddr);
        } else if (_role == keccak256("scoreLeaderboard")) {
            emit AuthorizedReaderChanged(_role, scoreLeaderboard, newAddr);
            scoreLeaderboard = newAddr;
        } else if (_role == keccak256("sponsorIncentiveVault")) {
            emit AuthorizedReaderChanged(_role, sponsorIncentiveVault, newAddr);
            sponsorIncentiveVault = newAddr;
        } else if (_role == keccak256("eligibilityVerifier")) {
            emit AuthorizedReaderChanged(_role, address(eligibilityVerifier), newAddr);
            eligibilityVerifier = IHonkVerifier(newAddr);
        } else if (_role == keccak256("eligibilityVerifierEncrypted")) {
            emit AuthorizedReaderChanged(_role, address(eligibilityVerifierEncrypted), newAddr);
            eligibilityVerifierEncrypted = IHonkVerifier(newAddr);
        } else if (_role == keccak256("patientDocumentStore")) {
            emit AuthorizedReaderChanged(_role, address(patientDocumentStore), newAddr);
            patientDocumentStore = PatientDocumentStore(newAddr);
        } else {
            revert("Unknown reader role");
        }
    }

    function rotateTrustedContract(uint8 kind, address newConsumer) external onlyOwner {
        require(newConsumer != address(0), "Zero address");
        FheAclEpochLib.rotateKind(_aclEpoch, kind, newConsumer);
    }

    function aclEpochForKind(uint8 kind) external view returns (uint40) {
        return FheAclEpochLib.currentEpoch(_aclEpoch, kind);
    }

    function _recordAclGrant(bytes32 handle, address consumer, FheAclEpochLib.GrantKind kind) private {
        FheAclEpochLib.recordGrant(_aclEpoch, handle, consumer, uint8(kind));
    }

    function setDataAccessLog(address _log) external onlyOwner {
        revert("Use scheduleDataAccessLog + applyDataAccessLog");
    }

    function scheduleDataAccessLog(address _log) external onlyOwner {
        require(_log != address(0), "Zero address");
        pendingDataAccessLog = _log;
        dataAccessLogChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    function applyDataAccessLog() external onlyOwner {
        require(
            dataAccessLogChangeEta != 0 && block.timestamp >= dataAccessLogChangeEta,
            "Timelock active"
        );
        dataAccessLog = DataAccessLog(pendingDataAccessLog);
        dataAccessLogChangeEta = 0;
        pendingDataAccessLog = address(0);
    }

    /**
     * @notice Restricted lookup for permit holder — not a public deanonymization vector.
     */
    uint256 public constant STAGING_TTL = 7 days;

    function getDecryptPermitHolder(uint256 _nullifier, uint256 _trialId) external view returns (address) {
        address holder = _decryptPermitHolder[_nullifier][_trialId];
        if (holder == address(0)) {
            holder = pendingAnonymousEligibility[_nullifier][_trialId].permitRecipient;
        }
        require(
            msg.sender == holder ||
                msg.sender == authorizedRegistry ||
                msg.sender == sponsorIncentiveVault ||
                msg.sender == scoreLeaderboard ||
                msg.sender == address(consentGate) ||
                msg.sender == address(patientDocumentStore) ||
                msg.sender == owner,
            "Not authorized"
        );
        return holder;
    }

    /// @notice M-2: Consent-granting wallet bound to this nullifier at apply finalize.
    function getConsentWalletForNullifier(uint256 _nullifier, uint256 _trialId) external view returns (address) {
        require(
            msg.sender == address(consentGate) ||
            msg.sender == authorizedRegistry ||
            msg.sender == owner,
            "Not authorized"
        );
        return _consentWalletForNullifier[_nullifier][_trialId];
    }

    function _requireTrialOpen(TrialManager.Trial memory trial) internal view {
        EligibilityProofLib.requireTrialOpen(trial);
    }

    /**
     * @notice Public echo of encrypted criteria binding hash for Noir proof generation.
     * @dev Patients cannot read encrypted criteria handles; they fetch this hash and supply
     *      it as public input 7 with criteria_mode=1 in the attestation circuit.
     */
    function encryptedCriteriaBindingHash(uint256 _trialId) external view returns (bytes32) {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(trial.encryptedCriteria, "Trial does not use encrypted criteria");
        return EligibilityProofLib.encryptedCriteriaBindingHash(address(trialManager), _trialId);
    }

    /**
     * @notice Set the HonkVerifier contract(s) used to verify Noir eligibility proofs.
     * @dev Deploy HonkVerifier + HonkVerifierEncrypted (scripts/deploy.ts or deploy-verifier.ts),
     *      then wire via scheduleAuthorizedReader roles eligibilityVerifier / eligibilityVerifierEncrypted.
     *      Regenerate verifiers with `npm run build:circuit` after circuit changes.
     */
    function setEligibilityVerifier(address _verifier) external onlyOwner {
        revert("Use scheduleAuthorizedReader + applyAuthorizedReader");
    }

    function attestationReceipt(
        uint256 _nullifier,
        uint256 _trialId
    ) external view returns (AttestationReceipt memory) {
        return AttestationReceipt({
            verified: noirVerifiedResults[_nullifier][_trialId],
            resultHash: noirResultHashes[_nullifier][_trialId],
            profileCommitment: attestationProfileCommitments[_nullifier][_trialId],
            criteriaSchemaHash: attestationCriteriaSchemaHashes[_nullifier][_trialId],
            fheStageHash: attestationFheStageHashes[_nullifier][_trialId]
        });
    }

    function _recordAttestation(
        uint256 _nullifier,
        uint256 _trialId,
        bytes32[] calldata _publicInputs,
        bool _encryptedMode,
        bytes32 _fheStageHash,
        bytes32 _profileCommitmentOnChain
    ) internal {
        noirVerifiedResults[_nullifier][_trialId] = true;
        if (_encryptedMode) {
            noirResultHashes[_nullifier][_trialId] = _publicInputs[2];
            attestationProfileCommitments[_nullifier][_trialId] = _profileCommitmentOnChain;
            attestationCriteriaSchemaHashes[_nullifier][_trialId] = _publicInputs[4];
        } else {
            noirResultHashes[_nullifier][_trialId] = _publicInputs[3];
            attestationProfileCommitments[_nullifier][_trialId] = _publicInputs[2];
            attestationCriteriaSchemaHashes[_nullifier][_trialId] = _publicInputs[6];
        }
        attestationFheStageHashes[_nullifier][_trialId] = _fheStageHash;
    }

    /**
     * @dev Shared Noir + trial criteria verification (mode-specific public input layout).
     * @param _commitment Semaphore commitment (on-chain profile check for plaintext mode).
     */
    function _verifyEligibilityProofCore(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs,
        uint256 _trialId,
        uint256 _nullifier,
        bytes32 _commitment,
        bytes32 _expectedFheStageHash,
        bool _encryptedMode
    ) internal view {
        EligibilityProofLib.ProofAddrs memory addrs = EligibilityProofLib.ProofAddrs({
            trialManager: address(trialManager),
            patientRegistry: address(patientRegistry),
            eligibilityVerifier: address(eligibilityVerifier),
            eligibilityVerifierEncrypted: address(eligibilityVerifierEncrypted),
            patientDocumentStore: address(patientDocumentStore)
        });
        EligibilityProofLib.verifyEligibilityProofCore(
            addrs,
            CRITERIA_SCHEMA_HASH,
            DOC_SCHEMA_HASH,
            ELIGIBILITY_PUBLIC_INPUT_COUNT,
            ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT,
            _proof,
            _publicInputs,
            _trialId,
            _nullifier,
            _commitment,
            _expectedFheStageHash,
            _encryptedMode
        );
    }

    function _persistStagedAnonymous(
        uint256 _nullifier,
        uint256 _trialId
    ) internal {
        PendingAnonymous memory pending = pendingAnonymousEligibility[_nullifier][_trialId];
        require(pending.finalCt != bytes32(0), "Nothing staged");

        ebool finalResult = ebool.wrap(pending.finalCt);
        euint8 score = euint8.wrap(pending.scoreCt);
        address permitRecipient = pending.permitRecipient;
        require(permitRecipient != address(0), "Invalid permit recipient");

        delete pendingAnonymousEligibility[_nullifier][_trialId];

        FHE.allowThis(finalResult);
        FHE.allowThis(score);
        anonymousResults[_nullifier][_trialId] = finalResult;
        anonymousScores[_nullifier][_trialId] = score;
        FHE.allow(finalResult, permitRecipient);
        FHE.allow(score, permitRecipient);
        _recordAclGrant(ebool.unwrap(finalResult), permitRecipient, FheAclEpochLib.GrantKind.PatientRegistry);
        _recordAclGrant(euint8.unwrap(score), permitRecipient, FheAclEpochLib.GrantKind.PatientRegistry);
        if (address(consentGate) != address(0)) {
            FHE.allow(finalResult, address(consentGate));
            _recordAclGrant(ebool.unwrap(finalResult), address(consentGate), FheAclEpochLib.GrantKind.ConsentManager);
        }
        if (sponsorIncentiveVault != address(0)) {
            FHE.allow(finalResult, sponsorIncentiveVault);
            _recordAclGrant(ebool.unwrap(finalResult), sponsorIncentiveVault, FheAclEpochLib.GrantKind.EligibilityEngine);
        }
        if (scoreLeaderboard != address(0)) {
            FHE.allow(score, scoreLeaderboard);
            _recordAclGrant(euint8.unwrap(score), scoreLeaderboard, FheAclEpochLib.GrantKind.ScoreLeaderboard);
            try IEncryptedScoreLeaderboard(scoreLeaderboard).addApplicant(_trialId, _nullifier) {} catch {
                emit ScoreLeaderboardApplicantFailed(_trialId, _nullifier);
            }
            try IEncryptedScoreLeaderboard(scoreLeaderboard).addToAggregate(_trialId, _nullifier) {} catch {
                emit ScoreLeaderboardAggregateFailed(_trialId, _nullifier);
            }
        }
        _decryptPermitHolder[_nullifier][_trialId] = permitRecipient;

        emit AnonymousEncryptedPropensityCommitted(_nullifier, _trialId);
    }

    function _bindConsentWallet(uint256 _nullifier, uint256 _trialId, address _consentWallet) internal {
        require(_consentWallet != address(0), "Zero consent wallet");
        require(_consentWalletForNullifier[_nullifier][_trialId] == address(0), "Consent wallet already bound");
        _consentWalletForNullifier[_nullifier][_trialId] = _consentWallet;
    }

    function _toLibPatient(
        IAnonymousPatientRegistry.EncryptedPatient memory patient
    ) internal pure returns (EligibilityComputeLib.EncryptedPatient memory) {
        return EligibilityComputeLib.EncryptedPatient({
            age: patient.age,
            gender: patient.gender,
            weight: patient.weight,
            height: patient.height,
            hasDiabetes: patient.hasDiabetes,
            hbLevel: patient.hbLevel,
            isSmoker: patient.isSmoker,
            hasHypertension: patient.hasHypertension,
            profileCommitment: patient.profileCommitment,
            exists: patient.exists
        });
    }

    function _toLibTrial(
        TrialManager.Trial memory trial
    ) internal pure returns (EligibilityComputeLib.Trial memory) {
        return EligibilityComputeLib.Trial({
            name: trial.name,
            phase: trial.phase,
            location: trial.location,
            compensation: trial.compensation,
            sponsor: trial.sponsor,
            active: trial.active,
            minAge: trial.minAge,
            maxAge: trial.maxAge,
            requiresDiabetes: trial.requiresDiabetes,
            minHb: trial.minHb,
            genderRequirement: trial.genderRequirement,
            minHeight: trial.minHeight,
            maxWeight: trial.maxWeight,
            requiresNonSmoker: trial.requiresNonSmoker,
            requiresNormalBP: trial.requiresNormalBP,
            endTime: trial.endTime,
            encryptedCriteria: trial.encryptedCriteria
        });
    }

    function _toLibCriteria(
        ITrialManagerExtended.EncryptedCriteria memory c
    ) internal pure returns (EligibilityComputeLib.EncryptedCriteria memory) {
        return EligibilityComputeLib.EncryptedCriteria({
            minAge: c.minAge,
            maxAge: c.maxAge,
            requiresDiabetes: c.requiresDiabetes,
            minHb: c.minHb,
            genderRequirement: c.genderRequirement,
            minHeight: c.minHeight,
            maxWeight: c.maxWeight,
            requiresNonSmoker: c.requiresNonSmoker,
            requiresNormalBP: c.requiresNormalBP
        });
    }

    function _computeEligibility(
        IAnonymousPatientRegistry.EncryptedPatient memory patient,
        TrialManager.Trial memory trial,
        uint256 trialId
    ) private returns (ebool finalResult, euint8 score) {
        if (trial.encryptedCriteria) {
            return _computeEligibilityEncrypted(patient, trialId, false);
        }
        return EligibilityComputeLib.computeEligibilityPlaintext(
            _toLibPatient(patient),
            _toLibTrial(trial)
        );
    }

    function _computeEligibilityEncrypted(
        IAnonymousPatientRegistry.EncryptedPatient memory patient,
        uint256 trialId,
        bool refreshCriteriaAcl
    ) internal returns (ebool finalResult, euint8 score) {
        ITrialManagerExtended.EncryptedCriteria memory c = ITrialManagerExtended(
            address(trialManager)
        ).getEncryptedCriteria(trialId);
        return EligibilityComputeLib.computeEligibilityEncrypted(
            _toLibPatient(patient),
            _toLibCriteria(c),
            refreshCriteriaAcl
        );
    }

    /**
     * @notice Sponsor updates application status and provides an encrypted message/contact info
     */
    function updateApplicationStatus(
        uint256 _trialId, 
        address _patient, 
        ApplicationStatus _status, 
        bytes calldata _message
    ) external {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == trial.sponsor, "Only sponsor can update status");
        require(trialManager.isTrialSponsorVerified(_trialId), "Sponsor no longer verified");
        require(applications[_trialId][_patient].status != ApplicationStatus.None, "No application found");
        
        applications[_trialId][_patient].status = _status;
        applications[_trialId][_patient].encryptedMessage = _message;
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.APPLICATION_STATUS_CHANGED,
                _trialId,
                keccak256(abi.encodePacked(_patient, uint8(_status), block.timestamp))
            );
        }

        emit ApplicationStatusUpdated(_patient, _trialId, _status, _message);
    }

    /**
     * @notice Sponsor updates anonymous application status using nullifier
     */
    function updateAnonymousApplicationStatus(
        uint256 _trialId,
        uint256 _nullifier,
        ApplicationStatus _status
    ) external {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == trial.sponsor || msg.sender == authorizedRegistry,
            "Only sponsor or authorized registry can update status"
        );
        if (msg.sender == trial.sponsor) {
            require(trialManager.isTrialSponsorVerified(_trialId), "Sponsor no longer verified");
        }
        if (_status == ApplicationStatus.Accepted) {
            require(msg.sender == trial.sponsor, "Only sponsor can accept");
        }
        require(anonymousApplications[_nullifier][_trialId] != ApplicationStatus.None, "No anonymous application found");

        anonymousApplications[_nullifier][_trialId] = _status;

        if (_status == ApplicationStatus.Accepted && address(patientDocumentStore) != address(0)) {
            try patientDocumentStore.authorizeSponsorOnAccept(_trialId, _nullifier) {} catch {
                emit DocumentSponsorAuthorizeSkipped(_nullifier, _trialId);
            }
        }

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.APPLICATION_STATUS_CHANGED,
                _trialId,
                keccak256(abi.encodePacked(_nullifier, uint8(_status), block.timestamp))
            );
        }

        emit AnonymousApplicationStatusUpdated(_nullifier, _trialId, _status);
    }

    /**
     * @notice Document store callback: grant sponsor ACL when document is recorded after accept.
     */
    function onDocumentRecorded(uint256 _trialId, uint256 _nullifier) external {
        require(msg.sender == address(patientDocumentStore), "Only document store");
        if (anonymousApplications[_nullifier][_trialId] == ApplicationStatus.Accepted) {
            try patientDocumentStore.authorizeSponsorOnAccept(_trialId, _nullifier) {} catch {
                emit DocumentSponsorAuthorizeSkipped(_nullifier, _trialId);
            }
        }
    }

    /**
     * @notice Phase 1: compute encrypted eligibility and stage ciphertext handles for decrypt verification.
     * @dev Patient obtains Zama FHE `decryptForTx` bundle off-chain (permitRecipient), then registry calls finalize.
     */
    function stageAnonymousEligibility(
        uint256 _commitment,
        uint256 _trialId,
        uint256 _nullifier,
        address _permitRecipient
    ) external returns (bytes32 finalCt) {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        require(_commitment != 0, "Commitment required");
        require(_permitRecipient != address(0), "Invalid permit recipient");
        require(pendingAnonymousEligibility[_nullifier][_trialId].finalCt == bytes32(0), "Already staged");

        IAnonymousPatientRegistry.EncryptedPatient memory patient = patientRegistry.getCachedPatientFields(_commitment);
        require(patient.exists, "Patient not found for this commitment");

        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        _requireTrialOpen(trial);

        (ebool finalResult, euint8 score) = _computeEligibility(patient, trial, _trialId);

        pendingAnonymousEligibility[_nullifier][_trialId] = PendingAnonymous({
            finalCt: ebool.unwrap(finalResult),
            scoreCt: euint8.unwrap(score),
            permitRecipient: _permitRecipient,
            timestamp: block.timestamp,
            stagedCommitment: _commitment
        });

        FHE.allowThis(finalResult);
        FHE.allowThis(score);
        FHE.allow(finalResult, _permitRecipient);
        FHE.allow(score, _permitRecipient);

        finalCt = ebool.unwrap(finalResult);
        emit AnonymousEligibilityStaged(_nullifier, _trialId, finalCt);
    }

    /**
     * @notice Complete staged eligibility with a Noir proof (no on-chain KMS public decrypt).
     * @dev Silent-failure: ineligible proofs finalize without revert; outcome stored encrypted-side only.
     */
    function finalizeAnonymousEligibilityWithProof(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (ebool finalResult) {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        return _finalizeAnonymousEligibilityWithProofCore(
            _commitment,
            _nullifier,
            _trialId,
            _permitRecipient,
            _consentWallet,
            _proof,
            _publicInputs
        );
    }

    function _requireStagedFinalize(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet
    ) private view returns (bytes32 stagedFheHash) {
        require(_permitRecipient != address(0), "Invalid permit recipient");
        require(_consentWallet != address(0), "Invalid consent wallet");
        require(
            pendingAnonymousEligibility[_nullifier][_trialId].finalCt != bytes32(0),
            "Nothing staged"
        );
        require(
            pendingAnonymousEligibility[_nullifier][_trialId].permitRecipient == _permitRecipient,
            "Permit recipient mismatch"
        );
        require(
            block.timestamp <=
                pendingAnonymousEligibility[_nullifier][_trialId].timestamp + STAGING_TTL,
            "Staging expired"
        );
        require(
            anonymousApplications[_nullifier][_trialId] == ApplicationStatus.None,
            "Already finalized"
        );
        require(
            silentApplyOutcome[_nullifier][_trialId] == SilentApplyOutcome.None,
            "Already finalized"
        );
        require(_commitment != 0, "Commitment required");
        require(
            pendingAnonymousEligibility[_nullifier][_trialId].stagedCommitment == _commitment,
            "Commitment mismatch"
        );
        stagedFheHash = pendingAnonymousEligibility[_nullifier][_trialId].finalCt;
    }

    function _rejectStagedFinalize(
        uint256 _nullifier,
        uint256 _trialId
    ) private returns (ebool) {
        delete pendingAnonymousEligibility[_nullifier][_trialId];
        silentApplyOutcome[_nullifier][_trialId] = SilentApplyOutcome.SilentRejected;
        anonymousApplicationAccepted[_nullifier][_trialId] = false;
        emit SilentApply(_nullifier, _trialId);
        return ebool.wrap(0);
    }

    function _acceptStagedFinalize(
        uint256 _nullifier,
        uint256 _trialId,
        address _consentWallet,
        bytes32[] calldata _publicInputs,
        bytes32 stagedFheHash,
        bool _encryptedMode,
        bytes32 _profileCommitment
    ) private returns (ebool finalResult) {
        _persistStagedAnonymous(_nullifier, _trialId);
        _bindConsentWallet(_nullifier, _trialId, _consentWallet);

        finalResult = anonymousResults[_nullifier][_trialId];
        anonymousApplications[_nullifier][_trialId] = ApplicationStatus.Pending;
        silentApplyOutcome[_nullifier][_trialId] = SilentApplyOutcome.Accepted;
        anonymousApplicationAccepted[_nullifier][_trialId] = true;

        _recordAttestation(
            _nullifier,
            _trialId,
            _publicInputs,
            _encryptedMode,
            stagedFheHash,
            _profileCommitment
        );

        if (address(dataAccessLog) != address(0)) {
            bytes32 resultHash = _encryptedMode ? _publicInputs[2] : _publicInputs[3];
            dataAccessLog.logAction(
                DataAccessLog.ActionType.ELIGIBILITY_CHECKED,
                _trialId,
                keccak256(abi.encodePacked(_nullifier, resultHash, block.timestamp, "ATTESTATION_FINALIZE"))
            );
        }

        emit EligibilityProofVerified(
            _nullifier,
            _trialId,
            _encryptedMode ? _publicInputs[2] : _publicInputs[3],
            stagedFheHash,
            _encryptedMode ? _publicInputs[4] : _publicInputs[6],
            !_encryptedMode
        );
        emit SilentApply(_nullifier, _trialId);
        emit AnonymousApplicationStatusUpdated(_nullifier, _trialId, ApplicationStatus.Pending);
    }

    function _finalizeAnonymousEligibilityWithProofCore(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) private returns (ebool finalResult) {
        bytes32 stagedFheHash = _requireStagedFinalize(
            _commitment,
            _nullifier,
            _trialId,
            _permitRecipient,
            _consentWallet
        );
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        bool encryptedMode = trial.encryptedCriteria;
        bytes32 profileCommitment = patientRegistry.getProfileCommitment(_commitment);

        _verifyEligibilityProofCore(
            _proof,
            _publicInputs,
            _trialId,
            _nullifier,
            bytes32(_commitment),
            stagedFheHash,
            encryptedMode
        );

        if (encryptedMode) {
            return _acceptStagedFinalize(
                _nullifier,
                _trialId,
                _consentWallet,
                _publicInputs,
                stagedFheHash,
                true,
                profileCommitment
            );
        }

        if (uint256(_publicInputs[4]) == 0) {
            return _rejectStagedFinalize(_nullifier, _trialId);
        }

        return _acceptStagedFinalize(
            _nullifier,
            _trialId,
            _consentWallet,
            _publicInputs,
            stagedFheHash,
            false,
            profileCommitment
        );
    }

    function _recordInlineConsent(address _consentWallet, uint256 _trialId, ebool _consent) private {
        FHE.allowThis(_consent);
        FHE.allow(_consent, address(consentManager));
        consentManager.recordConsentGrant(_consentWallet, _trialId, _consent);
    }

    /**
     * @notice Finalize staged eligibility with inlined consent grant (wallet-visible atomic path).
     * @dev Eliminates separate ConsentManager.grantConsent tx; consent wallet is public at finalize.
     */
    function finalizeAnonymousEligibilityWithConsent(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet,
        ebool _consent,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (ebool finalResult) {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        require(_consentWallet != address(0), "Invalid consent wallet");
        _recordInlineConsent(_consentWallet, _trialId, _consent);
        return _finalizeAnonymousEligibilityWithProofCore(
            _commitment,
            _nullifier,
            _trialId,
            _permitRecipient,
            _consentWallet,
            _proof,
            _publicInputs
        );
    }

    /**
     * @notice Clear staged FHE eligibility when finalize is abandoned (e.g. ineligible decrypt).
     * @dev Only callable by authorized registry after Semaphore proof verification.
     */
    function cancelStagedAnonymousEligibility(
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient
    ) external {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        require(_permitRecipient != address(0), "Invalid permit recipient");
        require(
            pendingAnonymousEligibility[_nullifier][_trialId].permitRecipient == _permitRecipient,
            "Permit recipient mismatch"
        );
        require(pendingAnonymousEligibility[_nullifier][_trialId].finalCt != bytes32(0), "Nothing staged");
        delete pendingAnonymousEligibility[_nullifier][_trialId];
        emit AnonymousEligibilityStageCancelled(_nullifier, _trialId);
    }

    // FINDING 2: Decrypt permits are granted during finalize (and score/final allows refreshed there).
    // This prevents front-running attacks where anyone could claim decrypt rights with a publicly visible commitment

    event BatchEligibilityComputed(uint256 indexed commitment, uint256 trialCount);
    event BatchEligibilityTrialChecked(uint256 indexed commitment, uint256 indexed trialId, uint256 indexed nullifier);

    mapping(uint256 => mapping(uint256 => bool)) public batchEligibilityChecked;

    /**
     * @notice Batch homomorphic eligibility for multiple trials in one authorized call.
     * @dev Returns encrypted result handles per trial; reduces on-chain tx count for discovery flows.
     */
    function checkEligibilityBatch(
        uint256 _commitment,
        uint256[] calldata _trialIds,
        uint256[] calldata _nullifiers,
        address _permitRecipient
    ) external returns (bytes32[] memory finalCts) {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        require(_permitRecipient != address(0), "Invalid permit recipient");
        require(_trialIds.length > 0 && _trialIds.length <= 16, "Invalid batch size");
        require(_trialIds.length == _nullifiers.length, "Length mismatch");

        IAnonymousPatientRegistry.EncryptedPatient memory patient = patientRegistry.getCachedPatientFields(_commitment);
        require(patient.exists, "Patient not found for this commitment");

        finalCts = new bytes32[](_trialIds.length);
        for (uint256 i = 0; i < _trialIds.length; i++) {
            uint256 trialId = _trialIds[i];
            uint256 nullifier = _nullifiers[i];
            require(!batchEligibilityChecked[_commitment][trialId], "Trial already batch-checked");
            batchEligibilityChecked[_commitment][trialId] = true;

            TrialManager.Trial memory trial = trialManager.getTrial(trialId);
            require(trial.active, "Trial is not active");
            // M-5: reject trials whose endTime has passed — previously only `active` was checked,
            // so a trial in the post-end / pre-deactivation window could still be batch-checked,
            // producing stale eligibility disclosures.
            require(trial.endTime > 0 && block.timestamp < trial.endTime, "Trial ended");

            (ebool finalResult, euint8 score) = _computeEligibility(patient, trial, trialId);
            FHE.allowThis(finalResult);
            FHE.allowThis(score);
            FHE.allow(finalResult, _permitRecipient);
            FHE.allow(score, _permitRecipient);
            if (scoreLeaderboard != address(0)) {
                FHE.allow(score, scoreLeaderboard);
            }
            finalCts[i] = ebool.unwrap(finalResult);
            emit BatchEligibilityTrialChecked(_commitment, trialId, nullifier);
        }

        emit BatchEligibilityComputed(_commitment, _trialIds.length);
    }

    /// @notice M-5: Reset the one-shot batch-check flag for a commitment/trial pair so a patient
    ///         can re-evaluate eligibility after sponsor criteria changes or profile updates.
    /// @dev Callable by the owner or the authorized registry (which relays patient intent).
    function resetBatchEligibilityCheck(uint256 _commitment, uint256 _trialId) external {
        require(msg.sender == owner || msg.sender == authorizedRegistry, "Not authorized");
        batchEligibilityChecked[_commitment][_trialId] = false;
    }

    // --- LEGACY GETTERS (address-based) ---

    function getEncryptedResult(address _patient, uint256 _trialId) external view returns (ebool) {
        require(msg.sender == _patient || msg.sender == automationContract, "Access denied");
        return encryptedResults[_patient][_trialId];
    }

    function getEncryptedScore(address _patient, uint256 _trialId) external view returns (euint8) {
        require(msg.sender == _patient || msg.sender == automationContract, "Access denied");
        return encryptedScores[_patient][_trialId];
    }

    // --- ANONYMOUS GETTERS (nullifier-based) ---

    /**
     * @notice Get encrypted eligibility result for anonymous application
     * @param _nullifier The per-trial nullifier = Poseidon([trialId, secret])
     * @param _trialId The trial ID (must match Semaphore scope)
     * @return The encrypted eligibility result
     */
    function getAnonymousResult(uint256 _nullifier, uint256 _trialId) external view returns (ebool) {
        address holder = _decryptPermitHolder[_nullifier][_trialId];
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == holder ||
            msg.sender == trial.sponsor ||
            msg.sender == scoreLeaderboard ||
            msg.sender == authorizedRegistry ||
            msg.sender == address(consentGate) ||
            msg.sender == owner,
            "Not authorized"
        );
        return anonymousResults[_nullifier][_trialId];
    }

    /**
     * @notice Get encrypted eligibility score for anonymous application
     * @param _nullifier The per-trial nullifier = Poseidon([trialId, secret])
     * @param _trialId The trial ID (must match Semaphore scope)
     * @return The encrypted eligibility score
     */
    function getAnonymousScore(uint256 _nullifier, uint256 _trialId) external view returns (euint8) {
        address holder = _decryptPermitHolder[_nullifier][_trialId];
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == holder ||
            msg.sender == trial.sponsor ||
            msg.sender == scoreLeaderboard ||
            msg.sender == authorizedRegistry ||
            msg.sender == address(consentGate) ||
            msg.sender == owner,
            "Not authorized"
        );
        return anonymousScores[_nullifier][_trialId];
    }

    /**
     * @notice Get application status by nullifier (for sponsor view)
     * @param _nullifier The nullifier hash
     * @param _trialId The trial ID
     * @return The application status
     */
    function getAnonymousApplicationStatus(uint256 _nullifier, uint256 _trialId) external view returns (ApplicationStatus) {
        return anonymousApplications[_nullifier][_trialId];
    }

    /**
     * @notice Application identity attestation gate (audit-only). Vault payout uses `getAnonymousResultForVault` + FHE.select.
     */
    function isAnonymousApplicationAccepted(uint256 _nullifier, uint256 _trialId) external view returns (bool) {
        return anonymousApplicationAccepted[_nullifier][_trialId]
            && silentApplyOutcome[_nullifier][_trialId] == SilentApplyOutcome.Accepted;
    }

    /**
     * @notice Vault-only: consume encrypted eligibility in FHE.select without extra ACL churn.
     */
    function getAnonymousResultForVault(uint256 _nullifier, uint256 _trialId) external view returns (ebool) {
        require(msg.sender == sponsorIncentiveVault, "Only vault");
        return anonymousResults[_nullifier][_trialId];
    }

}
