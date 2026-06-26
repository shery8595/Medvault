// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// @dev TEST ONLY — reverts on ETH receive to simulate adversarial participant contracts.
contract RewardReverter {
    receive() external payable {
        revert("Reject ETH");
    }
}
