#!/usr/bin/env node
/**
 * CLI fallback: build MedVault Android APK (debug or release).
 * Prefer Android Studio: npm run mobile:studio → Build → Build APK(s)
 * Usage: node scripts/android-apk.mjs [debug|release]
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const variant = (process.argv[2] || "debug").toLowerCase();
const task = variant === "release" ? "assembleRelease" : "assembleDebug";

const androidDir = path.join(root, "android");
const gradlew = process.platform === "win32" ? "gradlew.bat" : "gradlew";
const gradlewPath = path.join(androidDir, gradlew);

if (!existsSync(gradlewPath)) {
  console.error(
    "Android project not found. Run: npm run mobile:build (or npx cap add android after npm run build:mobile)"
  );
  process.exit(1);
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "mobile:build"], root);
run(gradlew, [task], androidDir);

const outDir =
  variant === "release"
    ? path.join(androidDir, "app", "build", "outputs", "apk", "release")
    : path.join(androidDir, "app", "build", "outputs", "apk", "debug");

const apkName = variant === "release" ? "app-release.apk" : "app-debug.apk";
const builtApk = path.join(outDir, apkName);
const publicDownloadsDir = path.join(root, "public", "downloads");
const publishedApk = path.join(publicDownloadsDir, "medvault.apk");

if (existsSync(builtApk)) {
  mkdirSync(publicDownloadsDir, { recursive: true });
  copyFileSync(builtApk, publishedApk);
  console.log(`\nPublished web download: ${publishedApk}`);
} else {
  console.warn(`\nWarning: expected APK not found at ${builtApk}`);
}

console.log(`\nAPK output directory: ${outDir}`);
