# @ts-nocheck Removal Tracking

**Root cause** (R3 v4 Advanced Audit, Bug L-2):  
`@ts-nocheck` at the top of `instrument.tsx` and `audio-store.ts` disabled the
TypeScript compiler for two of the most critical files in the codebase.  
This was the root cause of all 8 original prop bugs going undetected.

---

## Files requiring @ts-nocheck removal

### 1. `components/instrument.tsx`
- Remove `// @ts-nocheck` from line 1
- Fix all type errors surfaced (expected: 20–60 errors)
- Key areas: prop interfaces, audio hook returns, ref types
- Risk: **HIGH** — touches audio initialization path

### 2. `store/audio-store.ts`  
- Remove `// @ts-nocheck` from line 1
- Fix all type errors surfaced (expected: 10–30 errors)
- Key areas: Zustand action types, MixerChannel generics, Map<> typing
- C-3 and C-4 fixes have already improved type safety here
- Risk: **MEDIUM** — well-tested store with known interfaces

### Additional files with @ts-nocheck (discovered by fix_l1_l2.py):
- `audio/effects/eq.ts`
- `audio/fx/delay.ts`
- `audio/fx/eq.ts`
- `audio/fx/fx-chain.ts`
- `audio/fx/loader.ts`
- `audio/fx/vst-automation-engine.ts`
- `audio/fx/vst-loader.ts`
- `audio/fx/vst-performance-monitor.ts`
- `audio/fx/vst-project-serializer.ts`
- `audio/indicators/meter-node.ts`
- `components/ErrorBoundary.tsx`
- `components/audio-visualizer.tsx`
- `components/dj-controls/djcontrols.tsx`
- `components/dj-controls/hot-cues.tsx`
- `components/header-controls.tsx`
- `components/instruments/unified-daw.tsx`
- `components/mixer-with-dj.tsx`
- `components/multi-track-panel/audio-engine.tsx`
- `components/multi-track-panel/components/mixer-view.tsx`
- `components/multi-track-panel/components/timeline-view.tsx`
- `components/multi-track-panel/components/vst-panel-modal.tsx`
- `components/multi-track-panel/multi-track-panel.tsx`
- `components/theme-switcher.tsx`
- `components/trpc-components.tsx`
- `components/ui/arrangement-timeline.tsx`
- `components/ui/calendar.tsx`
- `components/ui/chart.tsx`
- `components/ui/collapsible-card.tsx`
- `components/ui/mixer-strip.tsx`
- `components/visual-engine.tsx`
- `components/vst-master-panel.tsx`
- `components/vst-plugin-manager.tsx`
- `components/vst-sidechain-ui.tsx`
- `components/waveform-editor.tsx`
- `engine/link-engine.ts`
- `engine/master-engine.ts`
- `engine/midi-engine.ts`
- `engine/transport-engine.ts`
- `features/loopstation/engine/loopEngine.ts`
- `features/loopstation/hooks/useLoopStation505.ts`
- `hooks/use-analysis-engine.ts`
- `hooks/use-multi-track.ts`
- `hooks/useFXChain.ts`
- `hooks/usemixerchannel.ts`
- `pages/instrument.tsx`
- `project/project-loader.ts`
- `project/project-serializer.ts`
- `store/audio-store.ts`
- `store/vst-store.ts`

---

## Process
1. Work file-by-file; one PR per file
2. Run `pnpm tsc --noEmit` after each change to track progress
3. Do not use `// @ts-ignore` as a workaround — fix the underlying type
4. Test audio pipeline after each file: init → play → record → export

## Success criteria
- `pnpm tsc --noEmit` exits 0 with no suppressions
- All 8 original prop bugs remain fixed (confirmed by re-running prop audit)
