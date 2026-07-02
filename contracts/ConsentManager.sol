// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./DataAccessLog.sol";
import {FheAclEpochLib} from "./lib/FheAclEpochLib.sol";

/**
 * @title ConsentManager
 * @notice Tracks encrypted patient consent for trial eligibility computation
 * @dev Zama FHE UPGRADE: Consent is now an encrypted ebool - even the fact that
 *      a patient consented cannot be trivially enumerated on-chain. The
 *      EligibilityEngine can do FHE.and(eligibilityResult, consent) to gate
 *      the final result on consent - a beautiful FHE composition story.
 */
contract ConsentManager is ZamaEthereumConfig {
    address public eligibilityEngine;
    address public owner;
    address public pendingOwner;
    DataAccessLog public dataAccessLog;
    address public consentGate;

    /// @notice L-6: Timelock before changing PHI reader contracts.
    uint256 public constant READER_CHANGE_DELAY = 6 hours;
    address public pendingConsentGate;
    uint256 public consentGateChangeEta;

    uint256 private _consentGrantCount;

    FheAclEpochLib.EpochState private _aclEpoch;

    /// @notice When true, legacy grantConsent(uint256) overload is allowed (testnets only).
    bool public immutable isTestnet;

    // Zama FHE: Encrypted consent mapping - no plaintext consent on chain
    mapping(address => mapping(uint256 => ebool)) private encryptedConsent;

    // Zama FHE: Encrypted consent allows sender to view their own consent
    mapping(address => mapping(uint256 => bool)) private consentExists;

    /// @notice Global consent epoch per patient; revokeAllConsent increments this to invalidate prior grants.
    mapping(address => uint256) public patientConsentEpoch;

    /// @notice Epoch at which consent was granted for each patient/trial pair.
    mapping(address => mapping(uint256 => uint256)) private consentGrantEpoch;

    event ConsentChanged();
    event ConsentEpochRevoked(uint256 newEpoch);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    event TestnetModeEnabled(bool enabled);

    constructor(bool _isTestnet) {
        owner = msg.sender;
        isTestnet = _isTestnet;
        emit TestnetModeEnabled(_isTestnet);
    }

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

    function setEligibilityEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Zero engine");
        require(_consentGrantCount == 0, "Cannot change engine after consents granted");
        eligibilityEngine = _engine;
    }

    function setDataAccessLog(address _log) external onlyOwner {
        require(_log != address(0), "Zero address");
        dataAccessLog = DataAccessLog(_log);
    }

    function setConsentGate(address _gate) external onlyOwner {
        revert("Use scheduleConsentGate + applyConsentGate");
    }

    function scheduleConsentGate(address _gate) external onlyOwner {
        require(_gate != address(0), "Zero address");
        pendingConsentGate = _gate;
        consentGateChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    function applyConsentGate() external onlyOwner {
        require(consentGateChangeEta != 0 && block.timestamp >= consentGateChangeEta, "Timelock active");
        consentGate = pendingConsentGate;
        consentGateChangeEta = 0;
        pendingConsentGate = address(0);
    }

    function _allowConsentConsumers(ebool c) private {
        if (eligibilityEngine != address(0)) {
            FHE.allow(c, eligibilityEngine);
            FheAclEpochLib.recordGrant(
                _aclEpoch,
                ebool.unwrap(c),
                eligibilityEngine,
                uint8(FheAclEpochLib.GrantKind.EligibilityEngine)
            );
        }
        if (consentGate != address(0)) {
            FHE.allow(c, consentGate);
            FheAclEpochLib.recordGrant(
                _aclEpoch,
                ebool.unwrap(c),
                consentGate,
                uint8(FheAclEpochLib.GrantKind.ConsentManager)
            );
        }
    }

    function rotateTrustedContract(uint8 kind, address newConsumer) external onlyOwner {
        require(newConsumer != address(0), "Zero address");
        FheAclEpochLib.rotateKind(_aclEpoch, kind, newConsumer);
    }

    function aclEpochForKind(uint8 kind) external view returns (uint40) {
        return FheAclEpochLib.currentEpoch(_aclEpoch, kind);
    }

    /**
     * @notice Record encrypted consent granted during finalize (engine verifies external input).
     */
    function recordConsentGrant(address _patient, uint256 _trialId, ebool _consent) external {
        require(msg.sender == eligibilityEngine, "Only engine");
        require(_patient != address(0), "Zero patient");
        FHE.allowThis(_consent);
        FHE.allow(_consent, _patient);
        _allowConsentConsumers(_consent);
        encryptedConsent[_patient][_trialId] = _consent;
        consentExists[_patient][_trialId] = true;
        consentGrantEpoch[_patient][_trialId] = patientConsentEpoch[_patient];
        _consentGrantCount++;
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.CONSENT_GRANTED,
                _trialId,
                keccak256(abi.encodePacked(_patient, block.timestamp, "FINALIZE_INLINE"))
            );
        }
        emit ConsentChanged();
    }

    /**
     * @notice Grant encrypted consent for a specific trial
     * @param _trialId The trial ID
     * @param _consent Encrypted boolean consent (external handle + shared inputProof)
     */
    function grantConsent(uint256 _trialId, externalEbool _consent, bytes calldata inputProof) external {
        ebool c = FHE.fromExternal(_consent, inputProof);
        FHE.allowThis(c);
        FHE.allow(c, msg.sender);
        _allowConsentConsumers(c);
        encryptedConsent[msg.sender][_trialId] = c;
        consentExists[msg.sender][_trialId] = true;
        consentGrantEpoch[msg.sender][_trialId] = patientConsentEpoch[msg.sender];
        _consentGrantCount++;
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.CONSENT_GRANTED,
                _trialId,
                keccak256(abi.encodePacked(msg.sender, block.timestamp))
            );
        }
        emit ConsentChanged();
    }

    /**
     * @notice Test / legacy helper: grant encrypted-true consent without an off-chain FHE SDK proof.
     * @dev For production UI, prefer `grantConsent(uint256, externalEbool, bytes)` so the client proves ciphertext correctness.
     */
    function grantConsent(uint256 _trialId, uint256 /* _durationSeconds */) external {
        require(isTestnet, "Legacy grant only on testnet");
        ebool c = FHE.asEbool(true);
        FHE.allowThis(c);
        FHE.allow(c, msg.sender);
        _allowConsentConsumers(c);
        encryptedConsent[msg.sender][_trialId] = c;
        consentExists[msg.sender][_trialId] = true;
        consentGrantEpoch[msg.sender][_trialId] = patientConsentEpoch[msg.sender];
        _consentGrantCount++;
        emit ConsentChanged();
    }

    /**
     * @notice Kill-switch: invalidate all prior consent grants for the caller without enumerating trials.
     */
    function revokeAllConsent() external {
        patientConsentEpoch[msg.sender]++;
        emit ConsentEpochRevoked(patientConsentEpoch[msg.sender]);
    }

    /**
     * @notice Revoke consent for a single trial.
     * @dev FHE ACL: ciphertext is overwritten with encrypted-false; prior FHE.allow grants to
     *      eligibilityEngine remain on the old handle — consumers MUST use getActiveConsent()
     *      which gates on consentGrantEpoch vs patientConsentEpoch.
     */
    function revokeConsent(uint256 _trialId) external {
        ebool c = FHE.asEbool(false);
        FHE.allowThis(c);
        FHE.allow(c, msg.sender);
        encryptedConsent[msg.sender][_trialId] = c;
        consentExists[msg.sender][_trialId] = false;
        consentGrantEpoch[msg.sender][_trialId] = patientConsentEpoch[msg.sender];
        _rotateConsentConsumerEpochs();
        emit ConsentChanged();
    }

    /// @dev Bump FHE ACL epochs for consent consumers so off-chain re-grant pipelines ignore stale handles.
    function _rotateConsentConsumerEpochs() private {
        if (eligibilityEngine != address(0)) {
            FheAclEpochLib.rotateKind(
                _aclEpoch,
                uint8(FheAclEpochLib.GrantKind.EligibilityEngine),
                eligibilityEngine
            );
        }
        if (consentGate != address(0)) {
            FheAclEpochLib.rotateKind(
                _aclEpoch,
                uint8(FheAclEpochLib.GrantKind.ConsentManager),
                consentGate
            );
        }
    }

    /**
     * @notice Check if a patient has granted consent for a trial (encrypted)
     * @param _patient The patient address
     * @param _trialId The trial ID
     * @return The encrypted consent status
     */
    function getEncryptedConsent(address _patient, uint256 _trialId) external view returns (ebool) {
        require(
            msg.sender == _patient || msg.sender == eligibilityEngine,
            "Not authorized"
        );
        require(consentExists[_patient][_trialId], "No consent record");
        require(
            consentGrantEpoch[_patient][_trialId] == patientConsentEpoch[_patient],
            "Consent revoked or superseded"
        );
        return encryptedConsent[_patient][_trialId];
    }

    /**
     * @notice Check if consent record exists for patient/trial
     * @param _patient The patient address
     * @param _trialId The trial ID
     * @return True if consent has been set (exists flag only, not the consent value)
     */
    function hasConsentRecord(address _patient, uint256 _trialId) external view returns (bool) {
        require(
            msg.sender == _patient || msg.sender == eligibilityEngine,
            "Not authorized"
        );
        return consentExists[_patient][_trialId];
    }

    /**
     * @notice Get active encrypted consent - returns encrypted false if revoked
     * @dev SECURITY FIX (M-2): Uses FHE.and() to gate consent with exists flag.
     *      This ensures revoked consent (exists=false) always evaluates to encrypted false,
     *      even though the underlying ciphertext handle may still be decryptable by parties
     *      who previously received FHE.allow() permissions.
     * @dev NOTE: Not a view function because FHE operations modify state in Zama FHE protocol.
     * @param _patient The patient address
     * @param _trialId The trial ID
     * @return The encrypted consent status, gated by the exists flag
     */
    function getActiveConsent(address _patient, uint256 _trialId) external returns (ebool) {
        require(
            msg.sender == _patient ||
            msg.sender == eligibilityEngine ||
            msg.sender == consentGate,
            "Not authorized"
        );
        ebool consent = encryptedConsent[_patient][_trialId];
        ebool exists = FHE.asEbool(consentExists[_patient][_trialId]);
        ebool epochValid = FHE.asEbool(consentGrantEpoch[_patient][_trialId] == patientConsentEpoch[_patient]);
        ebool active = FHE.and(FHE.and(consent, exists), epochValid);
        FHE.allowThis(active);
        FHE.allow(active, msg.sender);
        return active;
    }

    /**
     * @notice Returns the patient's current global consent epoch (for off-chain filtering).
     */
    function getPatientConsentEpoch(address _patient) external view returns (uint256) {
        require(msg.sender == _patient, "Not authorized");
        return patientConsentEpoch[_patient];
    }
}
