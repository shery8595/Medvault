import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Smartphone, Download, Shield, Wifi, Wrench } from "lucide-react";

const scripts = [
    { cmd: "npm run mobile:studio", desc: "Build web bundle, sync to android/, open Android Studio (recommended)" },
    { cmd: "npm run mobile:apk:debug", desc: "Full CLI pipeline → debug APK (~33 MB)" },
    { cmd: "npm run mobile:build", desc: "Vite mobile build + cap sync only" },
    { cmd: "npm run mobile:sdk:setup", desc: "One-time Android SDK CLI install (no Studio)" },
];

const troubleshooting = [
    { issue: "Blank white screen", fix: "Re-run mobile:build; Vite must use base './' (CAPACITOR_BUILD=true)" },
    { issue: "SDK location not found", fix: "Create android/local.properties with sdk.dir → %LOCALAPPDATA%\\Android\\Sdk" },
    { issue: "invalid source release: 21", fix: "Use JDK 21 — android/gradle.properties points to Android Studio jbr" },
    { issue: "Privy login fails", fix: "Add https://localhost to Privy dashboard allowed origins" },
    { issue: "Relayer CORS error", fix: "Railway FRONTEND_URL=https://med-vault.xyz,https://localhost" },
    { issue: "External wallet missing", fix: "Expected — use Privy embedded wallet in WebView" },
];

