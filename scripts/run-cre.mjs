import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, ".env");
dotenv.config({ path: envPath });

// CRE CLI reads CRE_ETH_PRIVATE_KEY; fall back to Hardhat deployer key.
if (!process.env.CRE_ETH_PRIVATE_KEY?.trim() && process.env.PRIVATE_KEY?.trim()) {
  process.env.CRE_ETH_PRIVATE_KEY = process.env.PRIVATE_KEY.trim();
}

const candidates = [
  process.env.CRE_BIN,
  "D:\\cre-cli\\cre.exe",
  "cre",
].filter(Boolean);

let creBin = "cre";
for (const c of candidates) {
  if (c.includes("\\") || c.includes("/")) {
    if (fs.existsSync(c)) {
      creBin = c;
      break;
    }
  } else {
    creBin = c;
    break;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-cre.mjs <cre-args...>");
  process.exit(1);
}

const creArgs = fs.existsSync(envPath) ? ["-e", envPath, ...args] : args;

const result = spawnSync(creBin, creArgs, {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
  env: process.env,
});
process.exit(result.status ?? 1);
