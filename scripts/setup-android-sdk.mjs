#!/usr/bin/env node
/**
 * Install Android SDK command-line tools (no Android Studio required).
 * Creates android/local.properties and installs packages for Capacitor builds.
 *
 * Usage: node scripts/setup-android-sdk.mjs
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { get } from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const SDK_ROOT = process.env.ANDROID_HOME || path.join(homedir(), "Android", "Sdk");
const CMD_TOOLS_URL =
  "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip";
const PACKAGES = [
  "platform-tools",
  "platforms;android-36",
  "build-tools;36.0.0",
];

function log(msg) {
  console.log(`[android-sdk] ${msg}`);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error("Redirect without location"));
        return resolve(download(loc, dest));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const file = createWriteStream(dest);
      pipeline(res, file).then(resolve).catch(reject);
    }).on("error", reject);
  });
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function sdkmanagerPath() {
  const candidates = [
    path.join(SDK_ROOT, "cmdline-tools", "latest", "bin", "sdkmanager.bat"),
    path.join(SDK_ROOT, "cmdline-tools", "bin", "sdkmanager.bat"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("sdkmanager not found after install");
  return found;
}

function writeLocalProperties() {
  const propsPath = path.join(root, "android", "local.properties");
  const escaped = SDK_ROOT.replace(/\\/g, "\\\\");
  writeFileSync(propsPath, `sdk.dir=${escaped}\n`, "utf8");
  log(`Wrote ${propsPath}`);
}

async function ensureCmdlineTools() {
  const sdkmanager = path.join(SDK_ROOT, "cmdline-tools", "latest", "bin", "sdkmanager.bat");
  if (existsSync(sdkmanager)) {
    log("Command-line tools already present");
    return;
  }

  mkdirSync(SDK_ROOT, { recursive: true });
  const zipPath = path.join(SDK_ROOT, "cmdline-tools.zip");
  log(`Downloading command-line tools to ${SDK_ROOT}...`);
  await download(CMD_TOOLS_URL, zipPath);

  const AdmZip = (() => {
    try {
      return require("adm-zip");
    } catch {
      log("Extracting with PowerShell Expand-Archive...");
      run("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${path.join(SDK_ROOT, "cmdline-tools-tmp").replace(/'/g, "''")}' -Force`,
      ]);
      const extracted = path.join(SDK_ROOT, "cmdline-tools-tmp", "cmdline-tools");
      const latest = path.join(SDK_ROOT, "cmdline-tools", "latest");
      mkdirSync(path.dirname(latest), { recursive: true });
      run("powershell", [
        "-NoProfile",
        "-Command",
        `Move-Item -Path '${extracted.replace(/'/g, "''")}' -Destination '${latest.replace(/'/g, "''")}' -Force`,
      ]);
      return null;
    }
  })();

  if (AdmZip) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(path.join(SDK_ROOT, "cmdline-tools-tmp"), true);
    const extracted = path.join(SDK_ROOT, "cmdline-tools-tmp", "cmdline-tools");
    const latest = path.join(SDK_ROOT, "cmdline-tools", "latest");
    mkdirSync(path.dirname(latest), { recursive: true });
    run("powershell", [
      "-NoProfile",
      "-Command",
      `Move-Item -Path '${extracted.replace(/'/g, "''")}' -Destination '${latest.replace(/'/g, "''")}' -Force`,
    ]);
  }

  log("Command-line tools installed");
}

function acceptLicenses() {
  const sm = sdkmanagerPath();
  log("Accepting SDK licenses...");
  const yes = spawnSync("powershell", [
    "-NoProfile",
    "-Command",
    `1..100 | ForEach-Object { 'y' } | & '${sm.replace(/'/g, "''")}' --licenses`,
  ], { stdio: "inherit", shell: true });
  if (yes.status !== 0) {
    log("License prompt may need manual confirmation; continuing...");
  }
}

function installPackages() {
  const sm = sdkmanagerPath();
  log(`Installing: ${PACKAGES.join(", ")}`);
  run(sm, PACKAGES);
}

async function main() {
  log(`SDK root: ${SDK_ROOT}`);
  if (!process.env.ANDROID_HOME) {
    log(`Set ANDROID_HOME=${SDK_ROOT} in your environment for future shells`);
  }

  await ensureCmdlineTools();
  acceptLicenses();
  installPackages();
  writeLocalProperties();

  log("Done. Build APK with: npm run mobile:apk:debug");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
