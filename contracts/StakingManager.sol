// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.27;



import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

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



contract StakingManager is ZamaEthereumConfig, IERC7984Receiver {

    uint256 public constant CANCEL_TIMEOUT_FUNDS = 1 hours;

    bytes1 private constant STAKE_AND_LOCK_FLAG = 0x01;



    struct PendingUnstake {

        euint64 amountGwei;

        euint64 transferableGwei;

        bytes32 transferableHandle;

        uint256 timestamp;

    }



    struct PendingPublicUnstake {

        uint256 amountWei;

        euint64 transferableGwei;

        bytes32 transferableHandle;

        uint256 timestamp;

    }



    struct PendingConfidentialStake {

        euint64 amountGwei;

        euint64 transferableGwei;

        bytes32 transferableHandle;

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

    event PrivateUnstakeRequested(address indexed user, bytes32 transferableHandle);

    event PrivateUnstaked(address indexed user);

    event ConfidentialStakeRequested(address indexed user, bytes32 transferableHandle);

    event PublicUnstakeRequested(address indexed user, bytes32 transferableHandle);

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

        externalEuint64,

        bytes calldata

    ) external pure {

        revert("Use stakeAndLock");

    }



    /**

     * @notice Deprecated: use stakeAndLock (request/complete cannot pull user cETH via transferEncrypted).

     */

    function completeConfidentialStake(

        bytes calldata,

        bytes calldata

    ) external pure {

        revert("Use stakeAndLock");

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



        euint64 transferable = FHE.select(FHE.ge(encStaked, units), units, FHE.asEuint64(0));

        transferable = FHE.makePubliclyDecryptable(transferable);
        FHE.allowThis(transferable);

        bytes32 transferableHandle = euint64.unwrap(transferable);



        _pendingPrivateUnstake[msg.sender] = PendingUnstake({

            amountGwei: units,

            transferableGwei: transferable,

            transferableHandle: transferableHandle,

            timestamp: block.timestamp

        });

        _isPendingPrivate[msg.sender] = true;



        emit PrivateUnstakeRequested(msg.sender, transferableHandle);

    }



    function completePrivateUnstake(

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant {

        PendingUnstake memory p = _pendingPrivateUnstake[msg.sender];

        require(p.transferableHandle != bytes32(0), "Nothing pending");



        uint64 transferableUnits = _decodePublicAmount(p.transferableGwei, transferableCleartexts, transferableProof);

        euint64 encAmount = FHE.asEuint64(transferableUnits);

        delete _pendingPrivateUnstake[msg.sender];

        _isPendingPrivate[msg.sender] = false;



        if (transferableUnits == 0) {

            return;

        }



        _privateStakedGwei[msg.sender] = FHE.sub(_privateStakedGwei[msg.sender], encAmount);

        FHE.allow(_privateStakedGwei[msg.sender], msg.sender);

        FHE.allowThis(_privateStakedGwei[msg.sender]);

        FHE.allow(encAmount, address(cETH));

        cETH.transferEncrypted(address(this), msg.sender, encAmount);



        if (_pendingConfidentialStake[msg.sender].transferableHandle != bytes32(0)) {

            euint64 remaining = _privateStakedGwei[msg.sender];

            if (!FHE.isInitialized(remaining) || euint64.unwrap(remaining) == bytes32(0)) {

                delete _pendingConfidentialStake[msg.sender];

                if (cETH.isBalanceLocked(msg.sender)) {

                    cETH.unlockBalance(msg.sender);

                }

            }

        }



        emit PrivateUnstaked(msg.sender);

    }



    /**

     * @notice Atomic confidential stake + balance lock via ERC-7984 transfer-and-call.

     * @dev Caller must set this contract as cETH operator (`cETH.setOperator`) first.

     */

    function stakeAndLock(

        externalEuint64 encryptedUnits,

        bytes calldata inputProof

    ) external nonReentrant {

        require(_pendingConfidentialStake[msg.sender].transferableHandle == bytes32(0), "Stake already pending");

        require(!_isPendingPrivate[msg.sender], "Unstake pending");

        IERC7984(address(cETH)).confidentialTransferFromAndCall(

            msg.sender,

            address(this),

            encryptedUnits,

            inputProof,

            abi.encodePacked(STAKE_AND_LOCK_FLAG)

        );

    }



    /**

     * @notice Callback data for direct `cETH.confidentialTransferAndCall` stake+lock (no operator).

     */

    function stakeAndLockCallbackData() external pure returns (bytes memory) {

        return abi.encodePacked(STAKE_AND_LOCK_FLAG);

    }



    /**

     * @notice ERC-7984 callback for atomic confidential stake via `cETH.confidentialTransferAndCall`.

     * @dev Credits `_privateStakedGwei[from]`; returns encrypted false on validation failure (OZ refund).

     */

    function onConfidentialTransferReceived(

        address /* operator */,

        address from,

        euint64 amount,

        bytes calldata data

    ) external override returns (ebool) {

        if (msg.sender != address(cETH)) {

            return _receiverReject();

        }

        if (_isPendingPrivate[from] || _pendingConfidentialStake[from].transferableHandle != bytes32(0)) {

            return _receiverReject();

        }



        if (FHE.isInitialized(_privateStakedGwei[from])) {

            _privateStakedGwei[from] = FHE.add(_privateStakedGwei[from], amount);

        } else {

            _privateStakedGwei[from] = amount;

        }

        FHE.allow(_privateStakedGwei[from], from);

        FHE.allowThis(_privateStakedGwei[from]);



        if (data.length == 1 && data[0] == STAKE_AND_LOCK_FLAG) {

            cETH.lockBalance(from);

            _pendingConfidentialStake[from] = PendingConfidentialStake({

                amountGwei: amount,

                transferableGwei: amount,

                transferableHandle: euint64.unwrap(amount),

                timestamp: block.timestamp

            });

        }



        emit Staked(from);

        return _receiverAccept();

    }



    function _receiverAccept() private returns (ebool retval) {

        retval = FHE.asEbool(true);

        FHE.allow(retval, address(cETH));

        return retval;

    }



    function _receiverReject() private returns (ebool retval) {

        retval = FHE.asEbool(false);

        FHE.allow(retval, address(cETH));

        return retval;

    }



    /** @dev Back-compat alias for public Aave unstake staging. */

    function requestUnstake(uint256 amount) external nonReentrant {

        _requestPublicUnstake(amount);

    }



    /** @dev Back-compat alias for public Aave unstake completion. */

    function completeUnstake(

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant {

        _completePublicUnstake(transferableCleartexts, transferableProof);

    }



    function requestPublicUnstake(uint256 amount) external nonReentrant {

        _requestPublicUnstake(amount);

    }



    function completePublicUnstake(

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant {

        _completePublicUnstake(transferableCleartexts, transferableProof);

    }



    function _requestPublicUnstake(uint256 amount) internal {

        require(amount > 0, "Amount must be > 0");

        require(!_isPendingPublic[msg.sender], "Unstake already pending");

        require(amount % 1e9 == 0, "Amount must be whole Gwei");



        euint64 encStaked = _publicStakedGwei[msg.sender];

        require(FHE.isInitialized(encStaked), "No public stake found");



        uint64 units = uint64(amount / 1e9);

        euint64 encUnits = FHE.asEuint64(units);

        euint64 transferable = FHE.select(FHE.ge(encStaked, encUnits), encUnits, FHE.asEuint64(0));

        transferable = FHE.makePubliclyDecryptable(transferable);
        FHE.allowThis(transferable);

        bytes32 transferableHandle = euint64.unwrap(transferable);



        _pendingPublicUnstake[msg.sender] = PendingPublicUnstake({

            amountWei: amount,

            transferableGwei: transferable,

            transferableHandle: transferableHandle,

            timestamp: block.timestamp

        });

        _isPendingPublic[msg.sender] = true;



        emit PublicUnstakeRequested(msg.sender, transferableHandle);

    }



    function _completePublicUnstake(

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) internal {

        PendingPublicUnstake memory p = _pendingPublicUnstake[msg.sender];

        require(p.transferableHandle != bytes32(0), "Nothing pending");



        uint64 transferableUnits = _decodePublicAmount(p.transferableGwei, transferableCleartexts, transferableProof);

        uint256 withdrawWei = uint256(transferableUnits) * 1e9;

        delete _pendingPublicUnstake[msg.sender];

        _isPendingPublic[msg.sender] = false;



        if (transferableUnits == 0) {

            return;

        }



        bool success = IERC20(aWeth).transferFrom(msg.sender, address(this), withdrawWei);

        require(success, "aWETH transfer failed");



        IERC20(aWeth).approve(wethGateway, withdrawWei);

        IWrappedTokenGatewayV3(wethGateway).withdrawETH(aavePool, withdrawWei, msg.sender);

        IERC20(aWeth).approve(wethGateway, 0);



        euint64 encAmount = FHE.asEuint64(transferableUnits);

        _publicStakedGwei[msg.sender] = FHE.sub(_publicStakedGwei[msg.sender], encAmount);

        FHE.allow(_publicStakedGwei[msg.sender], msg.sender);

        FHE.allowThis(_publicStakedGwei[msg.sender]);



        emit PublicUnstaked(msg.sender);

    }



    function pendingUnstakeHandle(address user) external view returns (bytes32) {

        PendingPublicUnstake memory pub = _pendingPublicUnstake[user];

        if (pub.transferableHandle != bytes32(0)) return pub.transferableHandle;

        return _pendingPrivateUnstake[user].transferableHandle;

    }



    function cancelPendingUnstake() external {

        PendingUnstake memory priv = _pendingPrivateUnstake[msg.sender];

        if (priv.transferableHandle != bytes32(0)) {

            require(block.timestamp > priv.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");

            delete _pendingPrivateUnstake[msg.sender];

            _isPendingPrivate[msg.sender] = false;

            emit UnstakeCancelled(msg.sender);

            return;

        }



        PendingPublicUnstake memory pub = _pendingPublicUnstake[msg.sender];

        require(pub.transferableHandle != bytes32(0), "Nothing pending");

        require(block.timestamp > pub.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");

        delete _pendingPublicUnstake[msg.sender];

        _isPendingPublic[msg.sender] = false;

        emit UnstakeCancelled(msg.sender);

    }



    function cancelPendingConfidentialStake() external nonReentrant {

        PendingConfidentialStake memory p = _pendingConfidentialStake[msg.sender];

        require(p.transferableHandle != bytes32(0), "Nothing pending");

        require(block.timestamp > p.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");

        require(!_isPendingPrivate[msg.sender], "Unstake pending");



        delete _pendingConfidentialStake[msg.sender];

        euint64 staked = _privateStakedGwei[msg.sender];

        if (FHE.isInitialized(staked)) {

            _privateStakedGwei[msg.sender] = FHE.asEuint64(0);

            FHE.allow(staked, address(cETH));

            cETH.transferEncrypted(address(this), msg.sender, staked);

        }

        if (cETH.isBalanceLocked(msg.sender)) {

            cETH.unlockBalance(msg.sender);

        }

    }



    function getEncryptedTotalStaked(address user) external returns (euint64) {

        require(msg.sender == user, "Not authorized");

        bool hasPublic = FHE.isInitialized(_publicStakedGwei[user]);

        bool hasPrivate = FHE.isInitialized(_privateStakedGwei[user]);

        if (hasPublic && hasPrivate) {

            revert("Mixed stake units: use getEncryptedPublicStaked and getEncryptedPrivateStaked");

        }

        euint64 total;

        if (hasPublic) {

            total = _publicStakedGwei[user];

        } else if (hasPrivate) {

            total = _privateStakedGwei[user];

        } else {

            return _privateStakedGwei[user];

        }

        FHE.allow(total, msg.sender);

        FHE.allowThis(total);

        return total;

    }



    function getEncryptedPublicStaked(address user) external view returns (euint64) {

        return _publicStakedGwei[user];

    }



    function getEncryptedPrivateStaked(address user) external view returns (euint64) {

        return _privateStakedGwei[user];

    }



    function _decodePublicAmount(

        euint64 encAmount,

        bytes calldata cleartexts,

        bytes calldata proof

    ) internal returns (uint64 units) {

        bytes32 amountHandle = euint64.unwrap(encAmount);

        bytes32[] memory handles = new bytes32[](1);

        handles[0] = amountHandle;

        FHE.checkSignatures(handles, cleartexts, proof);

        units = abi.decode(cleartexts, (uint64));

    }



    receive() external payable {

        revert("Direct ETH not accepted");

    }

}


