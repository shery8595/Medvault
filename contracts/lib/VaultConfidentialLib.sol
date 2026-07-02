// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import "../ConfidentialETH.sol";
import "./VaultStorage.sol";
import "./VaultInterfaces.sol";

/// @notice IERC7984 confidential-funding callback helpers for SponsorIncentiveVault.
library VaultConfidentialLib {
    uint8 internal constant FUND_AND_MILESTONES_MODE = 2;

    function receiverAccept(ConfidentialETH cETH) public returns (ebool retval) {
        retval = FHE.asEbool(true);
        FHE.allow(retval, address(cETH));
        return retval;
    }

    function receiverReject(ConfidentialETH cETH) public returns (ebool retval) {
        retval = FHE.asEbool(false);
        FHE.allow(retval, address(cETH));
        return retval;
    }

    function tryConfidentialFundTrial(
        IVaultTrialManager trialManager,
        VaultStorage.IncentivePool storage pool,
        mapping(uint256 => bool) storage reclaimFinalized,
        uint256 _trialId,
        address _from
    ) public view returns (bool ok, IVaultTrialManager.Trial memory trial) {
        trial = trialManager.getTrial(_trialId);
        if (_from != trial.sponsor) return (false, trial);
        if (!trial.active) return (false, trial);
        if (trial.endTime <= block.timestamp) return (false, trial);
        if (pool.fundingLocked) return (false, trial);
        if (reclaimFinalized[_trialId]) return (false, trial);
        return (true, trial);
    }

    /// @dev LOW-2: Only updates `encryptedPoolSize` (FHE `euint64`), not plaintext `totalDepositedWei`.
    ///      Re-enabling confidential funding requires redesigning pool accounting to track deposits and
    ///      distributions as FHE sums (or via on-chain verifiable decryption); plaintext totals cannot be
    ///      updated from an `euint64` without leaking. Guard: `SponsorIncentiveVault.confidentialFundingAccountingReady`.
    function creditConfidentialFund(
        VaultStorage.IncentivePool storage pool,
        address from,
        euint64 amount,
        address sponsor
    ) public {
        from;
        if (FHE.isInitialized(pool.encryptedPoolSize)) {
            pool.encryptedPoolSize = FHE.add(pool.encryptedPoolSize, amount);
        } else {
            pool.encryptedPoolSize = amount;
        }
        FHE.allowThis(pool.encryptedPoolSize);
        FHE.allow(pool.encryptedPoolSize, sponsor);
    }

    function handleConfidentialTransfer(
        ConfidentialETH cETH,
        IVaultTrialManager trialManager,
        IVaultMilestoneManager milestoneManager,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(uint256 => bool) storage reclaimFinalized,
        address from,
        euint64 amount,
        bytes calldata data
    ) public returns (ebool) {
        uint256 trialId;
        if (data.length == 64) {
            uint256 milestoneIndex;
            (trialId, milestoneIndex) = abi.decode(data, (uint256, uint256));
            milestoneIndex;
            (bool ok, IVaultTrialManager.Trial memory trial) =
                tryConfidentialFundTrial(trialManager, pools[trialId], reclaimFinalized, trialId, from);
            if (!ok) {
                return receiverReject(cETH);
            }
            creditConfidentialFund(pools[trialId], from, amount, trial.sponsor);
            return receiverAccept(cETH);
        }

        if (data.length > 64) {
            (
                uint8 mode,
                uint256 encodedTrialId,
                string[] memory names,
                uint16[] memory weights,
                uint256[] memory deadlines
            ) = abi.decode(data, (uint8, uint256, string[], uint16[], uint256[]));
            if (mode != FUND_AND_MILESTONES_MODE) {
                return receiverReject(cETH);
            }
            trialId = encodedTrialId;
            (bool okM, IVaultTrialManager.Trial memory trialM) =
                tryConfidentialFundTrial(trialManager, pools[trialId], reclaimFinalized, trialId, from);
            if (!okM) {
                return receiverReject(cETH);
            }
            if (address(milestoneManager) == address(0)) {
                return receiverReject(cETH);
            }
            milestoneManager.setMilestonesFromVault(trialId, from, names, weights, deadlines);
            creditConfidentialFund(pools[trialId], from, amount, trialM.sponsor);
            return receiverAccept(cETH);
        }

        return receiverReject(cETH);
    }
}
