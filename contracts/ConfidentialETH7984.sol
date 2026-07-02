// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.27;



import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

import {TestHelpers} from "./test/TestHelpers.sol";



/**

 * @title ConfidentialETH7984

 * @notice Native-ETH confidential wrapper implementing OpenZeppelin IERC7984 (ERC-7984)

 * @dev Extends OZ ERC7984 with MedVault-specific deposit, multi-phase withdraw, withdraw-to,

 *      public exit, balance lock, and KMS-gated transferEncrypted for StakingManager.

 *      1 unit = 1 micro-ETH (1e-6 ETH = 1e12 wei).

 */

contract ConfidentialETH7984 is ERC7984, ZamaEthereumConfig, EIP712 {

    uint256 public constant UNIT_SCALE = 1_000_000_000_000;

    uint256 public constant CANCEL_TIMEOUT_FUNDS = 1 hours;



    uint8 public constant EXIT_MODE_FAST = 0;

    uint8 public constant EXIT_MODE_PRIVATE_BATCH = 1;



    bytes32 private constant WITHDRAW_AUTH_TYPEHASH =

        keccak256(

            "WithdrawAuthorization(address owner,address stealthRecipient,bytes32 transferableHandle,uint8 exitMode,uint256 nonce,uint256 deadline)"

        );



    bytes32 private constant WITHDRAW_TO_TYPEHASH =

        keccak256(

            "WithdrawTo(address user,address destination,bytes32 amountCommitment,uint256 nonce,uint256 deadline)"

        );



    struct PendingWithdraw {

        euint64 amount;

        bytes32 transferableHandle;

        uint256 timestamp;

    }



    struct PendingWithdrawTo {

        euint64 amount;

        bytes32 transferableHandle;

        address destination;

        uint256 timestamp;

    }



    mapping(address => bool) public authorizedContracts;

    mapping(address => PendingWithdraw) private _pendingWithdraw;

    mapping(address => PendingWithdrawTo) private _pendingWithdrawTo;

    mapping(address => bool) private _isPending;

    mapping(address => bool) private _balanceLocked;

    mapping(address => uint256) public withdrawNonces;

    mapping(address => uint256) public withdrawToNonces;

    mapping(address => uint256) public pendingFailedWithdrawWei;

    address public owner;

    address public pendingOwner;



    uint256 public constant READER_CHANGE_DELAY = 6 hours;

    mapping(address => bool) public pendingContractAuth;

    mapping(address => uint256) public contractAuthChangeEta;



    /// @dev Cleartext mint for Hardhat unit tests only — disabled on all public networks.

    bool public testHelpersEnabled;

    bool public pendingTestHelpersValue;

    uint256 public testHelpersChangeEta;

    uint256 public constant TEST_HELPERS_CHANGE_DELAY = 6 hours;



    uint256 private constant _NOT_ENTERED = 1;

    uint256 private constant _ENTERED = 2;

    uint256 private _status;



    event Deposit(address indexed user);

    event Withdrawal(address indexed user);

    event WithdrawRequested(address indexed user, bytes32 transferableHandle);

    event WithdrawToRequested(address indexed user, bytes32 transferableHandle);

    event WithdrawCancelled(address indexed user);

    event WithdrawToCancelled(address indexed user);

    event EncryptedTransfer(address indexed from, address indexed to);

    event PublicExitCompleted(address indexed owner, uint8 exitMode);

    event InsufficientWithdrawNoop(address indexed user);

    event InsolventWithdrawalAttempted(address indexed user, uint256 requestedWei, uint256 availableWei);
    event FailedWithdrawEscrowed(address indexed recipient, uint256 amountWei);

    event TransferSufficiencyPrepared(address indexed from, bytes32 transferableHandle);

    event BalanceLocked(address indexed user);

    event BalanceUnlocked(address indexed user);

    event OwnershipProposed(address indexed proposedOwner);

    event OwnershipAccepted(address indexed newOwner);



    constructor()

        ERC7984("Confidential ETH", "cETH", "")

        EIP712("MedVault ConfidentialETH", "2")

    {

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



    modifier onlyAuthorizedContract() {

        require(authorizedContracts[msg.sender], "Not authorized contract");

        _;

    }



    modifier nonReentrant() {

        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        _status = _ENTERED;

        _;

        _status = _NOT_ENTERED;

    }



    modifier onlyTestHelpers() {

        TestHelpers.requireEnabled(testHelpersEnabled);

        _;

    }



    function authorizeContract(address) external onlyOwner {

        revert("Use scheduleContractAuth + applyContractAuth");

    }



    function deauthorizeContract(address) external onlyOwner {

        revert("Use scheduleContractAuth + applyContractAuth");

    }



    function scheduleContractAuth(address _contract, bool _authorize) external onlyOwner {

        require(_contract != address(0), "Zero address");

        pendingContractAuth[_contract] = _authorize;

        contractAuthChangeEta[_contract] = block.timestamp + READER_CHANGE_DELAY;

    }



    function applyContractAuth(address _contract) external onlyOwner {

        require(

            contractAuthChangeEta[_contract] != 0 && block.timestamp >= contractAuthChangeEta[_contract],

            "Timelock active"

        );

        authorizedContracts[_contract] = pendingContractAuth[_contract];

        contractAuthChangeEta[_contract] = 0;

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

        _creditBalance(user, units);



        emit Deposit(user);

    }



    function depositFor(address _recipient) external payable nonReentrant onlyAuthorized {

        require(msg.value > 0, "Amount must be > 0");

        require(msg.value >= UNIT_SCALE, "Min deposit is 1 micro-ETH");



        uint64 units = uint64(msg.value / UNIT_SCALE);

        _creditBalance(_recipient, units);

    }



    function requestWithdraw(

        externalEuint64 encryptedUnits,

        bytes calldata inputProof

    ) external nonReentrant {

        require(!_balanceLocked[msg.sender], "Balance locked");

        require(!_isPending[msg.sender], "Withdrawal already pending");



        euint64 units = FHE.fromExternal(encryptedUnits, inputProof);

        FHE.allowThis(units);



        euint64 bal = confidentialBalanceOf(msg.sender);

        require(FHE.isInitialized(bal), "No balance");



        euint64 transferable = FHE.select(FHE.ge(bal, units), units, FHE.asEuint64(0));

        FHE.makePubliclyDecryptable(transferable);
        FHE.allowThis(transferable);

        bytes32 transferableHandle = euint64.unwrap(transferable);



        _pendingWithdraw[msg.sender] = PendingWithdraw({

            amount: transferable,

            transferableHandle: transferableHandle,

            timestamp: block.timestamp

        });

        _isPending[msg.sender] = true;



        emit WithdrawRequested(msg.sender, transferableHandle);

    }



    function completeWithdraw(

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant {

        PendingWithdraw memory p = _pendingWithdraw[msg.sender];

        require(p.transferableHandle != bytes32(0), "Nothing pending");



        uint64 units = _decodePublicAmount(p.amount, transferableCleartexts, transferableProof);



        delete _pendingWithdraw[msg.sender];

        _isPending[msg.sender] = false;



        if (units == 0) {

            emit InsufficientWithdrawNoop(msg.sender);

            return;

        }



        _burnVerified(msg.sender, p.amount);



        uint256 weiAmount = uint256(units) * UNIT_SCALE;

        require(address(this).balance >= weiAmount, "Insolvent");

        (bool success, ) = msg.sender.call{value: weiAmount}("");

        if (!success) {

            pendingFailedWithdrawWei[msg.sender] = weiAmount;

            emit InsolventWithdrawalAttempted(msg.sender, weiAmount, address(this).balance);

            emit FailedWithdrawEscrowed(msg.sender, weiAmount);

            emit Withdrawal(msg.sender);

            return;

        }



        emit Withdrawal(msg.sender);

    }



    function claimFailedWithdraw() external nonReentrant {

        uint256 amount = pendingFailedWithdrawWei[msg.sender];

        require(amount > 0, "Nothing to claim");

        pendingFailedWithdrawWei[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");

        require(success, "Transfer failed");

    }



    function completePublicExit(

        address owner_,

        address stealthRecipient,

        uint8 exitMode,

        uint256 nonce,

        uint256 deadline,

        bytes calldata signature,

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant {

        require(block.timestamp <= deadline, "Authorization expired");

        require(stealthRecipient != address(0), "Zero recipient");

        require(exitMode == EXIT_MODE_FAST || exitMode == EXIT_MODE_PRIVATE_BATCH, "Invalid exit mode");

        require(nonce == withdrawNonces[owner_], "Invalid nonce");



        PendingWithdraw memory p = _pendingWithdraw[owner_];

        require(p.transferableHandle != bytes32(0), "Nothing pending");



        bytes32 structHash = keccak256(

            abi.encode(

                WITHDRAW_AUTH_TYPEHASH,

                owner_,

                stealthRecipient,

                p.transferableHandle,

                exitMode,

                nonce,

                deadline

            )

        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, signature);

        require(signer == owner_, "Invalid signature");



        uint64 units = _decodePublicAmount(p.amount, transferableCleartexts, transferableProof);



        delete _pendingWithdraw[owner_];

        _isPending[owner_] = false;



        if (units == 0) {

            withdrawNonces[owner_] = nonce + 1;

            emit InsufficientWithdrawNoop(owner_);

            return;

        }



        _burnVerified(owner_, p.amount);



        uint256 weiAmount = uint256(units) * UNIT_SCALE;

        require(address(this).balance >= weiAmount, "Insolvent");

        (bool success, ) = stealthRecipient.call{value: weiAmount}("");

        if (!success) {

            pendingFailedWithdrawWei[owner_] += weiAmount;

            emit InsolventWithdrawalAttempted(owner_, weiAmount, address(this).balance);

            emit FailedWithdrawEscrowed(owner_, weiAmount);

            emit PublicExitCompleted(owner_, exitMode);

            return;

        }



        withdrawNonces[owner_] = nonce + 1;

        emit PublicExitCompleted(owner_, exitMode);

    }



    function cancelPendingWithdraw() external {

        PendingWithdraw memory pw = _pendingWithdraw[msg.sender];

        if (pw.transferableHandle != bytes32(0)) {

            require(block.timestamp > pw.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");

            delete _pendingWithdraw[msg.sender];

            _isPending[msg.sender] = false;

            emit WithdrawCancelled(msg.sender);

            return;

        }



        PendingWithdrawTo memory pwt = _pendingWithdrawTo[msg.sender];

        require(pwt.transferableHandle != bytes32(0), "Nothing pending");

        require(block.timestamp > pwt.timestamp + CANCEL_TIMEOUT_FUNDS, "Timeout not elapsed");

        delete _pendingWithdrawTo[msg.sender];

        _isPending[msg.sender] = false;

        emit WithdrawToCancelled(msg.sender);

    }



    function requestWithdrawTo(

        address user,

        address destination,

        externalEuint64 encryptedUnits,

        bytes calldata inputProof,

        uint256 nonce,

        uint256 deadline,

        bytes calldata signature

    ) external onlyAuthorizedContract nonReentrant {

        require(destination != address(0), "Zero destination");

        require(!_balanceLocked[user], "Balance locked");

        require(!_isPending[user], "Withdrawal already pending");

        require(block.timestamp <= deadline, "Signature expired");

        require(nonce == withdrawToNonces[user], "Invalid nonce");



        bytes32 amountCommitment = keccak256(abi.encode(encryptedUnits, inputProof));

        bytes32 structHash = keccak256(

            abi.encode(WITHDRAW_TO_TYPEHASH, user, destination, amountCommitment, nonce, deadline)

        );

        bytes32 digest = _hashTypedDataV4(structHash);

        require(ECDSA.recover(digest, signature) == user, "Invalid withdraw-to signature");

        withdrawToNonces[user] = nonce + 1;



        euint64 units = FHE.fromExternal(encryptedUnits, inputProof);

        FHE.allowThis(units);



        euint64 bal = confidentialBalanceOf(user);

        require(FHE.isInitialized(bal), "No balance");



        euint64 transferable = FHE.select(FHE.ge(bal, units), units, FHE.asEuint64(0));

        FHE.makePubliclyDecryptable(transferable);
        FHE.allowThis(transferable);

        bytes32 transferableHandle = euint64.unwrap(transferable);



        _pendingWithdrawTo[user] = PendingWithdrawTo({

            amount: transferable,

            transferableHandle: transferableHandle,

            destination: destination,

            timestamp: block.timestamp

        });

        _isPending[user] = true;



        emit WithdrawToRequested(user, transferableHandle);

    }



    function completeWithdrawTo(

        address user,

        bytes calldata transferableCleartexts,

        bytes calldata transferableProof

    ) external nonReentrant onlyAuthorizedContract {

        PendingWithdrawTo memory p = _pendingWithdrawTo[user];

        require(p.transferableHandle != bytes32(0), "Nothing pending");



        address destination = p.destination;

        uint64 units = _decodePublicAmount(p.amount, transferableCleartexts, transferableProof);



        delete _pendingWithdrawTo[user];

        _isPending[user] = false;



        if (units == 0) {

            emit InsufficientWithdrawNoop(user);

            return;

        }



        uint256 weiAmount = uint256(units) * UNIT_SCALE;

        require(address(this).balance >= weiAmount, "Insolvent");



        _burnVerified(user, p.amount);



        (bool success, ) = destination.call{value: weiAmount}("");

        require(success, "Transfer failed");



        emit Withdrawal(user);

    }



    function pendingWithdrawHandle(address user) external view returns (bytes32) {

        return _pendingWithdraw[user].transferableHandle;

    }



    function pendingWithdrawToHandle(address user) external view returns (bytes32) {

        return _pendingWithdrawTo[user].transferableHandle;

    }



    function _requireTransferUnlocked(address from) private view {

        require(!_balanceLocked[from], "Balance locked");

        require(!_isPending[from], "Pending withdraw blocks transfer");

    }



    function setOperator(address operator, uint48 until) public override {

        require(!_isPending[msg.sender], "Pending withdraw blocks operator set");

        super.setOperator(operator, until);

    }



    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) public override returns (euint64) {
        _requireTransferUnlocked(msg.sender);
        return super.confidentialTransfer(to, encryptedAmount, inputProof);
    }



    function confidentialTransfer(address to, euint64 amount) public override returns (euint64) {
        _requireTransferUnlocked(msg.sender);
        return super.confidentialTransfer(to, amount);
    }



    function confidentialTransferAndCall(
        address to,
        euint64 amount,
        bytes calldata data
    ) public override returns (euint64) {
        _requireTransferUnlocked(msg.sender);
        return super.confidentialTransferAndCall(to, amount, data);
    }



    function confidentialTransferAndCall(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) public override returns (euint64) {
        _requireTransferUnlocked(msg.sender);
        return super.confidentialTransferAndCall(to, encryptedAmount, inputProof, data);
    }



    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) public override returns (euint64) {
        _requireTransferUnlocked(from);
        return super.confidentialTransferFrom(from, to, encryptedAmount, inputProof);
    }



    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) public override returns (euint64) {
        _requireTransferUnlocked(from);
        return super.confidentialTransferFrom(from, to, amount);
    }



    function confidentialTransferFromAndCall(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) public override returns (euint64) {
        _requireTransferUnlocked(from);
        return super.confidentialTransferFromAndCall(from, to, encryptedAmount, inputProof, data);
    }



    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata data
    ) public override returns (euint64) {
        _requireTransferUnlocked(from);
        return super.confidentialTransferFromAndCall(from, to, amount, data);
    }



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



    function previewTransferSufficiency(address from, euint64 amount) external onlyAuthorized returns (bytes32) {

        require(!_isPending[from], "Pending withdraw blocks transfer");

        require(FHE.isInitialized(confidentialBalanceOf(from)), "No balance");

        euint64 transferable = FHE.select(FHE.ge(confidentialBalanceOf(from), amount), amount, FHE.asEuint64(0));

        transferable = FHE.makePubliclyDecryptable(transferable);
        FHE.allowThis(transferable);

        bytes32 transferableHandle = euint64.unwrap(transferable);

        emit TransferSufficiencyPrepared(from, transferableHandle);

        return transferableHandle;

    }



    function transferEncrypted(

        address from,

        address to,

        euint64 amount

    ) external onlyAuthorizedContract nonReentrant {

        require(
            from == msg.sender,
            "Bad from"
        );

        require(!_isPending[from], "Pending withdraw blocks transfer");

        require(FHE.isInitialized(confidentialBalanceOf(from)), "No balance");



        euint64 transferable = FHE.select(FHE.ge(confidentialBalanceOf(from), amount), amount, FHE.asEuint64(0));

        _transfer(from, to, transferable);

        emit EncryptedTransfer(from, to);

    }



    function getBalanceForAuthorized(address user) external returns (euint64) {

        require(authorizedContracts[msg.sender], "Not authorized");

        euint64 bal = confidentialBalanceOf(user);

        if (FHE.isInitialized(bal)) {

            FHE.allowThis(bal);

            FHE.allow(bal, msg.sender);

        }

        return bal;

    }



    /// @dev Backward-compatible alias for pre-ERC7984 integrations.

    function getBalance(address user) external view returns (euint64) {

        require(msg.sender == user || authorizedContracts[msg.sender], "Not authorized");

        return confidentialBalanceOf(user);

    }



    function _burnVerified(address account, euint64 encryptedAmount) internal {
        euint64 bal = confidentialBalanceOf(account);
        FHE.allowThis(bal);
        FHE.allowThis(encryptedAmount);
        _burn(account, encryptedAmount);
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

        _mint(user, FHE.asEuint64(units));

    }



    function scheduleTestHelpersEnabled(bool enabled) external onlyOwner {

        pendingTestHelpersValue = enabled;

        testHelpersChangeEta = block.timestamp + TEST_HELPERS_CHANGE_DELAY;

    }



    function applyTestHelpersEnabled() external onlyOwner {

        require(

            testHelpersChangeEta != 0 && block.timestamp >= testHelpersChangeEta,

            "Timelock active"

        );

        testHelpersEnabled = pendingTestHelpersValue;

        testHelpersChangeEta = 0;

    }



    /**

     * @notice Seed confidential balance without client-side FHE proofs (Hardhat mock only).

     * @dev Gated by testHelpersEnabled AND block.chainid == 31337.

     */

    function mintClear(address to, uint256 amount) external onlyTestHelpers {

        require(to != address(0), "Zero address");

        require(amount > 0 && amount <= type(uint64).max, "Invalid amount");

        _creditBalance(to, uint64(amount));

    }



    receive() external payable nonReentrant {

        _deposit(msg.sender, msg.value);

    }

}


