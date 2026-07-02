const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'artifacts', 'contracts');
const destDir = path.join(process.cwd(), 'src', 'lib', 'contracts', 'abis');
const subgraphDestDir = path.join(process.cwd(), 'subgraph', 'abis');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}
if (!fs.existsSync(subgraphDestDir)) {
    fs.mkdirSync(subgraphDestDir, { recursive: true });
}

const SUBGRAPH_ABIS = new Set([
    'AnonymousPatientRegistry.json',
    'ConfidentialETH.json',
    'ConsentManager.json',
    'DataAccessLog.json',
    'EligibilityEngine.json',
    'MedVaultAutomation.json',
    'MedVaultRegistry.json',
    'SponsorIncentiveVault.json',
    'SponsorRegistry.json',
    'StakingManager.json',
    'TrialManager.json',
    'TrialMilestoneManager.json'
]);

function copyAbis(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            copyAbis(fullPath);
        } else if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
            const destPath = path.join(destDir, file);
            fs.copyFileSync(fullPath, destPath);
            console.log(`Copied ${file} to ${destPath}`);
            if (SUBGRAPH_ABIS.has(file)) {
                const subgraphDestPath = path.join(subgraphDestDir, file);
                fs.copyFileSync(fullPath, subgraphDestPath);
                console.log(`Copied ${file} to ${subgraphDestPath}`);
            }
        }
    }
}

/** Keep subgraph/abis aligned with committed src/lib/contracts/abis (Studio deploys without local compile). */
function syncSubgraphAbisFromFrontend() {
    const frontendAbiDir = path.join(process.cwd(), 'src', 'lib', 'contracts', 'abis');
    if (!fs.existsSync(frontendAbiDir)) {
        console.warn('[sync-abis] %s missing; cannot sync subgraph from frontend ABIs', frontendAbiDir);
        return;
    }
    if (!fs.existsSync(subgraphDestDir)) {
        fs.mkdirSync(subgraphDestDir, { recursive: true });
    }
    for (const file of SUBGRAPH_ABIS) {
        const srcPath = path.join(frontendAbiDir, file);
        if (!fs.existsSync(srcPath)) {
            console.warn(`[sync-abis] missing ${file} in frontend abis; subgraph copy skipped`);
            continue;
        }
        fs.copyFileSync(srcPath, path.join(subgraphDestDir, file));
        console.log(`[sync-abis] subgraph/abis/${file} <- frontend`);
    }
}

if (fs.existsSync(srcDir)) {
    copyAbis(srcDir);
} else {
    console.warn(
        '[sync-abis] artifacts/contracts not found — run `npm run compile` to refresh from Solidity. ' +
            'Still syncing subgraph ABIs from src/lib/contracts/abis.'
    );
}

syncSubgraphAbisFromFrontend();

// Full IERC7984 ABI lives on ConfidentialETH7984; alias wrapper artifact is minimal.
const ceth7984 = path.join(destDir, "ConfidentialETH7984.json");
const cethAlias = path.join(destDir, "ConfidentialETH.json");
if (fs.existsSync(ceth7984)) {
    fs.copyFileSync(ceth7984, cethAlias);
    if (SUBGRAPH_ABIS.has("ConfidentialETH.json")) {
        fs.copyFileSync(ceth7984, path.join(subgraphDestDir, "ConfidentialETH.json"));
        console.log("[sync-abis] ConfidentialETH.json <- ConfidentialETH7984.json (IERC7984 ABI)");
    }
}
