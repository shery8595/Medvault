# Hybrid document storage (IPFS + FHE + AES-256)

MedVault hybrid storage keeps **medical file bodies off-chain** (IPFS via Pinata) while binding **AES-256 keys** into the eligibility Noir proof and storing **FHE-wrapped key chunks** on `PatientDocumentStore`.

## Architecture

1. **Patient** encrypts file locally (`EncryptionService.encryptDocument`, AES-256-GCM).
2. Ciphertext JSON is pinned to **IPFS** (`pinToIpfs` or relayer `POST /relay/pin-document`).
3. After anonymous apply **stage**, patient calls `recordDocumentCid` with `wrapKeyForFhe` chunks.
4. **Finalize** (via trusted relayer `POST /relay/apply-finalize`) includes `documentBinding` in Noir public inputs (`has_document=1`, indices 17–24).
5. On **Accepted**, `EligibilityEngine` calls `authorizeSponsorOnAccept` (marks sponsor eligible; no `FHE.allow` until pull).
6. **Sponsor** calls `pullSponsorKeyAccess` on first view, then unwraps via EIP-712 `decryptForView`, fetches IPFS, decrypts locally.

## Deploy wiring

After deploying `PatientDocumentStore`:

1. `EligibilityEngine.scheduleAuthorizedReader(keccak256("patientDocumentStore"), storeAddr)` then `applyAuthorizedReader` after 2-day delay.
2. `PatientDocumentStore.setEligibilityEngine(engine)` (owner one-shot).
3. Update `src/lib/contracts/addresses.json` or set `VITE_PATIENT_DOCUMENT_STORE` for the frontend.
4. Run `npm run sync-abis` and `npm run sync-sdk-assets`.

## Environment

| Variable | Role |
|----------|------|
| `VITE_PINATA_API_KEY` / `VITE_PINATA_API_SECRET` | Browser-side Pinata pin |
| `PINATA_API_KEY` / `PINATA_API_SECRET` | Relayer `ipfs.cjs` fallback |
| `RELAYER_PIN_SECRET` | Optional Bearer auth for `/relay/pin-document` |
| `VITE_PATIENT_DOCUMENT_STORE` | Override contract address |
| `VITE_IPFS_GATEWAY` | IPFS fetch gateway (default Pinata) |

## AES key custody and rotation

Hybrid documents use **client-generated AES-256-GCM keys** that never appear on-chain in plaintext. Only FHE-wrapped key chunks (`euint64` × 4) are stored in `PatientDocumentStore`.

### Custody model

| Key material | Custodian | Storage | On-chain binding |
|--------------|-----------|---------|------------------|
| **AES-256 document key** | Patient browser (`EncryptionService.encryptDocument`) | Ephemeral in memory during upload; re-derived locally on decrypt | FHE-wrapped chunks + Noir `documentBinding` public inputs (indices 17–24) |
| **FHE unwrap capability** | Sponsor (after accept + pull) | Sponsor wallet decrypts chunks via EIP-712 `decryptForView` | `pullSponsorKeyAccess` → `FHE.allow` on key handles |
| **Pinata API keys** | Deployer / relayer operator | Server env (`PINATA_*`, `VITE_PINATA_*`) — **not** patient document keys | Used only to pin **ciphertext** JSON to IPFS |
| **IPFS CID** | Public content network | Pinata pin of encrypted payload | `cidHash` on `PatientDocumentStore` |

### Rotation procedure

1. **Patient atomic `revokeAccess`** (H-2 / P4): new AES key, re-encrypted file, new Pinata CID, and new FHE key chunks in **one** transaction. Emits `DocumentLegacyHandleRevoked` with **`oldCid`** for indexer unpin. `rotateDocument` / `updateDocumentKey` revert — use `revokeAccess` only.
2. **Trusted indexer attestation (P7)** — owner `setUnpinIndexer`; indexer `postIndexerHeartbeat` + Pinata unpin + `attestLegacyCidUnpinned`. On-chain cannot delete IPFS; attestation is an accountability signal. See [indexer/README.md](../indexer/README.md).
3. **Sponsor grant epoch**: `revokeAccess` bumps `documentEpoch`; sponsors with stale `sponsorGrantEpoch` cannot read updated records.
3. **Pinata credential rotation**: rotate `PINATA_API_KEY` / `PINATA_API_SECRET` (and browser `VITE_PINATA_*` if used) in the deployment secret store; old pins remain on IPFS until explicitly unpinned — ciphertext remains AES-protected.
4. **Forward-only limit**: fhEVM `FHE.allow` is irreversible; sponsors who already decrypted retain the AES key off-chain. Rotation blocks **future** reads, not copies already decrypted.

### Operational checklist

- [ ] Store Pinata credentials in a secrets manager (not committed to git)
- [ ] Restrict relayer `RELAYER_PIN_SECRET` when exposing `/relay/pin-document`
- [ ] Monitor `DocumentLegacyHandleRevoked` for automated unpin jobs (`@medvault/indexer` worker when `INDEXER_PRIVATE_KEY` + Pinata creds set)
- [ ] Owner `setUnpinIndexer` for production indexer wallet; verify `LegacyCidUnpinAttested` events
- [ ] Document sponsor off-chain plaintext retention in trial agreements (see [REGULATORY_POSTURE.md](./REGULATORY_POSTURE.md))

## Known limitation (forward-only revocation)

fhEVM `FHE.allow` is **irreversible** — sponsors who already decrypted the AES key retain it off-chain. Mitigation is **forward-only**:

1. **Atomic `revokeAccess`** bumps `documentEpoch` and rotates CID + FHE key; sponsor `getKeyForSponsor` / `getDocumentRecord` reverts when `sponsorGrantEpoch != documentEpoch` (or pull not completed).
2. Emits **`DocumentLegacyHandleRevoked`** with `oldCid` for indexer unpin + **`attestLegacyCidUnpinned`** (P7). fhEVM ACL on prior handles remains irrevocable.
3. **`rotateDocument`** / **`updateDocumentKey`** are **deprecated** — revert `Use revokeAccess`.
4. Already-decrypted IPFS payloads cannot be cryptographically un-decrypted; unpinned CIDs may still exist on other IPFS nodes.

## Frontend entry points

- `HybridDocumentUploader` on trial apply (`TrialCard`) and vault (`?trialId=`).
- `submitViaRelayer` auto-record + `documentBinding` when a pending upload exists (production finalize path).
- `SponsorDocumentPanel` on accepted anonymous matches.
