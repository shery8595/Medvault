// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import {FHE, ebool, externalEuint8, externalEbool, externalEuint16} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IAnonymousPatientRegistry {
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
    ) external;
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
    function finalizeAnonymousEligibilityWithConsent(
        uint256 _commitment,
        uint256 _nullifier,
        uint256 _trialId,
        address _permitRecipient,
        address _consentWallet,
        ebool _consent,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (ebool);
    function getAnonymousApplicationStatus(uint256 _nullifier, uint256 _trialId) external view returns (ApplicationStatus);
    function checkAnonymousEligibilityWithConsent(
        uint256 _commitment,
        uint256 _trialId,
        uint256 _nullifier,
        address _permitRecipient,
        address _patientAddress
    ) external returns (ebool);
    function updateAnonymousApplicationStatus(
        uint256 _trialId,
        uint256 _nullifier,
        ApplicationStatus _status
    ) external;
    function cancelStagedAnonymousEligibility(uint256 _nullifier, uint256 _trialId, address _permitRecipient) external;
}

/**
 * @title MedVaultRegistry
 * @notice Anonymous patient registration and clinical trial application using Semaphore
 * @dev Phase 1 (Registration): Wallet-linked commitment submission
 *      Phase 2 (Application): Anonymous ZK proof verification with nullifier tracking
 */
