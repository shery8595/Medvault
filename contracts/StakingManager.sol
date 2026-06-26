// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./ConfidentialETH.sol";

interface IWrappedTokenGatewayV3 {
    function depositETH(address pool, address onBehalfOf, uint16 referralCode) external payable;
    function withdrawETH(address pool, uint256 amount, address to) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract StakingManager is ZamaEthereumConfig {
    uint256 public constant CANCEL_TIMEOUT_FUNDS = 1 hours;

    struct PendingUnstake {
        euint64 amountGwei;
        bytes32 sufficientHandle;
        uint256 timestamp;
    }

    struct PendingPublicUnstake {
        uint256 amountWei;
        bytes32 sufficientHandle;
        uint256 timestamp;
    }

    struct PendingConfidentialStake {
        euint64 amountGwei;
        bytes32 sufficientHandle;
        uint256 timestamp;
    }

    address public immutable aavePool;
    address public immutable wethGateway;
    address public immutable aWeth;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    ConfidentialETH public cETH;
    mapping(address => euint64) private _publicStakedGwei;
    mapping(address => euint64) private _privateStakedGwei;
    mapping(address => PendingUnstake) private _pendingPrivateUnstake;
    mapping(address => PendingPublicUnstake) private _pendingPublicUnstake;
    mapping(address => PendingConfidentialStake) private _pendingConfidentialStake;
    mapping(address => bool) private _isPendingPrivate;
    mapping(address => bool) private _isPendingPublic;

    address public owner;
    address public pendingOwner;

    event Staked(address indexed user);
    event Unstaked(address indexed user);
    event PrivateUnstakeRequested(address indexed user, bytes32 sufficientHandle);
    event PrivateUnstaked(address indexed user);
    event ConfidentialStakeRequested(address indexed user, bytes32 sufficientHandle);
    event PublicUnstakeRequested(address indexed user, bytes32 sufficientHandle);
    event PublicUnstaked(address indexed user);
    event UnstakeCancelled(address indexed user);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    constructor(
        address payable _cETH,
        address _aavePool,
        address _wethGateway,
        address _aWeth
    ) {
        require(_aavePool != address(0) && _wethGateway != address(0) && _aWeth != address(0), "Zero Aave address");
        cETH = ConfidentialETH(_cETH);
        aavePool = _aavePool;
        wethGateway = _wethGateway;
        aWeth = _aWeth;
        _status = _NOT_ENTERED;
        owner = msg.sender;
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

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Public stake into Aave V3 (amount visible on-chain).
     */
    function stake() external payable nonReentrant {
        require(msg.value > 0, "Must stake > 0");
        require(msg.value % 1e9 == 0, "Stake amount must be a whole Gwei");
        require(msg.value / 1e9 <= type(uint64).max, "Stake overflows uint64");

        IWrappedTokenGatewayV3(wethGateway).depositETH{value: msg.value}(
            aavePool,
            msg.sender,
            0
        );

        euint64 encAmount = FHE.asEuint64(uint64(msg.value / 1e9));
        if (FHE.isInitialized(_publicStakedGwei[msg.sender])) {
            _publicStakedGwei[msg.sender] = FHE.add(_publicStakedGwei[msg.sender], encAmount);
        } else {
            _publicStakedGwei[msg.sender] = encAmount;
        }

        FHE.allow(_publicStakedGwei[msg.sender], msg.sender);
        FHE.allowThis(_publicStakedGwei[msg.sender]);

        emit Staked(msg.sender);
    }

    /**
     * @notice Stage confidential stake: verify encrypted cETH balance sufficiency before transfer.
     */
    function requestConfidentialStake(
        externalEuint64 encryptedUnits,
        bytes calldata inputProof
    ) external nonReentrant {
        require(_pendingConfidentialStake[msg.sender].sufficientHandle == bytes32(0), "Stake already pending");

        euint64 units = FHE.fromExternal(encryptedUnits, inputProof);
        FHE.allowThis(units);

        euint64 bal = cETH.getBalanceForAuthorized(msg.sender);
        require(FHE.isInitialized(bal), "No cETH balance");

        ebool sufficient = FHE.ge(bal, units);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);

        _pendingConfidentialStake[msg.sender] = PendingConfidentialStake({
            amountGwei: units,
            sufficientHandle: sufficientHandle,
            timestamp: block.timestamp
        });

        cETH.lockBalance(msg.sender);

        emit ConfidentialStakeRequested(msg.sender, sufficientHandle);
    }

    /**
     * @notice Complete confidential stake after KMS verifies runtime transfer sufficiency.
     * @param transferCleartexts KMS cleartext for fresh `ge(balance, amount)` at completion time.
     * @param transferProof KMS signature for the runtime sufficiency handle.
     */
    function completeConfidentialStake(
        bytes calldata transferCleartexts,
        bytes calldata transferProof
    ) external nonReentrant {
        PendingConfidentialStake memory p = _pendingConfidentialStake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");

        euint64 units = p.amountGwei;
        delete _pendingConfidentialStake[msg.sender];
        cETH.unlockBalance(msg.sender);

        FHE.allow(units, address(cETH));
        cETH.transferEncrypted(msg.sender, address(this), units, transferCleartexts, transferProof);

        if (FHE.isInitialized(_privateStakedGwei[msg.sender])) {
            _privateStakedGwei[msg.sender] = FHE.add(_privateStakedGwei[msg.sender], units);
        } else {
            _privateStakedGwei[msg.sender] = units;
        }

        FHE.allow(_privateStakedGwei[msg.sender], msg.sender);
        FHE.allowThis(_privateStakedGwei[msg.sender]);

        emit Staked(msg.sender);
    }

    /**
     * @notice Prepare KMS transfer-sufficiency proof for `completeConfidentialStake`.
     */
    function previewConfidentialStakeTransfer() external returns (bytes32) {
        PendingConfidentialStake memory p = _pendingConfidentialStake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        FHE.allow(p.amountGwei, address(cETH));
        return cETH.previewTransferSufficiency(msg.sender, p.amountGwei);
    }

    /**
     * @notice Private stake from encrypted cETH balance (no Aave deposit; stays in MedVault ledger).
     * @dev Deprecated: use requestConfidentialStake + completeConfidentialStake.
     */
    function stakeFromConfidential(
        externalEuint64,
        bytes calldata
    ) external pure {
        revert("Use requestConfidentialStake + completeConfidentialStake");
    }

    /**
     * @notice Private unstake: release encrypted stake back to user's cETH balance (no Aave exit).
     */
    function requestPrivateUnstake(
        externalEuint64 encryptedGweiUnits,
        bytes calldata inputProof
    ) external nonReentrant {
        require(!_isPendingPrivate[msg.sender], "Unstake already pending");

        euint64 units = FHE.fromExternal(encryptedGweiUnits, inputProof);
        FHE.allowThis(units);

        euint64 encStaked = _privateStakedGwei[msg.sender];
        require(FHE.isInitialized(encStaked), "No private stake found");

        ebool sufficient = FHE.ge(encStaked, units);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);

        _pendingPrivateUnstake[msg.sender] = PendingUnstake({
            amountGwei: units,
            sufficientHandle: sufficientHandle,
            timestamp: block.timestamp
        });
        _isPendingPrivate[msg.sender] = true;

        emit PrivateUnstakeRequested(msg.sender, sufficientHandle);
    }

