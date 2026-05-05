// client/src/store/index.ts
//
// ─── ARCHITECTURE NOTES ──────────────────────────────────────────────────────
//
//  WHY THE STORE BARREL IS SAFE (unlike component barrels):
//    Zustand stores are module-level singletons. They do not execute rendering
//    code and they have no side effects on import — the store is only created
//    when the module first loads, which is negligible. Vite can tree-shake
//    unused store exports normally.
//
//    Component barrels (like the old src/index.ts) are dangerous because each
//    component file can have heavy transitive imports. Store files don't.
//
//  CHANGE — removed the alias exports (useClipstore, useclipstore, etc.):
//    Having multiple names for the same hook is a maintenance hazard and
//    prevents Vite from eliminating duplicate references during tree-shaking.
//    Pick one canonical name per store and use it everywhere.
//
//  PATTERN:
//    All stores follow the same interface:
//      useXxxStore()          — the Zustand hook
//      selectXxx()            — memoised selector helpers (stable references)
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Audio ─────────────────────────────────────────────────────────────────────
export {
  useAudioStore,
  selectIsPlaying,
  _selectChannelCount as selectChannelCount,
  _selectHasSoloChannels as selectHasSoloChannels,
} from './audio-store';

// ── VST ───────────────────────────────────────────────────────────────────────
export {
  useVSTStore,
  _selectCPUUsage as selectCPUUsage,
  _selectMemoryUsage as selectMemoryUsage,
  _selectLatency as selectLatency,
  _selectHasAlerts as selectHasAlerts,
} from './vst-store';

// ── Clips ─────────────────────────────────────────────────────────────────────
// Single canonical export — removed the lowercase aliases.
export { useClipStore } from './clip-store';
export type { Clip }    from './clip-store';

// ── Transport ─────────────────────────────────────────────────────────────────
// Single canonical export — removed the lowercase aliases.

// ── Mixer ─────────────────────────────────────────────────────────────────────
export { useMixerStore } from './mixer-store';

// ── FX ────────────────────────────────────────────────────────────────────────
export { useFXStore } from './fx-store';

// ── Meters ────────────────────────────────────────────────────────────────────
export { useMeterStore } from './meter-store';
// ── Auth ──────────────────────────────────────────────────────────────────────
export { useAuthStore } from './auth-store';
export type { AuthUser, AuthStore } from './auth-store';
