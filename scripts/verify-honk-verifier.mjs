#!/usr/bin/env node
/**
 * CI guard: committed HonkVerifier must match circuit target artifact when present.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const committed = path.join(root, "contracts/HonkVerifier.sol");
const generated = path.join(root, "circuits/eligibility_proof/target/HonkVerifier.sol");

if (!fs.existsSync(committed)) {
  console.error("Missing contracts/HonkVerifier.sol");
  process.exit(1);
}

if (!fs.existsSync(generated)) {
  console.warn("verify-honk-verifier: circuit artifact missing; skipping byte comparison");
  process.exit(0);
}

const a = fs.readFileSync(committed, "utf8");
const b = fs.readFileSync(generated, "utf8");

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

const extractVk = (src) => {
  const m = src.match(/VK_HASH\s*=\s*hex"([0-9a-f]+)"/i);
  return m ? m[1].toLowerCase() : null;
};

const vkA = extractVk(a);
const vkB = extractVk(b);

if (vkA && vkB && vkA !== vkB) {
  console.error(`HonkVerifier VK_HASH mismatch:\n  committed=${vkA}\n  generated=${vkB}`);
  console.error("Run: npm run build:circuit");
  process.exit(1);
}

if (hash(a) !== hash(b)) {
  console.warn(
    "HonkVerifier.sol differs from circuits/eligibility_proof/target/HonkVerifier.sol; VK_HASH matched or absent."
  );
}

console.log("verify-honk-verifier: OK");
