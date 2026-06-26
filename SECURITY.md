# MedVault Security Notes

## Noir-FHE Integrity Gap

MedVault combines **Zama FHE** (on-chain encrypted eligibility computation) with **Noir ZK** (compliance attestation that binds Semaphore identity, profile commitment, and the staged FHE result handle). This is a deliberate split of responsibilities:

- **FHE engine** (`EligibilityEngine`) is the **compute authority** for eligibility on encrypted patient data and trial criteria.
- **Noir circuit** (`circuits/eligibility_proof`) is the **attestation seal** that proves the prover knows the plaintext witness matching their registered profile commitment and the locally decrypted FHE result, without revealing PHI on-chain.

### Known limitation

The Noir circuit does **not** cryptographically verify that FHE homomorphic operations were executed correctly inside the fhEVM coprocessor. A malicious client that bypasses the official frontend could attempt to supply a dishonest `decrypted_eligible` witness in encrypted-criteria mode (`criteria_mode = 1`).

### Mitigations in place

1. **Profile commitment binding** — `_verifyEligibilityProofCore` requires `publicInputs[2]` to match `AnonymousPatientRegistry.getProfileCommitment(commitment)` when finalizing applications.
2. **FHE stage handle binding** — `publicInputs[5]` must equal the persisted on-chain `ebool` ciphertext handle (`finalCt`) from staging; the circuit asserts the prover knows this handle as a private witness.
3. **Encrypted criteria echo binding** — For encrypted-criteria trials, `publicInputs[7]` must equal `keccak256(abi.encode(9 FHE criteria handles)) mod BN254`, and the circuit asserts the prover echoed that binding hash. The contract independently recomputes the hash from the real encrypted criteria stored in `TrialManager`.
4. **Registration gate** — `SponsorIncentiveVault.registerAnonymousParticipant*` requires `eligibilityEngine.noirVerifiedResults(nullifier, trialId)` so pool enrollment follows a sealed attestation.
5. **Sponsor acceptance** — Anonymous participants must be explicitly accepted by the trial sponsor before registration or distribution.

### Operational guidance

- Treat the **frontend + relayer** as part of the trusted computing base for patient-facing flows.
- Regenerate and redeploy `HonkVerifier.sol` after any circuit change (`npm run build:circuit`).
- FHE remains authoritative for eligibility math; Noir provides identity and policy-binding evidence, not a full FHE-in-ZK proof today.