export function AndroidApkDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    MedVault ships as an installable <strong>Android demo APK</strong> using Capacitor. The APK bundles
                    the same React dapp (Privy, Zama FHE, Semaphore, Noir WASM) inside an Android WebView — not a
                    separate native rewrite.
                </p>

                <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-4 gap-3 my-8">
                    {[
                        { icon: Smartphone, title: "Capacitor shell", desc: "App id xyz.medvault.app, https://localhost WebView origin" },
                        { icon: Download, title: "~33 MB debug APK", desc: "android/app/build/outputs/apk/debug/app-debug.apk" },
                        { icon: Shield, title: "Privy + embedded wallet", desc: "Browser extensions do not work in WebView" },
                        { icon: Wifi, title: "Direct HTTPS APIs", desc: "No Vite/Vercel proxy — Zama + relayer over HTTPS" },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
                            <Icon className="h-5 w-5 text-[#00685f] mb-2" aria-hidden />
                            <p className="text-sm font-bold text-slate-900 m-0">{title}</p>
                            <p className="text-xs text-slate-500 mt-1 m-0">{desc}</p>
                        </div>
                    ))}
                </div>

                <Callout type="info" title="Distribution scope">
                    This guide targets <strong>internal/demo sideload APKs</strong> (share file + install unknown apps).
                    Google Play submission is out of scope for the first milestone.
                </Callout>

                <h2>I. Prerequisites</h2>
                <ul>
                    <li>Node.js 20+, <code>VITE_PRIVY_APP_ID</code> in <code>.env</code></li>
                    <li>
                        <strong>JDK 21</strong> — Capacitor Android requires Java 21 (Android Studio bundles it). JDK 17
                        alone fails with <code>invalid source release: 21</code>.
                    </li>
                    <li>
                        <strong>Android SDK</strong> — install via{" "}
                        <a href="https://developer.android.com/studio" target="_blank" rel="noreferrer">
                            Android Studio
                        </a>{" "}
                        (recommended) or command-line tools
                    </li>
                    <li>
                        Privy dashboard: allow <code>https://localhost</code>
                    </li>
                    <li>
                        Relayer <code>FRONTEND_URL</code> includes <code>https://localhost</code> (comma-separated)
                    </li>
                </ul>

                <h2>II. Quick start (Android Studio)</h2>
                <CodeBlock
                    language="bash"
                    filename="Terminal"
                    code={`npm install

# First time only (if android/ missing):
npm run build:mobile
npx cap add android

# Sync + open Studio:
npm run mobile:studio`}
                />
                <p>
                    In Android Studio: wait for Gradle sync → select device → <strong>Run</strong> ▶. For an APK file:{" "}
                    <strong>Build → Build Bundle(s) / APK(s) → Build APK(s)</strong>.
                </p>

                <h2>III. Quick start (CLI only)</h2>
                <CodeBlock
                    language="bash"
                    filename="Terminal"
                    code={`npm run mobile:sdk:setup   # one-time SDK (or use Android Studio)
# Create android/local.properties → sdk.dir=...AppData\\Local\\Android\\Sdk

npm run mobile:apk:debug`}
                />
                <p>
                    Output: <code>android/app/build/outputs/apk/debug/app-debug.apk</code>
                </p>

                <Callout type="warning" title="local.properties path">
                    On Windows the SDK is usually <code>%LOCALAPPDATA%\Android\Sdk</code> — not{" "}
                    <code>C:\Users\you\Android\Sdk</code>. Copy{" "}
                    <code>android/local.properties.example</code> and set your username.
                </Callout>

                <h2>IV. npm scripts</h2>
                <div className="not-prose rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 my-6">
                    {scripts.map((s) => (
                        <div key={s.cmd} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 bg-white">
                            <code className="text-xs font-mono text-[#00685f] shrink-0">{s.cmd}</code>
                            <span className="text-sm text-slate-600">{s.desc}</span>
                        </div>
                    ))}
                </div>

                <h2>V. Environment &amp; API URLs</h2>
                <p>
                    Capacitor cannot use Vite dev proxies or Vercel rewrites.{" "}
                    <code>src/lib/mobile.ts</code> resolves endpoints at runtime:
                </p>
                <div className="not-prose overflow-x-auto my-6">
                    <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-left">
                            <tr>
                                <th className="px-4 py-2 font-semibold text-slate-700">Service</th>
                                <th className="px-4 py-2 font-semibold text-slate-700">Web</th>
                                <th className="px-4 py-2 font-semibold text-slate-700">APK default</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="px-4 py-2">Zama relayer</td>
                                <td className="px-4 py-2 font-mono text-xs">/api/relayer/11155111</td>
                                <td className="px-4 py-2 font-mono text-xs">relayer.testnet.zama.org</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-2">MedVault relayer</td>
                                <td className="px-4 py-2 font-mono text-xs">/relay (dev proxy)</td>
                                <td className="px-4 py-2 font-mono text-xs">medvault-relayer-production.up.railway.app</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Override with <code>VITE_ZAMA_RELAYER_URL</code> and <code>VITE_RELAYER_URL</code> before{" "}
                    <code>npm run mobile:build</code>. All <code>VITE_*</code> values are public in the APK — never ship
                    production secrets.
                </p>

                <h2>VI. Mobile-only behavior</h2>
                <ul>
                    <li>
                        <strong>Launch route</strong> — native app redirects <code>/</code> → patient dashboard (skips
                        heavy marketing landing)
                    </li>
                    <li>
                        <strong>Android back</strong> — in-app navigation; minimizes at dashboard root
                    </li>
                    <li>
                        <strong>Offline banner</strong> — shown when network unavailable
                    </li>
                    <li>
                        <strong>Native hints</strong> — wallet/FHE setup guidance in dashboard shell
                    </li>
                </ul>
                <p>
                    Architecture details: repo <code>docs/MOBILE_ARCHITECTURE.md</code> and{" "}
                    <Link to="/docs/frontend" className="text-[#00685f] font-semibold">
                        Frontend architecture
                    </Link>
                    .
                </p>

                <h2>VII. Tester install</h2>
                <ol>
                    <li>Download the APK (Drive, GitHub Release, etc.)</li>
                    <li>Enable <strong>Install unknown apps</strong> for your file source</li>
                    <li>Install → Open → Privy login (email OTP)</li>
                    <li>Fund Sepolia testnet ETH for on-chain actions</li>
                </ol>

                <h2>VIII. Troubleshooting</h2>
                <div className="not-prose rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 my-6">
                    {troubleshooting.map((row) => (
                        <div key={row.issue} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 px-4 py-3 bg-white text-sm">
                            <span className="font-semibold text-slate-800 flex items-center gap-2">
                                <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
                                {row.issue}
                            </span>
                            <span className="text-slate-600">{row.fix}</span>
                        </div>
                    ))}
                </div>

                <Callout type="tip" title="Repo markdown">
                    Full build guide with signing, acceptance checklist, and manual SDK download:{" "}
                    <code>docs/ANDROID_APK.md</code> in the GitHub repository.
                </Callout>
            </Prose>
        </motion.div>
    );
}
