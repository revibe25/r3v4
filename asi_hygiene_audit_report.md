# ASI Hygiene & Repository Safety Audit Report
**Repository:** `/home/r3v/Stable`
**Generated:** 2026-05-28 21:43:29
**Protocol:** Expert-Level ASI Hygiene & Repository Safety Protocol v1.0
**Status:** PRE-EXECUTION — No destructive actions may occur before human review

> ⚠️ This report is based on file structure + content scanning. All three validation passes (static, runtime, infrastructure) have been run computationally, but final classification of any file requires human confirmation before destructive action.

## Summary Statistics
| Metric | Count |
|---|---|
| Total files scanned | 1653 |
| Backup / snapshot files | 272 |
| High-risk files | 663 |
| Backup groups (unique base names) | 179 |
| Shell scripts | 41 |
| Python scripts | 30 |
| Dependency manager(s) detected | pnpm + npm |
| Lockfile conflicts | 1 |
| Parallel duplicate directories | 2 |
| Empty directories | 9 |

---
## Section A — Active Files Report

Files confirmed structurally active based on content scanning and reference mapping.

### A.1 — High-Risk Active Files (infrastructure / deployment / migration)
These must never be modified or removed without operator confirmation.

| File | Infra Flags | Referenced By |
|---|---|---|
| `)` | docker | 0 files |
| `.env` | name/path match | 1 files |
| `.env.production` | name/path match | 0 files |
| `.github/dependabot.yml` | name/path match | 0 files |
| `.github/workflows/SECURITY.md` | name/path match | 0 files |
| `:` | docker, startup | 0 files |
| `App.tsx` | docker | 2 files |
| `Dockerfile` | docker, startup | 0 files |
| `FIX_IMPLEMENTATION_GUIDE.md` | docker, deployment, env_var | 0 files |
| `Fix` | docker, env_var | 0 files |
| `MYTHOS-SKILL-v2.md` | docker, cron, deployment | 0 files |
| `SECURITY.md` | cron | 0 files |
| `SECURITY_AUDIT_2026-05-26.md` | deployment | 0 files |
| `_audit/sync_map.txt` | docker, ci_cd, cron, env_var | 0 files |
| `_full_engine_audit.txt` | docker, ci_cd, cron, startup, env_var | 0 files |
| `admin.sh` | docker, env_var | 0 files |
| `adminRouter.ts` | docker, env_var | 0 files |
| `agents/verifier.js` | docker, env_var | 2 files |
| `apply-fix.sh` | docker | 0 files |
| `apply-phase4-engine-patch.sh` | docker, env_var | 0 files |
| `asi-audit-register.py` | docker, env_var | 0 files |
| `asi-hygiene-master.sh` | docker, env_var | 0 files |
| `asi-upgrade-fixed.sh` | docker, env_var | 0 files |
| `asi_hygiene_audit_report.md` | docker, ci_cd, cron, deployment, env_var | 0 files |
| `asi_mastery_troubleshooter.sh` | docker | 0 files |
| `audit_r3.txt` | docker, ci_cd, deployment, startup, env_var | 0 files |
| `audit_theme_config.py` | docker, env_var | 1 files |
| `backups/headers-20260527-155544/AdminPage.tsx` | docker | 0 files |
| `backups/headers-20260527-155544/AudioTest.tsx` | docker | 0 files |
| `backups/headers-20260527-155544/AuthPage.tsx` | docker | 0 files |
| `backups/headers-20260527-155544/DAW.tsx` | docker | 0 files |
| `backups/headers-20260527-155544/login.tsx` | docker, ci_cd | 0 files |
| `backups/headers-20260527-155544/visuals.tsx` | docker | 0 files |
| `backups/headers-20260527-155544/vst.tsx` | docker, ci_cd | 0 files |
| `client/DSP/Core.ts` | docker | 0 files |
| `client/DSP/GainComputer.ts` | docker | 0 files |
| `client/DSP/LDE.ts` | docker | 0 files |
| `client/SECURITY.md` | docker, ci_cd | 0 files |
| `client/build_and_integrate_VocalSpectra.sh` | docker, ci_cd, env_var | 0 files |
| `client/build_and_test_vocalspectra_Version2.sh` | docker, ci_cd, env_var | 0 files |
| `client/client/hooks/useSessionLifecycle.ts` | docker | 0 files |
| `client/client/src/lib/audio-context-manager.ts` | docker | 0 files |
| `client/client/src/lib/audio-node-factory.ts` | docker, cron | 0 files |
| `client/client/src/lib/router-compat.ts` | docker | 0 files |
| `client/config/vite.config.js` | docker, cron | 0 files |
| `client/fix-jsx-parent.sh` | docker, env_var | 0 files |
| `client/package-lock.json` | docker, cron, startup | 0 files |
| `client/src/App.tsx` | docker | 2 files |
| `client/src/MultitrackViewWrapper.tsx` | docker | 0 files |
| `client/src/TODO-remove-ts-nocheck.md` | docker, ci_cd | 0 files |
| `client/src/audio/automation/automation-engine.ts` | docker, cron | 0 files |
| `client/src/audio/automation/automation-lane.ts` | docker, cron | 0 files |
| `client/src/audio/clips/audio-clip-loader.ts` | docker | 0 files |
| `client/src/audio/clips/audio-clip.ts` | docker, cron | 0 files |
| `client/src/audio/clips/clip-track.ts` | docker, cron | 0 files |
| `client/src/audio/core/analysis-engine.ts` | docker | 0 files |
| `client/src/audio/core/audio-context.ts` | docker | 0 files |
| `client/src/audio/core/audio-graph.ts` | docker | 0 files |
| `client/src/audio/core/beat-detector.ts` | docker | 0 files |
| `client/src/audio/dj-controls/beat-sync.ts` | docker | 0 files |
| `client/src/audio/dj-controls/crossfader.ts` | docker | 0 files |
| `client/src/audio/dj-controls/cue-management.ts` | docker | 0 files |
| `client/src/audio/dj-controls/tempo-controls.ts` | docker | 0 files |
| `client/src/audio/effects/compressor.ts` | docker | 0 files |
| `client/src/audio/effects/delay.ts` | docker | 0 files |
| `client/src/audio/effects/distortion.ts` | docker | 0 files |
| `client/src/audio/effects/eq.ts` | docker | 0 files |
| `client/src/audio/effects/filter.ts` | docker | 0 files |
| `client/src/audio/effects/reverb.ts` | docker | 0 files |
| `client/src/audio/engine/AudioEngine.ts` | docker | 0 files |
| `client/src/audio/fx/compressor.ts` | docker | 0 files |
| `client/src/audio/fx/delay.ts` | docker | 0 files |
| `client/src/audio/fx/eq.ts` | docker | 0 files |
| `client/src/audio/fx/fx-chain.ts` | docker | 0 files |
| `client/src/audio/fx/fx-nodebase.ts` | docker, cron | 0 files |
| `client/src/audio/fx/loader.ts` | docker | 0 files |
| `client/src/audio/fx/vst-automation-engine.ts` | docker | 0 files |
| `client/src/audio/fx/vst-fx-node.ts` | docker | 0 files |
| `client/src/audio/fx/vst-performance-monitor.ts` | docker | 0 files |
| `client/src/audio/fx/vst-processor.worklet.ts` | docker | 0 files |
| `client/src/audio/fx/vst-project-serializer.ts` | docker | 0 files |
| `client/src/audio/fx/vst-scanner.ts` | docker | 0 files |
| `client/src/audio/fx/vst-sidechain.ts` | docker | 0 files |
| `client/src/audio/hooks/useAudioEngine.ts` | docker | 0 files |
| `client/src/audio/indicators/meter-node.ts` | docker | 0 files |
| `client/src/audio/mixer/effect-chain.ts` | docker | 0 files |
| `client/src/audio/mixer/master-bus.ts` | docker | 0 files |
| `client/src/audio/mixer/mixer-channel.ts` | docker | 0 files |
| `client/src/audio/mixer/solo-manager.ts` | docker | 0 files |
| `client/src/audio/recorder/recorder-engine.ts` | docker | 0 files |
| `client/src/audio/recorder/wav-encoder.ts` | docker | 0 files |
| `client/src/audio/transport/transport-engine.ts` | docker | 0 files |
| `client/src/audio/voice-pool.ts` | docker | 0 files |
| `client/src/collaboration/presence.ts` | docker | 0 files |
| `client/src/collaboration/ydoc.ts` | docker | 0 files |
| `client/src/components/AILevelAssist.tsx` | docker, ci_cd | 0 files |
| `client/src/components/ErrorBoundary.tsx` | docker | 0 files |
| `client/src/components/MixSuggestionsPanel.tsx` | docker, ci_cd | 0 files |
| `client/src/components/MixerWithAI.tsx` | docker, env_var | 0 files |
| `client/src/components/ProtectedRoute.tsx` | docker | 0 files |

### A.2 — Files With Active Inbound References

| File | Referenced By (count) |
|---|---|
| `express` | 25 |
| `vitest` | 16 |
| `tsconfig.json` | 11 |
| `config/tsconfig.json` | 11 |
| `packages/llpte-adapters/tsconfig.json` | 11 |
| `packages/llpte-execution/tsconfig.json` | 11 |
| `packages/llpte-signal/tsconfig.json` | 11 |
| `packages/llpte-transition-graph/tsconfig.json` | 11 |
| `packages/llpte-ai/tsconfig.json` | 11 |
| `packages/llpte-core/tsconfig.json` | 11 |
| `client/tsconfig.json` | 11 |
| `server/tsconfig.json` | 11 |
| `shared/tsconfig.json` | 11 |
| `pnpm` | 8 |
| `drizzle-kit` | 3 |
| `client/index.html` | 2 |
| `client/src/setup.ts` | 2 |
| `client/src/audio/worklets/audio-worklet.d.ts` | 2 |
| `client/src/components/index.ts` | 2 |
| `client/src/config/index.ts` | 2 |
| `client/src/engine/index.ts` | 2 |
| `client/src/features/index.ts` | 2 |
| `client/src/features/timeline/index.ts` | 2 |
| `client/src/features/mixer/index.ts` | 2 |
| `client/src/features/transport/index.ts` | 2 |
| `client/src/features/editor/index.ts` | 2 |
| `client/src/features/clips/index.ts` | 2 |
| `client/src/features/waveforms/index.ts` | 2 |
| `client/src/features/automation/index.ts` | 2 |
| `client/src/features/collaboration/index.ts` | 2 |
| `client/src/features/llpte/index.ts` | 2 |
| `client/src/features/plugins/index.ts` | 2 |
| `client/src/features/inspector/index.ts` | 2 |
| `client/src/features/browser/index.ts` | 2 |
| `client/src/features/mastering/index.ts` | 2 |
| `client/src/features/recording/index.ts` | 2 |
| `client/src/features/spatial/index.ts` | 2 |
| `client/src/hooks/index.ts` | 2 |
| `client/src/services/index.ts` | 2 |
| `client/src/stores/index.ts` | 2 |
| `client/src/types/index.ts` | 2 |
| `client/src/utils/index.ts` | 2 |
| `client/src/styles/index.ts` | 2 |
| `client/src/renderers/index.ts` | 2 |
| `client/src/workers/index.ts` | 2 |
| `client/src/plugins/index.ts` | 2 |
| `client/src/motion/index.ts` | 2 |
| `client/src/collaboration/index.ts` | 2 |
| `client/src/benchmarking/index.ts` | 2 |
| `client/src/commands/index.ts` | 2 |
| `client/src/accessibility/index.ts` | 2 |
| `client/src/visualization/index.ts` | 2 |
| `client/src/constants/index.ts` | 2 |
| `client/src/providers/index.ts` | 2 |
| `client/src/layout/index.ts` | 2 |
| `client/src/core/index.ts` | 2 |
| `client/tests/setup.ts` | 2 |
| `docs/LLPTE/demo/index.html` | 2 |
| `server/types/express.d.ts` | 2 |
| `tools/dashboard/index.html` | 2 |
| `playwright-report/index.html` | 2 |
| `.eslintrc.json` | 1 |
| `eslint` | 1 |
| `client/public/ir/cathedral.wav` | 1 |
| `client/public/ir/club-room.wav` | 1 |
| `client/public/ir/large-hall.wav` | 1 |
| `client/public/ir/plate-medium.wav` | 1 |
| `client/public/ir/small-room.wav` | 1 |
| `client/public/ir/spring-reverb.wav` | 1 |
| `client/public/ir/studio.wav` | 1 |
| `client/public/worklets/vst-processor.worklet.js` | 1 |
| `client/src/audio/recorder/recorder-worklet.ts` | 1 |
| `client/src/audio/engine/worklet/processor.ts` | 1 |
| `client/src/components/vumeter.tsx` | 1 |
| `client/src/worklets/instrument-processor.worklet.ts` | 1 |

---
## Section B — Suspected Dead Files Report

Files appearing unused based on zero inbound references. **NOT confirmed safe to remove.** All require validation passes 1–3.

**116 files with zero detected inbound references.**

