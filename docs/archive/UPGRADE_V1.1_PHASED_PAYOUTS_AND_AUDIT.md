# MedVault V1.1 Upgrade: Phased Payouts & Regulatory Audit Trail

> **Historical design — shipped (archived 2026-06-30).** `TrialMilestoneManager` and `DataAccessLog` ship in production. Current docs: [Smart Contracts](https://med-vault.xyz/docs/contracts), [ZERO_REVELATION_REWARDS.md](../ZERO_REVELATION_REWARDS.md), [`docs/archive/README.md`](./README.md).

This document outlines the proposed architecture for the V1.1 upgrade of MedVault. The goal is to move beyond "all-or-nothing" trial completions and introduce enterprise-grade observability.

## 1. Multi-Phase Trial Management (`TrialMilestoneManager.sol`)

### Problem
Professional clinical trials (Phase I-IV) don't pay participants only at the very end. They use milestones (e.g., "Screening", "Week 4", "Final Check") to maintain retention and provide immediate incentives.

### Solution
Introduce a milestone tracking layer that allowing sponsors to:
- Define up to 4 distinct phases per trial.
- Assign "Basis Points" (percentage) of the total incentive pool to each phase.
- Trigger partial payouts directly to the patient's `ConfidentialETH` balance upon milestone confirmation.

### Key Logic
- **`Milestone` struct**: Includes name, deadline, and reward weight.
- **`ParticipantProgress`**: Tracks how many milestones an individual has cleared.
- **Wiring**:
    - `SponsorIncentiveVault` must be updated to support `distributePartial()`.
    - `TrialMilestoneManager` acts as the authority for progress.

---

## 2. Regulatory Compliance Audit Trail (`DataAccessLog.sol`)

### Problem
For a health-tech dApp to be taken seriously by the FDA or EMA, "Security through Obscurity" isn't enough. We need **"Attested Privacy"** — proof that data was only accessed by authorized actors.

### Solution
A centralized, immutable logging contract that records every sensitive state change in the MedVault ecosystem.

### Logic
- **`ActionType` ENUM**: Covers submissions, consents, eligibility checks, and status changes.
- **Anonymized Hashes**: We log `keccak256(patient, details)` so we can prove a specific patient was handled without revealing their address in the public log title.
- **Authorized Loggers**: Only official MedVault contracts (Registry, Engine, Vault) are allowed to push logs.

### Example Integration
When an eligibility check runs:
```solidity
dataAccessLog.log(
    DataAccessLog.ActionType.ELIGIBILITY_CHECKED, 
    _trialId, 
    keccak256(abi.encodePacked(_patient, block.timestamp))
);
```

---

## 3. Implementation Roadmap

### Phase A: Core Contracts
- Deploy `DataAccessLog.sol`.
- Deploy `TrialMilestoneManager.sol`.
- Authorize existing contracts to log to `DataAccessLog`.

### Phase B: Vault Evolution
- Upgrade/Modify `SponsorIncentiveVault` to handle partial releases of the funded ETH.

### Phase C: Frontend & Subgraph
- Update Subgraph to index milestones and logs.
- Add "Trial Progress" UI for patients.
- Add "Milestone Management" UI for sponsors.
