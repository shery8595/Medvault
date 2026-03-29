// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./PatientRegistry.sol";
import "./TrialManager.sol";
import "./ConsentManager.sol";
import "./DataAccessLog.sol";

/**
 * @title EligibilityEngine
 * @notice Performs privacy-preserving eligibility computation with expanded medical fields
 */
contract EligibilityEngine {
    PatientRegistry public patientRegistry;
    TrialManager public trialManager;
    ConsentManager public consentManager;
    DataAccessLog public dataAccessLog;
    address public automationContract;
    address public owner;

    enum ApplicationStatus { None, Pending, Accepted, Rejected }
    
    struct Application {
        ApplicationStatus status;
        bytes encryptedMessage; // Privacy-preserving message (e.g., contact info)
    }

    mapping(address => mapping(uint256 => ebool)) public encryptedResults;
    mapping(address => mapping(uint256 => euint8)) public encryptedScores;
    mapping(uint256 => mapping(address => Application)) public applications;
    mapping(uint256 => address[]) public trialAppliedPatients;

    event EligibilityComputed(address indexed patient, uint256 indexed trialId);
    event EligibilityScoreComputed(address indexed patient, uint256 indexed trialId);
    event AppliedToTrial(address indexed patient, uint256 indexed trialId);
    event ApplicationStatusUpdated(address indexed patient, uint256 indexed trialId, ApplicationStatus status, bytes message);

    constructor(address _registry, address _trialManager, address _consentManager) {
        owner = msg.sender;
        patientRegistry = PatientRegistry(_registry);
        trialManager = TrialManager(_trialManager);
        consentManager = ConsentManager(_consentManager);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setAutomationContract(address _automation) external onlyOwner {
        automationContract = _automation;
    }

    function setDataAccessLog(address _log) external onlyOwner {
        dataAccessLog = DataAccessLog(_log);
    }

    /**
     * @notice Check trial eligibility with expanded FHE logic
     */
    function checkEligibility(address _patient, uint256 _trialId) external returns (ebool) {
        require(msg.sender == _patient || msg.sender == automationContract, "Unauthorized");
        require(consentManager.hasConsent(_patient, _trialId), "Patient consent not granted");

        PatientRegistry.Patient memory patient = patientRegistry.getPatient(_patient);
        require(patient.exists, "Patient profile not found");

        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(trial.active, "Trial is not active");

        // 1. Age check
        ebool ageOk = FHE.and(
            FHE.gt(patient.age, FHE.asEuint8(trial.minAge)),
            FHE.lt(patient.age, FHE.asEuint8(trial.maxAge))
        );
        
        // 2. Diabetes logic
        ebool diabetesOk = trial.requiresDiabetes ? FHE.eq(patient.hasDiabetes, FHE.asEbool(true)) : FHE.asEbool(true);
        
        // 3. Hb level check
        ebool hbOk = FHE.gte(patient.hbLevel, FHE.asEuint16(trial.minHb));

        // 4. Gender check
        ebool genderOk;
        if (trial.genderRequirement == 1) {
            genderOk = FHE.eq(patient.gender, FHE.asEbool(true));
        } else if (trial.genderRequirement == 2) {
            genderOk = FHE.eq(patient.gender, FHE.asEbool(false));
        } else {
            genderOk = FHE.asEbool(true);
        }

        // 5. Vital Bio-Metrics
        ebool heightOk = trial.minHeight > 0 ? FHE.gte(patient.height, FHE.asEuint8(trial.minHeight)) : FHE.asEbool(true);
        ebool weightOk = trial.maxWeight > 0 ? FHE.lte(patient.weight, FHE.asEuint16(trial.maxWeight)) : FHE.asEbool(true);
        
        // 6. Lifestyle & Co-morbidities
        ebool smokingOk = trial.requiresNonSmoker ? FHE.eq(patient.isSmoker, FHE.asEbool(false)) : FHE.asEbool(true);
        ebool bpOk = trial.requiresNormalBP ? FHE.eq(patient.hasHypertension, FHE.asEbool(false)) : FHE.asEbool(true);

        // --- SCORING LOGIC ---
        // Sum up the passed checks
        euint8 passCount = FHE.asEuint8(0);
        passCount = FHE.add(passCount, FHE.select(ageOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(diabetesOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(hbOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(genderOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(heightOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(weightOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(smokingOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(bpOk, FHE.asEuint8(1), FHE.asEuint8(0)));

        // Total checks = 8. Scale to 0-100 (passCount * 12.5)
        // workaround for lack of FHE.div: 12*passCount + passCount/2
        euint8 score = FHE.mul(passCount, FHE.asEuint8(12));
        score = FHE.add(score, FHE.select(FHE.gte(passCount, FHE.asEuint8(2)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.gte(passCount, FHE.asEuint8(4)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.gte(passCount, FHE.asEuint8(6)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.gte(passCount, FHE.asEuint8(8)), FHE.asEuint8(1), FHE.asEuint8(0)));

        // --- ENCRYPTED RESULTS ---
        ebool finalResult = FHE.and(ageOk, diabetesOk);
        finalResult = FHE.and(finalResult, hbOk);
        finalResult = FHE.and(finalResult, genderOk);
        finalResult = FHE.and(finalResult, heightOk);
        finalResult = FHE.and(finalResult, weightOk);
        finalResult = FHE.and(finalResult, smokingOk);
        finalResult = FHE.and(finalResult, bpOk);

        FHE.allowThis(finalResult);
        FHE.allow(finalResult, _patient);
        FHE.allowThis(score);
        FHE.allow(score, _patient);

        encryptedResults[_patient][_trialId] = finalResult;
        encryptedScores[_patient][_trialId] = score;
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.ELIGIBILITY_CHECKED,
                _trialId,
                keccak256(abi.encodePacked(_patient, block.timestamp))
            );
        }

        emit EligibilityComputed(_patient, _trialId);
        emit EligibilityScoreComputed(_patient, _trialId);
        
        return finalResult;
    }

    /**
     * @notice Patient applies to the trial after computing 100% eligibility
     */
    function applyToTrial(uint256 _trialId) external {
        require(applications[_trialId][msg.sender].status == ApplicationStatus.None, "Already applied");
        // Note: score verification happens on the frontend for UX, 
        // but we record the application here.
        
        applications[_trialId][msg.sender].status = ApplicationStatus.Pending;
        trialAppliedPatients[_trialId].push(msg.sender);
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.APPLICATION_STATUS_CHANGED,
                _trialId,
                keccak256(abi.encodePacked(msg.sender, "APPLIED", block.timestamp))
            );
        }

        emit AppliedToTrial(msg.sender, _trialId);
    }

    /**
     * @notice Sponsor updates application status and provides an encrypted message/contact info
     */
    function updateApplicationStatus(
        uint256 _trialId, 
        address _patient, 
        ApplicationStatus _status, 
        bytes calldata _message
    ) external {
        TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
        require(msg.sender == trial.sponsor, "Only sponsor can update status");
        require(applications[_trialId][_patient].status != ApplicationStatus.None, "No application found");
        
        applications[_trialId][_patient].status = _status;
        applications[_trialId][_patient].encryptedMessage = _message;
        
        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.APPLICATION_STATUS_CHANGED,
                _trialId,
                keccak256(abi.encodePacked(_patient, uint8(_status), block.timestamp))
            );
        }

        emit ApplicationStatusUpdated(_patient, _trialId, _status, _message);
    }

    function getEncryptedResult(address _patient, uint256 _trialId) external view returns (ebool) {
        require(msg.sender == _patient || msg.sender == automationContract, "Access denied");
        return encryptedResults[_patient][_trialId];
    }

    function getEncryptedScore(address _patient, uint256 _trialId) external view returns (euint8) {
        require(msg.sender == _patient || msg.sender == automationContract, "Access denied");
        return encryptedScores[_patient][_trialId];
    }
}
