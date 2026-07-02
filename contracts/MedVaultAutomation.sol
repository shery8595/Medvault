// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./TrialManager.sol";
import "./SponsorIncentiveVault.sol";

/**
 * @title MedVaultAutomation
 * @notice Automates clinical trial finalization using Chainlink Automation
 * @dev Single task type:
 *   Type 1: Finalize expired trials (distribute rewards + deactivate)
 * @dev Note: Type 0 (queued eligibility checks) was removed - the anonymous flow
 *      handles eligibility via MedVaultRegistry.applyToTrial
 */
contract MedVaultAutomation is AutomationCompatibleInterface {
    TrialManager public trialManager;
    SponsorIncentiveVault public vault;
    
    address public owner;
    address public pendingOwner; // FINDING 11: Two-step ownership transfer
    
    // Track which trials have already been finalized to avoid re-processing
    mapping(uint256 => bool) public finalized;

    // L-5: Chainlink forwarder address for access control
    address public chainlinkForwarder;

    /// @notice AUDIT-FIX-M-3: Timelock before changing trusted contract addresses.
    uint256 public constant READER_CHANGE_DELAY = 6 hours;
    address payable public pendingVault;
    uint256 public vaultChangeEta;
    address public pendingChainlinkForwarder;
    uint256 public forwarderChangeEta;

    event TrialFinalized(uint256 indexed trialId, bool distributed, bool deactivated);
    event DistributionBatchFailed(uint256 indexed trialId, bytes reason);
    /// @notice M-2: Trial removed from automation after repeated distribution batch failures.
    event TrialQuarantined(uint256 indexed trialId, uint256 consecutiveFailures);
    event OwnershipProposed(address indexed proposedOwner); // FINDING 11
    event OwnershipAccepted(address indexed newOwner); // FINDING 11

    constructor(
        address _trialManager,
        address payable _vault,
        address _chainlinkForwarder
    ) {
        require(_chainlinkForwarder != address(0), "Zero forwarder");
        owner = msg.sender;
        trialManager = TrialManager(_trialManager);
        vault = SponsorIncentiveVault(_vault);
        chainlinkForwarder = _chainlinkForwarder;
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

    function setVault(address payable _vault) external onlyOwner {
        revert("Use scheduleVault + applyVault");
    }

    function scheduleVault(address payable _vault) external onlyOwner {
        require(_vault != address(0), "Zero vault");
        pendingVault = _vault;
        vaultChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    function applyVault() external onlyOwner {
        require(vaultChangeEta != 0 && block.timestamp >= vaultChangeEta, "Timelock active");
        vault = SponsorIncentiveVault(pendingVault);
        vaultChangeEta = 0;
        pendingVault = payable(address(0));
    }

    /**
     * @notice L-5: Set the Chainlink forwarder address for access control
     * @param _forwarder The Chainlink Automation forwarder address
     */
    function setChainlinkForwarder(address _forwarder) external onlyOwner {
        revert("Use scheduleChainlinkForwarder + applyChainlinkForwarder");
    }

    function scheduleChainlinkForwarder(address _forwarder) external onlyOwner {
        require(_forwarder != address(0), "Zero address");
        pendingChainlinkForwarder = _forwarder;
        forwarderChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    function applyChainlinkForwarder() external onlyOwner {
        require(forwarderChangeEta != 0 && block.timestamp >= forwarderChangeEta, "Timelock active");
        chainlinkForwarder = pendingChainlinkForwarder;
        forwarderChangeEta = 0;
        pendingChainlinkForwarder = address(0);
    }

    /**
     * @notice L-5: Modifier to restrict access to Chainlink forwarder or owner
     */
    modifier onlyForwarder() {
        require(
            msg.sender == chainlinkForwarder || msg.sender == owner,
            "Only forwarder or owner"
        );
        _;
    }


    // FINDING 12: Track active trial IDs for O(1) lookup instead of O(n) scan
    uint256[] public activeTrialIds;
    mapping(uint256 => uint256) private activeTrialIndex; // trialId => index in activeTrialIds (+1, 0 = not active)

    /// @notice H-13: Trials past endTime queued for finalization (avoids O(n) checkUpkeep scan).
    uint256[] public expiredTrialIds;
    mapping(uint256 => uint256) public expiredTrialIndex; // trialId => index+1 in expiredTrialIds

    /// @notice M-2: Trials quarantined after repeated batch failures (automation skips them).
    uint256[] public quarantinedTrialIds;
    mapping(uint256 => uint256) private quarantinedTrialIndex; // trialId => index+1 in quarantinedTrialIds
    mapping(uint256 => uint256) public consecutiveBatchFailures;
    uint256 public activeScanCursor;

    /**
     * @notice FINDING 12: Mark a trial as active for efficient checkUpkeep
     * @dev Called by TrialManager when a trial is created
     */
    function onTrialCreated(uint256 _trialId) external {
        require(msg.sender == address(trialManager), "Only TrialManager");
        if (activeTrialIndex[_trialId] == 0) {
            activeTrialIds.push(_trialId);
            activeTrialIndex[_trialId] = activeTrialIds.length; // Store index+1
        }
    }

    /**
     * @notice FINDING 12: Mark a trial as inactive for efficient checkUpkeep
     * @dev Called by TrialManager when a trial is deactivated
     */
    function onTrialDeactivated(uint256 _trialId) external {
        require(msg.sender == address(trialManager), "Only TrialManager");
        _removeFromActive(_trialId);
        _removeFromExpired(_trialId);
    }

    function _removeFromActive(uint256 _trialId) private {
        uint256 index = activeTrialIndex[_trialId];
        if (index > 0) {
            uint256 lastIndex = activeTrialIds.length - 1;
            uint256 lastTrialId = activeTrialIds[lastIndex];
            if (index - 1 != lastIndex) {
                activeTrialIds[index - 1] = lastTrialId;
                activeTrialIndex[lastTrialId] = index;
            }
            activeTrialIds.pop();
            activeTrialIndex[_trialId] = 0;
        }
    }

    function _removeFromExpired(uint256 _trialId) private {
        uint256 index = expiredTrialIndex[_trialId];
        if (index > 0) {
            uint256 lastIndex = expiredTrialIds.length - 1;
            uint256 lastTrialId = expiredTrialIds[lastIndex];
            if (index - 1 != lastIndex) {
                expiredTrialIds[index - 1] = lastTrialId;
                expiredTrialIndex[lastTrialId] = index;
            }
            expiredTrialIds.pop();
            expiredTrialIndex[_trialId] = 0;
        }
    }

    function isQuarantined(uint256 _trialId) public view returns (bool) {
        return quarantinedTrialIndex[_trialId] > 0;
    }

    function _addToQuarantined(uint256 _trialId) private {
        if (quarantinedTrialIndex[_trialId] != 0) return;
        quarantinedTrialIds.push(_trialId);
        quarantinedTrialIndex[_trialId] = quarantinedTrialIds.length;
        _removeFromActive(_trialId);
        _removeFromExpired(_trialId);
        emit TrialQuarantined(_trialId, consecutiveBatchFailures[_trialId]);
    }

    function _recordBatchFailure(uint256 _trialId) private {
        consecutiveBatchFailures[_trialId]++;
        if (consecutiveBatchFailures[_trialId] >= MAX_BATCH_FAILURES) {
            _addToQuarantined(_trialId);
        }
    }

    function _recordBatchSuccess(uint256 _trialId) private {
        consecutiveBatchFailures[_trialId] = 0;
    }

    function _advanceActiveScanCursor() private {
        uint256 len = activeTrialIds.length;
        if (len > 0) {
            activeScanCursor = (activeScanCursor + ACTIVE_SCAN_BATCH_SIZE) % len;
        }
    }

    function _queueExpiredTrial(uint256 _trialId) private {
        if (expiredTrialIndex[_trialId] != 0 || finalized[_trialId]) return;
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!trial.active || trial.endTime == 0 || block.timestamp < trial.endTime) return;
        expiredTrialIds.push(_trialId);
        expiredTrialIndex[_trialId] = expiredTrialIds.length;
        _removeFromActive(_trialId);
    }

    function _pruneExpiredTrials() private {
        uint256 pruned = 0;
        uint256 i = 0;
        while (i < activeTrialIds.length && pruned < MAX_PRUNE_PER_UPKEEP) {
            uint256 trialId = activeTrialIds[i];
            TrialManager.Trial memory trial = trialManager.getTrial(trialId);
            if (trial.active && trial.endTime > 0 && block.timestamp >= trial.endTime && !finalized[trialId]) {
                _queueExpiredTrial(trialId);
                pruned++;
            } else {
                i++;
            }
        }
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 0; i < expiredTrialIds.length; i++) {
            uint256 trialId = expiredTrialIds[i];
            if (!finalized[trialId] && !isQuarantined(trialId)) {
                TrialManager.Trial memory trial = trialManager.getTrial(trialId);
                if (trial.endTime > 0 && block.timestamp >= trial.endTime) {
                    return (true, abi.encode(uint8(1), trialId));
                }
            }
        }

        uint256 activeLen = activeTrialIds.length;
        if (activeLen > 0) {
            uint256 scanned = 0;
            uint256 idx = activeScanCursor % activeLen;
            while (scanned < ACTIVE_SCAN_BATCH_SIZE && scanned < activeLen) {
                uint256 trialId = activeTrialIds[idx];
                if (!finalized[trialId] && !isQuarantined(trialId)) {
                    TrialManager.Trial memory trial = trialManager.getTrial(trialId);
                    if (trial.active && trial.endTime > 0 && block.timestamp >= trial.endTime) {
                        return (true, abi.encode(uint8(1), trialId));
                    }
                }
                idx = (idx + 1) % activeLen;
                scanned++;
            }
        }

        return (false, "");
    }

    uint256 public constant PAGINATED_DISTRIBUTION_THRESHOLD = 20;
    uint256 public constant PAGINATION_BATCH_SIZE = 10;
    uint256 public constant MAX_PRUNE_PER_UPKEEP = 10;
    /// @notice M-2: Quarantine a trial after this many consecutive distribution batch failures.
    uint256 public constant MAX_BATCH_FAILURES = 5;
    /// @notice M-2: Max active trials scanned per checkUpkeep fallback (gas bound).
    uint256 public constant ACTIVE_SCAN_BATCH_SIZE = 10;

    mapping(uint256 => bool) public distributionInProgress;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function performUpkeep(bytes calldata performData) external override onlyForwarder nonReentrant {
        _pruneExpiredTrials();
        _advanceActiveScanCursor();
        (uint8 taskType, uint256 indexOrId) = abi.decode(performData, (uint8, uint256));
        
        if (taskType == 1) {
            uint256 trialId = indexOrId;
            require(!isQuarantined(trialId), "Trial quarantined");
            require(
                activeTrialIndex[trialId] > 0 || expiredTrialIndex[trialId] > 0,
                "Trial not in active set"
            );
            TrialManager.Trial memory trial = trialManager.getTrial(trialId);
            
            require(trial.active, "Trial not active");
            require(trial.endTime > 0 && block.timestamp >= trial.endTime, "Trial not expired");
            require(!finalized[trialId], "Already finalized");
            
            bool distributed = false;
            uint256 pCount = vault.getParticipantCount(trialId);

            if (pCount > 0 && !vault.isDistributed(trialId)) {
                if (pCount > PAGINATED_DISTRIBUTION_THRESHOLD) {
                    uint256 startIndex = vault.lastProcessedIndex(trialId, 0);
                    if (startIndex == 0 && !vault.paginationStarted(trialId, 0)) {
                        distributionInProgress[trialId] = true;
                    }
                    (bool success, bytes memory reason) = address(vault).call(
                        abi.encodeWithSignature(
                            "distributePartialPaginated(uint256,uint256,uint256,uint256)",
                            trialId,
                            0,
                            startIndex,
                            PAGINATION_BATCH_SIZE
                        )
                    );
                    if (!success) {
                        emit DistributionBatchFailed(trialId, reason);
                        _recordBatchFailure(trialId);
                    } else {
                        _recordBatchSuccess(trialId);
                        distributed = vault.milestoneDistributed(trialId, 0) || vault.isDistributed(trialId);
                    }
                } else {
                    (bool success, bytes memory reason) = address(vault).call(
                        abi.encodeWithSignature("distribute(uint256)", trialId)
                    );
                    if (!success) {
                        emit DistributionBatchFailed(trialId, reason);
                        _recordBatchFailure(trialId);
                    } else {
                        _recordBatchSuccess(trialId);
                        distributed = vault.isDistributed(trialId);
                    }
                }
            } else if (vault.isDistributed(trialId)) {
                distributed = true;
            } else if (pCount == 0) {
                distributed = true;
            }

            // H-1: Do not deactivate until screening distribution is fully complete
            // (including all paginated batches). Keep trial in activeTrialIds until then.
            bool deactivated = false;
            if (distributed) {
                try trialManager.deactivateTrial(trialId) {
                    deactivated = true;
                } catch {}
            }

            if (distributed && deactivated) {
                finalized[trialId] = true;
                distributionInProgress[trialId] = false;
                _removeFromExpired(trialId);
            }

            emit TrialFinalized(trialId, distributed, deactivated);
        }
    }
}
