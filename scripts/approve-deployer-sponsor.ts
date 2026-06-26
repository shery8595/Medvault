import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const addresses = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../src/lib/contracts/addresses.json"), "utf8")
    ).sepolia;
    const sr = await hre.ethers.getContractAt("SponsorRegistry", addresses.SponsorRegistry);
    const verified = await sr.isVerifiedSponsor(deployer.address);
    console.log(`Deployer ${deployer.address} verified: ${verified}`);
    if (!verified) {
        const tx = await sr.addSponsor(deployer.address, "MedVault Demo Sponsor");
        await tx.wait();
        console.log("✓ Added deployer as verified sponsor");
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
