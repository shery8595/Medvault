// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, euint16, ebool, externalEuint8, externalEuint16, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title TrialManager
 * @notice Manages metadata and eligibility criteria for clinical trials.
 * @dev Supports plaintext criteria (legacy) and Zama FHE encrypted sponsor criteria.
 */
contract TrialManager is ZamaEthereumConfig {
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

    mapping(uint256 => Trial) public trials;
    mapping(uint256 => EncryptedCriteria) private encryptedCriteriaByTrial;
    mapping(address => string) public sponsorNames;
    uint256 public trialCounter = 1;
    address public automationContract;
    address public sponsorRegistry;
    address public owner;
    address public pendingOwner;
    address public eligibilityEngine;

    bool public immutable isTestnet;

    uint256 private constant BN254_FIELD_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    /// @dev Aligned with EligibilityEngine.CRITERIA_SCHEMA_HASH
    bytes32 public constant CRITERIA_SCHEMA_V2 = bytes32(
        uint256(keccak256("medvault.eligibility.criteria.v1")) % BN254_FIELD_ORDER
    );

    event TrialCreated(uint256 indexed trialId, address indexed sponsor, string name, uint256 endTime, bool encryptedCriteria);
    event TrialDeactivated(uint256 indexed trialId);
    event SponsorNameUpdated(address indexed sponsor, string name);
    event SponsorRegistryUpdated(address indexed newRegistry);
    event AutomationHookFailed(uint256 indexed trialId, bytes reason);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    error InvalidRegistryContract();
    error SponsorNotVerified();
    error DurationTooLong();
    error TrialDoesNotExist();
    error EncryptedCriteriaNotSet();

    uint256 public constant MAX_TRIAL_DURATION = 365 days * 5;
    uint256 public constant MAX_STRING_LENGTH = 256;

    constructor(address _sponsorRegistry, bool _isTestnet) {
        isTestnet = _isTestnet;
        require(_sponsorRegistry != address(0), "Zero address");
        _validateAndSetRegistry(_sponsorRegistry);
        owner = msg.sender;
    }

    function _validateAndSetRegistry(address _registry) internal {
        (bool ok, bytes memory ret) = _registry.staticcall(
            abi.encodeWithSignature("isVerifiedSponsor(address)", address(0))
        );
        if (!ok || ret.length != 32) revert InvalidRegistryContract();
        sponsorRegistry = _registry;
        emit SponsorRegistryUpdated(_registry);
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

    function setAutomationContract(address _automation) external onlyOwner {
        require(_automation != address(0), "Zero address");
        automationContract = _automation;
    }

    function setSponsorRegistry(address _registry) external onlyOwner {
        _validateAndSetRegistry(_registry);
    }

    function setEligibilityEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Zero address");
        eligibilityEngine = _engine;
    }

    function setSponsorName(string calldata _name) external {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_name).length <= MAX_STRING_LENGTH, "Name too long");
        if (!isTestnet) {
            (bool ok, bytes memory ret) = sponsorRegistry.staticcall(
                abi.encodeWithSignature("isVerifiedSponsor(address)", msg.sender)
            );
            require(ok && ret.length == 32 && abi.decode(ret, (bool)), "Not a verified sponsor");
        }
        sponsorNames[msg.sender] = _name;
        emit SponsorNameUpdated(msg.sender, _name);
    }

    function _requireVerifiedSponsor() internal view {
        _requireVerifiedSponsorFor(msg.sender);
    }

    /// @dev M-3: re-verify a specific address is still a verified sponsor via the registry.
    function _requireVerifiedSponsorFor(address _sponsor) internal view {
        if (!isTestnet) {
            (bool ok, bytes memory ret) = sponsorRegistry.staticcall(
                abi.encodeWithSignature("isVerifiedSponsor(address)", _sponsor)
            );
            if (!ok || ret.length != 32 || !abi.decode(ret, (bool))) revert SponsorNotVerified();
        }
    }

    function _validateTrialStrings(
        string calldata _name,
        string calldata _phase,
        string calldata _location,
        string calldata _compensation
    ) internal pure {
        require(bytes(_name).length > 0 && bytes(_name).length <= MAX_STRING_LENGTH, "Invalid name");
        require(bytes(_phase).length <= MAX_STRING_LENGTH, "Phase too long");
        require(bytes(_location).length <= MAX_STRING_LENGTH, "Location too long");
        require(bytes(_compensation).length <= MAX_STRING_LENGTH, "Compensation too long");
    }

    function _storeTrialMetadata(
        string calldata _name,
        string calldata _phase,
        string calldata _location,
        string calldata _compensation,
        uint256 _duration,
        bool _encryptedCriteria
    ) internal returns (uint256 trialId, uint256 endTime) {
        require(bytes(_name).length > 0, "Name required");
        _validateTrialStrings(_name, _phase, _location, _compensation);
        require(_duration > 0, "Duration required");
        if (_duration > MAX_TRIAL_DURATION) revert DurationTooLong();
        _requireVerifiedSponsor();

        trialId = trialCounter++;
        endTime = block.timestamp + _duration;
        trials[trialId] = Trial({
            name: _name,
            phase: _phase,
            location: _location,
            compensation: _compensation,
            sponsor: msg.sender,
            active: true,
            minAge: 0,
            maxAge: 0,
            requiresDiabetes: false,
            minHb: 0,
            genderRequirement: 0,
            minHeight: 0,
            maxWeight: 0,
            requiresNonSmoker: false,
            requiresNormalBP: false,
            endTime: endTime,
            encryptedCriteria: _encryptedCriteria
        });

        if (automationContract != address(0)) {
            (bool success, bytes memory reason) = automationContract.call(
                abi.encodeWithSignature("onTrialCreated(uint256)", trialId)
            );
            if (!success) {
                emit AutomationHookFailed(trialId, reason);
            }
        }
    }

    function createTrial(
        string calldata _name,
        string calldata _phase,
        string calldata _location,
        string calldata _compensation,
        uint8 _minAge,
        uint8 _maxAge,
        bool _requiresDiabetes,
        uint16 _minHb,
        uint8 _genderReq,
        uint8 _minHeight,
        uint16 _maxWeight,
        bool _requiresNonSmoker,
        bool _requiresNormalBP,
        uint256 _duration
    ) external returns (uint256) {
        require(_minAge < _maxAge, "Invalid age range");
        (uint256 trialId, uint256 endTime) = _storeTrialMetadata(
            _name,
            _phase,
            _location,
            _compensation,
            _duration,
            false
        );
        trials[trialId].minAge = _minAge;
        trials[trialId].maxAge = _maxAge;
        trials[trialId].requiresDiabetes = _requiresDiabetes;
        trials[trialId].minHb = _minHb;
        trials[trialId].genderRequirement = _genderReq;
        trials[trialId].minHeight = _minHeight;
        trials[trialId].maxWeight = _maxWeight;
        trials[trialId].requiresNonSmoker = _requiresNonSmoker;
        trials[trialId].requiresNormalBP = _requiresNormalBP;

        emit TrialCreated(trialId, msg.sender, _name, endTime, false);
        return trialId;
    }

    /**
     * @notice Create a trial with Zama FHE encrypted eligibility criteria (sponsor-private bounds).
     * @dev Plaintext criteria fields in Trial struct remain zero; matching uses encrypted handles.
     */
    function createTrialWithEncryptedCriteria(
        string calldata _name,
        string calldata _phase,
        string calldata _location,
        string calldata _compensation,
        externalEuint8 _minAge,
        externalEuint8 _maxAge,
        externalEbool _requiresDiabetes,
        externalEuint16 _minHb,
        externalEuint8 _genderRequirement,
        externalEuint8 _minHeight,
        externalEuint16 _maxWeight,
        externalEbool _requiresNonSmoker,
        externalEbool _requiresNormalBP,
        bytes calldata inputProof,
        uint256 _duration
    ) external returns (uint256) {
        (uint256 trialId, uint256 endTime) = _storeTrialMetadata(
            _name,
            _phase,
            _location,
            _compensation,
            _duration,
            true
        );

        euint8 minAgeCt = FHE.fromExternal(_minAge, inputProof);
        euint8 maxAgeCt = FHE.fromExternal(_maxAge, inputProof);
        ebool requiresDiabetesCt = FHE.fromExternal(_requiresDiabetes, inputProof);
        euint16 minHbCt = FHE.fromExternal(_minHb, inputProof);
        euint8 genderReqCt = FHE.fromExternal(_genderRequirement, inputProof);
        euint8 minHeightCt = FHE.fromExternal(_minHeight, inputProof);
        euint16 maxWeightCt = FHE.fromExternal(_maxWeight, inputProof);
        ebool requiresNonSmokerCt = FHE.fromExternal(_requiresNonSmoker, inputProof);
        ebool requiresNormalBPCt = FHE.fromExternal(_requiresNormalBP, inputProof);

        FHE.allowThis(minAgeCt);
        FHE.allowThis(maxAgeCt);
        FHE.allowThis(requiresDiabetesCt);
        FHE.allowThis(minHbCt);
        FHE.allowThis(genderReqCt);
        FHE.allowThis(minHeightCt);
        FHE.allowThis(maxWeightCt);
        FHE.allowThis(requiresNonSmokerCt);
        FHE.allowThis(requiresNormalBPCt);
        FHE.allow(minAgeCt, msg.sender);
        FHE.allow(maxAgeCt, msg.sender);
        FHE.allow(requiresDiabetesCt, msg.sender);
        FHE.allow(minHbCt, msg.sender);
        FHE.allow(genderReqCt, msg.sender);
        FHE.allow(minHeightCt, msg.sender);
        FHE.allow(maxWeightCt, msg.sender);
        FHE.allow(requiresNonSmokerCt, msg.sender);
        FHE.allow(requiresNormalBPCt, msg.sender);
        if (eligibilityEngine != address(0)) {
            FHE.allow(minAgeCt, eligibilityEngine);
            FHE.allow(maxAgeCt, eligibilityEngine);
            FHE.allow(requiresDiabetesCt, eligibilityEngine);
            FHE.allow(minHbCt, eligibilityEngine);
            FHE.allow(genderReqCt, eligibilityEngine);
            FHE.allow(minHeightCt, eligibilityEngine);
            FHE.allow(maxWeightCt, eligibilityEngine);
            FHE.allow(requiresNonSmokerCt, eligibilityEngine);
            FHE.allow(requiresNormalBPCt, eligibilityEngine);
        }

        encryptedCriteriaByTrial[trialId] = EncryptedCriteria({
            minAge: minAgeCt,
            maxAge: maxAgeCt,
            requiresDiabetes: requiresDiabetesCt,
            minHb: minHbCt,
            genderRequirement: genderReqCt,
            minHeight: minHeightCt,
            maxWeight: maxWeightCt,
            requiresNonSmoker: requiresNonSmokerCt,
            requiresNormalBP: requiresNormalBPCt
        });

        emit TrialCreated(trialId, msg.sender, _name, endTime, true);
        return trialId;
    }

    function getEncryptedCriteria(uint256 _trialId) external view returns (EncryptedCriteria memory) {
        if (!trials[_trialId].encryptedCriteria) revert EncryptedCriteriaNotSet();
        require(
            msg.sender == trials[_trialId].sponsor || msg.sender == eligibilityEngine,
            "Not authorized"
        );
        return encryptedCriteriaByTrial[_trialId];
    }

    function deactivateTrial(uint256 _trialId) external {
        if (trials[_trialId].endTime == 0) revert TrialDoesNotExist();
        require(trials[_trialId].active, "Already inactive");
        require(
            trials[_trialId].sponsor == msg.sender || msg.sender == automationContract,
            "Only sponsor or automation can deactivate"
        );
        // M-3: if a SponsorRegistry is configured, a removed sponsor may not deactivate their
        // (now-stale) trial themselves — only the automation contract (governance path) may.
        if (msg.sender == trials[_trialId].sponsor) {
            _requireVerifiedSponsorFor(msg.sender);
        }
        trials[_trialId].active = false;

        if (automationContract != address(0)) {
            (bool success, bytes memory reason) = automationContract.call(
                abi.encodeWithSignature("onTrialDeactivated(uint256)", _trialId)
            );
            if (!success) {
                emit AutomationHookFailed(_trialId, reason);
            }
        }

        emit TrialDeactivated(_trialId);
    }

    function getTrial(uint256 _trialId) external view returns (Trial memory) {
        return trials[_trialId];
    }

    /// @notice M-3: Returns whether a trial's sponsor is still a verified sponsor in the registry.
    /// @dev Returns true on testnet (no registry enforcement) and when registry is unset, so callers
    ///      can use this as a soft gate without breaking existing deployments.
    function isTrialSponsorVerified(uint256 _trialId) external view returns (bool) {
        if (isTestnet || sponsorRegistry == address(0)) return true;
        (bool ok, bytes memory ret) = sponsorRegistry.staticcall(
            abi.encodeWithSignature("isVerifiedSponsor(address)", trials[_trialId].sponsor)
        );
        return ok && ret.length == 32 && abi.decode(ret, (bool));
    }
}
