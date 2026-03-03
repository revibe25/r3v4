// client/src/index.ts
//
// ─── ARCHITECTURE NOTES ──────────────────────────────────────────────────────
//
//  PROBLEM (original):
//    The file exported MultiTrackPanel twice under different names:
//
//      export { default as MultiTrackPanel } from './components/multi-track-panel';
//      export { default }                    from './components/multi-track-panel';
//
//    Having a barrel re-export at the *src root* means that any file which
//    imports anything from '@/' (or resolves through this index) pulls the
//    entire re-export graph into its chunk — defeating tree-shaking and
//    guaranteeing that MultiTrackPanel lands in the main bundle even when
//    it is also lazy-loaded in App.tsx.
//
//  FIX:
//    This file is the application entry shim, NOT a component barrel.
//    Components should be imported directly by the files that need them:
//
//      import MultiTrackPanel from '@/components/multi-track-panel';   ✅
//      import { MultiTrackPanel } from '@/index';                      ❌
//
//    If you need a barrel for external consumers of this package, create a
//    dedicated src/exports.ts and import from that explicitly.
//
//    This file is now intentionally minimal — it is only here because some
//    tooling (e.g. Vite's warmup, Jest) resolves the package root.
//
// ─────────────────────────────────────────────────────────────────────────────

// No re-exports. Import components directly from their source files.
export {};