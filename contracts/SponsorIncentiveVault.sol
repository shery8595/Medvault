// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint32, euint64, ebool, externalEuint32, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./ConfidentialETH.sol";
import "./TrialManager.sol";
import "./EligibilityEngine.sol";
import "./TrialMilestoneManager.sol";
import "./DataAccessLog.sol";

/**
 * @title SponsorIncentiveVault
 * @notice Manages encrypted incentive pools for clinical trials
 * @dev V1.2.1: Phase-Gated Settlement
 *   - Trial end -> ONLY Milestone 0 (Screening) is paid automatically.
 *   - Remaining milestones are released manually by sponsor via distributeMilestoneToParticipant.
 *   - No global lock after screening distribution, so post-trial promotion still works.
 *   - Fallback: If no milestones are set, full share is distributed (legacy behavior).
 */
contract SponsorIncentiveVault is ZamaEthereumConfig {
    ConfidentialETH public cETH;
    TrialManager public trialManager;
    EligibilityEngine public eligibilityEngine;
    TrialMilestoneManager public milestoneManager;
    DataAccessLog public dataAccessLog;
    address public automationContract;
    address public owner;

    struct IncentivePool {
        uint256 totalDepositedWei;
        address[] participants;
        bool screeningDistributed; // V1.2.1: replaces blanket `distributed` flag
        mapping(address => bool) isRegistered;
    }

    mapping(uint256 => IncentivePool) private pools;
    // trialId => milestoneIndex => distributed (legacy / bulk distributePartial)
    mapping(uint256 => mapping(uint256 => bool)) public milestoneDistributed;
    // trialId => patient => milestoneIndex => paid
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public participantMilestonePaid;

    event IncentiveFunded(uint256 indexed trialId, address indexed sponsor, uint256 amount);
    event ParticipantRegistered(uint256 indexed trialId, address indexed participant);
    event RewardsDistributed(uint256 indexed trialId, uint256 participantCount, uint256 shareWei);
    event MilestoneRewardsDistributed(uint256 indexed trialId, uint256 milestoneIndex, uint256 shareWei);
    event RewardClaimed(address indexed patient, uint256 amount);

    constructor(address payable _cETH, address _trialManager, address _eligibilityEngine) {
        owner = msg.sender;
        cETH = ConfidentialETH(_cETH);
        trialManager = TrialManager(_trialManager);
        eligibilityEngine = EligibilityEngine(_eligibilityEngine);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setAutomationContract(address _automation) external onlyOwner {
        automationContract = _automation;
    }

    function setMilestoneManager(address _milestoneManager) external onlyOwner {
        milestoneManager = TrialMilestoneManager(_milestoneManager);
    }

    function setDataAccessLog(address _dataAccessLog) external onlyOwner {
        dataAccessLog = DataAccessLog(_dataAccessLog);
    }

    /**
     * @notice Sponsor deposits ETH to fund a trial's incentive pool
     */
    function fundTrial(uint256 _trialId) external payable {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == trial.sponsor, "Only sponsor can fund");
        require(trial.active, "Trial not active");
        require(msg.value > 0, "Must send ETH");
        pools[_trialId].totalDepositedWei += msg.value;
        emit IncentiveFunded(_trialId, msg.sender, msg.value);
    }

    /**
     * @notice Register a participant for incentives (Sponsor or Self-registration)
     */
    function registerParticipant(uint256 _trialId, address _participant) external {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == _participant || msg.sender == trial.sponsor, "Unauthorized to register");
        
        IncentivePool storage pool = pools[_trialId];
        require(pool.totalDepositedWei > 0, "No incentive pool");
        require(!pool.screeningDistributed, "Screening already finalized");
        require(!pool.isRegistered[_participant], "Already registered");

        (EligibilityEngine.ApplicationStatus status, ) = eligibilityEngine.applications(_trialId, _participant);
        require(status == EligibilityEngine.ApplicationStatus.Accepted, "Must be accepted");

        pool.participants.push(_participant);
        pool.isRegistered[_participant] = true;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PARTICIPANT_JOINED_POOL,
                _trialId,
                keccak256(abi.encodePacked(_participant, block.timestamp))
            );
        }
        emit ParticipantRegistered(_trialId, _participant);
    }

    /**
     * @notice Distributes only Milestone 0 (Screening) rewards to all participants at trial end.
     * @dev V1.2.1: Phase-Gated. Only Milestone 0 is auto-distributed. Subsequent phases require
     *      manual sponsor promotion via distributeMilestoneToParticipant.
     *      Fallback: If no milestones are set, distributes the full share (legacy behavior).
     */
    function distribute(uint256 _trialId) external {
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );

        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(block.timestamp >= trial.endTime, "Trial not yet ended");
        require(pools[_trialId].totalDepositedWei > 0, "No incentive pool");
        require(!pools[_trialId].screeningDistributed, "Screening already distributed");

        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");

        uint256 totalWei = pools[_trialId].totalDepositedWei;
        uint256 perParticipantWei;

        // V1.2.1: Phase-Gated - check if milestones are configured
        bool hasMilestones = address(milestoneManager) != address(0) &&
            milestoneManager.getMilestones(_trialId).length > 0;

        if (hasMilestones) {
            // Pay only Milestone 0 (Screening) weight to all participants
            TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
            uint256 screeningWei = (totalWei * milestones[0].weightBps) / 10000;
            perParticipantWei = screeningWei / pCount;

            for (uint256 i = 0; i < pCount; i++) {
                address participant = pools[_trialId].participants[i];
                if (!participantMilestonePaid[_trialId][participant][0]) {
                    participantMilestonePaid[_trialId][participant][0] = true;
                    cETH.depositFor{value: perParticipantWei}(participant);
                }
            }
        } else {
            // Fallback: No milestones -> full share to all participants (legacy behavior)
            perParticipantWei = totalWei / pCount;
            for (uint256 i = 0; i < pCount; i++) {
                cETH.depositFor{value: perParticipantWei}(pools[_trialId].participants[i]);
            }
        }

        pools[_trialId].screeningDistributed = true;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("SCREENING_DISTRIBUTION", block.timestamp))
            );
        }

        emit RewardsDistributed(_trialId, pCount, perParticipantWei);
    }

    /**
     * @notice Distributes rewards for a specific milestone to all eligible participants.
     * @dev Only Milestone 0 is auto-distributed. Subsequent phases can be bulk-distributed by sponsor.
     */
    function distributePartial(uint256 _trialId, uint256 _milestoneIndex) external {
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        require(!milestoneDistributed[_trialId][_milestoneIndex], "Milestone already distributed");

        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");

        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");

        uint256 totalWei = pools[_trialId].totalDepositedWei;
        uint256 milestoneShareWei = (totalWei * milestones[_milestoneIndex].weightBps) / 10000;
        uint256 perParticipantWei = milestoneShareWei / pCount;

        for (uint256 i = 0; i < pCount; i++) {
            address participant = pools[_trialId].participants[i];
            // Only pay if they've actually completed it and haven't been paid manually
            // V1.2.2: Relaxed gating for Milestone 0 (Screening/Initial)
            bool isEligible = (_milestoneIndex == 0) || 
                             (milestoneManager.getParticipantProgress(_trialId, participant) >= _milestoneIndex + 1);
            
            if (isEligible && !participantMilestonePaid[_trialId][participant][_milestoneIndex]) {
                participantMilestonePaid[_trialId][participant][_milestoneIndex] = true;
                cETH.depositFor{value: perParticipantWei}(participant);
            }
        }

        milestoneDistributed[_trialId][_milestoneIndex] = true;
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("PARTIAL_DISTRIBUTION", _milestoneIndex, block.timestamp))
            );
        }

        emit MilestoneRewardsDistributed(_trialId, _milestoneIndex, perParticipantWei);
    }

    /**
     * @notice Distribute reward for a specific milestone to a specific participant.
     * @dev V1.2.1: No longer blocked by a global distributed flag. Can be called anytime
     *      after the sponsor promotes a patient, including post-trial-end.
     */
    function distributeMilestoneToParticipant(uint256 _trialId, address _participant, uint256 _milestoneIndex) external {
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );
        // V1.2.1: Removed the blanket `distributed` guard — per-milestone paid mapping is the only guard.
        require(pools[_trialId].isRegistered[_participant], "Participant not registered");

        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");

        uint256 progress = milestoneManager.getParticipantProgress(_trialId, _participant);
        // V1.2.2: Relaxed gating for Milestone 0 (Screening/Initial)
        bool isEligible = (_milestoneIndex == 0) || (progress >= _milestoneIndex + 1);
        require(isEligible, "Milestone not completed by participant");

        require(!participantMilestonePaid[_trialId][_participant][_milestoneIndex], "Already paid for this milestone");

        uint256 totalWei = pools[_trialId].totalDepositedWei;
        uint256 milestoneShareWei = (totalWei * milestones[_milestoneIndex].weightBps) / 10000;
        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");
        uint256 perParticipantWei = milestoneShareWei / pCount;

        participantMilestonePaid[_trialId][_participant][_milestoneIndex] = true;
        cETH.depositFor{value: perParticipantWei}(_participant);

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("INDIVIDUAL_MILESTONE_DISTRIBUTION", _participant, _milestoneIndex, block.timestamp))
            );
        }

        emit MilestoneRewardsDistributed(_trialId, _milestoneIndex, perParticipantWei);
    }

    function isDistributed(uint256 _trialId) external view returns (bool) {
        return pools[_trialId].screeningDistributed;
    }

    function isPoolFunded(uint256 _trialId) external view returns (bool) {
        return pools[_trialId].totalDepositedWei > 0;
    }

    function getParticipantCount(uint256 _trialId) external view returns (uint256) {
        return pools[_trialId].participants.length;
    }

    function getTotalDeposited(uint256 _trialId) external view returns (uint256) {
        return pools[_trialId].totalDepositedWei;
    }

    receive() external payable {}
}
