/**
 * MedVault -- Noir Circuit Build Script
 *
 * Compiles the eligibility_proof circuit with nargo, generates the Solidity
 * verifier via the bb CLI (Barretenberg), and copies all outputs to the right
 * places for Hardhat (HonkVerifier.sol) and the frontend
 * (eligibility_proof.json consumed by src/lib/noir.ts).
 *
 * Prerequisites (Noir v1 + Keccak bb — matches package.json):
 *   - nargo 1.0.0-beta.21  ->  noirup --version 1.0.0-beta.21
 *   - bb    5.0.0-nightly.20260324  ->  bbup -v 5.0.0-nightly.20260324
 *
 * Usage (also available as npm run build:circuit):
 *   node scripts/compile-circuit.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Pinned to match @noir-lang/noir v1.0.0-beta.21 install_bb.sh and @aztec/bb.js in package.json
const NOIR_VERSION = "1.0.0-beta.21";
const BB_VERSION = "5.0.0-nightly.20260324";
const BB_INSTALL_SCRIPT =
    "curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash";

const CIRCUIT_DIR = path.join(__dirname, "../circuits/eligibility_proof");
const TARGET_DIR = path.join(CIRCUIT_DIR, "target");
const COMPILED_JSON = path.join(TARGET_DIR, "eligibility_proof.json");
// bb 0.58.0 UltraHonk: -o is a FILE path (matches UltraHonkBackend in noir.ts)
const VK_FILE = path.join(TARGET_DIR, "vk_honk.bin");
const HONK_VERIFIER_SRC = path.join(TARGET_DIR, "HonkVerifier.sol");
const HONK_VERIFIER_DST = path.join(__dirname, "../contracts/HonkVerifier.sol");
const FRONTEND_CIRCUITS_DIR = path.join(__dirname, "../src/lib/circuits");
const FRONTEND_JSON_DST = path.join(FRONTEND_CIRCUITS_DIR, "eligibility_proof.json");
const VK_FINGERPRINT_DST = path.join(FRONTEND_CIRCUITS_DIR, "vk_fingerprint.json");

function run(cmd, cwd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit", shell: opts.shell !== false });
}

/** WSL inherits a Windows PATH with parentheses — use a minimal env for bash -lc. */
const WSL_ENV_PREFIX =
    "env -i HOME=$HOME USER=$USER PATH=$HOME/.nargo/bin:$HOME/.bb:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function toWslPath(winPath) {
    const resolved = path.resolve(winPath);
    const m = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
    if (!m) return resolved.replace(/\\/g, "/");
    return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}

function runInWsl(shellCmd, cwd) {
    const wslCwd = toWslPath(cwd);
    const escaped = shellCmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const wslCmd =
        `wsl.exe bash -lc "${WSL_ENV_PREFIX} cd \\"${wslCwd}\\" && ${escaped}"`;
    run(wslCmd, cwd, { shell: false });
}

function runTool(cmd, cwd) {
    if (process.platform === "win32") {
        runInWsl(cmd, cwd);
    } else {
        run(cmd, cwd);
    }
}

function tryExec(cmd) {
    try {
        return execSync(cmd, { encoding: "utf8", shell: true }).trim();
    } catch {
        return null;
    }
}

function copyWithWarning(src, dst) {
    let content = fs.readFileSync(src, "utf8");
    if (!content.includes("REGENERATE THIS FILE")) {
        const WARNING =
            "// IMPORTANT -- REGENERATE THIS FILE before deploying.\n" +
            "// Run: npm run build:circuit\n";
        content = content.replace(/^(\/\/ SPDX[^\n]*\n)/, `$1${WARNING}`);
    }
    fs.writeFileSync(dst, content, "utf8");
}

// Prepend known tool directories so child processes can find nargo + bb
// regardless of whether the shell loaded .bashrc.
const HOME = process.env.HOME || `/home/${process.env.USER}`;
const extraPaths = [`${HOME}/.nargo/bin`, `${HOME}/.bb`, `${HOME}/.foundry/bin`];
process.env.PATH = [...extraPaths, process.env.PATH].join(":");

