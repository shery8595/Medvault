/**
 * Quick read-only check: Honk verifiers + vault cross-refs on Sepolia.
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";

async function main() {
    const key = networkKeyFromHardhatName(hre.network.name);
    const a = loadAddresses(key);
    const engine = await ethers.getContractAt("EligibilityEngine", a.EligibilityEngine);
    const vault = await ethers.getContractAt("SponsorIncentiveVault", a.SponsorIncentiveVault);
    const tm = await ethers.getContractAt("TrialManager", a.TrialManager);
    const mm = await ethers.getContractAt("TrialMilestoneManager", a.TrialMilestoneManager);
    const auto = await ethers.getContractAt("MedVaultAutomation", a.MedVaultAutomation);
    const cETH = await ethers.getContractAt("ConfidentialETH", a.ConfidentialETH);

    const expectedPlain = (a.HonkVerifier || a.EligibilityVerifier).toLowerCase();
    const expectedEnc = a.HonkVerifierEncrypted.toLowerCase();

    const plain = String(await engine.eligibilityVerifier()).toLowerCase();
    const enc = String(await engine.eligibilityVerifierEncrypted()).toLowerCase();

    console.log(`Network: ${hre.network.name}`);
    console.log(`EligibilityEngine.eligibilityVerifier:          ${plain} ${plain === expectedPlain ? "✓" : "✗"}`);
    console.log(`EligibilityEngine.eligibilityVerifierEncrypted: ${enc} ${enc === expectedEnc ? "✓" : "✗"}`);
    console.log(`TrialManager.eligibilityEngine:                 ${await tm.eligibilityEngine()}`);
    console.log(`Vault.milestoneManager:                       ${await vault.milestoneManager()}`);
    console.log(`Vault.sponsorRegistry:                        ${await vault.sponsorRegistry()}`);
    console.log(`Vault.automationContract:                     ${await vault.automationContract()}`);
    console.log(`MilestoneManager.vault:                       ${await mm.vault()}`);
    console.log(`Automation.vault:                             ${await auto.vault()}`);
    console.log(`cETH authorized vault:                        ${await cETH.authorizedContracts(a.SponsorIncentiveVault)}`);
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
