#!/usr/bin/env node
/**
 * Smoke test: docker compose up frontend, wait for :3000, tear down.
 * Requires Docker. Does not start optional relayer/graph profiles.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const COMPOSE = process.platform === "win32" ? "docker compose" : "docker compose";
const MAX_WAIT_MS = 180_000;
const POLL_MS = 3_000;

async function waitForFrontend() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch("http://127.0.0.1:3000/");
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(POLL_MS);
  }
  return false;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function main() {
  console.log("[docker-smoke] building and starting frontend...");
  await run(COMPOSE, ["up", "--build", "-d", "frontend"]);
  try {
    console.log("[docker-smoke] waiting for http://localhost:3000 ...");
    const ok = await waitForFrontend();
    if (!ok) throw new Error("frontend did not become healthy in time");
    console.log("[docker-smoke] frontend healthy");
  } finally {
    console.log("[docker-smoke] tearing down...");
    await run(COMPOSE, ["down", "--remove-orphans"]).catch(() => {});
  }
}

main().catch((err) => {
  console.error("[docker-smoke] failed:", err.message);
  process.exit(1);
});
