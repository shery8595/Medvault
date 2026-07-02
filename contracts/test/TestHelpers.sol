// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/**
 * @title TestHelpers
 * @notice Shared gate for cleartext fhEVM test helpers — Hardhat chainId only.
 */
library TestHelpers {
    uint256 internal constant HARDHAT_CHAIN_ID = 31337;

    error TestHelpersDisabled();

    function requireEnabled(bool enabled) internal view {
        if (!enabled || block.chainid != HARDHAT_CHAIN_ID) {
            revert TestHelpersDisabled();
        }
    }
}
