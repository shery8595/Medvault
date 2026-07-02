// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {PoseidonT4} from "poseidon-solidity/PoseidonT4.sol";

/**
 * @notice On-chain Poseidon profile commitment — matches circuits/eligibility_plaintext + test-support/profileCommitment.ts
 */
library ProfileCommitmentPoseidon {
    uint256 internal constant BN254_FIELD_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function poseidon3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        return PoseidonT4.hash([a, b, c]);
    }

    function compute(
        uint256 commitment,
        uint8 age,
        bool gender,
        uint16 weight,
        uint8 height,
        bool hasDiabetes,
        uint16 hbLevel,
        bool isSmoker,
        bool hasHypertension,
        uint256 profileSalt
    ) internal pure returns (bytes32) {
        require(profileSalt != 0, "Salt required");
        uint256 g = gender ? 1 : 0;
        uint256 d = hasDiabetes ? 1 : 0;
        uint256 s = isSmoker ? 1 : 0;
        uint256 bp = hasHypertension ? 1 : 0;
        uint256 left = poseidon3(commitment, age, g);
        uint256 mid = poseidon3(weight, height, d);
        uint256 right = poseidon3(hbLevel, s, bp);
        uint256 saltedRight = poseidon3(right, profileSalt, 0);
        uint256 root = poseidon3(left, mid, saltedRight);
        return bytes32(root);
    }
}