// Locate bb in common install paths (bbup installs to ~/.bb/bb)
function findBb() {
    const candidates = [
        "bb",
        `${HOME}/.bb/bb`,
        `${HOME}/.nargo/bin/bb`,
    ];
    for (const c of candidates) {
        const v = tryExec(`${c} --version 2>/dev/null`);
        if (v) return { cmd: c, version: v };
    }
    return null;
}

function ensureBb() {
    const found = findBb();
    if (found) {
        console.log(`✓ bb found: ${found.version}`);
        return found.cmd;
    }

    console.log(`\n  bb not found. Installing bb ${BB_VERSION} via bbup...`);
    console.log("  (This may take a minute)");

    // Install bbup (the bb version manager)
    try {
        execSync(BB_INSTALL_SCRIPT, { stdio: "inherit", shell: true });
        // Source updated PATH and install the pinned version
        execSync(`bash -c "source ~/.bashrc 2>/dev/null; bbup -v ${BB_VERSION}"`, {
            stdio: "inherit",
            shell: true,
        });
    } catch (e) {
        console.error("\n✗ Automatic bb installation failed.");
        console.error("  Please install manually inside WSL:");
        console.error(`    ${BB_INSTALL_SCRIPT}`);
        console.error(`    bbup -v ${BB_VERSION}`);
        process.exit(1);
    }

    const after = findBb();
    if (!after) {
        console.error("\n✗ bb still not found after installation.");
        console.error("  Open a new WSL terminal, run 'source ~/.bashrc', then retry.");
        process.exit(1);
    }
    console.log(`✓ bb ${BB_VERSION} installed: ${after.cmd}`);
    return after.cmd;
}

