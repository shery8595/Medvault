// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ConfidentialETH.sol";
import "./TrialManager.sol";
import "./EligibilityEngine.sol";
import "./TrialMilestoneManager.sol";
import "./DataAccessLog.sol";

// M-3: Used to verify a trial's sponsor is still an active verified sponsor at distribution time.
interface ISponsorRegistry {
    function isVerifiedSponsor(address _sponsor) external view returns (bool);
}

/**
 * @title SponsorIncentiveVault
 * @notice Manages encrypted incentive pools for clinical trials
 * @dev V1.2.1: Phase-Gated Settlement
 *   - Trial end -> ONLY Milestone 0 (Screening) is paid automatically.
 *   - Remaining milestones are released manually by sponsor via distributeMilestoneToParticipant.
 *   - No global lock after screening distribution, so post-trial promotion still works.
 *   - Fallback: If no milestones are set, full share is distributed (legacy behavior).
 */
contract SponsorIncentiveVault is ZamaEthereumConfig, EIP712 {
    ConfidentialETH public cETH;
    TrialManager public trialManager;
    EligibilityEngine public eligibilityEngine;
    TrialMilestoneManager public milestoneManager;
    DataAccessLog public dataAccessLog;
    address public automationContract;
    address public owner;
    address public pendingOwner; // FINDING 11: Two-step ownership transfer
    ISponsorRegistry public sponsorRegistry; // M-3: re-verify sponsor at sensitive actions

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    bytes32 private constant CLAIM_AUTH_TYPEHASH =
        keccak256(
            "ClaimAuthorization(uint256 trialId,uint256 nullifier,address permitHolder,address destination,uint256 units,uint256 nonce,uint256 deadline)"
        );

    bytes32 private constant REGISTER_AUTH_TYPEHASH =
        keccak256(
            "RegisterAuthorization(uint256 trialId,uint256 nullifier,address permitHolder,uint256 nonce,uint256 deadline)"
        );

    /// @dev Replay protection for gasless claim/register authorizations.
    mapping(bytes32 => bool) public claimAuthUsed;

    // FINDING 5: Maximum participants per trial to prevent gas DoS
    uint256 public constant MAX_PARTICIPANTS = 200;
    uint256 public constant DISTRIBUTE_BATCH_SIZE = 50;
    uint256 public constant RECLAIM_GRACE_PERIOD = 90 days;

    struct IncentivePool {
        uint256 totalDepositedWei; // Plaintext for distribution calculations
        uint256 totalDistributedWei; // CRIT-2: Track actual distribution to prevent overdistribution
        euint64 encryptedPoolSize; // Zama FHE: Encrypted pool size - sponsor can see, others cannot
        address[] participants;
        bool screeningDistributed; // V1.2.1: replaces blanket `distributed` flag
        bool fundingLocked; // LOW-4: Lock funding after participants register
        mapping(address => bool) isRegistered;
    }

    mapping(uint256 => IncentivePool) private pools;
    // trialId => milestoneIndex => distributed (legacy / bulk distributePartial)
    mapping(uint256 => mapping(uint256 => bool)) public milestoneDistributed;
    // trialId => patient => milestoneIndex => paid
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public participantMilestonePaid;
    // HIGH-3: trialId => nullifier => used (prevent double-registration with same nullifier)
    mapping(uint256 => mapping(uint256 => bool)) private nullifierUsedForRegistration;
    // C-1: Prevent distributions after reclaimUndistributed is called
    mapping(uint256 => bool) public reclaimFinalized;
    // M-1: Track if paginated distribution is in progress to prevent race with distributePartial
    mapping(uint256 => mapping(uint256 => bool)) public paginationStarted;
    // MED-1: Track last processed index for sequential batch validation
    mapping(uint256 => mapping(uint256 => uint256)) public lastProcessedIndex;
    // M-1: Track milestone remainder payout (first eligible completer receives dust)
    mapping(uint256 => mapping(uint256 => bool)) public milestoneRemainderPaid;
    // H-1: Per-milestone wei actually credited (paginated batches increment incrementally)
    mapping(uint256 => mapping(uint256 => uint256)) public milestoneDistributedWei;

    event IncentiveFunded(uint256 indexed trialId, address indexed sponsor);
    event AnonymousParticipantRegistered(uint256 indexed trialId, uint256 indexed nullifier);
    event RewardsDistributed(uint256 indexed trialId);
    event MilestoneRewardsDistributed(uint256 indexed trialId, uint256 milestoneIndex);
    event RewardDustSkipped(uint256 indexed trialId, uint256 milestoneIndex);
    event ClaimInitiated(uint256 indexed trialId, address indexed permitHolder, bytes32 sufficientHandle);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    constructor(address payable _cETH, address _trialManager, address _eligibilityEngine)
        EIP712("MedVault SponsorIncentiveVault", "1")
    {
        owner = msg.sender;
        cETH = ConfidentialETH(_cETH);
        trialManager = TrialManager(_trialManager);
        eligibilityEngine = EligibilityEngine(_eligibilityEngine);
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

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function setAutomationContract(address _automation) external onlyOwner {
        require(_automation != address(0), "Zero address");
        automationContract = _automation;
    }

    function setMilestoneManager(address _milestoneManager) external onlyOwner {
        require(_milestoneManager != address(0), "Zero address");
        milestoneManager = TrialMilestoneManager(_milestoneManager);
    }

    function setDataAccessLog(address _dataAccessLog) external onlyOwner {
        require(_dataAccessLog != address(0), "Zero address");
        dataAccessLog = DataAccessLog(_dataAccessLog);
    }

    /// @notice M-3: Set the SponsorRegistry used to re-verify trial sponsors at sensitive actions.
    function setSponsorRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Zero address");
        sponsorRegistry = ISponsorRegistry(_registry);
    }

    /// @dev M-3: If a SponsorRegistry is configured, require the trial's sponsor is still verified.
    ///      This prevents a removed/malicious sponsor from distributing rewards or reclaiming ETH.
    function _requireSponsorStillVerified(address _sponsor) internal view {
        if (address(sponsorRegistry) != address(0)) {
            require(sponsorRegistry.isVerifiedSponsor(_sponsor), "Sponsor no longer verified");
        }
    }

    /**
     * @notice Per-participant milestone share: milestone pool / total registered participants.
     * @dev Invariant: completers never receive more because others dropped out.
     */
    function _perParticipantMilestoneWei(
        uint256 _trialId,
        uint256 _milestoneIndex
    ) internal view returns (uint256 milestoneShareWei, uint256 perParticipantWei) {
        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        uint256 totalWei = pools[_trialId].totalDepositedWei;
        milestoneShareWei = (totalWei * milestones[_milestoneIndex].weightBps) / 10000;
        perParticipantWei = milestoneShareWei / pCount;
    }

    /**
     * @notice Credit reward wei to participant cETH balance; skip sub-UNIT_SCALE dust without reverting.
     * @dev Sub-UNIT_SCALE dust accumulates in the vault and is reclaimable by the sponsor after distribution.
     *      H-2: depositFor failures now revert instead of being silently swallowed. Previously a failed
     *      credit left the participant marked as paid with zero funds and the residual became sponsor-
     *      reclaimable — a silent loss of rewards. Halting the distribution on a genuine cETH failure
     *      is preferable to silently stealing participant rewards; the caller can retry once cETH recovers.
     * @return creditedWei Actual wei deposited into ConfidentialETH.
     */
    function _creditReward(
        uint256 _trialId,
        uint256 _milestoneIndex,
        address _participant,
        uint256 _amountWei
    ) internal returns (uint256 creditedWei) {
        if (_amountWei == 0) return 0;
        uint256 unitScale = cETH.UNIT_SCALE();
        uint256 units = _amountWei / unitScale;
        if (units == 0) {
            emit RewardDustSkipped(_trialId, _milestoneIndex);
            return 0;
        }
        creditedWei = units * unitScale;
        // H-2: revert on credit failure rather than emitting-and-returning 0, so participants are
        // never marked paid without receiving funds.
        cETH.depositFor{value: creditedWei}(_participant);
    }

    /// @dev M-4: True when every milestone is bulk-marked distributed OR has no eligible-unpaid participants.
    function _hasEligibleUnpaid(uint256 _trialId, uint256 _milestoneIndex) internal view returns (bool) {
        uint256 pCount = pools[_trialId].participants.length;
        for (uint256 i = 0; i < pCount; i++) {
            address p = pools[_trialId].participants[i];
            bool isEligible = (_milestoneIndex == 0) ||
                (milestoneManager.getParticipantProgress(_trialId, p) >= _milestoneIndex + 1);
            if (isEligible && !participantMilestonePaid[_trialId][p][_milestoneIndex]) {
                return true;
            }
        }
        return false;
    }

    function _allMilestonesDistributed(uint256 _trialId) internal view returns (bool) {
        if (address(milestoneManager) == address(0)) {
            return pools[_trialId].screeningDistributed;
        }
        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        if (milestones.length == 0) {
            return pools[_trialId].screeningDistributed;
        }
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneDistributed[_trialId][i]) {
                continue;
            }
            if (_hasEligibleUnpaid(_trialId, i)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @notice Sponsor deposits ETH to fund a trial's incentive pool
     * @dev Zama FHE: Pool size is tracked both in plaintext (for distribution math)
     *      and as encrypted euint64 (for privacy - only sponsor can view actual size)
     * @dev M-6: DESIGN NOTE: The ETH remains in this contract until distribution.
     *      It is NOT immediately deposited into cETH. Participants' encrypted cETH
     *      balances are only updated at distribution time. This is intentional to
     *      maintain accounting consistency between totalDepositedWei (plaintext) and
     *      the actual ETH held. The encryptedPoolSize is for sponsor analytics only.
     */
    function fundTrial(uint256 _trialId) external payable {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == trial.sponsor, "Only sponsor can fund");
        require(trial.active, "Trial not active");
        // AUDIT-HIGH: previously a sponsor could fund a trial whose endTime had passed;
        // those funds would immediately be distributable / reclaimable, confusing accounting.
        require(trial.endTime > block.timestamp, "Trial already ended");
        require(msg.value > 0, "Must send ETH");
        require(msg.value <= uint256(type(uint64).max) * cETH.UNIT_SCALE(), "Amount too large");
        require(!pools[_trialId].fundingLocked, "Funding locked after registration began");

        // Plaintext tracking for distribution calculations
        pools[_trialId].totalDepositedWei += msg.value;

        // M-7: prevent euint64 encrypted pool size from silently wrapping. The plaintext
        // totalDepositedWei (uint256) is the source of truth for distribution, but the sponsor-
        // decryptable encryptedPoolSize would wrap mod 2^64 and report a wrong (potentially tiny)
        // pool size after overflow. Cap cumulative units to uint64 max before the FHE add.
        uint256 cumulativeUnits = pools[_trialId].totalDepositedWei / cETH.UNIT_SCALE();
        require(cumulativeUnits <= type(uint64).max, "Encrypted pool size overflow");

        // Zama FHE: Encrypted pool size tracking
        uint64 units = uint64(msg.value / cETH.UNIT_SCALE());
        euint64 eAmount = FHE.asEuint64(units);
        if (FHE.isInitialized(pools[_trialId].encryptedPoolSize)) {
            pools[_trialId].encryptedPoolSize = FHE.add(pools[_trialId].encryptedPoolSize, eAmount);
        } else {
            pools[_trialId].encryptedPoolSize = eAmount;
        }
        FHE.allowThis(pools[_trialId].encryptedPoolSize);
        FHE.allow(pools[_trialId].encryptedPoolSize, trial.sponsor);

        emit IncentiveFunded(_trialId, msg.sender);
    }

    /**
     * @notice DEPRECATED: Register a participant for incentives (legacy flow)
     * @dev The legacy address-based eligibility flow has been removed.
     *      Patients must now use registerAnonymousParticipant() with a nullifier.
     */
    function registerParticipant(uint256 /* _trialId */, address /* _participant */) external pure {
        revert("Legacy registration deprecated. Use registerAnonymousParticipant(nullifier) instead.");
    }

    /**
     * @notice Distributes only Milestone 0 (Screening) rewards to all participants at trial end.
     * @dev V1.2.1: Phase-Gated. Only Milestone 0 is auto-distributed. Subsequent phases require
     *      manual sponsor promotion via distributeMilestoneToParticipant.
     *      Fallback: If no milestones are set, full share is distributed (legacy behavior).
     * @dev FINDING 5: This is the full distribution version - use distributePaginated for large pools
     */
    function distribute(uint256 _trialId) external nonReentrant {
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );
        // C-1: Prevent distributions after reclaim
        require(!reclaimFinalized[_trialId], "Distribution blocked after reclaim");

        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(trial.endTime > 0, "Trial does not exist");
        require(block.timestamp >= trial.endTime, "Trial not yet ended");
        require(pools[_trialId].totalDepositedWei > 0, "No incentive pool");
        require(!pools[_trialId].screeningDistributed, "Screening already distributed");
        // M-3: re-verify sponsor is still an active verified sponsor (when registry is configured).
        _requireSponsorStillVerified(trial.sponsor);

        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");
        require(pCount <= DISTRIBUTE_BATCH_SIZE, "Use distributePartialPaginated for large pools");

        uint256 totalWei = pools[_trialId].totalDepositedWei;
        uint256 perParticipantWei;
        uint256 distributeAmount = 0;

        // C-1: Verify ETH balance before distribution
        require(address(this).balance >= totalWei, "Insufficient ETH in vault");

        // V1.2.1: Phase-Gated - check if milestones are configured
        bool hasMilestones = address(milestoneManager) != address(0) &&
            milestoneManager.getMilestones(_trialId).length > 0;

        if (hasMilestones) {
            // Pay only Milestone 0 (Screening) weight to all participants
            (uint256 screeningWei, uint256 perParticipantWei_) = _perParticipantMilestoneWei(_trialId, 0);
            perParticipantWei = perParticipantWei_;
            uint256 remainder = screeningWei - (perParticipantWei * pCount);
            distributeAmount = 0;
            uint256 lastActuallyPaidIndex = type(uint256).max;

            for (uint256 i = 0; i < pCount; i++) {
                address participant = pools[_trialId].participants[i];
                if (!participantMilestonePaid[_trialId][participant][0]) {
                    participantMilestonePaid[_trialId][participant][0] = true;
                    uint256 amount = perParticipantWei;
                    distributeAmount += _creditReward(_trialId, 0, participant, amount);
                    lastActuallyPaidIndex = i;
                }
            }
            // L-9: pay remainder to the last actually-paid participant (not blindly index pCount-1).
            if (lastActuallyPaidIndex != type(uint256).max && remainder > 0) {
                milestoneRemainderPaid[_trialId][0] = true;
                distributeAmount += _creditReward(
                    _trialId,
                    0,
                    pools[_trialId].participants[lastActuallyPaidIndex],
                    remainder
                );
            }
        } else {
            // Fallback: No milestones -> full share to all participants (legacy behavior)
            perParticipantWei = totalWei / pCount;
            uint256 remainder = totalWei - (perParticipantWei * pCount);
            distributeAmount = 0;
            uint256 lastActuallyPaidIndexLegacy = type(uint256).max;

            for (uint256 i = 0; i < pCount; i++) {
                address participant = pools[_trialId].participants[i];
                uint256 amount = perParticipantWei;
                distributeAmount += _creditReward(_trialId, 0, participant, amount);
                lastActuallyPaidIndexLegacy = i;
            }
            if (lastActuallyPaidIndexLegacy != type(uint256).max && remainder > 0) {
                distributeAmount += _creditReward(
                    _trialId,
                    0,
                    pools[_trialId].participants[lastActuallyPaidIndexLegacy],
                    remainder
                );
            }
        }

        // CRIT-2: Track distribution
        pools[_trialId].totalDistributedWei += distributeAmount;

        pools[_trialId].screeningDistributed = true;

        if (hasMilestones) {
            milestoneDistributed[_trialId][0] = true;
            emit MilestoneRewardsDistributed(_trialId, 0);
        }

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("SCREENING_DISTRIBUTION", block.timestamp))
            );
        }

        emit RewardsDistributed(_trialId);
    }

    // FINDING 5: Paginated distribution for large pools
    /**
     * @notice Paginated distribution for large participant pools
     * @param _trialId The trial ID
     * @param _milestoneIndex The milestone to distribute
     * @param _startIndex Start index in participants array
     * @param _batchSize Number of participants to process in this batch
     * @dev CRIT-1: Fixed to compute perParticipantWei based on TOTAL eligible count across all batches
     */
    function distributePartialPaginated(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _startIndex,
        uint256 _batchSize
    ) external nonReentrant {
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );
        // C-1: Prevent distributions after reclaim
        require(!reclaimFinalized[_trialId], "Distribution blocked after reclaim");
        
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        if (_milestoneIndex == 0) {
            require(!pools[_trialId].screeningDistributed, "Screening already distributed");
        }
        require(!milestoneDistributed[_trialId][_milestoneIndex], "Milestone already distributed");

        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");

        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");
        require(_startIndex < pCount, "Invalid start index");

        // M-3: re-verify sponsor is still a verified sponsor (when registry is configured).
        _requireSponsorStillVerified(trialManager.getTrial(_trialId).sponsor);

        // MED-1: Validate sequential batch ordering
        if (_startIndex == 0) {
            // First batch - set pagination started flag
            paginationStarted[_trialId][_milestoneIndex] = true;
        } else {
            // Subsequent batches must be sequential
            require(_startIndex == lastProcessedIndex[_trialId][_milestoneIndex], "Batch must be sequential");
        }

        uint256 endIndex = _startIndex + _batchSize > pCount ? pCount : _startIndex + _batchSize;

        (uint256 milestoneShareWei, uint256 perParticipantWei) =
            _perParticipantMilestoneWei(_trialId, _milestoneIndex);
        uint256 remainder = milestoneShareWei - (perParticipantWei * pCount);

        uint256 distributedInThisCall = 0;
        uint256 lastPaidIndex = type(uint256).max;

        for (uint256 i = _startIndex; i < endIndex; i++) {
            address participant = pools[_trialId].participants[i];
            bool isEligible = (_milestoneIndex == 0) ||
                (milestoneManager.getParticipantProgress(_trialId, participant) >= _milestoneIndex + 1);

            if (isEligible && !participantMilestonePaid[_trialId][participant][_milestoneIndex]) {
                participantMilestonePaid[_trialId][participant][_milestoneIndex] = true;
                distributedInThisCall += _creditReward(_trialId, _milestoneIndex, participant, perParticipantWei);
                lastPaidIndex = i;
            }
        }

        if (endIndex == pCount && lastPaidIndex != type(uint256).max && remainder > 0) {
            require(!milestoneRemainderPaid[_trialId][_milestoneIndex], "Remainder already paid");
            milestoneRemainderPaid[_trialId][_milestoneIndex] = true;
            distributedInThisCall += _creditReward(
                _trialId,
                _milestoneIndex,
                pools[_trialId].participants[lastPaidIndex],
                remainder
            );
        }

        require(
            pools[_trialId].totalDistributedWei + distributedInThisCall <= pools[_trialId].totalDepositedWei,
            "Would exceed pool balance"
        );

        // MED-1: Update last processed index for sequential validation
        lastProcessedIndex[_trialId][_milestoneIndex] = endIndex;

        pools[_trialId].totalDistributedWei += distributedInThisCall;
        milestoneDistributedWei[_trialId][_milestoneIndex] += distributedInThisCall;
        require(
            milestoneDistributedWei[_trialId][_milestoneIndex] <= milestoneShareWei,
            "Milestone distribution exceeds share"
        );

        // Only mark milestone as fully distributed if we processed all participants
        if (endIndex == pCount) {
            milestoneDistributed[_trialId][_milestoneIndex] = true;
            if (_milestoneIndex == 0) {
                pools[_trialId].screeningDistributed = true;
            }
        }

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("PARTIAL_PAGINATED", _milestoneIndex, _startIndex, block.timestamp))
            );
        }

        emit MilestoneRewardsDistributed(_trialId, _milestoneIndex);
    }

    /**
     * @notice HIGH-3: Reset pagination state for stuck paginations
     * @dev Allows owner to reset pagination state when a milestone distribution gets stuck
     *      due to no eligible participants remaining in subsequent batches
     * @param _trialId The trial ID
     * @param _milestoneIndex The milestone index to reset
     */
    function resetPaginationState(uint256 _trialId, uint256 _milestoneIndex) external onlyOwner {
        require(!milestoneDistributed[_trialId][_milestoneIndex], "Already completed");
        paginationStarted[_trialId][_milestoneIndex] = false;
        lastProcessedIndex[_trialId][_milestoneIndex] = 0;
    }

    /**
     * @notice Distributes rewards for a specific milestone to all eligible participants.
     * @dev Only Milestone 0 is auto-distributed. Subsequent phases can be bulk-distributed by sponsor.
     * @dev Per-participant share uses total registered count (pCount), not eligible-only count.
     */
    function distributePartial(uint256 _trialId, uint256 _milestoneIndex) external nonReentrant {
        require(
            msg.sender == automationContract ||
            msg.sender == trialManager.getTrial(_trialId).sponsor,
            "Not authorized"
        );
        require(!reclaimFinalized[_trialId], "Distribution blocked after reclaim");
        require(!paginationStarted[_trialId][_milestoneIndex], "Use paginated version");
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        require(!milestoneDistributed[_trialId][_milestoneIndex], "Milestone already distributed");

        uint256 pCount = pools[_trialId].participants.length;
        require(pCount > 0, "No participants");

        // M-3: re-verify sponsor is still a verified sponsor (when registry is configured).
        _requireSponsorStillVerified(trialManager.getTrial(_trialId).sponsor);

        (uint256 milestoneShareWei, uint256 perParticipantWei) =
            _perParticipantMilestoneWei(_trialId, _milestoneIndex);
        uint256 remainder = milestoneShareWei - (perParticipantWei * pCount);

        require(address(this).balance >= milestoneShareWei, "Insufficient ETH in vault");
        require(
            pools[_trialId].totalDistributedWei + milestoneShareWei <= pools[_trialId].totalDepositedWei,
            "Would exceed pool balance"
        );

        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < pCount; i++) {
            address p = pools[_trialId].participants[i];
            bool isEligible = (_milestoneIndex == 0) ||
                (milestoneManager.getParticipantProgress(_trialId, p) >= _milestoneIndex + 1);
            if (isEligible && !participantMilestonePaid[_trialId][p][_milestoneIndex]) {
                eligibleCount++;
            }
        }
        require(eligibleCount > 0, "No eligible participants");

        uint256 distributedInThisCall = 0;
        uint256 lastPaidIndex = type(uint256).max;

        for (uint256 i = 0; i < pCount; i++) {
            address participant = pools[_trialId].participants[i];
            bool isEligible = (_milestoneIndex == 0) ||
                (milestoneManager.getParticipantProgress(_trialId, participant) >= _milestoneIndex + 1);

            if (isEligible && !participantMilestonePaid[_trialId][participant][_milestoneIndex]) {
                participantMilestonePaid[_trialId][participant][_milestoneIndex] = true;
                distributedInThisCall += _creditReward(_trialId, _milestoneIndex, participant, perParticipantWei);
                lastPaidIndex = i;
            }
        }

        if (lastPaidIndex != type(uint256).max && remainder > 0) {
            require(!milestoneRemainderPaid[_trialId][_milestoneIndex], "Remainder already paid");
            milestoneRemainderPaid[_trialId][_milestoneIndex] = true;
            distributedInThisCall += _creditReward(
                _trialId,
                _milestoneIndex,
                pools[_trialId].participants[lastPaidIndex],
                remainder
            );
        }

        pools[_trialId].totalDistributedWei += distributedInThisCall;
        milestoneDistributedWei[_trialId][_milestoneIndex] += distributedInThisCall;
        require(
            milestoneDistributedWei[_trialId][_milestoneIndex] <= milestoneShareWei,
            "Milestone distribution exceeds share"
        );

        milestoneDistributed[_trialId][_milestoneIndex] = true;
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("PARTIAL_DISTRIBUTION", _milestoneIndex, block.timestamp))
            );
        }

        emit MilestoneRewardsDistributed(_trialId, _milestoneIndex);
    }

    /**
     * @notice Distribute reward for a specific milestone to a specific participant.
     * @dev V1.2.1: No longer blocked by a global distributed flag. Can be called anytime
     *      after the sponsor promotes a patient, including post-trial-end.
     */
    function distributeMilestoneToParticipant(uint256 _trialId, address _participant, uint256 _milestoneIndex) external nonReentrant {
        require(_milestoneIndex > 0, "Use distribute() for screening milestone");
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == automationContract ||
            msg.sender == trial.sponsor,
            "Not authorized"
        );
        // C-1: Prevent distributions after reclaim
        require(!reclaimFinalized[_trialId], "Distribution blocked after reclaim");
        // M-3: re-verify sponsor is still a verified sponsor (when registry is configured).
        _requireSponsorStillVerified(trial.sponsor);
        // H-1: Do not allow individual distribution once the milestone has been bulk-distributed
        // (distributePartial / distributePartialPaginated). Previously this path ignored the
        // milestoneDistributed flag, which could double-pay the remainder (those paths set
        // milestoneRemainderPaid, but the two flags were not unified — see H-1 in the audit).
        require(!milestoneDistributed[_trialId][_milestoneIndex], "Milestone already distributed");
        // V1.2.1: Removed the blanket `distributed` guard — per-milestone paid mapping is the only guard.
        require(pools[_trialId].isRegistered[_participant], "Participant not registered");

        TrialMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");

        uint256 progress = milestoneManager.getParticipantProgress(_trialId, _participant);
        bool isEligible = (_milestoneIndex == 0) || (progress >= _milestoneIndex + 1);
        require(isEligible, "Milestone not completed by participant");

        require(!participantMilestonePaid[_trialId][_participant][_milestoneIndex], "Already paid for this milestone");

        (uint256 milestoneShareWei, uint256 perParticipantWei) =
            _perParticipantMilestoneWei(_trialId, _milestoneIndex);
        uint256 pCount = pools[_trialId].participants.length;
        uint256 remainder = milestoneShareWei - (perParticipantWei * pCount);

        uint256 amount = perParticipantWei;
        if (!milestoneRemainderPaid[_trialId][_milestoneIndex] && remainder > 0) {
            amount += remainder;
            milestoneRemainderPaid[_trialId][_milestoneIndex] = true;
        }

        require(address(this).balance >= amount, "Insufficient ETH in vault");

        uint256 credited = _creditReward(_trialId, _milestoneIndex, _participant, amount);
        pools[_trialId].totalDistributedWei += credited;
        require(
            pools[_trialId].totalDistributedWei <= pools[_trialId].totalDepositedWei,
            "Distribution exceeds pool balance"
        );

        participantMilestonePaid[_trialId][_participant][_milestoneIndex] = true;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("INDIVIDUAL_MILESTONE_DISTRIBUTION", _participant, _milestoneIndex, block.timestamp))
            );
        }

        emit MilestoneRewardsDistributed(_trialId, _milestoneIndex);
    }

    /**
     * @notice Register an anonymous participant for incentives using nullifier proof
     * @dev HIGH-3: Anonymous patients cannot use registerParticipant (it checks legacy applications mapping)
     *      This allows anonymous patients to register after being accepted via the Semaphore flow.
     * @dev HIGH-2: PRIVACY LIMITATION - This function links the calling wallet (msg.sender) to the
     *      anonymous application. Prefer `registerAnonymousParticipantFor` (gasless EIP-712) so the
     *      main wallet or relayer submits without the patient EOA paying gas on-chain.
     * @param _trialId The trial ID
     * @param _nullifier The nullifier hash from the anonymous application
     */
    function registerAnonymousParticipant(uint256 _trialId, uint256 _nullifier) external {
        IncentivePool storage pool = pools[_trialId];
        require(pool.totalDepositedWei > 0, "No incentive pool");
        require(!pool.screeningDistributed, "Screening already finalized");

        // Fetch patient address from the EligibilityEngine
        address patient = eligibilityEngine.getDecryptPermitHolder(_nullifier, _trialId);
        require(patient != address(0), "No permit holder found");

        require(!pool.isRegistered[patient], "Already registered");
        // FINDING 5: Cap on participants
        require(pool.participants.length < MAX_PARTICIPANTS, "Pool at capacity");

        // HIGH-3: Prevent same nullifier being used for multiple registrations
        require(!nullifierUsedForRegistration[_trialId][_nullifier], "Nullifier already used for registration");

        // Check anonymous application status
        EligibilityEngine.ApplicationStatus status = eligibilityEngine.getAnonymousApplicationStatus(_nullifier, _trialId);
        require(status == EligibilityEngine.ApplicationStatus.Accepted, "Anonymous application must be accepted");
        require(
            eligibilityEngine.noirVerifiedResults(_nullifier, _trialId),
            "Noir attestation required"
        );

        // Access control: only the patient themselves or the trial sponsor can register
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == patient || msg.sender == trial.sponsor, "Only patient or sponsor can register");

        nullifierUsedForRegistration[_trialId][_nullifier] = true;

        // LOW-4: Lock funding once first participant registers
        if (pool.participants.length == 0) {
            pool.fundingLocked = true;
        }

        pool.participants.push(patient);
        pool.isRegistered[patient] = true;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PARTICIPANT_JOINED_POOL,
                _trialId,
                keccak256(abi.encodePacked(patient, block.timestamp))
            );
        }
        emit AnonymousParticipantRegistered(_trialId, _nullifier);
    }

    /**
     * @notice Gasless registration for anonymous participants via ephemeral EIP-712 authorization.
     * @dev Allows the main wallet or relayer to submit registration on behalf of the permit holder.
     */
    function registerAnonymousParticipantFor(
        uint256 _trialId,
        uint256 _nullifier,
        address _permitHolder,
        uint256 _nonce,
        uint256 _deadline,
        bytes calldata _signature
    ) external {
        IncentivePool storage pool = pools[_trialId];
        require(pool.totalDepositedWei > 0, "No incentive pool");
        require(!pool.screeningDistributed, "Screening already finalized");

        address patient = eligibilityEngine.getDecryptPermitHolder(_nullifier, _trialId);
        require(patient != address(0), "No permit holder found");
        require(_permitHolder == patient, "Permit holder mismatch");
        require(!pool.isRegistered[patient], "Already registered");
        require(pool.participants.length < MAX_PARTICIPANTS, "Pool at capacity");
        require(!nullifierUsedForRegistration[_trialId][_nullifier], "Nullifier already used for registration");

        EligibilityEngine.ApplicationStatus status = eligibilityEngine.getAnonymousApplicationStatus(
            _nullifier,
            _trialId
        );
        require(status == EligibilityEngine.ApplicationStatus.Accepted, "Anonymous application must be accepted");
        require(
            eligibilityEngine.noirVerifiedResults(_nullifier, _trialId),
            "Noir attestation required"
        );

        require(block.timestamp <= _deadline, "Signature expired");
        bytes32 authKey = keccak256(abi.encode(_permitHolder, _trialId, _nullifier, _nonce));
        require(!claimAuthUsed[authKey], "Auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_AUTH_TYPEHASH,
                _trialId,
                _nullifier,
                _permitHolder,
                _nonce,
                _deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, _signature);
        require(signer == _permitHolder, "Invalid register signature");

        claimAuthUsed[authKey] = true;
        nullifierUsedForRegistration[_trialId][_nullifier] = true;

        if (pool.participants.length == 0) {
            pool.fundingLocked = true;
        }

        pool.participants.push(patient);
        pool.isRegistered[patient] = true;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PARTICIPANT_JOINED_POOL,
                _trialId,
                keccak256(abi.encodePacked(patient, block.timestamp))
            );
        }
        emit AnonymousParticipantRegistered(_trialId, _nullifier);
    }

    /**
     * @notice Kick off a confidential withdraw-to for a participant's ephemeral balance.
     * @dev Completion is handled by the relayer via `ConfidentialETH.completeWithdrawTo` after publicDecrypt.
     */
    function claimParticipantRewards(
        uint256 _trialId,
        uint256 _nullifier,
        address _destination,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof
    ) external nonReentrant {
        address patient = eligibilityEngine.getDecryptPermitHolder(_nullifier, _trialId);
        require(patient != address(0), "No permit holder found");
        require(_destination != address(0), "Zero destination address");
        require(msg.sender == patient, "Only permit holder");
        require(_destination == msg.sender, "Destination must be permit holder");
        require(pools[_trialId].isRegistered[patient], "Patient not registered");

        cETH.requestWithdrawTo(patient, _destination, encryptedUnits, inputProof);
        bytes32 sufficientHandle = cETH.pendingWithdrawToHandle(patient);
        emit ClaimInitiated(_trialId, patient, sufficientHandle);
    }

    /**
     * @notice Gasless claim via EIP-712 authorization from the ephemeral permit holder.
     * @dev Any submitter (relayer or main wallet) may call; destination may differ from msg.sender.
     */
    function claimParticipantRewardsFor(
        uint256 _trialId,
        uint256 _nullifier,
        address _permitHolder,
        address _destination,
        uint256 _units,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof,
        uint256 _nonce,
        uint256 _deadline,
        bytes calldata _signature
    ) external nonReentrant {
        address patient = eligibilityEngine.getDecryptPermitHolder(_nullifier, _trialId);
        require(patient != address(0), "No permit holder found");
        require(_permitHolder == patient, "Permit holder mismatch");
        require(_destination != address(0), "Zero destination address");
        require(block.timestamp <= _deadline, "Signature expired");
        require(pools[_trialId].isRegistered[patient], "Patient not registered");

        bytes32 authKey = keccak256(abi.encode(_permitHolder, _trialId, _nullifier, _nonce));
        require(!claimAuthUsed[authKey], "Auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_AUTH_TYPEHASH,
                _trialId,
                _nullifier,
                _permitHolder,
                _destination,
                _units,
                _nonce,
                _deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, _signature);
        require(signer == _permitHolder, "Invalid claim signature");

        claimAuthUsed[authKey] = true;

        cETH.requestWithdrawTo(patient, _destination, encryptedUnits, inputProof);
        bytes32 sufficientHandle = cETH.pendingWithdrawToHandle(patient);
        emit ClaimInitiated(_trialId, patient, sufficientHandle);
    }

    /**
     * @notice Reclaim undistributed ETH after trial ends (CRIT-1 fix)
     * @dev MED-3: Callable by owner OR sponsor after trial end and screening distribution
     *      (or after trial end with zero participants — screening distribute never runs).
     *      Sends remaining balance to sponsor.
     * @param _trialId The trial ID
     */
    function reclaimUndistributed(uint256 _trialId) external nonReentrant {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == owner || msg.sender == trial.sponsor,
            "Not authorized: only owner or sponsor"
        );
        // M-3: always re-verify sponsor before sending ETH to trial.sponsor.
        _requireSponsorStillVerified(trial.sponsor);
        require(block.timestamp >= trial.endTime, "Trial not yet ended");
        bool noParticipants = pools[_trialId].participants.length == 0;
        require(
            noParticipants || block.timestamp >= trial.endTime + RECLAIM_GRACE_PERIOD,
            "Grace period not elapsed"
        );
        require(
            pools[_trialId].screeningDistributed || noParticipants,
            "Screening not yet distributed"
        );
        require(_allMilestonesDistributed(_trialId) || noParticipants, "Milestones not fully distributed");
        require(!reclaimFinalized[_trialId], "Already reclaimed");

        uint256 remaining = pools[_trialId].totalDepositedWei - pools[_trialId].totalDistributedWei;
        uint256 balanceRemaining = address(this).balance;
        if (remaining > balanceRemaining) {
            remaining = balanceRemaining;
        }
        require(remaining > 0, "Nothing to reclaim");

        reclaimFinalized[_trialId] = true;

        (bool success, ) = trial.sponsor.call{value: remaining}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Owner reclaims undistributed ETH when the trial sponsor is no longer verified.
     * @dev M-3: Routes funds to protocol owner instead of a removed/malicious sponsor address.
     */
    function reclaimAbandonedToOwner(uint256 _trialId) external onlyOwner nonReentrant {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (address(sponsorRegistry) != address(0)) {
            require(!sponsorRegistry.isVerifiedSponsor(trial.sponsor), "Sponsor still verified");
        }
        require(block.timestamp >= trial.endTime, "Trial not yet ended");
        bool noParticipants = pools[_trialId].participants.length == 0;
        require(
            noParticipants || block.timestamp >= trial.endTime + RECLAIM_GRACE_PERIOD,
            "Grace period not elapsed"
        );
        require(
            pools[_trialId].screeningDistributed || noParticipants,
            "Screening not yet distributed"
        );
        require(_allMilestonesDistributed(_trialId) || noParticipants, "Milestones not fully distributed");
        require(!reclaimFinalized[_trialId], "Already reclaimed");

        uint256 remaining = pools[_trialId].totalDepositedWei - pools[_trialId].totalDistributedWei;
        uint256 balanceRemaining = address(this).balance;
        if (remaining > balanceRemaining) {
            remaining = balanceRemaining;
        }
        require(remaining > 0, "Nothing to reclaim");

        reclaimFinalized[_trialId] = true;

        (bool success, ) = owner.call{value: remaining}("");
        require(success, "Transfer failed");
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

    /**
     * @notice H-4: Check if an address is a registered participant for a trial
     * @param _trialId The trial ID
     * @param _participant The address to check
     * @return True if registered participant, false otherwise
     */
    function isParticipantRegistered(uint256 _trialId, address _participant) external view returns (bool) {
        return pools[_trialId].isRegistered[_participant];
    }

    /**
     * @notice Sponsor-only plaintext total deposited (for distribution math).
     * @dev Participants should not rely on public pool size; use encrypted pool access instead.
     */
    function getTotalDeposited(uint256 _trialId) external view returns (uint256) {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == trial.sponsor || msg.sender == owner,
            "Not authorized"
        );
        return pools[_trialId].totalDepositedWei;
    }

    /**
     * @notice Zama FHE: Get encrypted pool size
     * @dev Only the sponsor can decrypt this to see actual pool size.
     *      Prevents participants from gaming behavior based on reward pot size.
     * @param _trialId The trial ID
     * @return The encrypted pool size in micro-ETH units
     */
    function getEncryptedPoolSize(uint256 _trialId) external view returns (euint64) {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(
            msg.sender == trial.sponsor || msg.sender == owner,
            "Not authorized"
        );
        return pools[_trialId].encryptedPoolSize;
    }

    /**
     * @notice Zama FHE: Request access to decrypt the encrypted pool size
     * @dev Non-view function to grant FHE.allow permission to caller.
     *      Must be called by sponsor to get decrypt permission.
     * @param _trialId The trial ID
     */
    function requestEncryptedPoolAccess(uint256 _trialId) external {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == trial.sponsor, "Only sponsor");
        FHE.allow(pools[_trialId].encryptedPoolSize, msg.sender);
    }

    /**
     * @notice FINDING 7: Revert direct ETH transfers with helpful message
     * @dev Prevents ETH from being locked forever in the contract
     */
    receive() external payable {
        revert("Use fundTrial(trialId) to fund a specific trial");
    }
}
