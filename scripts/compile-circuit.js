/**
 * MedVault — Noir dual-circuit build entrypoint.
 *
 * Compiles eligibility_plaintext + eligibility_encrypted with nargo, copies JSON
 * artifacts to src/lib/circuits/, then runs generate-honk-verifier.js to emit
 * contracts/HonkVerifier.sol and contracts/HonkVerifierEncrypted.sol.
 *
 * Prerequisites (Noir v1 + Keccak bb — matches package.json):
 *   - nargo 1.0.0-beta.21  ->  noirup --version 1.0.0-beta.21
 *   - bb    5.0.0-nightly.20260324  ->  bbup -v 5.0.0-nightly.20260324
 *
 * Usage: npm run build:circuit
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WSL_SCRIPT = path.join(__dirname, "compile-circuit-wsl.sh");

function run(cmd, cwd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit", shell: opts.shell !== false });
}

function toWslPath(winPath) {
    const resolved = path.resolve(winPath);
    const m = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
    if (!m) return resolved.replace(/\\/g, "/");
    return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}

async function main() {
    console.log("\n── Noir dual-circuit build (plaintext + encrypted) ───────────────");

    if (process.platform === "win32") {
        const wslScript = toWslPath(WSL_SCRIPT);
        run(`wsl.exe sed -i "s/\\r$//" ${wslScript}`, __dirname, { shell: false });
        run(`wsl.exe bash ${wslScript}`, __dirname, { shell: false });
    } else {
        run(`bash "${WSL_SCRIPT}"`, __dirname);
    }

    console.log("\n── Generating HonkVerifier.sol + HonkVerifierEncrypted.sol (bb.js) ──");
    run("npm run generate:honk-verifier", ROOT);

    printDone();
}

function printDone() {
    console.log("\n================================================================");
    console.log("  CIRCUIT BUILD COMPLETE");
    console.log("================================================================");
    console.log("  Artifacts:");
    console.log("    src/lib/circuits/eligibility_plaintext.json");
    console.log("    src/lib/circuits/eligibility_encrypted.json");
    console.log("    src/lib/circuits/eligibility_proof.json (plaintext alias)");
    console.log("    contracts/HonkVerifier.sol");
    console.log("    contracts/HonkVerifierEncrypted.sol");
    console.log("    src/lib/circuits/vk_fingerprint.json");
    console.log("  Next steps:");
    console.log("  1. npm run compile");
    console.log("  2. npm run deploy:sepolia  (or deploy:encrypted-verifier:sepolia to patch)");
    console.log("  3. npm run deploy:wiring:sepolia  (after 6h timelock)");
    console.log("================================================================\n");
}

main().catch((err) => {
    console.error("\n✗ Build failed:", err.message);
    process.exit(1);
});
