const fs = require('fs');
const path = require('path');

const networkKey = 'sepolia';
const graphNetwork = 'sepolia';
const startBlocksFile = 'sepolia-start-blocks.json';

const addressesPath = path.join(__dirname, '../src/lib/contracts/addresses.json');
const subgraphYamlPath = path.join(__dirname, '../subgraph/subgraph.yaml');
const startBlocksPath = path.join(__dirname, '../subgraph', startBlocksFile);

/** Every `name:` entry at the dataSource level in subgraph.yaml. */
const SUBGRAPH_DATASOURCES = [
    'AnonymousPatientRegistry',
    'TrialManager',
    'ConsentManager',
    'EligibilityEngine',
    'SponsorIncentiveVault',
    'TrialMilestoneManager',
    'DataAccessLog',
    'SponsorRegistry',
    'MedVaultRegistry',
    'StakingManager',
    'ConfidentialETH',
    'MedVaultAutomation',
    'EncryptedConsentGate',
    'EncryptedScoreLeaderboard',
];

const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))[networkKey];
if (!addresses) {
    console.error(`No addresses for "${networkKey}" in addresses.json`);
    process.exit(1);
}

let subgraphYaml = fs.readFileSync(subgraphYamlPath, 'utf8');
subgraphYaml = subgraphYaml.replace(/network: (arbitrum-sepolia|sepolia)/g, `network: ${graphNetwork}`);

let fileStartBlocks = null;
if (fs.existsSync(startBlocksPath)) {
    try {
        fileStartBlocks = JSON.parse(fs.readFileSync(startBlocksPath, 'utf8'));
    } catch (e) {
        console.warn(`Could not read ${startBlocksFile}:`, e.message);
    }
}

function resolveStartBlock(name) {
    const fromFile = fileStartBlocks && fileStartBlocks[name] != null ? Number(fileStartBlocks[name]) : null;
    return fromFile != null && !Number.isNaN(fromFile) ? fromFile : 0;
}

function updateDataSource(yaml, name, address, startBlock) {
    const re = new RegExp(
        `(  - kind: ethereum\\n    name: ${name}\\n    network: [^\\n]+\\n    source:\\n      address: ")[^"]+("[^\\n]*\\n      abi: [^\\n]+\\n      startBlock: )\\d+`,
        'g'
    );
    return yaml.replace(re, `$1${address}$2${startBlock}`);
}

let updated = 0;
for (const name of SUBGRAPH_DATASOURCES) {
    const address = addresses[name];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
        console.warn(`Warning: no address in addresses.json for ${name}, skip YAML replace`);
        continue;
    }
    const startBlock = resolveStartBlock(name);
    const next = updateDataSource(subgraphYaml, name, address, startBlock);
    if (next !== subgraphYaml) {
        updated += 1;
        console.log(`  ${name} → ${address} (startBlock ${startBlock})`);
    }
    subgraphYaml = next;
}

fs.writeFileSync(subgraphYamlPath, subgraphYaml);
const src = fileStartBlocks ? `${startBlocksFile} + addresses.json` : 'addresses.json (fallback start blocks)';
console.log(`Updated subgraph.yaml (${graphNetwork}, ${updated} data sources, ${src}).`);
