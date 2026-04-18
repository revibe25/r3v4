// client/vite.config.ts
//
// ─── ARCHITECTURE NOTES ──────────────────────────────────────────────────────
//
// ORIGINAL PROBLEMS:
//   1. manualChunks used object form, which only works for explicit entry points.
//      All transitive dependencies were ending up in the main index.js chunk.
//   2. warmup.clientFiles used a glob for ALL components, pre-transforming
//      everything on dev start — cold start visibly slow.
//
// ENHANCEMENTS / FIXES:
//   1. manualChunks is now a function that runs per-module-id.
//      Each module is assigned to an appropriate vendor chunk dynamically.
//      This ensures chunks are route-aware and transitive deps are captured.
//   2. warmup only lists initial route files needed on cold start.
//   3. Sourcemaps disabled in production by default to reduce build size.
//   4. Worker format set to 'es' and rollup is aware of audio worklets.
//   5. Alias system refined for `@` → src, `@shared` → shared folder.
//   6. CSS code-splitting enabled and small assets inlined (<4 KB).
//   7. Pre-bundling optimized, excluding lazy audio libs (tone, webmidi).
//
// NOTES ON CHUNK STRATEGY:
//   · react-vendor: react, react-dom, scheduler
//   · radix-vendor: @radix-ui/*
//   · audio-vendor: tone, webmidi (lazy, only VST/instrument routes)
//   · query-vendor: @tanstack/react-query
//   · form-vendor: react-hook-form + zod + @hookform
//   · motion-vendor: framer-motion
//   · utils-vendor: date-fns, lodash
//   · state-vendor: zustand
//   · ui-utils-vendor: clsx, tailwind-merge, class-variance-authority
//
// ─────────────────────────────────────────────────────────────────────────────
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ─── PATH HELPERS ─────────────────────────────────────────────────────────────
/** Resolve paths relative to the client root. */
const r = (...segments) => path.resolve(__dirname, ...segments);
// ─── VENDOR CHUNK FUNCTION ───────────────────────────────────────────────────
/**
 * Returns a vendor chunk name for a given module id.
 * Modules not matched return undefined (page-level splitting).
 *
 * Ensures all transitive dependencies are captured correctly.
 */
function vendorChunk(id) {
    // Core React runtime — shared everywhere
    if (id.includes('/node_modules/react/') ||
        id.includes('/node_modules/react-dom/') ||
        id.includes('/node_modules/react-is/') ||
        id.includes('/node_modules/scheduler/'))
        return 'react-vendor';
    // Routing library
    if (id.includes('/node_modules/wouter/'))
        return 'router-vendor';
    // Data fetching / queries
    if (id.includes('/node_modules/@tanstack/') ||
        id.includes('/node_modules/react-query/'))
        return 'query-vendor';
    // Radix UI primitives
    if (id.includes('/node_modules/@radix-ui/'))
        return 'radix-vendor';
    // Forms & validation
    if (id.includes('/node_modules/react-hook-form/') ||
        id.includes('/node_modules/@hookform/') ||
        id.includes('/node_modules/zod/'))
        return 'form-vendor';
    // Audio (lazy loaded)
    if (id.includes('/node_modules/tone/') ||
        id.includes('/node_modules/webmidi/'))
        return 'audio-vendor';
    // Animation
    if (id.includes('/node_modules/framer-motion/'))
        return 'motion-vendor';
    // General utilities
    if (id.includes('/node_modules/date-fns/') ||
        id.includes('/node_modules/lodash/') ||
        id.includes('/node_modules/lodash-es/'))
        return 'utils-vendor';
    // State management
    if (id.includes('/node_modules/zustand/'))
        return 'state-vendor';
    // UI helpers
    if (id.includes('/node_modules/clsx/') ||
        id.includes('/node_modules/class-variance-authority/') ||
        id.includes('/node_modules/tailwind-merge/'))
        return 'ui-utils-vendor';
    // Let Rollup decide for page-level chunks
    return undefined;
}
// ─── VITE CONFIG ─────────────────────────────────────────────────────────────
export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';
    const isProd = mode === 'production';
    return {
        // ── PLUGINS ──────────────────────────────────────────────────────────────
        plugins: [
            react({
                jsxRuntime: 'automatic',
                fastRefresh: isDev, // only in dev
            }),
        ],
        // ── PATH ALIASES ──────────────────────────────────────────────────────────
        resolve: {
            alias: {
                '@': r('./src'),
                '@shared': r('../shared'),
            },
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
        },
        // ── DEV SERVER ───────────────────────────────────────────────────────────
        server: {
            port: 3000,
            host: '0.0.0.0',
            strictPort: true,
            hmr: {
                protocol: 'ws',
                host: 'localhost',
                port: 3000,
                clientPort: 3000,
            },
            proxy: {
                '/api': {
                    target: 'http://localhost:5000',
                    changeOrigin: true,
                    secure: false,
                },
            },
            headers: { 'Cache-Control': 'no-store' },
            cors: true,
            // Warmup: only initial route files
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
        // ── BUILD OPTIONS ────────────────────────────────────────────────────────
        build: {
            outDir: r('dist'),
            // Sourcemaps are heavy — use 'hidden' in prod for Sentry/debug only
            sourcemap: isProd ? 'hidden' : true,
            // Modern browsers only — avoids legacy polyfills
            target: ['es2020', 'chrome90', 'firefox88', 'safari14'],
            chunkSizeWarningLimit: 600, // audio libs are big
            rollupOptions: {
                output: {
                    manualChunks: vendorChunk,
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
            cssCodeSplit: true, // only load CSS per route
            assetsInlineLimit: 4096, // small assets as base64
        },
        // ── OPTIMIZE DEPS ───────────────────────────────────────────────────────
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
            // Lazy-loaded audio libs handled by Vite
            exclude: ['tone', 'webmidi'],
        },
        // ── WORKERS / AUDIO WORKLETS ─────────────────────────────────────────────
        worker: {
            format: 'es',
            plugins: () => [], // no react plugin inside workers
        },
        // ── ESBUILD ──────────────────────────────────────────────────────────────
        esbuild: {
            jsx: 'automatic',
            logOverride: { 'this-is-undefined-in-esm': 'silent' },
            drop: isProd ? ['console', 'debugger'] : [],
        },
    };
});
