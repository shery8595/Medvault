# MedVault — New Contracts to Build

> **Historical design — shipped (archived 2026-06-30).** The contracts proposed here (`TrialMilestoneManager`, `DataAccessLog`, `EncryptedConsentGate`) are **production code**. For current reference see [Smart Contracts](https://med-vault.xyz/docs/contracts), [`protocolContracts.ts`](../../src/lib/protocolContracts.ts), and [`docs/archive/README.md`](./README.md).

> Contracts that fill **real gaps** in the current clinical trial flow.

---

## What's Missing Today

| Gap | Problem |
|-----|---------|
| **No trial lifecycle after acceptance** | Patient gets accepted → then nothing. No milestones, no check-ins, no phased payouts. |
| **Audit trail is invisible** | No on-chain proof that data was accessed correctly. Regulators can't verify compliance. |
| **Consent is too basic** | One boolean per trial. No time limits, no data-category control, no granular revocation. |
| **No dispute mechanism** | Sponsor rejects a patient? Patient has zero recourse. No appeals, no arbitration. |

---

## Contract 1: `TrialMilestoneManager.sol`

**Why it matters:** Right now a trial is just "active" or "ended." Real trials have phases — screening, treatment, follow-up. Milestone tracking unlocks phased payouts from `SponsorIncentiveVault` instead of a single lump sum at end.

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "./TrialManager.sol";
import "./SponsorIncentiveVault.sol";

contract TrialMilestoneManager {
    struct Milestone {
        string name;              // "Screening Complete", "Week 4 Check-in", etc.
        uint256 deadline;         // Unix timestamp
        uint256 rewardBasisPoints; // e.g. 2500 = 25% of total pool
        bool completed;
    }

    struct ParticipantProgress {
        uint256 milestonesCompleted;
        uint256 lastCheckIn;
        bool withdrawn;           // Patient dropped out
    }

    TrialManager public trialManager;
    
    // trialId => milestones
    mapping(uint256 => Milestone[]) public milestones;
    // trialId => patient => progress
    mapping(uint256 => mapping(address => ParticipantProgress)) public progress;

    event MilestoneAdded(uint256 indexed trialId, uint256 index, string name, uint256 deadline);
    event MilestoneCompleted(uint256 indexed trialId, address indexed patient, uint256 milestoneIndex);
    event PatientWithdrawn(uint256 indexed trialId, address indexed patient);

    constructor(address _trialManager) {
        trialManager = TrialManager(_trialManager);
    }

    /// @notice Sponsor defines milestones when creating trial. Reward basis points must total 10000.
    function addMilestone(
        uint256 _trialId,
        string calldata _name,
        uint256 _deadline,
        uint256 _rewardBasisPoints
    ) external {
        require(trialManager.getTrial(_trialId).sponsor == msg.sender, "Only sponsor");
        milestones[_trialId].push(Milestone({
            name: _name,
            deadline: _deadline,
            rewardBasisPoints: _rewardBasisPoints,
            completed: false
        }));
        emit MilestoneAdded(_trialId, milestones[_trialId].length - 1, _name, _deadline);
    }

    /// @notice Sponsor confirms a patient completed a milestone → triggers partial payout
    function confirmMilestone(uint256 _trialId, address _patient, uint256 _milestoneIndex) external {
        require(trialManager.getTrial(_trialId).sponsor == msg.sender, "Only sponsor");
        require(_milestoneIndex < milestones[_trialId].length, "Invalid milestone");
        require(!progress[_trialId][_patient].withdrawn, "Patient withdrawn");

        progress[_trialId][_patient].milestonesCompleted++;
        progress[_trialId][_patient].lastCheckIn = block.timestamp;

        emit MilestoneCompleted(_trialId, _patient, _milestoneIndex);
    }

    /// @notice Patient voluntarily withdraws from trial
    function withdrawFromTrial(uint256 _trialId) external {
        progress[_trialId][msg.sender].withdrawn = true;
        emit PatientWithdrawn(_trialId, msg.sender);
    }

    function getMilestones(uint256 _trialId) external view returns (Milestone[] memory) {
        return milestones[_trialId];
    }

    function getProgress(address _patient, uint256 _trialId) external view returns (ParticipantProgress memory) {
        return progress[_trialId][_patient];
    }
}
```

**Wiring:**
- `TrialManager` — reads sponsor/trial info
- `SponsorIncentiveVault` — future: `distributePartial()` per milestone instead of all-at-once
- `MedVaultAutomation` — auto-check missed deadlines

---

## Contract 2: `DataAccessLog.sol`

**Why it matters:** MedVault handles encrypted medical data. Regulators (FDA, EMA) require proof of who accessed what and when. Without an audit trail, the entire privacy claim is unverifiable. This is also a strong differentiator vs competitors.

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

contract DataAccessLog {
    enum ActionType {
        PROFILE_SUBMITTED,     // Patient submitted/updated encrypted profile
        CONSENT_GRANTED,       // Patient granted consent for a trial
        CONSENT_REVOKED,       // Patient revoked consent
        ELIGIBILITY_CHECKED,   // FHE eligibility computation ran
        APPLICATION_SUBMITTED, // Patient applied to trial
        STATUS_UPDATED,        // Sponsor accepted/rejected patient
        INCENTIVE_DISTRIBUTED, // Rewards distributed
        DATA_ACCESSED          // Any party accessed patient data
    }

    struct LogEntry {
        bytes32 dataHash;      // keccak256(patient, action details) — anonymized
        ActionType action;
        uint256 trialId;
        address actor;         // Who triggered it (could be contract address)
        uint256 timestamp;
    }

    LogEntry[] public logs;
    mapping(address => bool) public authorizedLoggers;
    address public owner;

    event ActionLogged(uint256 indexed logIndex, ActionType indexed action, uint256 indexed trialId, address actor);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyAuthorized() {
        require(authorizedLoggers[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    function authorizeLogger(address _contract) external {
        require(msg.sender == owner, "Only owner");
        authorizedLoggers[_contract] = true;
    }

    /// @notice Called by other MedVault contracts on every state change
    function log(ActionType _action, uint256 _trialId, bytes32 _dataHash) external onlyAuthorized {
        uint256 idx = logs.length;
        logs.push(LogEntry({
            dataHash: _dataHash,
            action: _action,
            trialId: _trialId,
            actor: msg.sender,
            timestamp: block.timestamp
        }));
        emit ActionLogged(idx, _action, _trialId, msg.sender);
    }

    function getLogCount() external view returns (uint256) {
        return logs.length;
    }

    function getLog(uint256 _index) external view returns (LogEntry memory) {
        return logs[_index];
    }

    /// @notice Get all logs for a specific trial (for regulatory export)
    function getTrialLogs(uint256 _trialId) external view returns (LogEntry[] memory) {
        // Count first
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].trialId == _trialId) count++;
        }
        // Collect
        LogEntry[] memory result = new LogEntry[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].trialId == _trialId) {
                result[j++] = logs[i];
            }
        }
        return result;
    }
}
```

**Wiring:** Every existing contract gets a one-line addition on state changes:
```solidity
dataAccessLog.log(DataAccessLog.ActionType.ELIGIBILITY_CHECKED, _trialId, keccak256(abi.encodePacked(_patient, block.timestamp)));
```

---

## Contract 3: `EnhancedConsent.sol`

**Why it matters:** Current `ConsentManager` is a single `bool` per patient per trial. That doesn't cut it for real clinical trials. Patients need time-limited consent, category-specific consent (share vitals but not genetic data), and the ability to see their full consent history.

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

contract EnhancedConsent {
    enum DataCategory {
        VITALS,          // Age, height, weight
        CONDITIONS,      // Diabetes, hypertension
        LIFESTYLE,       // Smoking status
        LAB_RESULTS,     // HB level
        ALL              // Everything
    }

    struct ConsentRecord {
        bool granted;
        uint256 grantedAt;
        uint256 expiresAt;         // 0 = no expiry
        DataCategory[] categories; // Which data categories are shared
    }

    // patient => trialId => consent record
    mapping(address => mapping(uint256 => ConsentRecord)) public consents;
    // patient => list of trial IDs they've ever consented to
    mapping(address => uint256[]) public consentHistory;

    event ConsentGranted(address indexed patient, uint256 indexed trialId, uint256 expiresAt, DataCategory[] categories);
    event ConsentRevoked(address indexed patient, uint256 indexed trialId);
    event ConsentExpired(address indexed patient, uint256 indexed trialId);

    /// @notice Grant consent with expiry and category restrictions
    function grantConsent(
        uint256 _trialId,
        uint256 _duration,            // seconds, 0 = indefinite
        DataCategory[] calldata _categories
    ) external {
        require(_categories.length > 0, "Must specify at least one category");

        uint256 expiry = _duration > 0 ? block.timestamp + _duration : 0;

        consents[msg.sender][_trialId] = ConsentRecord({
            granted: true,
            grantedAt: block.timestamp,
            expiresAt: expiry,
            categories: _categories
        });

        consentHistory[msg.sender].push(_trialId);
        emit ConsentGranted(msg.sender, _trialId, expiry, _categories);
    }

    /// @notice Revoke consent immediately
    function revokeConsent(uint256 _trialId) external {
        consents[msg.sender][_trialId].granted = false;
        emit ConsentRevoked(msg.sender, _trialId);
    }

    /// @notice Check if consent is active (not revoked AND not expired)
    function hasConsent(address _patient, uint256 _trialId) public view returns (bool) {
        ConsentRecord storage c = consents[_patient][_trialId];
        if (!c.granted) return false;
        if (c.expiresAt > 0 && block.timestamp > c.expiresAt) return false;
        return true;
    }

    /// @notice Check if a specific data category is consented
    function hasCategoryConsent(address _patient, uint256 _trialId, DataCategory _cat) external view returns (bool) {
        if (!hasConsent(_patient, _trialId)) return false;

        ConsentRecord storage c = consents[_patient][_trialId];
        for (uint256 i = 0; i < c.categories.length; i++) {
            if (c.categories[i] == _cat || c.categories[i] == DataCategory.ALL) return true;
        }
        return false;
    }

    /// @notice Get full consent history for a patient
    function getConsentHistory(address _patient) external view returns (uint256[] memory) {
        return consentHistory[_patient];
    }
}
```

**Wiring:** Replaces current `ConsentManager` in the `EligibilityEngine` constructor. The `hasConsent(address, uint256)` signature is backward compatible.

---

## Contract 4: `DisputeResolution.sol`

**Why it matters:** A sponsor can reject a patient with a one-line hex message and zero accountability. Patients need a way to dispute unfair rejections. This adds fairness and builds trust in the platform.

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "./EligibilityEngine.sol";
import "./TrialManager.sol";

contract DisputeResolution {
    enum DisputeStatus { OPEN, UNDER_REVIEW, RESOLVED_FOR_PATIENT, RESOLVED_FOR_SPONSOR, DISMISSED }

    struct Dispute {
        address patient;
        uint256 trialId;
        string reason;              // Patient's stated reason for dispute
        string sponsorResponse;     // Sponsor's counter-argument
        DisputeStatus status;
        uint256 filedAt;
        uint256 resolvedAt;
        address resolver;           // Admin/DAO who resolved it
    }

    EligibilityEngine public engine;
    TrialManager public trialManager;

    Dispute[] public disputes;
    mapping(address => mapping(uint256 => uint256)) public disputeIndex; // patient => trialId => disputeId+1
    address public arbiter; // Platform admin or DAO multisig

    event DisputeFiled(uint256 indexed disputeId, address indexed patient, uint256 indexed trialId);
    event SponsorResponded(uint256 indexed disputeId);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus outcome);

    constructor(address _engine, address _trialManager, address _arbiter) {
        engine = EligibilityEngine(_engine);
        trialManager = TrialManager(_trialManager);
        arbiter = _arbiter;
    }

    /// @notice Patient files a dispute against a rejection
    function fileDispute(uint256 _trialId, string calldata _reason) external {
        (EligibilityEngine.ApplicationStatus status, ) = engine.applications(_trialId, msg.sender);
        require(status == EligibilityEngine.ApplicationStatus.Rejected, "Can only dispute rejections");
        require(disputeIndex[msg.sender][_trialId] == 0, "Dispute already filed");

        uint256 id = disputes.length;
        disputes.push(Dispute({
            patient: msg.sender,
            trialId: _trialId,
            reason: _reason,
            sponsorResponse: "",
            status: DisputeStatus.OPEN,
            filedAt: block.timestamp,
            resolvedAt: 0,
            resolver: address(0)
        }));
        disputeIndex[msg.sender][_trialId] = id + 1;

        emit DisputeFiled(id, msg.sender, _trialId);
    }

    /// @notice Sponsor responds to the dispute
    function respondToDispute(uint256 _disputeId, string calldata _response) external {
        Dispute storage d = disputes[_disputeId];
        require(trialManager.getTrial(d.trialId).sponsor == msg.sender, "Only trial sponsor");
        require(d.status == DisputeStatus.OPEN, "Not open");

        d.sponsorResponse = _response;
        d.status = DisputeStatus.UNDER_REVIEW;

        emit SponsorResponded(_disputeId);
    }

    /// @notice Arbiter resolves the dispute
    function resolveDispute(uint256 _disputeId, DisputeStatus _outcome) external {
        require(msg.sender == arbiter, "Only arbiter");
        require(
            _outcome == DisputeStatus.RESOLVED_FOR_PATIENT ||
            _outcome == DisputeStatus.RESOLVED_FOR_SPONSOR ||
            _outcome == DisputeStatus.DISMISSED,
            "Invalid outcome"
        );

        Dispute storage d = disputes[_disputeId];
        d.status = _outcome;
        d.resolvedAt = block.timestamp;
        d.resolver = msg.sender;

        emit DisputeResolved(_disputeId, _outcome);
    }

    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        return disputes[_disputeId];
    }

    function getDisputeCount() external view returns (uint256) {
        return disputes.length;
    }
}
```

**Wiring:**
- `EligibilityEngine` — reads application status
- `TrialManager` — verifies sponsor identity
- If resolved for patient → sponsor can call `engine.updateApplicationStatus()` to flip to Accepted

---

## Deploy Order

Add to `scripts/deploy.ts` **after** existing contracts:

```typescript
// 8. Deploy EnhancedConsent (replaces ConsentManager)
// 9. Deploy DataAccessLog
// 10. Deploy TrialMilestoneManager(trialManagerAddress)
// 11. Deploy DisputeResolution(engineAddress, trialManagerAddress, deployerAddress)

// Post-deployment:
// - Authorize all contracts as loggers on DataAccessLog
// - Point EligibilityEngine to EnhancedConsent (if replacing ConsentManager)
// - Set MedVaultAutomation as authorized on TrialMilestoneManager
```

---

## Priority

| Order | Contract | Why First |
|:-----:|----------|-----------|
| 1 | `DataAccessLog` | Zero dependencies, easy to wire into existing contracts, huge compliance value |
| 2 | `EnhancedConsent` | Drop-in replacement for `ConsentManager`, backward compatible |
| 3 | `TrialMilestoneManager` | Makes trials feel complete instead of accept → lump payout |
| 4 | `DisputeResolution` | Adds fairness layer, needs `EligibilityEngine` to exist first |
