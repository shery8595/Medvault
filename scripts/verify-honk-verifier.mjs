#!/usr/bin/env node
/**
 * CI guard: committed Honk verifiers match circuit target artifacts when present.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const verifiers = [
    {
        name: "plaintext",
        committed: path.join(root, "contracts/HonkVerifier.sol"),
        generated: path.join(root, "circuits/eligibility_plaintext/target/HonkVerifier.sol"),
        userInputs: 25,
        engineConst: "ELIGIBILITY_PUBLIC_INPUT_COUNT",
    },
    {
        name: "encrypted",
        committed: path.join(root, "contracts/HonkVerifierEncrypted.sol"),
        generated: path.join(root, "circuits/eligibility_encrypted/target/HonkVerifier.sol"),
        userInputs: 15,
        engineConst: "ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT",
    },
];
const engineSol = path.join(root, "contracts/EligibilityEngine.sol");
const vkFingerprintFile = path.join(root, "src/lib/circuits/vk_fingerprint.json");
const PAIRING_POINTS_SIZE = 8;

const extractConst = (src, name) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*(?:hex"([0-9a-f]+)"|(\\d+))`, "i"));
    if (!m) return null;
    return m[1] ?? m[2];
};

const extractVk = (src) => {
    const m = src.match(/VK_HASH\s*=\s*0x([0-9a-f]+)/i);
    return m ? m[1].toLowerCase() : null;
};

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

for (const v of verifiers) {
    if (!fs.existsSync(v.committed)) {
        console.error(`Missing ${v.committed}`);
        process.exit(1);
    }

    const honkSrc = fs.readFileSync(v.committed, "utf8");
    const numberOfPublicInputs = Number(extractConst(honkSrc, "NUMBER_OF_PUBLIC_INPUTS"));
    const userPublicInputs = numberOfPublicInputs - PAIRING_POINTS_SIZE;

    if (!Number.isFinite(userPublicInputs) || userPublicInputs !== v.userInputs) {
        console.error(
            `${v.name} HonkVerifier user public input count mismatch: got ${userPublicInputs}, expected ${v.userInputs}`
        );
        process.exit(1);
    }

    if (fs.existsSync(v.generated)) {
        const generatedSrc = fs.readFileSync(v.generated, "utf8");
        const vkCommitted = extractVk(honkSrc);
        const vkGenerated = extractVk(generatedSrc);
        if (vkCommitted && vkGenerated && vkCommitted !== vkGenerated) {
            console.error(`${v.name} VK_HASH mismatch:\n  committed=${vkCommitted}\n  generated=${vkGenerated}`);
            process.exit(1);
        }
    }
}

if (fs.existsSync(engineSol)) {
    const engineSrc = fs.readFileSync(engineSol, "utf8");
    for (const v of verifiers) {
        const engineCount = Number(extractConst(engineSrc, v.engineConst));
        if (engineCount !== v.userInputs) {
            console.error(`EligibilityEngine.${v.engineConst}=${engineCount} != ${v.userInputs}`);
            process.exit(1);
        }
    }
}

if (fs.existsSync(vkFingerprintFile)) {
    const fp = JSON.parse(fs.readFileSync(vkFingerprintFile, "utf8"));
    for (const v of verifiers) {
        const entry = fp[v.name];
        if (!entry?.sha256) continue;
        // Fingerprint sha256 is the verification-key digest from bb.js, not the .sol file hash.
        if (typeof entry.sha256 !== "string" || entry.sha256.length !== 64) {
            console.error(`${v.name} vk_fingerprint.sha256 is invalid`);
            process.exit(1);
        }
    }
}

console.log("verify-honk-verifier: OK");
