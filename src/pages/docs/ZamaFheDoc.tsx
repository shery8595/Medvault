import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "../../lib/zamaChain";

/** Zama FHE integration overview (`/docs/zama-fhe`). */
export function ZamaFheDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
                    MedVault runs on <strong>Ethereum Sepolia</strong> (chain ID{" "}
                    <code>{ETHEREUM_SEPOLIA_CHAIN_ID}</code>) and uses the{" "}
                    <strong>Zama FHE</strong> stack: encrypted Solidity types, a coprocessor for homomorphic
                    operations, and <code>@zama-fhe/sdk</code> in the browser for encryption and user decryption.
                </p>

                <Callout type="info" title="Related docs">
                    <Link to="/docs/fhe-primitives" className="font-semibold text-[#00685f] hover:underline">
                        FHE primitives
                    </Link>{" "}
                    for <code>euint32</code> / <code>FHE.cmux</code>,{" "}
                    <Link to="/docs/client-encryption" className="font-semibold text-[#00685f] hover:underline">
                        Client encryption
                    </Link>{" "}
                    for SDK API details,{" "}
                    <Link to="/docs/testing/infrastructure" className="font-semibold text-[#00685f] hover:underline">
                        Test infrastructure
                    </Link>{" "}
                    for Hardhat FHE mocks.
                </Callout>

                <h2>Architecture</h2>
                <div className="not-prose rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm my-6 space-y-2">
                    <p className="m-0">
                        <strong className="text-slate-800">1. Browser</strong> —{" "}
                        <code>@zama-fhe/sdk</code> encrypts health metrics; proofs are bound to the contract and user
                        address passed to <code>sdk.encrypt()</code>.
                    </p>
                    <p className="m-0">
                        <strong className="text-slate-800">2. EVM (Ethereum Sepolia)</strong> — Contracts store
                        ciphertext handles and enforce ACL via <code>FHE.allow</code> /{" "}
                        <code>FHE.allowThis</code>.
                    </p>
                    <p className="m-0">
                        <strong className="text-slate-800">3. Zama coprocessor</strong> — Homomorphic add/compare/cmux
                        off-chain; chain state stays encrypted.
                    </p>
                    <p className="m-0">
                        <strong className="text-slate-800">4. Decrypt</strong> — ACL-approved addresses decrypt locally
                        via the SDK (plaintext never written to chain state).
                    </p>
                </div>

                <h2>Packages</h2>
                <div className="not-prose overflow-hidden rounded-xl border border-slate-200 text-sm my-6">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold">Package</th>
                                <th className="text-left px-3 py-2 font-bold">Used for</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["@fhevm/solidity", "Solidity: FHE.sol, euint*, external inputs"],
                                ["@zama-fhe/sdk", "Browser: encrypt, userDecrypt, relayer integration"],
                                ["@fhevm/hardhat-plugin", "Tests: hre.fhevm mocks, publicDecrypt"],
                                ["@zama-fhe/relayer-sdk", "Relayer + Hardhat encrypted-input helpers"],
                            ].map(([pkg, use], i) => (
                                <tr key={pkg} className={i % 2 ? "bg-slate-50/50" : "bg-white"}>
                                    <td className="px-3 py-2 font-mono text-[10px] text-[#00685f]">{pkg}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{use}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Frontend client (<code>src/lib/fhe.ts</code>)</h2>
                <p className="text-sm">
                    <code>ZamaSDKProvider</code> initializes the main SDK after Privy connects. Relayer URL defaults to
                    same-origin <code>/api/relayer/{ETHEREUM_SEPOLIA_CHAIN_ID}</code> (see{" "}
                    <code>src/lib/zamaChain.ts</code>).
                </p>
                <CodeBlock
                    language="typescript"
                    filename="Zama SDK encrypt (simplified)"
                    code={`import { createConfig, ZamaSDK } from "@zama-fhe/sdk";
import { createConfig as createEthersConfig } from "@zama-fhe/sdk/ethers";
import { buildZamaFheChain } from "./zamaChain";

const sdk = new ZamaSDK(
  createEthersConfig({
    chains: [buildZamaFheChain()],
    signer,
    relayers: { [11155111]: web() },
  })
);

const { encryptedValues, inputProof } = await sdk.encrypt({
  values: [{ value: 30n, type: "euint8" }],
  contractAddress,
  userAddress,
});`}
                />

                <h3>Ephemeral wallet sessions</h3>
                <p className="text-sm">
                    Anonymous apply uses <code>withEphemeralZamaSDK</code> with the Semaphore-derived ephemeral signer so
                    decrypt-for-tx runs as <code>permitRecipient</code>, then the main Privy-bound SDK session resumes.
                </p>

                <h2>Solidity usage</h2>
                <p className="text-sm">Contracts import <code>@fhevm/solidity/FHE.sol</code>:</p>
                <ul className="text-sm">
                    <li>
                        <strong>Storage:</strong> <code>euint32</code> vitals, <code>euint8</code> scores,{" "}
                        <code>ebool</code> consent flags.
                    </li>
                    <li>
                        <strong>Compute:</strong> <code>EligibilityEngine</code> — homomorphic rubric with{" "}
                        <code>FHE.ge</code>, <code>FHE.le</code>, <code>FHE.cmux</code>.
                    </li>
                    <li>
                        <strong>ACL:</strong> <code>FHE.allow(handle, patient)</code> after scoring so only the
                        patient can user-decrypt.
                    </li>
                </ul>

                <h2>Network</h2>
                <ul className="text-sm">
                    <li>
                        <strong>Chain:</strong> Ethereum Sepolia ({ETHEREUM_SEPOLIA_CHAIN_ID}) — standard Ethereum
                        JSON-RPC.
                    </li>
                    <li>
                        <strong>Relayer:</strong> Zama testnet relayer + MedVault HTTP relayer for Semaphore apply and
                        v0.9 <code>publicDecrypt</code> completion proofs.
                    </li>
                    <li>
                        <strong>Latency:</strong> FHE transactions are slower than plain transfers; show pending UI
                        states (see FAQ).
                    </li>
                </ul>

                <h2>Hardhat testing</h2>
                <p className="text-sm">
                    <code>hardhat.config.ts</code> loads <code>@fhevm/hardhat-plugin</code>. Helpers live in{" "}
                    <code>test-support/fhe.ts</code>:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="test-support/fhe.ts"
                    code={`assertFhevmMock(); // hre.fhevm.isMock === true

const input = hre.fhevm.createEncryptedInput(contractAddress, userAddress);
input.add8(BigInt(age));
const enc = await input.encrypt();

// Mock decrypt in tests only
await hre.fhevm.userDecryptEuint(FhevmType.euint8, handle, contract, user);`}
                />

                <h2>FHE vs Noir attestation</h2>
                <div className="not-prose grid sm:grid-cols-2 gap-3 my-6 text-sm">
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                        <p className="font-bold text-violet-900 m-0">Zama FHE</p>
                        <p className="text-slate-600 m-0 mt-1 text-xs">
                            Encrypted health metrics and homomorphic eligibility — authoritative private compute on-chain.
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="font-bold text-slate-900 m-0">
                            <Link to="/docs/noir">Noir / Honk</Link>
                        </p>
                        <p className="text-slate-600 m-0 mt-1 text-xs">
                            Public compliance seal binding Semaphore nullifier, profile commitment, FHE stage handle, and
                            criteria schema — not the eligibility engine.
                        </p>
                    </div>
                </div>

                <h2>Operational checklist</h2>
                <ul className="text-sm">
                    <li>Set <code>VITE_PRIVY_APP_ID</code> and Sepolia addresses in <code>addresses.json</code>.</li>
                    <li>
                        Set <code>VITE_SEPOLIA_RPC_URL</code> or <code>VITE_RPC_URL</code> for reads.
                    </li>
                    <li>
                        Optional: <code>VITE_ZAMA_RELAYER_URL</code>, <code>VITE_RELAYER_URL</code> for apply/claim
                        relays.
                    </li>
                    <li>Never log plaintext health metrics or Semaphore secrets in production analytics.</li>
                </ul>
            </Prose>
        </motion.div>
    );
}