| File | Extension | Size | Notes |
|---|---|---|---|
| `_backup_phase4_1779763759/EventEngine.js` | .js | 272B | No notes |
| `_backup_phase4_1779763759/FrameStore.js` | .js | 281B | No notes |
| `_backup_phase4_1779763759/MasterTimeline.js` | .js | 507B | No notes |
| `_backup_phase4_1779763759/SignalEngine.js` | .js | 586B | No notes |
| `_backup_phase4_1779763759/VisualEngine.js` | .js | 304B | No notes |
| `backups/headers-20260527-155544/not-found.tsx` | .tsx | 6,034B | No notes |
| `barrier-check.js` | .js | 1,841B | No notes |
| `c03_diagnostic.sh` | .sh | 1,471B | No notes |
| `client/DSP/DeEsser.ts` | .ts | 290B | No notes |
| `client/DSP/DynamicEQ.ts` | .ts | 292B | No notes |
| `client/DSP/FFTAnalyzer.ts` | .ts | 528B | No notes |
| `client/DSP/MSL.ts` | .ts | 818B | No notes |
| `client/DSP/PitchDetector.ts` | .ts | 560B | No notes |
| `client/DSP/Smoother.ts` | .ts | 489B | No notes |
| `client/Parameters.ts` | .ts | 586B | No notes |
| `client/config/postcss.config.js` | .js | 79B | No notes |
| `client/postcss.config.js` | .js | 79B | No notes |
| `client/shared/types/meter.types.ts` | .ts | 450B | No notes |
| `client/src/accessibility/shortcuts.ts` | .ts | 261B | No notes |
| `client/src/add-visual-alias-wouter.sh` | .sh | 1,289B | No notes |
| `client/src/add-visual-alias.sh` | .sh | 2,511B | No notes |
| `client/src/audio-init.js` | .js | 2,536B | No notes |
| `client/src/audio/core/instrument-engine.ts` | .ts | 21,919B | No notes |
| `client/src/audio/dj-controls/tempo-control.ts` | .ts | 215B | No notes |
| `client/src/audio/drum-classifier.ts` | .ts | 673B | No notes |
| `client/src/audio/effects/ir-reverb-engine.ts` | .ts | 4,792B | No notes |
| `client/src/audio/engine/VIL.ts` | .ts | 346B | No notes |
| `client/src/audio/fx/vst-loader.ts` | .ts | 6,861B | No notes |
| `client/src/audio/voice/voice-assistant.ts` | .ts | 468B | No notes |
| `client/src/benchmarking/performance.ts` | .ts | 629B | No notes |
| `client/src/commands/registry.ts` | .ts | 615B | No notes |
| `client/src/components/LoginForm.css` | .css | 2,483B | No notes |
| `client/src/components/SpectrumAnalyzer.tsx` | .tsx | 120B | No notes |
| `client/src/components/dj-controls/types.ts` | .ts | 2,862B | No notes |
| `client/src/components/types.ts` | .ts | 1,558B | No notes |
| `client/src/components/ui/modular-rack.tsx` | .tsx | 216B | No notes |
| `client/src/config/music-nav-links.ts` | .ts | 338B | No notes |
| `client/src/config/performance.config.ts` | .ts | 5,981B | No notes |
| `client/src/engine/audio/audioEngine.ts` | .ts | 1,039B | No notes |
| `client/src/engine/preset-engine.ts` | .ts | 13,070B | No notes |
| `client/src/engine/workers/audioEngine.worker.ts` | .ts | 39B | No notes |
| `client/src/engine/workers/effects.worker.ts` | .ts | 34B | No notes |
| `client/src/engine/workers/mixer.worker.ts` | .ts | 32B | No notes |
| `client/src/features/loopstation/state/initialState.ts` | .ts | 1,028B | No notes |
| `client/src/features/loopstation/types/loopstation.types.ts` | .ts | 4,805B | No notes |
| `client/src/lib/logger.ts` | .ts | 815B | No notes |
| `client/src/lib/theme-config.ts` | .ts | 2,895B | No notes |
| `client/src/pages/multi-track-panel/audio-engine.ts` | .ts | 1,303B | No notes |
| `client/src/pages/multi-track-panel/components/mixer-view.tsx` | .tsx | 238B | No notes |
| `client/src/pages/multi-track-panel/components/timeline-view.tsx` | .tsx | 247B | No notes |
| `client/src/pages/multi-track-panel/constants.ts` | .ts | 1,617B | No notes |
| `client/src/pages/multi-track-panel/types.ts` | .ts | 2,073B | No notes |
| `client/src/pages/multi-track-panel/utils.ts` | .ts | 2,708B | No notes |
| `client/src/pages/not-found.tsx` | .tsx | 6,480B | No notes |
| `client/src/plugins/plugin.types.ts` | .ts | 358B | No notes |
| `client/src/services/upload.ts` | .ts | 4,429B | No notes |
| `client/src/styles/tokens/colors.ts` | .ts | 327B | No notes |
| `client/src/styles/tokens/motion.ts` | .ts | 317B | No notes |
| `client/src/tokens.ts` | .ts | 884B | No notes |
| `client/src/types/audio-engine.types.ts` | .ts | 3,706B | No notes |
| `client/src/types/audiobuffer-to-wav.d.ts` | .ts | 138B | No notes |
| `client/src/types/daw.types.ts` | .ts | 451B | No notes |
| `client/src/types/n8ao.d.ts` | .ts | 232B | No notes |
| `client/src/utils/audio-utils.ts` | .ts | 489B | No notes |
| `client/src/utils/auth.ts` | .ts | 5,244B | No notes |
| `client/src/utils/performance-monitor.ts` | .ts | 9,310B | No notes |
| `client/src/utils/time.ts` | .ts | 2,364B | No notes |
| `client/src/visual/shader-engine.tsx` | .tsx | 353B | No notes |
| `client/src/visual/workers/renderer.worker.ts` | .ts | 35B | No notes |
| `client/src/visual/workers/scene.worker.ts` | .ts | 32B | No notes |
| `client/src/visual/workers/shaders.worker.ts` | .ts | 34B | No notes |
| `client/src/visualization/glow.ts` | .ts | 224B | No notes |
| `config/postcss.config.js` | .js | 80B | No notes |
| `find_api_auth.sh` | .sh | 1,627B | No notes |
| `fix-js-cookie.sh` | .sh | 983B | No notes |
| `fix-processor-ts.js` | .js | 1,233B | No notes |
| `p0_theme_additions.css` | .css | 2,857B | No notes |
| `packages/llpte-adapters/src/types.ts` | .ts | 270B | No notes |
| `packages/llpte-ai/src/types.ts` | .ts | 406B | No notes |
| `packages/llpte-core/src/constants.ts` | .ts | 599B | No notes |
| `packages/llpte-core/src/types/effects.types.ts` | .ts | 948B | No notes |
| `packages/llpte-execution/src/types.ts` | .ts | 675B | No notes |
| `packages/llpte-signal/src/types.ts` | .ts | 693B | No notes |
| `patch-js-cookie-both.sh` | .sh | 976B | No notes |
| `patch_headers_v2.py` | .py | 32B | No notes |
| `scripts/max-checker.sh` | .sh | 11,290B | No notes |
| `server/config.ts` | .ts | 1,457B | No notes |
| `server/lib/engine-stubs.ts` | .ts | 2,728B | No notes |
| `server/scripts/seed/config.ts` | .ts | 239B | No notes |
| `server/types/custom-modules.d.ts` | .ts | 395B | No notes |
| `server/utils/logger.ts` | .ts | 2,765B | No notes |
| `services/ai-mix/src/ai_mix.py` | .py | 607B | No notes |
| `shared/audio.types.ts` | .ts | 2,120B | No notes |
| `shared/auto-level.types.ts` | .ts | 6,827B | No notes |
| `shared/dj.types.ts` | .ts | 4,525B | No notes |
| `shared/effects.types.ts` | .ts | 2,964B | No notes |
| `shared/llpte-signal.d.ts` | .ts | 182B | No notes |
| `shared/session-metrics.types.ts` | .ts | 655B | No notes |
| `shared/types.ts` | .ts | 85B | No notes |
| `shared/types/audio.types.ts` | .ts | 600B | No notes |
| `shared/types/automation.types.ts` | .ts | 306B | No notes |
| `shared/types/clip.types.ts` | .ts | 238B | No notes |
| `shared/types/meter.types.ts` | .ts | 202B | No notes |
| `shared/types/transport.types.ts` | .ts | 217B | No notes |
| `shared/waveform.types.ts` | .ts | 5,989B | No notes |
| `tools/scripts/_backup_singleton_1779764215/engineSingleton.js` | .js | 137B | No notes |
| `tools/scripts/tools/src/engine/engineSingleton.js` | .js | 137B | No notes |
| `tools/src/engine/BeatDetector.js` | .js | 384B | No notes |
| `tools/src/engine/EventEngine.js` | .js | 272B | No notes |
| `tools/src/engine/FrameStore.js` | .js | 281B | No notes |
| `tools/src/engine/LatencyCompensator.js` | .js | 471B | No notes |
| `tools/src/engine/MasterTimeline.js` | .js | 507B | No notes |
| `tools/src/engine/SignalEngine.js` | .js | 586B | No notes |
| `tools/src/engine/VisualBus.js` | .js | 191B | No notes |
| `tools/src/engine/VisualEngine.js` | .js | 304B | No notes |
| `tools/src/engine/engineSingleton.js` | .js | 138B | No notes |

> Zero references does not mean dead — dynamic imports, config-driven loading, CLI scripts, and runtime-loaded modules may not be detected by static analysis alone.

---
## Section C — Verified Safe Removal Report

**NONE confirmed at this time.**

Per protocol Rule 10, no file may be classified as safe for removal unless ALL of the following are confirmed:

1. Not referenced (static analysis)
2. Not executed (runtime analysis)
3. Not required for rollback or recovery
4. Not required for compatibility
5. Not part of deployment or infrastructure
6. Not dynamically referenced
7. Not required by hidden execution paths

This section will be populated after human review of all items in Sections B, F, and G.

---
## Section D — Backup Consolidation Report

Required process before removing any backup:
1. Confirm hashes (done below)
2. Confirm no rollback tooling references backup by specific filename
3. Keep single most-recent verified-stable backup per file
4. Never remove all backups of a file

### D.1 — Backup Groups (179 groups, 272 total backup files)

#### `client/src/pages/collaborative-daw-pro.tsx`
- Base file exists: ✓
- Backup variants: 9
- Unique content versions (by hash): 3
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260527_153621` | 94,302B | 2026-05-26 21:39 | `fcafa41f048f` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260527_153852` | 94,302B | 2026-05-26 21:39 | `fcafa41f048f` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-20260527_153914` | 94,302B | 2026-05-26 21:39 | `fcafa41f048f` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-demo-20260526_213946` | 94,223B | 2026-05-26 21:39 | `cb6944575265` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260526_212145` | 92,152B | 2026-05-20 21:27 | `3b49ba412af4` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260526_212201` | 92,152B | 2026-05-20 21:27 | `3b49ba412af4` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260526_212815` | 92,152B | 2026-05-20 21:27 | `3b49ba412af4` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260526_213148` | 92,152B | 2026-05-20 21:27 | `3b49ba412af4` |
| `client/src/pages/collaborative-daw-pro.tsx.bak-collab-fix-20260526_213344` | 92,152B | 2026-05-20 21:27 | `3b49ba412af4` |

#### `client/src/App.tsx`
- Base file exists: ✓
- Backup variants: 7
- Unique content versions (by hash): 3
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/App.tsx.bak_visualalias_1778392506` | 10,609B | 2026-05-10 00:55 | `444ceb113ead` |
| `client/src/App.tsx.bak_visualalias_1778392392` | 10,609B | 2026-05-10 00:53 | `444ceb113ead` |
| `client/src/App.tsx.bak_visualalias_1778392385` | 10,609B | 2026-05-10 00:53 | `444ceb113ead` |
| `client/src/App.tsx.bak_visual_alias_1778392153` | 10,609B | 2026-05-10 00:49 | `444ceb113ead` |
| `client/src/App.tsx.bak_visual_alias_1778392121` | 10,609B | 2026-05-10 00:48 | `444ceb113ead` |
| `client/src/App.tsx.bak_sweep` | 10,610B | 2026-05-04 20:09 | `de36d83d0bf4` |
| `client/src/App.tsx.bak.20260429_133943` | 10,610B | 2026-04-30 21:09 | `a36955c723fc` |

#### `client/src/components/page-nav.tsx`
- Base file exists: ✓
- Backup variants: 7
- Unique content versions (by hash): 5
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/page-nav.tsx.bak-20260508_235028` | 12,426B | 2026-05-04 21:39 | `147f4c185d28` |
| `client/src/components/page-nav.tsx.bak-20260504_213959` | 12,492B | 2026-05-04 21:39 | `6cb33ea97eea` |
| `client/src/components/page-nav.tsx.bak-20260504_213904` | 12,492B | 2026-05-04 21:39 | `6cb33ea97eea` |
| `client/src/components/page-nav.tsx.bak-20260504_213858` | 12,492B | 2026-05-04 21:38 | `6cb33ea97eea` |
| `client/src/components/page-nav.tsx.bak_sweep` | 12,503B | 2026-05-04 20:09 | `56ea0d351c49` |
| `client/src/components/page-nav.tsx.bak.20260430_162405` | 11,782B | 2026-04-30 21:09 | `8f99d1979c51` |
| `client/src/components/page-nav.tsx.bak.20260429_141304` | 11,663B | 2026-04-30 21:09 | `bafd4fccfb25` |

#### `client/src/features/loopstation/LoopStation505.tsx`
- Base file exists: ✓
- Backup variants: 7
- Unique content versions (by hash): 6
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/LoopStation505.tsx.bak_20260510_000750` | 93,516B | 2026-05-10 00:07 | `e90414eef73b` |
| `client/src/features/loopstation/LoopStation505.tsx.bak_20260509_233618` | 93,516B | 2026-05-09 23:36 | `e90414eef73b` |
| `client/src/features/loopstation/LoopStation505.tsx.bak_20260509_232643` | 93,511B | 2026-05-09 23:26 | `885040449c4d` |
| `client/src/features/loopstation/LoopStation505.tsx.bak-20260504_222102` | 92,564B | 2026-05-04 22:21 | `69dc5efb7c2f` |
| `client/src/features/loopstation/LoopStation505.tsx.bak-20260504_220956` | 92,572B | 2026-05-04 22:09 | `254fe3a89afd` |
| `client/src/features/loopstation/LoopStation505.tsx.bak-20260504_214400` | 92,505B | 2026-05-04 21:44 | `f3ddc18e17b1` |
| `client/src/features/loopstation/LoopStation505.tsx.bak_sweep` | 92,594B | 2026-05-04 20:09 | `f63393140938` |

#### `client/src/store/index.ts`
- Base file exists: ✓
- Backup variants: 7
- Unique content versions (by hash): 3
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/index.ts.bak-20260509_005147` | 4,060B | 2026-05-09 00:51 | `bb39778fdc65` |
| `client/src/store/index.ts.bak-20260509_005141` | 4,066B | 2026-05-03 22:04 | `7d4c67f1cb76` |
| `client/src/store/index.ts.bak-20260502_200125` | 3,938B | 2026-05-02 20:00 | `4c280f46bfc3` |
| `client/src/store/index.ts.bak-20260503_220430` | 3,938B | 2026-05-02 20:00 | `4c280f46bfc3` |
| `client/src/store/index.ts.bak-20260502_200058` | 3,938B | 2026-05-02 19:41 | `4c280f46bfc3` |
| `client/src/store/index.ts.bak-20260502_194153` | 3,938B | 2026-05-02 19:39 | `4c280f46bfc3` |
| `client/src/store/index.ts.bak-20260502_193907` | 3,938B | 2026-04-30 21:09 | `4c280f46bfc3` |

#### `client/src/features/loopstation/hooks/useLoopStation505.ts`
- Base file exists: ✓
- Backup variants: 6
- Unique content versions (by hash): 6
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak_20260509_233618` | 8,904B | 2026-05-09 23:36 | `ff815ad95763` |
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak_20260509_232643` | 8,667B | 2026-05-09 23:26 | `a3271b6d8601` |
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak-20260504_221745` | 1,216B | 2026-05-04 22:17 | `9a9c7bd942c2` |
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak_20260508_004126` | 6,551B | 2026-05-04 22:17 | `63e793f9c7d5` |
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak.1777611311` | 27,655B | 2026-04-30 23:55 | `bef66cfdb079` |
| `client/src/features/loopstation/hooks/useLoopStation505.ts.bak.p5fix` | 27,596B | 2026-04-30 21:09 | `d4121ec6ddd2` |

#### `shared/schema-subscription.ts`
- Base file exists: ✓
- Backup variants: 6
- Unique content versions (by hash): 3
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `shared/schema-subscription.ts.bak_c03_surgical_1780018179` | 6,373B | 2026-05-28 20:29 | `b7d9b3ad457f` | ← **RECOMMENDED KEEP**
| `shared/schema-subscription.ts.bak_c03_manual` | 6,373B | 2026-05-28 20:12 | `b7d9b3ad457f` |
| `shared/schema-subscription.ts.bak_c03_dup` | 6,373B | 2026-05-28 20:06 | `b7d9b3ad457f` |
| `shared/schema-subscription.ts.bak_c03` | 4,925B | 2026-04-30 20:19 | `249eb87a122f` |
| `shared/schema-subscription.ts.bak-20260430_201117` | 4,933B | 2026-04-30 20:11 | `6ecc401cfd06` |
| `shared/schema-subscription.ts.bak-20260430_200116` | 4,933B | 2026-04-30 20:01 | `6ecc401cfd06` |

#### `client/src/components/header-controls.tsx`
- Base file exists: ✓
- Backup variants: 5
- Unique content versions (by hash): 4
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/header-controls.tsx.bak-20260504_220351` | 20,854B | 2026-05-04 22:03 | `3b6391299823` |
| `client/src/components/header-controls.tsx.bak-20260504_215325` | 20,638B | 2026-05-04 21:53 | `facd2a0a9c0c` |
| `client/src/components/header-controls.tsx.bak-20260504_212747` | 18,871B | 2026-05-04 21:27 | `3342a4cdd70c` |
| `client/src/components/header-controls.tsx.bak-20260504_212646` | 18,871B | 2026-05-04 21:26 | `3342a4cdd70c` |
| `client/src/components/header-controls.tsx.bak_sweep` | 18,884B | 2026-05-04 20:09 | `4161ff43b00d` |

#### `client/src/features/loopstation/state/initialState.ts`
- Base file exists: ✓
- Backup variants: 5
- Unique content versions (by hash): 5
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/state/initialState.ts.bak_20260510_001422` | 1,042B | 2026-05-10 00:14 | `517e616f5144` |
| `client/src/features/loopstation/state/initialState.ts.bak_20260510_000750` | 973B | 2026-05-10 00:07 | `c2e270386508` |
| `client/src/features/loopstation/state/initialState.ts.bak-20260508_224522` | 911B | 2026-05-08 00:51 | `277f7fd3b390` |
| `client/src/features/loopstation/state/initialState.ts.bak_20260508_005115` | 804B | 2026-05-04 22:17 | `a19dca0e7320` |
| `client/src/features/loopstation/state/initialState.ts.bak-20260504_221745` | 106B | 2026-05-04 22:17 | `6f9280de9070` |

#### `client/src/MultitrackViewWrapper.tsx`
- Base file exists: ✓
- Backup variants: 4
- Unique content versions (by hash): 4
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/MultitrackViewWrapper.tsx.bak-20260504_222102` | 2,729B | 2026-05-04 22:21 | `1e571aac6c83` |
| `client/src/MultitrackViewWrapper.tsx.bak-20260504_214400` | 2,645B | 2026-05-04 21:44 | `a32eeeb1799b` |
| `client/src/MultitrackViewWrapper.tsx.bak_sweep` | 2,646B | 2026-05-04 20:09 | `6b6234b6d236` |
| `client/src/MultitrackViewWrapper.tsx.bak.20260428-210543` | 1,563B | 2026-04-30 21:09 | `21b843bc6e98` |

