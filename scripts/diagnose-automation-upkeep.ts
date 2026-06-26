/**
 * Diagnose why Chainlink Automation upkeep is not firing.
 *
 *   npx hardhat run scripts/diagnose-automation-upkeep.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";

async function main() {
  const key = networkKeyFromHardhatName(hre.network.name);
  const addresses = loadAddresses(key);
  const now = Math.floor(Date.now() / 1000);

  const automation = await ethers.getContractAt("MedVaultAutomation", addresses.MedVaultAutomation);
  const tm = await ethers.getContractAt("TrialManager", addresses.TrialManager);

  const forwarder = await automation.chainlinkForwarder();
  const [needed, performData] = await automation.checkUpkeep("0x");

  console.log(`\nMedVaultAutomation: ${addresses.MedVaultAutomation}`);
  console.log(`chainlinkForwarder: ${forwarder}`);
  console.log(`checkUpkeep("0x") → upkeepNeeded=${needed}`);
  if (needed && performData !== "0x") {
    const [taskType, trialId] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "uint256"],
      performData,
    );
    console.log(`  performData: taskType=${taskType}, trialId=${trialId}`);
  }

  if (forwarder === ethers.ZeroAddress) {
    console.log("\n⚠ chainlinkForwarder is ZERO — performUpkeep will revert even if checkUpkeep is true.");
    console.log(
      "  Fix: CHAINLINK_FORWARDER=0x2d3E... npx hardhat run scripts/set-chainlink-forwarder.ts --network sepolia",
    );
  }

  const counter = await tm.trialCounter();
  const total = Number(counter) - 1;
  console.log(`\nTrials on TrialManager: ${total}`);
  console.log(`block.timestamp (local est): ${now}`);

  for (let i = 0; i < 20; i++) {
    try {
      const id = await automation.activeTrialIds(i);
      const trial = await tm.getTrial(id);
      const fin = await automation.finalized(id);
      const expired = trial.endTime > 0n && BigInt(now) >= trial.endTime;
      console.log(`\n  activeTrialIds[${i}] = trial ${id}`);
      console.log(`    name: ${trial.name}`);
      console.log(`    active: ${trial.active}, endTime: ${trial.endTime}, expired: ${expired}`);
      console.log(`    finalized: ${fin}`);
    } catch {
      break;
    }
  }

  for (let id = 1n; id < counter; id++) {
    const trial = await tm.getTrial(id);
    let inActiveList = false;
    for (let i = 0; i < 20; i++) {
      try {
        if ((await automation.activeTrialIds(i)) === id) inActiveList = true;
      } catch {
        break;
      }
    }
    if (!inActiveList && trial.active) {
      console.log(`\n⚠ Trial ${id} is active on TrialManager but NOT in automation.activeTrialIds`);
      console.log("  (created before automation was wired, or onTrialCreated failed)");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
