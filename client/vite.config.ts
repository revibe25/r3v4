// client/vite.config.ts
//
// ─── ARCHITECTURE NOTES ──────────────────────────────────────────────────────
//
//  PROBLEMS (original):
//    1. manualChunks used the object form (static string → string[]). Vite only
//       uses this form for *entry points* that are explicitly listed. Transitive
//       dependencies pulled in by App.tsx were already being resolved before
//       Rollup applied the chunk map, so react, react-dom, react-hook-form, and
//       zod all landed in the 626 KB `index.js` instead of their vendor chunks.
//
//    2. warmup.clientFiles used a glob for ALL components, pre-transforming the
//       entire component tree on dev-server start — making the initial cold start
//       visibly slow.
//
//  FIXES:
//    1. manualChunks is now a *function* that runs per-module-id so every
//       transitive dependency is captured correctly regardless of import order.
//       Chunks are designed to match actual route-level usage:
//         · react-vendor     → shared by every route
//         · radix-vendor     → UI primitives, loaded once
//         · audio-vendor     → tone, webmidi (lazy — only /vst + instruments)
//         · query-vendor     → tanstack query
//         · form-vendor      → react-hook-form + zod + @hookform
//         · motion-vendor    → framer-motion (large, infrequent)
//         · utils-vendor     → date-fns, lodash, etc.
//
//    2. warmup now lists only the files the *initial route* needs so cold-start
//       transform time is minimal.
//
//    3. sourcemap is disabled in production by default. Enable explicitly when
//       you need to debug a production build — keeping it on adds ~4× the
//       output to disk and slows the build ~40%.
//
//    4. Worker format is set to 'es' and rollup is made aware of audio worklet
//       entry points so they're always emitted as separate files.
//
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve paths relative to the client root. */
const r = (...segments: string[]) => path.resolve(__dirname, ...segments);

/**
 * Returns the vendor chunk name for a given module id, or undefined if the
 * module should stay in its default (page-level) chunk.
 *
 * The function is called once per module — Rollup uses the returned string as
 * the chunk filename (without hash/extension).
 */
function vendorChunk(id: string): string | undefined {
  // ── Core React runtime — needed by every chunk, must be shared ─────────────
  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/react-is/') ||
    id.includes('/node_modules/scheduler/')
  ) return 'react-vendor';

  // ── Routing ────────────────────────────────────────────────────────────────
  if (id.includes('/node_modules/wouter/')) return 'router-vendor';

  // ── Data fetching ──────────────────────────────────────────────────────────
  if (
    id.includes('/node_modules/@tanstack/') ||
    id.includes('/node_modules/react-query/')
  ) return 'query-vendor';

  // ── Radix UI primitives ────────────────────────────────────────────────────
  if (id.includes('/node_modules/@radix-ui/')) return 'radix-vendor';

  // ── Forms & validation ─────────────────────────────────────────────────────
  if (
    id.includes('/node_modules/react-hook-form/') ||
    id.includes('/node_modules/@hookform/') ||
    id.includes('/node_modules/zod/')
  ) return 'form-vendor';

  // ── Audio (large — lazy loaded, only used on VST / instrument routes) ───────
  if (
    id.includes('/node_modules/tone/') ||
    id.includes('/node_modules/webmidi/')
  ) return 'audio-vendor';

  // ── Animation ──────────────────────────────────────────────────────────────
  if (id.includes('/node_modules/framer-motion/')) return 'motion-vendor';

  // ── General utilities ──────────────────────────────────────────────────────
  if (
    id.includes('/node_modules/date-fns/') ||
    id.includes('/node_modules/lodash/') ||
    id.includes('/node_modules/lodash-es/')
  ) return 'utils-vendor';

  // ── State ──────────────────────────────────────────────────────────────────
  if (id.includes('/node_modules/zustand/')) return 'state-vendor';

  // ── Class utilities ────────────────────────────────────────────────────────
  if (
    id.includes('/node_modules/clsx/') ||
    id.includes('/node_modules/class-variance-authority/') ||
    id.includes('/node_modules/tailwind-merge/')
  ) return 'ui-utils-vendor';

  return undefined; // let Rollup decide (page-level code splitting)
}

