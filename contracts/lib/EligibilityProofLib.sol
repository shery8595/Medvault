// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16} from "@fhevm/solidity/lib/FHE.sol";
import "../TrialManager.sol";

/**
 * @notice Noir / HonkVerifier eligibility-proof verification extracted from EligibilityEngine
 *         to keep the engine under the EIP-170 24KB contract size limit.
 * @dev All functions are `public` so calls go through DELEGATECALL into the library bytecode
 *      (internal library functions would be inlined and not reduce engine bytecode).
 *      Functions are pure view over contract addresses passed in — they perform no state writes
 *      and preserve the exact validation order/errors of the original engine internals.
 */
interface IEligibilityProofRegistry {
    function getProfileCommitment(uint256 _commitment) external view returns (bytes32);
}

interface IEligibilityProofHonkVerifier {
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool);
}

interface IEligibilityProofDocumentStore {
    function getDocumentBindingForEngine(
        uint256 _nullifier,
        uint256 _trialId
    )
        external
        view
        returns (
            bytes32 cidHash,
            bytes32 aesKeyCtHash,
            bytes32 keyHandleHash0,
            bytes32 keyHandleHash1,
            bytes32 keyHandleHash2,
            bytes32 keyHandleHash3,
            bool docExists,
            bool docRevoked
        );
}

