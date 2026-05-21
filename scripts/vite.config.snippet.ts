/**
 * Vite Configuration Snippet: __DEV__ Define Plugin
 * 
 * Add this to your vite.config.ts to define __DEV__ at compile time.
 * This enables aggressive dead-code elimination in production builds.
 * 
 * File: vite.config.ts
 */

import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────
// VITE CONFIG WITH __DEV__ DEFINE
// ─────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  define: {
    // Define __DEV__ constant at compile time
    // This allows Vite/Rollup to tree-shake dead code based on __DEV__ value
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },

  // Build configuration for optimal dead-code elimination
  build: {
    // Ensure all unreachable code is removed
    minify: 'terser',
    terserOptions: {
      compress: {
        // Aggressive removal of unreachable code
        dead_code: true,
        drop_console: false, // Keep console for debugging, but remove in prod
        passes: 3, // Multiple passes ensure complete elimination
      },
      mangle: true, // Shorten variable names
      output: {
        comments: false, // Remove comments
      },
    },

    // Rollup options for tree-shaking
    rollupOptions: {
      output: {
        // Format: ES modules for optimal tree-shaking
        format: 'es',
      },
    },

    // Ensure source maps are included for dev debugging
    sourcemap: process.env.NODE_ENV !== 'production',

    // Report code that's not tree-shaken
    reportCompressedSize: true,
  },

  // Development server
  server: {
    middlewareMode: false,
    hmr: true, // Ensure HMR (hot module replacement) works
  },
});

// ─────────────────────────────────────────────────────────────────────────
// VERIFICATION STEPS
// ─────────────────────────────────────────────────────────────────────────

/**
 * After adding this config:
 * 
 * 1. Test dev mode (tracer should initialize):
 *    $ pnpm dev
 *    → Open browser console
 *    → Run: window.__mutationTracer.replay()
 *    → Should return empty array, no error
 * 
 * 2. Test prod build (tracer code should be eliminated):
 *    $ pnpm build
 *    $ grep -r '__mutationTracer\|mutation-tracer' dist/
 *    → Should return NOTHING (code eliminated)
 * 
 * 3. Test that production build is smaller than dev:
 *    $ ls -lh dist/index.js
 *    → Should be significantly smaller than dev size
 * 
 * 4. Verify HMR still works during dev:
 *    $ pnpm dev
 *    → Edit a component
 *    → Page should hot-reload without full refresh
 * 
 * 5. Test localhost fallback (if __DEV__ ever not defined):
 *    → Tracer should activate if running on localhost
 *    → Tracer should NOT activate if running on production domain
 */

// ─────────────────────────────────────────────────────────────────────────
// ALTERNATE CONFIG: If you already have define in vite.config.ts
// ─────────────────────────────────────────────────────────────────────────

/**
 * If your vite.config.ts already has a define object, merge like this:
 * 
 *   export default defineConfig({
 *     define: {
 *       __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
 *       // ... your other defines
 *     },
 *   });
 */

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES (optional, for additional control)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Optional: Support env var to disable tracer entirely
 * 
 * Add to define:
 *   VITE_DISABLE_MUTATION_TRACER: JSON.stringify(process.env.VITE_DISABLE_MUTATION_TRACER === 'true'),
 * 
 * Then in mutation-tracer.debug.ts:
 * 
 *   declare const VITE_DISABLE_MUTATION_TRACER: boolean;
 * 
 *   function isDevEnvironment(): boolean {
 *     if (VITE_DISABLE_MUTATION_TRACER) {
 *       return false; // Force disabled
 *     }
 *     // ... rest of logic
 *   }
 * 
 * Set via:
 *   VITE_DISABLE_MUTATION_TRACER=true pnpm build
 */