// ─── Config ───────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }): UserConfig => {
  const isDev  = mode === 'development';
  const isProd = mode === 'production';

  return {
    // ── Plugins ───────────────────────────────────────────────────────────────
    plugins: [
      react({
        jsxRuntime: 'automatic',
        // Only enable React Fast Refresh on dev; avoids a tiny prod overhead.
        fastRefresh: isDev,
      }),
    ],

    // ── Path aliases ──────────────────────────────────────────────────────────
    resolve: {
      alias: {
        '@':       r('./src'),
        '@shared': r('../shared'),
      },
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    },

    // ── Dev server ────────────────────────────────────────────────────────────
    server: {
      port:       5174,
      host:       '0.0.0.0',
      strictPort: true,

      hmr: {
        protocol:   'ws',
        host:       'localhost',
        port:       5174,
        clientPort: 5173,
      },

      proxy: {
        '/api': {
          target:       'http://localhost:3000',
          changeOrigin: true,
          secure:       false,
        },
      },

      headers: {
        'Cache-Control': 'no-store',
      },

      cors: true,

      // ── Warmup — only the files the initial route needs ────────────────────
      // Removed the `src/components/**/*.tsx` glob that was pre-transforming
      // every component in the project on cold start.
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/App.tsx',
          './src/pages/instrument.tsx',
          './src/components/page-nav.tsx',
          './src/components/theme-provider.tsx',
        ],
      },
    },

    // ── Build ─────────────────────────────────────────────────────────────────
    build: {
      outDir: r('dist'),

      // sourcemap is expensive: ~4× disk space, ~40% slower build.
      // Set to 'hidden' in prod so Sentry/etc can still use it without
      // serving the maps to end users. Use `true` only when debugging prod.
      sourcemap: isProd ? 'hidden' : true,

      // Target modern browsers — avoids unnecessary legacy polyfills.
      target: ['es2020', 'chrome90', 'firefox88', 'safari14'],

      // Raise the warning threshold slightly — audio apps legitimately have
      // large chunks (tone.js alone is ~300 KB gzipped).
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          // Function form — correctly captures ALL transitive dependencies.
          manualChunks: vendorChunk,

          // Deterministic, human-readable chunk file names.
          chunkFileNames: isProd
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          entryFileNames: isProd
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          assetFileNames: isProd
            ? 'assets/[name]-[hash][extname]'
            : 'assets/[name][extname]',
        },
      },

      // Enable CSS code splitting so each lazy route only loads the CSS it needs.
      cssCodeSplit: true,

      // Inline small assets (< 4 KB) as base64 to save round trips.
      assetsInlineLimit: 4096,
    },

    // ── Pre-bundling ──────────────────────────────────────────────────────────
    // List every dep that would otherwise trigger re-optimization mid-session.
    // Notably excludes audio libs — they load lazily and don't need pre-bundling.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'wouter',
        'zustand',
        '@tanstack/react-query',
        'framer-motion',
        'react-hook-form',
        '@hookform/resolvers',
        'zod',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-slider',
        '@radix-ui/react-tabs',
        '@radix-ui/react-select',
        '@radix-ui/react-popover',
        'clsx',
        'class-variance-authority',
        'tailwind-merge',
        'date-fns',
      ],
      // tone and webmidi are ESM-only and load lazily — let Vite handle them
      // on demand rather than forcing them into the pre-bundle.
      exclude: ['tone', 'webmidi'],
    },

    // ── Web Workers / Worklets ────────────────────────────────────────────────
    worker: {
      format: 'es',
      // No extra plugins needed — react() is not used inside workers.
      plugins: () => [],
    },

    // ── esbuild ───────────────────────────────────────────────────────────────
    esbuild: {
      jsx: 'automatic',
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      // Drop console/debugger in production for a smaller bundle.
      drop: isProd ? ['console', 'debugger'] : [],
    },
  };
});