const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VK_FILE = path.join(__dirname, "../circuits/eligibility_proof/target/vk_honk.bin");
const VK_FINGERPRINT_FILE = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");

async function main() {
    console.log("Deploying Eligibility Verifier contract...\n");

    const [signer] = await ethers.getSigners();
    console.log(`Using signer: ${signer.address}\n`);

    // Deploy verifier contract
    const Verifier = await ethers.getContractFactory("HonkVerifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`✓ HonkVerifier deployed to: ${verifierAddress}\n`);

    // Detect network
    const networkName = hre.network.name === "sepolia" ? "sepolia" : "hardhat";

    // Update addresses.json
    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    let existingAddresses = {};
    if (fs.existsSync(addressesPath)) {
        existingAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    }
    if (!existingAddresses[networkName]) {
        existingAddresses[networkName] = {};
    }
    existingAddresses[networkName].EligibilityVerifier = verifierAddress;
    existingAddresses[networkName].HonkVerifier = verifierAddress;

    let vkFingerprint: string | undefined;
    if (fs.existsSync(VK_FINGERPRINT_FILE)) {
        vkFingerprint = JSON.parse(fs.readFileSync(VK_FINGERPRINT_FILE, "utf8")).sha256;
    } else if (fs.existsSync(VK_FILE)) {
        vkFingerprint = crypto.createHash("sha256").update(fs.readFileSync(VK_FILE)).digest("hex");
    }
    if (vkFingerprint) {
        existingAddresses[networkName].HonkVerifierVkFingerprint = vkFingerprint;
        console.log(`✓ VK fingerprint: ${vkFingerprint.slice(0, 16)}…`);
    } else {
        console.warn("⚠ No vk_honk.bin — run npm run build:circuit before deploying.");
    }

    fs.writeFileSync(addressesPath, JSON.stringify(existingAddresses, null, 4));
    console.log(`✓ Updated addresses.json with verifier address\n`);

    console.log("═══════════════════════════════════════════════");
    console.log(`   VERIFIER DEPLOYMENT COMPLETE (${networkName})`);
    console.log("═══════════════════════════════════════════════");
    console.log(`  HonkVerifier  ${verifierAddress}`);
    console.log("═══════════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
