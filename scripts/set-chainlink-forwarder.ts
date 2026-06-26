/**
 * Set Chainlink Automation forwarder on MedVaultAutomation (required for performUpkeep).
 *
 * Usage:
 *   CHAINLINK_FORWARDER=0x... npx hardhat run scripts/set-chainlink-forwarder.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";

async function main() {
  const forwarder = process.env.CHAINLINK_FORWARDER?.trim();
  if (!forwarder || !ethers.isAddress(forwarder)) {
    throw new Error("Set CHAINLINK_FORWARDER to your Chainlink Automation forwarder address on Ethereum Sepolia.");
  }

  const key = networkKeyFromHardhatName(hre.network.name);
  const addresses = loadAddresses(key);
  const automation = await ethers.getContractAt("MedVaultAutomation", addresses.MedVaultAutomation);

  console.log(`Setting chainlinkForwarder → ${forwarder} on ${addresses.MedVaultAutomation}`);
  await (await automation.setChainlinkForwarder(forwarder)).wait();
  console.log(`✓ chainlinkForwarder = ${await automation.chainlinkForwarder()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
