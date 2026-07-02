# P5 RegConsistency-B — SDK capability finding

**Date:** 2026-07-02  
**Owner:** Protocol + Zama SDK liaison  
**Status:** **Complete — answer is NO**  
**Gates:** [p5_regconsistency_a_registration_binding.plan.md](../.cursor/plans/p5_regconsistency_a_registration_binding.plan.md) **blocked**

## Question

> Does the current fhEVM SDK expose an **authenticated binding** between a **plaintext witness** and a **stored ciphertext handle**, sufficient for verification in both **Noir** and **Solidity**?

## Answer: **No**

RegConsistency-A (registration consistency binding circuit) must **not** be implemented on current Zama tooling. Patients may self-report encrypted PHI that is internally inconsistent with their `profileCommitment`; the commitment remains an **identity anchor only** (per P1).

---

## Investigation summary

Sources: Zama Protocol docs (encrypted inputs, oracle/`FHE.checkSignatures`), Zama community forum (coprocessor attestation flow), MedVault codebase (`@zama-fhe/sdk` ^3.2.0, `@fhevm/solidity` ^0.11.1), and existing Noir circuits.

### What the SDK *does* provide

| Mechanism | Layer | What it proves | What it does *not* prove |
|-----------|-------|----------------|--------------------------|
| `sdk.encrypt` → `inputProof` + `FHE.fromExternal` | Solidity (ingress) | User knows plaintext *P*; ciphertext is well-formed; coprocessor attestation matches handles for this contract/user ([Zama encrypted inputs](https://docs.zama.org/protocol/solidity-guides/smart-contract/inputs)) | Plaintext *P* equals fields in `profileCommitment`; binding after storage; composability with Noir |
| `FHE.checkSignatures(handles, cleartexts, decryptionProof)` | Solidity (post-storage) | KMS attests cleartext *P* decrypts from handle *H* ([Zama oracle](https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle)) | Privacy-preserving verification — requires **`publicDecrypt`**, which reveals cleartext on-chain |
| `sdk.decryption.decryptValues` (user decrypt) | Off-chain only | ACL-gated local decrypt for UI/relayer | No on-chain `decryptionProof` suitable for `FHE.checkSignatures`; cleartext never verified on-chain |
| Noir `profile_commitment` witness (plaintext circuit) | Noir | Prover knows plaintext fields hashing to commitment | Same plaintext was used in FHE encryption |
| Noir handle-hash witness (`eligibility_encrypted`) | Noir | Prover knows staged handle as private witness | Plaintext behind handle; fhEVM execution correctness |

### Registration gap (MedVault-specific)

`AnonymousPatientRegistry.registerPatient` accepts:

1. `profileCommitment` — Poseidon hash of plaintext profile + salt (computed off-chain).
2. Eight FHE handles + one shared `inputProof` — validated independently via `FHE.fromExternal`.

There is **no shared proof object** linking (1) and (2). A malicious client can submit `profileCommitment = Poseidon(profileA)` with ciphertexts encrypting `profileB`; both pass their respective checks. Frontend (`registerPatientWithHealthData` in `src/lib/semaphore.ts`) uses the same `profilePlain` for both paths in the honest flow, but that is **client trust**, not cryptography.

### Why Noir + Solidity joint verification is unavailable

1. **Input ZKPoK is Zama-native, not Noir-composable.** The `inputProof` is a coprocessor-verified ZKPoK produced via Gateway `verifyProofRequest` → attestation signatures consumed by `fromExternal`. It is not exposed as a verifiable public input or sub-circuit for UltraHonk/Noir composition.

2. **`FHE.checkSignatures` is the only on-chain plaintext↔handle verifier**, and it is tied to **public** KMS decrypt. Using it at registration would publish patient age, Hb, flags, etc. on-chain — unacceptable for PHI and incompatible with MedVault's confidentiality model. MedVault already deferred this pattern for eligibility attestation ([SECURITY.md](../SECURITY.md#noir-fhe-integrity-gap), [FHE_AUDIT_README.md](./FHE_AUDIT_README.md)).

3. **Handle non-determinism at the client** (documented in [ATOMIC_FLOWS.md](./ATOMIC_FLOWS.md)) prevents pre-computing registration handles for a single-tx ZK bind; post-storage binding would still require public decrypt or a future Zama API.

4. **No documented SDK API** (v3.2.0) exports a dual-use proof verifiable in Noir *and* Solidity that ties a Poseidon commitment witness to persisted `euint*` handles without cleartext revelation.

Zama docs describe input proofs as proving "the user knows the plaintext value" — not as a cross-layer commitment-binding primitive for third-party ZK stacks.

---

## Decision

| Outcome | Action |
|---------|--------|
| **Yes** | Document API + proof format → proceed to RegConsistency-A |
| **No** ✓ | **RegConsistency-A blocked.** Document residual trust assumption below. |

---

## Residual trust assumption (for SECURITY.md / threat model)

**Registration consistency is not cryptographically enforced.**

- At registration, fhEVM validates that encrypted fields are well-formed ciphertexts of *some* plaintext the submitter knows (`inputProof` / `fromExternal`).
- `profileCommitment` is stored as an independent field with no on-chain link to those ciphertexts.
- A patient can register with consistent-but-false PHI (e.g. age 25 in both commitment and ciphertext while real age is 80).
- **Consistency ≠ truth.** Even a future binding would only prove internal alignment, not clinical accuracy.
- Closing the truth gap requires an external authority (verified clinician attestation at registration) — out of scope for P5.

**Operational mitigation (existing):** honest-client assumption on wallet/relayer registration UX; `profileSaltCommitment` (MED-1) prevents deterministic salt replay; eligibility math operates on stored ciphertext regardless of commitment alignment.

---

## References

- Zama — [Encrypted inputs](https://docs.zama.org/protocol/solidity-guides/smart-contract/inputs)
- Zama — [Oracle / `FHE.checkSignatures`](https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle)
- Zama — [Encrypt & decrypt SDK guide](https://docs.zama.org/protocol/sdk/guides/encrypt-decrypt)
- Zama forum — [Ciphertext validity / `verifyProofRequest` flow](https://community.zama.org/t/how-does-verify-user-submitted-ciphertext-validity/4251)
- MedVault — `contracts/AnonymousPatientRegistry.sol` (`registerPatient`, `FHE.fromExternal`)
- MedVault — `circuits/eligibility_encrypted/src/main.nr` (handle-hash binding only)
- MedVault — `test-support/profileCommitment.ts` (Poseidon commitment scheme)

## Done when

- [x] Binary answer recorded (**NO**)
- [x] RegConsistency-A explicitly blocked
- [x] Residual trust text added to [SECURITY.md](../SECURITY.md)
