// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "./TrialManager.sol";
import "./DataAccessLog.sol";

// H-4: Interface to check if patient is registered participant.
// AUDIT-LOW: removed the stale `pools(...)` entry. `pools` is a private
// mapping in SponsorIncentiveVault (no auto-getter) and the signature here
// did not even include `encryptedPoolSize`, so any call would have reverted.
interface ISponsorIncentiveVault {
    function isParticipantRegistered(uint256 _trialId, address _participant) external view returns (bool);
}

/**
 * @title TrialMilestoneManager
 * @notice Manages phased trial progress and milestone definitions
 */
contract TrialMilestoneManager {
    struct Milestone {
        string name;
        uint16 weightBps; // Weight in basis points (100 = 1%)
        uint256 deadline;
    }

    struct TrialPhases {
        Milestone[] milestones;
        bool initialized;
    }

    TrialManager public trialManager;
    ISponsorIncentiveVault public vault; // H-4: Vault reference for participant validation
    DataAccessLog public dataAccessLog;
    address public owner;
    address public pendingOwner; // FINDING 11: Two-step ownership transfer

    // trialId => phases
    mapping(uint256 => TrialPhases) private trialPhases;
    
    // trialId => patient => lastCompletedMilestoneIndex (0-indexed, 0xFFFF = none)
    mapping(uint256 => mapping(address => uint256)) public participantProgress;

    event MilestonesSet(uint256 indexed trialId, uint256 milestoneCount);
    event MilestoneCompleted(uint256 indexed trialId, address indexed patient, uint256 milestoneIndex);
    event TrialManagerUpdated(address indexed oldManager, address indexed newManager);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    constructor(address _trialManager) {
        owner = msg.sender;
        trialManager = TrialManager(_trialManager);
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

    modifier onlySponsor(uint256 _trialId) {
        require(trialManager.getTrial(_trialId).sponsor == msg.sender, "Only sponsor");
        _;
    }

    /**
     * @notice H-4: Set the vault contract for participant validation
     * @param _vault Address of the SponsorIncentiveVault contract
     */
    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Zero address");
        vault = ISponsorIncentiveVault(_vault);
    }

    function setDataAccessLog(address _log) external onlyOwner {
        dataAccessLog = DataAccessLog(_log);
    }

    /**
     * @notice Update the linked TrialManager contract
     */
    function setTrialManager(address _newTrialManager) external onlyOwner {
        require(_newTrialManager != address(0), "Invalid address");
        address oldManager = address(trialManager);
        trialManager = TrialManager(_newTrialManager);
        emit TrialManagerUpdated(oldManager, _newTrialManager);
    }

    /**
     * @notice Define milestones for a trial
     * @dev MED-6: Deadlines must be in the future and within trial end time
     */
    function setMilestones(
        uint256 _trialId,
        string[] calldata _names,
        uint16[] calldata _weights,
        uint256[] calldata _deadlines
    ) external onlySponsor(_trialId) {
        require(address(vault) != address(0), "Vault not configured");
        require(trialManager.getTrial(_trialId).endTime > 0, "Trial does not exist");
        require(!trialPhases[_trialId].initialized, "Already initialized");
        require(_names.length > 0 && _names.length <= 4, "1-4 milestones allowed");
        require(_names.length == _weights.length && _names.length == _deadlines.length, "Length mismatch");
        // M-3: ensure the sponsor is still verified before accepting milestone definitions.
        require(trialManager.isTrialSponsorVerified(_trialId), "Sponsor no longer verified");

        // MED-6: Validate deadlines
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        for (uint256 i = 0; i < _deadlines.length; i++) {
            require(_deadlines[i] > block.timestamp, "Deadline must be in future");
            require(_deadlines[i] <= trial.endTime, "Deadline cannot exceed trial end");
            // Validate deadlines are sequential (increasing order)
            if (i > 0) {
                require(_deadlines[i] > _deadlines[i - 1], "Deadlines must be sequential");
            }
        }

        // FINDING 8: Accumulate in uint256 to prevent overflow
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _names.length; i++) {
            totalWeight += uint256(_weights[i]);
            trialPhases[_trialId].milestones.push(Milestone({
                name: _names[i],
                weightBps: _weights[i],
                deadline: _deadlines[i]
            }));
        }
        require(totalWeight == 10000, "Total weight must be 10000 bps (100%)");

        trialPhases[_trialId].initialized = true;
        emit MilestonesSet(_trialId, _names.length);
    }

    /**
     * @notice Mark a milestone as completed for a patient
     * @dev HIGH-2: Milestones must be completed in sequential order
     * @dev H-4: Patient must be registered participant in the vault
     */
    function completeMilestone(uint256 _trialId, address _patient, uint256 _milestoneIndex) external onlySponsor(_trialId) {
        require(trialPhases[_trialId].initialized, "Trial not initialized");
        require(_milestoneIndex < trialPhases[_trialId].milestones.length, "Invalid index");
        // M-3: ensure the sponsor is still verified before signing off milestone completions.
        require(trialManager.isTrialSponsorVerified(_trialId), "Sponsor no longer verified");
        require(
            block.timestamp <= trialPhases[_trialId].milestones[_milestoneIndex].deadline,
            "Milestone deadline passed"
        );

        // H-4: Verify patient is a registered participant
        require(
            address(vault) != address(0) && vault.isParticipantRegistered(_trialId, _patient),
            "Not a registered participant"
        );

        uint256 currentProgress = participantProgress[_trialId][_patient];

        // HIGH-2: Enforce sequential completion
        // currentProgress is 0-based index of last completed + 1 (i.e., next expected milestone)
        // For first milestone (index 0), currentProgress must be 0
        // For subsequent milestones, currentProgress must equal the milestone being completed
        require(_milestoneIndex == currentProgress, "Must complete milestones in order");

        participantProgress[_trialId][_patient] = _milestoneIndex + 1;
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.MILESTONE_COMPLETED,
                _trialId,
                keccak256(abi.encodePacked(_patient, _milestoneIndex, block.timestamp))
            );
        }
        emit MilestoneCompleted(_trialId, _patient, _milestoneIndex);
    }

    function getMilestones(uint256 _trialId) external view returns (Milestone[] memory) {
        return trialPhases[_trialId].milestones;
    }

    function getParticipantProgress(uint256 _trialId, address _patient) external view returns (uint256) {
        return participantProgress[_trialId][_patient];
    }
}
