# MedVault Android APK

Build an installable **Android demo APK** from the existing Vite React dapp using [Capacitor 8](https://capacitorjs.com/). The APK bundles the same Privy + Zama FHE + Semaphore + Noir stack as the web app inside an Android WebView.

**Scope:** internal/demo sideload distribution — not Google Play production (yet).

See also: [MOBILE_ARCHITECTURE.md](./MOBILE_ARCHITECTURE.md) for how the mobile shell differs from the web build.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start (Android Studio — recommended)](#quick-start-android-studio--recommended)
3. [Quick start (CLI only)](#quick-start-cli-only)
4. [Build outputs](#build-outputs)
5. [npm scripts](#npm-scripts)
6. [Environment & API URLs](#environment--api-urls)
7. [Privy & relayer configuration](#privy--relayer-configuration)
8. [Signing & distribution](#signing--distribution)
9. [Tester install guide](#tester-install-guide)
10. [Acceptance checklist](#acceptance-checklist)
11. [Troubleshooting](#troubleshooting)
12. [Key files](#key-files)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Node.js 20+ | Same as web app |
| `.env` with `VITE_PRIVY_APP_ID` | Baked into the APK at build time |
| **JDK 21** | Capacitor Android requires Java 21. Android Studio bundles JDK 21 (`jbr`). System JDK 17 alone will fail with `invalid source release: 21`. |
| **Android SDK** | Installed via [Android Studio](https://developer.android.com/studio) (recommended) or command-line tools |
| Privy dashboard | Allow origin **`https://localhost`** (Capacitor Android WebView) |
| Railway relayer | `FRONTEND_URL=https://med-vault.xyz,https://localhost` for CORS |

### One-time machine setup (Android Studio)

1. Install Android Studio from [developer.android.com/studio](https://developer.android.com/studio).
2. Open Studio once → complete setup wizard → install SDK platforms (API 36) and Build-Tools.
3. Create `android/local.properties` (gitignored):

   ```properties
   sdk.dir=C\:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
   ```

   On Windows the SDK is usually `%LOCALAPPDATA%\Android\Sdk`, **not** `C:\Users\you\Android\Sdk`.

4. `android/gradle.properties` already points Gradle at Android Studio's JDK 21 on Windows. On macOS/Linux, set:

   ```properties
   org.gradle.java.home=/Applications/Android Studio.app/Contents/jbr/Contents/Home
   ```

---

## Quick start (Android Studio — recommended)

```bash
npm install

# First time only (if android/ folder missing):
npm run build:mobile
npx cap add android

# Sync web build + open Android Studio:
npm run mobile:studio
```

In **Android Studio**:

1. Wait for **Gradle sync** to finish.
2. Select an emulator or USB device (USB debugging enabled).
3. **Run** ▶ to install and launch.

**Build APK file:** **Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## Quick start (CLI only)

No Android Studio UI required — still needs the Android SDK on disk.

```bash
npm install

# One-time SDK install (or use Android Studio / manual download — see below)
npm run mobile:sdk:setup

# Ensure android/local.properties exists with correct sdk.dir

# Build web assets + sync + compile APK:
npm run mobile:apk:debug
```

### Manual SDK download (slow networks)

If `mobile:sdk:setup` times out, download in a browser:

1. [Command-line tools (Windows)](https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip)
2. Extract to `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\`
3. Run `sdkmanager` for `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`
4. Create `android/local.properties` (see above)
5. `npm run mobile:apk:debug`

Gradle 8.14.3 is cached after the first successful `gradlew` run — do not re-download.

---

## Build outputs

| Artifact | Path |
|----------|------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` (needs signing) |

Typical debug APK size: **~33 MB** (includes WASM/crypto assets).

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `mobile:studio` | **Recommended** — `mobile:build` + open Android Studio |
| `mobile:build` | `build:mobile` + `mobile:sync` |
| `build:mobile` | Vite production build with `base: './'` for Capacitor |
| `mobile:sync` | Copy `dist/` → `android/app/src/main/assets/` |
| `mobile:open` | Open Android Studio without rebuilding |
| `mobile:apk:debug` | Full CLI pipeline → debug APK |
| `mobile:apk:release` | Full CLI pipeline → release APK |
| `mobile:sdk:setup` | Install Android SDK command-line tools (CLI-only machines) |

---

## Environment & API URLs

Capacitor cannot use Vite dev-server or Vercel rewrites. The APK calls HTTPS endpoints directly via [`src/lib/mobile.ts`](../src/lib/mobile.ts):

| Service | Web (Vercel / dev proxy) | APK default |
|---------|--------------------------|-------------|
| Zama fhEVM relayer | `/api/relayer/11155111` | `https://relayer.testnet.zama.org` |
| MedVault relayer | `/relay` (dev) or Railway | `https://medvault-relayer-production.up.railway.app` |
| Sepolia RPC | `VITE_RPC_URL` or public default | Same env vars |
| Subgraph | `VITE_SUBGRAPH_URL` | Same env var |

Override before build:

```env
VITE_ZAMA_RELAYER_URL=https://relayer.testnet.zama.org
VITE_RELAYER_URL=https://medvault-relayer-production.up.railway.app
```

Then: `npm run mobile:build` (or `mobile:apk:debug`).

**Security:** all `VITE_*` values are public in the APK bundle. Never ship production secrets (e.g. `VITE_RECLAIM_APP_SECRET`) in distributed APKs.

---

## Privy & relayer configuration

### Privy

1. [Privy dashboard](https://dashboard.privy.io) → your app → **Settings → Domains**
2. Add allowed origin: **`https://localhost`**
3. Prefer **email OTP** login and **embedded wallets** on mobile (browser extensions do not inject into WebView).

### MedVault relayer (Railway)

```env
FRONTEND_URL=https://med-vault.xyz,https://localhost
```

The relayer accepts comma-separated origins (see `relayer/server.js`).

---

## Signing & distribution

### Debug APK (internal testers)

`app-debug.apk` is signed with the automatic debug keystore — fine for demos, not for Play Store.

### Signed demo APK

**Android Studio:** **Build → Generate Signed Bundle / APK → APK**

**CLI:**

```bash
keytool -genkey -v -keystore medvault-demo.keystore -alias medvault -keyalg RSA -keysize 2048 -validity 10000
```

Copy `android/keystore.properties.example` → `android/keystore.properties` (gitignored), then:

```bash
npm run mobile:apk:release
```

Rename for testers: `MedVault-demo-0.1.0-android.apk`.

---

## Tester install guide

1. Receive the APK (Drive, GitHub Release, link, etc.).
2. Android **Settings → Security → Install unknown apps** — allow your file manager or browser.
3. Tap the APK → **Install** → **Open**.
4. Sign in with Privy (email recommended).
5. Fund **Ethereum Sepolia** testnet ETH ([faucets](https://faucet.quicknode.com/ethereum/sepolia)).
6. First FHE/Noir operation may take 30–90s on mid-range phones — normal for WASM crypto.

---

## Acceptance checklist

- [ ] APK installs on emulator and physical device
- [ ] Privy login succeeds (`https://localhost` in dashboard)
- [ ] Embedded wallet created on Sepolia
- [ ] Zama FHE initializes (patient vault / consent)
- [ ] Patient dashboard loads; apply flow works
- [ ] Sponsor dashboard loads without layout breakage
- [ ] Relayer `/health` reachable from device
- [ ] Android back button navigates in-app; minimizes at dashboard root
- [ ] Offline banner when network disabled
- [ ] Crypto fallback banner appears only when WebCrypto AES-GCM unavailable (document encrypt still works)
- [ ] Logout clears session

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank white screen | Re-run `npm run mobile:build`; verify Vite `base: './'` (`CAPACITOR_BUILD=true`) |
| `SDK location not found` | Create `android/local.properties` with correct `sdk.dir` → `%LOCALAPPDATA%\Android\Sdk` on Windows |
| `invalid source release: 21` | Use JDK 21 — set `org.gradle.java.home` in `android/gradle.properties` to Android Studio `jbr` |
| Privy login fails | Add `https://localhost` to Privy allowed origins |
| Relayer CORS error | Add `https://localhost` to Railway `FRONTEND_URL` |
| Zama FHE stuck | Check network; set `VITE_ZAMA_RELAYER_URL`; wait for WASM init |
| Gradle download timeout | Retry — wrapper timeout is 10 min (`android/gradle/wrapper/gradle-wrapper.properties`) |
| Slow first build | Normal — WASM bundle + one-time SDK/Gradle downloads |
| External wallet missing | Expected in WebView — use Privy embedded wallet |

---

## Key files

| File | Role |
|------|------|
| [`capacitor.config.ts`](../capacitor.config.ts) | App id `xyz.medvault.app`, `webDir: dist`, `androidScheme: https` |
| [`vite.config.ts`](../vite.config.ts) | `CAPACITOR_BUILD` → `base: './'` |
| [`src/lib/mobile.ts`](../src/lib/mobile.ts) | Native detection, relayer URL resolution |
| [`src/components/mobile/`](../src/components/mobile/) | Back button, offline banner, launch redirect, crypto fallback |
| [`android/gradle.properties`](../android/gradle.properties) | JDK 21 path for Gradle |
| [`android/local.properties`](../android/local.properties) | SDK path (gitignored, per machine) |
| [`scripts/android-apk.mjs`](../scripts/android-apk.mjs) | Cross-platform CLI APK builder |
| [`scripts/setup-android-sdk.mjs`](../scripts/setup-android-sdk.mjs) | CLI SDK installer |
