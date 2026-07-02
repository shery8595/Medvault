// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import "../ConfidentialETH.sol";
import "./VaultStorage.sol";
import {IVaultEligibilityEngine} from "./VaultInterfaces.sol";

/// @notice EIP-712 claim and withdraw-to helpers for SponsorIncentiveVault.
library VaultClaimLib {
    error AuthAlreadyUsed();
    error InvalidClaimSignature();
    error NoPermitHolderFound();
    error OnlyPermitHolder();
    error PatientNotRegistered();
    error PermitHolderMismatch();
    error SignatureExpired();
    error ZeroDestinationAddress();

    event ClaimInitiated(uint256 indexed trialId, address indexed permitHolder, bytes32 sufficientHandle);

    function computeEncryptedAmountCommitment(
        externalEuint64 encryptedUnits,
        bytes calldata inputProof
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(encryptedUnits, inputProof));
    }

    function initiateClaim(
        ConfidentialETH cETH,
        uint256 trialId,
        address patient,
        address destination,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof,
        uint256 withdrawToNonce,
        uint256 withdrawToDeadline,
        bytes calldata withdrawToSignature
    ) public {
        cETH.requestWithdrawTo(
            patient,
            destination,
            encryptedUnits,
            inputProof,
            withdrawToNonce,
            withdrawToDeadline,
            withdrawToSignature
        );
        bytes32 sufficientHandle = cETH.pendingWithdrawToHandle(patient);
        emit ClaimInitiated(trialId, patient, sufficientHandle);
    }

    function claimParticipantRewards(
        ConfidentialETH cETH,
        IVaultEligibilityEngine eligibilityEngine,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        uint256 trialId,
        uint256 nullifier,
        address destination,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof,
        uint256 withdrawToNonce,
        uint256 withdrawToDeadline,
        bytes calldata withdrawToSignature
    ) public {
        address patient = eligibilityEngine.getDecryptPermitHolder(nullifier, trialId);
        if (!(patient != address(0))) revert NoPermitHolderFound();
        if (!(destination != address(0))) revert ZeroDestinationAddress();
        if (!(msg.sender == patient)) revert OnlyPermitHolder();
        if (!(pools[trialId].isRegistered[patient])) revert PatientNotRegistered();

        initiateClaim(
            cETH,
            trialId,
            patient,
            destination,
            encryptedUnits,
            inputProof,
            withdrawToNonce,
            withdrawToDeadline,
            withdrawToSignature
        );
    }

    function claimParticipantRewardsFor(
        ConfidentialETH cETH,
        IVaultEligibilityEngine eligibilityEngine,
        mapping(uint256 => VaultStorage.IncentivePool) storage pools,
        mapping(bytes32 => bool) storage claimAuthUsed,
        bytes32 claimAuthTypehash,
        bytes32 domainSeparator,
        uint256 trialId,
        uint256 nullifier,
        address permitHolder,
        address destination,
        uint256 units,
        bytes32 encryptedAmountCommitment,
        externalEuint64 encryptedUnits,
        bytes calldata inputProof,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        uint256 withdrawToNonce,
        uint256 withdrawToDeadline,
        bytes calldata withdrawToSignature
    ) public {
        address patient = eligibilityEngine.getDecryptPermitHolder(nullifier, trialId);
        if (!(patient != address(0))) revert NoPermitHolderFound();
        if (!(permitHolder == patient)) revert PermitHolderMismatch();
        if (!(destination != address(0))) revert ZeroDestinationAddress();
        if (!(block.timestamp <= deadline)) revert SignatureExpired();
        if (!(pools[trialId].isRegistered[patient])) revert PatientNotRegistered();
        require(
            encryptedAmountCommitment == computeEncryptedAmountCommitment(encryptedUnits, inputProof),
            "Amount commitment mismatch"
        );

        bytes32 authKey = keccak256(abi.encode(permitHolder, trialId, nullifier, nonce));
        if (claimAuthUsed[authKey]) revert AuthAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                claimAuthTypehash,
                trialId,
                nullifier,
                permitHolder,
                destination,
                units,
                encryptedAmountCommitment,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ECDSA.recover(digest, signature);
        if (!(signer == permitHolder)) revert InvalidClaimSignature();

        claimAuthUsed[authKey] = true;
        initiateClaim(
            cETH,
            trialId,
            patient,
            destination,
            encryptedUnits,
            inputProof,
            withdrawToNonce,
            withdrawToDeadline,
            withdrawToSignature
        );
    }
}
