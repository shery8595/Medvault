import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
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
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'tfhe/tfhe_bg.wasm': path.resolve(__dirname, 'public/tfhe_bg.wasm'),
        'tkms/kms_lib_bg.wasm': path.resolve(__dirname, 'public/kms_lib_bg.wasm'),
        'fetch-retry': path.resolve(__dirname, 'node_modules/fetch-retry/index.js'),
      },
    },
    optimizeDeps: {
      include: ['keccak', 'readable-stream', 'buffer', 'fetch-retry'],
      exclude: ['@zama-fhe/relayer-sdk', 'tfhe', 'tkms'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      target: 'esnext',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    assetsInclude: ['**/*.wasm'],
  };
});
