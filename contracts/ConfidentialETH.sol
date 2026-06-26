// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ConfidentialETH
 * @notice A privacy-preserving wrapper for native ETH (similar to WETH but with FHE)
 * @dev 1 unit = 1 micro-ETH (1e-6 ETH = 1e12 wei)
 */
contract ConfidentialETH is ZamaEthereumConfig, EIP712 {
    uint256 public constant UNIT_SCALE = 1_000_000_000_000; // 1 unit = 1e12 wei = 1 micro-ETH
    uint256 public constant CANCEL_TIMEOUT_FUNDS = 1 hours;

    /// @dev 0 = fast withdrawal, 1 = private exit (relayer may batch submissions)
    uint8 public constant EXIT_MODE_FAST = 0;
    uint8 public constant EXIT_MODE_PRIVATE_BATCH = 1;

    bytes32 private constant WITHDRAW_AUTH_TYPEHASH =
        keccak256(
            "WithdrawAuthorization(address owner,address stealthRecipient,bytes32 sufficientHandle,uint8 exitMode,uint256 nonce,uint256 deadline)"
        );

    struct PendingWithdraw {
        euint64 amount;
        bytes32 sufficientHandle;
        uint256 timestamp;
    }

    struct PendingWithdrawTo {
        euint64 amount;
        bytes32 sufficientHandle;
        address destination;
        uint256 timestamp;
        bool sufficientVerified;
    }

    mapping(address => euint64) private _balances;
    mapping(address => bool) public authorizedContracts;
    mapping(address => PendingWithdraw) private _pendingWithdraw;
    mapping(address => PendingWithdrawTo) private _pendingWithdrawTo;
    mapping(address => bool) private _isPending;
    mapping(address => bool) private _balanceLocked;
    mapping(address => uint256) public withdrawNonces;
    address public owner;
    address public pendingOwner;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    event Deposit(address indexed user);
    event Withdrawal(address indexed user);
    event WithdrawRequested(address indexed user, bytes32 sufficientHandle);
    event WithdrawToRequested(address indexed user, bytes32 sufficientHandle);
    event WithdrawCancelled(address indexed user);
    event WithdrawToCancelled(address indexed user);
    event EncryptedTransfer(address indexed from, address indexed to);
    event WithdrawAmountRevealed(address indexed user, bytes32 amountHandle);
    event PublicExitCompleted(address indexed owner, uint8 exitMode);
    event InsolventWithdrawalAttempted(address indexed user, uint256 requestedWei, uint256 availableWei);
    event TransferSufficiencyPrepared(address indexed from, bytes32 sufficientHandle);
    event BalanceLocked(address indexed user);
    event BalanceUnlocked(address indexed user);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    constructor() EIP712("MedVault ConfidentialETH", "1") {
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
        require(_contract != address(0), "Zero address");
        authorizedContracts[_contract] = true;
    }

    function deauthorizeContract(address _contract) external onlyOwner {
        authorizedContracts[_contract] = false;
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

    function deposit() external payable nonReentrant {
        _deposit(msg.sender, msg.value);
    }

    function _deposit(address user, uint256 value) internal {
        require(value > 0, "Amount must be > 0");
        require(value >= UNIT_SCALE, "Min deposit is 1 micro-ETH");

        uint64 units = uint64(value / UNIT_SCALE);
        // M-6: sub-UNIT_SCALE dust stays in the contract instead of being refunded via user.call.
        // Previously a depositor whose receive() reverts (e.g. a contract wallet that doesn't accept
        // arbitrary ETH) could never deposit at all because the dust refund reverted the whole tx.
        // Dust is accounted for on withdrawal via the per-user UNIT_SCALE rounding already used
        // by depositFor; residual dust is reclaimable via the standard withdraw flow.
        _creditBalance(user, units);

        emit Deposit(user);
    }

    function depositFor(address _recipient) external payable onlyAuthorized {
        require(msg.value > 0, "Amount must be > 0");
        require(msg.value >= UNIT_SCALE, "Min deposit is 1 micro-ETH");

        uint64 units = uint64(msg.value / UNIT_SCALE);
        _creditBalance(_recipient, units);
        // Remainder dust (< UNIT_SCALE) stays in contract to avoid recipient receive() DoS.
    }

    /**
     * @notice Stage a withdraw with an encrypted amount (externalEuint64 + ZKPoK).
     * @dev Only the sufficiency bit is publicly decryptable; amount ciphertext stays private until completion.
     */
    function requestWithdraw(
        externalEuint64 encryptedUnits,
        bytes calldata inputProof
    ) external nonReentrant {
        require(!_balanceLocked[msg.sender], "Balance locked");
        require(!_isPending[msg.sender], "Withdrawal already pending");

        euint64 units = FHE.fromExternal(encryptedUnits, inputProof);
        FHE.allowThis(units);

        euint64 bal = _balances[msg.sender];
        require(FHE.isInitialized(bal), "No balance");

        ebool sufficient = FHE.ge(bal, units);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);

        _pendingWithdraw[msg.sender] = PendingWithdraw({
            amount: units,
            sufficientHandle: sufficientHandle,
            timestamp: block.timestamp
        });
        _isPending[msg.sender] = true;

        emit WithdrawRequested(msg.sender, sufficientHandle);
    }

    /**
     * @notice Phase 1: verify sufficiency and make pending amount publicly decryptable for KMS proof.
     */
    function revealWithdrawAmount(
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external nonReentrant returns (bytes32 amountHandle) {
        return _revealWithdrawAmount(msg.sender, sufficientCleartexts, sufficientProof);
    }

    /**
     * @notice Relayer or authorized contract reveals pending withdraw amount for `owner_`.
     */
    function revealWithdrawAmountFor(
        address owner_,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external nonReentrant onlyAuthorized returns (bytes32 amountHandle) {
        return _revealWithdrawAmount(owner_, sufficientCleartexts, sufficientProof);
    }

    function _revealWithdrawAmount(
        address owner_,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) internal returns (bytes32 amountHandle) {
        PendingWithdraw memory p = _pendingWithdraw[owner_];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        _verifySufficient(p.sufficientHandle, sufficientCleartexts, sufficientProof);
        euint64 pubAmount = FHE.makePubliclyDecryptable(p.amount);
        amountHandle = euint64.unwrap(pubAmount);
        _pendingWithdraw[owner_].amount = pubAmount;
        emit WithdrawAmountRevealed(owner_, amountHandle);
    }

    /**
     * @notice Phase 2: verify amount proof, debit encrypted balance, send native ETH to msg.sender.
     */
    function completeWithdraw(
        bytes calldata amountCleartexts,
        bytes calldata amountProof
    ) external nonReentrant {
        PendingWithdraw memory p = _pendingWithdraw[msg.sender];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");

        euint64 encAmount = p.amount;
        uint64 units = _decodePublicAmount(encAmount, amountCleartexts, amountProof);
        require(units > 0, "Amount must be > 0");

        delete _pendingWithdraw[msg.sender];
        _isPending[msg.sender] = false;

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], encAmount);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[msg.sender]);

        uint256 weiAmount = uint256(units) * UNIT_SCALE;
        require(address(this).balance >= weiAmount, "Insolvent");
        (bool success, ) = msg.sender.call{value: weiAmount}("");
        if (!success) {
            emit InsolventWithdrawalAttempted(msg.sender, weiAmount, address(this).balance);
        }
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender);
    }

    function revealWithdrawToAmount(
        address user,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external nonReentrant onlyAuthorized returns (bytes32 amountHandle) {
        return _revealWithdrawToAmount(user, sufficientCleartexts, sufficientProof);
    }

    function revealWithdrawToAmountFor(
        address user,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external onlyAuthorized returns (bytes32 amountHandle) {
        return _revealWithdrawToAmount(user, sufficientCleartexts, sufficientProof);
    }

    function _revealWithdrawToAmount(
        address user,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) internal returns (bytes32 amountHandle) {
        PendingWithdrawTo memory p = _pendingWithdrawTo[user];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        _verifySufficient(p.sufficientHandle, sufficientCleartexts, sufficientProof);
        euint64 pubAmount = FHE.makePubliclyDecryptable(p.amount);
        amountHandle = euint64.unwrap(pubAmount);
        _pendingWithdrawTo[user].amount = pubAmount;
        _pendingWithdrawTo[user].sufficientVerified = true;
        emit WithdrawAmountRevealed(user, amountHandle);
    }

    /**
     * @notice Relayer-submitted public exit to a stealth recipient with EIP-712 authorization.
     */
    function completePublicExit(
        address owner_,
        address stealthRecipient,
        uint8 exitMode,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof,
        bytes calldata amountCleartexts,
        bytes calldata amountProof
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Authorization expired");
        require(stealthRecipient != address(0), "Zero recipient");
        require(exitMode == EXIT_MODE_FAST || exitMode == EXIT_MODE_PRIVATE_BATCH, "Invalid exit mode");
        require(nonce == withdrawNonces[owner_], "Invalid nonce");

        PendingWithdraw memory p = _pendingWithdraw[owner_];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");

        bytes32 structHash = keccak256(
            abi.encode(
                WITHDRAW_AUTH_TYPEHASH,
                owner_,
                stealthRecipient,
                p.sufficientHandle,
                exitMode,
                nonce,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == owner_, "Invalid signature");

        _verifySufficient(p.sufficientHandle, sufficientCleartexts, sufficientProof);

        euint64 pubAmount = FHE.makePubliclyDecryptable(p.amount);
        _pendingWithdraw[owner_].amount = pubAmount;
        uint64 units = _decodePublicAmount(pubAmount, amountCleartexts, amountProof);
        require(units > 0, "Amount must be > 0");

        withdrawNonces[owner_] = nonce + 1;
        delete _pendingWithdraw[owner_];
        _isPending[owner_] = false;

        _balances[owner_] = FHE.sub(_balances[owner_], pubAmount);
        FHE.allow(_balances[owner_], owner_);
        FHE.allowThis(_balances[owner_]);

        uint256 weiAmount = uint256(units) * UNIT_SCALE;
        require(address(this).balance >= weiAmount, "Insolvent");
        (bool success, ) = stealthRecipient.call{value: weiAmount}("");
        if (!success) {
            emit InsolventWithdrawalAttempted(owner_, weiAmount, address(this).balance);
        }
        require(success, "Transfer failed");

        emit PublicExitCompleted(owner_, exitMode);
    }

    function cancelPendingWithdraw() external {
        PendingWithdraw memory pw = _pendingWithdraw[msg.sender];
        if (pw.sufficientHandle != bytes32(0)) {
            require(block.timestamp > pw.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");
            delete _pendingWithdraw[msg.sender];
            _isPending[msg.sender] = false;
            emit WithdrawCancelled(msg.sender);
            return;
        }

        PendingWithdrawTo memory pwt = _pendingWithdrawTo[msg.sender];
        require(pwt.sufficientHandle != bytes32(0), "Nothing pending");
        require(block.timestamp > pwt.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");
        delete _pendingWithdrawTo[msg.sender];
        _isPending[msg.sender] = false;
        emit WithdrawToCancelled(msg.sender);
    }

    function requestWithdrawTo(
        address user,
        address destination,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof
    ) external onlyAuthorized nonReentrant {
        require(destination != address(0), "Zero destination");
        require(!_balanceLocked[user], "Balance locked");
        require(!_isPending[user], "Withdrawal already pending");

        euint64 units = FHE.fromExternal(encryptedUnits, inputProof);
        FHE.allowThis(units);

        euint64 bal = _balances[user];
        require(FHE.isInitialized(bal), "No balance");

        ebool sufficient = FHE.ge(bal, units);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);

        _pendingWithdrawTo[user] = PendingWithdrawTo({
            amount: units,
            sufficientHandle: sufficientHandle,
            destination: destination,
            timestamp: block.timestamp,
            sufficientVerified: false
        });
        _isPending[user] = true;

        emit WithdrawToRequested(user, sufficientHandle);
    }

    function completeWithdrawTo(
        address user,
        bytes calldata amountCleartexts,
        bytes calldata amountProof
    ) external nonReentrant onlyAuthorized {
        PendingWithdrawTo memory p = _pendingWithdrawTo[user];
        require(p.sufficientHandle != bytes32(0), "Nothing pending");
        require(p.sufficientVerified, "Sufficiency not verified");

        address destination = p.destination;
        euint64 encAmount = p.amount;
        uint64 units = _decodePublicAmount(encAmount, amountCleartexts, amountProof);
        require(units > 0, "Amount must be > 0");

        uint256 weiAmount = uint256(units) * UNIT_SCALE;
        require(address(this).balance >= weiAmount, "Insolvent");

        delete _pendingWithdrawTo[user];
        _isPending[user] = false;

        _balances[user] = FHE.sub(_balances[user], encAmount);
        FHE.allow(_balances[user], user);
        FHE.allowThis(_balances[user]);

        (bool success, ) = destination.call{value: weiAmount}("");
        require(success, "Transfer failed");

        emit Withdrawal(user);
    }

    function pendingWithdrawHandle(address user) external view returns (bytes32) {
        return _pendingWithdraw[user].sufficientHandle;
    }

    function pendingWithdrawToHandle(address user) external view returns (bytes32) {
        return _pendingWithdrawTo[user].sufficientHandle;
    }

    /**
     * @notice Lock `user` balance against concurrent withdraw/debit while an authorized flow completes.
     * @dev Only authorized contracts (e.g. StakingManager) may lock/unlock.
     */
    function lockBalance(address user) external onlyAuthorized {
        require(!_balanceLocked[user], "Balance already locked");
        _balanceLocked[user] = true;
        emit BalanceLocked(user);
    }

    function unlockBalance(address user) external onlyAuthorized {
        require(_balanceLocked[user], "Balance not locked");
        _balanceLocked[user] = false;
        emit BalanceUnlocked(user);
    }

    function isBalanceLocked(address user) external view returns (bool) {
        return _balanceLocked[user];
    }

    /**
     * @notice Prepare a publicly-decryptable sufficiency handle for `transferEncrypted` (same-tx or while locked).
     */
    function previewTransferSufficiency(address from, euint64 amount) external onlyAuthorized returns (bytes32) {
        require(!_isPending[from], "Pending withdraw blocks transfer");
        require(FHE.isInitialized(_balances[from]), "No balance");
        ebool sufficient = FHE.ge(_balances[from], amount);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        bytes32 sufficientHandle = ebool.unwrap(sufficient);
        emit TransferSufficiencyPrepared(from, sufficientHandle);
        return sufficientHandle;
    }

    /**
     * @notice Authorized encrypted transfer with runtime KMS-verified sufficiency (prevents FHE.sub underflow drain).
     */
    function transferEncrypted(
        address from,
        address to,
        euint64 amount,
        bytes calldata sufficientCleartexts,
        bytes calldata sufficientProof
    ) external onlyAuthorized {
        require(!_isPending[from], "Pending withdraw blocks transfer");
        require(FHE.isInitialized(_balances[from]), "No balance");

        ebool sufficient = FHE.ge(_balances[from], amount);
        sufficient = FHE.makePubliclyDecryptable(sufficient);
        _verifySufficient(ebool.unwrap(sufficient), sufficientCleartexts, sufficientProof);

        _applyEncryptedTransfer(from, to, amount);
    }

    function _applyEncryptedTransfer(address from, address to, euint64 amount) private {
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

    function getBalanceForAuthorized(address user) external returns (euint64) {
        require(authorizedContracts[msg.sender], "Not authorized");
        euint64 bal = _balances[user];
        if (FHE.isInitialized(bal)) {
            FHE.allowThis(bal);
            FHE.allow(bal, msg.sender);
        }
        return bal;
    }

    function getBalance(address user) external view returns (euint64) {
        return _balances[user];
    }

    function _verifySufficient(
        bytes32 sufficientHandle,
        bytes calldata cleartexts,
        bytes calldata proof
    ) internal {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = sufficientHandle;
        FHE.checkSignatures(handles, cleartexts, proof);
        bool ok = abi.decode(cleartexts, (bool));
        require(ok, "Insufficient balance");
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

    receive() external payable nonReentrant {
        _deposit(msg.sender, msg.value);
    }
}
