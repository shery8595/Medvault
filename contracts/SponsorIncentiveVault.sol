// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./ConfidentialETH.sol";
import {VaultDistributionLib} from "./lib/VaultDistributionLib.sol";
import {VaultConfidentialLib} from "./lib/VaultConfidentialLib.sol";
import {VaultStorage} from "./lib/VaultStorage.sol";
import {VaultTimelockLib} from "./lib/VaultTimelockLib.sol";
import {VaultReclaimLib} from "./lib/VaultReclaimLib.sol";
import {VaultClaimLib} from "./lib/VaultClaimLib.sol";
import {VaultRegistrationLib} from "./lib/VaultRegistrationLib.sol";
import {VaultChallengeLib} from "./lib/VaultChallengeLib.sol";
import {
    IVaultTrialManager,
    IVaultMilestoneManager,
    IVaultEligibilityEngine,
    IVaultDataAccessLog,
    IVaultBatchCredit,
    IVaultSponsorRegistry
} from "./lib/VaultInterfaces.sol";

/**
 * @title SponsorIncentiveVault
 * @notice Manages encrypted incentive pools for clinical trials
 * @dev V1.2.1: Phase-Gated Settlement
 *   - Trial end -> ONLY Milestone 0 (Screening) is paid automatically.
 *   - Remaining milestones are released manually by sponsor via distributeMilestoneToParticipant.
 *   - No global lock after screening distribution, so post-trial promotion still works.
 *   - Fallback: If no milestones are set, full share is distributed (legacy behavior).
 */
