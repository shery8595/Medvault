import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Shield, Key, Cpu, Database, AlertTriangle, CheckCircle2 } from "lucide-react";

const encryptionFlowChart = `
sequenceDiagram
    participant U as User Interface
    participant SDK as @cofhe/sdk SDK
    participant MM as MetaMask
    participant RPC as Fhenix RPC
    participant C as Smart Contract

    U->>SDK: createInstance({ chainId })
    SDK->>RPC: Fetch Network FHE Public Key
    RPC-->>SDK: networkPublicKey (bytes)
    Note over SDK: Instance Ready (isFHEReady = true)

    U->>SDK: createEncryptedInput(contract, user)
    SDK->>SDK: .add32(age).add32(weight).encrypt()
    Note over SDK: Generates FHE ciphertexts + ZK input proof
    SDK-->>U: { handles[], inputProof }

    U->>MM: Sign transaction with encrypted handles
    MM-->>U: Approved
    U->>C: contract.updatePatientInfo(handles, inputProof)
    C->>C: Validate inputProof (on-chain)
    C->>C: Store ciphertext handles in state
`;

const sdkMethods = [
    { method: "createInstance({ chainId })", returns: "FhevmInstance", desc: "Fetches the network public key and returns an initialized client instance. Must be called once per session." },
    { method: "instance.createEncryptedInput(contract, user)", returns: "EncryptedInput", desc: "Returns a builder scoped to a specific contract address and user address. The ZK proof is bound to this scope." },
    { method: "input.add8(val)", returns: "EncryptedInput", desc: "Adds an encrypted uint8 (0–255) to the input batch." },
    { method: "input.add16(val)", returns: "EncryptedInput", desc: "Adds an encrypted uint16 to the input batch." },
    { method: "input.add32(val)", returns: "EncryptedInput", desc: "Adds an encrypted uint32 to the batch. Used for most MedVault health metrics." },
    { method: "input.addBool(val)", returns: "EncryptedInput", desc: "Adds an encrypted boolean. Used for binary flags." },
    { method: "input.encrypt()", returns: "{ handles[], inputProof }", desc: "Finalizes the batch, generates all FHE ciphertexts, and computes the ZK validity proof." },
    { method: "instance.generateToken({ contract... })", returns: "{ token, publicKey }", desc: "Generates an EIP-712 viewing token by requesting a MetaMask signature. Used to decrypt on-chain values." },
    { method: "instance.decrypt(contract, token, ciphertext)", returns: "bigint", desc: "Decrypts a single ciphertext using the viewing token. Requires prior FHE.allow() on-chain." },
];

const colorStyles: Record<string, { iconBg: string; iconText: string; cardBorder: string; cardBg: string }> = {
    teal: {
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconText: "text-blue-600 dark:text-blue-400",
        cardBorder: "border-blue-200 dark:border-blue-900/40",
        cardBg: "bg-blue-50/50 dark:bg-blue-950/10",
    },
    purple: {
        iconBg: "bg-purple-100 dark:bg-purple-900/30",
        iconText: "text-purple-600 dark:text-purple-400",
        cardBorder: "border-purple-200 dark:border-purple-900/40",
        cardBg: "bg-purple-50/50 dark:bg-purple-950/10",
    },
    amber: {
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconText: "text-amber-600 dark:text-amber-400",
        cardBorder: "border-amber-200 dark:border-amber-900/40",
        cardBg: "bg-amber-50/50 dark:bg-amber-950/10",
    },
};

