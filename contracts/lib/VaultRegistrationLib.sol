// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./VaultStorage.sol";
import {IVaultTrialManager, IVaultEligibilityEngine, IVaultDataAccessLog} from "./VaultInterfaces.sol";

/// @notice Anonymous participant registration helpers for SponsorIncentiveVault.
library VaultRegistrationLib {
    error AlreadyRegistered();
    error AppNotAccepted();
    error AuthAlreadyUsed();
    error InvalidRegisterSignature();
    error NoIncentivePool();
    error NoPermitHolderFound();
    error NullifierAlreadyUsedForRegistration();
    error OnlyPermitHolderCanRegister();
    error PermitHolderMismatch();
    error PoolAtCapacity();
    error ScreeningAlreadyFinalized();
    error SignatureExpired();
    error TrialAlreadyEnded();
    error TrialNotActive();

    event AnonymousParticipantRegistered(uint256 indexed trialId, uint256 indexed nullifier);

    function requireTrialOpenForRegistration(
        IVaultTrialManager trialManager,
        VaultStorage.IncentivePool storage pool,
        uint256 trialId,
        uint256 maxParticipants
    ) public view {
        IVaultTrialManager.Trial memory trial = trialManager.getTrial(trialId);
        if (!(trial.active)) revert TrialNotActive();

        if (
            pool.screeningDistributed &&
            pool.challengeOpen &&
            block.timestamp > pool.challengeDeadline &&
            pool.participants.length < maxParticipants
        ) {
            return;
        }

        if (!(trial.endTime > block.timestamp)) revert TrialAlreadyEnded();
    }

    function registerParticipant(
        IVaultEligibilityEngine eligibilityEngine,
        IVaultDataAccessLog dataAccessLog,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage nullifierUsedForRegistration,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        uint256 nullifier,
        address patient,
        uint256 maxParticipants
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (pool.isRegistered[patient]) revert AlreadyRegistered();
        if (!(pool.participants.length < maxParticipants)) revert PoolAtCapacity();
        if (nullifierUsedForRegistration[trialId][nullifier]) revert NullifierAlreadyUsedForRegistration();

        IVaultEligibilityEngine.ApplicationStatus status =
            eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId);
        if (!(status == IVaultEligibilityEngine.ApplicationStatus.Accepted)) revert AppNotAccepted();

        nullifierUsedForRegistration[trialId][nullifier] = true;

        if (pool.participants.length == 0) {
            pool.fundingLocked = true;
        }

        pool.participants.push(patient);
        pool.isRegistered[patient] = true;
        pool.participantIndex[patient] = pool.participants.length;
        participantNullifier[trialId][patient] = nullifier;

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                IVaultDataAccessLog.ActionType.PARTICIPANT_JOINED_POOL,
                trialId,
                keccak256(abi.encodePacked(patient, block.timestamp))
            );
        }
        emit AnonymousParticipantRegistered(trialId, nullifier);
    }

    function registerAnonymousParticipant(
        IVaultTrialManager trialManager,
        IVaultEligibilityEngine eligibilityEngine,
        IVaultDataAccessLog dataAccessLog,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage nullifierUsedForRegistration,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        uint256 trialId,
        uint256 nullifier,
        uint256 maxParticipants
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (!(pool.totalDepositedWei > 0)) revert NoIncentivePool();
        if (pool.screeningDistributed && block.timestamp <= pool.challengeDeadline) {
            revert ScreeningAlreadyFinalized();
        }
        requireTrialOpenForRegistration(trialManager, pool, trialId, maxParticipants);

        address patient = eligibilityEngine.getDecryptPermitHolder(nullifier, trialId);
        if (!(patient != address(0))) revert NoPermitHolderFound();
        if (!(msg.sender == patient)) revert OnlyPermitHolderCanRegister();

        registerParticipant(
            eligibilityEngine,
            dataAccessLog,
            pools,
            nullifierUsedForRegistration,
            participantNullifier,
            trialId,
            nullifier,
            patient,
            maxParticipants
        );
    }

    function registerAnonymousParticipantFor(
        IVaultTrialManager trialManager,
        IVaultEligibilityEngine eligibilityEngine,
        IVaultDataAccessLog dataAccessLog,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage nullifierUsedForRegistration,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        mapping(bytes32 => bool) storage claimAuthUsed,
        bytes32 registerAuthTypehash,
        bytes32 domainSeparator,
        uint256 trialId,
        uint256 nullifier,
        address permitHolder,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        uint256 maxParticipants
    ) public {
        VaultStorage.IncentivePool storage pool = pools[trialId];
        if (!(pool.totalDepositedWei > 0)) revert NoIncentivePool();
        if (pool.screeningDistributed && block.timestamp <= pool.challengeDeadline) {
            revert ScreeningAlreadyFinalized();
        }
        requireTrialOpenForRegistration(trialManager, pool, trialId, maxParticipants);

        address patient = eligibilityEngine.getDecryptPermitHolder(nullifier, trialId);
        if (!(patient != address(0))) revert NoPermitHolderFound();
        if (!(permitHolder == patient)) revert PermitHolderMismatch();
        if (!(block.timestamp <= deadline)) revert SignatureExpired();

        bytes32 authKey = keccak256(abi.encode(permitHolder, trialId, nullifier, nonce));
        if (claimAuthUsed[authKey]) revert AuthAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(registerAuthTypehash, trialId, nullifier, permitHolder, nonce, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ECDSA.recover(digest, signature);
        if (!(signer == permitHolder)) revert InvalidRegisterSignature();

        claimAuthUsed[authKey] = true;
        registerParticipant(
            eligibilityEngine,
            dataAccessLog,
            pools,
            nullifierUsedForRegistration,
            participantNullifier,
            trialId,
            nullifier,
            patient,
            maxParticipants
        );
    }
}