    function completePrivateUnstake(
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof,
        bytes calldata transferCleartexts,
        bytes calldata transferProof
    ) external nonReentrant {
        PendingUnstake memory p = _pendingPrivateUnstake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = p.sufficientHandle;
        FHE.checkSignatures(handles, sufficientCleartexts, sufficientProof);
        bool ok = abi.decode(sufficientCleartexts, (bool));
        require(ok, "Insufficient staked balance");

        euint64 encAmount = p.amountGwei;
        delete _pendingPrivateUnstake[msg.sender];
        _isPendingPrivate[msg.sender] = false;

        _privateStakedGwei[msg.sender] = FHE.sub(_privateStakedGwei[msg.sender], encAmount);
        FHE.allow(_privateStakedGwei[msg.sender], msg.sender);
        FHE.allowThis(_privateStakedGwei[msg.sender]);
        FHE.allow(encAmount, address(cETH));

        cETH.transferEncrypted(address(this), msg.sender, encAmount, transferCleartexts, transferProof);

        emit PrivateUnstaked(msg.sender);
    }

    /**
     * @notice Prepare KMS transfer-sufficiency proof for `completePrivateUnstake`.
     */
    function previewPrivateUnstakeTransfer() external returns (bytes32) {
        PendingUnstake memory p = _pendingPrivateUnstake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        FHE.allow(p.amountGwei, address(cETH));
        return cETH.previewTransferSufficiency(address(this), p.amountGwei);
    }

    /** @dev Back-compat alias for public Aave unstake staging. */
    function requestUnstake(uint256 amount) external nonReentrant {
        _requestPublicUnstake(amount);
    }

