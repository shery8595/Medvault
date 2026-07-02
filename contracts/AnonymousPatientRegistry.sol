// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16, externalEuint8, externalEbool, externalEuint16} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./DataAccessLog.sol";
import {TestHelpers} from "./test/TestHelpers.sol";
import {FheAclEpochLib} from "./lib/FheAclEpochLib.sol";

/**
 * @title AnonymousPatientRegistry
 * @notice Stores encrypted patient profiles indexed by Semaphore commitment (not wallet address)
 * @dev This is the key link in the anonymous architecture:
 *      - Semaphore identity creates a commitment (hash of trapdoor + nullifier)
 *      - This commitment becomes the "address" for the patient's encrypted data
 *      - During anonymous applications, the commitment is passed as signal
 *      - Contract can fetch data without knowing the wallet address
 *
 *      Patient flows:
 *      1. Registration: Wallet → Semaphore commitment → Encrypted data
 *      2. Application: Semaphore proof (with commitment as signal) → Fetch data → FHE compute
 */
contract AnonymousPatientRegistry is ZamaEthereumConfig {

    uint256 private constant BN254_FIELD_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /**
     * @notice Encrypted patient profile
     * @dev All fields are Zama FHE encrypted types - never visible in plaintext on-chain
     */
    struct EncryptedPatient {
        euint8 age;              // Age in years (0-255)
        ebool gender;            // true = Male, false = Female
        euint16 weight;          // Weight in kg
        euint8 height;           // Height in cm
        ebool hasDiabetes;       // Diabetes status
        euint16 hbLevel;         // HbA1c level or similar metric
        ebool isSmoker;          // Smoking status
        ebool hasHypertension;   // Hypertension status
        bytes32 profileCommitment; // Poseidon commitment to plaintext profile (ZK-bound)
        bool exists;             // Whether this record exists
    }

    /**
     * @notice commitment => encrypted patient data
     * @dev The commitment is the Semaphore identity commitment (hash of trapdoor + nullifier)
     *      This replaces the traditional address => data mapping for anonymous access
     */
    mapping(uint256 => EncryptedPatient) private patients;

    /**
     * @notice Tracks which commitments have been registered
     * @dev HIGH-5: Private to reduce deanonymization surface area.
     *      Commitments are already public in Semaphore group, but this
     *      mapping makes enumeration easier. Keep private.
     */
    mapping(uint256 => bool) private isRegistered;

    /// @notice Commitments whose field handles have persistent `FHE.allow(eligibilityEngine)` grants.
    mapping(uint256 => bool) private patientHandlesCached;

    /// @notice Commitment to a secret profile salt (keccak256(salt)); must not be the deterministic test salt.
    mapping(uint256 => bytes32) public profileSaltCommitments;

    /**
     * @notice Authorized contract that can register patients (MedVaultRegistry)
     */
    address public authorizedRegistry;

    /**
     * @notice Authorized contract that can read patient data (EligibilityEngine)
     */
    address public authorizedEngine;

    /**
     * @notice Data access logging contract
     */
    DataAccessLog public dataAccessLog;

    address public owner;
    // AUDIT-MED: Add two-step ownership transfer (previously no transfer function existed).
    address public pendingOwner;

    // H-3: Track number of registered patients to prevent engine changes after registration
    uint256 private _patientCount;

    FheAclEpochLib.EpochState private _aclEpoch;

    /// @dev Cleartext profile seeding for Hardhat unit tests only.
    bool public testHelpersEnabled;
    bool public pendingTestHelpersValue;
    uint256 public testHelpersChangeEta;
    uint256 public constant TEST_HELPERS_CHANGE_DELAY = 6 hours;

    /**
     * @notice Emitted when a patient registers (blinded commitment only — not the raw Semaphore commitment).
     * @param blindedCommitment keccak256(commitment, timestamp) — safe for indexed logs
     * @param timestamp Registration time
     */
    event PatientRegistered(bytes32 blindedCommitment, uint256 timestamp);

    /**
     * @notice Emitted when patient data is accessed (aggregate signal only; no commitment in logs).
     */
    event ProfileAccessed(address indexed accessor, uint256 timestamp);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorizedRegistry() {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        _;
    }

    modifier onlyAuthorizedEngine() {
        require(msg.sender == authorizedEngine, "Only authorized engine");
        _;
    }

    modifier onlyTestHelpers() {
        TestHelpers.requireEnabled(testHelpersEnabled);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice AUDIT-MED: Two-step ownership transfer.
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

    /**
     * @notice Set the authorized registry contract (MedVaultRegistry)
     * @param _registry Address of the MedVaultRegistry contract
     */
    function setAuthorizedRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Zero address");
        require(_patientCount == 0, "Cannot change registry after registrations");
        authorizedRegistry = _registry;
    }

    /**
     * @notice Set the authorized engine contract (EligibilityEngine)
     * @param _engine Address of the EligibilityEngine contract
     * @dev H-3: Cannot change engine after patients have registered - would break FHE permissions
     */
    function setAuthorizedEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Zero address");
        // H-3: Prevent changing engine after registrations to ensure consistent FHE permissions
        require(_patientCount == 0, "Cannot change engine after registrations");
        authorizedEngine = _engine;
    }

    /// @notice MEDIUM-1: bump ACL epoch when rotating trusted consumers (off-chain re-grant required).
    function rotateTrustedContract(uint8 kind, address newConsumer) external onlyOwner {
        require(newConsumer != address(0), "Zero address");
        FheAclEpochLib.rotateKind(_aclEpoch, kind, newConsumer);
    }

    function aclEpochForKind(uint8 kind) external view returns (uint40) {
        return FheAclEpochLib.currentEpoch(_aclEpoch, kind);
    }

    function _recordEngineAcl(bytes32 handle) private {
        if (authorizedEngine != address(0)) {
            FheAclEpochLib.recordGrant(
                _aclEpoch,
                handle,
                authorizedEngine,
                uint8(FheAclEpochLib.GrantKind.EligibilityEngine)
            );
        }
    }

    function _recordPermitAcl(bytes32 handle, address permitRecipient) private {
        FheAclEpochLib.recordGrant(
            _aclEpoch,
            handle,
            permitRecipient,
            uint8(FheAclEpochLib.GrantKind.PatientRegistry)
        );
    }

    /**
     * @notice Set the data access log contract
     * @param _log Address of the DataAccessLog contract
     */
    function setDataAccessLog(address _log) external onlyOwner {
        require(_log != address(0), "Zero address");
        dataAccessLog = DataAccessLog(_log);
    }

    function _deterministicProfileSalt(uint256 _commitment) internal view returns (uint256) {
        uint256 raw = uint256(keccak256(abi.encodePacked(_commitment, block.chainid))) % BN254_FIELD_ORDER;
        return raw == 0 ? 1 : raw;
    }

    function _forbiddenProfileSaltCommitment(uint256 _commitment) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(_deterministicProfileSalt(_commitment)));
    }

    function _requireValidProfileSaltCommitment(
        uint256 _commitment,
        bytes32 _profileSaltCommitment
    ) internal view {
        require(_profileSaltCommitment != bytes32(0), "Zero salt commitment");
        require(
            _profileSaltCommitment != _forbiddenProfileSaltCommitment(_commitment),
            "Forbidden deterministic salt"
        );
    }

    function scheduleTestHelpersEnabled(bool enabled) external onlyOwner {
        pendingTestHelpersValue = enabled;
        testHelpersChangeEta = block.timestamp + TEST_HELPERS_CHANGE_DELAY;
    }

    function applyTestHelpersEnabled() external onlyOwner {
        require(
            testHelpersChangeEta != 0 && block.timestamp >= testHelpersChangeEta,
            "Timelock active"
        );
        testHelpersEnabled = pendingTestHelpersValue;
        testHelpersChangeEta = 0;
    }

    /**
     * @notice Store patient from cleartext fields (Hardhat test harness only — no Poseidon).
     * @dev Called by AnonymousPatientRegistryTestHarness after on-chain Poseidon commitment.
     */
    function _storeCleartextPatientRegistration(
        uint256 _commitment,
        address _permitRecipient,
        bytes32 profileCommitment,
        uint8 age,
        bool gender,
        uint16 weight,
        uint8 height,
        bool hasDiabetes,
        uint16 hbLevel,
        bool isSmoker,
        bool hasHypertension
    ) internal {
        require(authorizedEngine != address(0), "Engine not set before registration");
        require(_permitRecipient != address(0), "Zero permit recipient");
        require(!isRegistered[_commitment], "Commitment already registered");

        euint8 encAge = FHE.asEuint8(age);
        ebool encGender = FHE.asEbool(gender);
        euint16 encWeight = FHE.asEuint16(weight);
        euint8 encHeight = FHE.asEuint8(height);
        ebool encDiabetes = FHE.asEbool(hasDiabetes);
        euint16 encHb = FHE.asEuint16(hbLevel);
        ebool encSmoker = FHE.asEbool(isSmoker);
        ebool encHypertension = FHE.asEbool(hasHypertension);

        FHE.allowThis(encAge);
        FHE.allowThis(encGender);
        FHE.allowThis(encWeight);
        FHE.allowThis(encHeight);
        FHE.allowThis(encDiabetes);
        FHE.allowThis(encHb);
        FHE.allowThis(encSmoker);
        FHE.allowThis(encHypertension);

        FHE.allow(encAge, _permitRecipient);
        FHE.allow(encGender, _permitRecipient);
        FHE.allow(encWeight, _permitRecipient);
        FHE.allow(encHeight, _permitRecipient);
        FHE.allow(encDiabetes, _permitRecipient);
        FHE.allow(encHb, _permitRecipient);
        FHE.allow(encSmoker, _permitRecipient);
        FHE.allow(encHypertension, _permitRecipient);

        if (authorizedEngine != address(0)) {
            FHE.allow(encAge, authorizedEngine);
            FHE.allow(encGender, authorizedEngine);
            FHE.allow(encWeight, authorizedEngine);
            FHE.allow(encHeight, authorizedEngine);
            FHE.allow(encDiabetes, authorizedEngine);
            FHE.allow(encHb, authorizedEngine);
            FHE.allow(encSmoker, authorizedEngine);
            FHE.allow(encHypertension, authorizedEngine);
        }

        patients[_commitment] = EncryptedPatient({
            age: encAge,
            gender: encGender,
            weight: encWeight,
            height: encHeight,
            hasDiabetes: encDiabetes,
            hbLevel: encHb,
            isSmoker: encSmoker,
            hasHypertension: encHypertension,
            profileCommitment: profileCommitment,
            exists: true
        });

        isRegistered[_commitment] = true;
        patientHandlesCached[_commitment] = true;
        _patientCount++;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PROFILE_SUBMISSION,
                0,
                keccak256(abi.encodePacked(_commitment, block.timestamp, "TEST_HELPER"))
            );
        }

        emit PatientRegistered(
            keccak256(abi.encodePacked(_commitment, block.timestamp)),
            block.timestamp
        );
    }

    /**
     * @notice Register a new patient with their encrypted data
     * @dev Only callable by the authorized MedVaultRegistry
     *      The commitment is the Semaphore identity commitment
     *
     * @param _commitment The Semaphore identity commitment
     * @param _permitRecipient Address to grant FHE decrypt rights (MUST be the ephemeral
     *        address derived from the Semaphore identity secret, NOT the wallet address).
     *        This keeps the registry wallet-agnostic: no wallet address is ever stored here.
     * @param _age Encrypted age
     * @param _gender Encrypted gender
     * @param _weight Encrypted weight
     * @param _height Encrypted height
     * @param _hasDiabetes Encrypted diabetes status
     * @param _hbLevel Encrypted Hb level
     * @param _isSmoker Encrypted smoking status
     * @param _hasHypertension Encrypted hypertension status
     */
    function registerPatient(
        uint256 _commitment,
        address _permitRecipient,
        bytes32 _profileCommitment,
        bytes32 _profileSaltCommitment,
        externalEuint8 _age,
        externalEbool _gender,
        externalEuint16 _weight,
        externalEuint8 _height,
        externalEbool _hasDiabetes,
        externalEuint16 _hbLevel,
        externalEbool _isSmoker,
        externalEbool _hasHypertension,
        bytes calldata inputProof
    ) external onlyAuthorizedRegistry {
        // AUDIT-FIX-MH-1: block registration until engine is set — prevents front-run brick of setAuthorizedEngine.
        require(authorizedEngine != address(0), "Engine not set before registration");
        require(_permitRecipient != address(0), "Zero permit recipient");
        require(_profileCommitment != bytes32(0), "Zero profile commitment");
        require(!isRegistered[_commitment], "Commitment already registered");
        _requireValidProfileSaltCommitment(_commitment, _profileSaltCommitment);

        euint8 age = FHE.fromExternal(_age, inputProof);
        ebool gender = FHE.fromExternal(_gender, inputProof);
        euint16 weight = FHE.fromExternal(_weight, inputProof);
        euint8 height = FHE.fromExternal(_height, inputProof);
        ebool hasDiabetes = FHE.fromExternal(_hasDiabetes, inputProof);
        euint16 hbLevel = FHE.fromExternal(_hbLevel, inputProof);
        ebool isSmoker = FHE.fromExternal(_isSmoker, inputProof);
        ebool hasHypertension = FHE.fromExternal(_hasHypertension, inputProof);

        // Allow contract to perform operations on this data
        FHE.allowThis(age);
        FHE.allowThis(gender);
        FHE.allowThis(weight);
        FHE.allowThis(height);
        FHE.allowThis(hasDiabetes);
        FHE.allowThis(hbLevel);
        FHE.allowThis(isSmoker);
        FHE.allowThis(hasHypertension);

        // Allow _permitRecipient (the patient's EPHEMERAL address, derived from identity
        // secret — NOT the wallet address) to decrypt their data via decryptForView.
        // This keeps the FHE ACL wallet-agnostic: observers cannot link these handles
        // to any wallet by inspecting the ACL.
        FHE.allow(age, _permitRecipient);
        FHE.allow(gender, _permitRecipient);
        FHE.allow(weight, _permitRecipient);
        FHE.allow(height, _permitRecipient);
        FHE.allow(hasDiabetes, _permitRecipient);
        FHE.allow(hbLevel, _permitRecipient);
        FHE.allow(isSmoker, _permitRecipient);
        FHE.allow(hasHypertension, _permitRecipient);
        _recordPermitAcl(euint8.unwrap(age), _permitRecipient);
        _recordPermitAcl(ebool.unwrap(gender), _permitRecipient);
        _recordPermitAcl(euint16.unwrap(weight), _permitRecipient);
        _recordPermitAcl(euint8.unwrap(height), _permitRecipient);
        _recordPermitAcl(ebool.unwrap(hasDiabetes), _permitRecipient);
        _recordPermitAcl(euint16.unwrap(hbLevel), _permitRecipient);
        _recordPermitAcl(ebool.unwrap(isSmoker), _permitRecipient);
        _recordPermitAcl(ebool.unwrap(hasHypertension), _permitRecipient);

        // Allow authorized engine to access this data
        if (authorizedEngine != address(0)) {
            FHE.allow(age, authorizedEngine);
            FHE.allow(gender, authorizedEngine);
            FHE.allow(weight, authorizedEngine);
            FHE.allow(height, authorizedEngine);
            FHE.allow(hasDiabetes, authorizedEngine);
            FHE.allow(hbLevel, authorizedEngine);
            FHE.allow(isSmoker, authorizedEngine);
            FHE.allow(hasHypertension, authorizedEngine);
            _recordEngineAcl(euint8.unwrap(age));
            _recordEngineAcl(ebool.unwrap(gender));
            _recordEngineAcl(euint16.unwrap(weight));
            _recordEngineAcl(euint8.unwrap(height));
            _recordEngineAcl(ebool.unwrap(hasDiabetes));
            _recordEngineAcl(euint16.unwrap(hbLevel));
            _recordEngineAcl(ebool.unwrap(isSmoker));
            _recordEngineAcl(ebool.unwrap(hasHypertension));
        }

        // Store patient data indexed by commitment (NOT wallet address!)
        patients[_commitment] = EncryptedPatient({
            age: age,
            gender: gender,
            weight: weight,
            height: height,
            hasDiabetes: hasDiabetes,
            hbLevel: hbLevel,
            isSmoker: isSmoker,
            hasHypertension: hasHypertension,
            profileCommitment: _profileCommitment,
            exists: true
        });

        isRegistered[_commitment] = true;
        patientHandlesCached[_commitment] = true;
        profileSaltCommitments[_commitment] = _profileSaltCommitment;

        // H-3: Increment patient counter to track registrations
        _patientCount++;

        // Log the registration
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PROFILE_SUBMISSION,
                0,
                keccak256(abi.encodePacked(_commitment, block.timestamp))
            );
        }

        emit PatientRegistered(
            keccak256(abi.encodePacked(_commitment, block.timestamp)),
            block.timestamp
        );
    }

    /**
     * @notice Get patient data by commitment
     * @dev Only callable by the authorized EligibilityEngine
     *      This is how the engine fetches data during anonymous applications:
     *      1. Patient submits Semaphore proof with commitment as signal
     *      2. Contract extracts commitment from proof.signal
     *      3. Contract calls this function to get encrypted data
     *      4. FHE computes eligibility
     *
     * @param _commitment The Semaphore identity commitment
     * @return The encrypted patient data
     */
    /**
     * @notice Get cached patient field handles (persistent engine ACL — no per-call re-allow).
     * @dev Preferred path for EligibilityEngine to minimize HCU churn.
     */
    function getCachedPatientFields(uint256 _commitment) external onlyAuthorizedEngine returns (EncryptedPatient memory) {
        EncryptedPatient memory p = patients[_commitment];
        require(p.exists, "Patient not found for this commitment");
        require(patientHandlesCached[_commitment], "Patient handles not cached");

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.ELIGIBILITY_CHECKED,
                0,
                keccak256(abi.encodePacked(_commitment, block.timestamp, "CACHED_READ"))
            );
        }

        emit ProfileAccessed(msg.sender, block.timestamp);
        return p;
    }

    /**
     * @notice Legacy patient fetch that refreshes engine ACL grants (fuzz baseline only).
     * @dev Production eligibility uses {getCachedPatientFields}. Kept for bit-identical fuzz checks.
     */
    function getPatient(uint256 _commitment) external onlyAuthorizedEngine returns (EncryptedPatient memory) {
        EncryptedPatient memory p = patients[_commitment];
        require(p.exists, "Patient not found for this commitment");

        if (authorizedEngine != address(0)) {
            FHE.allow(p.age, authorizedEngine);
            FHE.allow(p.gender, authorizedEngine);
            FHE.allow(p.weight, authorizedEngine);
            FHE.allow(p.height, authorizedEngine);
            FHE.allow(p.hasDiabetes, authorizedEngine);
            FHE.allow(p.hbLevel, authorizedEngine);
            FHE.allow(p.isSmoker, authorizedEngine);
            FHE.allow(p.hasHypertension, authorizedEngine);
        }

        // Log the access
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.ELIGIBILITY_CHECKED,
                0, // No specific trial ID at this point
                keccak256(abi.encodePacked(_commitment, block.timestamp))
            );
        }

        emit ProfileAccessed(msg.sender, block.timestamp);

        return p;
    }

    /**
     * @notice Get patient data handles (view only)
     * @dev Allows patients to fetch their own data handles for frontend decryption
     *      without triggering FHE.allow() or access checks meant for the engine.
     * @param _commitment The Semaphore identity commitment
     * @return The encrypted patient data handles
     */
    function getPatientProfile(uint256 _commitment) external view returns (EncryptedPatient memory) {
        require(
            msg.sender == authorizedRegistry || msg.sender == authorizedEngine,
            "Not authorized"
        );
        EncryptedPatient memory p = patients[_commitment];
        require(p.exists, "Patient not found for this commitment");
        return p;
    }

    /**
     * @notice Check if a commitment is registered
     * @param _commitment The Semaphore identity commitment
     * @return True if registered, false otherwise
     */
    function checkRegistration(uint256 _commitment) external view returns (bool) {
        return isRegistered[_commitment];
    }

    function isPatientHandlesCached(uint256 _commitment) external view returns (bool) {
        return patientHandlesCached[_commitment];
    }

    /**
     * @notice Poseidon profile commitment stored at registration (for Noir eligibility proofs).
     */
    function getProfileCommitment(uint256 _commitment) external view returns (bytes32) {
        require(
            msg.sender == authorizedEngine || msg.sender == authorizedRegistry,
            "Not authorized"
        );
        require(patients[_commitment].exists, "Patient not found for this commitment");
        return patients[_commitment].profileCommitment;
    }

    /**
     * @notice Get the total number of registered patients
     * @return The count of registered commitments
     */
    function getPatientCount() external view returns (uint256) {
        // H-3: Return actual patient count instead of hardcoded 0
        return _patientCount;
    }
}
