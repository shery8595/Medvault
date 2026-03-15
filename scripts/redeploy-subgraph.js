
// Subgraph Redeployment Script v0.2.6
// Run this from the subgraph directory:
// graph deploy --product hosted-service shery8595/Med-Vault --version-label v0.2.6

require('dotenv').config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Subgraph redeployment v0.2.7...");

    try {
        const subgraphDir = path.join(__dirname, "../subgraph");
        
        console.log("1. Generating types...");
        execSync("npm run codegen", { cwd: subgraphDir, stdio: "inherit" });

        console.log("2. Building subgraph...");
        execSync("npm run build", { cwd: subgraphDir, stdio: "inherit" });

        console.log("3. Deploying to Graph Studio (v0.2.7)...");
        console.log("Building and deploying subgraph version v0.2.7...");
        // Command for Subgraph Studio
        execSync(`npx graph deploy --studio medvault-subgraph --deploy-key ${process.env.GRAPH_DEPLOY_KEY} --version-label v0.2.7`, { 
            cwd: subgraphDir, 
            stdio: "inherit" 
        });

        console.log("Subgraph successfully deployed to v0.2.7");
    } catch (error) {
        console.error("Subgraph deployment failed:", error);
        process.exit(1);
    }
}

main();