contract MedVaultRegistry is ZamaEthereumConfig {
    ISemaphore public semaphore;
    uint256 public patientGroupId;
    IAnonymousPatientRegistry public patientRegistry;
    IEligibilityEngine public eligibilityEngine;

    /// @notice Duration for which historical Merkle roots remain valid for proof verification.
    /// @dev 30 days gives ample headroom for inactivity between registrations.
    ///      The Semaphore default is only 1 hour, which causes Semaphore__MerkleTreeRootIsExpired
    ///      after any registration gap longer than 60 minutes.
    uint256 public constant MERKLE_TREE_DURATION = 30 days;
    
    // FINDING 11: Two-step ownership transfer
    address public owner;
    address public pendingOwner;

    /// @notice P3.1: Multi-relayer allowlist — gasless registration/cancel; patients choose among authorized relayers.
    mapping(address => bool) public authorizedRelayers;
    /// @notice Timelock before adding/removing authorized relayers.
    uint256 public constant RELAYER_AUTH_DELAY = 6 hours;
    mapping(address => bool) public pendingRelayerAuth;
    mapping(address => uint256) public relayerAuthChangeEta;

    bytes32 public constant REGISTER_VIA_RELAYER_TYPEHASH = keccak256(
        "RegisterViaRelayer(address patientWallet,uint256 identityCommitment,address viewPermitRecipient,bytes32 profileCommitment,bytes32 healthDataHash,uint256 nonce,uint256 deadline)"
    );

    bytes32 public constant ANONYMOUS_APPLY_TYPEHASH = keccak256(
        "AnonymousApply(uint256 trialId,uint256 commitment,uint256 nullifier,address permitRecipient,uint256 deadline)"
    );

    // M-4: Distinct typehash for cancel authorization. A captured apply permit signature cannot be
    // replayed to tear down a staged application, breaking the public stage→cancel griefing loop.
    bytes32 public constant CANCEL_ANONYMOUS_APPLY_TYPEHASH = keccak256(
        "CancelAnonymousApply(uint256 trialId,uint256 nullifier,address permitRecipient,uint256 deadline)"
    );

    /// @notice M-2: Binds the consent-granting wallet to a nullifier at apply finalize.
    bytes32 public constant CONSENT_WALLET_BINDING_TYPEHASH = keccak256(
        "ConsentWalletBinding(uint256 nullifier,uint256 trialId,address consentWallet,uint256 deadline)"
    );

    /// @notice H-1: Patient authorizes encrypted consent ciphertext before registry forwards to engine.
    bytes32 public constant CONSENT_GRANT_TYPEHASH = keccak256(
        "ConsentGrant(bytes32 consentHandle,uint256 trialId,address consentWallet,uint256 deadline)"
    );

    mapping(address => uint256) public registerNonces;
    mapping(uint256 => uint256) public anonymousApplyDeadlines;

    // Track wallet => commitment for Phase 1 (registration only)
    mapping(address => uint256) private walletToCommitment;
    mapping(address => bool) private registered;

    // Track applications: trialId => nullifier => applied
    mapping(uint256 => mapping(uint256 => bool)) public trialApplications;

    /// @dev AUDIT-FIX-M-4: monotonic stage deadline per nullifier/trial — blocks re-stage griefing with same permit.
    mapping(uint256 => mapping(uint256 => uint256)) private lastStageDeadline;

    // FINDING 4: consentConsent mapping removed - consent is now encoded in the Semaphore proof signal
    // This prevents on-chain linkage between wallet and trialId

    event PatientRegistered(uint256 indexed commitment);
    event AnonymousApplication(uint256 indexed trialId, uint256 indexed nullifierHash, bytes32 indexed blindedRef);
    /// @dev Emitted after FHE staging; `finalCt` is the `ebool` handle bytes32 for Zama FHE `decryptForTx`.
    event AnonymousApplyStaged(
        uint256 indexed trialId,
        uint256 indexed nullifierHash,
        bytes32 indexed blindedRef,
        bytes32 finalCt
    );
    // FINDING 4: AnonymousConsentGranted event removed - no longer needed
    event OwnershipProposed(address indexed proposedOwner); // FINDING 11
    event OwnershipAccepted(address indexed newOwner); // FINDING 11
    event AuthorizedRelayerUpdated(address indexed relayer, bool authorized);
    event PatientRegisteredViaRelayer(address indexed relayer, uint256 indexed commitment);

    constructor(address _semaphore, address _patientRegistry, address _eligibilityEngine) {
        semaphore = ISemaphore(_semaphore);
        // FIX: Use 3-arg createGroup so MedVaultRegistry is the admin AND duration is set at creation.
        // Using createGroup() with no args sets merkleTreeDuration = 1 hour (Semaphore hardcoded default),
        // causing Semaphore__MerkleTreeRootIsExpired after any registration gap > 1 hour.
        // Since MedVaultRegistry is the group admin (not the deployer EOA), duration MUST be fixed
        // at creation time — or updated via updateMerkleTreeDuration() below.
        patientGroupId = semaphore.createGroup(address(this), MERKLE_TREE_DURATION);
        patientRegistry = IAnonymousPatientRegistry(_patientRegistry);
        eligibilityEngine = IEligibilityEngine(_eligibilityEngine);
        owner = msg.sender; // FINDING 11
    }

    // FINDING 11: Two-step ownership transfer
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

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
     * @notice Update the Semaphore group's Merkle tree duration post-deployment.
     * @dev MedVaultRegistry is the group admin (set in constructor via createGroup(address(this), ...)).
     *      EOA wallets cannot call semaphore.updateGroupMerkleTreeDuration() directly because
     *      the admin is this contract — not the deployer. This function is the only safe path.
     * @param newDuration New duration in seconds (e.g., 30 days = 2592000)
     */
    function updateMerkleTreeDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 1 hours, "Duration below minimum (1 hour)");
        require(newDuration <= 365 days, "Duration above maximum (365 days)");
        semaphore.updateGroupMerkleTreeDuration(patientGroupId, newDuration);
    }

    function setTrustedRelayer(address) external onlyOwner {
        revert("Use scheduleRelayerAuth + applyRelayerAuth");
    }

    function scheduleRelayerAuth(address _relayer, bool _authorize) external onlyOwner {
        require(_relayer != address(0), "Zero relayer");
        pendingRelayerAuth[_relayer] = _authorize;
        relayerAuthChangeEta[_relayer] = block.timestamp + RELAYER_AUTH_DELAY;
    }

    function applyRelayerAuth(address _relayer) external onlyOwner {
        require(
            relayerAuthChangeEta[_relayer] != 0 && block.timestamp >= relayerAuthChangeEta[_relayer],
            "Timelock active"
        );
        authorizedRelayers[_relayer] = pendingRelayerAuth[_relayer];
        relayerAuthChangeEta[_relayer] = 0;
        emit AuthorizedRelayerUpdated(_relayer, authorizedRelayers[_relayer]);
    }

    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "Only authorized relayer");
        _;
    }

    function _registerPatientCore(
        address patientWallet,
        uint256 identityCommitment,
        address _viewPermitRecipient,
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
        bytes calldata inputProof,
        bool linkWalletOnChain
    ) internal {
        require(_viewPermitRecipient != address(0), "Zero permit recipient");
        require(_profileCommitment != bytes32(0), "Zero profile commitment");
        // L-2: reject zero commitment — adding member 0 to the Semaphore group can corrupt the
        // Merkle tree (0 is a common sentinel) and would let anyone "register" a null identity.
        require(identityCommitment != 0, "Zero identity commitment");
        require(!registered[patientWallet], "Already registered");
        registered[patientWallet] = true;
        if (linkWalletOnChain) {
            walletToCommitment[patientWallet] = identityCommitment;
        }

        semaphore.addMember(patientGroupId, identityCommitment);

        patientRegistry.registerPatient(
            identityCommitment,
            _viewPermitRecipient,
            _profileCommitment,
            _profileSaltCommitment,
            _age,
            _gender,
            _weight,
            _height,
            _hasDiabetes,
            _hbLevel,
            _isSmoker,
            _hasHypertension,
            inputProof
        );
    }
    
    /**
     * @notice Phase 1: Public registration - wallet IS linked here by design
     * @param identityCommitment Semaphore identity commitment (hash of trapdoor + nullifier)
     * @param _viewPermitRecipient The ephemeral address (derived from identity secret, NOT wallet)
     *        that will receive FHE decrypt rights. Must be computed off-chain by the patient
     *        using generateEphemeralAddress(identity). Keeps AnonymousPatientRegistry wallet-agnostic.
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
        uint256 identityCommitment,
        address _viewPermitRecipient,
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
    ) external {
        _registerPatientCore(
            msg.sender,
            identityCommitment,
            _viewPermitRecipient,
            _profileCommitment,
            _profileSaltCommitment,
            _age,
            _gender,
            _weight,
            _height,
            _hasDiabetes,
            _hbLevel,
            _isSmoker,
            _hasHypertension,
            inputProof,
            true
        );
        emit PatientRegistered(identityCommitment);
    }

    /**
     * @notice Privacy-preserving registration: relayer pays gas; wallet↔commitment not stored on-chain.
     * @dev Patient signs EIP-712 digest off-chain; relayer submits this tx.
     */
    function registerPatientViaRelayer(
        address patientWallet,
        uint256 identityCommitment,
        address _viewPermitRecipient,
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
        bytes calldata inputProof,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external onlyAuthorizedRelayer {
        require(patientWallet != address(0), "Zero patient wallet");
        require(nonce == registerNonces[patientWallet], "Invalid nonce");
        require(block.timestamp <= deadline, "Signature expired");
        registerNonces[patientWallet] = nonce + 1;

        bytes32 healthDataHash = _healthDataHash(
            _age,
            _gender,
            _weight,
            _height,
            _hasDiabetes,
            _hbLevel,
            _isSmoker,
            _hasHypertension,
            inputProof
        );

        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_VIA_RELAYER_TYPEHASH,
                patientWallet,
                identityCommitment,
                _viewPermitRecipient,
                _profileCommitment,
                healthDataHash,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), structHash)
        );
        address recovered = _recoverSigner(digest, signature);
        require(recovered == patientWallet, "Invalid registration signature");

        _registerPatientCore(
            patientWallet,
            identityCommitment,
            _viewPermitRecipient,
            _profileCommitment,
            _profileSaltCommitment,
            _age,
            _gender,
            _weight,
            _height,
            _hasDiabetes,
            _hbLevel,
            _isSmoker,
            _hasHypertension,
            inputProof,
            false
        );
        emit PatientRegisteredViaRelayer(msg.sender, identityCommitment);
        emit PatientRegistered(identityCommitment);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MedVaultRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function computeHealthDataHash(
        externalEuint8 _age,
        externalEbool _gender,
        externalEuint16 _weight,
        externalEuint8 _height,
        externalEbool _hasDiabetes,
        externalEuint16 _hbLevel,
        externalEbool _isSmoker,
        externalEbool _hasHypertension,
        bytes calldata inputProof
    ) external pure returns (bytes32) {
        return _healthDataHash(
            _age,
            _gender,
            _weight,
            _height,
            _hasDiabetes,
            _hbLevel,
            _isSmoker,
            _hasHypertension,
            inputProof
        );
    }

    function _healthDataHash(
        externalEuint8 _age,
        externalEbool _gender,
        externalEuint16 _weight,
        externalEuint8 _height,
        externalEbool _hasDiabetes,
        externalEuint16 _hbLevel,
        externalEbool _isSmoker,
        externalEbool _hasHypertension,
        bytes calldata inputProof
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _age,
                _gender,
                _weight,
                _height,
                _hasDiabetes,
                _hbLevel,
                _isSmoker,
                _hasHypertension,
                inputProof
            )
        );
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        return ECDSA.recover(digest, signature);
    }
    
    // FINDING 4: grantAnonymousConsent() removed entirely
    // Consent and the ephemeral decrypt recipient are encoded inside the Semaphore proof signal.
    // The patient generates message = keccak256(abi.encodePacked(commitment, trialId, permitRecipient, "CONSENT"))
    // No separate on-chain consent tx = no wallet linkage = true privacy

    function _verifyAnonymousApplyProof(
        uint256 trialId,
        ISemaphore.SemaphoreProof calldata proof,
        uint256 commitment,
        address permitRecipient,
        uint256 deadline,
        bytes calldata permitSignature
    ) internal view {
        require(permitRecipient != address(0), "Invalid permit recipient");
        require(block.timestamp <= deadline, "Permit signature expired");
        require(
            ISemaphoreGroups(address(semaphore)).hasMember(patientGroupId, commitment),
            "Commitment not registered in group"
        );
        bool isValid = semaphore.verifyProof(patientGroupId, proof);
        require(isValid, "Invalid Semaphore proof");
        require(proof.scope == trialId, "Scope mismatch: trialId");
        uint256 expectedMessage = uint256(keccak256(abi.encodePacked(commitment, permitRecipient)));
        require(proof.message == expectedMessage, "Commitment/signal mismatch");

        bytes32 structHash = keccak256(
            abi.encode(
                ANONYMOUS_APPLY_TYPEHASH,
                trialId,
                commitment,
                proof.nullifier,
                permitRecipient,
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), structHash)
        );
        address recovered = _recoverSigner(digest, permitSignature);
        require(recovered == permitRecipient, "Invalid permit recipient signature");
    }

    function _verifyConsentGrantSignature(
        bytes32 consentHandle,
        uint256 trialId,
        address consentWallet,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        require(consentWallet != address(0), "Zero consent wallet");
        require(block.timestamp <= deadline, "Consent grant signature expired");
        bytes32 structHash = keccak256(
            abi.encode(CONSENT_GRANT_TYPEHASH, consentHandle, trialId, consentWallet, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recoverSigner(digest, signature);
        require(recovered == consentWallet, "Invalid consent grant signature");
    }

    function _verifyConsentWalletBinding(
        uint256 nullifier,
        uint256 trialId,
        address consentWallet,
        uint256 deadline,
        bytes calldata consentWalletSignature
    ) internal view {
        require(consentWallet != address(0), "Zero consent wallet");
        require(block.timestamp <= deadline, "Consent binding signature expired");
        bytes32 structHash = keccak256(
            abi.encode(
                CONSENT_WALLET_BINDING_TYPEHASH,
                nullifier,
                trialId,
                consentWallet,
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), structHash)
        );
        address recovered = _recoverSigner(digest, consentWalletSignature);
        require(recovered == consentWallet, "Invalid consent wallet signature");
    }

    /**
     * @notice Phase 2a: Stage FHE eligibility (Semaphore verified). Does not mark applied until finalize.
     * @dev Patient uses `finalCt` from `AnonymousApplyStaged` with Zama FHE `decryptForTx` + permit on `permitRecipient`.
     */
    function stageAnonymousApply(
        uint256 trialId,
        ISemaphore.SemaphoreProof calldata proof,
        uint256 commitment,
        address permitRecipient,
        uint256 deadline,
        bytes calldata permitSignature
    ) external {
        _verifyAnonymousApplyProof(trialId, proof, commitment, permitRecipient, deadline, permitSignature);
        require(!trialApplications[trialId][proof.nullifier], "Already applied to this trial");
        require(address(eligibilityEngine) != address(0), "Eligibility engine not set");
        // AUDIT-FIX-M-4: require a fresh permit deadline after cancel — same signature cannot re-stage.
        require(deadline > lastStageDeadline[trialId][proof.nullifier], "Stale stage permit");
        lastStageDeadline[trialId][proof.nullifier] = deadline;

        bytes32 finalCt = eligibilityEngine.stageAnonymousEligibility(
            commitment,
            trialId,
            proof.nullifier,
            permitRecipient
        );

        anonymousApplyDeadlines[proof.nullifier] = deadline;

        bytes32 blindedRef = keccak256(abi.encodePacked(proof.nullifier, trialId));
        emit AnonymousApplyStaged(trialId, proof.nullifier, blindedRef, finalCt);
    }

    /**
     * @notice Phase 2b: finalize with Noir proof after local FHE decrypt (no KMS public decrypt).
     * @dev HIGH-1: Only authorized relayers may finalize; relayer re-decrypts staged ciphertext (P0.2).
     */
    function finalizeAnonymousApplyWithProof(
        uint256 trialId,
        ISemaphore.SemaphoreProof calldata proof,
        uint256 commitment,
        address permitRecipient,
        address consentWallet,
        uint256 deadline,
        bytes calldata permitSignature,
        bytes calldata consentWalletSignature,
        bytes calldata noirProof,
        bytes32[] calldata publicInputs
    ) external onlyAuthorizedRelayer {
        _verifyAnonymousApplyProof(trialId, proof, commitment, permitRecipient, deadline, permitSignature);
        _verifyConsentWalletBinding(
            proof.nullifier,
            trialId,
            consentWallet,
            deadline,
            consentWalletSignature
        );
        require(!trialApplications[trialId][proof.nullifier], "Already applied to this trial");
        require(address(eligibilityEngine) != address(0), "Eligibility engine not set");

        eligibilityEngine.finalizeAnonymousEligibilityWithProof(
            commitment,
            proof.nullifier,
            trialId,
            permitRecipient,
            consentWallet,
            noirProof,
            publicInputs
        );

        if (
            eligibilityEngine.getAnonymousApplicationStatus(proof.nullifier, trialId) ==
            IEligibilityEngine.ApplicationStatus.None
        ) {
            return;
        }

        trialApplications[trialId][proof.nullifier] = true;

        bytes32 blindedRef = keccak256(abi.encodePacked(proof.nullifier, trialId));
        emit AnonymousApplication(trialId, proof.nullifier, blindedRef);
    }

    function finalizeAnonymousApplyWithConsent(
        uint256 trialId,
        ISemaphore.SemaphoreProof calldata proof,
        uint256 commitment,
        address permitRecipient,
        address consentWallet,
        uint256 deadline,
        bytes calldata permitSignature,
        bytes calldata consentWalletSignature,
        externalEbool consent,
        bytes calldata proofConsent,
        uint256 consentDeadline,
        bytes calldata consentGrantSignature,
        bytes calldata noirProof,
        bytes32[] calldata publicInputs
    ) external onlyAuthorizedRelayer {
        _verifyAnonymousApplyProof(trialId, proof, commitment, permitRecipient, deadline, permitSignature);
        _verifyConsentWalletBinding(
            proof.nullifier,
            trialId,
            consentWallet,
            deadline,
            consentWalletSignature
        );
        _completeAnonymousApplyWithConsent(
            trialId,
            proof.nullifier,
            commitment,
            permitRecipient,
            consentWallet,
            consent,
            proofConsent,
            consentDeadline,
            consentGrantSignature,
            noirProof,
            publicInputs
        );
    }

    function _completeAnonymousApplyWithConsent(
        uint256 trialId,
        uint256 nullifier,
        uint256 commitment,
        address permitRecipient,
        address consentWallet,
        externalEbool consent,
        bytes calldata proofConsent,
        uint256 consentDeadline,
        bytes calldata consentGrantSignature,
        bytes calldata noirProof,
        bytes32[] calldata publicInputs
    ) private {
        require(!trialApplications[trialId][nullifier], "Already applied to this trial");
        require(address(eligibilityEngine) != address(0), "Eligibility engine not set");

        ebool consentCt = FHE.fromExternal(consent, proofConsent);
        _verifyConsentGrantSignature(
            ebool.unwrap(consentCt),
            trialId,
            consentWallet,
            consentDeadline,
            consentGrantSignature
        );
        FHE.allowThis(consentCt);
        FHE.allow(consentCt, address(eligibilityEngine));

        eligibilityEngine.finalizeAnonymousEligibilityWithConsent(
            commitment,
            nullifier,
            trialId,
            permitRecipient,
            consentWallet,
            consentCt,
            noirProof,
            publicInputs
        );

        if (
            eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId) ==
            IEligibilityEngine.ApplicationStatus.None
        ) {
            return;
        }

        trialApplications[trialId][nullifier] = true;
        bytes32 blindedRef = keccak256(abi.encodePacked(nullifier, trialId));
        emit AnonymousApplication(trialId, nullifier, blindedRef);
    }

    /**
     * @notice Clear orphaned FHE staging when finalize never completes (e.g. ineligible decrypt).
     * @dev M-4: Callable only by the permit recipient (the patient) via a fresh EIP-712 cancel
     *      signature. Previously anyone holding the publicly-broadcast apply proof + permit
     *      signature could loop stage→cancel and repeatedly destroy the patient's staged FHE
     *      eligibility. The cancel signature uses a distinct typehash so the apply permit cannot
     *      be replayed here. Does not mark applied.
     */
    function cancelAnonymousApplyStage(
        uint256 trialId,
        ISemaphore.SemaphoreProof calldata proof,
        uint256 commitment,
        address permitRecipient,
        uint256 deadline,
        bytes calldata permitSignature,
        bytes calldata cancelSignature
    ) external onlyAuthorizedRelayer {
        _verifyAnonymousApplyProof(trialId, proof, commitment, permitRecipient, deadline, permitSignature);
        require(!trialApplications[trialId][proof.nullifier], "Already applied to this trial");
        require(address(eligibilityEngine) != address(0), "Eligibility engine not set");

        // M-4: require a distinct cancel authorization from the permit recipient.
        require(block.timestamp <= deadline, "Cancel signature expired");
        bytes32 cancelStructHash = keccak256(
            abi.encode(
                CANCEL_ANONYMOUS_APPLY_TYPEHASH,
                trialId,
                proof.nullifier,
                permitRecipient,
                deadline
            )
        );
        bytes32 cancelDigest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), cancelStructHash)
        );
        address cancelSigner = _recoverSigner(cancelDigest, cancelSignature);
        require(cancelSigner == permitRecipient, "Invalid cancel signature");

        eligibilityEngine.cancelStagedAnonymousEligibility(proof.nullifier, trialId, permitRecipient);
    }

    // MED-4: Wallet-linked apply is deprecated; use anonymous Semaphore + Noir flow.
    /**
     * @notice DEPRECATED: wallet-linked apply removed for security (nullifier not bound to identity).
     */
    function applyToTrialWithConsent(
        uint256 /* trialId */,
        uint256 /* commitment */,
        uint256 /* nullifier */
    ) external pure {
        revert("Deprecated: use stageAnonymousApply + finalizeAnonymousApplyWithProof");
    }
    
    /**
     * @notice Check if a nullifier has been used for a specific trial
     * @param trialId The trial ID
     * @param nullifierHash The nullifier hash from the Semaphore proof
     * @return True if already applied, false otherwise
     */
    function hasAppliedToTrial(uint256 trialId, uint256 nullifierHash) external view returns (bool) {
        return trialApplications[trialId][nullifierHash];
    }

    /**
     * @notice Get the number of registered patients
     * @return The number of members in the Semaphore group
     */
    function getPatientCount() external view returns (uint256) {
        return ISemaphoreGroups(address(semaphore)).getMerkleTreeSize(patientGroupId);
    }

    /**
     * @notice Check if a commitment is a registered member of the group
     * @param identityCommitment The Semaphore identity commitment
     * @return True if member, false otherwise
     */
    function isRegisteredMember(uint256 identityCommitment) external view returns (bool) {
        return ISemaphoreGroups(address(semaphore)).hasMember(patientGroupId, identityCommitment);
    }

    /**
     * @notice Get a wallet's commitment (only available for their own wallet)
     * @param wallet The wallet address to lookup
     * @return The commitment associated with this wallet
     */
    function getCommitmentForWallet(address wallet) external view returns (uint256) {
        // Only allow wallet to query their own commitment
        require(msg.sender == wallet, "Can only query own commitment");
        return walletToCommitment[wallet];
    }

    /**
     * @notice Check if the calling wallet is registered.
     * @dev Self-only: wallets can only check their own registration status.
     *      This prevents anyone from confirming whether a specific wallet is a patient.
     * @return True if the caller is registered, false otherwise
     */
    function isRegistered() external view returns (bool) {
        return registered[msg.sender];
    }
}