#### `client/src/main.tsx`
- Base file exists: ✓
- Backup variants: 4
- Unique content versions (by hash): 4
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/main.tsx.bak_20260503_195014` | 870B | 2026-05-02 19:41 | `71f4c8df5206` |
| `client/src/main.tsx.bak.20260429_141304` | 806B | 2026-04-30 21:09 | `53019d36e169` |
| `client/src/main.tsx.bak.20260429_134454` | 777B | 2026-04-30 21:09 | `bd660590eddb` |
| `client/src/main.tsx.bak.20260428_221407` | 748B | 2026-04-30 21:09 | `f9120f5c8592` |

#### `client/src/components/theme-switcher.tsx`
- Base file exists: ✓
- Backup variants: 4
- Unique content versions (by hash): 3
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/theme-switcher.tsx.bak-20260504_215325` | 3,898B | 2026-05-04 21:53 | `0173daf29ab5` |
| `client/src/components/theme-switcher.tsx.bak_sweep` | 3,905B | 2026-05-04 20:09 | `558d707e8802` |
| `client/src/components/theme-switcher.tsx.bak.20260429_134454` | 609B | 2026-04-30 21:09 | `6bdea3e48489` |
| `client/src/components/theme-switcher.tsx.bak.20260428_221407` | 609B | 2026-04-30 21:09 | `6bdea3e48489` |

#### `client/src/features/loopstation/components/TrackPad.tsx`
- Base file exists: ✓
- Backup variants: 4
- Unique content versions (by hash): 4
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/TrackPad.tsx.bak_20260510_001422` | 35,750B | 2026-05-10 00:14 | `57e4010ec534` |
| `client/src/features/loopstation/components/TrackPad.tsx.bak_20260510_000750` | 35,753B | 2026-05-10 00:07 | `bfbfc7dd4118` |
| `client/src/features/loopstation/components/TrackPad.tsx.bak-20260508_224630` | 35,721B | 2026-05-04 20:09 | `f2a384b7fef1` |
| `client/src/features/loopstation/components/TrackPad.tsx.bak_sweep` | 35,770B | 2026-05-04 20:09 | `9e49ae29ebf3` |

#### `client/src/pages/pricing/PricingPage.tsx`
- Base file exists: ✓
- Backup variants: 4
- Unique content versions (by hash): 2
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/pages/pricing/PricingPage.tsx.bak.direct.1779162321` | 22,278B | 2026-05-18 22:45 | `f20756b63a7d` |
| `client/src/pages/pricing/PricingPage.tsx.bak.audit.1779146891` | 22,278B | 2026-05-18 18:28 | `f20756b63a7d` |
| `client/src/pages/pricing/PricingPage.tsx.bak.audit.1779082442` | 22,278B | 2026-05-18 00:34 | `f20756b63a7d` |
| `client/src/pages/pricing/PricingPage.tsx.bak.audit.1779082243` | 22,710B | 2026-05-18 00:30 | `893fb66f1f21` |

#### `package.json`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 3
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `package.json.bak_c01_v2` | 3,524B | 2026-05-28 19:48 | `5a98a6167c8d` |
| `package.json.bak_c01` | 3,454B | 2026-05-27 21:25 | `cf7d1cebd825` |
| `package.json.bak-20260511_232714` | 3,242B | 2026-05-11 22:33 | `ba02d0c3ae2e` |

#### `packages/llpte-ai/tsconfig.json`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 1
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_230659` | 515B | 2026-03-04 19:41 | `f0b82a5ce5c8` |
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_231354` | 515B | 2026-03-04 19:41 | `f0b82a5ce5c8` |
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_231734` | 515B | 2026-03-04 19:41 | `f0b82a5ce5c8` |

#### `client/src/audio/mixer/solo-manager.ts`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 3
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/mixer/solo-manager.ts.bak-20260509_005147` | 13,427B | 2026-05-09 00:51 | `f8e2fb26b867` |
| `client/src/audio/mixer/solo-manager.ts.bak-20260509_005141` | 13,431B | 2026-05-04 21:01 | `65a15ed45ff1` |
| `client/src/audio/mixer/solo-manager.ts.bak_sweep` | 13,443B | 2026-05-04 20:09 | `4cbe9a9cb3cb` |

#### `client/src/components/multi-track-panel.tsx`
- Base file exists: ✗ MISSING
- Backup variants: 3
- Unique content versions (by hash): 3
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/multi-track-panel.tsx.bak_20260503_195200` | 72,885B | 2026-05-02 20:15 | `de3c1bb5897e` |
| `client/src/components/multi-track-panel.tsx.bak-20260502_195734` | 72,049B | 2026-05-02 19:02 | `93eac31f2a34` |
| `client/src/components/multi-track-panel.tsx.bak.20260428-211310` | 812B | 2026-04-30 21:09 | `32e18c046ee1` |

#### `client/src/hooks/authStore.ts`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 3
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/authStore.ts.bak-20260520_224142` | 6,851B | 2026-05-13 13:39 | `a1ddc478d6b2` |
| `client/src/hooks/authStore.ts.bak_sweep` | 6,858B | 2026-05-04 20:09 | `d59b91e4ece8` |
| `client/src/hooks/authStore.ts.bak-20260503_221732` | 6,860B | 2026-04-30 21:09 | `c4a5a0acc071` |

#### `client/src/services/upload.ts`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 3
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/services/upload.ts.bak-20260509_005147` | 4,429B | 2026-05-09 00:51 | `d0985bf131f7` |
| `client/src/services/upload.ts.bak-20260509_005141` | 4,433B | 2026-05-04 21:01 | `84154624d066` |
| `client/src/services/upload.ts.bak_sweep` | 4,447B | 2026-05-04 20:09 | `a404d8ad3de1` |

#### `client/src/styles/theme.css`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 2
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/styles/theme.css.bak-20260508_011239` | 7,387B | 2026-05-08 01:12 | `cb03cfc8e45b` |
| `client/src/styles/theme.css.bak-20260508_011712` | 7,387B | 2026-05-04 17:37 | `cb03cfc8e45b` |
| `client/src/styles/theme.css.bak.20260429_141304` | 761B | 2026-04-29 13:37 | `9f345a8a929b` |

#### `server/routers/daw.ts`
- Base file exists: ✓
- Backup variants: 3
- Unique content versions (by hash): 2
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `server/routers/daw.ts.bak_f10_v2` | 21,286B | 2026-05-28 19:48 | `8c1e54b78ce2` |
| `server/routers/daw.ts.bak_f10` | 21,013B | 2026-05-10 20:19 | `4d7a82285871` |
| `server/routers/daw.ts.bak_c03` | 21,013B | 2026-05-10 20:19 | `4d7a82285871` |

#### `.eslintignore`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `.eslintignore.bak-1777603534` | 53B | 2026-04-30 21:45 | `268cbfd956d2` |
| `.eslintignore.bak-1777602859` | 46B | 2026-04-30 21:34 | `c6a8cb4509ba` |

#### `.eslintrc.json`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 1
- Safe to consolidate: YES — hash comparison complete

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `.eslintrc.json.bak-1777603542` | 729B | 2026-04-30 21:45 | `bdaa17910d7a` |
| `.eslintrc.json.bak-1777602867` | 729B | 2026-04-30 21:34 | `bdaa17910d7a` |

#### `packages/llpte-signal/tsconfig.json`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-signal/tsconfig.json.bak-rootdir` | 624B | 2026-04-19 23:07 | `b929bc7a6a5b` |
| `packages/llpte-signal/tsconfig.json.bak-composite` | 600B | 2026-04-04 00:50 | `a11763a219f3` |

#### `client/src/audio-init.js`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio-init.js.bak_20260503_195014` | 2,540B | 2026-04-30 21:34 | `8e00bafa9cef` |
| `client/src/audio-init.js.bak-1777602867` | 2,536B | 2026-04-30 21:34 | `3e9e55ab643c` |

#### `client/src/audio/mixer/mixer-channel.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/mixer/mixer-channel.ts.bak-20260512_205325` | 12,047B | 2026-05-12 20:53 | `62c365fe91b0` |
| `client/src/audio/mixer/mixer-channel.ts.bak_sweep` | 12,065B | 2026-05-04 20:09 | `3b9838b98889` |

#### `client/src/audio/transport/transport-engine.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/transport/transport-engine.ts.bak-20260509_005147` | 2,043B | 2026-05-09 00:51 | `59f1d7d7fc7d` |
| `client/src/audio/transport/transport-engine.ts.bak-20260509_005141` | 2,046B | 2026-05-04 21:01 | `03aa650e4f74` |

#### `client/src/components/drum-pads.tsx`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/drum-pads.tsx.bak_sweep` | 113,751B | 2026-05-04 20:09 | `82b752780bc4` |
| `client/src/components/drum-pads.tsx.bak.20260428_221407` | 113,359B | 2026-04-30 21:09 | `9f22cba21f0d` |

#### `client/src/components/mix-suggestions/MixSuggestionsPanel.tsx`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/mix-suggestions/MixSuggestionsPanel.tsx.bak.20260515_212203` | 26,461B | 2026-05-15 21:22 | `2898e412e3e1` |
| `client/src/components/mix-suggestions/MixSuggestionsPanel.tsx.bak_sweep` | 26,473B | 2026-05-04 20:09 | `88800f249344` |

#### `client/src/features/loopstation/engine/loopEngine.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/engine/loopEngine.ts.bak-20260504_220735` | 97,846B | 2026-05-04 22:07 | `4614e35bccf6` |
| `client/src/features/loopstation/engine/loopEngine.ts.bak_sweep` | 97,967B | 2026-05-04 20:09 | `90582caec4a7` |

#### `client/src/hooks/useMidiSequencer.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useMidiSequencer.ts.bak_sweep` | 8,742B | 2026-05-04 20:09 | `6a5f9c64115f` |
| `client/src/hooks/useMidiSequencer.ts.bak_20260508_004344` | 8,712B | 2026-05-04 20:09 | `1c41f0025c0f` |

#### `client/src/lib/trpc.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/trpc.ts.bak_sweep` | 5,200B | 2026-05-04 20:09 | `f594aa6cf1cf` |
| `client/src/lib/trpc.ts.bak_20260503_213940` | 5,201B | 2026-04-30 21:09 | `0a99cc41f847` |

#### `client/src/store/audio-store.ts`
- Base file exists: ✓
- Backup variants: 2
- Unique content versions (by hash): 2
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/audio-store.ts.bak_sweep` | 14,374B | 2026-05-04 20:09 | `78108750350d` |
| `client/src/store/audio-store.ts.bak-20260503_222258` | 14,375B | 2026-05-02 19:02 | `1d666947795a` |

#### `.gitignore`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `.gitignore.bak-20260419_232534` | 1,970B | 2026-04-19 22:01 | `dce6ac367fb7` |

#### `.env`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `.env.bak_20260423_223845` | 242B | 2026-04-22 21:08 | `8ab0a9538d16` |

#### `.railwayignore`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `.railwayignore.bak-20260509_002534` | 193B | 2026-05-09 00:25 | `291caf6f4463` |

#### `packages/llpte-execution/tsconfig.json`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-execution/tsconfig.json.bak-ts-fix-20260419_230659` | 515B | 2026-03-04 19:41 | `f0b82a5ce5c8` |

#### `packages/llpte-signal/package.json`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-signal/package.json.bak-deps-fix` | 784B | 2026-04-04 00:50 | `553d6bd17a54` |

#### `packages/llpte-signal/src/analyzers/TrackAnalyzer.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-signal/src/analyzers/TrackAnalyzer.ts.bak-ts-fix-final` | 4,612B | 2026-04-04 00:38 | `06451ebb9c4a` |

#### `packages/llpte-ai/src/AutoLevelEngine.test.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-ai/src/AutoLevelEngine.test.ts.bak2` | 11,431B | 2026-04-21 22:18 | `6b02b8d15dde` |

#### `packages/llpte-core/tsconfig.json`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `packages/llpte-core/tsconfig.json.bak-ts-fix-20260419_231734` | 616B | 2026-03-05 22:55 | `e581df625e7d` |

#### `client/SECURITY.md`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/SECURITY.md.bak-20260512` | 2,219B | 2026-05-12 19:50 | `166c0a604f4d` | ← **RECOMMENDED KEEP**

#### `client/src/audio/voice-pool.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/voice-pool.ts.bak_sweep` | 2,852B | 2026-05-04 20:09 | `19fedf521cb0` |

#### `client/src/audio/fx/compressor.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/compressor.ts.bak_sweep` | 11,796B | 2026-05-04 20:09 | `16791ed00fd8` |

#### `client/src/audio/fx/delay.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/delay.ts.bak_sweep` | 14,194B | 2026-05-04 20:09 | `09ba39dd2619` |

#### `client/src/audio/fx/eq.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/eq.ts.bak_sweep` | 13,580B | 2026-05-04 20:09 | `87f66442d90a` |

#### `client/src/audio/fx/fx-chain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/fx-chain.ts.bak_sweep` | 11,238B | 2026-05-04 20:09 | `6d8bfe4d2748` |

#### `client/src/audio/fx/fx-nodebase.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/fx-nodebase.ts.bak_sweep` | 2,106B | 2026-05-04 20:09 | `9a181f21f415` |

#### `client/src/audio/fx/loader.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/loader.ts.bak_sweep` | 13,054B | 2026-05-04 20:09 | `17980c8109dd` |

#### `client/src/audio/fx/vst-automation-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-automation-engine.ts.bak_sweep` | 9,594B | 2026-05-04 20:09 | `2d973fbd2f3c` |

#### `client/src/audio/fx/vst-fx-node.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-fx-node.ts.bak_sweep` | 14,577B | 2026-05-04 20:09 | `d3f54b4aa1fe` |

#### `client/src/audio/fx/vst-loader.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-loader.ts.bak_sweep` | 6,877B | 2026-05-04 20:09 | `4e9db30c19ea` |

#### `client/src/audio/fx/vst-performance-monitor.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-performance-monitor.ts.bak_sweep` | 5,835B | 2026-05-04 20:09 | `f45ebf5d55a0` |

#### `client/src/audio/fx/vst-processor.worklet.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-processor.worklet.ts.bak_sweep` | 9,848B | 2026-05-04 20:09 | `694eac6995e0` |

#### `client/src/audio/fx/vst-project-serializer.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-project-serializer.ts.bak_sweep` | 5,708B | 2026-05-04 20:09 | `4d2eb1e8651f` |

#### `client/src/audio/fx/vst-scanner.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-scanner.ts.bak_sweep` | 5,370B | 2026-05-04 20:09 | `37f8e080004f` |

#### `client/src/audio/fx/vst-sidechain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/fx/vst-sidechain.ts.bak_sweep` | 3,429B | 2026-05-04 20:09 | `bcec0bf184fc` |

#### `client/src/audio/indicators/meter-node.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/indicators/meter-node.ts.bak_sweep` | 1,125B | 2026-05-04 20:09 | `3b0b0d21db5d` |

#### `client/src/audio/mixer/effect-chain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/mixer/effect-chain.ts.bak_sweep` | 18,532B | 2026-05-04 20:09 | `8a12050f4e1d` |

#### `client/src/audio/recorder/recorder-worklet.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/recorder/recorder-worklet.ts.bak_sweep` | 906B | 2026-05-04 20:09 | `0a4c597b536d` |

#### `client/src/audio/recorder/wav-encoder.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/recorder/wav-encoder.ts.bak_sweep` | 637B | 2026-05-04 20:09 | `458854a6acde` |

#### `client/src/audio/voice/voice-assistant.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/voice/voice-assistant.ts.bak_sweep` | 470B | 2026-05-04 20:09 | `001b3e5648aa` |

#### `client/src/audio/engine/worklet/processor.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/audio/engine/worklet/processor.ts.bak_20260509_233618` | 975B | 2026-05-09 23:36 | `2059e872adb0` |

#### `client/src/components/AILevelAssist.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/AILevelAssist.tsx.bak_sweep` | 16,531B | 2026-05-04 20:09 | `63c7200fbc19` |

