import fs from "fs";
import path from "path";

const ADDRESSES_PATH = path.join(__dirname, "../../src/lib/contracts/addresses.json");

export function networkKeyFromHardhatName(hardhatNetwork: string): string {
  return hardhatNetwork === "hardhat" ? "hardhat" : "sepolia";
}

export function loadAddresses(networkKey: string): Record<string, string> {
  const all = JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as Record<
    string,
    Record<string, string>
  >;
  const current = all[networkKey];
  if (!current) {
    throw new Error(`No addresses for "${networkKey}" in addresses.json`);
  }
  return current;
}

export function saveVaultAddress(networkKey: string, vaultAddress: string): void {
  const all = JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as Record<
    string,
    Record<string, string>
  >;
  if (!all[networkKey]) {
    throw new Error(`No addresses for "${networkKey}" in addresses.json`);
  }
  all[networkKey].SponsorIncentiveVault = vaultAddress;
  fs.writeFileSync(ADDRESSES_PATH, `${JSON.stringify(all, null, 4)}\n`);
}
