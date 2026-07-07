import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

/** Zama fhEVM relayer API (Sepolia). Proxied same-origin in dev + Vercel prebuilt routes. */
const ZAMA_RELAYER_SEPOLIA = 'https://relayer.testnet.zama.org';

/** Hybrid indexer on Railway — proxied as /indexer in dev (matches vercel.json). */
const INDEXER_RAILWAY = 'https://indexermedvault-production.up.railway.app';

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const medVaultRelayerProxy =
    env.VITE_RELAYER_URLS?.split(',')[0]?.trim().replace(/\/$/, '') ||
    env.VITE_RELAYER_URL?.trim().replace(/\/$/, '') ||
    'https://relayer-medvault-1-production.up.railway.app';
  const sepoliaRpc =
    env.VITE_SEPOLIA_RPC_URL?.trim() ||
    env.VITE_RPC_URL?.trim() ||
    env.SEPOLIA_RPC_URL?.trim() ||
    'https://ethereum-sepolia-rpc.publicnode.com';
  return {
    base: isCapacitorBuild ? './' : '/',
    plugins: [
      react(),
      tailwindcss(),
      nodePolyfills({
        include: ['buffer', 'crypto', 'stream', 'util', 'process', 'events'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      wasm(),
      topLevelAwait(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SEPOLIA_RPC_URL': JSON.stringify(sepoliaRpc),
    },
    resolve: {
      dedupe: [
        'viem',
        'ox',
        'ethers',
        'recharts',
        'd3-color',
        'd3-interpolate',
        'd3-scale',
        'd3-shape',
        'd3-time',
        'd3-time-format',
      ],
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Noir certify: use bb.js browser bundle so barretenberg .wasm URLs resolve correctly
        '@aztec/bb.js': path.resolve(__dirname, 'node_modules/@aztec/bb.js/dest/browser/index.js'),
        'fetch-retry': path.resolve(__dirname, 'node_modules/fetch-retry/index.js'),
        // ⚠️ Critical browser compat fixes:
        // readable-stream v4 (top-level) has a different file structure (lib/ours/) but keccak
        // expects the v3 structure (lib/_stream_*.js). Alias to stream-browserify's own v3 copy.
        'readable-stream': path.resolve(__dirname, 'node_modules/stream-browserify/node_modules/readable-stream'),
        'keccak': path.resolve(__dirname, 'node_modules/keccak/js.js'),
        'crypto': path.resolve(__dirname, 'node_modules/crypto-browserify'),
      },
    },
    optimizeDeps: {
      include: [
        'keccak',
        'buffer',
        'fetch-retry',
        'stream-browserify',
        'crypto-browserify',
        '@xyflow/react',
        '@xyflow/system',
        'recharts',
      ],
      exclude: [
        '@zama-fhe/sdk',
        '@zama-fhe/react-sdk',
        '@aztec/bb.js',
        '@noir-lang/noir_js',
        '@noir-lang/acvm_js',
        '@noir-lang/noirc_abi',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        maxParallelFileOps: 1,
        output: {
          manualChunks(id) {
            if (
              /[\\/]node_modules[\\/](d3-[^\\/]+|victory-vendor|internmap)[\\/]/.test(id)
            ) {
              return 'd3-vendor';
            }
          },
        },
        onwarn(warning, defaultHandler) {
          const msg = warning.message ?? '';
          if (msg.includes('annotation that Rollup cannot interpret')) return;
          if (msg.includes('#__PURE__') && msg.includes('cannot interpret')) return;
          defaultHandler(warning);
        },
      },
    },
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      // `npm run dev` binds 0.0.0.0 for LAN/Docker; pin HMR WS to localhost for browser tabs.
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : {
              host: env.VITE_HMR_HOST?.trim() || 'localhost',
              port: Number(env.VITE_HMR_PORT ?? 3000),
              clientPort: Number(env.VITE_HMR_CLIENT_PORT ?? env.VITE_HMR_PORT ?? 3000),
            },
      // Do NOT set COOP/COEP to crossOriginIsolate here. That breaks Privy embedded wallets,
      // Coinbase Smart Wallet, and Base Account SDKs (popups / cross-window messaging).
      proxy: {
        // Zama fhEVM relayer v2 API — same-origin path required by @zama-fhe/sdk (RelayerWeb)
        '/api/relayer/11155111/v2': {
          target: ZAMA_RELAYER_SEPOLIA,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/relayer\/11155111/, ''),
          secure: true,
        },
        // MedVault anonymous-apply relayer (Semaphore proofs, completion-proof, etc.)
        '/relay': {
          target: medVaultRelayerProxy,
          changeOrigin: true,
          secure: true,
        },
        '/ai-service': {
          target: 'http://127.0.0.1:3200',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-service/, ''),
        },
        '/indexer': {
          target:
            env.VITE_INDEXER_URL?.trim().startsWith('http://127.0.0.1') ||
            env.VITE_INDEXER_URL?.trim().startsWith('http://localhost')
              ? env.VITE_INDEXER_URL.trim().replace(/\/$/, '')
              : INDEXER_RAILWAY,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/indexer/, ''),
          secure: true,
        },
      },
    },
    worker: {
      format: 'es',
    },
    assetsInclude: ['**/*.wasm'],
    test: {
      environment: 'node',
      include: ['src/lib/__tests__/**/*.test.ts'],
    },
  };
});
