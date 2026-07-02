// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// @notice Generic timelock schedule/apply for trusted-address changes in SponsorIncentiveVault.
library VaultTimelockLib {
    error ZeroAddress();

    function schedule(
        mapping(bytes32 => address) storage pending,
        mapping(bytes32 => uint256) storage eta,
        bytes32 role,
        address addr,
        uint256 delay
    ) public {
        if (!(addr != address(0))) revert ZeroAddress();
        pending[role] = addr;
        eta[role] = block.timestamp + delay;
    }

    function applyPending(
        mapping(bytes32 => address) storage pending,
        mapping(bytes32 => uint256) storage eta,
        bytes32 role
    ) public returns (address newAddr) {
        require(eta[role] != 0 && block.timestamp >= eta[role], "Timelock active");
        newAddr = pending[role];
        eta[role] = 0;
        pending[role] = address(0);
    }
}
