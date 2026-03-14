// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./EligibilityEngine.sol";
import "./ConsentManager.sol";
import "./TrialManager.sol";
import "./SponsorIncentiveVault.sol";

/**
 * @title MedVaultAutomation
 * @notice Automates clinical trial eligibility checks and trial finalization using Chainlink Automation
 * @dev Two task types:
 *   Type 0: Process queued eligibility checks (FHE computation)
 *   Type 1: Finalize expired trials (distribute rewards + deactivate)
 */
contract MedVaultAutomation is AutomationCompatibleInterface {
    EligibilityEngine public engine;
    ConsentManager public consentManager;
    TrialManager public trialManager;
    SponsorIncentiveVault public vault;

    struct PendingCheck {
        address patient;
        uint256 trialId;
    }

    PendingCheck[] public queue;
    mapping(address => mapping(uint256 => bool)) public enqueued;
    
    address public owner;
    
    // Track which trials have already been finalized to avoid re-processing
    mapping(uint256 => bool) public finalized;

    event AddedToQueue(address indexed patient, uint256 indexed trialId);
    event TrialFinalized(uint256 indexed trialId, bool distributed, bool deactivated);

    constructor(
        address _engine, 
        address _consentManager, 
        address _trialManager,
        address payable _vault
    ) {
        owner = msg.sender;
        engine = EligibilityEngine(_engine);
        consentManager = ConsentManager(_consentManager);
        trialManager = TrialManager(_trialManager);
        vault = SponsorIncentiveVault(_vault);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setVault(address payable _vault) external onlyOwner {
        vault = SponsorIncentiveVault(_vault);
    }

    /**
     * @notice Manually add to queue (can also be triggered by events)
     */
    function enqueue(address _patient, uint256 _trialId) external {
        require(consentManager.hasConsent(_patient, _trialId), "No consent");
        require(!enqueued[_patient][_trialId], "Already in queue");
        
        queue.push(PendingCheck({
            patient: _patient,
            trialId: _trialId
        }));
        enqueued[_patient][_trialId] = true;
        
        emit AddedToQueue(_patient, _trialId);
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        // 1. Scan all trials for expired ones that need finalization
        uint256 totalTrials = trialManager.trialCounter();
        for (uint256 i = 1; i < totalTrials; i++) {
            TrialManager.Trial memory trial = trialManager.getTrial(i);
            if (trial.active && trial.endTime > 0 && block.timestamp >= trial.endTime && !finalized[i]) {
                return (true, abi.encode(uint8(1), i)); // Type 1: Finalize
            }
        }

        // 2. Check for pending eligibility checks
        uint256 count = queue.length;
        if (count > 0) {
            for (uint256 i = 0; i < count; i++) {
                PendingCheck memory check = queue[i];
                if (consentManager.hasConsent(check.patient, check.trialId)) {
                    return (true, abi.encode(uint8(0), i)); // Type 0: Eligibility
                }
            }
        }
        
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        (uint8 taskType, uint256 indexOrId) = abi.decode(performData, (uint8, uint256));
        
        if (taskType == 1) {
            // ========== Finalize Trial (Task Type 1) ==========
            uint256 trialId = indexOrId;
            TrialManager.Trial memory trial = trialManager.getTrial(trialId);
            
            // Safety checks
            require(trial.active, "Trial not active");
            require(trial.endTime > 0 && block.timestamp >= trial.endTime, "Trial not expired");
            require(!finalized[trialId], "Already finalized");
            
            finalized[trialId] = true;
            
            // Step 1: Distribute incentive rewards (if pool exists and has participants)
            bool distributed = false;
            try vault.distribute(trialId) {
                distributed = true;
            } catch {
                // Distribution may fail if no pool funded or no participants — that's OK
            }
            
            // Step 2: Deactivate the trial on-chain
            bool deactivated = false;
            try trialManager.deactivateTrial(trialId) {
                deactivated = true;
            } catch {
                // Should not fail if automation is authorized, but handle gracefully
            }
            
            emit TrialFinalized(trialId, distributed, deactivated);
        } else {
            // ========== Eligibility Check (Task Type 0) ==========
            uint256 index = indexOrId;
            require(index < queue.length, "Invalid index");
            
            PendingCheck memory check = queue[index];
            queue[index] = queue[queue.length - 1];
            queue.pop();
            enqueued[check.patient][check.trialId] = false;

            if (consentManager.hasConsent(check.patient, check.trialId)) {
                engine.checkEligibility(check.patient, check.trialId);
            }
        }
    }
}
