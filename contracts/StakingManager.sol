// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
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

contract StakingManager {
    address public constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address public constant WETH_GATEWAY = 0x387d311e47e80b498169e6fb51d3193167d89F7D;
    address public constant AWETH = 0x5B071B590a59395FE4025a0CCc1Fcc931EaC2323;

    // Reentrancy Guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    ConfidentialETH public cETH;
    mapping(address => euint64) private _encryptedTotalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address payable _cETH) {
        cETH = ConfidentialETH(_cETH);
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Stakes ETH into Aave V3 and records the amount encrypted
     */
    function stake() external payable {
        require(msg.value > 0, "Must stake > 0");
        
        // Supply ETH to Aave -> receives aWETH
        IWrappedTokenGatewayV3(WETH_GATEWAY).depositETH{value: msg.value}(
            AAVE_POOL,
            msg.sender, // aWETH sent to user
            0
        );

        // Encrypt and store the staked amount securely in Gwei to fit euint64 safety
        euint64 encAmount = FHE.asEuint64(uint64(msg.value / 1e9)); 
        if (euint64.unwrap(_encryptedTotalStaked[msg.sender]) != 0) {
            _encryptedTotalStaked[msg.sender] = FHE.add(_encryptedTotalStaked[msg.sender], encAmount);
        } else {
            _encryptedTotalStaked[msg.sender] = encAmount;
        }
        
        FHE.allow(_encryptedTotalStaked[msg.sender], msg.sender);
        FHE.allowThis(_encryptedTotalStaked[msg.sender]);

        emit Staked(msg.sender, msg.value);
    }

    /**
     * @notice Unstakes from Aave by withdrawing ETH 
     * @dev User MUST approve this contract to spend their aWETH before calling!
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Transfer aWETH from user to this contract
        bool success = IERC20(AWETH).transferFrom(msg.sender, address(this), amount);
        require(success, "aWETH transfer failed");

        // Approve WETH Gateway to burn aWETH
        IERC20(AWETH).approve(WETH_GATEWAY, amount);

        // Withdraw ETH from Aave to user
        IWrappedTokenGatewayV3(WETH_GATEWAY).withdrawETH(AAVE_POOL, amount, msg.sender);

        // Deduct from encrypted balance
        euint64 encAmount = FHE.asEuint64(uint64(amount / 1e9));
        if (euint64.unwrap(_encryptedTotalStaked[msg.sender]) != 0) {
            _encryptedTotalStaked[msg.sender] = FHE.sub(_encryptedTotalStaked[msg.sender], encAmount);
            FHE.allow(_encryptedTotalStaked[msg.sender], msg.sender);
            FHE.allowThis(_encryptedTotalStaked[msg.sender]);
        }

        emit Unstaked(msg.sender, amount);
    }

    function getEncryptedTotalStaked(address user) external view returns (euint64) {
        return _encryptedTotalStaked[user];
    }

    /**
     * @notice Stakes ETH directly from the participant's ConfidentialETH balance
     */
    function stakeFromConfidential(uint64 units) external {
        require(units > 0, "Must stake > 0");
        uint256 weiAmount = uint256(units) * cETH.UNIT_SCALE();

        // This requires StakingManager to be authorized on cETH!
        cETH.withdrawTo(msg.sender, address(this), units);

        // Supply ETH to Aave -> receives aWETH
        IWrappedTokenGatewayV3(WETH_GATEWAY).depositETH{value: weiAmount}(
            AAVE_POOL,
            msg.sender, // aWETH sent to user
            0
        );

        euint64 encAmount = FHE.asEuint64(uint64(weiAmount / 1e9)); 
        if (euint64.unwrap(_encryptedTotalStaked[msg.sender]) != 0) {
            _encryptedTotalStaked[msg.sender] = FHE.add(_encryptedTotalStaked[msg.sender], encAmount);
        } else {
            _encryptedTotalStaked[msg.sender] = encAmount;
        }
        
        FHE.allow(_encryptedTotalStaked[msg.sender], msg.sender);
        FHE.allowThis(_encryptedTotalStaked[msg.sender]);

        emit Staked(msg.sender, weiAmount);
    }

    receive() external payable {}
}
