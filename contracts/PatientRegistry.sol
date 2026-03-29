// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16, InEuint8, InEbool, InEuint16} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./DataAccessLog.sol";

/**
 * @title PatientRegistry
 * @notice Stores expanded encrypted patient profiles for clinical trial eligibility
 */
contract PatientRegistry {
    struct Patient {
        euint8 age;
        ebool gender; // true = Male, false = Female
        euint16 weight; // in kg
        euint8 height; // in cm
        ebool hasDiabetes;
        euint16 hbLevel;
        ebool isSmoker;
        ebool hasHypertension;
        bool exists;
    }

    mapping(address => Patient) private patients;
    address public authorizedEngine;
    DataAccessLog public dataAccessLog;
    address public owner;

    event ProfileUpdated(address indexed patient, uint256 timestamp);

    constructor() {
        owner = msg.sender;
        authorizedEngine = msg.sender; 
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setAuthorizedEngine(address _engine) external onlyOwner {
        authorizedEngine = _engine;
    }

    function setDataAccessLog(address _log) external onlyOwner {
        dataAccessLog = DataAccessLog(_log);
    }

    /**
     * @notice Submit or update encrypted medical profile with expanded fields
     */
    function submitEncryptedProfile(
        InEuint8 calldata _age,
        InEbool calldata _gender,
        InEuint16 calldata _weight,
        InEuint8 calldata _height,
        InEbool calldata _hasDiabetes,
        InEuint16 calldata _hbLevel,
        InEbool calldata _isSmoker,
        InEbool calldata _hasHypertension
    ) external {
        euint8 age = FHE.asEuint8(_age);
        ebool gender = FHE.asEbool(_gender);
        euint16 weight = FHE.asEuint16(_weight);
        euint8 height = FHE.asEuint8(_height);
        ebool hasDiabetes = FHE.asEbool(_hasDiabetes);
        euint16 hbLevel = FHE.asEuint16(_hbLevel);
        ebool isSmoker = FHE.asEbool(_isSmoker);
        ebool hasHypertension = FHE.asEbool(_hasHypertension);

        // Allow contract to perform operations
        FHE.allowThis(age);
        FHE.allowThis(gender);
        FHE.allowThis(weight);
        FHE.allowThis(height);
        FHE.allowThis(hasDiabetes);
        FHE.allowThis(hbLevel);
        FHE.allowThis(isSmoker);
        FHE.allowThis(hasHypertension);

        // Allow patient to re-encrypt/decrypt their own results
        FHE.allow(age, msg.sender);
        FHE.allow(gender, msg.sender);
        FHE.allow(weight, msg.sender);
        FHE.allow(height, msg.sender);
        FHE.allow(hasDiabetes, msg.sender);
        FHE.allow(hbLevel, msg.sender);
        FHE.allow(isSmoker, msg.sender);
        FHE.allow(hasHypertension, msg.sender);

        // Automatically grant permissions to the authorized engine if set
        if (authorizedEngine != address(0)) {
            FHE.allow(age, authorizedEngine);
            FHE.allow(gender, authorizedEngine);
            FHE.allow(weight, authorizedEngine);
            FHE.allow(height, authorizedEngine);
            FHE.allow(hasDiabetes, authorizedEngine);
            FHE.allow(hbLevel, authorizedEngine);
            FHE.allow(isSmoker, authorizedEngine);
            FHE.allow(hasHypertension, authorizedEngine);
        }

        patients[msg.sender] = Patient({
            age: age,
            gender: gender,
            weight: weight,
            height: height,
            hasDiabetes: hasDiabetes,
            hbLevel: hbLevel,
            isSmoker: isSmoker,
            hasHypertension: hasHypertension,
            exists: true
        });

        if (address(dataAccessLog) != address(0)) {
            dataAccessLog.logAction(
                DataAccessLog.ActionType.PROFILE_SUBMISSION,
                0,
                keccak256(abi.encodePacked(msg.sender, block.timestamp))
            );
        }

        emit ProfileUpdated(msg.sender, block.timestamp);
    }

    /**
     * @notice Fetch patient profile. Restricted to the patient themselves or the authorized engine.
     * @dev Now non-view to allow FHE.allow calls for the engine.
     */
    function getPatient(address _patient) external returns (Patient memory) {
        require(msg.sender == _patient || msg.sender == authorizedEngine, "Access denied");
        
        Patient memory p = patients[_patient];
        
        // If the engine is requesting, ensure it has permissions (handles existing profiles)
        if (msg.sender == authorizedEngine && p.exists) {
            FHE.allow(p.age, authorizedEngine);
            FHE.allow(p.gender, authorizedEngine);
            FHE.allow(p.weight, authorizedEngine);
            FHE.allow(p.height, authorizedEngine);
            FHE.allow(p.hasDiabetes, authorizedEngine);
            FHE.allow(p.hbLevel, authorizedEngine);
            FHE.allow(p.isSmoker, authorizedEngine);
            FHE.allow(p.hasHypertension, authorizedEngine);
        }
        
        return p;
    }
}
