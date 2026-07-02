// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "./VaultStorage.sol";
import "./VaultDistributionLib.sol";
import {
    IVaultTrialManager,
    IVaultMilestoneManager,
    IVaultSponsorRegistry
} from "./VaultInterfaces.sol";

/// @notice Reclaim scheduling and payout helpers for SponsorIncentiveVault.
library VaultReclaimLib {
    error AlreadyReclaimed();
    error ChallengeStillActive();
    error MilestonesNotFullyDistributed();
    error NotReclaimRecipient();
    error NothingToClaim();
    error NothingToReclaim();
    error SponsorNoLongerVerified();
    error SponsorStillVerified();
    error TrialNotYetEnded();
    error ParticipantClaimWindowOpen();

    event ReclaimScheduled(uint256 indexed trialId, address indexed recipient, uint256 amount);
    event ReclaimClaimed(uint256 indexed trialId, address indexed recipient, uint256 amount);
    event ReclaimReroutedToOwner(uint256 indexed trialId, address indexed owner);
    event AbandonedReclaimWindowOpened(uint256 indexed trialId, uint256 openedAt);

    function hasAnyStagedUnconfirmed(
        IVaultMilestoneManager milestoneManager,
        VaultStorage.IncentivePool storage pool,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        uint256 trialId
    ) public view returns (bool) {
        uint256 pCount = pool.participants.length;
        if (address(milestoneManager) == address(0)) {
            for (uint256 i = 0; i < pCount; i++) {
                address p = pool.participants[i];
                if (entitlementStaged[trialId][p][0] && !confirmedPayout[trialId][p][0]) {
                    return true;
                }
            }
            return false;
        }
        IVaultMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(trialId);
        uint256 milestoneCount = milestones.length == 0 ? 1 : milestones.length;
        for (uint256 m = 0; m < milestoneCount; m++) {
            for (uint256 i = 0; i < pCount; i++) {
                address p = pool.participants[i];
                if (entitlementStaged[trialId][p][m] && !confirmedPayout[trialId][p][m]) {
                    return true;
                }
            }
        }
        return false;
    }

    function hasEligibleUnconfirmed(
        IVaultMilestoneManager milestoneManager,
        VaultStorage.IncentivePool storage pool,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        uint256 trialId,
        uint256 milestoneIndex
    ) public view returns (bool) {
        uint256 pCount = pool.participants.length;
        for (uint256 i = 0; i < pCount; i++) {
            address p = pool.participants[i];
            if (
                VaultDistributionLib.isParticipantEligible(milestoneManager, trialId, p, milestoneIndex) &&
                !confirmedPayout[trialId][p][milestoneIndex]
            ) {
                return true;
            }
        }
        return false;
    }

    function allMilestonesDistributed(
        IVaultMilestoneManager milestoneManager,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage milestoneDistributed,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        uint256 trialId
    ) public view returns (bool) {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (address(milestoneManager) == address(0)) {
            return pool.screeningDistributed;
        }
        IVaultMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(trialId);
        if (milestones.length == 0) {
            return pool.screeningDistributed;
        }
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneDistributed[trialId][i]) {
                continue;
            }
            if (
                VaultDistributionLib.hasEligibleUnpaid(
                    milestoneManager,
                    pool,
                    entitlementStaged,
                    trialId,
                    i
                )
            ) {
                return false;
            }
            if (hasEligibleUnconfirmed(milestoneManager, pool, confirmedPayout, trialId, i)) {
                return false;
            }
        }
        return true;
    }

    function requireReclaimTimingAndChallenge(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        uint256 trialId,
        IVaultTrialManager.Trial memory trial,
        uint256 reclaimGracePeriod
    ) public view {
        if (!(block.timestamp >= trial.endTime)) revert TrialNotYetEnded();
        bool noParticipants = pools[trialId].participants.length == 0;
        require(
            noParticipants || block.timestamp >= trial.endTime + reclaimGracePeriod,
            "Grace period not elapsed"
        );
        if (reclaimFinalized[trialId]) revert AlreadyReclaimed();
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (pool.challengeOpen && block.timestamp <= pool.challengeDeadline) {
            revert ChallengeStillActive();
        }
    }

    function requireReclaimReady(
        IVaultMilestoneManager milestoneManager,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        mapping(uint256 => mapping(uint256 => bool)) storage milestoneDistributed,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        uint256 trialId,
        IVaultTrialManager.Trial memory trial,
        uint256 reclaimGracePeriod
    ) public view {
        requireReclaimTimingAndChallenge(pools, reclaimFinalized, trialId, trial, reclaimGracePeriod);
        bool noParticipants = pools[trialId].participants.length == 0;
        require(
            pools[trialId].screeningDistributed || noParticipants,
            "Screening not yet distributed"
        );
        if (
            !(allMilestonesDistributed(
                milestoneManager,
                pools,
                milestoneDistributed,
                entitlementStaged,
                confirmedPayout,
                trialId
            ) || noParticipants)
        ) {
            revert MilestonesNotFullyDistributed();
        }
    }

    function requireAbandonedReclaimReady(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        uint256 trialId,
        IVaultTrialManager.Trial memory trial,
        uint256 reclaimGracePeriod
    ) public view {
        requireReclaimTimingAndChallenge(pools, reclaimFinalized, trialId, trial, reclaimGracePeriod);
    }

    function scheduleReclaim(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        mapping(uint256 => uint256) storage pendingReclaimWei,
        mapping(uint256 => address) storage pendingReclaimRecipient,
        uint256 trialId,
        address recipient
    ) public returns (uint256 remaining) {
        remaining = pools[trialId].totalDepositedWei - pools[trialId].confirmedDistributedWei;
        uint256 balanceRemaining = address(this).balance;
        if (remaining > balanceRemaining) {
            remaining = balanceRemaining;
        }
        if (!(remaining > 0)) revert NothingToReclaim();
        reclaimFinalized[trialId] = true;
        pendingReclaimWei[trialId] = remaining;
        pendingReclaimRecipient[trialId] = recipient;
        emit ReclaimScheduled(trialId, recipient, remaining);
    }

    function requireSponsorStillVerified(IVaultSponsorRegistry sponsorRegistry, address sponsor) public view {
        if (address(sponsorRegistry) != address(0)) {
            if (!sponsorRegistry.isVerifiedSponsor(sponsor)) revert SponsorNoLongerVerified();
        }
    }

    function reclaimUndistributed(
        IVaultTrialManager trialManager,
        IVaultMilestoneManager milestoneManager,
        IVaultSponsorRegistry sponsorRegistry,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        mapping(uint256 => mapping(uint256 => bool)) storage milestoneDistributed,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        mapping(uint256 => uint256) storage pendingReclaimWei,
        mapping(uint256 => address) storage pendingReclaimRecipient,
        uint256 trialId,
        address owner,
        uint256 reclaimGracePeriod
    ) public {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(trialId);
        require(msg.sender == owner || msg.sender == trial.sponsor, "Not authorized");
        requireSponsorStillVerified(sponsorRegistry, trial.sponsor);
        requireReclaimReady(
            milestoneManager,
            pools,
            reclaimFinalized,
            milestoneDistributed,
            entitlementStaged,
            confirmedPayout,
            trialId,
            trial,
            reclaimGracePeriod
        );
        scheduleReclaim(
            pools,
            reclaimFinalized,
            pendingReclaimWei,
            pendingReclaimRecipient,
            trialId,
            trial.sponsor
        );
    }

    function claimReclaimed(
        IVaultTrialManager trialManager,
        IVaultSponsorRegistry sponsorRegistry,
        mapping(uint256 => uint256) storage pendingReclaimWei,
        mapping(uint256 => address) storage pendingReclaimRecipient,
        uint256 trialId,
        address owner
    ) public {
        uint256 amount = pendingReclaimWei[trialId];
        if (!(amount > 0)) revert NothingToClaim();
        address recipient = pendingReclaimRecipient[trialId];

        IVaultTrialManager.Trial memory trial = trialManager.getTrial(trialId);
        if (recipient == trial.sponsor) {
            if (address(sponsorRegistry) != address(0) && !sponsorRegistry.isVerifiedSponsor(recipient)) {
                pendingReclaimRecipient[trialId] = owner;
                emit ReclaimReroutedToOwner(trialId, owner);
                return;
            }
            requireSponsorStillVerified(sponsorRegistry, recipient);
        }

        if (!(msg.sender == recipient)) revert NotReclaimRecipient();
        pendingReclaimWei[trialId] = 0;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            pendingReclaimWei[trialId] = amount;
            pendingReclaimRecipient[trialId] = owner;
            emit ReclaimReroutedToOwner(trialId, owner);
            return;
        }
        emit ReclaimClaimed(trialId, recipient, amount);
    }

    function reclaimAbandonedToOwner(
        IVaultTrialManager trialManager,
        IVaultMilestoneManager milestoneManager,
        IVaultSponsorRegistry sponsorRegistry,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        mapping(uint256 => uint256) storage abandonedReclaimOpenedAt,
        mapping(uint256 => uint256) storage pendingReclaimWei,
        mapping(uint256 => address) storage pendingReclaimRecipient,
        uint256 trialId,
        address owner,
        uint256 reclaimGracePeriod,
        uint256 participantClaimWindow
    ) public {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(trialId);
        if (address(sponsorRegistry) != address(0)) {
            if (sponsorRegistry.isVerifiedSponsor(trial.sponsor)) revert SponsorStillVerified();
        }
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (hasAnyStagedUnconfirmed(milestoneManager, pool, entitlementStaged, confirmedPayout, trialId)) {
            if (abandonedReclaimOpenedAt[trialId] == 0) {
                abandonedReclaimOpenedAt[trialId] = block.timestamp;
                emit AbandonedReclaimWindowOpened(trialId, block.timestamp);
                return;
            }
            if (block.timestamp < abandonedReclaimOpenedAt[trialId] + participantClaimWindow) {
                revert ParticipantClaimWindowOpen();
            }
        }
        requireAbandonedReclaimReady(pools, reclaimFinalized, trialId, trial, reclaimGracePeriod);
        scheduleReclaim(
            pools,
            reclaimFinalized,
            pendingReclaimWei,
            pendingReclaimRecipient,
            trialId,
            owner
        );
    }
}
