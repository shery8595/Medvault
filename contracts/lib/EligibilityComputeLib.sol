// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, ebool, euint16} from "@fhevm/solidity/lib/FHE.sol";

/// @notice Shared eligibility FHE compute — linked library to keep EligibilityEngine under EIP-170.
library EligibilityComputeLib {
    struct EncryptedPatient {
        euint8 age;
        ebool gender;
        euint16 weight;
        euint8 height;
        ebool hasDiabetes;
        euint16 hbLevel;
        ebool isSmoker;
        ebool hasHypertension;
        bytes32 profileCommitment;
        bool exists;
    }

    struct Trial {
        string name;
        string phase;
        string location;
        string compensation;
        address sponsor;
        bool active;
        uint8 minAge;
        uint8 maxAge;
        bool requiresDiabetes;
        uint16 minHb;
        uint8 genderRequirement;
        uint8 minHeight;
        uint16 maxWeight;
        bool requiresNonSmoker;
        bool requiresNormalBP;
        uint256 endTime;
        bool encryptedCriteria;
    }

    struct EncryptedCriteria {
        euint8 minAge;
        euint8 maxAge;
        ebool requiresDiabetes;
        euint16 minHb;
        euint8 genderRequirement;
        euint8 minHeight;
        euint16 maxWeight;
        ebool requiresNonSmoker;
        ebool requiresNormalBP;
    }

    function genderOkPlaintext(ebool patientGender, uint8 genderRequirement) public returns (ebool) {
        if (genderRequirement == 1) {
            return FHE.eq(patientGender, FHE.asEbool(true));
        }
        if (genderRequirement == 2) {
            return FHE.eq(patientGender, FHE.asEbool(false));
        }
        return FHE.asEbool(true);
    }

    function genderOkEncrypted(ebool patientGender, euint8 genderRequirementCt) public returns (ebool) {
        FHE.allowThis(genderRequirementCt);
        ebool reqMale = FHE.eq(genderRequirementCt, FHE.asEuint8(1));
        ebool reqFemale = FHE.eq(genderRequirementCt, FHE.asEuint8(2));
        ebool maleOk = FHE.eq(patientGender, FHE.asEbool(true));
        ebool femaleOk = FHE.eq(patientGender, FHE.asEbool(false));
        ebool anyOk = FHE.asEbool(true);
        return FHE.select(reqMale, maleOk, FHE.select(reqFemale, femaleOk, anyOk));
    }

    function scoreAndCombine(
        ebool ageOk,
        ebool diabetesOk,
        ebool hbOk,
        ebool genderOk,
        ebool heightOk,
        ebool weightOk,
        ebool smokingOk,
        ebool bpOk
    ) public returns (ebool finalResult, euint8 score) {
        euint8 passCount = FHE.asEuint8(0);
        passCount = FHE.add(passCount, FHE.select(ageOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(diabetesOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(hbOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(genderOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(heightOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(weightOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(smokingOk, FHE.asEuint8(1), FHE.asEuint8(0)));
        passCount = FHE.add(passCount, FHE.select(bpOk, FHE.asEuint8(1), FHE.asEuint8(0)));

        score = FHE.mul(passCount, FHE.asEuint8(12));
        score = FHE.add(score, FHE.select(FHE.ge(passCount, FHE.asEuint8(2)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.ge(passCount, FHE.asEuint8(4)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.ge(passCount, FHE.asEuint8(6)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.add(score, FHE.select(FHE.ge(passCount, FHE.asEuint8(8)), FHE.asEuint8(1), FHE.asEuint8(0)));
        score = FHE.select(FHE.le(score, FHE.asEuint8(100)), score, FHE.asEuint8(100));

        finalResult = FHE.and(ageOk, diabetesOk);
        finalResult = FHE.and(finalResult, hbOk);
        finalResult = FHE.and(finalResult, genderOk);
        finalResult = FHE.and(finalResult, heightOk);
        finalResult = FHE.and(finalResult, weightOk);
        finalResult = FHE.and(finalResult, smokingOk);
        finalResult = FHE.and(finalResult, bpOk);
    }

    function computeEligibilityPlaintext(
        EncryptedPatient memory patient,
        Trial memory trial
    ) public returns (ebool finalResult, euint8 score) {
        ebool ageOk = (trial.minAge == 0 && trial.maxAge == 0)
            ? FHE.asEbool(true)
            : FHE.and(
                FHE.ge(patient.age, FHE.asEuint8(trial.minAge)),
                FHE.le(patient.age, FHE.asEuint8(trial.maxAge))
            );

        ebool diabetesOk = trial.requiresDiabetes
            ? FHE.eq(patient.hasDiabetes, FHE.asEbool(true))
            : FHE.asEbool(true);

        ebool hbOk = FHE.ge(patient.hbLevel, FHE.asEuint16(trial.minHb));
        ebool genderOk = genderOkPlaintext(patient.gender, trial.genderRequirement);
        ebool heightOk = trial.minHeight > 0
            ? FHE.ge(patient.height, FHE.asEuint8(trial.minHeight))
            : FHE.asEbool(true);
        ebool weightOk = trial.maxWeight > 0
            ? FHE.le(patient.weight, FHE.asEuint16(trial.maxWeight))
            : FHE.asEbool(true);
        ebool smokingOk = trial.requiresNonSmoker
            ? FHE.eq(patient.isSmoker, FHE.asEbool(false))
            : FHE.asEbool(true);
        ebool bpOk = trial.requiresNormalBP
            ? FHE.eq(patient.hasHypertension, FHE.asEbool(false))
            : FHE.asEbool(true);

        (finalResult, score) = scoreAndCombine(
            ageOk,
            diabetesOk,
            hbOk,
            genderOk,
            heightOk,
            weightOk,
            smokingOk,
            bpOk
        );
    }

    function computeEligibilityEncrypted(
        EncryptedPatient memory patient,
        EncryptedCriteria memory c,
        bool refreshCriteriaAcl
    ) public returns (ebool finalResult, euint8 score) {
        if (refreshCriteriaAcl) {
            FHE.allowThis(c.minAge);
            FHE.allowThis(c.maxAge);
            FHE.allowThis(c.requiresDiabetes);
            FHE.allowThis(c.minHb);
            FHE.allowThis(c.genderRequirement);
            FHE.allowThis(c.minHeight);
            FHE.allowThis(c.maxWeight);
            FHE.allowThis(c.requiresNonSmoker);
            FHE.allowThis(c.requiresNormalBP);
        }

        ebool ageOk = FHE.and(FHE.ge(patient.age, c.minAge), FHE.le(patient.age, c.maxAge));
        ebool diabetesOk = FHE.or(
            FHE.not(c.requiresDiabetes),
            FHE.eq(patient.hasDiabetes, FHE.asEbool(true))
        );
        ebool hbOk = FHE.ge(patient.hbLevel, c.minHb);
        ebool genderOk = genderOkEncrypted(patient.gender, c.genderRequirement);
        ebool heightOk = FHE.ge(patient.height, c.minHeight);
        ebool weightOk = FHE.le(patient.weight, c.maxWeight);
        ebool smokingOk = FHE.or(
            FHE.not(c.requiresNonSmoker),
            FHE.eq(patient.isSmoker, FHE.asEbool(false))
        );
        ebool bpOk = FHE.or(
            FHE.not(c.requiresNormalBP),
            FHE.eq(patient.hasHypertension, FHE.asEbool(false))
        );

        (finalResult, score) = scoreAndCombine(
            ageOk,
            diabetesOk,
            hbOk,
            genderOk,
            heightOk,
            weightOk,
            smokingOk,
            bpOk
        );
    }
}