contract SponsorIncentiveVault is ZamaEthereumConfig, EIP712, IERC7984Receiver, IVaultBatchCredit {
    error AlreadyCompleted();
    error AlreadyPaidForThisMilestone();
    error AmountTooLarge();
    error BatchMustBeSequential();
    error BlockedAfterReclaim();
    error EncryptedPoolSizeOverflow();
    error FundingLockedAfterRegistrationBegan();
    error InsufficientETHInVault();
    error InvalidMilestoneIndex();
    error InvalidStartIndex();
    error MilestoneAlreadyDistributed();
    error MilestoneManagerNotSet();
    error MilestoneNotCompletedByParticipant();
    error MilestoneNotDistributed();
    error MustSendETH();
    error NoEligibleParticipants();
    error NoIncentivePool();
    error NoMilestonesConfigured();
    error NoParticipants();
    error NotAuthorized();
    error NotProposedOwner();
    error NothingToReclaim();
    error OnlyOwner();
    error OnlySponsor();
    error OnlySponsorCanFund();
    error PaginationInProgress();
    error ParticipantNotRegistered();
    error PoolNotFunded();
    error ReentrancyGuardReentrantCall();
    error ScreeningAlreadyDistributed();
    error TrialAlreadyEnded();
    error TrialDoesNotExist();
    error TrialNotActive();
    error TrialNotYetEnded();
    error UseDistributeForScreening();
    error UseDistributePartialPaginatedForLargePools();
    error UsePaginatedVersion();
    error ZeroAddress();
    error ConfidentialFundingDisabled();

    ConfidentialETH public cETH;
    IVaultTrialManager public trialManager;
    IVaultEligibilityEngine public eligibilityEngine;
    IVaultMilestoneManager public milestoneManager;
    IVaultDataAccessLog public dataAccessLog;
    address public automationContract;
    address public owner;
    address public pendingOwner; // FINDING 11: Two-step ownership transfer
    IVaultSponsorRegistry public sponsorRegistry; // M-3: re-verify sponsor at sensitive actions

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    /// @dev MED-2: set while payEligibleBatchWithCheckpoint runs so batch credit wrappers are callable.
    bool internal _batchCreditInProgress;

    bytes32 private constant CLAIM_AUTH_TYPEHASH =
        keccak256(
            "ClaimAuthorization(uint256 trialId,uint256 nullifier,address permitHolder,address destination,uint256 units,bytes32 encryptedAmountCommitment,uint256 nonce,uint256 deadline)"
        );

    bytes32 private constant REGISTER_AUTH_TYPEHASH =
        keccak256(
            "RegisterAuthorization(uint256 trialId,uint256 nullifier,address permitHolder,uint256 nonce,uint256 deadline)"
        );

    /// @dev Replay protection for gasless claim/register authorizations.
    mapping(bytes32 => bool) public claimAuthUsed;

    // FINDING 5: Maximum participants per trial to prevent gas DoS
    uint256 public constant MAX_PARTICIPANTS = 200;
    uint256 public constant DISTRIBUTE_BATCH_SIZE = 20;
    uint256 public constant RECLAIM_GRACE_PERIOD = 90 days;
    /// @notice Window for participants to confirm receipt after entitlement staging.
    uint256 public constant CHALLENGE_WINDOW = 7 days;
    /// @notice MEDIUM-2: claim window before owner sweep when staged entitlements remain unconfirmed.
    uint256 public constant PARTICIPANT_CLAIM_WINDOW = 7 days;
    /// @notice AUDIT-FIX-M-3: Timelock before changing trusted contract addresses.
    uint256 public constant READER_CHANGE_DELAY = 6 hours;
    bytes32 private constant _ROLE_AUTOMATION = keccak256("vault.automation");
    bytes32 private constant _ROLE_MILESTONE_MGR = keccak256("vault.milestoneManager");
    bytes32 private constant _ROLE_SPONSOR_REGISTRY = keccak256("vault.sponsorRegistry");
    bytes32 private constant _ROLE_DATA_ACCESS_LOG = keccak256("vault.dataAccessLog");
    mapping(bytes32 => address) internal _pendingAddress;
    mapping(bytes32 => uint256) internal _addressChangeEta;

    // Plan 04: callback data modes for atomic confidential flows
    uint8 private constant _FUND_ONLY_MODE = 0;
    uint8 private constant _FUND_AND_MILESTONES_MODE = 2;

    /// @dev CRIT-1 / LOW-2: Confidential cETH funding disabled until pool accounting is FHE-sum aware.
    bool public constant confidentialFundingEnabled = false;
    /// @dev LOW-2: Must be set true together with `confidentialFundingEnabled` after redesigning pool
    ///      accounting to track deposits/distributions as FHE sums (or via on-chain verifiable decryption).
    ///      `creditConfidentialFund` only updates `encryptedPoolSize`; plaintext `totalDepositedWei` cannot
    ///      be derived from an `euint64` without leaking.
    bool public constant confidentialFundingAccountingReady = false;

    mapping(uint256 => VaultStorage.IncentivePool) private pools;
    // trialId => milestoneIndex => distributed (legacy / bulk distributePartial)
    mapping(uint256 => mapping(uint256 => bool)) public milestoneDistributed;
    // trialId => patient => milestoneIndex => paid (set on confirmReceipt)
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public participantMilestonePaid;
    /// @notice Pull-model: entitlement staged at distribution, confirmed via decryption proof.
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public entitlementStaged;
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public confirmedPayout;
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) private stagedShareWei;
    /// @notice Encrypted paid-status for screening (milestone 0) — observers cannot read plaintext paid bit.
    mapping(uint256 => mapping(address => mapping(uint256 => ebool))) private participantMilestonePaidEnc;
    /// @notice trialId => participant => registration nullifier (for zero-revelation screening rewards).
    mapping(uint256 => mapping(address => uint256)) private participantNullifier;
    // HIGH-3: trialId => nullifier => used (prevent double-registration with same nullifier)
    mapping(uint256 => mapping(uint256 => bool)) private nullifierUsedForRegistration;
    // C-1: Prevent distributions after reclaimUndistributed is called
    mapping(uint256 => bool) public reclaimFinalized;
    // M-1: Track if paginated distribution is in progress to prevent race with distributePartial
    mapping(uint256 => mapping(uint256 => bool)) public paginationStarted;
    // MED-1: Track last processed index for sequential batch validation
    mapping(uint256 => mapping(uint256 => uint256)) public lastProcessedIndex;
    // Plan 00a: Global last paid participant index across paginated batches (remainder recipient)
    mapping(uint256 => mapping(uint256 => uint256)) public lastPaidParticipantIndex;
    // M-1: Track milestone remainder payout (first eligible completer receives dust)
    mapping(uint256 => mapping(uint256 => bool)) public milestoneRemainderPaid;
    // H-1: Per-milestone wei actually credited (paginated batches increment incrementally)
    mapping(uint256 => mapping(uint256 => uint256)) public milestoneDistributedWei;
    /// @notice Milestone-0 screening: ETH prefunded into vault cETH once per trial (batch FHE.select transfers).
    mapping(uint256 => bool) private screeningCethFunded;
    // M-5: Pull-pattern reclaim — sponsor/owner claims after reclaim is finalized
    mapping(uint256 => uint256) public pendingReclaimWei;
    mapping(uint256 => address) public pendingReclaimRecipient;
    /// @notice MEDIUM-2: timestamp when abandoned owner reclaim claim window opened for a trial.
    mapping(uint256 => uint256) public abandonedReclaimOpenedAt;

    event IncentiveFunded(uint256 indexed trialId, address indexed sponsor);
    event RewardsDistributed(uint256 indexed trialId);
    event MilestoneRewardsDistributed(uint256 indexed trialId, uint256 milestoneIndex);
    event RewardDustSkipped(uint256 indexed trialId, uint256 milestoneIndex);
    event TrialPoolSizeMadePublic(uint256 indexed trialId);
    event MilestoneDistributedPublicSignaled(uint256 indexed trialId, uint256 milestoneIndex);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);
    event StrandedCethRecovered(address indexed recipient);
    event ParticipantCreditFailed(
        uint256 indexed trialId,
        uint256 indexed milestoneIndex,
        address indexed participant,
        bytes reason
    );

    constructor(address payable _cETH, address _trialManager, address _eligibilityEngine)
        EIP712("MedVault SponsorIncentiveVault", "1")
    {
        owner = msg.sender;
        cETH = ConfidentialETH(_cETH);
        trialManager = IVaultTrialManager(_trialManager);
        eligibilityEngine = IVaultEligibilityEngine(_eligibilityEngine);
    }

    modifier onlyOwner() {
        if (!(msg.sender == owner)) revert OnlyOwner();
        _;
    }

    // FINDING 11: Two-step ownership transfer
    function proposeOwnership(address _newOwner) external onlyOwner {
        if (!(_newOwner != address(0))) revert ZeroAddress();
        pendingOwner = _newOwner;
        emit OwnershipProposed(_newOwner);
    }

    function acceptOwnership() external {
        if (!(msg.sender == pendingOwner)) revert NotProposedOwner();
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipAccepted(owner);
    }

    modifier nonReentrant() {
        if (!(_status != _ENTERED)) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function setAutomationContract(address _automation) external onlyOwner {
        revert("Use scheduleAutomationContract + applyAutomationContract");
    }

    function scheduleAutomationContract(address _automation) external onlyOwner {
        VaultTimelockLib.schedule(_pendingAddress, _addressChangeEta, _ROLE_AUTOMATION, _automation, READER_CHANGE_DELAY);
    }

    function applyAutomationContract() external onlyOwner {
        automationContract = VaultTimelockLib.applyPending(_pendingAddress, _addressChangeEta, _ROLE_AUTOMATION);
    }

    function setMilestoneManager(address _milestoneManager) external onlyOwner {
        revert("Use scheduleMilestoneManager + applyMilestoneManager");
    }

    function scheduleMilestoneManager(address _milestoneManager) external onlyOwner {
        VaultTimelockLib.schedule(
            _pendingAddress,
            _addressChangeEta,
            _ROLE_MILESTONE_MGR,
            _milestoneManager,
            READER_CHANGE_DELAY
        );
    }

    function applyMilestoneManager() external onlyOwner {
        milestoneManager = IVaultMilestoneManager(
            VaultTimelockLib.applyPending(_pendingAddress, _addressChangeEta, _ROLE_MILESTONE_MGR)
        );
    }

    function setDataAccessLog(address _dataAccessLog) external onlyOwner {
        revert("Use scheduleDataAccessLog + applyDataAccessLog");
    }

    function scheduleDataAccessLog(address _dataAccessLog) external onlyOwner {
        VaultTimelockLib.schedule(
            _pendingAddress,
            _addressChangeEta,
            _ROLE_DATA_ACCESS_LOG,
            _dataAccessLog,
            READER_CHANGE_DELAY
        );
    }

    function applyDataAccessLog() external onlyOwner {
        dataAccessLog = IVaultDataAccessLog(
            VaultTimelockLib.applyPending(_pendingAddress, _addressChangeEta, _ROLE_DATA_ACCESS_LOG)
        );
    }

    /// @notice M-3: Set the SponsorRegistry used to re-verify trial sponsors at sensitive actions.
    function setSponsorRegistry(address _registry) external onlyOwner {
        revert("Use scheduleSponsorRegistry + applySponsorRegistry");
    }

    function scheduleSponsorRegistry(address _registry) external onlyOwner {
        VaultTimelockLib.schedule(
            _pendingAddress,
            _addressChangeEta,
            _ROLE_SPONSOR_REGISTRY,
            _registry,
            READER_CHANGE_DELAY
        );
    }

    function applySponsorRegistry() external onlyOwner {
        sponsorRegistry = IVaultSponsorRegistry(
            VaultTimelockLib.applyPending(_pendingAddress, _addressChangeEta, _ROLE_SPONSOR_REGISTRY)
        );
    }

    function pendingAutomationContract() external view returns (address) {
        return _pendingAddress[_ROLE_AUTOMATION];
    }

    function automationContractChangeEta() external view returns (uint256) {
        return _addressChangeEta[_ROLE_AUTOMATION];
    }

    function pendingMilestoneManager() external view returns (address) {
        return _pendingAddress[_ROLE_MILESTONE_MGR];
    }

    function milestoneManagerChangeEta() external view returns (uint256) {
        return _addressChangeEta[_ROLE_MILESTONE_MGR];
    }

    function pendingSponsorRegistry() external view returns (address) {
        return _pendingAddress[_ROLE_SPONSOR_REGISTRY];
    }

    function sponsorRegistryChangeEta() external view returns (uint256) {
        return _addressChangeEta[_ROLE_SPONSOR_REGISTRY];
    }

    function pendingDataAccessLog() external view returns (address) {
        return _pendingAddress[_ROLE_DATA_ACCESS_LOG];
    }

    function dataAccessLogChangeEta() external view returns (uint256) {
        return _addressChangeEta[_ROLE_DATA_ACCESS_LOG];
    }

    /// @dev M-3: If a SponsorRegistry is configured, require the trial's sponsor is still verified.
    ///      This prevents a removed/malicious sponsor from distributing rewards or reclaiming ETH.
    function _requireSponsorStillVerified(address _sponsor) internal view {
        VaultReclaimLib.requireSponsorStillVerified(sponsorRegistry, _sponsor);
    }

    function _requireAuthorizedDistributor(address _sponsor) internal view {
        if (!(msg.sender == automationContract || msg.sender == _sponsor)) revert NotAuthorized();
    }

    function _logRewardsDistributed(uint256 _trialId, string memory _tag) internal {
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                IVaultDataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked(_tag, block.timestamp))
            );
        }
    }

    /// @inheritdoc IVaultBatchCredit
    function creditParticipantRewardForBatch(
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        uint256 amountWei
    ) external virtual returns (uint256 creditedWei) {
        if (!_batchCreditInProgress) revert NotAuthorized();
        return _creditReward(trialId, milestoneIndex, participant, amountWei);
    }

    /// @inheritdoc IVaultBatchCredit
    function emitParticipantCreditFailed(
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        bytes calldata reason
    ) external {
        if (!_batchCreditInProgress) revert NotAuthorized();
        emit ParticipantCreditFailed(trialId, milestoneIndex, participant, reason);
    }

    function _creditReward(
        uint256 _trialId,
        uint256 _milestoneIndex,
        address _participant,
        uint256 _amountWei
    ) internal returns (uint256 creditedWei) {
        if (_amountWei == 0) return 0;
        if (_amountWei / cETH.UNIT_SCALE() == 0) {
            emit RewardDustSkipped(_trialId, _milestoneIndex);
            return 0;
        }
        return VaultDistributionLib.creditReward(
            participantNullifier,
            entitlementStaged,
            stagedShareWei,
            participantMilestonePaidEnc,
            cETH,
            eligibilityEngine,
            _trialId,
            _milestoneIndex,
            _participant,
            _amountWei
        );
    }

    function _payEligibleBatchWithCheckpoint(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _start,
        uint256 _end,
        uint256 _perParticipantWei
    ) internal returns (uint256 distributed, uint256 lastPaidIndex) {
        _batchCreditInProgress = true;
        (distributed, lastPaidIndex) = VaultDistributionLib.payEligibleBatchWithCheckpoint(
            milestoneManager,
            pools[_trialId],
            entitlementStaged,
            participantNullifier,
            stagedShareWei,
            participantMilestonePaidEnc,
            cETH,
            eligibilityEngine,
            _trialId,
            _milestoneIndex,
            _start,
            _end,
            _perParticipantWei
        );
        _batchCreditInProgress = false;
    }

    function _payRemainder(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _lastPaidIndex,
        uint256 _remainder,
        bool _requireUnpaid
    ) internal returns (uint256 credited) {
        return VaultDistributionLib.payRemainder(
            pools[_trialId],
            entitlementStaged,
            participantNullifier,
            stagedShareWei,
            participantMilestonePaidEnc,
            milestoneRemainderPaid,
            cETH,
            eligibilityEngine,
            _trialId,
            _milestoneIndex,
            _lastPaidIndex,
            _remainder,
            _requireUnpaid
        );
    }

    function _updateGlobalLastPaidIndex(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _batchLastPaid
    ) internal {
        VaultDistributionLib.updateGlobalLastPaidIndex(
            lastPaidParticipantIndex,
            _trialId,
            _milestoneIndex,
            _batchLastPaid
        );
    }

    function _finalizePaginatedBatch(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _endIndex,
        uint256 _pCount,
        bool _setScreeningDistributed
    ) internal {
        VaultDistributionLib.finalizePaginatedBatch(
            milestoneManager,
            pools[_trialId],
            lastProcessedIndex,
            milestoneDistributed,
            entitlementStaged,
            _trialId,
            _milestoneIndex,
            _endIndex,
            _pCount,
            _setScreeningDistributed
        );
    }

    function _hasEligibleUnpaid(uint256 _trialId, uint256 _milestoneIndex) internal view returns (bool) {
        return VaultDistributionLib.hasEligibleUnpaid(
            milestoneManager,
            pools[_trialId],
            entitlementStaged,
            _trialId,
            _milestoneIndex
        );
    }

    function _openChallengeWindow(uint256 _trialId) internal {
        VaultChallengeLib.openChallengeWindow(pools, _trialId, CHALLENGE_WINDOW);
    }

    function prepareEntitlementProof(uint256 _trialId, uint256 _milestoneIndex) external returns (bytes32) {
        return VaultChallengeLib.prepareEntitlementProof(
            pools,
            entitlementStaged,
            confirmedPayout,
            participantMilestonePaidEnc,
            _trialId,
            _milestoneIndex
        );
    }

    function confirmReceipt(
        uint256 _trialId,
        uint256 _milestoneIndex,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external nonReentrant {
        VaultChallengeLib.confirmReceipt(
            cETH,
            eligibilityEngine,
            pools,
            entitlementStaged,
            confirmedPayout,
            participantMilestonePaid,
            stagedShareWei,
            participantMilestonePaidEnc,
            milestoneDistributedWei,
            participantNullifier,
            _trialId,
            _milestoneIndex,
            cleartexts,
            decryptionProof
        );
    }

    function pruneUnconfirmedSlots(uint256 _trialId, uint256 _milestoneIndex) external {
        VaultChallengeLib.pruneUnconfirmedSlots(
            trialManager,
            pools,
            confirmedPayout,
            entitlementStaged,
            stagedShareWei,
            nullifierUsedForRegistration,
            participantNullifier,
            _trialId,
            _milestoneIndex,
            owner,
            automationContract
        );
    }

    function recoverStrandedCeth(address _recipient) external onlyOwner nonReentrant {
        if (!(_recipient != address(0))) revert ZeroAddress();
        euint64 balance = cETH.confidentialBalanceOf(address(this));
        if (!FHE.isInitialized(balance)) revert NothingToReclaim();
        FHE.allowThis(balance);
        FHE.allow(balance, address(cETH));
        cETH.transferEncrypted(address(this), _recipient, balance);
        emit StrandedCethRecovered(_recipient);
    }

    /// @notice Expose staged entitlement handle for client-side decryption proof.
    function getStagedEntitlement(uint256 _trialId, address _participant, uint256 _milestoneIndex)
        external
        view
        returns (ebool)
    {
        return participantMilestonePaidEnc[_trialId][_participant][_milestoneIndex];
    }

    function getStagedShareWei(uint256 _trialId, address _participant, uint256 _milestoneIndex)
        external
        view
        returns (uint256)
    {
        return stagedShareWei[_trialId][_participant][_milestoneIndex];
    }

    function getConfirmedDistributedWei(uint256 _trialId) external view returns (uint256) {
        return pools[_trialId].confirmedDistributedWei;
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
        _fundTrialWithValue(_trialId);
    }

    /**
     * @notice Atomic ETH fund + milestone setup in one transaction (sponsor wallet visible).
     */
    function fundTrialAndSetMilestones(
        uint256 _trialId,
        string[] calldata _names,
        uint16[] calldata _weights,
        uint256[] calldata _deadlines
    ) external payable {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!(msg.sender == trial.sponsor)) revert OnlySponsorCanFund();
        if (!(address(milestoneManager) != address(0))) revert MilestoneManagerNotSet();
        milestoneManager.setMilestonesFromVault(_trialId, msg.sender, _names, _weights, _deadlines);
        _fundTrialWithValue(_trialId);
    }

    function _fundTrialWithValue(uint256 _trialId) private {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!(msg.sender == trial.sponsor)) revert OnlySponsorCanFund();
        if (!(trial.active)) revert TrialNotActive();
        if (!(trial.endTime > block.timestamp)) revert TrialAlreadyEnded();
        if (!(msg.value > 0)) revert MustSendETH();
        if (!(msg.value <= uint256(type(uint64).max) * cETH.UNIT_SCALE())) revert AmountTooLarge();
        if (pools[_trialId].fundingLocked) revert FundingLockedAfterRegistrationBegan();

        pools[_trialId].totalDepositedWei += msg.value;

        uint256 cumulativeUnits = pools[_trialId].totalDepositedWei / cETH.UNIT_SCALE();
        if (!(cumulativeUnits <= type(uint64).max)) revert EncryptedPoolSizeOverflow();

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
     * @notice Encode callback `data` for atomic confidential fund + milestone setup via cETH.
     */
    function encodeConfidentialFundAndMilestonesData(
        uint256 _trialId,
        string[] calldata _names,
        uint16[] calldata _weights,
        uint256[] calldata _deadlines
    ) external pure returns (bytes memory) {
        return abi.encode(_FUND_AND_MILESTONES_MODE, _trialId, _names, _weights, _deadlines);
    }

    /**
     * @notice Trial-level public indicator: encrypted pool size echo (non-sensitive aggregate).
     */
    function makeEncryptedPoolSizePublic(uint256 _trialId) external {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!(msg.sender == trial.sponsor || msg.sender == owner)) revert NotAuthorized();
        if (!(FHE.isInitialized(pools[_trialId].encryptedPoolSize))) revert PoolNotFunded();
        pools[_trialId].encryptedPoolSize = FHE.makePubliclyDecryptable(pools[_trialId].encryptedPoolSize);
        emit TrialPoolSizeMadePublic(_trialId);
    }

    /**
     * @notice Trial-level public indicator: milestone distribution completed (signals screening gate passed).
     */
    function signalMilestoneDistributed(uint256 _trialId, uint256 _milestoneIndex) external {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!(msg.sender == trial.sponsor || msg.sender == owner)) revert NotAuthorized();
        if (!(milestoneDistributed[_trialId][_milestoneIndex])) revert MilestoneNotDistributed();
        ebool reached = FHE.asEbool(true);
        reached = FHE.makePubliclyDecryptable(reached);
        FHE.allow(reached, trial.sponsor);
        emit MilestoneDistributedPublicSignaled(_trialId, _milestoneIndex);
    }

    /**
     * @notice DEPRECATED: Register a participant for incentives (legacy flow)
     * @dev The legacy address-based eligibility flow has been removed.
     *      Patients must now use registerAnonymousParticipant() with a nullifier.
     */
    function registerParticipant(uint256 /* _trialId */, address /* _participant */) external pure {
        revert("Deprecated");
    }

    /**
     * @notice Distributes only Milestone 0 (Screening) rewards to all participants at trial end.
     * @dev V1.2.1: Phase-Gated. Only Milestone 0 is auto-distributed. Subsequent phases require
     *      manual sponsor promotion via distributeMilestoneToParticipant.
     *      Fallback: If no milestones are set, full share is distributed (legacy behavior).
     * @dev FINDING 5: This is the full distribution version - use distributePaginated for large pools
     */
    function distribute(uint256 _trialId) external nonReentrant {
        _guardDistribute(_trialId);
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        _requireAuthorizedDistributor(trial.sponsor);
        if (reclaimFinalized[_trialId]) revert BlockedAfterReclaim();
        if (!(trial.endTime > 0)) revert TrialDoesNotExist();
        if (!(block.timestamp >= trial.endTime)) revert TrialNotYetEnded();
        if (!(pools[_trialId].totalDepositedWei > 0)) revert NoIncentivePool();
        if (pools[_trialId].screeningDistributed) revert ScreeningAlreadyDistributed();
        _requireSponsorStillVerified(trial.sponsor);

        _batchCreditInProgress = true;
        VaultDistributionLib.runScreeningDistribution(
            milestoneManager,
            pools,
            milestoneDistributed,
            entitlementStaged,
            participantNullifier,
            stagedShareWei,
            participantMilestonePaidEnc,
            milestoneRemainderPaid,
            cETH,
            eligibilityEngine,
            _trialId,
            DISTRIBUTE_BATCH_SIZE
        );
        _batchCreditInProgress = false;
        _openChallengeWindow(_trialId);

        if (
            address(milestoneManager) != address(0) &&
            milestoneManager.getMilestones(_trialId).length > 0
        ) {
            emit MilestoneRewardsDistributed(_trialId, 0);
        }
        _logRewardsDistributed(_trialId, "SCREENING_DISTRIBUTION");
        emit RewardsDistributed(_trialId);
    }

    // FINDING 5: Paginated distribution for large pools
    /**
     * @notice Paginated distribution for large participant pools
     * @param _trialId The trial ID
     * @param _milestoneIndex The milestone to distribute
     * @param _startIndex Start index in participants array
     * @param _batchSize Number of participants to process in this batch
     * @dev Per-participant share uses total registered count (pCount), not eligible-only count.
     */
    /// @dev Hook for test harnesses to simulate batch-level distribution failures.
    function _guardDistribute(uint256 /* _trialId */) internal virtual {}

    /// @dev Hook for test harnesses to simulate batch-level distribution failures.
    function _guardDistributePartialPaginated(uint256 /* _trialId */) internal virtual {}

    function distributePartialPaginated(
        uint256 _trialId,
        uint256 _milestoneIndex,
        uint256 _startIndex,
        uint256 _batchSize
    ) external nonReentrant {
        _guardDistributePartialPaginated(_trialId);
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        _requireAuthorizedDistributor(trial.sponsor);
        if (reclaimFinalized[_trialId]) revert BlockedAfterReclaim();

        if (_milestoneIndex == 0) {
            if (!(block.timestamp >= trial.endTime)) revert TrialNotYetEnded();
            if (pools[_trialId].screeningDistributed) revert ScreeningAlreadyDistributed();
        }

        bool hasMilestones = address(milestoneManager) != address(0) &&
            milestoneManager.getMilestones(_trialId).length > 0;
        if (hasMilestones) {
            if (milestoneDistributed[_trialId][_milestoneIndex]) revert MilestoneAlreadyDistributed();
        } else {
            if (!(_milestoneIndex == 0)) revert NoMilestonesConfigured();
        }

        uint256 pCount = pools[_trialId].participants.length;
        if (!(pCount > 0)) revert NoParticipants();
        if (!(_startIndex < pCount)) revert InvalidStartIndex();

        _requireSponsorStillVerified(trial.sponsor);

        if (_startIndex == 0) {
            paginationStarted[_trialId][_milestoneIndex] = true;
            lastPaidParticipantIndex[_trialId][_milestoneIndex] = type(uint256).max;
        } else {
            if (!(_startIndex == lastProcessedIndex[_trialId][_milestoneIndex])) revert BatchMustBeSequential();
        }

        uint256 endIndex = _startIndex + _batchSize > pCount ? pCount : _startIndex + _batchSize;

        uint256 shareWei;
        uint256 perParticipantWei;
        if (hasMilestones) {
            (shareWei, perParticipantWei) = VaultDistributionLib.perParticipantMilestoneWei(
                milestoneManager,
                pools[_trialId],
                _trialId,
                _milestoneIndex
            );
        } else {
            shareWei = pools[_trialId].totalDepositedWei;
            perParticipantWei = shareWei / pCount;
        }
        uint256 remainder = shareWei - (perParticipantWei * pCount);

        (, uint256 batchLastStaged) =
            _payEligibleBatchWithCheckpoint(_trialId, _milestoneIndex, _startIndex, endIndex, perParticipantWei);
        _updateGlobalLastPaidIndex(_trialId, _milestoneIndex, batchLastStaged);

        if (endIndex == pCount) {
            uint256 globalLastStaged = lastPaidParticipantIndex[_trialId][_milestoneIndex];
            _payRemainder(_trialId, _milestoneIndex, globalLastStaged, remainder, false);
            _openChallengeWindow(_trialId);
        }

        _finalizePaginatedBatch(
            _trialId,
            _milestoneIndex,
            endIndex,
            pCount,
            _milestoneIndex == 0
        );

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                IVaultDataAccessLog.ActionType.REWARDS_DISTRIBUTED,
                _trialId,
                keccak256(abi.encodePacked("PARTIAL_PAGINATED", _milestoneIndex, _startIndex, block.timestamp))
            );
        }

        if (hasMilestones) {
            emit MilestoneRewardsDistributed(_trialId, _milestoneIndex);
        } else if (endIndex == pCount) {
            _logRewardsDistributed(_trialId, "SCREENING_DISTRIBUTION");
            emit RewardsDistributed(_trialId);
        }
    }

    /**
     * @notice HIGH-3: Reset pagination state for stuck paginations
     * @dev Allows owner to reset pagination state when a milestone distribution gets stuck
     *      due to no eligible participants remaining in subsequent batches
     * @param _trialId The trial ID
     * @param _milestoneIndex The milestone index to reset
     */
    function resetPaginationState(uint256 _trialId, uint256 _milestoneIndex) external onlyOwner {
        if (milestoneDistributed[_trialId][_milestoneIndex]) revert AlreadyCompleted();
        paginationStarted[_trialId][_milestoneIndex] = false;
        lastProcessedIndex[_trialId][_milestoneIndex] = 0;
        lastPaidParticipantIndex[_trialId][_milestoneIndex] = type(uint256).max;
    }

    /**
     * @notice Distributes rewards for a specific milestone to all eligible participants.
     * @dev Only Milestone 0 is auto-distributed. Subsequent phases can be bulk-distributed by sponsor.
     * @dev Per-participant share uses total registered count (pCount), not eligible-only count.
     */
    function distributePartial(uint256 _trialId, uint256 _milestoneIndex) external nonReentrant {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        _requireAuthorizedDistributor(trial.sponsor);
        if (reclaimFinalized[_trialId]) revert BlockedAfterReclaim();
        if (paginationStarted[_trialId][_milestoneIndex]) revert UsePaginatedVersion();
        if (!(address(milestoneManager) != address(0))) revert MilestoneManagerNotSet();
        if (milestoneDistributed[_trialId][_milestoneIndex]) revert MilestoneAlreadyDistributed();

        if (_milestoneIndex == 0) {
            if (!(block.timestamp >= trial.endTime)) revert TrialNotYetEnded();
        }

        uint256 pCount = pools[_trialId].participants.length;
        if (!(pCount > 0)) revert NoParticipants();
        if (!(pCount <= DISTRIBUTE_BATCH_SIZE)) revert UseDistributePartialPaginatedForLargePools();

        _requireSponsorStillVerified(trial.sponsor);

        (uint256 milestoneShareWei, uint256 perParticipantWei) = VaultDistributionLib.perParticipantMilestoneWei(
            milestoneManager,
            pools[_trialId],
            _trialId,
            _milestoneIndex
        );
        uint256 remainder = milestoneShareWei - (perParticipantWei * pCount);

        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < pCount; i++) {
            address p = pools[_trialId].participants[i];
            if (
                VaultDistributionLib.isParticipantEligible(milestoneManager, _trialId, p, _milestoneIndex) &&
                !entitlementStaged[_trialId][p][_milestoneIndex]
            ) {
                eligibleCount++;
            }
        }
        if (!(eligibleCount > 0)) revert NoEligibleParticipants();

        (, uint256 lastStagedIndex) =
            _payEligibleBatchWithCheckpoint(_trialId, _milestoneIndex, 0, pCount, perParticipantWei);
        _payRemainder(_trialId, _milestoneIndex, lastStagedIndex, remainder, false);

        if (!_hasEligibleUnpaid(_trialId, _milestoneIndex)) {
            milestoneDistributed[_trialId][_milestoneIndex] = true;
        }
        if (_milestoneIndex == 0) {
            pools[_trialId].screeningDistributed = true;
        }
        _openChallengeWindow(_trialId);

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                IVaultDataAccessLog.ActionType.REWARDS_DISTRIBUTED,
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
        if (!(_milestoneIndex > 0)) revert UseDistributeForScreening();
        if (!(address(milestoneManager) != address(0))) revert MilestoneManagerNotSet();
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        _requireAuthorizedDistributor(trial.sponsor);
        if (reclaimFinalized[_trialId]) revert BlockedAfterReclaim();
        _requireSponsorStillVerified(trial.sponsor);
        if (paginationStarted[_trialId][_milestoneIndex]) revert PaginationInProgress();
        if (!(pools[_trialId].isRegistered[_participant])) revert ParticipantNotRegistered();

        IVaultMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        if (!(_milestoneIndex < milestones.length)) revert InvalidMilestoneIndex();

        if (
            !VaultDistributionLib.isParticipantEligible(milestoneManager, _trialId, _participant, _milestoneIndex)
        ) revert MilestoneNotCompletedByParticipant();
        if (entitlementStaged[_trialId][_participant][_milestoneIndex]) revert AlreadyPaidForThisMilestone();

        (uint256 milestoneShareWei, uint256 perParticipantWei) = VaultDistributionLib.perParticipantMilestoneWei(
            milestoneManager,
            pools[_trialId],
            _trialId,
            _milestoneIndex
        );
        uint256 pCount = pools[_trialId].participants.length;
        uint256 remainder = milestoneShareWei - (perParticipantWei * pCount);

        uint256 amount = perParticipantWei;
        if (!milestoneRemainderPaid[_trialId][_milestoneIndex] && remainder > 0) {
            amount += remainder;
            milestoneRemainderPaid[_trialId][_milestoneIndex] = true;
        }

        if (!(address(this).balance >= amount)) revert InsufficientETHInVault();

        _creditReward(_trialId, _milestoneIndex, _participant, amount);
        _openChallengeWindow(_trialId);

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                IVaultDataAccessLog.ActionType.REWARDS_DISTRIBUTED,
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
        VaultRegistrationLib.registerAnonymousParticipant(
            trialManager,
            eligibilityEngine,
            dataAccessLog,
            pools,
            nullifierUsedForRegistration,
            participantNullifier,
            _trialId,
            _nullifier,
            MAX_PARTICIPANTS
        );
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
        VaultRegistrationLib.registerAnonymousParticipantFor(
            trialManager,
            eligibilityEngine,
            dataAccessLog,
            pools,
            nullifierUsedForRegistration,
            participantNullifier,
            claimAuthUsed,
            REGISTER_AUTH_TYPEHASH,
            _domainSeparatorV4(),
            _trialId,
            _nullifier,
            _permitHolder,
            _nonce,
            _deadline,
            _signature,
            MAX_PARTICIPANTS
        );
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
        bytes calldata inputProof,
        uint256 _withdrawToNonce,
        uint256 _withdrawToDeadline,
        bytes calldata _withdrawToSignature
    ) external nonReentrant {
        VaultClaimLib.claimParticipantRewards(
            cETH,
            eligibilityEngine,
            pools,
            _trialId,
            _nullifier,
            _destination,
            encryptedUnits,
            inputProof,
            _withdrawToNonce,
            _withdrawToDeadline,
            _withdrawToSignature
        );
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
        bytes32 _encryptedAmountCommitment,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof,
        uint256 _nonce,
        uint256 _deadline,
        bytes calldata _signature,
        uint256 _withdrawToNonce,
        uint256 _withdrawToDeadline,
        bytes calldata _withdrawToSignature
    ) external nonReentrant {
        VaultClaimLib.claimParticipantRewardsFor(
            cETH,
            eligibilityEngine,
            pools,
            claimAuthUsed,
            CLAIM_AUTH_TYPEHASH,
            _domainSeparatorV4(),
            _trialId,
            _nullifier,
            _permitHolder,
            _destination,
            _units,
            _encryptedAmountCommitment,
            encryptedUnits,
            inputProof,
            _nonce,
            _deadline,
            _signature,
            _withdrawToNonce,
            _withdrawToDeadline,
            _withdrawToSignature
        );
    }

    /**
     * @notice Reclaim undistributed ETH after trial ends (CRIT-1 fix)
     * @dev MED-3: Callable by owner OR sponsor after trial end and screening distribution
     *      (or after trial end with zero participants — screening distribute never runs).
     *      Sends remaining balance to sponsor.
     * @param _trialId The trial ID
     */
    function reclaimUndistributed(uint256 _trialId) external nonReentrant {
        VaultReclaimLib.reclaimUndistributed(
            trialManager,
            milestoneManager,
            sponsorRegistry,
            pools,
            reclaimFinalized,
            milestoneDistributed,
            entitlementStaged,
            confirmedPayout,
            pendingReclaimWei,
            pendingReclaimRecipient,
            _trialId,
            owner,
            RECLAIM_GRACE_PERIOD
        );
    }

    function claimReclaimed(uint256 _trialId) external nonReentrant {
        VaultReclaimLib.claimReclaimed(
            trialManager,
            sponsorRegistry,
            pendingReclaimWei,
            pendingReclaimRecipient,
            _trialId,
            owner
        );
    }

    function reclaimAbandonedToOwner(uint256 _trialId) external onlyOwner nonReentrant {
        VaultReclaimLib.reclaimAbandonedToOwner(
            trialManager,
            milestoneManager,
            sponsorRegistry,
            pools,
            reclaimFinalized,
            entitlementStaged,
            confirmedPayout,
            abandonedReclaimOpenedAt,
            pendingReclaimWei,
            pendingReclaimRecipient,
            _trialId,
            owner,
            RECLAIM_GRACE_PERIOD,
            PARTICIPANT_CLAIM_WINDOW
        );
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
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
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
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
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
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        if (!(msg.sender == trial.sponsor)) revert OnlySponsor();
        FHE.allow(pools[_trialId].encryptedPoolSize, msg.sender);
    }

    /**
     * @notice ERC-7984 callback for atomic confidential trial funding via `cETH.confidentialTransferAndCall`.
     * @dev `data` is `abi.encode(trialId, milestoneIndex)`. Reverts `ConfidentialFundingDisabled` until both
     *      `confidentialFundingEnabled` and `confidentialFundingAccountingReady` are true (see LOW-2 in
     *      SECURITY.md). On validation failure after re-enable, returns encrypted false so the token refunds
     *      via OZ `_transferAndCall`.
     */
    function onConfidentialTransferReceived(
        address /* operator */,
        address from,
        euint64 amount,
        bytes calldata data
    ) external override returns (ebool) {
        if (msg.sender != address(cETH)) {
            return VaultConfidentialLib.receiverReject(cETH);
        }
        if (!confidentialFundingEnabled || !confidentialFundingAccountingReady) {
            revert ConfidentialFundingDisabled();
        }
        ebool accepted = VaultConfidentialLib.handleConfidentialTransfer(
            cETH,
            trialManager,
            milestoneManager,
            pools,
            reclaimFinalized,
            from,
            amount,
            data
        );
        return accepted;
    }

    /**
     * @notice FINDING 7: Revert direct ETH transfers with helpful message
     * @dev Prevents ETH from being locked forever in the contract
     */
    receive() external payable {
        revert("Use fundTrial(trialId) to fund a specific trial");
    }
}
