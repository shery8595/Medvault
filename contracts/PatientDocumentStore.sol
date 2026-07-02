// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./TrialManager.sol";
import "./DataAccessLog.sol";
import {FheAclEpochLib} from "./lib/FheAclEpochLib.sol";

interface IEligibilityEnginePermit {
  function getDecryptPermitHolder(uint256 _nullifier, uint256 _trialId) external view returns (address);
}

interface IEligibilityEngineDocumentHook {
  function onDocumentRecorded(uint256 _trialId, uint256 _nullifier) external;
}

interface IEligibilityEngineCaller {
    function updateAnonymousApplicationStatus(
        uint256 _trialId,
        uint256 _nullifier,
        uint8 _status
    ) external;
}

/**
 * @title PatientDocumentStore
 * @notice Hybrid storage: IPFS CID + FHE-encrypted AES-256 key (4×euint64 chunks).
 * @dev Sponsor decrypt ACL is deferred to per-access `pullSponsorKeyAccess` after
 *      `authorizeSponsorOnAccept` marks eligibility on Accepted (H-2 / P4).
 */
contract PatientDocumentStore is ZamaEthereumConfig {
  uint256 private constant BN254_FIELD_ORDER =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

  bytes32 public constant DOC_SCHEMA_HASH = bytes32(
    uint256(keccak256("medvault.document.v1")) % BN254_FIELD_ORDER
  );

  struct DocumentRecord {
    string cid;
    bytes32 aesKeyCtHash;
    euint64 keyChunk0;
    euint64 keyChunk1;
    euint64 keyChunk2;
    euint64 keyChunk3;
    address patient;
    address authorizedSponsor;
    bool exists;
    bool revoked;
  }

  TrialManager public trialManager;
  address public eligibilityEngine;
  DataAccessLog public dataAccessLog;

  address public owner;
  address public pendingOwner;

  mapping(uint256 => mapping(uint256 => DocumentRecord)) private documents;

  /// @notice Per-document epoch; `revokeAccess` increments to invalidate prior sponsor grants.
  mapping(uint256 => mapping(uint256 => uint256)) private documentEpoch;

  /// @notice Epoch at which sponsor decrypt was granted (must match `documentEpoch` for sponsor reads).
  mapping(uint256 => mapping(uint256 => uint256)) private sponsorGrantEpoch;

  struct UnpinAttestation {
    address indexer;
    uint256 attestedAt;
    bool completed;
  }

  /// @dev MED-1 / P7: trusted off-chain indexers that attest IPFS unpin after `rotateDocument`.
  mapping(address => bool) public trustedUnpinIndexer;
  mapping(address => uint256) public indexerLastHeartbeat;
  mapping(uint256 => mapping(uint256 => mapping(bytes32 => UnpinAttestation))) public unpinAttestations;

  uint256 public constant INDEXER_HEARTBEAT_MAX_AGE = 7 days;

  FheAclEpochLib.EpochState private _aclEpoch;

  event DocumentRecorded(
    uint256 indexed nullifier,
    uint256 indexed trialId,
    bytes32 indexed cidHash,
    bytes32 patientBlinded
  );
  event SponsorAuthorized(uint256 indexed nullifier, uint256 indexed trialId, address sponsor);
  event SponsorKeyPulled(uint256 indexed nullifier, uint256 indexed trialId, address sponsor);
  event SponsorAuthorizeSkipped(uint256 indexed nullifier, uint256 indexed trialId);
  event AccessRevoked(uint256 indexed nullifier, uint256 indexed trialId, address patient);
  event DocumentKeyRotated(uint256 indexed nullifier, uint256 indexed trialId);
  event DocumentRotated(
    uint256 indexed nullifier,
    uint256 indexed trialId,
    bytes32 indexed newCidHash,
    bytes32 oldCidHash
  );
  event DocumentLegacyHandleRevoked(
    uint256 indexed nullifier,
    uint256 indexed trialId,
    bytes32 indexed oldCidHash,
    bytes32 oldKeyHandleHash0,
    bytes32 oldKeyHandleHash1,
    bytes32 oldKeyHandleHash2,
    bytes32 oldKeyHandleHash3,
    string oldCid
  );
  event UnpinIndexerSet(address indexed indexer, bool trusted);
  event IndexerHeartbeat(address indexed indexer, uint256 timestamp);
  event LegacyCidUnpinAttested(
    uint256 indexed nullifier,
    uint256 indexed trialId,
    bytes32 indexed oldCidHash,
    address indexer,
    string oldCid
  );
  event OwnershipProposed(address indexed proposedOwner);
  event OwnershipAccepted(address indexed newOwner);

  modifier onlyOwner() {
    require(msg.sender == owner, "Only owner");
    _;
  }

  modifier onlyEligibilityEngine() {
    require(msg.sender == eligibilityEngine, "Only eligibility engine");
    _;
  }

  constructor(address _trialManager) {
    require(_trialManager != address(0), "Zero address");
    owner = msg.sender;
    trialManager = TrialManager(_trialManager);
  }

  function proposeOwnership(address _newOwner) external onlyOwner {
    require(_newOwner != address(0), "Zero address");
    pendingOwner = _newOwner;
    emit OwnershipProposed(_newOwner);
  }

  function acceptOwnership() external {
    require(msg.sender == pendingOwner, "Not proposed owner");
    owner = pendingOwner;
    pendingOwner = address(0);
    emit OwnershipAccepted(owner);
  }

  function rotateTrustedContract(uint8 kind, address newConsumer) external onlyOwner {
    require(newConsumer != address(0), "Zero address");
    FheAclEpochLib.rotateKind(_aclEpoch, kind, newConsumer);
  }

  function aclEpochForKind(uint8 kind) external view returns (uint40) {
    return FheAclEpochLib.currentEpoch(_aclEpoch, kind);
  }

  function setEligibilityEngine(address _engine) external onlyOwner {
    require(_engine != address(0), "Zero address");
    eligibilityEngine = _engine;
  }

  function setDataAccessLog(address _log) external onlyOwner {
    dataAccessLog = DataAccessLog(_log);
  }

  /**
   * @notice Owner designates an off-chain indexer allowed to post unpin heartbeats/attestations (P7).
   */
  function setUnpinIndexer(address _indexer, bool _trusted) external onlyOwner {
    require(_indexer != address(0), "Zero address");
    trustedUnpinIndexer[_indexer] = _trusted;
    emit UnpinIndexerSet(_indexer, _trusted);
  }

  /**
   * @notice Trusted indexer liveness ping; required before `attestLegacyCidUnpinned`.
   */
  function postIndexerHeartbeat() external {
    require(trustedUnpinIndexer[msg.sender], "Not trusted indexer");
    indexerLastHeartbeat[msg.sender] = block.timestamp;
    emit IndexerHeartbeat(msg.sender, block.timestamp);
  }

  function isUnpinIndexerActive(address _indexer) external view returns (bool) {
    if (!trustedUnpinIndexer[_indexer]) return false;
    uint256 last = indexerLastHeartbeat[_indexer];
    if (last == 0) return false;
    return block.timestamp <= last + INDEXER_HEARTBEAT_MAX_AGE;
  }

  /**
   * @notice Trusted indexer attests that the legacy CID was unpinned off-chain after `rotateDocument`.
   * @dev On-chain cannot unpin IPFS; this is an accountability signal for ops/compliance monitors.
   */
  function attestLegacyCidUnpinned(
    uint256 _nullifier,
    uint256 _trialId,
    bytes32 _oldCidHash,
    string calldata _oldCid
  ) external {
    require(trustedUnpinIndexer[msg.sender], "Not trusted indexer");
    require(indexerLastHeartbeat[msg.sender] != 0, "Heartbeat required");
    require(
      block.timestamp <= indexerLastHeartbeat[msg.sender] + INDEXER_HEARTBEAT_MAX_AGE,
      "Indexer heartbeat stale"
    );
    require(keccak256(bytes(_oldCid)) == _oldCidHash, "CID hash mismatch");
    UnpinAttestation storage att = unpinAttestations[_nullifier][_trialId][_oldCidHash];
    require(!att.completed, "Already attested");

    att.indexer = msg.sender;
    att.attestedAt = block.timestamp;
    att.completed = true;

    emit LegacyCidUnpinAttested(_nullifier, _trialId, _oldCidHash, msg.sender, _oldCid);
  }

  modifier onlyDocumentReader(uint256 _nullifier, uint256 _trialId) {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    require(doc.exists, "No document");

    if (msg.sender == doc.patient || msg.sender == eligibilityEngine) {
      _;
      return;
    }

    uint256 grantEpoch = sponsorGrantEpoch[_nullifier][_trialId];
    uint256 currentEpoch = documentEpoch[_nullifier][_trialId];

    if (msg.sender == doc.authorizedSponsor) {
      require(grantEpoch != 0, "Pull key access first");
      require(grantEpoch == currentEpoch, "Access revoked");
      _;
      return;
    }

    address trialSponsor = trialManager.getTrial(_trialId).sponsor;
    if (msg.sender == trialSponsor) {
      require(grantEpoch != 0, "Pull key access first");
      require(grantEpoch == currentEpoch, "Access revoked");
      _;
      return;
    }

    revert("Not authorized reader");
  }

  /**
   * @notice Patient records an IPFS CID with FHE-wrapped AES key (permit-holder only).
   */
  function recordDocumentCid(
    uint256 _nullifier,
    uint256 _trialId,
    string calldata _cid,
    bytes32 _aesKeyCtHash,
    externalEuint64 _keyChunk0,
    externalEuint64 _keyChunk1,
    externalEuint64 _keyChunk2,
    externalEuint64 _keyChunk3,
    bytes calldata inputProof
  ) external {
    require(eligibilityEngine != address(0), "Engine not set");
    address permitHolder = IEligibilityEnginePermit(eligibilityEngine).getDecryptPermitHolder(
      _nullifier,
      _trialId
    );
    require(permitHolder != address(0) && msg.sender == permitHolder, "Not permit holder");
    require(bytes(_cid).length > 0, "Empty CID");
    require(_aesKeyCtHash != bytes32(0), "Empty AES ct hash");
    require(!documents[_nullifier][_trialId].exists, "Document already recorded");

    euint64 c0 = FHE.fromExternal(_keyChunk0, inputProof);
    euint64 c1 = FHE.fromExternal(_keyChunk1, inputProof);
    euint64 c2 = FHE.fromExternal(_keyChunk2, inputProof);
    euint64 c3 = FHE.fromExternal(_keyChunk3, inputProof);

    FHE.allowThis(c0);
    FHE.allowThis(c1);
    FHE.allowThis(c2);
    FHE.allowThis(c3);
    FHE.allow(c0, msg.sender);
    FHE.allow(c1, msg.sender);
    FHE.allow(c2, msg.sender);
    FHE.allow(c3, msg.sender);

    documents[_nullifier][_trialId] = DocumentRecord({
      cid: _cid,
      aesKeyCtHash: _aesKeyCtHash,
      keyChunk0: c0,
      keyChunk1: c1,
      keyChunk2: c2,
      keyChunk3: c3,
      patient: msg.sender,
      authorizedSponsor: address(0),
      exists: true,
      revoked: false
    });
    documentEpoch[_nullifier][_trialId] = 1;

    bytes32 cidHash = keccak256(bytes(_cid));
    bytes32 patientBlinded = keccak256(abi.encodePacked(msg.sender, _nullifier, _trialId));
    if (address(dataAccessLog) != address(0)) {
      dataAccessLog.logAction(
        DataAccessLog.ActionType.DOCUMENT_RECORDED,
        _trialId,
        keccak256(abi.encodePacked(_nullifier, cidHash, patientBlinded, block.timestamp))
      );
    }

    emit DocumentRecorded(_nullifier, _trialId, cidHash, patientBlinded);

    if (eligibilityEngine != address(0)) {
      try IEligibilityEngineDocumentHook(eligibilityEngine).onDocumentRecorded(_trialId, _nullifier) {} catch {}
    }
  }

  /**
   * @notice Mark sponsor eligible for per-access key pull on Accepted.
   * @dev Does NOT grant FHE.allow — sponsor must call `pullSponsorKeyAccess` to decrypt.
   */
  function authorizeSponsorOnAccept(uint256 _trialId, uint256 _nullifier) external onlyEligibilityEngine {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    require(doc.exists, "No document");
    require(!doc.revoked, "Access revoked");

    TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
    address sponsor = trial.sponsor;
    require(sponsor != address(0), "No sponsor");

    if (doc.authorizedSponsor == sponsor) {
      return;
    }

    doc.authorizedSponsor = sponsor;

    if (address(dataAccessLog) != address(0)) {
      dataAccessLog.logAction(
        DataAccessLog.ActionType.DOCUMENT_SPONSOR_AUTHORIZED,
        _trialId,
        keccak256(abi.encodePacked(_nullifier, sponsor, block.timestamp))
      );
    }

    emit SponsorAuthorized(_nullifier, _trialId, sponsor);
  }

  /**
   * @notice Sponsor pulls FHE decrypt ACL on first access (per-access grant).
   * @dev Patient may atomic-revoke+rotate before this call to block sponsor decrypt.
   */
  function pullSponsorKeyAccess(uint256 _nullifier, uint256 _trialId) external {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    require(doc.exists, "No document");
    require(!doc.revoked, "Access revoked");

    TrialManager.Trial memory trial = trialManager.getTrial(_trialId);
    address sponsor = trial.sponsor;
    require(sponsor != address(0), "No sponsor");
    require(msg.sender == sponsor, "Only sponsor");
    require(doc.authorizedSponsor == sponsor, "Sponsor not authorized");

    uint256 currentEpoch = documentEpoch[_nullifier][_trialId];
    if (sponsorGrantEpoch[_nullifier][_trialId] == currentEpoch) {
      return;
    }

    sponsorGrantEpoch[_nullifier][_trialId] = currentEpoch;

    FHE.allow(doc.keyChunk0, sponsor);
    FHE.allow(doc.keyChunk1, sponsor);
    FHE.allow(doc.keyChunk2, sponsor);
    FHE.allow(doc.keyChunk3, sponsor);
    FheAclEpochLib.recordGrant(_aclEpoch, euint64.unwrap(doc.keyChunk0), sponsor, uint8(FheAclEpochLib.GrantKind.DocumentStore));
    FheAclEpochLib.recordGrant(_aclEpoch, euint64.unwrap(doc.keyChunk1), sponsor, uint8(FheAclEpochLib.GrantKind.DocumentStore));
    FheAclEpochLib.recordGrant(_aclEpoch, euint64.unwrap(doc.keyChunk2), sponsor, uint8(FheAclEpochLib.GrantKind.DocumentStore));
    FheAclEpochLib.recordGrant(_aclEpoch, euint64.unwrap(doc.keyChunk3), sponsor, uint8(FheAclEpochLib.GrantKind.DocumentStore));

    if (address(dataAccessLog) != address(0)) {
      dataAccessLog.logAction(
        DataAccessLog.ActionType.DOCUMENT_SPONSOR_AUTHORIZED,
        _trialId,
        keccak256(abi.encodePacked(_nullifier, sponsor, block.timestamp, "pull"))
      );
    }

    emit SponsorKeyPulled(_nullifier, _trialId, sponsor);
  }

  /**
   * @notice Atomic revoke+rotate: patient re-keys and rotates IPFS CID in one transaction (H-2 / P4).
   * @dev FHE.allow on prior key handles is irrevocable on fhEVM. New CID + key chunks are required.
   *      Emits `DocumentLegacyHandleRevoked` so off-chain indexers can unpin the old CID.
   *      Contracts cannot revoke already-decrypted files — old IPFS CID must be unpinned off-chain.
   */
  function revokeAccess(
    uint256 _nullifier,
    uint256 _trialId,
    string calldata _newCid,
    bytes32 _newAesKeyCtHash,
    externalEuint64 _c0,
    externalEuint64 _c1,
    externalEuint64 _c2,
    externalEuint64 _c3,
    bytes calldata inputProof
  ) external {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    require(doc.exists, "No document");
    require(msg.sender == doc.patient, "Only patient");
    require(bytes(_newCid).length > 0, "Empty CID");
    require(_newAesKeyCtHash != bytes32(0), "Empty AES ct hash");
    require(keccak256(bytes(_newCid)) != keccak256(bytes(doc.cid)), "CID must change");

    bytes32 oldCidHash = keccak256(bytes(doc.cid));
    string memory oldCid = doc.cid;
    bytes32 oldKey0 = bytes32(uint256(euint64.unwrap(doc.keyChunk0)) % BN254_FIELD_ORDER);
    bytes32 oldKey1 = bytes32(uint256(euint64.unwrap(doc.keyChunk1)) % BN254_FIELD_ORDER);
    bytes32 oldKey2 = bytes32(uint256(euint64.unwrap(doc.keyChunk2)) % BN254_FIELD_ORDER);
    bytes32 oldKey3 = bytes32(uint256(euint64.unwrap(doc.keyChunk3)) % BN254_FIELD_ORDER);

    documentEpoch[_nullifier][_trialId]++;
    doc.authorizedSponsor = address(0);

    euint64 c0 = FHE.fromExternal(_c0, inputProof);
    euint64 c1 = FHE.fromExternal(_c1, inputProof);
    euint64 c2 = FHE.fromExternal(_c2, inputProof);
    euint64 c3 = FHE.fromExternal(_c3, inputProof);

    FHE.allowThis(c0);
    FHE.allowThis(c1);
    FHE.allowThis(c2);
    FHE.allowThis(c3);
    FHE.allow(c0, msg.sender);
    FHE.allow(c1, msg.sender);
    FHE.allow(c2, msg.sender);
    FHE.allow(c3, msg.sender);

    doc.cid = _newCid;
    doc.aesKeyCtHash = _newAesKeyCtHash;
    doc.keyChunk0 = c0;
    doc.keyChunk1 = c1;
    doc.keyChunk2 = c2;
    doc.keyChunk3 = c3;
    doc.revoked = false;

    if (address(dataAccessLog) != address(0)) {
      dataAccessLog.logAction(
        DataAccessLog.ActionType.DOCUMENT_ACCESS_REVOKED,
        _trialId,
        keccak256(abi.encodePacked(_nullifier, msg.sender, block.timestamp))
      );
    }

    emit AccessRevoked(_nullifier, _trialId, msg.sender);
    emit DocumentRotated(_nullifier, _trialId, keccak256(bytes(_newCid)), oldCidHash);
    emit DocumentLegacyHandleRevoked(
      _nullifier,
      _trialId,
      oldCidHash,
      oldKey0,
      oldKey1,
      oldKey2,
      oldKey3,
      oldCid
    );
    emit DocumentKeyRotated(_nullifier, _trialId);
  }

  /**
   * @notice Deprecated: use atomic `revokeAccess` with new CID + key chunks.
   */
  function updateDocumentKey(
    uint256 _nullifier,
    uint256 _trialId,
    externalEuint64 _c0,
    externalEuint64 _c1,
    externalEuint64 _c2,
    externalEuint64 _c3,
    bytes calldata inputProof
  ) external {
    _nullifier;
    _trialId;
    _c0;
    _c1;
    _c2;
    _c3;
    inputProof;
    revert("Use revokeAccess");
  }

  /**
   * @notice Deprecated: use atomic `revokeAccess` with new CID + key chunks.
   */
  function rotateDocument(
    uint256 _nullifier,
    uint256 _trialId,
    string calldata _newCid,
    bytes32 _newAesKeyCtHash,
    externalEuint64 _c0,
    externalEuint64 _c1,
    externalEuint64 _c2,
    externalEuint64 _c3,
    bytes calldata inputProof
  ) external {
    _nullifier;
    _trialId;
    _newCid;
    _newAesKeyCtHash;
    _c0;
    _c1;
    _c2;
    _c3;
    inputProof;
    revert("Use revokeAccess");
  }

  function getDocumentCid(uint256 _nullifier, uint256 _trialId)
    external
    view
    onlyDocumentReader(_nullifier, _trialId)
    returns (string memory)
  {
    return documents[_nullifier][_trialId].cid;
  }

  /// @notice Sponsor-facing key read; reverts when epoch gate blocks access or pull not completed.
  function getKeyForSponsor(uint256 _nullifier, uint256 _trialId)
    external
    view
    onlyDocumentReader(_nullifier, _trialId)
    returns (
      euint64 keyChunk0,
      euint64 keyChunk1,
      euint64 keyChunk2,
      euint64 keyChunk3
    )
  {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    return (doc.keyChunk0, doc.keyChunk1, doc.keyChunk2, doc.keyChunk3);
  }

  /// @notice EligibilityEngine-only binding read for attestation cross-check.
  function getDocumentBindingForEngine(
    uint256 _nullifier,
    uint256 _trialId
  )
    external
    view
    returns (
      bytes32 cidHash,
      bytes32 aesKeyCtHash,
      bytes32 keyHandleHash0,
      bytes32 keyHandleHash1,
      bytes32 keyHandleHash2,
      bytes32 keyHandleHash3,
      bool exists,
      bool revoked
    )
  {
    require(msg.sender == eligibilityEngine, "Only eligibility engine");
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    return (
      bytes32(uint256(keccak256(bytes(doc.cid))) % BN254_FIELD_ORDER),
      doc.aesKeyCtHash,
      bytes32(uint256(euint64.unwrap(doc.keyChunk0)) % BN254_FIELD_ORDER),
      bytes32(uint256(euint64.unwrap(doc.keyChunk1)) % BN254_FIELD_ORDER),
      bytes32(uint256(euint64.unwrap(doc.keyChunk2)) % BN254_FIELD_ORDER),
      bytes32(uint256(euint64.unwrap(doc.keyChunk3)) % BN254_FIELD_ORDER),
      doc.exists,
      doc.revoked
    );
  }

  function getDocumentRecord(
    uint256 _nullifier,
    uint256 _trialId
  )
    external
    view
    onlyDocumentReader(_nullifier, _trialId)
    returns (
      string memory cid,
      bytes32 aesKeyCtHash,
      euint64 keyChunk0,
      euint64 keyChunk1,
      euint64 keyChunk2,
      euint64 keyChunk3,
      address patient,
      address authorizedSponsor,
      bool exists,
      bool revoked
    )
  {
    DocumentRecord storage doc = documents[_nullifier][_trialId];
    return (
      doc.cid,
      doc.aesKeyCtHash,
      doc.keyChunk0,
      doc.keyChunk1,
      doc.keyChunk2,
      doc.keyChunk3,
      doc.patient,
      doc.authorizedSponsor,
      doc.exists,
      doc.revoked
    );
  }

  function documentExists(uint256 _nullifier, uint256 _trialId) external view returns (bool) {
    return documents[_nullifier][_trialId].exists;
  }
}