async function main() {
    if (process.platform === "win32") {
        console.log("\n── Noir 1.x circuit build (WSL + bb.js verifier) ───────────────");
        const wslScript = toWslPath(path.join(__dirname, "compile-circuit-wsl.sh"));
        run(`wsl.exe sed -i "s/\\r$//" ${wslScript}`, __dirname, { shell: false });
        run(`wsl.exe bash ${wslScript}`, __dirname, { shell: false });
        console.log("\n── Generating HonkVerifier.sol (bb.js evm-no-zk) ───────────────");
        run("npm run generate:honk-verifier", path.join(__dirname, ".."), { shell: true });
        printDone();
        return;
    }

    // ── Step 1: Ensure nargo (Noir 1.x) ──────────────────────────────────────
    console.log("\n── Noir toolchain ──────────────────────────────────────────────");
    {
        const nargoVer = tryExec("nargo --version");
        if (!nargoVer) {
            console.error("\n✗ nargo not found. Install: noirup --version " + NOIR_VERSION);
            process.exit(1);
        }
        console.log(`✓ nargo found: ${nargoVer}`);
    }

    // ── Step 2: Compile the circuit ──────────────────────────────────────────
    console.log("\n── Compiling Noir circuit ──────────────────────────────────────");
    runTool("nargo compile", CIRCUIT_DIR);
    console.log("✓ Circuit compiled -> target/eligibility_proof.json");

    // ── Step 3: Run tests ────────────────────────────────────────────────────
    console.log("\n── Running Noir tests ──────────────────────────────────────────");
    runTool("nargo test", CIRCUIT_DIR);
    console.log("✓ All Noir tests passed");

    // ── Step 4: Ensure bb CLI is present ─────────────────────────────────────
    console.log("\n── Checking bb (Barretenberg) CLI ──────────────────────────────");
    let bbCmd;
    if (process.platform === "win32") {
        runInWsl(`command -v bb >/dev/null || (curl -sL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash)`, CIRCUIT_DIR);
        runInWsl(`bbup -v ${BB_VERSION}`, CIRCUIT_DIR);
        bbCmd = "bb";
    } else {
        bbCmd = ensureBb();
    }

    // ── Step 5: Write Keccak verification key (EVM / Solidity transcript) ─────
    console.log("\n── Writing Keccak UltraHonk verification key ───────────────────");
    if (fs.existsSync(VK_FILE)) fs.unlinkSync(VK_FILE);
    const vkCmd =
        `${bbCmd} write_vk_ultra_keccak_honk -b target/eligibility_proof.json -o target/vk_honk.bin`;
    const runBb = (c) => runTool(c, CIRCUIT_DIR);
    try {
        runBb(vkCmd);
    } catch {
        console.log("  write_vk_ultra_keccak_honk unavailable; falling back to --oracle_hash keccak");
        runBb(`${bbCmd} write_vk_ultra_honk -b target/eligibility_proof.json -o target/vk_honk.bin --oracle_hash keccak`);
    }
    if (!fs.existsSync(VK_FILE)) {
        console.error(`\n✗ VK file not found at ${VK_FILE}`);
        process.exit(1);
    }
    console.log("✓ Keccak verification key written -> target/vk_honk.bin");

    // ── Step 6: Generate HonkVerifier.sol ────────────────────────────────────
    console.log("\n── Generating HonkVerifier.sol ─────────────────────────────────");
    runBb(`${bbCmd} contract_ultra_honk -k target/vk_honk.bin -o target/HonkVerifier.sol`);
    if (!fs.existsSync(HONK_VERIFIER_SRC)) {
        console.error(`\n✗ HonkVerifier.sol not found at ${HONK_VERIFIER_SRC}`);
        process.exit(1);
    }
    console.log("✓ HonkVerifier.sol generated -> target/HonkVerifier.sol");

    // ── Step 7: Copy verifier to contracts/ ──────────────────────────────────
    console.log("\n── Copying HonkVerifier.sol -> contracts/ ──────────────────────");
    copyWithWarning(HONK_VERIFIER_SRC, HONK_VERIFIER_DST);
    console.log(`✓ Copied to contracts/HonkVerifier.sol`);

    // ── Step 8: Copy compiled JSON to frontend ────────────────────────────────
    console.log("\n── Copying circuit artifact -> src/lib/circuits/ ────────────────");
    if (!fs.existsSync(FRONTEND_CIRCUITS_DIR)) {
        fs.mkdirSync(FRONTEND_CIRCUITS_DIR, { recursive: true });
    }
    fs.copyFileSync(COMPILED_JSON, FRONTEND_JSON_DST);
    console.log(`✓ Copied to src/lib/circuits/eligibility_proof.json`);

    // ── Step 9: VK fingerprint for frontend preflight ─────────────────────────
    const crypto = require("crypto");
    const vkHash = crypto.createHash("sha256").update(fs.readFileSync(VK_FILE)).digest("hex");
    const fingerprint = {
        sha256: vkHash,
        circuitSize: 1024,
        publicInputs: 4,
        verifierTarget: "evm-no-zk",
        noirVersion: NOIR_VERSION,
        bbVersion: BB_VERSION,
        generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(VK_FINGERPRINT_DST, JSON.stringify(fingerprint, null, 2));
    console.log(`✓ VK fingerprint -> src/lib/circuits/vk_fingerprint.json (${vkHash.slice(0, 12)}…)`);

    console.log("\n── Generating HonkVerifier.sol (bb.js evm-no-zk) ───────────────");
    run("npm run generate:honk-verifier", path.join(__dirname, ".."));

    printDone();
}

function printDone() {
    console.log("\n================================================================");
    console.log("  CIRCUIT BUILD COMPLETE");
    console.log("================================================================");
    console.log("  Next steps:");
    console.log("  1. npx hardhat compile");
    console.log("  2. npx hardhat run scripts/deploy-verifier.ts --network sepolia");
    console.log("  3. npx hardhat run scripts/set-verifier.ts    --network sepolia");
    console.log("================================================================\n");
}

main().catch((err) => {
    console.error("\n✗ Build failed:", err.message);
    process.exit(1);
});
