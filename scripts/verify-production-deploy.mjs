#!/usr/bin/env node
/**
 * CI guard: production deploy scripts must not reference Mock* contracts.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const deployFiles = [
  "scripts/deploy.ts",
  "scripts/resume-sepolia-deploy.ts",
];

const forbidden = [/MockSemaphore/i, /MockAave/i, /contracts\/test\//i];
let failed = false;

for (const rel of deployFiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`[verify-production-deploy] ${rel} references forbidden pattern ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("verify-production-deploy: OK (no Mock* in production deploy scripts)");