#### `client/src/components/MixSuggestionsPanel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/MixSuggestionsPanel.tsx.bak_sweep` | 6,983B | 2026-05-04 20:09 | `a9beb4628609` |

#### `client/src/components/SpectrumAnalyzer.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/SpectrumAnalyzer.tsx.bak_sweep` | 121B | 2026-05-04 20:09 | `177ead26060d` |

#### `client/src/components/TimeSavingsPanel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/TimeSavingsPanel.tsx.bak_sweep` | 6,230B | 2026-05-04 20:09 | `b4486b26f45c` |

#### `client/src/components/advanced-meter.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/advanced-meter.tsx.bak_sweep` | 6,476B | 2026-05-04 20:09 | `22569f2bc29d` |

#### `client/src/components/audio-visualizer.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/audio-visualizer.tsx.bak_sweep` | 46,697B | 2026-05-04 20:09 | `2b1370453440` |

#### `client/src/components/beat-intro.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/beat-intro.tsx.bak_sweep` | 40,605B | 2026-05-04 20:09 | `2972776b1ce5` |

#### `client/src/components/collapsible-fx-panel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/collapsible-fx-panel.tsx.bak_sweep` | 11,596B | 2026-05-04 20:09 | `567e9f41b5af` |

#### `client/src/components/drumstage.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/drumstage.tsx.bak_sweep` | 11,001B | 2026-05-04 20:09 | `32c9a1d51e60` |

#### `client/src/components/fx-panel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/fx-panel.tsx.bak_sweep` | 38,728B | 2026-05-04 20:09 | `013a3f5718e5` |

#### `client/src/components/knob.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/knob.tsx.bak_sweep` | 3,937B | 2026-05-04 20:09 | `c7b725adf89b` |

#### `client/src/components/microphone-input.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/microphone-input.tsx.bak_sweep` | 80,587B | 2026-05-04 20:09 | `46e9176d364b` |

#### `client/src/components/mixer-with-dj.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/mixer-with-dj.tsx.bak_sweep` | 4,840B | 2026-05-04 20:09 | `b65ab8cf5240` |

#### `client/src/components/multi-track-view.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/multi-track-view.tsx.bak_sweep` | 25,216B | 2026-05-04 20:09 | `ba31f1fa9aa4` |

#### `client/src/components/padmesh.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/padmesh.tsx.bak_sweep` | 1,367B | 2026-05-04 20:09 | `592ad0be6658` |

#### `client/src/components/piano-keys.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/piano-keys.tsx.bak_sweep` | 87,254B | 2026-05-04 20:09 | `9e118fc395f3` |

#### `client/src/components/theme-provider.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/theme-provider.tsx.bak_sweep` | 4,952B | 2026-05-04 20:09 | `794837517aa4` |

#### `client/src/components/threestage.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/threestage.tsx.bak_sweep` | 5,211B | 2026-05-04 20:09 | `21947407d651` |

#### `client/src/components/transport-controls.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/transport-controls.tsx.bak_sweep` | 3,382B | 2026-05-04 20:09 | `a7978d277bab` |

#### `client/src/components/trpc-components.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/trpc-components.tsx.bak_sweep` | 6,082B | 2026-05-04 20:09 | `798717dc3325` |

#### `client/src/components/visual-engine.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/visual-engine.tsx.bak_sweep` | 2,819B | 2026-05-04 20:09 | `eb179a2d7bae` |

#### `client/src/components/vst-automation-ui.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-automation-ui.tsx.bak_sweep` | 13,539B | 2026-05-04 20:09 | `436e337b9893` |

#### `client/src/components/vst-browser.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-browser.tsx.bak_sweep` | 27,532B | 2026-05-04 20:09 | `46d95aa93e06` |

#### `client/src/components/vst-master-panel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-master-panel.tsx.bak_sweep` | 10,245B | 2026-05-04 20:09 | `6624039c6cdb` |

#### `client/src/components/vst-performance-monitor-ui.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-performance-monitor-ui.tsx.bak_sweep` | 9,120B | 2026-05-04 20:09 | `48bd31f79438` |

#### `client/src/components/vst-plugin-manager.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-plugin-manager.tsx.bak_sweep` | 7,950B | 2026-05-04 20:09 | `c51c02440531` |

#### `client/src/components/vst-project-manager-ui.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-project-manager-ui.tsx.bak_sweep` | 6,854B | 2026-05-04 20:09 | `a6a7c864455d` |

#### `client/src/components/vst-sidechain-ui.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/vst-sidechain-ui.tsx.bak_sweep` | 10,382B | 2026-05-04 20:09 | `625b730d5bf8` |

#### `client/src/components/waveform-editor.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/waveform-editor.tsx.bak_sweep` | 49,876B | 2026-05-04 20:09 | `c3ec3a92cf9d` |

#### `client/src/components/logout-button.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/logout-button.tsx.bak_sweep` | 6,725B | 2026-05-04 20:09 | `782eeef9094e` |

#### `client/src/components/MixerWithAI.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/MixerWithAI.tsx.bak_sweep` | 6,529B | 2026-05-04 20:09 | `387e0655ed26` |

#### `client/src/components/ProtectedRoute.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/ProtectedRoute.tsx.bak_sweep` | 4,151B | 2026-05-04 20:09 | `b5b6a1cb21b4` |

#### `client/src/components/admin/AgentMeshPanel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/admin/AgentMeshPanel.tsx.bak_sweep` | 24,767B | 2026-05-04 20:09 | `bbe96a7962c1` |

#### `client/src/components/admin/AgentSuite.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/admin/AgentSuite.tsx.bak_sweep` | 53,850B | 2026-05-04 20:09 | `4bdc360ecfa8` |

#### `client/src/components/daw/AudioReactiveScene.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/daw/AudioReactiveScene.tsx.bak_sweep` | 11,881B | 2026-05-04 20:09 | `43ace9caf62e` |

#### `client/src/components/daw/WaveformMesh.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/daw/WaveformMesh.tsx.bak_sweep` | 6,498B | 2026-05-04 20:09 | `cabcb8bf3e38` |

#### `client/src/components/dj-controls/types.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/types.ts.bak_sweep` | 2,869B | 2026-05-04 20:09 | `9dc4a0094e40` |

#### `client/src/components/dj-controls/djcontrols.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/djcontrols.tsx.bak_sweep` | 20,290B | 2026-05-04 20:09 | `3a6e3b1df853` |

#### `client/src/components/dj-controls/hot-cues.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/hot-cues.tsx.bak_sweep` | 10,059B | 2026-05-04 20:09 | `1436c6401874` |

#### `client/src/components/dj-controls/knob.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/knob.tsx.bak_sweep` | 4,785B | 2026-05-04 20:09 | `453a8031dbcf` |

#### `client/src/components/dj-controls/transbtn.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/transbtn.tsx.bak_sweep` | 1,764B | 2026-05-04 20:09 | `a7981181ad7a` |

#### `client/src/components/dj-controls/vumeter.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/vumeter.tsx.bak_sweep` | 1,076B | 2026-05-04 20:09 | `78aa53ccc192` |

#### `client/src/components/dj-controls/waveformdisplay.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/dj-controls/waveformdisplay.tsx.bak_sweep` | 1,194B | 2026-05-04 20:09 | `ced536c6af73` |

#### `client/src/components/instruments/clip-block.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/instruments/clip-block.tsx.bak_sweep` | 1,560B | 2026-05-04 20:09 | `f67f6fed11ba` |

#### `client/src/components/instruments/clip-context-menu.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/instruments/clip-context-menu.tsx.bak_sweep` | 946B | 2026-05-04 20:09 | `4e3e09793c17` |

#### `client/src/components/session-summary/SessionChip.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/session-summary/SessionChip.tsx.bak_sweep` | 1,111B | 2026-05-04 20:09 | `7b433c1aee80` |

#### `client/src/components/session-summary/SessionSummaryPanel.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/session-summary/SessionSummaryPanel.tsx.bak_sweep` | 2,218B | 2026-05-04 20:09 | `f5dfe94873fa` |

#### `client/src/components/subscription/UpgradePrompt.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/subscription/UpgradePrompt.tsx.bak_sweep` | 8,521B | 2026-05-04 20:09 | `41c3836ed26e` |

#### `client/src/components/three/AudioReactiveScene.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/three/AudioReactiveScene.tsx.bak_sweep` | 10,345B | 2026-05-04 20:09 | `929a8e37d0d5` |

#### `client/src/components/three/WaveformMesh.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/three/WaveformMesh.tsx.bak_sweep` | 3,803B | 2026-05-04 20:09 | `4b90e86375b4` |

#### `client/src/components/tracks/clip-block.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/tracks/clip-block.tsx.bak_sweep` | 3,682B | 2026-05-04 20:09 | `a8c9b2a108c3` |

#### `client/src/components/tracks/clip-drag-handler.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/components/tracks/clip-drag-handler.tsx.bak_sweep` | 2,606B | 2026-05-04 20:09 | `4af4bfa70279` |

#### `client/src/config/performance.config.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/config/performance.config.ts.bak_sweep` | 5,985B | 2026-05-04 20:09 | `507695d7bfb4` |

#### `client/src/contexts/VSTContext.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/contexts/VSTContext.tsx.bak_sweep` | 2,450B | 2026-05-04 20:09 | `63903b307169` |

#### `client/src/engine/link-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/engine/link-engine.ts.bak_sweep` | 9,849B | 2026-05-04 20:09 | `674ad45a06d9` |

#### `client/src/engine/master-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/engine/master-engine.ts.bak_sweep` | 7,586B | 2026-05-04 20:09 | `4878ad3bb689` |

#### `client/src/engine/midi-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/engine/midi-engine.ts.bak_sweep` | 17,221B | 2026-05-04 20:09 | `9f2a7f954086` |

#### `client/src/engine/preset-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/engine/preset-engine.ts.bak_sweep` | 13,085B | 2026-05-04 20:09 | `5c401a2c314a` |

#### `client/src/engine/transport-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/engine/transport-engine.ts.bak_sweep` | 13,000B | 2026-05-04 20:09 | `3a47277202b4` |

#### `client/src/features/loopstation/components/FXKnob.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/FXKnob.tsx.bak_sweep` | 21,722B | 2026-05-04 20:09 | `f7d65b407d39` |

#### `client/src/features/loopstation/components/RGBRing.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/RGBRing.tsx.bak_sweep` | 5,346B | 2026-05-04 20:09 | `978fe1bd61e4` |

#### `client/src/features/loopstation/components/WaveformCanvas.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/WaveformCanvas.tsx.bak_sweep` | 23,915B | 2026-05-04 20:09 | `34deb7e9ebf0` |

#### `client/src/features/loopstation/components/XYPad.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/XYPad.tsx.bak_sweep` | 24,930B | 2026-05-04 20:09 | `55495b7f6909` |

#### `client/src/features/loopstation/components/VUMeter.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/components/VUMeter.tsx.bak_sweep` | 8,111B | 2026-05-04 20:09 | `c6f6daa2a452` |

#### `client/src/features/loopstation/state/reducer.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/features/loopstation/state/reducer.ts.bak-20260508_224522` | 205B | 2026-05-04 20:01 | `da127f7ba201` |

#### `client/src/hooks/useSessionMetricsSync.ts`
- Base file exists: ✗ MISSING
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useSessionMetricsSync.ts.mythos` | 939B | 2026-04-30 21:09 | `82eb26c5b297` |

#### `client/src/hooks/use-analysis-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-analysis-engine.ts.bak_sweep` | 10,489B | 2026-05-04 20:09 | `4907c2be4fc2` |

#### `client/src/hooks/use-audio-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-audio-engine.ts.bak_sweep` | 3,479B | 2026-05-04 20:09 | `14383dab0418` |

#### `client/src/hooks/use-ir-reverb.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-ir-reverb.ts.bak_sweep` | 3,146B | 2026-05-04 20:09 | `c404e955fdf8` |

#### `client/src/hooks/use-loop-engine-fft.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-loop-engine-fft.ts.bak_sweep` | 5,397B | 2026-05-04 20:09 | `84cb078717fd` |

#### `client/src/hooks/use-midi.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-midi.ts.bak_sweep` | 4,794B | 2026-05-04 20:09 | `d57e01730951` |

#### `client/src/hooks/use-mobile.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-mobile.ts.bak_sweep` | 415B | 2026-05-04 20:09 | `f2ec1585ab1c` |

#### `client/src/hooks/use-multi-track.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-multi-track.ts.bak_sweep` | 4,764B | 2026-05-04 20:09 | `04e35c93788b` |

#### `client/src/hooks/use-sidechain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-sidechain.ts.bak_sweep` | 2,934B | 2026-05-04 20:09 | `e9e2450deb5c` |

#### `client/src/hooks/use-toast.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-toast.ts.bak_sweep` | 3,905B | 2026-05-04 20:09 | `2f41f82253e9` |

#### `client/src/hooks/use-transport-state.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-transport-state.ts.bak_sweep` | 1,271B | 2026-05-04 20:09 | `1a4d938d61e2` |

#### `client/src/hooks/use-velocity.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-velocity.ts.bak_sweep` | 1,494B | 2026-05-04 20:09 | `e6dbbfdf8583` |

#### `client/src/hooks/use-waveform-audio-engine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/use-waveform-audio-engine.ts.bak_sweep` | 2,213B | 2026-05-04 20:09 | `d45cec6b9101` |

#### `client/src/hooks/useAIMix.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useAIMix.ts.bak_sweep` | 532B | 2026-05-04 20:09 | `7dec8cc7e702` |

#### `client/src/hooks/useAudioInitialization.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useAudioInitialization.ts.bak_sweep` | 876B | 2026-05-04 20:09 | `a86a9b072c9a` |

#### `client/src/hooks/useAudioUpload.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useAudioUpload.ts.bak_sweep` | 1,270B | 2026-05-04 20:09 | `245084adbed4` |

#### `client/src/hooks/useBilling.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useBilling.ts.bak_sweep` | 1,922B | 2026-05-04 20:09 | `e5b640ea6b88` |

#### `client/src/hooks/useCloudSync.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useCloudSync.ts.bak_sweep` | 15,551B | 2026-05-04 20:09 | `88732a44468b` |

#### `client/src/hooks/useCollabSocket.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useCollabSocket.ts.bak_sweep` | 7,042B | 2026-05-04 20:09 | `cef1e499963c` |

#### `client/src/hooks/useDAWEngine.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useDAWEngine.ts.bak_sweep` | 8,667B | 2026-05-04 20:09 | `71aff78ff39c` |

#### `client/src/hooks/useDAWStore.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useDAWStore.ts.bak_sweep` | 23,915B | 2026-05-04 20:09 | `1eadc4d82edd` |

#### `client/src/hooks/useFXChain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useFXChain.ts.bak_sweep` | 4,746B | 2026-05-04 20:09 | `5ab7056d1b22` |

#### `client/src/hooks/useLoopEngineFFTRef.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useLoopEngineFFTRef.ts.bak_sweep` | 3,573B | 2026-05-04 20:09 | `394543ed3883` |

#### `client/src/hooks/useSessionLifecycle.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useSessionLifecycle.ts.bak_sweep` | 1,598B | 2026-05-04 20:09 | `995d45763edf` |

#### `client/src/hooks/useSessionMetrics.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useSessionMetrics.ts.bak_sweep` | 3,969B | 2026-05-04 20:09 | `3c8a8179f7cd` |

#### `client/src/hooks/useeffectchain.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useeffectchain.ts.bak_sweep` | 5,963B | 2026-05-04 20:09 | `6ca67d5fd75c` |

#### `client/src/hooks/usemixerchannel.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/usemixerchannel.ts.bak_sweep` | 6,525B | 2026-05-04 20:09 | `3e68382adea4` |

#### `client/src/hooks/useAudioReactivity.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useAudioReactivity.ts.bak_sweep` | 528B | 2026-05-04 20:09 | `b78f924c3073` |

#### `client/src/hooks/useSubscription.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/hooks/useSubscription.tsx.bak_sweep` | 5,689B | 2026-05-04 20:09 | `103b85b5802f` |

#### `client/src/lib/midi.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/midi.ts.bak_sweep` | 6,554B | 2026-05-04 20:09 | `e16f3f5108b9` |

#### `client/src/lib/queryClient.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/queryClient.ts.bak_sweep` | 1,710B | 2026-05-04 20:09 | `573a3083d90e` |

#### `client/src/lib/session-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/session-store.ts.bak_sweep` | 1,649B | 2026-05-04 20:09 | `05c46ad1900d` |

#### `client/src/lib/utils.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/utils.ts.bak_sweep` | 5,962B | 2026-05-04 20:09 | `7a18dd36cec8` |

#### `client/src/lib/theme-config.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/lib/theme-config.ts.bak-20260504_215325` | 3,484B | 2026-05-04 21:53 | `4fd23d13a83c` |

#### `client/src/pages/AudioTest.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/pages/AudioTest.tsx.bak.20260528_184544` | 880B | 2026-05-28 18:45 | `5bef2a866866` |

#### `client/src/pages/AuthPage.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/pages/AuthPage.tsx.bak.20260528_184544` | 14,287B | 2026-05-28 18:45 | `9231e96b856f` |

#### `client/src/project/project-loader.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/project/project-loader.ts.bak_sweep` | 2,127B | 2026-05-04 20:09 | `95576be8c2f2` |

#### `client/src/project/project-serializer.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/project/project-serializer.ts.bak_sweep` | 1,983B | 2026-05-04 20:09 | `8bbb9201ab68` |

#### `client/src/store/mixer-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/mixer-store.ts.bak_20260503_215153` | 3,841B | 2026-05-02 19:02 | `7a4602ca6988` |

#### `client/src/store/vst-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/vst-store.ts.bak_20260503_215153` | 10,555B | 2026-05-02 19:02 | `b23dacf4bd51` |

#### `client/src/store/fx-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/fx-store.ts.bak-20260503_220430` | 30,576B | 2026-05-02 19:02 | `46526f05743e` |

#### `client/src/store/meter-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/meter-store.ts.bak-20260503_220430` | 1,246B | 2026-05-02 19:02 | `d808dcd7c684` |

#### `client/src/store/clip-store.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/store/clip-store.ts.bak-20260503_221732` | 2,404B | 2026-05-02 19:02 | `d3eed3032f42` |

#### `client/src/stores/session-store.ts`
- Base file exists: ✗ MISSING
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/stores/session-store.ts.mythos` | 909B | 2026-04-30 21:09 | `eb499890df0b` |

