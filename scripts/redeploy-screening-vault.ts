/**
 * Redeploy SponsorIncentiveVault (screening / milestone-0 indexing fix) on Ethereum Sepolia.
 *
 * Usage:
 *   npx hardhat run scripts/redeploy-screening-vault.ts --network sepolia
 *
 * Requires: PRIVATE_KEY + SEPOLIA_RPC_URL in .env (deployer must be vault/TMM/automation owner).
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import {
  advanceTimelockIfHardhat,
  ensureCethContractAuth,
  wireAutomationVault,
  wireEngineReader,
  wireMilestoneManagerVault,
  wireTrialManagerAutomation,
  wireVaultAutomation,
  wireVaultMilestoneManager,
  ENGINE_READER_ROLES,
} from "./lib/timelockWiring";
import { ensureDataAccessLogger } from "./data-access-log-wiring";

function networkKey(): string {
  return hre.network.name === "sepolia" ? "sepolia" : hre.network.name;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
  const allAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8")) as Record<
    string,
    Record<string, string>
  >;
  const key = networkKey();
  const current = allAddresses[key];
  if (!current) {
    throw new Error(`No addresses for network key "${key}" in addresses.json`);
  }

  const OLD_VAULT = current.SponsorIncentiveVault;
  const CETH = current.ConfidentialETH;
  const TRIAL_MANAGER = current.TrialManager;
  const ENGINE = current.EligibilityEngine;
  const DAL = current.DataAccessLog;
  const MILESTONE_MANAGER = current.TrialMilestoneManager;
  const AUTOMATION = current.MedVaultAutomation;

  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Network:  ${hre.network.name} (${key})`);
  console.log(`Old vault: ${OLD_VAULT}\n`);

  const SponsorIncentiveVault = await ethers.getContractFactory("SponsorIncentiveVault");
  const vault = await SponsorIncentiveVault.deploy(CETH, TRIAL_MANAGER, ENGINE);
  const deployTx = vault.deploymentTransaction();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  const deployReceipt = deployTx ? await deployTx.wait() : null;
  const deployBlock = deployReceipt?.blockNumber ?? (await ethers.provider.getBlockNumber());
  console.log(`✓ SponsorIncentiveVault → ${vaultAddress} (block ${deployBlock})`);

  await advanceTimelockIfHardhat();

  await (await vault.setDataAccessLog(DAL)).wait();
  await wireVaultMilestoneManager(vault, MILESTONE_MANAGER);
  await wireVaultAutomation(vault, AUTOMATION);
  console.log("✓ Vault wired (DAL, milestone manager, automation)");

  const milestoneManager = await ethers.getContractAt("TrialMilestoneManager", MILESTONE_MANAGER);
  await wireMilestoneManagerVault(milestoneManager, vaultAddress);

  const ceth = await ethers.getContractAt("ConfidentialETH", CETH);
  if (OLD_VAULT) {
    try {
      await ensureCethContractAuth(ceth, OLD_VAULT, false);
      console.log("✓ ConfidentialETH deauthorized old vault");
    } catch (e) {
      console.warn("  (skip deauthorize old vault — may already be unset)", e);
    }
  }
  await ensureCethContractAuth(ceth, vaultAddress, true);
  console.log("✓ ConfidentialETH authorized new vault");

  const dal = await ethers.getContractAt("DataAccessLog", DAL);
  if (OLD_VAULT) {
    try {
      await ensureDataAccessLogger(dal, OLD_VAULT, false);
    } catch {
      /* ignore */
    }
  }
  await ensureDataAccessLogger(dal, vaultAddress, true);
  console.log("✓ DataAccessLog logger updated");

  const automation = await ethers.getContractAt("MedVaultAutomation", AUTOMATION);
  await wireAutomationVault(automation, vaultAddress);

  const trialManager = await ethers.getContractAt("TrialManager", TRIAL_MANAGER);
  await wireTrialManagerAutomation(trialManager, AUTOMATION);

  const engine = await ethers.getContractAt("EligibilityEngine", ENGINE);
  await wireEngineReader(
    engine,
    ENGINE_READER_ROLES.sponsorIncentiveVault,
    vaultAddress,
    "EligibilityEngine sponsorIncentiveVault"
  );

  allAddresses[key].SponsorIncentiveVault = vaultAddress;
  fs.writeFileSync(addressesPath, `${JSON.stringify(allAddresses, null, 4)}\n`);
  console.log(`\n✓ addresses.json updated (${key}.SponsorIncentiveVault)`);

  const startBlocksPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
  const startBlocks = JSON.parse(fs.readFileSync(startBlocksPath, "utf8")) as Record<string, number>;
  startBlocks.SponsorIncentiveVault = Number(deployBlock);
  fs.writeFileSync(startBlocksPath, `${JSON.stringify(startBlocks, null, 4)}\n`);
  console.log(`✓ sepolia-start-blocks.json SponsorIncentiveVault → ${deployBlock}`);
  console.log("\nNext steps:");
  console.log("  1. npm run sync-abis");
  console.log("  2. npm run subgraph:deploy -- 0.1.24  (reindexes RewardsDistributed → milestone 0)");
  console.log("  3. Fund new vault + re-register participants for in-flight trials (old pool ETH stays on old vault).");
  console.log("  4. After 6 hours on live network: npx hardhat run scripts/finish-wiring.ts --network sepolia");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
