// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import "../EligibilityEngine.sol";
import {EligibilityComputeLib} from "../lib/EligibilityComputeLib.sol";
import {TestHelpers} from "./TestHelpers.sol";

/**
 * @notice Hardhat-only EligibilityEngine extension with differential/test helpers.
 */
contract EligibilityEngineTestHarness is EligibilityEngine {
    bytes32 public lastDiffPlaintextFinal;
    bytes32 public lastDiffEncryptedFinal;
    bytes32 public lastDiffPlaintextScore;
    bytes32 public lastDiffEncryptedScore;

    bool public testHelpersEnabled;
    uint256 public constant TEST_HELPERS_CHANGE_DELAY = 6 hours;
    bool public pendingTestHelpersValue;
    uint256 public testHelpersChangeEta;

    constructor(
        address _patientRegistry,
        address _trialManager,
        address _consentManager
    ) EligibilityEngine(_patientRegistry, _trialManager, _consentManager) {}

    function checkEligibility(address /* patient */, uint256 /* trialId */) external pure {
        revert("Legacy eligibility check deprecated");
    }

    function applyToTrial(uint256 /* trialId */, bool /* eligible */, bytes calldata /* proof */) external pure {
        revert("Deprecated");
    }

    function compareCachedEligibilityPaths(
        uint256 _commitment,
        uint256 _trialId
    ) external returns (bytes32 cachedFinal, bytes32 refreshedFinal) {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(trial.encryptedCriteria, "Plaintext trial");

        IAnonymousPatientRegistry.EncryptedPatient memory patientCached =
            patientRegistry.getCachedPatientFields(_commitment);
        IAnonymousPatientRegistry.EncryptedPatient memory patientRefreshed =
            patientRegistry.getPatient(_commitment);

        (ebool cachedResult,) = _computeEligibilityEncrypted(patientCached, _trialId, false);
        (ebool refreshedResult,) = _computeEligibilityEncrypted(patientRefreshed, _trialId, true);

        cachedFinal = ebool.unwrap(cachedResult);
        refreshedFinal = ebool.unwrap(refreshedResult);
    }

    function comparePlaintextVsEncryptedEligibility(
        uint256 _commitment,
        uint256 plaintextTrialId,
        uint256 encryptedTrialId
    )
        external
        returns (
            bytes32 plaintextFinal,
            bytes32 encryptedFinal,
            bytes32 plaintextScore,
            bytes32 encryptedScore
        )
    {
        require(msg.sender == authorizedRegistry, "Only authorized registry");
        TrialManager.Trial memory ptTrial = trialManager.getTrial(plaintextTrialId);
        TrialManager.Trial memory encTrial = trialManager.getTrial(encryptedTrialId);
        require(!ptTrial.encryptedCriteria, "Plaintext trial required");
        require(encTrial.encryptedCriteria, "Encrypted trial required");

        IAnonymousPatientRegistry.EncryptedPatient memory patient = patientRegistry.getCachedPatientFields(
            _commitment
        );
        require(patient.exists, "Patient not found");

        (ebool pf, euint8 ps) = EligibilityComputeLib.computeEligibilityPlaintext(
            _toLibPatient(patient),
            _toLibTrial(ptTrial)
        );
        (ebool ef, euint8 es) = _computeEligibilityEncrypted(patient, encryptedTrialId, false);

        pf = FHE.makePubliclyDecryptable(pf);
        ef = FHE.makePubliclyDecryptable(ef);
        ps = FHE.makePubliclyDecryptable(ps);
        es = FHE.makePubliclyDecryptable(es);

        plaintextFinal = ebool.unwrap(pf);
        encryptedFinal = ebool.unwrap(ef);
        plaintextScore = euint8.unwrap(ps);
        encryptedScore = euint8.unwrap(es);

        lastDiffPlaintextFinal = plaintextFinal;
        lastDiffEncryptedFinal = encryptedFinal;
        lastDiffPlaintextScore = plaintextScore;
        lastDiffEncryptedScore = encryptedScore;
    }

    function lastDiffCompareHandles()
        external
        view
        returns (
            bytes32 plaintextFinal,
            bytes32 encryptedFinal,
            bytes32 plaintextScore,
            bytes32 encryptedScore
        )
    {
        return (
            lastDiffPlaintextFinal,
            lastDiffEncryptedFinal,
            lastDiffPlaintextScore,
            lastDiffEncryptedScore
        );
    }

    function scheduleTestHelpersEnabled(bool enabled) external onlyOwner {
        pendingTestHelpersValue = enabled;
        testHelpersChangeEta = block.timestamp + TEST_HELPERS_CHANGE_DELAY;
    }

    function applyTestHelpersEnabled() external onlyOwner {
        require(
            testHelpersChangeEta != 0 && block.timestamp >= testHelpersChangeEta,
            "Timelock active"
        );
        testHelpersEnabled = pendingTestHelpersValue;
        testHelpersChangeEta = 0;
    }

    function overwriteAnonymousResultForTest(
        uint256 _nullifier,
        uint256 _trialId,
        externalEbool encryptedResult,
        bytes calldata inputProof
    ) external {
        TestHelpers.requireEnabled(testHelpersEnabled);
        ebool result = FHE.fromExternal(encryptedResult, inputProof);
        FHE.allowThis(result);
        anonymousResults[_nullifier][_trialId] = result;
        if (sponsorIncentiveVault != address(0)) {
            FHE.allow(result, sponsorIncentiveVault);
        }
    }

    function setApplicationAcceptedForTest(
        uint256 _nullifier,
        uint256 _trialId,
        bool _accepted
    ) external {
        TestHelpers.requireEnabled(testHelpersEnabled);
        anonymousApplicationAccepted[_nullifier][_trialId] = _accepted;
    }
}
