// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./EligibilityEngine.sol";
import "./ConsentManager.sol";

/**
 * @title EncryptedConsentGate
 * @notice A composable FHE contract that combines encrypted eligibility with encrypted consent
 */
contract EncryptedConsentGate is ZamaEthereumConfig {
    EligibilityEngine public eligibilityEngine;
    ConsentManager public consentManager;

    address public owner;
    address public pendingOwner;

    mapping(uint256 => mapping(bytes32 => ebool)) private gatedResults;
    mapping(uint256 => mapping(bytes32 => bool)) public hasGatedResult;

    mapping(address => bool) public authorizedComputers;
    mapping(uint256 => address) public trialSponsor;

    event GateComputed(
        uint256 indexed trialId,
        bytes32 indexed resultId,
        ebool gatedResult
    );
    event ComputerAuthorized(address indexed computer);
    event ComputerDeauthorized(address indexed computer);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedComputers[msg.sender],
            "Not authorized"
        );
        _;
    }

    constructor(address _eligibilityEngine, address _consentManager) {
        owner = msg.sender;
        eligibilityEngine = EligibilityEngine(_eligibilityEngine);
        consentManager = ConsentManager(_consentManager);
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

    function authorizeComputer(address _computer) external onlyOwner {
        require(_computer != address(0), "Zero address");
        authorizedComputers[_computer] = true;
        emit ComputerAuthorized(_computer);
    }

    function deauthorizeComputer(address _computer) external onlyOwner {
        authorizedComputers[_computer] = false;
        emit ComputerDeauthorized(_computer);
    }

    function setTrialSponsor(uint256 _trialId, address _sponsor) external onlyOwner {
        require(_sponsor != address(0), "Zero address");
        trialSponsor[_trialId] = _sponsor;
    }

    /**
     * @dev DEPRECATED: use computeGateWithActiveConsent — caller-supplied handles are unsafe.
     */
    function computeGate(
        uint256,
        bytes32,
        ebool,
        ebool
    ) external pure returns (ebool) {
        revert("Use computeGateWithActiveConsent");
    }

    /**
     * @notice Compute gate from engine-sourced eligibility and active consent.
     * @dev M-2: `_patientWallet` is derived from `getConsentWalletForNullifier` (bound at apply finalize).
     */
    function computeGateWithActiveConsent(
        uint256 _trialId,
        uint256 _nullifier
    ) external onlyAuthorized returns (ebool) {
        address patientWallet = eligibilityEngine.getConsentWalletForNullifier(_nullifier, _trialId);
        require(patientWallet != address(0), "Wallet not bound");
        // The ephemeral permit holder is still required to exist (proves a finalized FHE application).
        address permitHolder = eligibilityEngine.getDecryptPermitHolder(_nullifier, _trialId);
        require(permitHolder != address(0), "No permit holder");
        bytes32 uniqueId = keccak256(
            abi.encodePacked(_trialId, _nullifier, patientWallet, consentManager.patientConsentEpoch(patientWallet))
        );
        require(!hasGatedResult[_trialId][uniqueId], "Gate already computed for this ID");

        ebool eligible = eligibilityEngine.getAnonymousResult(_nullifier, _trialId);
        ebool consented = consentManager.getActiveConsent(patientWallet, _trialId);

        FHE.allowThis(eligible);
        FHE.allowThis(consented);

        ebool finalResult = FHE.and(eligible, consented);

        FHE.allowThis(finalResult);
        if (trialSponsor[_trialId] != address(0)) {
            FHE.allow(finalResult, trialSponsor[_trialId]);
        }
        gatedResults[_trialId][uniqueId] = finalResult;
        hasGatedResult[_trialId][uniqueId] = true;

        emit GateComputed(_trialId, uniqueId, finalResult);

        return finalResult;
    }

    function getGatedResult(
        uint256 _trialId,
        bytes32 _uniqueId
    ) external view returns (ebool) {
        require(
            msg.sender == owner ||
            msg.sender == trialSponsor[_trialId] ||
            authorizedComputers[msg.sender],
            "Not authorized"
        );
        return gatedResults[_trialId][_uniqueId];
    }

    function gateExists(
        uint256 _trialId,
        bytes32 _uniqueId
    ) external view returns (bool) {
        require(
            msg.sender == owner ||
            msg.sender == trialSponsor[_trialId] ||
            authorizedComputers[msg.sender],
            "Not authorized"
        );
        return hasGatedResult[_trialId][_uniqueId];
    }

    function verifyGatePassed(
        uint256 _trialId,
        bytes32 _uniqueId
    ) external view returns (ebool) {
        require(
            msg.sender == owner ||
            msg.sender == trialSponsor[_trialId] ||
            authorizedComputers[msg.sender],
            "Not authorized"
        );
        return gatedResults[_trialId][_uniqueId];
    }
}
