// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ebool} from "@fhevm/solidity/lib/FHE.sol";

interface IVaultTrialManager {
    struct Trial {
        string name;
        string phase;
        string location;
        string compensation;
        address sponsor;
        bool active;
        uint8 minAge;
        uint8 maxAge;
        bool requiresDiabetes;
        uint16 minHb;
        uint8 genderRequirement;
        uint8 minHeight;
        uint16 maxWeight;
        bool requiresNonSmoker;
        bool requiresNormalBP;
        uint256 endTime;
        bool encryptedCriteria;
    }

    function getTrial(uint256 trialId) external view returns (Trial memory);
}

interface IVaultMilestoneManager {
    struct Milestone {
        string name;
        uint16 weightBps;
        uint256 deadline;
    }

    function getMilestones(uint256 trialId) external view returns (Milestone[] memory);
    function getParticipantProgress(uint256 trialId, address participant) external view returns (uint256);
    function setMilestonesFromVault(
        uint256 trialId,
        address sponsor,
        string[] calldata names,
        uint16[] calldata weights,
        uint256[] calldata deadlines
    ) external;
}

interface IVaultEligibilityEngine {
    enum ApplicationStatus {
        None,
        Pending,
        Accepted,
        Rejected
    }

    function getAnonymousApplicationStatus(uint256 nullifier, uint256 trialId)
        external
        view
        returns (ApplicationStatus);

    function getAnonymousResultForVault(uint256 nullifier, uint256 trialId) external returns (ebool);

    function getDecryptPermitHolder(uint256 nullifier, uint256 trialId) external view returns (address);
}

interface IVaultDataAccessLog {
    enum ActionType {
        PROFILE_SUBMISSION,
        CONSENT_GRANTED,
        ELIGIBILITY_CHECKED,
        APPLICATION_STATUS_CHANGED,
        MILESTONE_COMPLETED,
        REWARDS_DISTRIBUTED,
        PARTICIPANT_JOINED_POOL,
        DOCUMENT_RECORDED,
        DOCUMENT_SPONSOR_AUTHORIZED,
        DOCUMENT_ACCESS_REVOKED
    }

    function logAction(ActionType action, uint256 trialId, bytes32 detailHash) external;
}

/// @notice Batch distribution callbacks — external wrappers so VaultDistributionLib can try/catch per participant.
interface IVaultBatchCredit {
    function creditParticipantRewardForBatch(
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        uint256 amountWei
    ) external returns (uint256 creditedWei);

    function emitParticipantCreditFailed(
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        bytes calldata reason
    ) external;
}

/// @notice M-3: verify trial sponsor is still active at sensitive vault actions.
interface IVaultSponsorRegistry {
    function isVerifiedSponsor(address sponsor) external view returns (bool);
}