#### `client/src/stores/session-metrics-store.ts`
- Base file exists: ✗ MISSING
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/stores/session-metrics-store.ts.mythos` | 439B | 2026-04-30 21:09 | `f568cfaa59ce` |

#### `client/src/context/ThemeProvider.tsx`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/context/ThemeProvider.tsx.bak_sweep` | 682B | 2026-05-04 20:09 | `edec5ea6e0cc` |

#### `client/src/collaboration/presence.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `client/src/collaboration/presence.ts.bak_20260509_233618` | 788B | 2026-05-09 23:36 | `dfc6635763a7` |

#### `server/services/session-metrics.service.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `server/services/session-metrics.service.ts.mythos` | 1,008B | 2026-04-30 19:21 | `b7b5c8c96ebc` |

#### `shared/session-metrics.types.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `shared/session-metrics.types.ts.bak-20260421_173414` | 537B | 2026-04-21 17:34 | `63c0c97c09f0` | ← **RECOMMENDED KEEP**

#### `shared/schema-daw-patch.ts`
- Base file exists: ✓
- Backup variants: 1
- Unique content versions (by hash): 1
- Safe to consolidate: NO — all variants have unique content

| Backup File | Size | Last Modified | SHA256 (first 12) |
|---|---|---|---|
| `shared/schema-daw-patch.ts.bak-20260430_200116` | 5,747B | 2026-04-30 20:01 | `630a9e8c9907` | ← **RECOMMENDED KEEP**

---
## Section E — High-Risk Files Report

Files tied to infrastructure, deployment, runtime, or recovery. No modification without operator sign-off.

### ⚠️ E.0 — Dependency Manager Conflicts

- **CONFLICT: Multiple package managers detected: ['pnpm', 'npm']. This causes non-deterministic installs.**

**Immediate action required:** Determine the canonical package manager and remove the competing lockfile only after confirming no CI step uses it.

### E.1 — High-Risk File Registry

