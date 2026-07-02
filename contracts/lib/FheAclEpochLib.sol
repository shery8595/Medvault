// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// @notice Coordinated FHE ACL grant epochs for trusted-contract rotation scaffolding.
/// @dev fhEVM `FHE.allow` is append-only; epoch bumps signal off-chain re-grant pipelines.
library FheAclEpochLib {
    enum GrantKind {
        PatientRegistry,
        EligibilityEngine,
        ConsentManager,
        ScoreLeaderboard,
        TrialManager,
        DocumentStore
    }

    struct EpochState {
        mapping(uint8 => uint40) currentEpochByKind;
    }

    event AclGranted(bytes32 indexed handle, address indexed consumer, uint40 epoch, uint8 kind);
    event AclEpochRotated(uint8 indexed kind, uint40 newEpoch, address indexed newConsumer);

    function currentEpoch(EpochState storage state, uint8 kind) internal view returns (uint40 epoch) {
        epoch = state.currentEpochByKind[kind];
        if (epoch == 0) {
            epoch = 1;
        }
    }

    function recordGrant(
        EpochState storage state,
        bytes32 handle,
        address consumer,
        uint8 kind
    ) internal returns (uint40 epoch) {
        epoch = currentEpoch(state, kind);
        emit AclGranted(handle, consumer, epoch, kind);
    }

    function rotateKind(
        EpochState storage state,
        uint8 kind,
        address newConsumer
    ) internal returns (uint40 newEpoch) {
        uint40 current = state.currentEpochByKind[kind];
        if (current == 0) {
            current = 1;
        }
        newEpoch = current + 1;
        state.currentEpochByKind[kind] = newEpoch;
        emit AclEpochRotated(kind, newEpoch, newConsumer);
    }
}
