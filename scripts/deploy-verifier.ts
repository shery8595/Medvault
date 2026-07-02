const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

const VK_FINGERPRINT_FILE = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");

async function main() {
    console.log("Deploying eligibility Honk verifiers...\n");

    const [signer] = await ethers.getSigners();
    console.log(`Using signer: ${signer.address}\n`);

    const PlaintextVerifier = await ethers.getContractFactory("HonkVerifier");
    const plaintext = await PlaintextVerifier.deploy();
    await plaintext.waitForDeployment();
    const plaintextAddress = await plaintext.getAddress();
    console.log(`✓ HonkVerifier (plaintext) deployed to: ${plaintextAddress}`);

    const EncryptedVerifier = await ethers.getContractFactory("HonkVerifierEncrypted");
    const encrypted = await EncryptedVerifier.deploy();
    await encrypted.waitForDeployment();
    const encryptedAddress = await encrypted.getAddress();
    console.log(`✓ HonkVerifierEncrypted deployed to: ${encryptedAddress}\n`);

    const networkName = hre.network.name === "sepolia" ? "sepolia" : "hardhat";

    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    let existingAddresses = {};
    if (fs.existsSync(addressesPath)) {
        existingAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }
    if (!existingAddresses[networkName]) {
        existingAddresses[networkName] = {};
    }
    existingAddresses[networkName].EligibilityVerifier = plaintextAddress;
    existingAddresses[networkName].HonkVerifier = plaintextAddress;
    existingAddresses[networkName].HonkVerifierEncrypted = encryptedAddress;

    if (fs.existsSync(VK_FINGERPRINT_FILE)) {
        const fp = JSON.parse(fs.readFileSync(VK_FINGERPRINT_FILE, "utf8"));
        const plaintextFp = fp.plaintext?.sha256 ?? fp.sha256;
        const encryptedFp = fp.encrypted?.sha256;
        if (plaintextFp) {
            existingAddresses[networkName].HonkVerifierVkFingerprint = plaintextFp;
            console.log(`✓ Plaintext VK fingerprint: ${plaintextFp.slice(0, 16)}…`);
        }
        if (encryptedFp) {
            existingAddresses[networkName].HonkVerifierEncryptedVkFingerprint = encryptedFp;
            console.log(`✓ Encrypted VK fingerprint: ${encryptedFp.slice(0, 16)}…`);
        }
    } else {
        console.warn("⚠ No vk_fingerprint.json — run npm run build:circuit before deploying.");
    }

    fs.writeFileSync(addressesPath, JSON.stringify(existingAddresses, null, 4));
    console.log(`✓ Updated addresses.json\n`);

    console.log("═══════════════════════════════════════════════");
    console.log(`   VERIFIER DEPLOYMENT COMPLETE (${networkName})`);
    console.log("═══════════════════════════════════════════════");
    console.log(`  HonkVerifier (plaintext)  ${plaintextAddress}`);
    console.log(`  HonkVerifierEncrypted     ${encryptedAddress}`);
    console.log("═══════════════════════════════════════════════");
    console.log("\nNext: npm run deploy:wiring:sepolia (after 6h timelock) to wire both verifiers on EligibilityEngine.\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
