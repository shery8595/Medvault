// Fast subgraph deploy — single graph build, Studio IPFS (avoids public IPFS hangs).
// Usage:
//   node scripts/redeploy-subgraph.js [version] [--sync-abis]
//   node scripts/redeploy-subgraph.js           # auto version v0.2.<epoch-seconds>
//   node scripts/redeploy-subgraph.js 0.2.2     # explicit version

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { execSync } = require("child_process");

const STUDIO_DEPLOY_NODE =
    process.env.GRAPH_STUDIO_DEPLOY_NODE || "https://api.studio.thegraph.com/deploy/";
/** Default Graph IPFS API (graph-cli default); Studio /ipfs/ URL returns 404 on this CLI version. */
const GRAPH_IPFS_NODE =
    process.env.GRAPH_IPFS_NODE || "https://api.thegraph.com/ipfs/api/v0";
const SUBGRAPH_SLUG = process.env.GRAPH_SUBGRAPH_SLUG || "medvault";
const SUBGRAPH_NETWORK = process.env.GRAPH_SUBGRAPH_NETWORK || "sepolia";

const args = process.argv.slice(2).filter((a) => a !== "--sync-abis");
const syncAbis = process.argv.includes("--sync-abis");

function resolveVersion() {
    const raw = args[0];
    if (raw) return raw.startsWith("v") ? raw : `v${raw}`;
    // Short unique label — avoids "version already exists" without huge timestamps.
    const d = new Date();
    const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
    return `v0.2.${stamp}`;
}

function run(cmd, cwd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "" } });
}

async function main() {
    const VERSION = resolveVersion();
    const rootDir = path.join(__dirname, "..");
    const subgraphDir = path.join(rootDir, "subgraph");

    console.log(`Subgraph deploy ${VERSION} → ${SUBGRAPH_SLUG} (${SUBGRAPH_NETWORK})\n`);

    const deployKey = process.env.GRAPH_STUDIO_DEPLOY_KEY || process.env.GRAPH_DEPLOY_KEY;
    if (!deployKey) {
        console.error("Missing GRAPH_STUDIO_DEPLOY_KEY (or GRAPH_DEPLOY_KEY) in .env");
        process.exit(1);
    }

    if (syncAbis) {
        console.log("1. Syncing ABIs...");
        run("node scripts/sync-abis.js", rootDir);
    } else {
        console.log("1. Skipping ABI sync (pass --sync-abis to refresh from artifacts)");
    }

    console.log("2. Patching subgraph.yaml from addresses.json...");
    run(`node scripts/update-subgraph-yaml.js ${SUBGRAPH_NETWORK}`, rootDir);

    console.log("3. Graph Studio auth...");
    run(`npx graph auth ${deployKey}`, subgraphDir);

    console.log("4. Codegen...");
    run("npm run codegen", subgraphDir);

    const deployCmd = `npx graph deploy -g "${STUDIO_DEPLOY_NODE}" -i "${GRAPH_IPFS_NODE}" ${SUBGRAPH_SLUG} --version-label ${VERSION}`;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`5. Deploy attempt ${attempt}/3 (${VERSION})...`);
            run(deployCmd, subgraphDir);
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            if (attempt < 3) console.warn(`   Retry in 5s (IPFS/network flake)...`);
            if (attempt < 3) execSync("powershell -Command Start-Sleep -Seconds 5");
        }
    }
    if (lastErr) throw lastErr;

    console.log(`\n✅ Subgraph deployed: ${SUBGRAPH_SLUG} (${VERSION})`);
    console.log(
        `   Query URL pattern: https://api.studio.thegraph.com/query/<id>/${SUBGRAPH_SLUG}/${VERSION}`
    );
}

main().catch((error) => {
    console.error("❌ Subgraph deployment failed:", error.message || error);
    process.exit(1);
});
