// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.27;



import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

import "../ConfidentialETH.sol";

import "./VaultStorage.sol";

import {IVaultBatchCredit, IVaultMilestoneManager, IVaultEligibilityEngine} from "./VaultInterfaces.sol";



/// @notice FHE distribution helpers — linked library to keep SponsorIncentiveVault under EIP-170.

library VaultDistributionLib {

    function gatedRewardUnits(ebool _eligible, uint64 _rewardUnits) public returns (euint64 gated) {

        euint64 reward = FHE.asEuint64(_rewardUnits);

        FHE.allowThis(_eligible);

        gated = FHE.select(_eligible, reward, FHE.asEuint64(0));

        FHE.allowThis(gated);

    }



    function encryptedPaid(

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        uint256 _trialId,

        address _participant,

        uint256 _milestoneIndex

    ) public returns (ebool) {

        ebool paid = participantMilestonePaidEnc[_trialId][_participant][_milestoneIndex];

        if (!FHE.isInitialized(paid)) {

            paid = FHE.asEbool(false);

            participantMilestonePaidEnc[_trialId][_participant][_milestoneIndex] = paid;

        }

        return paid;

    }



    function creditScreeningRewardEncrypted(

        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        IVaultEligibilityEngine eligibilityEngine,

        ConfidentialETH cETH,

        uint256 _trialId,

        address _participant,

        uint64 _rewardUnits

    ) public returns (uint256 creditedWei) {

        uint256 nullifier = participantNullifier[_trialId][_participant];

        require(nullifier != 0, "Missing participant nullifier");



        if (entitlementStaged[_trialId][_participant][0]) {

            return 0;

        }

        if (

            eligibilityEngine.getAnonymousApplicationStatus(nullifier, _trialId) !=

            IVaultEligibilityEngine.ApplicationStatus.Accepted

        ) {

            return 0;

        }



        ebool eligible = eligibilityEngine.getAnonymousResultForVault(nullifier, _trialId);



        ebool alreadyPaid = encryptedPaid(

            participantMilestonePaidEnc,

            _trialId,

            _participant,

            0

        );

        participantMilestonePaidEnc[_trialId][_participant][0] = FHE.or(alreadyPaid, eligible);
        ebool staged = participantMilestonePaidEnc[_trialId][_participant][0];
        FHE.allowThis(staged);
        FHE.allow(staged, _participant);



        uint256 unitScale = cETH.UNIT_SCALE();

        creditedWei = uint256(_rewardUnits) * unitScale;

        stagedShareWei[_trialId][_participant][0] = creditedWei;

        entitlementStaged[_trialId][_participant][0] = true;



        return 0;

    }



    function creditMilestoneRewardEncrypted(

        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        IVaultEligibilityEngine eligibilityEngine,

        uint256 _trialId,

        address _participant,

        uint256 _milestoneIndex,

        uint64 _rewardUnits,

        uint256 _creditedWei

    ) public returns (uint256 creditedWei) {

        uint256 nullifier = participantNullifier[_trialId][_participant];

        require(nullifier != 0, "Missing participant nullifier");



        if (entitlementStaged[_trialId][_participant][_milestoneIndex]) {

            return 0;

        }



        ebool eligible = eligibilityEngine.getAnonymousResultForVault(nullifier, _trialId);



        ebool alreadyPaid = encryptedPaid(

            participantMilestonePaidEnc,

            _trialId,

            _participant,

            _milestoneIndex

        );

        participantMilestonePaidEnc[_trialId][_participant][_milestoneIndex] = FHE.or(alreadyPaid, eligible);
        ebool staged = participantMilestonePaidEnc[_trialId][_participant][_milestoneIndex];
        FHE.allowThis(staged);
        FHE.allow(staged, _participant);



        stagedShareWei[_trialId][_participant][_milestoneIndex] = _creditedWei;

        entitlementStaged[_trialId][_participant][_milestoneIndex] = true;



        return 0;

    }



    function creditReward(

        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        ConfidentialETH cETH,

        IVaultEligibilityEngine eligibilityEngine,

        uint256 _trialId,

        uint256 _milestoneIndex,

        address _participant,

        uint256 _amountWei

    ) public returns (uint256 creditedWei) {

        if (_amountWei == 0) return 0;

        uint256 unitScale = cETH.UNIT_SCALE();

        uint256 units = _amountWei / unitScale;

        if (units == 0) {

            return 0;

        }

        creditedWei = units * unitScale;

        uint64 rewardUnits = uint64(units);



        if (_milestoneIndex == 0) {

            return creditScreeningRewardEncrypted(

                participantNullifier,

                entitlementStaged,

                stagedShareWei,

                participantMilestonePaidEnc,

                eligibilityEngine,

                cETH,

                _trialId,

                _participant,

                rewardUnits

            );

        }



        return creditMilestoneRewardEncrypted(

            participantNullifier,

            entitlementStaged,

            stagedShareWei,

            participantMilestonePaidEnc,

            eligibilityEngine,

            _trialId,

            _participant,

            _milestoneIndex,

            rewardUnits,

            creditedWei

        );

    }



    function ensureScreeningCethPool(

        mapping(uint256 => bool) storage screeningCethFunded,

        ConfidentialETH cETH,

        uint256 _trialId,

        uint256 _shareWei

    ) public {

        if (screeningCethFunded[_trialId] || _shareWei == 0) return;

        if (_shareWei < cETH.UNIT_SCALE()) return;

        require(address(this).balance >= _shareWei, "Insufficient ETH in vault");

        cETH.deposit{value: _shareWei}();

        screeningCethFunded[_trialId] = true;

    }



    function isParticipantEligible(

        IVaultMilestoneManager milestoneManager,

        uint256 _trialId,

        address _participant,

        uint256 _milestoneIndex

    ) public view returns (bool) {

        return (_milestoneIndex == 0) ||

            (milestoneManager.getParticipantProgress(_trialId, _participant) >= _milestoneIndex + 1);

    }



    function payEligibleBatchWithCheckpoint(

        IVaultMilestoneManager milestoneManager,

        VaultStorage.IncentivePool storage pool,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,

        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        ConfidentialETH cETH,

        IVaultEligibilityEngine eligibilityEngine,

        uint256 _trialId,

        uint256 _milestoneIndex,

        uint256 _start,

        uint256 _end,

        uint256 _perParticipantWei

    ) public returns (uint256 staged, uint256 lastStagedIndex) {

        lastStagedIndex = type(uint256).max;

        for (uint256 i = _start; i < _end; i++) {

            address participant = pool.participants[i];

            if (

                isParticipantEligible(milestoneManager, _trialId, participant, _milestoneIndex) &&

                !entitlementStaged[_trialId][participant][_milestoneIndex]

            ) {

                try IVaultBatchCredit(address(this)).creditParticipantRewardForBatch(

                    _trialId,

                    _milestoneIndex,

                    participant,

                    _perParticipantWei

                ) {

                    if (entitlementStaged[_trialId][participant][_milestoneIndex]) {

                        staged++;

                        lastStagedIndex = i;

                    }

                } catch (bytes memory reason) {

                    IVaultBatchCredit(address(this)).emitParticipantCreditFailed(

                        _trialId,

                        _milestoneIndex,

                        participant,

                        reason

                    );

                }

            }

        }

    }



    function payRemainder(

        VaultStorage.IncentivePool storage pool,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,

        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,

        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,

        mapping(uint256 => mapping(uint256 => bool)) storage milestoneRemainderPaid,

        ConfidentialETH cETH,

        IVaultEligibilityEngine eligibilityEngine,

        uint256 _trialId,

        uint256 _milestoneIndex,

        uint256 _lastStagedIndex,

        uint256 _remainder,

        bool _requireUnpaid

    ) public returns (uint256 staged) {

        if (_lastStagedIndex == type(uint256).max || _remainder == 0) return 0;

        if (_requireUnpaid) {

            require(!milestoneRemainderPaid[_trialId][_milestoneIndex], "Remainder already paid");

        } else if (milestoneRemainderPaid[_trialId][_milestoneIndex]) {

            return 0;

        }

        milestoneRemainderPaid[_trialId][_milestoneIndex] = true;

        address participant = pool.participants[_lastStagedIndex];

        stagedShareWei[_trialId][participant][_milestoneIndex] += _remainder;

        return 1;

    }



    function updateGlobalLastPaidIndex(

        mapping(uint256 => mapping(uint256 => uint256)) storage lastPaidParticipantIndex,

        uint256 _trialId,

        uint256 _milestoneIndex,

        uint256 _batchLastPaid

    ) public {

        if (_batchLastPaid == type(uint256).max) return;

        uint256 global = lastPaidParticipantIndex[_trialId][_milestoneIndex];

        if (global == type(uint256).max || _batchLastPaid > global) {

            lastPaidParticipantIndex[_trialId][_milestoneIndex] = _batchLastPaid;

        }

    }



    function applyMilestoneAccounting(

        VaultStorage.IncentivePool storage pool,

        mapping(uint256 => mapping(uint256 => uint256)) storage milestoneDistributedWei,

        uint256 _trialId,

        uint256 _milestoneIndex,

        uint256 _distributed,

        uint256 _milestoneShareWei

    ) public {

        pool.totalDistributedWei += _distributed;

        milestoneDistributedWei[_trialId][_milestoneIndex] += _distributed;

        require(

            pool.totalDistributedWei <= pool.totalDepositedWei,

            "Would exceed pool balance"

        );

        require(

            milestoneDistributedWei[_trialId][_milestoneIndex] <= _milestoneShareWei,

            "Exceeds milestone share"

        );

    }



    function hasEligibleUnpaid(

        IVaultMilestoneManager milestoneManager,

        VaultStorage.IncentivePool storage pool,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        uint256 _trialId,

        uint256 _milestoneIndex

    ) public view returns (bool) {

        uint256 pCount = pool.participants.length;

        for (uint256 i = 0; i < pCount; i++) {

            address p = pool.participants[i];

            if (

                isParticipantEligible(milestoneManager, _trialId, p, _milestoneIndex) &&

                !entitlementStaged[_trialId][p][_milestoneIndex]

            ) {

                return true;

            }

        }

        return false;

    }



    function finalizePaginatedBatch(

        IVaultMilestoneManager milestoneManager,

        VaultStorage.IncentivePool storage pool,

        mapping(uint256 => mapping(uint256 => uint256)) storage lastProcessedIndex,

        mapping(uint256 => mapping(uint256 => bool)) storage milestoneDistributed,

        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,

        uint256 _trialId,

        uint256 _milestoneIndex,

        uint256 _endIndex,

        uint256 _pCount,

        bool _setScreeningDistributed

    ) public {

        lastProcessedIndex[_trialId][_milestoneIndex] = _endIndex;



        if (

            _endIndex == _pCount &&

            !hasEligibleUnpaid(milestoneManager, pool, entitlementStaged, _trialId, _milestoneIndex)

        ) {

            milestoneDistributed[_trialId][_milestoneIndex] = true;

        }



        if (_setScreeningDistributed && _endIndex == _pCount) {
            pool.screeningDistributed = true;
        }
    }

    function perParticipantMilestoneWei(
        IVaultMilestoneManager milestoneManager,
        VaultStorage.IncentivePool storage pool,
        uint256 _trialId,
        uint256 _milestoneIndex
    ) public view returns (uint256 milestoneShareWei, uint256 perParticipantWei) {
        uint256 pCount = pool.participants.length;
        require(pCount > 0, "No participants");
        require(address(milestoneManager) != address(0), "Milestone manager not set");
        IVaultMilestoneManager.Milestone[] memory milestones = milestoneManager.getMilestones(_trialId);
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        uint256 totalWei = pool.totalDepositedWei;
        milestoneShareWei = (totalWei * milestones[_milestoneIndex].weightBps) / 10000;
        perParticipantWei = milestoneShareWei / pCount;
    }

    function runScreeningDistribution(
        IVaultMilestoneManager milestoneManager,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => mapping(uint256 => bool)) storage milestoneDistributed,
        mapping(uint256 => mapping(address => mapping(uint256 => bool))) storage entitlementStaged,
        mapping(uint256 => mapping(address => uint256)) storage participantNullifier,
        mapping(uint256 => mapping(address => mapping(uint256 => uint256))) storage stagedShareWei,
        mapping(uint256 => mapping(address => mapping(uint256 => ebool))) storage participantMilestonePaidEnc,
        mapping(uint256 => mapping(uint256 => bool)) storage milestoneRemainderPaid,
        ConfidentialETH cETH,
        IVaultEligibilityEngine eligibilityEngine,
        uint256 _trialId,
        uint256 _batchSize
    ) public {
        VaultStorage.IncentivePool storage pool = pools[_trialId];
        uint256 pCount = pool.participants.length;
        require(pCount > 0, "No participants");
        require(pCount <= _batchSize, "Use distributePartialPaginated for large pools");

        uint256 totalWei = pool.totalDepositedWei;
        bool hasMilestones = address(milestoneManager) != address(0) &&
            milestoneManager.getMilestones(_trialId).length > 0;

        uint256 perParticipantWei;
        uint256 shareWei;
        if (hasMilestones) {
            (shareWei, perParticipantWei) = perParticipantMilestoneWei(milestoneManager, pool, _trialId, 0);
        } else {
            shareWei = totalWei;
            perParticipantWei = totalWei / pCount;
        }
        uint256 remainder = shareWei - (perParticipantWei * pCount);

        (, uint256 lastStagedIndex) = payEligibleBatchWithCheckpoint(
            milestoneManager,
            pool,
            entitlementStaged,
            participantNullifier,
            stagedShareWei,
            participantMilestonePaidEnc,
            cETH,
            eligibilityEngine,
            _trialId,
            0,
            0,
            pCount,
            perParticipantWei
        );
        payRemainder(
            pool,
            entitlementStaged,
            participantNullifier,
            stagedShareWei,
            participantMilestonePaidEnc,
            milestoneRemainderPaid,
            cETH,
            eligibilityEngine,
            _trialId,
            0,
            lastStagedIndex,
            remainder,
            false
        );

        if (hasMilestones) {
            if (!hasEligibleUnpaid(milestoneManager, pool, entitlementStaged, _trialId, 0)) {
                milestoneDistributed[_trialId][0] = true;
            }
        }
        pool.screeningDistributed = true;
    }
}

