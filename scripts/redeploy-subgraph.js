// Subgraph Redeployment Script v0.0.4
// Run this from the subgraph directory:
// node scripts/deploy-subgraph.js

const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { execSync } = require("child_process");

async function main() {
    console.log("Starting Subgraph redeployment v0.0.4...");

    try {
        const subgraphDir = path.join(__dirname, "../subgraph");

        console.log("1. Authenticating with Graph Studio...");
        execSync(`npx graph auth 5963492f001b59de8d668c0994c323d6`, {
            cwd: subgraphDir,
            stdio: "inherit"
        });

        console.log("2. Generating types...");
        execSync("npm run codegen", { cwd: subgraphDir, stdio: "inherit" });

        console.log("3. Building subgraph...");
        execSync("npm run build", { cwd: subgraphDir, stdio: "inherit" });

        console.log("4. Deploying to Graph Studio (v0.0.4)...");
        console.log("Target network: Arbitrum Sepolia | Latest block: 257634742");

        execSync(`npx graph deploy medvault --version-label v0.0.4`, {
            cwd: subgraphDir,
            stdio: "inherit"
        });

        console.log("✅ Subgraph successfully deployed to v0.0.4 on Arbitrum Sepolia");
    } catch (error) {
        console.error("❌ Subgraph deployment failed:", error);
        process.exit(1);
    }
}

main();