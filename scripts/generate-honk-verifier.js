/**
 * Regenerate HonkVerifier.sol (plaintext) and HonkVerifierEncrypted.sol via @aztec/bb.js.
 *
 * Run: npm run generate:honk-verifier
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CIRCUITS = [
    {
        name: "eligibility_plaintext",
        circuitJson: path.join(__dirname, "../src/lib/circuits/eligibility_plaintext.json"),
        verifierDst: path.join(__dirname, "../contracts/HonkVerifier.sol"),
        targetVerifier: path.join(__dirname, "../circuits/eligibility_plaintext/target/HonkVerifier.sol"),
        fingerprintKey: "plaintext",
    },
    {
        name: "eligibility_encrypted",
        circuitJson: path.join(__dirname, "../src/lib/circuits/eligibility_encrypted.json"),
        verifierDst: path.join(__dirname, "../contracts/HonkVerifierEncrypted.sol"),
        targetVerifier: path.join(__dirname, "../circuits/eligibility_encrypted/target/HonkVerifier.sol"),
        fingerprintKey: "encrypted",
    },
];

const VK_FINGERPRINT_DST = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");
const EVM_OPTIONS = { verifierTarget: "evm-no-zk" };

function copyWithWarning(src, dst) {
    let content = fs.readFileSync(src, "utf8");
    if (!content.includes("REGENERATE THIS FILE")) {
        const warning =
            "// IMPORTANT -- REGENERATE THIS FILE before deploying.\n" +
            "// Run: npm run build:circuit  OR  npm run generate:honk-verifier\n";
        content = content.replace(/^(\/\/ SPDX[^\n]*\n)/, `$1${warning}`);
    }
    // Rename contract for encrypted verifier to avoid duplicate HonkVerifier symbol
    if (dst.endsWith("HonkVerifierEncrypted.sol")) {
        content = content.replace(/\bcontract HonkVerifier\b/g, "contract HonkVerifierEncrypted");
        content = content.replace(/\bHonkVerifier is\b/g, "HonkVerifierEncrypted is");
    }
    fs.writeFileSync(dst, content, "utf8");
}

async function generateVerifier(circuitDef, api, Barretenberg, UltraHonkBackend) {
    if (!fs.existsSync(circuitDef.circuitJson)) {
        console.error(`Missing ${circuitDef.circuitJson}. Run: npm run build:circuit`);
        process.exit(1);
    }

    const circuit = JSON.parse(fs.readFileSync(circuitDef.circuitJson, "utf8"));
    if (!circuit.bytecode) {
        console.error(`Circuit JSON has no bytecode: ${circuitDef.name}`);
        process.exit(1);
    }

    console.log(`\n── ${circuitDef.name} ──`);
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const vk = await backend.getVerificationKey(EVM_OPTIONS);
    const vkHash = crypto.createHash("sha256").update(vk).digest("hex");

    const solidity = await backend.getSolidityVerifier(vk, EVM_OPTIONS);
    fs.mkdirSync(path.dirname(circuitDef.targetVerifier), { recursive: true });
    fs.writeFileSync(circuitDef.targetVerifier, solidity, "utf8");
    copyWithWarning(circuitDef.targetVerifier, circuitDef.verifierDst);

    console.log(`✓ ${circuitDef.verifierDst}`);
    console.log(`✓ VK fingerprint ${vkHash.slice(0, 16)}…`);
    return { key: circuitDef.fingerprintKey, sha256: vkHash, name: circuitDef.name };
}

async function main() {
    const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");

    console.log("Initializing Barretenberg...");
    const api = await Barretenberg.new({ threads: 1 });

    const fingerprints = {};
    for (const circuitDef of CIRCUITS) {
        const fp = await generateVerifier(circuitDef, api, Barretenberg, UltraHonkBackend);
        fingerprints[fp.key] = {
            sha256: fp.sha256,
            circuit: fp.name,
            verifierTarget: "evm-no-zk",
            noirVersion: "1.0.0-beta.21",
            bbVersion: "5.0.0-nightly.20260324",
            generatedAt: new Date().toISOString(),
        };
    }

    await api.destroy();

    fs.writeFileSync(VK_FINGERPRINT_DST, JSON.stringify(fingerprints, null, 2) + "\n");
    console.log(`✓ VK fingerprints -> ${VK_FINGERPRINT_DST}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