    /** @dev Back-compat alias for public Aave unstake completion. */
    function completeUnstake(bytes calldata sufficientCleartexts, bytes calldata sufficientProof) external nonReentrant {
        _completePublicUnstake(sufficientCleartexts, sufficientProof);
    }

    function requestPublicUnstake(uint256 amount) external nonReentrant {
        _requestPublicUnstake(amount);
    }

    function completePublicUnstake(
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external nonReentrant {
        _completePublicUnstake(sufficientCleartexts, sufficientProof);
    }

    function _requestPublicUnstake(uint256 amount) internal {
        require(amount > 0, "Amount must be > 0");
        require(!_isPendingPublic[msg.sender], "Unstake already pending");
        require(amount % 1e9 == 0, "Amount must be whole Gwei");

        euint64 encStaked = _publicStakedGwei[msg.sender];
        require(FHE.isInitialized(encStaked), "No public stake found");

        uint64 units = uint64(amount / 1e9);
        ebool sufficient = FHE.ge(encStaked, FHE.asEuint64(units));
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);

        _pendingPublicUnstake[msg.sender] = PendingPublicUnstake({
            amountWei: amount,
            sufficientHandle: sufficientHandle,
            timestamp: block.timestamp
        });
        _isPendingPublic[msg.sender] = true;

        emit PublicUnstakeRequested(msg.sender, sufficientHandle);
    }

    function _completePublicUnstake(
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) internal {
        PendingPublicUnstake memory p = _pendingPublicUnstake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = p.sufficientHandle;
        FHE.checkSignatures(handles, sufficientCleartexts, sufficientProof);
        bool ok = abi.decode(sufficientCleartexts, (bool));
        require(ok, "Insufficient staked balance");

        uint256 amount = p.amountWei;
        delete _pendingPublicUnstake[msg.sender];
        _isPendingPublic[msg.sender] = false;

        bool success = IERC20(aWeth).transferFrom(msg.sender, address(this), amount);
        require(success, "aWETH transfer failed");

        IERC20(aWeth).approve(wethGateway, amount);
        IWrappedTokenGatewayV3(wethGateway).withdrawETH(aavePool, amount, msg.sender);
        IERC20(aWeth).approve(wethGateway, 0);

        euint64 encAmount = FHE.asEuint64(uint64(amount / 1e9));
        _publicStakedGwei[msg.sender] = FHE.sub(_publicStakedGwei[msg.sender], encAmount);
        FHE.allow(_publicStakedGwei[msg.sender], msg.sender);
        FHE.allowThis(_publicStakedGwei[msg.sender]);

        emit PublicUnstaked(msg.sender);
    }

    function pendingUnstakeHandle(address user) external view returns (bytes32) {
        PendingPublicUnstake memory pub = _pendingPublicUnstake[user];
        if (pub.sufficientHandle != bytes32(0)) return pub.sufficientHandle;
        return _pendingPrivateUnstake[user].sufficientHandle;
    }

    function cancelPendingUnstake() external {
        PendingUnstake memory priv = _pendingPrivateUnstake[msg.sender];
        if (priv.sufficientHandle != bytes32(0)) {
            require(block.timestamp > priv.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");
            delete _pendingPrivateUnstake[msg.sender];
            _isPendingPrivate[msg.sender] = false;
            emit UnstakeCancelled(msg.sender);
            return;
        }

        PendingPublicUnstake memory pub = _pendingPublicUnstake[msg.sender];
        require(pub.sufficientHandle != bytes32(0), "Nothing pending");
        require(block.timestamp > pub.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");
        delete _pendingPublicUnstake[msg.sender];
        _isPendingPublic[msg.sender] = false;
        emit UnstakeCancelled(msg.sender);
    }

    function cancelPendingConfidentialStake() external {
        PendingConfidentialStake memory p = _pendingConfidentialStake[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        require(block.timestamp > p.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");
        delete _pendingConfidentialStake[msg.sender];
        cETH.unlockBalance(msg.sender);
    }

    function getEncryptedTotalStaked(address user) external view returns (euint64) {
        if (FHE.isInitialized(_publicStakedGwei[user])) return _publicStakedGwei[user];
        return _privateStakedGwei[user];
    }

    function getEncryptedPublicStaked(address user) external view returns (euint64) {
        return _publicStakedGwei[user];
    }

    function getEncryptedPrivateStaked(address user) external view returns (euint64) {
        return _privateStakedGwei[user];
    }

    receive() external payable {
        revert("Direct ETH not accepted");
    }
}