| File | Infra Flags | Risk Category |
|---|---|---|
| `)` | docker | DEPLOYMENT |
| `.env` | name/path match | BUILD |
| `.env.production` | name/path match | BUILD |
| `.github/dependabot.yml` | name/path match | BUILD |
| `.github/workflows/SECURITY.md` | name/path match | BUILD |
| `:` | docker, startup | DEPLOYMENT |
| `App.tsx` | docker | DEPLOYMENT |
| `Dockerfile` | docker, startup | DEPLOYMENT |
| `FIX_IMPLEMENTATION_GUIDE.md` | docker, deployment, env_var | DEPLOYMENT |
| `Fix` | docker, env_var | DEPLOYMENT |
| `MYTHOS-SKILL-v2.md` | docker, cron, deployment | DEPLOYMENT |
| `SECURITY.md` | cron | BUILD |
| `SECURITY_AUDIT_2026-05-26.md` | deployment | DEPLOYMENT |
| `_audit/sync_map.txt` | docker, ci_cd, cron, env_var | DEPLOYMENT |
| `_full_engine_audit.txt` | docker, ci_cd, cron, startup, env_var | DEPLOYMENT |
| `admin.sh` | docker, env_var | DEPLOYMENT |
| `adminRouter.ts` | docker, env_var | DEPLOYMENT |
| `agents/verifier.js` | docker, env_var | DEPLOYMENT |
| `apply-fix.sh` | docker | DEPLOYMENT |
| `apply-phase4-engine-patch.sh` | docker, env_var | DEPLOYMENT |
| `asi-audit-register.py` | docker, env_var | DEPLOYMENT |
| `asi-hygiene-master.sh` | docker, env_var | DEPLOYMENT |
| `asi-upgrade-fixed.sh` | docker, env_var | DEPLOYMENT |
| `asi_hygiene_audit_report.md` | docker, ci_cd, cron, deployment, env_var | DEPLOYMENT |
| `asi_mastery_troubleshooter.sh` | docker | DEPLOYMENT |
| `audit_r3.txt` | docker, ci_cd, deployment, startup, env_var | DEPLOYMENT |
| `audit_theme_config.py` | docker, env_var | DEPLOYMENT |
| `backups/headers-20260527-155544/AdminPage.tsx` | docker | DEPLOYMENT |
| `backups/headers-20260527-155544/AudioTest.tsx` | docker | DEPLOYMENT |
| `backups/headers-20260527-155544/AuthPage.tsx` | docker | DEPLOYMENT |
| `backups/headers-20260527-155544/DAW.tsx` | docker | DEPLOYMENT |
| `backups/headers-20260527-155544/login.tsx` | docker, ci_cd | DEPLOYMENT |
| `backups/headers-20260527-155544/visuals.tsx` | docker | DEPLOYMENT |
| `backups/headers-20260527-155544/vst.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/DSP/Core.ts` | docker | DEPLOYMENT |
| `client/DSP/GainComputer.ts` | docker | DEPLOYMENT |
| `client/DSP/LDE.ts` | docker | DEPLOYMENT |
| `client/SECURITY.md` | docker, ci_cd | DEPLOYMENT |
| `client/build_and_integrate_VocalSpectra.sh` | docker, ci_cd, env_var | DEPLOYMENT |
| `client/build_and_test_vocalspectra_Version2.sh` | docker, ci_cd, env_var | DEPLOYMENT |
| `client/client/hooks/useSessionLifecycle.ts` | docker | DEPLOYMENT |
| `client/client/src/lib/audio-context-manager.ts` | docker | DEPLOYMENT |
| `client/client/src/lib/audio-node-factory.ts` | docker, cron | DEPLOYMENT |
| `client/client/src/lib/router-compat.ts` | docker | DEPLOYMENT |
| `client/config/vite.config.js` | docker, cron | DEPLOYMENT |
| `client/fix-jsx-parent.sh` | docker, env_var | DEPLOYMENT |
| `client/package-lock.json` | docker, cron, startup | DEPLOYMENT |
| `client/src/App.tsx` | docker | DEPLOYMENT |
| `client/src/MultitrackViewWrapper.tsx` | docker | DEPLOYMENT |
| `client/src/TODO-remove-ts-nocheck.md` | docker, ci_cd | DEPLOYMENT |
| `client/src/audio/automation/automation-engine.ts` | docker, cron | DEPLOYMENT |
| `client/src/audio/automation/automation-lane.ts` | docker, cron | DEPLOYMENT |
| `client/src/audio/clips/audio-clip-loader.ts` | docker | DEPLOYMENT |
| `client/src/audio/clips/audio-clip.ts` | docker, cron | DEPLOYMENT |
| `client/src/audio/clips/clip-track.ts` | docker, cron | DEPLOYMENT |
| `client/src/audio/core/analysis-engine.ts` | docker | DEPLOYMENT |
| `client/src/audio/core/audio-context.ts` | docker | DEPLOYMENT |
| `client/src/audio/core/audio-graph.ts` | docker | DEPLOYMENT |
| `client/src/audio/core/beat-detector.ts` | docker | DEPLOYMENT |
| `client/src/audio/dj-controls/beat-sync.ts` | docker | DEPLOYMENT |
| `client/src/audio/dj-controls/crossfader.ts` | docker | DEPLOYMENT |
| `client/src/audio/dj-controls/cue-management.ts` | docker | DEPLOYMENT |
| `client/src/audio/dj-controls/tempo-controls.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/compressor.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/delay.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/distortion.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/eq.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/filter.ts` | docker | DEPLOYMENT |
| `client/src/audio/effects/reverb.ts` | docker | DEPLOYMENT |
| `client/src/audio/engine/AudioEngine.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/compressor.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/delay.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/eq.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/fx-chain.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/fx-nodebase.ts` | docker, cron | DEPLOYMENT |
| `client/src/audio/fx/loader.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-automation-engine.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-fx-node.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-performance-monitor.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-processor.worklet.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-project-serializer.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-scanner.ts` | docker | DEPLOYMENT |
| `client/src/audio/fx/vst-sidechain.ts` | docker | DEPLOYMENT |
| `client/src/audio/hooks/useAudioEngine.ts` | docker | DEPLOYMENT |
| `client/src/audio/indicators/meter-node.ts` | docker | DEPLOYMENT |
| `client/src/audio/mixer/effect-chain.ts` | docker | DEPLOYMENT |
| `client/src/audio/mixer/master-bus.ts` | docker | DEPLOYMENT |
| `client/src/audio/mixer/mixer-channel.ts` | docker | DEPLOYMENT |
| `client/src/audio/mixer/solo-manager.ts` | docker | DEPLOYMENT |
| `client/src/audio/recorder/recorder-engine.ts` | docker | DEPLOYMENT |
| `client/src/audio/recorder/wav-encoder.ts` | docker | DEPLOYMENT |
| `client/src/audio/transport/transport-engine.ts` | docker | DEPLOYMENT |
| `client/src/audio/voice-pool.ts` | docker | DEPLOYMENT |
| `client/src/collaboration/presence.ts` | docker | DEPLOYMENT |
| `client/src/collaboration/ydoc.ts` | docker | DEPLOYMENT |
| `client/src/components/AILevelAssist.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/components/ErrorBoundary.tsx` | docker | DEPLOYMENT |
| `client/src/components/MixSuggestionsPanel.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/components/MixerWithAI.tsx` | docker, env_var | DEPLOYMENT |
| `client/src/components/ProtectedRoute.tsx` | docker | DEPLOYMENT |
| `client/src/components/TimeSavingsPanel.tsx` | docker | DEPLOYMENT |
| `client/src/components/admin/AgentMeshPanel.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/components/admin/AgentSuite.tsx` | docker, ci_cd, env_var | DEPLOYMENT |
| `client/src/components/advanced-meter.tsx` | docker, cron | DEPLOYMENT |
| `client/src/components/audio-visualizer.tsx` | docker | DEPLOYMENT |
| `client/src/components/beat-intro.tsx` | docker, cron | DEPLOYMENT |
| `client/src/components/channel-strip.tsx` | docker | DEPLOYMENT |
| `client/src/components/collapsible-fx-panel.tsx` | docker | DEPLOYMENT |
| `client/src/components/daw/AudioReactiveScene.tsx` | docker | DEPLOYMENT |
| `client/src/components/daw/WaveformMesh.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/djcontrols.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/hot-cues.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/index.ts` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/knob.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/modeswitcher.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/transbtn.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/vumeter.tsx` | docker | DEPLOYMENT |
| `client/src/components/dj-controls/waveformdisplay.tsx` | docker | DEPLOYMENT |
| `client/src/components/drum-pads.tsx` | docker | DEPLOYMENT |
| `client/src/components/drumstage.tsx` | docker | DEPLOYMENT |
| `client/src/components/fx-panel.tsx` | docker | DEPLOYMENT |
| `client/src/components/header-controls.tsx` | docker | DEPLOYMENT |
| `client/src/components/instruments/clip-block.tsx` | docker | DEPLOYMENT |
| `client/src/components/instruments/clip-context-menu.tsx` | docker | DEPLOYMENT |
| `client/src/components/instruments/timeline.tsx` | docker | DEPLOYMENT |
| `client/src/components/knob.tsx` | docker | DEPLOYMENT |
| `client/src/components/logout-button.tsx` | docker | DEPLOYMENT |
| `client/src/components/microphone-input.tsx` | docker | DEPLOYMENT |
| `client/src/components/mix-suggestions/MixSuggestionsPanel.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/components/mixer-with-dj.tsx` | docker | DEPLOYMENT |
| `client/src/components/multi-track-view.tsx` | docker | DEPLOYMENT |
| `client/src/components/music-app-nav.tsx` | docker | DEPLOYMENT |
| `client/src/components/music-page-shell.tsx` | docker | DEPLOYMENT |
| `client/src/components/padmesh.tsx` | docker | DEPLOYMENT |
| `client/src/components/page-nav.tsx` | docker | DEPLOYMENT |
| `client/src/components/piano-keys.tsx` | docker | DEPLOYMENT |
| `client/src/components/session-summary/SessionChip.tsx` | docker | DEPLOYMENT |
| `client/src/components/session-summary/SessionSummaryPanel.tsx` | docker | DEPLOYMENT |
| `client/src/components/session-summary/index.ts` | docker | DEPLOYMENT |
| `client/src/components/subscription/UpgradePrompt.tsx` | docker | DEPLOYMENT |
| `client/src/components/theme-provider.tsx` | docker | DEPLOYMENT |
| `client/src/components/theme-switcher.tsx` | docker | DEPLOYMENT |
| `client/src/components/three/AudioReactiveScene.tsx` | docker | DEPLOYMENT |
| `client/src/components/three/WaveformMesh.tsx` | docker | DEPLOYMENT |
| `client/src/components/threestage.tsx` | docker | DEPLOYMENT |
| `client/src/components/tracks/clip-block.tsx` | docker | DEPLOYMENT |
| `client/src/components/tracks/clip-drag-handler.tsx` | docker | DEPLOYMENT |
| `client/src/components/transport-controls.tsx` | docker | DEPLOYMENT |
| `client/src/components/trpc-components.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/accordion.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/alert-dialog.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/alert.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/arrangement-timeline.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/aspect-ratio.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/avatar.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/badge.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/breadcrumb.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/button.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/calendar.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/card.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/carousel.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/chart.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/checkbox.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/collapsible-card.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/collapsible.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/command.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/context-menu.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/dialog.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/drawer.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/dropdown-menu.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/form.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/fx-chain-panel.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/hover-card.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/index.ts` | docker | DEPLOYMENT |
| `client/src/components/ui/input-otp.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/input.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/label.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/menubar.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/metal-daw-layout.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/mixer-strip.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/mixer-view.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/navigation-menu.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/pagination.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/play-head.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/popover.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/progress.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/radio-group.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/resizable.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/scroll-area.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/select.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/separator.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/sheet.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/sidebar.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/skeleton.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/slider.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/switch.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/table.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/tabs.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/textarea.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/timeline-ruler.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/toast.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/toaster.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/toggle-group.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/toggle.tsx` | docker | DEPLOYMENT |
| `client/src/components/ui/tooltip.tsx` | docker | DEPLOYMENT |
| `client/src/components/utils.ts` | docker | DEPLOYMENT |
| `client/src/components/visual-engine.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-automation-ui.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-browser.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-master-panel.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-performance-monitor-ui.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-plugin-manager.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-project-manager-ui.tsx` | docker | DEPLOYMENT |
| `client/src/components/vst-sidechain-ui.tsx` | docker | DEPLOYMENT |
| `client/src/components/waveform-editor.tsx` | docker | DEPLOYMENT |
| `client/src/context/ThemeProvider.tsx` | docker | DEPLOYMENT |
| `client/src/contexts/VSTContext.tsx` | docker | DEPLOYMENT |
| `client/src/db/clipDB.ts` | docker | DEPLOYMENT |
| `client/src/engine/link-engine.ts` | docker, cron | DEPLOYMENT |
| `client/src/engine/master-engine.ts` | docker | DEPLOYMENT |
| `client/src/engine/midi-engine.ts` | docker, startup | DEPLOYMENT |
| `client/src/engine/transport-engine.ts` | docker, cron | DEPLOYMENT |
| `client/src/engine/workers/index.ts` | docker | DEPLOYMENT |
| `client/src/features/loopstation/LoopStation505.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/WIRING.md` | docker | DEPLOYMENT |
| `client/src/features/loopstation/components/FXKnob.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/components/RGBRing.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/components/TrackPad.tsx` | docker, cron | DEPLOYMENT |
| `client/src/features/loopstation/components/VUMeter.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/components/WaveformCanvas.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/components/XYPad.tsx` | docker | DEPLOYMENT |
| `client/src/features/loopstation/engine/loopEngine.ts` | docker, cron, env_var | DEPLOYMENT |
| `client/src/features/loopstation/hooks/useLoopStation505.ts` | docker | DEPLOYMENT |
| `client/src/features/loopstation/state/reducer.ts` | docker | DEPLOYMENT |
| `client/src/hooks/authStore.ts` | docker, env_var | DEPLOYMENT |
| `client/src/hooks/use-analysis-engine.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-audio-engine.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-ir-reverb.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-loop-engine-fft.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-midi.ts` | docker, startup | DEPLOYMENT |
| `client/src/hooks/use-mobile.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-multi-track.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-sidechain.ts` | docker, cron | DEPLOYMENT |
| `client/src/hooks/use-toast.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-transport-state.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-velocity.ts` | docker | DEPLOYMENT |
| `client/src/hooks/use-waveform-audio-engine.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useAIMix.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useAudioInitialization.js` | docker | DEPLOYMENT |
| `client/src/hooks/useAudioInitialization.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useAudioReactivity.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useAudioUpload.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useAutoLeveling.ts` | docker, ci_cd | DEPLOYMENT |
| `client/src/hooks/useBilling.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useCloudSync.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useCollabSocket.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useCollaborativeState.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useDAWEngine.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useDAWStore.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useFXChain.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useInertialDrag.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useKeyboardShortcuts.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useLLPTESuggestions.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useLoopEngineFFTRef.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useMidiSequencer.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useMixSuggestions.ts` | docker, ci_cd | DEPLOYMENT |
| `client/src/hooks/usePerformanceMonitor.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useSessionExport.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useSessionLifecycle.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useSessionMetrics.ts` | docker | DEPLOYMENT |
| `client/src/hooks/useSubscription.tsx` | docker | DEPLOYMENT |
| `client/src/hooks/useeffectchain.ts` | docker | DEPLOYMENT |
| `client/src/hooks/usemixerchannel.ts` | docker | DEPLOYMENT |
| `client/src/index.css` | docker | DEPLOYMENT |
| `client/src/lib/midi.ts` | startup | RUNTIME |
| `client/src/lib/queryClient.ts` | docker | DEPLOYMENT |
| `client/src/lib/session-store.ts` | docker | DEPLOYMENT |
| `client/src/lib/trpc.ts` | docker | DEPLOYMENT |
| `client/src/lib/utils.ts` | docker | DEPLOYMENT |
| `client/src/main.tsx` | docker | DEPLOYMENT |
| `client/src/pages/AdminPage.tsx` | docker | DEPLOYMENT |
| `client/src/pages/AudioTest.tsx` | docker | DEPLOYMENT |
| `client/src/pages/AuthPage.tsx` | docker | DEPLOYMENT |
| `client/src/pages/DAW.tsx` | docker | DEPLOYMENT |
| `client/src/pages/admin/AgentSuitePage.tsx` | docker | DEPLOYMENT |
| `client/src/pages/collaborative-daw-pro.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/pages/instrument.tsx` | docker | DEPLOYMENT |
| `client/src/pages/login.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/pages/multi-track-panel/components/preferences-modal.tsx` | docker | DEPLOYMENT |
| `client/src/pages/multi-track-panel/components/vst-panel-modal.tsx` | docker | DEPLOYMENT |
| `client/src/pages/multi-track-panel/index.tsx` | docker | DEPLOYMENT |
| `client/src/pages/pricing/PricingPage.tsx` | docker, startup | DEPLOYMENT |
| `client/src/pages/pricing/pricing.data.ts` | docker | DEPLOYMENT |
| `client/src/pages/pricing/tokens.ts` | docker | DEPLOYMENT |
| `client/src/pages/pricing/usePricing.ts` | docker | DEPLOYMENT |
| `client/src/pages/visuals.tsx` | docker | DEPLOYMENT |
| `client/src/pages/vst.tsx` | docker, ci_cd | DEPLOYMENT |
| `client/src/plugins/pluginRegistry.ts` | docker | DEPLOYMENT |
| `client/src/project/project-loader.ts` | docker | DEPLOYMENT |
| `client/src/project/project-serializer.ts` | docker | DEPLOYMENT |
| `client/src/renderers/timelineRenderer.ts` | docker | DEPLOYMENT |
| `client/src/store/audio-store.ts` | docker | DEPLOYMENT |
| `client/src/store/auth-store.ts` | docker | DEPLOYMENT |
| `client/src/store/clip-store.ts` | docker | DEPLOYMENT |
| `client/src/store/fx-store.ts` | docker | DEPLOYMENT |
| `client/src/store/index.ts` | docker | DEPLOYMENT |
| `client/src/store/meter-store.ts` | docker | DEPLOYMENT |
| `client/src/store/mixer-store.ts` | docker | DEPLOYMENT |
| `client/src/store/vst-store.ts` | docker | DEPLOYMENT |
| `client/src/stores/mixerStore.ts` | docker | DEPLOYMENT |
| `client/src/stores/session-metrics.store.ts` | docker | DEPLOYMENT |
| `client/src/stores/timelineStore.ts` | docker | DEPLOYMENT |
| `client/src/styles/theme.css` | docker | DEPLOYMENT |
| `client/src/types/audio.ts` | docker | DEPLOYMENT |
| `client/src/types/globals.d.ts` | docker | DEPLOYMENT |
| `client/src/utils/audio.ts` | docker | DEPLOYMENT |
| `client/src/utils/audioHelpers.ts` | docker | DEPLOYMENT |
| `client/src/utils/projectSerializer.ts` | docker | DEPLOYMENT |
| `client/src/utils/trpc.ts` | docker | DEPLOYMENT |
| `client/src/visual/oscilloscope.tsx` | docker | DEPLOYMENT |
| `client/src/visual/workers/index.ts` | docker | DEPLOYMENT |
| `client/src/vj/VJCanvas.tsx` | docker | DEPLOYMENT |
| `client/src/workers/waveform.worker.ts` | docker | DEPLOYMENT |
| `client/tailwind.config.ts` | docker | DEPLOYMENT |
| `client/tests_VocalSpectra.null.test_Version2.ts` | docker | DEPLOYMENT |
| `client/tests_VocalSpectra.realtime.test_Version2.ts` | docker | DEPLOYMENT |
| `client/tests_VocalSpectra.smoothing.test_Version2.ts` | docker | DEPLOYMENT |
| `client/vercel.json` | docker, deployment | DEPLOYMENT |
| `client/vite.config.ts` | docker, cron, env_var | DEPLOYMENT |
| `client/vitest.config.ts` | docker | DEPLOYMENT |
| `client/worklet-types/audio-worklet-global.d.ts` | docker | DEPLOYMENT |
| `config/tailwind.config.ts` | docker | DEPLOYMENT |
| `db.sh` | docker, env_var | DEPLOYMENT |
| `db/schema/r3-platform.schema.ts` | docker, deployment | DEPLOYMENT |
| `deploy.sh` | docker, deployment, env_var | DEPLOYMENT |
| `docker-compose.yml` | docker | DEPLOYMENT |
| `docs/00_SUMMARY_AND_NEXT_STEPS.md` | docker, ci_cd, cron, deployment, env_var | DEPLOYMENT |
| `docs/ADMIN_TROUBLESHOOTING.md` | docker, deployment, env_var | DEPLOYMENT |
| `docs/AI_MIXING.md` | docker, ci_cd | DEPLOYMENT |
| `docs/API_REFERENCE.md` | docker, ci_cd, deployment | DEPLOYMENT |
| `docs/AUDIO_ARCHITECTURE.md` | docker, ci_cd, cron, deployment, env_var | DEPLOYMENT |
| `docs/AUDIT.md` | docker | DEPLOYMENT |
| `docs/CLAUDE.md` | docker, ci_cd, deployment | DEPLOYMENT |
| `docs/CLAUDE_local.md` | docker, ci_cd, deployment, env_var | DEPLOYMENT |
| `docs/DB_ADMIN.md` | docker | DEPLOYMENT |
| `docs/DEPLOY.md` | docker, deployment, startup, env_var | DEPLOYMENT |
| `docs/DEVELOPMENT.md` | docker, ci_cd, deployment, startup, env_var | DEPLOYMENT |
| `docs/DJ_CONTROLS.md` | docker, ci_cd | DEPLOYMENT |
| `docs/EFFECTS_GUIDE.md` | docker | DEPLOYMENT |
| `docs/EXECUTIVE_SUMMARY.md` | docker, deployment | DEPLOYMENT |
| `docs/LLPTE/BENCHMARKS.md` | docker, ci_cd | DEPLOYMENT |
| `docs/LLPTE/IP_THESIS.md` | docker, ci_cd | DEPLOYMENT |
| `docs/LLPTE/LICENSING_PITCH.md` | docker, ci_cd, deployment | DEPLOYMENT |
| `docs/LLPTE/LLPTE_WHITEPAPER.md` | docker, deployment | DEPLOYMENT |
| `docs/LLPTE/PRIOR_ART_SEARCH.md` | docker, ci_cd, cron | DEPLOYMENT |
| `docs/MUTATION_REPLAY_IMPLEMENTATION_SPEC.md` | docker, ci_cd, deployment, env_var | DEPLOYMENT |
| `docs/ONBOARDING.md` | docker | DEPLOYMENT |
| `docs/PITCH.md` | docker, ci_cd, deployment | DEPLOYMENT |
| `docs/PRD_R3V4_v4.4.0.md` | docker, ci_cd, deployment, env_var | DEPLOYMENT |
| `docs/PRIORITIES.md` | docker, deployment | DEPLOYMENT |
| `docs/QUICKSTART.md` | docker, env_var | DEPLOYMENT |
| `docs/README.md` | docker, ci_cd, env_var | DEPLOYMENT |
| `docs/RESTORE_CHEATSHEET.md` | docker, env_var | DEPLOYMENT |
| `docs/SALE_PACKAGE.md` | docker, ci_cd, deployment | DEPLOYMENT |
| `docs/SKILLS.md` | docker, deployment, env_var | DEPLOYMENT |
| `docs/TECH_DEBT.md` | docker | DEPLOYMENT |
| `docs/TRIPLE-CHECK-PASS-2.md` | docker, ci_cd, deployment, env_var | DEPLOYMENT |
| `docs/WIRE_RESPONSE_MUTATION_REPLAY.md` | docker, deployment | DEPLOYMENT |
| `docs/asi_enhanced.md` | docker, ci_cd | DEPLOYMENT |
| `docs/auth.md` | docker | DEPLOYMENT |
| `docs/docs_DEMO_CHECKLIST_Version2.md` | docker | DEPLOYMENT |
| `docs/infra/k8s/deployment.yaml` | docker, cron, deployment, env_var | DEPLOYMENT |
| `docs/mythos-security-triage-PRD.md` | docker, ci_cd, cron, deployment, env_var | DEPLOYMENT |
| `docs/triplechecker.md` | docker, ci_cd, cron, deployment, startup | DEPLOYMENT |
| `docs/workflow.md` | docker, ci_cd | DEPLOYMENT |
| `drizzle.config.ts` | docker, env_var | DEPLOYMENT |
| `drizzle/0001_add_not_null_ownership.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0000_complete_gressill.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0001_dapper_argent.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0002_daw_project_state.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0002_subscription_tables.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0003_naive_freak.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0004_parched_moon_knight.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0005_overjoyed_gambit.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0006_materialized_views.sql` | name/path match | MIGRATION |
| `drizzle/migrations/0007_conscious_peter_parker.sql` | name/path match | MIGRATION |
| `eslint.config.mjs` | docker | DEPLOYMENT |
| `final-hygiene-fix.sh` | docker, env_var | DEPLOYMENT |
| `fix-collab.py` | docker, env_var | DEPLOYMENT |
| `fix-logging-corrected.py` | docker, env_var | DEPLOYMENT |
| `fix-logging-phase1.py` | docker, env_var | DEPLOYMENT |
| `fix_c01_esbuild_override.py` | docker, env_var | DEPLOYMENT |
| `fix_c01_esbuild_override_v2.py` | docker, env_var | DEPLOYMENT |
| `fix_c03_proper.sh` | docker | DEPLOYMENT |
| `fix_c03_session_bypass.py` | docker, ci_cd, env_var | DEPLOYMENT |
| `fix_c03_surgical.sh` | docker | DEPLOYMENT |
| `fix_collab_AUDITED_v2_FIXED.py` | docker, env_var | DEPLOYMENT |
| `fix_eslint_config.py` | docker, env_var | DEPLOYMENT |
| `fix_f10_prompt_injection.py` | docker, env_var | DEPLOYMENT |
| `fix_f10_prompt_injection_v2.py` | docker, env_var | DEPLOYMENT |
| `fix_green_bars_direct.sh` | docker | DEPLOYMENT |
| `fix_pricing_audit.sh` | docker | DEPLOYMENT |
| `fixduplicate.sh` | docker, env_var | DEPLOYMENT |
| `human_review_queue.txt` | docker | DEPLOYMENT |
| `index.ts` | docker, deployment, env_var | DEPLOYMENT |
| `inspect-init-constants.py` | docker, env_var | DEPLOYMENT |
| `lint-cleanup-imports.py` | docker, startup, env_var | DEPLOYMENT |
| `master_sync_drizzle_journal.sh` | docker, deployment, env_var | DEPLOYMENT |
| `nginx/nginx.conf` | name/path match | BUILD |
| `nixpacks.toml` | docker, startup | DEPLOYMENT |
| `p0-p1-deploy.sh` | docker, deployment | DEPLOYMENT |
| `package.json` | docker, deployment | DEPLOYMENT |
| `packages/llpte-adapters/README.md` | docker | DEPLOYMENT |
| `packages/llpte-adapters/package.json` | docker | DEPLOYMENT |
| `packages/llpte-adapters/src/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-adapters/src/webAudioAdapter.ts` | docker | DEPLOYMENT |
| `packages/llpte-adapters/tests/adapters.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-adapters/vitest.config.ts` | docker | DEPLOYMENT |
| `packages/llpte-ai/README.md` | docker | DEPLOYMENT |
| `packages/llpte-ai/package.json` | docker | DEPLOYMENT |
| `packages/llpte-ai/src/AutoLevelEngine.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-ai/src/AutoLevelEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-ai/src/aiAdapter.ts` | docker | DEPLOYMENT |
| `packages/llpte-ai/src/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-ai/tests/ai.test.ts` | docker, env_var | DEPLOYMENT |
| `packages/llpte-ai/vitest.config.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/README.md` | docker | DEPLOYMENT |
| `packages/llpte-core/benchmarks/latency.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/package.json` | docker | DEPLOYMENT |
| `packages/llpte-core/src/AutoLevelPipeline.ts` | docker, ci_cd, cron | DEPLOYMENT |
| `packages/llpte-core/src/arrangement/ArrangementEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/arrangement/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/dj/DJEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/dj/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/effects/EffectsEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/effects/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/engine/AudioGraphEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/engine/LatencyCompensator.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/engine/engine/workers/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/engine/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/engine/workers/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/mixer/MixerEngine.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/mixer/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/types/audio-graph.types.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/types/dj.types.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/types/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/src/types/mixer.types.ts` | docker | DEPLOYMENT |
| `packages/llpte-core/tests/pipeline.test.ts` | docker, ci_cd, cron | DEPLOYMENT |
| `packages/llpte-core/vitest.config.ts` | docker | DEPLOYMENT |
| `packages/llpte-execution/README.md` | docker | DEPLOYMENT |
| `packages/llpte-execution/package.json` | docker | DEPLOYMENT |
| `packages/llpte-execution/src/AutoLevelExecutor.ts` | docker, env_var | DEPLOYMENT |
| `packages/llpte-execution/src/crossfade.ts` | docker, cron | DEPLOYMENT |
| `packages/llpte-execution/src/index.ts` | docker, cron | DEPLOYMENT |
| `packages/llpte-execution/tests/crossfade.test.ts` | docker, cron | DEPLOYMENT |
| `packages/llpte-execution/vitest.config.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/README.md` | docker | DEPLOYMENT |
| `packages/llpte-signal/package.json` | docker | DEPLOYMENT |
| `packages/llpte-signal/src/TrackAnalyzer.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/src/analyzer.ts` | docker, env_var | DEPLOYMENT |
| `packages/llpte-signal/src/analyzers/TrackAnalyzer.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/src/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/src/types/signal.types.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/tests/analyzer.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-signal/vitest.config.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/README.md` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/benchmarks/run.bench.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/package.json` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/src/__tests__/scoreModel.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/src/index.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/src/scoreModel.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/src/transitionGraph.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/src/types.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/tests/scoreModel.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/tests/transitionGraph.test.ts` | docker | DEPLOYMENT |
| `packages/llpte-transition-graph/vitest.config.ts` | docker | DEPLOYMENT |
| `patch-collab-daw.sh` | docker, env_var | DEPLOYMENT |
| `patch_remove_panel_borders.py` | docker, env_var | DEPLOYMENT |
| `patch_skills_13.py` | deployment, env_var | DEPLOYMENT |
| `playwright-report/data/0e2bd2c24aad641557da14061ba7e08123aa9357.md` | docker | DEPLOYMENT |
| `playwright-report/data/127cb6917238f2f44ccdd18c0584a4a6935522db.md` | docker, deployment, env_var | DEPLOYMENT |
| `playwright-report/data/13e89867ecc2761e153698b6175442477efaa457.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/23f4210040bb02393152e78d55eca9a24db0e832.md` | docker, deployment, env_var | DEPLOYMENT |
| `playwright-report/data/26bf8029326a280f3863f20ba984080267ebeadb.md` | docker | DEPLOYMENT |
| `playwright-report/data/3bab5518a5d1483c5c6cda8733561ad1ff302c84.md` | docker | DEPLOYMENT |
| `playwright-report/data/3d0132c90c7cae559fc8a92c8ad5f682dcfd22d0.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/3f747a54f3648c296a58d514358e9c46c2117d57.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/454eb2469c2ea96f10a5eb9694d6e342f6e91f14.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/4f3c5e1d5d69e315bbea76a4fbb095afb58b66cb.md` | docker | DEPLOYMENT |
| `playwright-report/data/514d8e7d2403f2405a9cb9bf12e792608529915c.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/5ae1b41b6579055caec5961ace5a57bb47381924.md` | docker, deployment, env_var | DEPLOYMENT |
| `playwright-report/data/6b35771b6c42f61e6e4574ff003ec9382eca0f19.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/80b835618fc462db13ed56e31466f98dfb88dc85.md` | docker | DEPLOYMENT |
| `playwright-report/data/8707e7c77acb572cc0eb446630b13038dcbf943c.md` | docker | DEPLOYMENT |
| `playwright-report/data/a195fd1a7c09c2c2a38dd9db881056583a3e3c9a.md` | docker | DEPLOYMENT |
| `playwright-report/data/ab0ef2584e195d18aa6798ed79b28c240e96440d.md` | docker | DEPLOYMENT |
| `playwright-report/data/b383d621260c2b73daea680bbc153d06ce533fd5.md` | deployment | DEPLOYMENT |
| `playwright-report/data/b978faf61e1d8474e0db986688d1c6e53cc899ab.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/bc1d1c492a9995a776c58b6fa54c99cd5c7d8948.md` | deployment | DEPLOYMENT |
| `playwright-report/data/c57d964bcfe3cfb3c631b790e3b28df8d0f4a9ea.md` | docker | DEPLOYMENT |
| `playwright-report/data/c76709ecc5be2c4378c09f83e28ae7797084fd5a.md` | docker | DEPLOYMENT |
| `playwright-report/data/dbf0602c8d2bcb4fee2f0cfec69ce1d5c68ec03e.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/de8d98bf30df6f8981b1a752320a59b2c5521d62.md` | docker | DEPLOYMENT |
| `playwright-report/data/e2343d562759d2b64c3d1f0eceae203415ed1928.md` | docker | DEPLOYMENT |
| `playwright-report/data/e493e45c09318f9c09f6e55dcf9ff4ed3199fd8e.md` | docker, deployment | DEPLOYMENT |
| `playwright-report/data/e6aab242f8d00eb76c29f85a2c3876d5dfa40485.md` | docker | DEPLOYMENT |
| `playwright-report/data/efcb1c9113ed0e0ad3bc7aecf46d83d8ddc6e1c5.md` | docker, deployment | DEPLOYMENT |
| `playwright.config.ts` | docker, deployment, env_var | DEPLOYMENT |
| `pnpm-lock.yaml` | docker, cron, deployment, startup | DEPLOYMENT |
| `pnpm-workspace.yaml` | name/path match | BUILD |
| `pricing_audit_fix.sh` | docker, env_var | DEPLOYMENT |
| `pricing_audit_patch.py` | docker, env_var | DEPLOYMENT |
| `r3-audit-round3.sh` | docker, env_var | DEPLOYMENT |
| `r3-cors-fix-option-a.sh` | docker, env_var | DEPLOYMENT |
| `r3-cors-fix-option-b.sh` | docker, env_var | DEPLOYMENT |
| `r3-hygiene-execute.py` | docker, env_var | DEPLOYMENT |
| `r3-project-clean.sh` | docker, deployment, startup, env_var | DEPLOYMENT |
| `r3_audit_round3.sh` | docker, env_var | DEPLOYMENT |
| `r3audit` | docker, deployment, env_var | DEPLOYMENT |
| `r3execute` | docker, deployment, env_var | DEPLOYMENT |
| `r3hygiene.py` | docker, ci_cd, cron, deployment, startup, env_var | DEPLOYMENT |
| `r3setup` | docker, ci_cd, cron, deployment, env_var | DEPLOYMENT |
| `railway.toml` | docker, deployment | DEPLOYMENT |
| `remediate-dependabot.sh` | docker, env_var | DEPLOYMENT |
| `run_all_patches.sh` | docker, env_var | DEPLOYMENT |
| `run_all_patches_v2.sh` | docker, env_var | DEPLOYMENT |
| `run_all_patches_v2_fixed.sh` | docker, env_var | DEPLOYMENT |
| `scripts/00_PHASE2_IMPLEMENTATION_COMPLETE.md` | docker, deployment, env_var | DEPLOYMENT |
| `scripts/INTEGRATION_GUIDE.md` | docker, deployment, env_var | DEPLOYMENT |
| `scripts/docs_WIRE_Version2.txt` | docker | DEPLOYMENT |
| `scripts/enforce-ui-design-system.sh` | docker, env_var | DEPLOYMENT |
| `scripts/github_workflows_docs_and_security_audit_Version2 (1).yml` | docker, ci_cd | DEPLOYMENT |
| `scripts/github_workflows_docs_audit_Version2.yml` | docker | DEPLOYMENT |
| `scripts/install-mutation-tracer.sh` | docker, env_var | DEPLOYMENT |
| `scripts/lint-design-tokens.ts` | docker | DEPLOYMENT |
| `scripts/mutation-tracer.debug.ts` | docker | DEPLOYMENT |
| `scripts/mutation-tracer.test.ts` | docker | DEPLOYMENT |
| `scripts/r3_master_fix.py` | docker, ci_cd, env_var | DEPLOYMENT |
| `scripts/scripts_security_due_check_Version2.py` | docker | DEPLOYMENT |
| `scripts/scripts_verify_artifacts_exist_Version2.py` | docker | DEPLOYMENT |
| `scripts/trpc-tracer.debug.ts` | docker | DEPLOYMENT |
| `scripts/vite.config.snippet.ts` | docker, env_var | DEPLOYMENT |
| `secrets/r3v4_secrets_20260415_205734.tar.gz.gpg` | name/path match | SECURITY |
| `server/app.ts` | docker | DEPLOYMENT |
| `server/base-procedures.ts` | docker | DEPLOYMENT |
| `server/db/index.ts` | docker, deployment, env_var | DEPLOYMENT |
| `server/db/migrations/0000_damp_norman_osborn.sql` | name/path match | MIGRATION |
| `server/db/migrations/0002_c03_ai_transition_daily_window.sql` | name/path match | MIGRATION |
| `server/db/migrations/0005_overjoyed_gambit.sql` | name/path match | MIGRATION |
| `server/db/migrations/materialized-views.sql` | name/path match | MIGRATION |
| `server/db/schema.ts` | docker, deployment | DEPLOYMENT |
| `server/drizzle.config.ts` | docker, env_var | DEPLOYMENT |
| `server/lib/logger.ts` | docker, env_var | DEPLOYMENT |
| `server/lib/storage-s3.ts` | docker, deployment, startup, env_var | DEPLOYMENT |
| `server/middleware/auth.ts` | docker, env_var | DEPLOYMENT |
| `server/middleware/enforceUsage.ts` | docker | DEPLOYMENT |
| `server/middleware/errorHandler.ts` | docker, env_var | DEPLOYMENT |
| `server/middleware/feature-gate.ts` | docker | DEPLOYMENT |
| `server/middleware/rateLimit.ts` | docker, env_var | DEPLOYMENT |
| `server/middleware/requireUser.ts` | docker | DEPLOYMENT |
| `server/package.json` | deployment | DEPLOYMENT |
| `server/procedures.ts` | docker | DEPLOYMENT |
| `server/routers/adminRouter.ts` | docker, env_var | DEPLOYMENT |
| `server/routers/aiMix.router.ts` | docker, deployment | DEPLOYMENT |
| `server/routers/daw.ts` | docker, ci_cd | DEPLOYMENT |
| `server/routers/dj.router.ts` | docker | DEPLOYMENT |
| `server/routers/index.ts` | docker | DEPLOYMENT |
| `server/routers/mixer.router.ts` | docker | DEPLOYMENT |
| `server/routers/sessionMetrics.router.ts` | docker | DEPLOYMENT |
| `server/routers/sessions.ts` | docker | DEPLOYMENT |
| `server/routers/subscription.ts` | docker, env_var | DEPLOYMENT |
| `server/routes.ts` | docker | DEPLOYMENT |
| `server/routes/auth.ts` | docker, env_var | DEPLOYMENT |
| `server/routes/effects.ts` | docker | DEPLOYMENT |
| `server/routes/internal.ts` | docker | DEPLOYMENT |
| `server/routes/loopProjects.ts` | docker | DEPLOYMENT |
| `server/routes/loops.ts` | docker, env_var | DEPLOYMENT |
| `server/routes/midi.ts` | docker | DEPLOYMENT |
| `server/routes/mock-billing.ts` | docker | DEPLOYMENT |
| `server/routes/presets.ts` | docker | DEPLOYMENT |
| `server/routes/stripe-webhook.ts` | docker | DEPLOYMENT |
| `server/routes/waveform.ts` | docker | DEPLOYMENT |
| `server/scripts/seed/database.seed.ts` | docker | DEPLOYMENT |
| `server/scripts/seed/index.ts` | docker, env_var | DEPLOYMENT |
| `server/scripts/seed/stripe.seed.ts` | docker, env_var | DEPLOYMENT |
| `server/services/aiMixClient.ts` | docker | DEPLOYMENT |
| `server/services/audio-analysis.ts` | docker, ci_cd | DEPLOYMENT |
| `server/services/auto-level-session.ts` | docker | DEPLOYMENT |
| `server/services/mock-billing.ts` | docker, env_var | DEPLOYMENT |
| `server/services/session-metrics.service.ts` | docker | DEPLOYMENT |
| `server/services/storage.ts` | docker | DEPLOYMENT |
| `server/services/stripe-subscription.ts` | docker, env_var | DEPLOYMENT |
| `server/services/time-savings.service.ts` | docker, ci_cd | DEPLOYMENT |
| `server/static.ts` | docker | DEPLOYMENT |
| `server/storage.ts` | docker | DEPLOYMENT |
| `server/tools/create-pitch-deck-pro.js` | docker, ci_cd, deployment, startup, env_var | DEPLOYMENT |
| `server/trpc.ts` | docker | DEPLOYMENT |
| `server/types/multer-s3.d.ts` | docker | DEPLOYMENT |
| `server/utils/fileUtils.ts` | docker, env_var | DEPLOYMENT |
| `server/vite-dev.ts` | docker | DEPLOYMENT |
| `server/ws/SessionBroadcaster.ts` | docker | DEPLOYMENT |
| `server/ws/collab.ts` | docker, env_var | DEPLOYMENT |
| `services/ai-mix/Dockerfile` | docker, startup, env_var | DEPLOYMENT |
| `services/ai-mix/src/AIMixingService.ts` | docker | DEPLOYMENT |
| `services/ai-mix/src/app.py` | docker | DEPLOYMENT |
| `services/ai-mix/src/genreInference.ts` | docker | DEPLOYMENT |
| `services/ai-mix/src/index.ts` | docker | DEPLOYMENT |
| `services/ai-mix/src/main.py` | docker | DEPLOYMENT |
| `shared/index.ts` | docker | DEPLOYMENT |
| `shared/mixer.types.ts` | docker | DEPLOYMENT |
| `shared/schema-daw-patch.ts` | docker | DEPLOYMENT |
| `shared/schema-session-metrics.ts` | docker | DEPLOYMENT |
| `shared/schema-subscription.ts` | docker | DEPLOYMENT |
| `shared/schema.ts` | docker | DEPLOYMENT |
| `shared/subscription.types.ts` | docker, deployment, startup, env_var | DEPLOYMENT |
| `shared/types/audio-additions.ts` | docker | DEPLOYMENT |
| `shared/types/automation-additions.ts` | docker | DEPLOYMENT |
| `shared/types/project.types.ts` | docker | DEPLOYMENT |
| `shared/types/trpc.ts` | docker | DEPLOYMENT |
| `test-import.ts` | docker | DEPLOYMENT |
| `test-results/e2e-audio-user-can-play-and-stop-audio-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-audio-volume-control-works-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-core-App-loads-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-core-Basic-navigation-works-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-core-Critical-flow-play-audio-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-effects-user-can-enable-multiple-effects-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-multiuser-multi-user-session-sync-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-performance-audio-playback-starts-quickly-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-upload-upload-and-play-audio-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-visual-effects-panel-renders-correctly-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-visual-waveform-renders-correctly-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/e2e-websocket-WebSocket-session-sync-chromium/error-context.md` | docker | DEPLOYMENT |
| `test-results/happy-path-R3-v4-Happy-Pat-797bb-stays-up-10-rapid-requests--chromium/error-context.md` | docker, deployment, env_var | DEPLOYMENT |
| `test-results/happy-path-R3-v4-Happy-Path-Health-endpoint-returns-200-chromium/error-context.md` | docker, deployment, env_var | DEPLOYMENT |
| `test-results/happy-path-R3-v4-Happy-Path-Root-path-returns-404-chromium/error-context.md` | docker, deployment, env_var | DEPLOYMENT |
| `test-results/happy-path-R3-v4-Happy-Path-Server-responds-to-requests-chromium/error-context.md` | docker | DEPLOYMENT |
| `tests/e2e/audio.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/core.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/effects.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/multiuser.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/performance.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/upload.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/visual.spec.ts` | docker | DEPLOYMENT |
| `tests/e2e/websocket.spec.ts` | docker | DEPLOYMENT |
| `tests/happy-path.spec.ts` | docker, deployment, env_var | DEPLOYMENT |
| `tools/auth_god.py` | docker, ci_cd, deployment, startup, env_var | DEPLOYMENT |
| `tools/dashboard/stack-rating.jsx` | docker, ci_cd | DEPLOYMENT |
| `tools/patch_instrument_pagenav_import.py` | docker, env_var | DEPLOYMENT |
| `tools/r3_fix_store_barrel.py` | docker, env_var | DEPLOYMENT |
| `tools/r3_master_fix.py` | docker, env_var | DEPLOYMENT |
| `tools/scripts/enforce-singleton-engine.sh` | docker, env_var | DEPLOYMENT |
| `tools/src/App.jsx` | docker | DEPLOYMENT |
| `tools/src/broken.json` | docker | DEPLOYMENT |
| `tools/src/engine/initEngine.js` | docker | DEPLOYMENT |
| `tools/src/engine/startEngine.js` | docker | DEPLOYMENT |
| `tools/src/hooks/useAudioFrame.js` | docker | DEPLOYMENT |
| `tools/src/useAudioFrame.js` | docker | DEPLOYMENT |
| `tsc_F-10` | docker, ci_cd, cron | DEPLOYMENT |
| `turbo.json` | name/path match | BUILD |
| `update-collab-demo-hook.sh` | docker | DEPLOYMENT |
| `vitest.config.ts` | docker, ci_cd | DEPLOYMENT |
| `vitest.workspace.ts` | docker | DEPLOYMENT |

### E.2 — Anomalous Files at Repository Root

| File | Reason |
|---|---|
| `adminRouter.ts` | Router file at repo root |
| `App.tsx` | React/JSX component at repo root |
| `p0_theme_additions.css` | Priority-patch CSS at repo root |

### E.3 — Extensionless Files (type unknown)

Run `file <name>` on each to determine type before any action.

| File | Size |
|---|---|
| `r3audit` | 8,536B |
| `r3execute` | 26,718B |
| `r3setup` | 70,380B |
| `Sending` | 0B |
| `pnpm` | 0B |
| `tsc` | 0B |
| `ui-modernization-phase1` | 0B |
| `eslint` | 0B |
| `vitest` | 0B |
| `HealthCheckResponse` | 0B |
| `should` | 0B |
| `ubmitSuggestionOutcome wiring` | 1,128B |
| `:` | 13,067B |
| `16` | 0B |
| `8` | 0B |
| `Dockerfile` | 1,343B |
| `0` | 0B |
| `react-use` | 0B |
| `js-cookie` | 0B |
| `drizzle-kit` | 0B |
| `esbuild` | 0B |
| `express` | 0B |
| `qs` | 0B |
| `Fix` | 3,032B |
| `tsc_F-10` | 66,693B |
| `)` | 3,816B |

### E.4 — TypeScript Config Variants

| File |
|---|
| `client/config/tsconfig.node.json` |
| `client/config/tsconfig.worklet.json` |
| `client/tsconfig.json` |
| `client/tsconfig.node.json` |
| `client/tsconfig.vocalspectra.json` |
| `client/tsconfig.worklet.json` |
| `config/tsconfig.json` |
| `packages/llpte-adapters/tsconfig.bench.json` |
| `packages/llpte-adapters/tsconfig.json` |
| `packages/llpte-ai/tsconfig.bench.json` |
| `packages/llpte-ai/tsconfig.json` |
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_230659` |
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_231354` |
| `packages/llpte-ai/tsconfig.json.bak-ts-fix-20260419_231734` |
| `packages/llpte-core/tsconfig.bench.json` |
| `packages/llpte-core/tsconfig.json` |
| `packages/llpte-core/tsconfig.json.bak-ts-fix-20260419_231734` |
| `packages/llpte-execution/tsconfig.bench.json` |
| `packages/llpte-execution/tsconfig.json` |
| `packages/llpte-execution/tsconfig.json.bak-ts-fix-20260419_230659` |
| `packages/llpte-signal/tsconfig.bench.json` |
| `packages/llpte-signal/tsconfig.json` |
| `packages/llpte-signal/tsconfig.json.bak-composite` |
| `packages/llpte-signal/tsconfig.json.bak-rootdir` |
| `packages/llpte-transition-graph/tsconfig.bench.json` |
| `packages/llpte-transition-graph/tsconfig.json` |
| `server/tsconfig.json` |
| `shared/tsconfig.json` |
| `tsconfig.json` |

---
## Section F — Script Dependency Report

### F.1 — Shell Script Analysis

| Script | Classification | Destructive Ops | Rollback | Calls | Env Vars | Referenced By |
|---|---|---|---|---|---|---|
| `admin.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 6 vars | 0 |
| `apply-fix.sh` | ROLLBACK_TOOL — preserve | no | ✓ | apply-all-fixes.sh | 3 vars | 0 |
| `apply-phase4-engine-patch.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 6 vars | 0 |
| `asi-hygiene-master.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 19 vars | 0 |
| `asi-upgrade-fixed.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 7 vars | 0 |
| `asi_mastery_troubleshooter.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 3 vars | 0 |
| `c03_diagnostic.sh` | UNVERIFIED — human review required | no | - | - | 0 vars | 0 |
| `client/build_and_integrate_VocalSpectra.sh` | ROLLBACK_TOOL — preserve | ⚠️ YES | ✓ | - | 20 vars | 0 |
| `client/build_and_test_vocalspectra_Version2.sh` | ROLLBACK_TOOL — preserve | ⚠️ YES | ✓ | - | 20 vars | 0 |
| `client/fix-jsx-parent.sh` | ONE_TIME_PATCH — verify if applied | no | - | - | 3 vars | 0 |
| `client/src/add-visual-alias-wouter.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 8 vars | 0 |
| `client/src/add-visual-alias.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 7 vars | 0 |
| `db.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 14 vars | 0 |
| `deploy.sh` | LIKELY_ACTIVE | no | - | - | 7 vars | 0 |
| `final-hygiene-fix.sh` | ONE_TIME_PATCH — verify if applied | no | - | - | 7 vars | 0 |
| `find_api_auth.sh` | UNVERIFIED — human review required | no | - | - | 0 vars | 0 |
| `fix-js-cookie.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 1 vars | 0 |
| `fix_c03_proper.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 7 vars | 0 |
| `fix_c03_surgical.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 6 vars | 0 |
| `fix_green_bars_direct.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 3 vars | 0 |
| `fix_pricing_audit.sh` | LIKELY_ACTIVE | no | ✓ | fix_pricing_audit.sh | 16 vars | 1 |
| `fixduplicate.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 2 vars | 0 |
| `master_sync_drizzle_journal.sh` | UNVERIFIED — human review required | no | - | - | 17 vars | 0 |
| `p0-p1-deploy.sh` | LIKELY_ACTIVE | no | - | p0-p1-deploy.sh | 7 vars | 1 |
| `patch-collab-daw.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 7 vars | 0 |
| `patch-js-cookie-both.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 2 vars | 0 |
| `pricing_audit_fix.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 1 vars | 0 |
| `r3-audit-round3.sh` | TOOLING — verify if still active | no | - | - | 20 vars | 0 |
| `r3-cors-fix-option-a.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 14 vars | 0 |
| `r3-cors-fix-option-b.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 14 vars | 0 |
| `r3-project-clean.sh` | LIKELY_ACTIVE | ⚠️ YES | ✓ | r3-project-clean.sh | 20 vars | 1 |
| `r3_audit_round3.sh` | TOOLING — verify if still active | no | - | - | 20 vars | 0 |
| `remediate-dependabot.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 12 vars | 0 |
| `run_all_patches.sh` | LIKELY_ACTIVE | no | - | scripts/security/run_all_patches.sh | 9 vars | 1 |
| `run_all_patches_v2.sh` | LIKELY_ACTIVE | no | - | run_all_patches_v2.sh | 9 vars | 1 |
| `run_all_patches_v2_fixed.sh` | LIKELY_ACTIVE | no | - | run_all_patches_v2_fixed.sh | 10 vars | 1 |
| `scripts/enforce-ui-design-system.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 5 vars | 0 |
| `scripts/install-mutation-tracer.sh` | ROLLBACK_TOOL — preserve | ⚠️ YES | ✓ | - | 18 vars | 0 |
| `scripts/max-checker.sh` | UNVERIFIED — human review required | no | - | - | 20 vars | 0 |
| `tools/scripts/enforce-singleton-engine.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 6 vars | 0 |
| `update-collab-demo-hook.sh` | ROLLBACK_TOOL — preserve | no | ✓ | - | 14 vars | 0 |

