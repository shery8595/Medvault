#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCTOR_ENTRY = path.join(__dirname, "../dist/doctor-cli.js");

const child = spawn("node", [DOCTOR_ENTRY], {
  stdio: "inherit",
  env: process.env,
  cwd: path.resolve(__dirname, "../.."),
});

child.on("exit", (code) => process.exit(code ?? 1));