export function ClientEncryptionDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-blue-500 font-bold tracking-widest uppercase text-xs">Integration</span>
                <h1 className="mt-2 text-5xl">Client-Side Encryption with <code>@cofhe/sdk</code></h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    The core security guarantee of MedVault is that <strong>raw medical data never leaves the browser unencrypted</strong>. The Fhenix <code>@cofhe/sdk</code> SDK performs all FHE ciphertext generation on the client, before any transaction is submitted to the network.
                </p>

                {/* Key Guarantees */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-10 not-prose">
                    {[
                        { icon: <Shield className="w-5 h-5" />, title: "Zero-Knowledge Proofs", desc: "Every encryption call generates a ZK validity proof submitted alongside the ciphertext.", color: "teal" },
                        { icon: <Key className="w-5 h-5" />, title: "EIP-712 Consent", desc: "Decryption requires a MetaMask signature—sponsor cannot read results without patient approval.", color: "purple" },
                        { icon: <Cpu className="w-5 h-5" />, title: "Coprocessor-Backed", desc: "The Fhenix network's FHE coprocessor performs all actual computation — the EVM never sees plaintext.", color: "amber" },
                    ].map(g => {
                        const styles = colorStyles[g.color];
                        return (
                        <div key={g.title} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <div className={`p-2 w-fit rounded-xl ${styles.iconBg} ${styles.iconText} mb-3`}>{g.icon}</div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{g.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{g.desc}</p>
                        </div>
                        );
                    })}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>I. Architecture of the <code>@cofhe/sdk</code> Client</h2>
                <p>
                    Standard Ethereum libraries like Ethers.js or viem are designed to format ABI-encoded payloads for RPC calls. <code>@cofhe/sdk</code> does something fundamentally different — it is a cryptographic library first, a blockchain connector second.
                </p>
                <p>
                    The library has two distinct responsibilities at runtime:
                </p>

                <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
                    <div className="p-5 rounded-2xl border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 border border-l-blue-500 border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">① Parameter Encryption</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Transforms plain integer form values (e.g., <code>42</code>, <code>180</code>) into full FHE ciphertexts capable of being passed as Solidity <code>euint32</code> or <code>euint16</code> types.</p>
                    </div>
                    <div className="p-5 rounded-2xl border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">② Viewing Key Management</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Generates and manages EIP-712-signed viewing tokens that allow the patient (and only the patient) to request decryption of their specific on-chain ciphertext mappings.</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8 mt-6">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">@cofhe/sdk Encryption & Decryption Lifecycle</h3>
                    <div className="text-slate-300 space-y-4">
                        <p>1. <strong>Frontend</strong> initializes @cofhe/sdk instance using the network's public key.</p>
                        <p>2. <strong>Frontend</strong> encrypts raw numbers into ciphertexts locally in the browser.</p>
                        <p>3. <strong>Frontend</strong> packages ciphertexts into a transaction and sends to blockchain.</p>
                        <p>4. <strong>Smart Contract</strong> processes ciphertexts homomorphically without ever decrypting.</p>
                        <p>5. <strong>Smart Contract</strong> calls ACL for selective decryption if required.</p>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>II. Instance Initialization</h2>
                <p>
                    Before any FHE interaction can occur, the DApp must initialize a <code>FhevmInstance</code>. This instance performs an async network request to retrieve the Fhenix testnet's public cryptographic key. Without this key, it is impossible to generate valid FHE ciphertexts.
                </p>

                <CodeBlock
                    filename="src/context/Web3Context.tsx — Initialization"
                    language="typescript"
                    code={`import { createInstance, FhevmInstance } from '@cofhe/sdk';
import { BrowserProvider } from 'ethers';

const initializeFHEVM = async (provider: BrowserProvider): Promise<FhevmInstance | null> => {
    try {
        const network = await provider.getNetwork();

        // Fetches the Fhenix network's FHE public key via an eth_call to the
        // precompile address. Returns a 2048-byte FHE bootstrapping key.
        const instance = await createInstance({
            chainId: Number(network.chainId),
            // networkUrl is optional — @cofhe/sdk derives it from the provider
        });

        console.log("[FHE] Instance initialized. FHE ready.");
        return instance;
    } catch (err) {
        console.error("[FHE] Initialization failed:", err);
        return null;
    }
};

// In the React context provider:
useEffect(() => {
    if (provider) {
        initializeFHEVM(provider).then(inst => {
            setFhevmInstance(inst);
            // Gate all sensitive views behind this flag
            setIsFHEReady(inst !== null);
        });
    }
}, [provider]);`}
                />

                <Callout type="warning" title="Chain Compatibility Gate">
                    If the user is connected to a chain that doesn't support the Fhenix FHE precompile (e.g., Ethereum mainnet, Polygon), <code>createInstance</code> will fail. MedVault enforces a strict <code>isFHEReady</code> flag in the global context. All sensitive dashboard views are wrapped in a check gate that blocks rendering until the FHE instance is valid.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>III. Encrypting Medical Payloads</h2>
                <p>
                    When the patient fills out their health profile form and clicks "Save to Vault", the form data is never passed directly to any contract function. Instead, the raw values are intercepted and routed through the <code>@cofhe/sdk</code> encryption pipeline.
                </p>

                <CodeBlock
                    filename="src/context/EncryptedDataContext.tsx — Encryption Flow"
                    language="typescript"
                    code={`const encryptAndRegisterPatient = async (formData: PatientFormData) => {
    if (!fhevmInstance || !contract || !userAddress) return;

    // 1. Parse raw values (never leave the browser as plaintext)
    const age    = parseInt(formData.age);
    const weight = parseInt(formData.weight);
    const hba1c  = parseInt(formData.hba1c); // e.g., 6.5 stored as 65

    // 2. Create an encrypted input batch scoped to the contract + user
    //    The ZK proof will be cryptographically bound to this contract
    //    address — the proof cannot be replayed against a different contract.
    const input = fhevmInstance.createEncryptedInput(
        PATIENT_REGISTRY_ADDRESS,
        userAddress
    );

    // 3. Chain the values via .add32() then call .encrypt() to finalize
    const encrypted = await input
        .add32(age)
        .add32(weight)
        .add32(hba1c)
        .encrypt();

    // encrypted.handles: array of ciphertext handles (bytes32 each)
    // encrypted.inputProof: the ZK proof for on-chain validation

    // 4. Submit the transaction — plaintext never hits the network
    const tx = await contract.updatePatientInfo(
        encrypted.handles[0],   // encAge (euint32)
        encrypted.handles[1],   // encWeight (euint32)
        encrypted.handles[2],   // encHba1c (euint32)
        encrypted.inputProof    // ZK proof validating all three handles
    );

    await tx.wait();
    console.log("[Vault] Patient info saved on-chain.");
};`}
                />

                <Callout type="tip" title="The Input Proof — Why It Matters">
                    The <code>inputProof</code> is a zero-knowledge argument proving that the ciphertext was constructed from a valid 32-bit integer — not garbage bytes crafted to confuse the FHE coprocessor. The <code>PatientRegistry</code> smart contract validates this proof on-chain before storing the handles. Without this check, a malicious actor could submit malformed ciphertexts that corrupt subsequent computation results in the <code>EligibilityEngine</code>.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>IV. <code>@cofhe/sdk</code> SDK Method Reference</h2>
                <p>The key methods used inside MedVault from the <code>@cofhe/sdk</code> SDK:</p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Method</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Returns</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sdkMethods.map((m, i) => (
                                    <tr key={m.method} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 text-xs align-top">{m.method}</td>
                                        <td className="px-4 py-3 font-mono text-purple-600 dark:text-purple-400 text-xs align-top whitespace-nowrap">{m.returns}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{m.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>V. The Hybrid State Model: Chain vs. LocalStorage</h2>
                <p>
                    Reading back encrypted values from the chain requires a MetaMask pop-up (EIP-712 signature) on every single page load. This would make MedVault completely unusable. To solve this, we implement a <strong>hybrid state strategy</strong>:
                </p>

                <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 text-white">
                        <div className="flex items-center gap-3 mb-4">
                            <Database className="w-5 h-5 text-blue-400" />
                            <span className="font-bold text-blue-400">Blockchain Layer</span>
                        </div>
                        <div className="text-sm text-slate-300 space-y-2">
                            <p>• <strong className="text-white">Source of truth for computation</strong> — the FHE engine reads ciphertexts from chain, never from local storage.</p>
                            <p>• Ciphertext handles stored permanently in <code className="text-blue-300">PatientRegistry</code> mappings.</p>
                            <p>• Decryption of results requires an on-chain EIP-712 token grant.</p>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950 to-slate-900 border border-blue-900 text-white">
                        <div className="flex items-center gap-3 mb-4">
                            <CheckCircle2 className="w-5 h-5 text-blue-400" />
                            <span className="font-bold text-blue-400">Browser localStorage Layer</span>
                        </div>
                        <div className="text-sm text-slate-300 space-y-2">
                            <p>• <strong className="text-white">Source of truth for UI rendering</strong> — the dashboard reads plaintext values from <code className="text-blue-300">localStorage</code> for seamless display.</p>
                            <p>• Populated once, after a successful on-chain vault update.</p>
                            <p>• Never used as input for any on-chain transaction. Purely presentational.</p>
                        </div>
                    </div>
                </div>

                <Callout type="tip" title="Security Note on localStorage">
                    Storing unencrypted medical data in <code>localStorage</code> is a deliberate UX trade-off for dashboard rendering only. It is not used for any privilege-sensitive operation (token generation, decryption, transaction signing). A future privacy hardening pass may replace this with session-storage with auto-expiry.
                </Callout>

            </Prose>
        </motion.div>
    );
}
