/**
 * Deploy HonkVerifierEncrypted on Sepolia and schedule engine wiring.
 * Use when the main deploy ran without the encrypted verifier (legacy gap).
 *
 * Usage:
 *   npx hardhat run scripts/deploy-encrypted-verifier-sepolia.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";
import { ensureFhevmInitialized, wireEngineReader, ENGINE_READER_ROLES } from "./lib/timelockWiring";

const VK_FINGERPRINT_FILE = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");
const ADDRESSES_PATH = path.join(__dirname, "../src/lib/contracts/addresses.json");

async function main() {
    const key = networkKeyFromHardhatName(hre.network.name);
    if (key !== "sepolia") {
        throw new Error(`deploy-encrypted-verifier-sepolia.ts is for Sepolia only (got ${hre.network.name})`);
    }

    await ensureFhevmInitialized();
    const a = loadAddresses(key);
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`EligibilityEngine: ${a.EligibilityEngine}\n`);

    const engine = await ethers.getContractAt("EligibilityEngine", a.EligibilityEngine);
    const currentEncrypted = await engine.eligibilityVerifierEncrypted();
    if (currentEncrypted !== ethers.ZeroAddress) {
        console.log(`eligibilityVerifierEncrypted already set → ${currentEncrypted}`);
        console.log("Skipping deploy; update addresses.json if needed.");
        return;
    }

    const EncryptedVerifier = await ethers.getContractFactory("HonkVerifierEncrypted");
    const encrypted = await EncryptedVerifier.deploy();
    await encrypted.waitForDeployment();
    const encryptedAddress = await encrypted.getAddress();
    console.log(`✓ HonkVerifierEncrypted → ${encryptedAddress}`);

    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.eligibilityVerifierEncrypted,
        encryptedAddress,
        "EligibilityEngine eligibilityVerifierEncrypted"
    );

    const all = JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as Record<string, Record<string, string>>;
    if (!all.sepolia) all.sepolia = {};
    all.sepolia.HonkVerifierEncrypted = encryptedAddress;

    if (fs.existsSync(VK_FINGERPRINT_FILE)) {
        const fp = JSON.parse(fs.readFileSync(VK_FINGERPRINT_FILE, "utf8"));
        if (fp.encrypted?.sha256) {
            all.sepolia.HonkVerifierEncryptedVkFingerprint = fp.encrypted.sha256;
            console.log(`✓ Encrypted VK fingerprint: ${fp.encrypted.sha256.slice(0, 16)}…`);
        }
    }

    fs.writeFileSync(ADDRESSES_PATH, `${JSON.stringify(all, null, 4)}\n`);
    console.log("✓ addresses.json updated");
    console.log("\nRe-run after 6 hours to apply timelock:");
    console.log("  npm run deploy:wiring:sepolia");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