library EligibilityProofLib {
    /// @dev Field modulus used to reduce keccak hashes into the BN254 scalar field for Noir public inputs.
    uint256 private constant BN254_FIELD_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct ProofAddrs {
        address trialManager;
        address patientRegistry;
        address eligibilityVerifier;
        address eligibilityVerifierEncrypted;
        address patientDocumentStore;
    }

    function requireTrialOpen(TrialManager.Trial memory trial) public view {
        require(trial.active, "Trial is not active");
        require(trial.endTime > 0, "Trial does not exist");
        require(block.timestamp < trial.endTime, "Trial ended");
    }

    function encryptedCriteriaBindingHash(address trialManager, uint256 trialId)
        public
        view
        returns (bytes32)
    {
        TrialManager.EncryptedCriteria memory c = TrialManager(trialManager).getEncryptedCriteria(trialId);
        return keccak256(
            abi.encode(
                euint8.unwrap(c.minAge),
                euint8.unwrap(c.maxAge),
                ebool.unwrap(c.requiresDiabetes),
                euint16.unwrap(c.minHb),
                euint8.unwrap(c.genderRequirement),
                euint8.unwrap(c.minHeight),
                euint16.unwrap(c.maxWeight),
                ebool.unwrap(c.requiresNonSmoker),
                ebool.unwrap(c.requiresNormalBP)
            )
        );
    }

    function verifyDocumentBinding(
        address patientDocumentStore,
        bytes32 docSchemaHash,
        bytes32[] calldata _publicInputs,
        uint256 _docBaseIndex,
        uint256 _nullifier,
        uint256 _trialId
    ) public view {
        uint256 hasDocIndex = _docBaseIndex + 7;
        if (uint256(_publicInputs[hasDocIndex]) == 1) {
            require(_publicInputs[_docBaseIndex + 6] == docSchemaHash, "Doc schema mismatch");
            require(patientDocumentStore != address(0), "Document store not set");
            (
                bytes32 cidHash,
                bytes32 aesKeyCtHash,
                bytes32 keyHandleHash0,
                bytes32 keyHandleHash1,
                bytes32 keyHandleHash2,
                bytes32 keyHandleHash3,
                bool docExists,
                bool docRevoked
            ) = IEligibilityProofDocumentStore(patientDocumentStore).getDocumentBindingForEngine(_nullifier, _trialId);
            require(docExists && !docRevoked, "Document missing or revoked");
            require(_publicInputs[_docBaseIndex] == cidHash, "Doc CID hash mismatch");
            require(_publicInputs[_docBaseIndex + 1] == aesKeyCtHash, "AES ct hash mismatch");
            require(_publicInputs[_docBaseIndex + 2] == keyHandleHash0, "Key handle 0 mismatch");
            require(_publicInputs[_docBaseIndex + 3] == keyHandleHash1, "Key handle 1 mismatch");
            require(_publicInputs[_docBaseIndex + 4] == keyHandleHash2, "Key handle 2 mismatch");
            require(_publicInputs[_docBaseIndex + 5] == keyHandleHash3, "Key handle 3 mismatch");
        } else {
            require(uint256(_publicInputs[hasDocIndex]) == 0, "Invalid has_document flag");
            for (uint256 i = _docBaseIndex; i < hasDocIndex; i++) {
                require(_publicInputs[i] == bytes32(0), "Doc fields must be zero");
            }
        }
    }

    /**
     * @dev Shared Noir + trial criteria verification (mode-specific public input layout).
     *      Mirrors EligibilityEngine._verifyEligibilityProofCore exactly.
     *      `commitment` is the Semaphore commitment (on-chain profile check for plaintext mode).
     */
    function verifyEligibilityProofCore(
        ProofAddrs memory addrs,
        bytes32 criteriaSchemaHash,
        bytes32 docSchemaHash,
        uint256 eligibilityPublicInputCount,
        uint256 eligibilityEncryptedPublicInputCount,
        bytes calldata _proof,
        bytes32[] calldata _publicInputs,
        uint256 _trialId,
        uint256 _nullifier,
        bytes32 _commitment,
        bytes32 _expectedFheStageHash,
        bool _encryptedMode
    ) public view {
        require(uint256(_publicInputs[0]) == _trialId, "Scope mismatch: trial_id");
        require(uint256(_publicInputs[1]) == _nullifier, "Nullifier mismatch");

        TrialManager.Trial memory trial = TrialManager(addrs.trialManager).getTrial(_trialId);
        requireTrialOpen(trial);
        require(trial.encryptedCriteria == _encryptedMode, "Trial criteria mode mismatch");

        if (_encryptedMode) {
            require(
                _publicInputs.length == eligibilityEncryptedPublicInputCount,
                "Expected 15 public inputs"
            );
            require(addrs.eligibilityVerifierEncrypted != address(0), "Encrypted verifier not set");
            require(
                uint256(_publicInputs[3]) == uint256(_expectedFheStageHash) % BN254_FIELD_ORDER,
                "FHE stage mismatch"
            );
            require(_publicInputs[4] == criteriaSchemaHash, "Criteria schema mismatch");
            bytes32 criteriaBinding = encryptedCriteriaBindingHash(addrs.trialManager, _trialId);
            require(
                uint256(_publicInputs[5]) == uint256(criteriaBinding) % BN254_FIELD_ORDER,
                "Encrypted criteria binding mismatch"
            );
            require(uint256(_publicInputs[6]) == 1, "Encrypted mode flag");
        verifyDocumentBinding(addrs.patientDocumentStore, docSchemaHash, _publicInputs, 7, _nullifier, _trialId);
        require(IEligibilityProofHonkVerifier(addrs.eligibilityVerifierEncrypted).verify(_proof, _publicInputs), "Invalid Noir proof");
            return;
        }

        require(
            _publicInputs.length == eligibilityPublicInputCount,
            "Expected 25 public inputs"
        );
        require(addrs.eligibilityVerifier != address(0), "Verifier not set");
        require(
            uint256(_publicInputs[5]) == uint256(_expectedFheStageHash) % BN254_FIELD_ORDER,
            "FHE stage mismatch"
        );
        require(_publicInputs[6] == criteriaSchemaHash, "Criteria schema mismatch");

        require(_commitment != bytes32(0), "Commitment required");
        bytes32 storedProfile = IEligibilityProofRegistry(addrs.patientRegistry).getProfileCommitment(uint256(_commitment));
        require(_publicInputs[2] == storedProfile, "Profile commitment mismatch");

        require(uint256(_publicInputs[16]) == 0, "Plaintext mode flag");
        require(uint256(_publicInputs[7]) == trial.minAge, "Criteria mismatch: minAge");
        require(uint256(_publicInputs[8]) == trial.maxAge, "Criteria mismatch: maxAge");
        require(uint256(_publicInputs[9]) == (trial.requiresDiabetes ? 1 : 0), "Criteria mismatch: diabetes");
        require(uint256(_publicInputs[10]) == trial.minHb, "Criteria mismatch: minHb");
        require(uint256(_publicInputs[11]) == trial.genderRequirement, "Criteria mismatch: gender");
        require(uint256(_publicInputs[12]) == trial.minHeight, "Criteria mismatch: minHeight");
        require(uint256(_publicInputs[13]) == trial.maxWeight, "Criteria mismatch: maxWeight");
        require(uint256(_publicInputs[14]) == (trial.requiresNonSmoker ? 1 : 0), "Criteria mismatch: nonSmoker");
        require(uint256(_publicInputs[15]) == (trial.requiresNormalBP ? 1 : 0), "Criteria mismatch: normalBP");

        verifyDocumentBinding(addrs.patientDocumentStore, docSchemaHash, _publicInputs, 17, _nullifier, _trialId);
        require(IEligibilityProofHonkVerifier(addrs.eligibilityVerifier).verify(_proof, _publicInputs), "Invalid Noir proof");
    }
}
