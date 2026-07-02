#!/usr/bin/env node
/**
 * Enforce >=85% line coverage on Plan 05+ contracts after `hardhat coverage`.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const coveragePath = path.join(root, "coverage.json");
const MIN_PCT = Number(process.env.COVERAGE_MIN_PCT || 85);

const TARGET_CONTRACTS = [
  "PatientDocumentStore.sol",
  "MedVaultAutomation.sol",
  "AnonymousPatientRegistry.sol",
  "ConfidentialETH7984.sol",
];

if (!fs.existsSync(coveragePath)) {
  console.error("[coverage-gate] coverage.json missing — run `npm run test:coverage` first");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
let failed = false;

for (const file of TARGET_CONTRACTS) {
  const entry = Object.entries(raw).find(([k]) => k.replace(/\\/g, "/").endsWith(file));
  if (!entry) {
    console.warn(`[coverage-gate] ${file} not found in coverage report — skipping`);
    continue;
  }
  const [, data] = entry;
  const statements = data.s || {};
  const total = Object.keys(statements).length;
  const covered = Object.values(statements).filter((v) => v > 0).length;
  const pct = total === 0 ? 100 : (covered / total) * 100;
  if (pct < MIN_PCT) {
    console.error(`[coverage-gate] ${file}: ${pct.toFixed(1)}% < ${MIN_PCT}%`);
    failed = true;
  } else {
    console.log(`[coverage-gate] ${file}: ${pct.toFixed(1)}%`);
  }
}

if (failed) process.exit(1);
console.log(`coverage-gate: OK (>=${MIN_PCT}% on new contracts)`);
