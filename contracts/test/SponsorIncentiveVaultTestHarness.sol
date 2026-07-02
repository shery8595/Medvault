// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "../SponsorIncentiveVault.sol";
import {TestHelpers} from "./TestHelpers.sol";

/**
 * @notice Hardhat-only vault extension to force per-participant credit reverts in batch distribution tests.
 */
contract SponsorIncentiveVaultTestHarness is SponsorIncentiveVault {
    error ForcedCreditRevert();
    error ForcedBatchRevert();

    bool public testHelpersEnabled;
    mapping(address => bool) public forceCreditRevertForParticipant;
    mapping(uint256 => bool) public forceBatchRevertForTrial;

    constructor(
        address payable _cETH,
        address _trialManager,
        address _eligibilityEngine
    ) SponsorIncentiveVault(_cETH, _trialManager, _eligibilityEngine) {}

    function setTestHelpersEnabled(bool enabled) external {
        require(block.chainid == TestHelpers.HARDHAT_CHAIN_ID, "Test helpers disabled");
        testHelpersEnabled = enabled;
    }

    function setForceCreditRevertForParticipant(address participant, bool force) external {
        TestHelpers.requireEnabled(testHelpersEnabled);
        forceCreditRevertForParticipant[participant] = force;
    }

    function setForceBatchRevertForTrial(uint256 trialId, bool force) external {
        TestHelpers.requireEnabled(testHelpersEnabled);
        forceBatchRevertForTrial[trialId] = force;
    }

    function _guardDistributePartialPaginated(uint256 _trialId) internal override {
        if (forceBatchRevertForTrial[_trialId]) revert ForcedBatchRevert();
    }

    function _guardDistribute(uint256 _trialId) internal override {
        if (forceBatchRevertForTrial[_trialId]) revert ForcedBatchRevert();
    }

    function creditParticipantRewardForBatch(
        uint256 trialId,
        uint256 milestoneIndex,
        address participant,
        uint256 amountWei
    ) external override returns (uint256 creditedWei) {
        if (!_batchCreditInProgress) revert NotAuthorized();
        if (forceCreditRevertForParticipant[participant]) revert ForcedCreditRevert();
        return _creditReward(trialId, milestoneIndex, participant, amountWei);
    }
}
