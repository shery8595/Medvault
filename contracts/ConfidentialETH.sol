// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "./ConfidentialETH7984.sol";

/**
 * @title ConfidentialETH
 * @notice Backward-compatible alias for {ConfidentialETH7984} (IERC7984 / ERC-7984).
 * @dev New deployments should reference ConfidentialETH7984 directly.
 */
contract ConfidentialETH is ConfidentialETH7984 {}