### F.2 — Python Script Analysis

| Script | Classification | Migration Logic | CLI | Destructive | Imports | Referenced By |
|---|---|---|---|---|---|---|
| `asi-audit-register.py` | CLI_TOOL — verify if still used | - | ✓ | - | 4 | 0 |
| `audit_theme_config.py` | LIKELY_ACTIVE | - | ✓ | - | 4 | 1 |
| `fix-collab.py` | ONE_TIME_PATCH — verify if applied | - | - | - | 2 | 0 |
| `fix-logging-corrected.py` | CLI_TOOL — verify if still used | - | ✓ | - | 4 | 0 |
| `fix-logging-phase1.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 8 | 0 |
| `fix_c01_esbuild_override.py` | CLI_TOOL — verify if still used | - | ✓ | - | 4 | 0 |
| `fix_c01_esbuild_override_v2.py` | CLI_TOOL — verify if still used | - | ✓ | - | 4 | 0 |
| `fix_c03_session_bypass.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 5 | 0 |
| `fix_collab_AUDITED_v2_FIXED.py` | ONE_TIME_PATCH — verify if applied | - | - | - | 2 | 0 |
| `fix_eslint_config.py` | CLI_TOOL — verify if still used | - | ✓ | - | 4 | 0 |
| `fix_f10_prompt_injection.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 4 | 0 |
| `fix_f10_prompt_injection_v2.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 4 | 0 |
| `inspect-init-constants.py` | UNVERIFIED — human review required | - | - | - | 2 | 0 |
| `lint-cleanup-imports.py` | LIKELY_ACTIVE | - | ✓ | - | 8 | 1 |
| `patch_headers_v2.py` | ONE_TIME_PATCH — verify if applied | - | - | - | 0 | 0 |
| `patch_remove_panel_borders.py` | LIKELY_ACTIVE | - | ✓ | - | 5 | 1 |
| `patch_skills_13.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | - | - | 2 | 0 |
| `pricing_audit_patch.py` | LIKELY_ACTIVE | - | ✓ | - | 7 | 1 |
| `r3-hygiene-execute.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | ⚠️ YES | 8 | 1 |
| `r3hygiene.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 12 | 0 |
| `scripts/r3_master_fix.py` | MIGRATION — preserve until confirmed applied | ⚠️ YES | ✓ | - | 10 | 3 |
| `scripts/scripts_security_due_check_Version2.py` | UNVERIFIED — human review required | - | - | - | 3 | 0 |
| `scripts/scripts_verify_artifacts_exist_Version2.py` | UNVERIFIED — human review required | - | - | - | 2 | 0 |
| `services/ai-mix/src/ai_mix.py` | UNVERIFIED — human review required | - | - | - | 2 | 0 |
| `services/ai-mix/src/app.py` | CLI_TOOL — verify if still used | - | ✓ | - | 5 | 0 |
| `services/ai-mix/src/main.py` | UNVERIFIED — human review required | - | - | - | 1 | 0 |
| `tools/auth_god.py` | LIKELY_ACTIVE | - | ✓ | - | 4 | 1 |
| `tools/patch_instrument_pagenav_import.py` | CLI_TOOL — verify if still used | - | ✓ | - | 5 | 0 |
| `tools/r3_fix_store_barrel.py` | LIKELY_ACTIVE | - | ✓ | - | 4 | 1 |
| `tools/r3_master_fix.py` | LIKELY_ACTIVE | - | ✓ | - | 6 | 3 |

---
## Section G — Human Review Queue

All items below require human decision before any automated action is permitted.

### G.1 — Lockfile & Dependency Manager Conflicts
- CONFLICT: Multiple package managers detected: ['pnpm', 'npm']. This causes non-deterministic installs.

### G.2 — Parallel Duplicate Directories

The following directory names exist at multiple levels of the tree. Determine which is canonical before any consolidation.

| Directory Name | Locations |
|---|---|
| `components` | `client/src/components`<br>`client/src/features/loopstation/components`<br>`client/src/pages/multi-track-panel/components` |
| `hooks` | `client/client/hooks`<br>`client/src/hooks`<br>`client/src/audio/hooks`<br>`client/src/features/loopstation/hooks`<br>`tools/src/hooks` |

### G.3 — Empty Directories

| Directory | Action |
|---|---|
| `client/client/src/tokens` | Confirm intentional placeholder or remove |
| `client/src/features/DAW` | Confirm intentional placeholder or remove |
| `client/src/hook` | Confirm intentional placeholder or remove |
| `logs` | Confirm intentional placeholder or remove |
| `scripts/security` | Confirm intentional placeholder or remove |
| `server/storage/loops` | Confirm intentional placeholder or remove |
| `storage/loops` | Confirm intentional placeholder or remove |
| `storage/projects` | Confirm intentional placeholder or remove |
| `tools/scripts/_backup_phase4_1779763609` | Confirm intentional placeholder or remove |

### G.4 — Non-Standard Extension Files (.mythos, .ts6bak, .null., etc.)

| File | Non-Standard Suffix | Action |
|---|---|---|
| `client/src/hooks/useSessionMetricsSync.ts.mythos` | `.mythos` | Explain purpose before any action |
| `client/src/stores/session-metrics-store.ts.mythos` | `.mythos` | Explain purpose before any action |
| `client/src/stores/session-store.ts.mythos` | `.mythos` | Explain purpose before any action |
| `server/services/session-metrics.service.ts.mythos` | `.mythos` | Explain purpose before any action |

### G.5 — Scripts Flagged for Human Review

| Script | Classification | Notes |
|---|---|---|
| `c03_diagnostic.sh` | UNVERIFIED — human review required | - |
| `client/fix-jsx-parent.sh` | ONE_TIME_PATCH — verify if applied | - |
| `final-hygiene-fix.sh` | ONE_TIME_PATCH — verify if applied | - |
| `find_api_auth.sh` | UNVERIFIED — human review required | - |
| `fix-collab.py` | ONE_TIME_PATCH — verify if applied | - |
| `fix_collab_AUDITED_v2_FIXED.py` | ONE_TIME_PATCH — verify if applied | - |
| `inspect-init-constants.py` | UNVERIFIED — human review required | - |
| `master_sync_drizzle_journal.sh` | UNVERIFIED — human review required | - |
| `patch_headers_v2.py` | ONE_TIME_PATCH — verify if applied | - |
| `scripts/max-checker.sh` | UNVERIFIED — human review required | - |
| `scripts/scripts_security_due_check_Version2.py` | UNVERIFIED — human review required | - |
| `scripts/scripts_verify_artifacts_exist_Version2.py` | UNVERIFIED — human review required | - |
| `services/ai-mix/src/ai_mix.py` | UNVERIFIED — human review required | - |
| `services/ai-mix/src/main.py` | UNVERIFIED — human review required | - |

### G.6 — Nested Package Manifests (potential shadow installs)

| package.json location |
|---|
| `client/package.json` |
| `package.json` |
| `packages/llpte-adapters/package.json` |
| `packages/llpte-ai/package.json` |
| `packages/llpte-core/package.json` |
| `packages/llpte-execution/package.json` |
| `packages/llpte-signal/package.json` |
| `packages/llpte-transition-graph/package.json` |
| `server/package.json` |
| `services/ai-mix/package.json` |
| `shared/package.json` |

---
## Execution Gate — Checklist Before Any Destructive Action

- [ ] All extensionless files typed via `file <name>`
- [ ] All shell scripts read and execution paths traced
- [ ] All Python scripts classified (one-time vs ongoing)
- [ ] Lockfile/dependency manager conflict resolved
- [ ] Parallel directory architectural question answered by project owner
- [ ] Empty directories confirmed intentional or safe
- [ ] `.mythos` and other non-standard extension files explained
- [ ] `_sweep` backup convention confirmed non-active in tooling
- [ ] All backup groups hash-compared (done above) and recommended-keep confirmed
- [ ] Migration scripts confirmed applied before any removal
- [ ] `client/client/` nested directory inventoried (if present)
- [ ] Anomalous root-level source files investigated (App.tsx, adminRouter.ts, etc.)
- [ ] `Sending/` directory at repo root inventoried
- [ ] `packages/` directory at repo root inventoried
- [ ] Section C populated by human reviewer with confirmed-safe files

---
*Generated by `asi_hygiene_audit.py` — zero destructive operations performed.*
