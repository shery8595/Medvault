// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialETH
 * @notice A privacy-preserving wrapper for native ETH (similar to WETH but with FHE)
 * @dev 1 unit = 1 micro-ETH (1e-6 ETH = 1e12 wei)
 */
contract ConfidentialETH is ZamaEthereumConfig {
    uint256 public constant UNIT_SCALE = 1_000_000_000_000; // 1 unit = 1e12 wei = 1 micro-ETH

    mapping(address => euint64) private _balances;
    mapping(address => bool) public authorizedContracts;
    address public owner;
    
    // Reentrancy Guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    event Deposit(address indexed user, uint256 weiAmount, uint64 units);
    event Withdrawal(address indexed user, uint256 weiAmount);
    event EncryptedTransfer(address indexed from, address indexed to);

    constructor() {
        owner = msg.sender;
        _status = _NOT_ENTERED;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedContracts[msg.sender], "Not authorized");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function authorizeContract(address _contract) external onlyOwner {
        authorizedContracts[_contract] = true;
    }

    /**
     * @notice Deposit native ETH and receive encrypted balance
     */
    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        require(msg.value >= UNIT_SCALE, "Min deposit is 1 micro-ETH");
        
        uint64 units = uint64(msg.value / UNIT_SCALE);
        _creditBalance(msg.sender, units);

        emit Deposit(msg.sender, msg.value, units);
    }

    /**
     * @notice Deposit ETH on behalf of another user (used by authorized vault contracts)
     * @dev The vault calls this to credit encrypted cETH to a participant's balance
     */
    function depositFor(address _recipient) external payable onlyAuthorized {
        require(msg.value > 0, "Amount must be > 0");
        require(msg.value >= UNIT_SCALE, "Min deposit is 1 micro-ETH");
        
        uint64 units = uint64(msg.value / UNIT_SCALE);
        _creditBalance(_recipient, units);

        emit Deposit(_recipient, msg.value, units);
    }

    /**
     * @notice Withdraw by providing the plaintext amount you wish to withdraw
     * @dev FHE.sub will revert via the coprocessor if balance < amount (underflow).
     */
    function withdraw(uint64 units) external nonReentrant {
        require(units > 0, "Amount must be > 0");
        require(FHE.isInitialized(_balances[msg.sender]), "No balance");
        
        euint64 eAmount = FHE.asEuint64(units);
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], eAmount);
        
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[msg.sender]);
        
        uint256 weiAmount = uint256(units) * UNIT_SCALE;
        
        (bool success, ) = msg.sender.call{value: weiAmount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, weiAmount);
    }

    /**
     * @notice Withdraw on behalf of a user to a specific destination (used by authorized contracts)
     */
    function withdrawTo(address user, address destination, uint64 units) external onlyAuthorized nonReentrant {
        require(units > 0, "Amount must be > 0");
        require(FHE.isInitialized(_balances[user]), "No balance");
        
        euint64 eAmount = FHE.asEuint64(units);
        _balances[user] = FHE.sub(_balances[user], eAmount);
        
        FHE.allow(_balances[user], user);
        FHE.allowThis(_balances[user]);
        
        uint256 weiAmount = uint256(units) * UNIT_SCALE;
        
        (bool success, ) = destination.call{value: weiAmount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(user, weiAmount);
    }

    /**
     * @notice Encrypted transfer between accounts (used by authorized vault contracts)
     */
    function transferEncrypted(address from, address to, euint64 amount) external onlyAuthorized {
        _balances[from] = FHE.sub(_balances[from], amount);
        
        if (FHE.isInitialized(_balances[to])) {
            _balances[to] = FHE.add(_balances[to], amount);
        } else {
            _balances[to] = amount;
        }
        
        FHE.allow(_balances[from], from);
        FHE.allow(_balances[to], to);
        FHE.allowThis(_balances[from]);
        FHE.allowThis(_balances[to]);

        emit EncryptedTransfer(from, to);
    }

    function getBalance(address user) external view returns (euint64) {
        return _balances[user];
    }

    /**
     * @dev Internal helper to credit encrypted balance
     */
    function _creditBalance(address user, uint64 units) internal {
        euint64 encryptedAmount = FHE.asEuint64(units);
        
        if (FHE.isInitialized(_balances[user])) {
            _balances[user] = FHE.add(_balances[user], encryptedAmount);
        } else {
            _balances[user] = encryptedAmount;
        }
        
        FHE.allow(_balances[user], user);
        FHE.allowThis(_balances[user]);
    }

    receive() external payable {}
}
