// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import "../ConfidentialETH.sol";
import "./VaultStorage.sol";
import "./VaultDistributionLib.sol";
import {IVaultTrialManager, IVaultEligibilityEngine} from "./VaultInterfaces.sol";

/// @notice Challenge-window entitlement confirmation and slot pruning for SponsorIncentiveVault.
library VaultChallengeLib {
    error ChallengeClosed();
    error ChallengeNotOpen();
    error ChallengeStillActive();
    error EntitlementNotStaged();
    error InsufficientETHInVault();
    error NotAuthorized();
    error NotEligibleProof();
    error NotRegisteredSlot();
    error SlotAlreadyConfirmed();

    event SlotConfirmed(
        uint256 indexed trialId,
        uint256 indexed milestoneIndex,
        address indexed participant,
        uint256 amountWei
    );
    event SlotPruned(uint256 indexed trialId, uint256 indexed milestoneIndex, address indexed participant);

    function openChallengeWindow(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        uint256 trialId,
        uint256 challengeWindow
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        pool.challengeOpen = true;
        pool.challengeDeadline = block.timestamp + challengeWindow;
    }

    function prepareEntitlementProof(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,
        uint256 trialId,
        uint256 milestoneIndex
    ) public returns (bytes32) {
        if (!pools[trialId].isRegistered[msg.sender]) revert NotRegisteredSlot();
        if (!entitlementStaged[trialId][msg.sender][milestoneIndex]) revert EntitlementNotStaged();
        if (confirmedPayout[trialId][msg.sender][milestoneIndex]) revert SlotAlreadyConfirmed();
        if (!pools[trialId].challengeOpen) revert ChallengeNotOpen();
        if (!(block.timestamp <= pools[trialId].challengeDeadline)) revert ChallengeClosed();

        ebool entitlement = participantMilestonePaidEnc[trialId][msg.sender][milestoneIndex];
        FHE.allowThis(entitlement);
        entitlement = FHE.makePubliclyDecryptable(entitlement);
        participantMilestonePaidEnc[trialId][msg.sender][milestoneIndex] = entitlement;
        return ebool.unwrap(entitlement);
    }

    function confirmReceipt(
        ConfidentialETH cETH,
        IVaultEligibilityEngine eligibilityEngine,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage participantMilestonePaid,
        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,
        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,
        mapping(uint256 => mapping(uint256 => uint256)) storage milestoneDistributedWei,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        uint256 milestoneIndex,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (!pool.isRegistered[msg.sender]) revert NotRegisteredSlot();
        if (!entitlementStaged[trialId][msg.sender][milestoneIndex]) revert EntitlementNotStaged();
        if (confirmedPayout[trialId][msg.sender][milestoneIndex]) revert SlotAlreadyConfirmed();
        if (!pool.challengeOpen) revert ChallengeNotOpen();
        if (!(block.timestamp <= pool.challengeDeadline)) revert ChallengeClosed();

        ebool entitlement = participantMilestonePaidEnc[trialId][msg.sender][milestoneIndex];
        verifyEntitlementProof(entitlement, cleartexts, decryptionProof);

        uint256 shareWei = stagedShareWei[trialId][msg.sender][milestoneIndex];
        uint256 delivered = deliverConfirmedReward(
            cETH,
            eligibilityEngine,
            participantNullifier,
            trialId,
            milestoneIndex,
            msg.sender,
            shareWei
        );

        confirmedPayout[trialId][msg.sender][milestoneIndex] = true;
        participantMilestonePaid[trialId][msg.sender][milestoneIndex] = true;
        pool.confirmedDistributedWei += delivered;
        pools[trialId].totalDistributedWei += delivered;
        milestoneDistributedWei[trialId][milestoneIndex] += delivered;

        emit SlotConfirmed(trialId, milestoneIndex, msg.sender, delivered);
    }

    function pruneUnconfirmedSlots(
        IVaultTrialManager trialManager,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage confirmedPayout,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,
        mapping(uint256 => mapping(uint256 => bool)) storage nullifierUsedForRegistration,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        uint256 milestoneIndex,
        address owner,
        address automationContract
    ) public {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(trialId);
        if (!(msg.sender == owner || msg.sender == automationContract || msg.sender == trial.sponsor)) {
            revert NotAuthorized();
        }

        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (!pool.challengeOpen) revert ChallengeNotOpen();
        if (block.timestamp <= pool.challengeDeadline) revert ChallengeStillActive();

        uint256 len = pool.participants.length;
        for (uint256 i = len; i > 0; i--) {
            address participant = pool.participants[i - 1];
            if (!confirmedPayout[trialId][participant][milestoneIndex]) {
                if (milestoneIndex == 0) {
                    pruneParticipantSlot(
                        pools,
                        nullifierUsedForRegistration,
                        participantNullifier,
                        trialId,
                        participant
                    );
                } else {
                    entitlementStaged[trialId][participant][milestoneIndex] = false;
                    stagedShareWei[trialId][participant][milestoneIndex] = 0;
                }
                emit SlotPruned(trialId, milestoneIndex, participant);
            }
        }
    }

    function verifyEntitlementProof(
        ebool entitlement,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) public {
        FHE.allowThis(entitlement);
        bytes32 handle = ebool.unwrap(entitlement);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        FHE.checkSignatures(handles, cleartexts, decryptionProof);
        if (!abi.decode(cleartexts, (bool))) revert NotEligibleProof();
    }

    function deliverConfirmedReward(
        ConfidentialETH cETH,
        IVaultEligibilityEngine eligibilityEngine,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        uint256 shareWei
    ) public returns (uint256 deliveredWei) {
        milestoneIndex;
        if (!(shareWei > 0)) return 0;
        if (!(shareWei / cETH.UNIT_SCALE() > 0)) return 0;

        uint256 nullifier = participantNullifier[trialId][participant];
        ebool eligible = eligibilityEngine.getAnonymousResultForVault(nullifier, trialId);
        uint64 rewardUnits = uint64(shareWei / cETH.UNIT_SCALE());
        euint64 gated = VaultDistributionLib.gatedRewardUnits(eligible, rewardUnits);

        if (!(address(this).balance >= shareWei)) revert InsufficientETHInVault();
        cETH.deposit{value: shareWei}();
        FHE.allow(gated, address(cETH));
        cETH.confidentialTransfer(participant, gated);
        return shareWei;
    }

    function pruneParticipantSlot(
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage nullifierUsedForRegistration,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        address participant
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        uint256 idx = pool.participantIndex[participant];
        if (!(idx > 0)) return;

        uint256 lastIdx = pool.participants.length;
        address lastParticipant = pool.participants[lastIdx - 1];

        pool.participants[idx - 1] = lastParticipant;
        pool.participantIndex[lastParticipant] = idx;
        pool.participants.pop();

        pool.isRegistered[participant] = false;
        pool.participantIndex[participant] = 0;

        uint256 nullifier = participantNullifier[trialId][participant];
        if (nullifier != 0) {
            nullifierUsedForRegistration[trialId][nullifier] = false;
        }
        delete participantNullifier[trialId][participant];
    }
}
