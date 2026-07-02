// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SponsorRegistry
 * @notice Maintains an allowlist of verified clinical trial sponsors with encrypted institutional data
 * @dev Zama FHE UPGRADE: Institutional identifiers are now stored as euint64 on-chain.
 *      The encryptedData field (raw bytes) is replaced with proper Zama FHE encrypted types
 *      so verification can happen on-chain via FHE operations.
 */
contract SponsorRegistry is ZamaEthereumConfig {
    enum RequestStatus { None, Pending, Approved, Rejected }

    struct SponsorshipRequest {
        euint64 encryptedInstitutionId; // Zama FHE: Encrypted institutional identifier (e.g., hospital ID, license number)
        RequestStatus status;
        uint256 requestedAt;
        bool hasEncryptedData;
    }

    struct Sponsor {
        string name;
        bool verified;
        uint256 addedAt;
        euint64 encryptedInstitutionId; // Zama FHE: Link to encrypted institutional data
    }

    mapping(address => Sponsor) public sponsors;
    mapping(address => SponsorshipRequest) public requests;

    // Zama FHE: Encrypted institutional identifiers by sponsor address
    mapping(address => euint64) private encryptedSponsorIds;

    address public owner;
    address public pendingOwner; // MED-2: Two-step ownership transfer
    /// @notice Off-chain attestation role: read-only access to encrypted institution IDs
    ///         (`getEncryptedInstitutionId`, `getRequestEncryptedId`). Set via timelocked
    ///         `scheduleAuditor` / `applyAuditor`; distinct from contract owner.
    address public auditor;
    address public pendingAuditor;
    uint256 public auditorChangeEta;
    uint256 public constant READER_CHANGE_DELAY = 6 hours;

    event SponsorAdded(address indexed sponsor, string name);
    event SponsorRemoved(address indexed sponsor);
    event SponsorshipRequested(address indexed applicant, euint64 encryptedInstitutionId);
    event SponsorshipRequestResolved(address indexed applicant, RequestStatus status);
    event OwnershipProposed(address indexed proposedOwner);
    event OwnershipAccepted(address indexed newOwner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @notice MED-2: Propose a new owner (two-step ownership transfer)
     */
    function proposeOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        pendingOwner = _newOwner;
        emit OwnershipProposed(_newOwner);
    }

    /**
     * @notice MED-2: Accept ownership (must be called by proposed owner)
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not proposed owner");
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipAccepted(owner);
    }

    /// @notice Schedule a new auditor address (6h timelock before `applyAuditor`).
    /// @dev Auditor may decrypt encrypted institution IDs for compliance review; not a sponsor admin.
    function scheduleAuditor(address _auditor) external onlyOwner {
        require(_auditor != address(0), "Zero auditor");
        pendingAuditor = _auditor;
        auditorChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    /// @notice Apply the pending auditor after `READER_CHANGE_DELAY` has elapsed.
    function applyAuditor() external onlyOwner {
        require(auditorChangeEta != 0 && block.timestamp >= auditorChangeEta, "Timelock active");
        auditor = pendingAuditor;
        auditorChangeEta = 0;
        pendingAuditor = address(0);
    }

    /**
     * @notice Submit an encrypted sponsorship request with Zama FHE encrypted institutional ID
     * @param _encryptedInstitutionId Encrypted institutional identifier (e.g., hospital ID, license number)
     */
    function requestSponsorship(externalEuint64 _encryptedInstitutionId, bytes calldata inputProof) external {
        // AUDIT-HIGH: previously rejected applicants were permanently locked out.
        // Allow re-application if prior request was Rejected (or never made).
        // Still block if Pending or Approved.
        RequestStatus prev = requests[msg.sender].status;
        require(
            prev == RequestStatus.None || prev == RequestStatus.Rejected,
            "Request already exists"
        );
        // Also block if already a verified sponsor.
        require(!sponsors[msg.sender].verified, "Already verified sponsor");

        euint64 encId = FHE.fromExternal(_encryptedInstitutionId, inputProof);
        FHE.allowThis(encId);
        FHE.allow(encId, msg.sender);
        // Institution IDs are not granted to owner by default — use a separate auditor role off-chain.

        requests[msg.sender] = SponsorshipRequest({
            encryptedInstitutionId: encId,
            status: RequestStatus.Pending,
            requestedAt: block.timestamp,
            hasEncryptedData: true
        });

        emit SponsorshipRequested(msg.sender, encId);
    }

    /**
     * @notice Add a verified sponsor to the registry and resolve any pending request
     * @param _sponsor The sponsor address
     * @param _name The sponsor name
     * @dev Zama FHE: Preserves encrypted institution ID from request if available
     */
    function addSponsor(address _sponsor, string calldata _name) external onlyOwner {
        require(bytes(_name).length > 0, "Name required");
        require(!sponsors[_sponsor].verified, "Already verified");
        require(
            requests[_sponsor].status == RequestStatus.Pending ||
                requests[_sponsor].status == RequestStatus.Approved,
            "No pending sponsorship request"
        );

        euint64 encId;
        if (requests[_sponsor].hasEncryptedData) {
            encId = requests[_sponsor].encryptedInstitutionId;
        } else {
            encId = FHE.asEuint64(0); // Default if no encrypted data
            FHE.allowThis(encId);
        }

        sponsors[_sponsor] = Sponsor({
            name: _name,
            verified: true,
            addedAt: block.timestamp,
            encryptedInstitutionId: encId
        });

        encryptedSponsorIds[_sponsor] = encId;

        if (requests[_sponsor].status == RequestStatus.Pending) {
            requests[_sponsor].status = RequestStatus.Approved;
            emit SponsorshipRequestResolved(_sponsor, RequestStatus.Approved);
        }

        emit SponsorAdded(_sponsor, _name);
    }

    /**
     * @notice Remove a sponsor from the registry
     */
    function removeSponsor(address _sponsor) external onlyOwner {
        delete sponsors[_sponsor];
        encryptedSponsorIds[_sponsor] = FHE.asEuint64(0);
        FHE.allowThis(encryptedSponsorIds[_sponsor]);
        delete requests[_sponsor];
        emit SponsorRemoved(_sponsor);
    }

    /**
     * @notice Check if an address is a verified sponsor
     * @dev MED-2: Removed owner shortcut. Owner must explicitly be added as sponsor if needed.
     */
    function isVerifiedSponsor(address _sponsor) external view returns (bool) {
        return sponsors[_sponsor].verified;
    }

    /**
     * @notice Zama FHE: Get encrypted institutional identifier for a sponsor
     * @param _sponsor The sponsor address
     * @return The encrypted institution ID (euint64)
     */
    function getEncryptedInstitutionId(address _sponsor) external view returns (euint64) {
        require(msg.sender == _sponsor || msg.sender == owner || msg.sender == auditor, "Not authorized");
        return encryptedSponsorIds[_sponsor];
    }

    /**
     * @notice Zama FHE: Get encrypted institutional ID from a sponsor request
     * @param _applicant The applicant address
     * @return The encrypted institution ID from their request
     */
    function getRequestEncryptedId(address _applicant) external view returns (euint64) {
        require(
            msg.sender == _applicant || msg.sender == owner || msg.sender == auditor,
            "Not authorized"
        );
        return requests[_applicant].encryptedInstitutionId;
    }

    /**
     * @notice Reject a sponsorship request
     */
    function rejectSponsorship(address _applicant) external onlyOwner {
        require(requests[_applicant].status == RequestStatus.Pending, "No pending request");
        requests[_applicant].status = RequestStatus.Rejected;
        emit SponsorshipRequestResolved(_applicant, RequestStatus.Rejected);
    }

}
