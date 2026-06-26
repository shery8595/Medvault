// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @dev TEST ONLY — never deploy to production networks.

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {ISemaphoreGroups} from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";

/**
 * @notice Test double for Semaphore — tracks members and validates proof fields without ZK.
 */
contract MockSemaphore is ISemaphore {
    uint256 public groupCounter;
    bool public proofsValid = true;

    mapping(uint256 => uint256) public groupAdmin;
    mapping(uint256 => uint256) public merkleTreeDuration;
    mapping(uint256 => mapping(uint256 => bool)) private _members;
    mapping(uint256 => uint256) private _groupSize;

    function setProofsValid(bool valid) external {
        proofsValid = valid;
    }

    function createGroup() external returns (uint256) {
        return _createGroup(msg.sender, 30 days);
    }

    function createGroup(address admin) external returns (uint256) {
        return _createGroup(admin, 30 days);
    }

    function createGroup(address admin, uint256 duration) external returns (uint256) {
        return _createGroup(admin, duration);
    }

    function _createGroup(address admin, uint256 duration) internal returns (uint256) {
        uint256 id = ++groupCounter;
        groupAdmin[id] = uint256(uint160(admin));
        merkleTreeDuration[id] = duration;
        return id;
    }

    function updateGroupAdmin(uint256, address) external pure {}

    function acceptGroupAdmin(uint256) external pure {}

    function updateGroupMerkleTreeDuration(uint256 groupId, uint256 newDuration) external {
        merkleTreeDuration[groupId] = newDuration;
    }

    function addMember(uint256 groupId, uint256 identityCommitment) external {
        if (!_members[groupId][identityCommitment]) {
            _members[groupId][identityCommitment] = true;
            _groupSize[groupId]++;
        }
    }

    function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external {
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            this.addMember(groupId, identityCommitments[i]);
        }
    }

    function updateMember(uint256, uint256, uint256, uint256[] calldata) external pure {}

    function removeMember(uint256, uint256, uint256[] calldata) external pure {}

    function validateProof(uint256, SemaphoreProof calldata) external {}

    function verifyProof(uint256 /* groupId */, SemaphoreProof calldata /* proof */) external view returns (bool) {
        return proofsValid;
    }

    // ISemaphoreGroups (same address)
    function hasMember(uint256 groupId, uint256 identityCommitment) external view returns (bool) {
        return _members[groupId][identityCommitment];
    }

    function getMerkleTreeSize(uint256 groupId) external view returns (uint256) {
        return _groupSize[groupId];
    }

    function getMerkleTreeDepth(uint256) external pure returns (uint256) {
        return 20;
    }

    function getMerkleTreeRoot(uint256) external pure returns (uint256) {
        return 1;
    }
}
