#!/usr/bin/env node
/**
 * Grep-based guardrails for post-remediation documentation consistency.
 * Run: node scripts/verify-doc-consistency.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["docs", join("src", "pages", "docs")];

const errors = [];
const warnings = [];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(md|mdx|tsx)$/i.test(name)) files.push(p);
  }
  return files;
}

function lineContext(text, index, radius = 120) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function checkFile(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/");
  const text = readFileSync(filePath, "utf8");

  for (const m of text.matchAll(/requestConfidentialStake|completeConfidentialStake/g)) {
    const ctx = lineContext(text, m.index ?? 0);
    if (!/deprecated|Use stakeAndLock|revert/i.test(ctx)) {
      errors.push(`${rel}: "${m[0]}" without deprecated/stakeAndLock context`);
    }
  }

  if (/updateDocumentKey/.test(text) && !/rotateDocument/.test(text)) {
    errors.push(`${rel}: mentions updateDocumentKey without rotateDocument`);
  }

  if (/finalizeAnonymousApplyWithProof/.test(text)) {
    const patientFacing =
      /patient.*finalize|wallet.*finalize|EOA.*finalize|from their wallet/i.test(text) &&
      !/relayer|onlyTrustedRelayer|POST \/relay/i.test(text);
    if (patientFacing) {
      warnings.push(`${rel}: patient-facing finalizeAnonymousApplyWithProof without relayer context`);
    }
  }

  if (/registerAnonymousParticipant/.test(text) && /sponsor/i.test(text)) {
    const ctx = lineContext(text, text.indexOf("registerAnonymousParticipant"));
    if (
      /sponsor.*registerAnonymousParticipant|registerAnonymousParticipant.*sponsor/i.test(ctx) &&
      !/permit-holder|permit holder|MED-3|cannot|revert|not a sponsor/i.test(ctx)
    ) {
      warnings.push(`${rel}: sponsor + registerAnonymousParticipant without MED-3 caveat`);
    }
  }

  if (/registerPatient\s*\(/.test(text) && !/profileSaltCommitment|profileSalt/.test(text)) {
    if (!/registerPatientClear|registerPatientOnRegistry|grep|verify-doc/i.test(text)) {
      warnings.push(`${rel}: registerPatient example may omit profileSaltCommitment`);
    }
  }
}

for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir);
  try {
    for (const f of walk(abs)) checkFile(f);
  } catch (e) {
    if (e.code === "ENOENT") warnings.push(`Skip missing dir: ${dir}`);
    else throw e;
  }
}

console.log("Doc consistency check");
console.log("=====================");
if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (errors.length) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`\nOK (${warnings.length} warning(s))`);
