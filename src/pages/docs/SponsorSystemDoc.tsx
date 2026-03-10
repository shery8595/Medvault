import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";

const consentFlowChart = `
sequenceDiagram
    participant P as Patient Wallet
    participant D as DApp (fhevmjs)
    participant Z as Zama Network
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
                    In a completely permissionless system, malicious actors could flood the fhEVM with thousands of fake clinical trials designed to "mine" or deduce patient data by setting extreme parameter bounds. Because Zama FHE operations require heavy computational resources, defending the computation layer is paramount.
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
                    The `TrialManager` contract holds an interface to the `SponsorRegistry`. Maintaining these as separate contracts allows MedVault admins to upgrade the Trial Logic independently of the existing list of verified sponsors, preventing the need to re-KYC hundreds of institutions during a V2 migration.
                </Callout>

            </Prose>
        </motion.div>
    );
}
