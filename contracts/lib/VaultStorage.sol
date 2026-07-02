// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @notice Shared pool layout for SponsorIncentiveVault and VaultDistributionLib.
library VaultStorage {
    struct IncentivePool {
        uint256 totalDepositedWei;
        uint256 totalDistributedWei;
        /// @notice Wei actually delivered via confirmReceipt (sound reclaim denominator).
        uint256 confirmedDistributedWei;
        euint64 encryptedPoolSize;
        address[] participants;
        bool screeningDistributed;
        bool fundingLocked;
        /// @notice Liveness challenge for confirmReceipt after entitlement staging.
        uint256 challengeDeadline;
        bool challengeOpen;
        mapping(address => bool) isRegistered;
        /// @notice 1-based index into participants for O(1) swap-and-pop prune.
        mapping(address => uint256) participantIndex;
    }
}
