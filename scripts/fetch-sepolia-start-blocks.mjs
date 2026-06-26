#!/usr/bin/env node
/** Resolve Sepolia contract creation blocks and refresh subgraph start blocks. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
const startBlocksPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");

const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8")).sepolia;
const rpc = process.env.SEPOLIA_RPC_URL;
if (!rpc) {
    console.error("SEPOLIA_RPC_URL required");
    process.exit(1);
}
const provider = new ethers.JsonRpcProvider(rpc);

const SUBGRAPH_CONTRACTS = [
    "AnonymousPatientRegistry",
    "TrialManager",
    "ConsentManager",
    "EligibilityEngine",
    "SponsorIncentiveVault",
    "TrialMilestoneManager",
    "DataAccessLog",
    "SponsorRegistry",
    "MedVaultRegistry",
    "StakingManager",
    "ConfidentialETH",
    "MedVaultAutomation",
    "EncryptedConsentGate",
    "EncryptedScoreLeaderboard",
];

const forceRefresh = new Set(
    process.argv.slice(2).flatMap((arg) => (arg === "--refresh" ? SUBGRAPH_CONTRACTS : [arg]))
);

async function fetchCreationBlockFromBlockscout(address) {
    const url = `https://eth-sepolia.blockscout.com/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
    const res = await fetch(url);
    const json = await res.json();
    const row = json?.result?.[0];
    if (!row?.txHash) return 0;
    const rec = await provider.getTransactionReceipt(row.txHash);
    return rec ? Number(rec.blockNumber) : 0;
}

async function main() {
    const existing = fs.existsSync(startBlocksPath)
        ? JSON.parse(fs.readFileSync(startBlocksPath, "utf8"))
        : {};
    const blocks = { ...existing };

    for (const name of SUBGRAPH_CONTRACTS) {
        const addr = addresses[name];
        if (!addr) continue;
        if (blocks[name] && blocks[name] > 0 && !forceRefresh.has(name)) {
            console.log(`${name}: ${blocks[name]} (cached)`);
            continue;
        }
        const block = await fetchCreationBlockFromBlockscout(addr);
        if (block > 0) {
            blocks[name] = block;
            console.log(`${name}: ${block}`);
        } else {
            console.warn(`${name}: could not resolve block for ${addr}`);
        }
    }

    fs.writeFileSync(startBlocksPath, `${JSON.stringify(blocks, null, 4)}\n`);
    console.log(`\nWrote ${startBlocksPath}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
