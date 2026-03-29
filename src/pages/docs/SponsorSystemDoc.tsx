import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";

const consentFlowChart = `
sequenceDiagram
    participant P as Patient Wallet
    participant D as DApp (fhevmjs)
    participant Z as Fhenix Network
    participant S as Sponsor

    P->>D: Trigger "Reveal Result"
    D->>P: Request EIP-712 Signature
    P-->>D: Signed Permission Token
    D->>Z: Request Decryption (token, context)
    
    rect rgb(20, 20, 30)
        Note over Z: Validator Threshold Decryption
        Z->>Z: Verify EIP712 Signature
        Z->>Z: Pull euint32 Score Mapping
    end

    Z-->>D: Decrypted int32 Score
    D->>D: Render Matching Status
    
    Note over P, S: Optional identity reveal to Sponsor
`;

export function SponsorSystemDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Smart Contracts</span>
                <h1 className="mt-2 text-5xl">Sponsor Verification Flow</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-12 max-w-prose">
                    To prevent Sybil attacks and ensure that clinical trials are only published by legally authorized pharmaceutical organizations, MedVault employs a strict, admin-gated `SponsorRegistry`.
                </p>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>The Sybil Vulnerability in Healthcare</h2>
                <p>
                    In a completely permissionless system, malicious actors could flood the fhEVM with thousands of fake clinical trials designed to "mine" or deduce patient data by setting extreme parameter bounds. Because Fhenix FHE operations require heavy computational resources, defending the computation layer is paramount.
                </p>

                <h2>The Verification Flow</h2>
                <p>
                    By default, any wallet connecting to the "Sponsor Portal" on MedVault has strictly read-only access. The "Create Trial" capabilities are entirely locked.
                </p>

                <ol className="space-y-4 my-8 pb-8 border-b border-slate-200 dark:border-slate-800">
                    <li><strong>Off-Chain KYC:</strong> A research institution submits their organizational details, wallet address, and credentials to the MedVault protocol admins off-chain.</li>
                    <li><strong>On-Chain Authorization:</strong> The protocol owner (typically a Multisig wallet) executes the <code>addSponsor(address, string name)</code> transaction on the <code>SponsorRegistry</code> contract.</li>
                    <li><strong>Indexing:</strong> The Subgraph detects the <code>SponsorAdded</code> event and indexes the mapped address.</li>
                    <li><strong>UI Unlocking:</strong> The frontend DApp reads the user's wallet address against the GraphQL endpoint and dynamically mounts the "Create Trial" and "Analytics" views.</li>
                </ol>

                <div className="bg-slate-800/50 p-6 mt-6 rounded-xl border border-slate-700/50 mb-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">Cryptographic Consent & Decryption Flow</h3>
                    <div className="text-slate-300 space-y-4">
                        <p>1. <strong>Sponsor</strong> requests access to patient profile</p>
                        <p>2. <strong>Patient</strong> receives notification and generates re-encryption key via KMS</p>
                        <p>3. <strong>Patient</strong> approves, sending key to KMS with Sponsor's target public key</p>
                        <p>4. <strong>KMS</strong> re-encrypts FHE ciphertexts to Sponsor's key</p>
                        <p>5. <strong>Sponsor</strong> downloads re-encrypted ciphertexts and decrypts locally</p>
                    </div>
                </div>

                <CodeBlock
                    filename="SponsorRegistry.sol (Ownership)"
                    language="solidity"
                    code={`import "@openzeppelin/contracts/access/Ownable.sol";

contract SponsorRegistry is Ownable {
    mapping(address => bool) public verifiedSponsors;
    mapping(address => string) public sponsorNames;

    event SponsorAdded(address indexed sponsor, string name);
    event SponsorRemoved(address indexed sponsor);

    // Initialized with the deployer as an admin
    constructor() Ownable(msg.sender) {}

    function addSponsor(address _sponsor, string memory _name) external onlyOwner {
        require(_sponsor != address(0), "Invalid address");
        require(!verifiedSponsors[_sponsor], "Sponsor already added");

        verifiedSponsors[_sponsor] = true;
        sponsorNames[_sponsor] = _name;
        
        emit SponsorAdded(_sponsor, _name);
    }

    function isVerifiedSponsor(address _sponsor) external view returns (bool) {
        return verifiedSponsors[_sponsor];
    }
}`}
                />

                <Callout type="tip" title="Decoupled Authorization">
                    The <code>TrialManager</code> contract holds an interface to the <code>SponsorRegistry</code>. Maintaining these as separate contracts allows MedVault admins to upgrade the Trial Logic independently of the existing list of verified sponsors, preventing the need to re-KYC hundreds of institutions during a V2 migration.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>Consent Architecture Deep Dive</h2>
                <p>
                    The consent flow in MedVault is not a simple boolean toggle. It is a <strong>cryptographic re-encryption protocol</strong> that ensures the sponsor can only view the patient's profile if the patient explicitly authorizes it via a signed Ethereum transaction. Here is the detailed flow:
                </p>

                <ol className="space-y-4 my-8">
                    <li><strong>Post-Match Notification:</strong> After the <code>EligibilityEngine</code> computes a score, the patient views their result by generating an EIP-712 viewing key. If the score is satisfactory (typically 100 = perfect match), the UI presents a "Grant Access to Sponsor" button.</li>
                    <li><strong>On-Chain Consent Record:</strong> The patient calls <code>ConsentManager.grantConsent(sponsorAddress, trialId)</code>. This stores a consent record scoped to the specific <code>(patient, sponsor, trialId)</code> tuple and emits a <code>ConsentGranted</code> event for the subgraph to index.</li>
                    <li><strong>Re-Encryption via KMS:</strong> With consent on-chain, the sponsor can request re-encryption of the patient's ciphertext handles through the Fhenix KMS. The KMS verifies: (a) the consent record exists on-chain, (b) the requesting address matches the authorized sponsor, and (c) the consent has not been revoked.</li>
                    <li><strong>Sponsor-Side Decryption:</strong> The KMS re-encrypts the patient's FHE ciphertexts using the sponsor's public key. The sponsor downloads these re-encrypted blobs and decrypts locally. The blockchain never sees the plaintext values.</li>
                    <li><strong>Revocation:</strong> At any time, the patient can call <code>revokeConsent(sponsor, trialId)</code>. This immediately invalidates the consent record on-chain. Future re-encryption requests from that sponsor will be rejected by the KMS. Previously decrypted data cannot be "un-decrypted," but no new data access is possible.</li>
                </ol>

                <Callout type="warning" title="Consent Scope Isolation">
                    Consent is always scoped to a specific <code>(patient, sponsor, trialId)</code> triple. Granting consent for Trial #1 does <strong>not</strong> give the sponsor access to the patient's data for Trial #2 or any other trial. Each consent grant is an independent, auditable on-chain transaction logged in <code>DataAccessLog</code>.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>Emergency Procedures</h2>
                <p>
                    MedVault includes emergency mechanisms to handle critical security incidents involving sponsor accounts:
                </p>

                <ul>
                    <li><strong>Sponsor Key Compromise:</strong> If a sponsor's private key is compromised, the protocol admin can immediately call <code>emergencyRemoveSponsor(address)</code> on the <code>SponsorRegistry</code>. This revokes the sponsor's verified status, preventing them from creating new trials. Existing trials remain viewable but new applications are frozen.</li>
                    <li><strong>Trial Halt:</strong> Any active trial can be deactivated by its owning sponsor or the protocol admin via <code>TrialManager.deactivateTrial(trialId)</code>. This sets the trial's <code>active</code> flag to <code>false</code>, which prevents new <code>computeEligibility()</code> calls from executing.</li>
                    <li><strong>Consent Auto-Expiry (Planned):</strong> In a future upgrade, consent tokens will include time-locked expiration. After the trial period ends, consent automatically revokes without requiring patient action.</li>
                </ul>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>Multi-Sponsor Governance Model</h2>
                <p>
                    The <code>SponsorRegistry</code> is owned by a single admin address. In a production deployment, this would be a multisig wallet (e.g., Gnosis Safe) requiring N-of-M signatures from protocol governors to add or remove sponsors. This prevents any single actor from unilaterally adding a malicious sponsor. The governance model includes:
                </p>
                <ul>
                    <li><strong>Off-chain KYC verification</strong> before any on-chain sponsor addition</li>
                    <li><strong>Multi-signature approval</strong> via Gnosis Safe for all <code>addSponsor()</code> calls</li>
                    <li><strong>Time-locked removal</strong> for non-emergency sponsor deauthorization</li>
                    <li><strong>Subgraph-indexed sponsor events</strong> for full transparency of the authorization history</li>
                </ul>

            </Prose>
        </motion.div>
    );
}
