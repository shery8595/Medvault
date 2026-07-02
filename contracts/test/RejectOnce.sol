// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// @dev TEST ONLY — rejects ETH until `allowReceive()` is called (withdraw escrow recovery tests).
contract RejectOnce {
    bool private _accept;

    function allowReceive() external {
        _accept = true;
    }

    receive() external payable {
        require(_accept, "Reject ETH");
    }
}
