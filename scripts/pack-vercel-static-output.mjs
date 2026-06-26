/**
 * Build Output API v3 layout from `vite build` output — no `vercel build` (avoids Windows
 * `spawn cmd.exe ENOENT` inside the Vercel CLI after deps install).
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const output = path.join(root, '.vercel', 'output');
const staticDir = path.join(output, 'static');

if (!existsSync(dist)) {
  console.error('dist/ not found. Run: npm run build');
  process.exit(1);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(dist, staticDir, { recursive: true });

const ZAMA_RELAYER_SEPOLIA = 'https://relayer.testnet.zama.org';

/** Same as vite.config.ts `/api/relayer/11155111` proxy — required for production (prebuilt deploy reads this, not vercel.json). */
const config = {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '^/api/relayer/11155111$', dest: ZAMA_RELAYER_SEPOLIA },
    { src: '^/api/relayer/11155111/(.*)$', dest: `${ZAMA_RELAYER_SEPOLIA}/$1` },
    { src: '/.*', dest: '/index.html' },
  ],
};

writeFileSync(path.join(output, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log('Packed dist/ -> .vercel/output/static + config.json');
