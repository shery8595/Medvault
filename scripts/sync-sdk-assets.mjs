#!/usr/bin/env node
/**
 * Copy contract addresses + ABIs from the dapp into @medvault/core data/.
 * Run after deploy/sync-abis when on-chain addresses or ABIs change.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcContracts = join(root, "src", "lib", "contracts");
const destData = join(root, "packages", "medvault-core", "data");
const destAbis = join(destData, "abis");

const ABI_FILES = [
  "AnonymousPatientRegistry",
  "TrialManager",
  "ConsentManager",
  "EligibilityEngine",
  "ConfidentialETH",
  "SponsorIncentiveVault",
  "DataAccessLog",
  "TrialMilestoneManager",
  "SponsorRegistry",
  "MedVaultAutomation",
  "StakingManager",
  "MedVaultRegistry",
  "EncryptedScoreLeaderboard",
  "HonkVerifier",
  "HonkVerifierEncrypted",
  "PatientDocumentStore",
];

mkdirSync(destAbis, { recursive: true });
copyFileSync(join(srcContracts, "addresses.json"), join(destData, "addresses.json"));
// IERC7984 implementation lives in ConfidentialETH7984; alias artifact is thin wrapper.
copyFileSync(
  join(srcContracts, "abis", "ConfidentialETH7984.json"),
  join(destAbis, "ConfidentialETH.json")
);
for (const name of ABI_FILES) {
  if (name === "ConfidentialETH") continue;
  copyFileSync(join(srcContracts, "abis", `${name}.json`), join(destAbis, `${name}.json`));
}
console.log(`Synced ${ABI_FILES.length + 1} files to packages/medvault-core/data/`);
