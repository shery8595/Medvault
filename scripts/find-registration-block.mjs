/**
 * Find MedVaultRegistry PatientRegistered block for a wallet (Ethereum Sepolia).
 * Usage: node scripts/find-registration-block.mjs [wallet]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const wallet = (process.argv[2] || "0xb8664841528e9Bd60D91AbB1bCF2975e67Fa0e17").toLowerCase();
const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/lib/contracts/addresses.json"), "utf8")
).sepolia;
const REG = addresses.MedVaultRegistry;
const rpc =
  process.env.SEPOLIA_RPC_URL ||
  process.env.VITE_SEPOLIA_RPC_URL ||
  process.env.VITE_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

const provider = new ethers.JsonRpcProvider(rpc);
const abi = ["event PatientRegistered(uint256 indexed commitment)", "function isRegistered() view returns (bool)"];
const registry = new ethers.Contract(REG, abi, provider);

const latest = await provider.getBlockNumber();
const registered = await registry.isRegistered({ from: wallet }).catch(() => null);
console.log("Wallet:", wallet);
console.log("Registry:", REG);
console.log("Latest block:", latest);
console.log("isRegistered(wallet):", registered);

/** Scan tx list to registry (faster than all PatientRegistered logs). */
const CHUNK = 25_000;
const floor = 5_000_000;
let hit = null;

for (let to = latest; to >= floor && !hit; to -= CHUNK) {
  const from = Math.max(floor, to - CHUNK + 1);
  const logs = await registry.queryFilter(registry.filters.PatientRegistered(), from, to);
  for (const ev of logs) {
    const tx = await provider.getTransaction(ev.transactionHash);
    if (tx.from.toLowerCase() === wallet) {
      hit = {
        block: ev.blockNumber,
        tx: ev.transactionHash,
        commitment: ev.args.commitment.toString(),
      };
      break;
    }
  }
  process.stderr.write(`scanned ${from}-${to} (${logs.length} events)\n`);
}

if (!hit) {
  console.log(JSON.stringify({ ok: false, message: "No PatientRegistered from wallet in range" }, null, 2));
  process.exit(1);
}

const startBlock = Math.max(floor, hit.block - 2_000);
const outPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
for (const key of Object.keys(existing)) {
  existing[key] = startBlock;
}
fs.writeFileSync(outPath, JSON.stringify(existing, null, 4) + "\n");
console.log(JSON.stringify({ ok: true, registration: hit, suggestedStartBlock: startBlock, wrote: outPath }, null, 2));
