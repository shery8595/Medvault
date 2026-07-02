// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16} from "@fhevm/solidity/lib/FHE.sol";
import "../AnonymousPatientRegistry.sol";
import {ProfileCommitmentPoseidon} from "./ProfileCommitmentPoseidon.sol";

/**
 * @notice Hardhat-only APR extension with Poseidon-linked registerPatientClear.
 * @dev Deploy with linked PoseidonT4 library on chain 31337 only.
 */
contract AnonymousPatientRegistryTestHarness is AnonymousPatientRegistry {
    /**
     * @notice Register patient with cleartext profile fields (Hardhat mock fhEVM only).
     */
    function registerPatientClear(
        uint256 _commitment,
        address _permitRecipient,
        uint8 age,
        bool gender,
        uint16 weight,
        uint8 height,
        bool hasDiabetes,
        uint16 hbLevel,
        bool isSmoker,
        bool hasHypertension
    ) external onlyTestHelpers onlyAuthorizedRegistry {
        uint256 profileSalt = uint256(keccak256(abi.encodePacked(_commitment, block.chainid)));
        profileSalt = profileSalt % 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        if (profileSalt == 0) profileSalt = 1;

        bytes32 profileCommitment = ProfileCommitmentPoseidon.compute(
            _commitment,
            age,
            gender,
            weight,
            height,
            hasDiabetes,
            hbLevel,
            isSmoker,
            hasHypertension,
            profileSalt
        );

        _storeCleartextPatientRegistration(
            _commitment,
            _permitRecipient,
            profileCommitment,
            age,
            gender,
            weight,
            height,
            hasDiabetes,
            hbLevel,
            isSmoker,
            hasHypertension
        );
    }
}
