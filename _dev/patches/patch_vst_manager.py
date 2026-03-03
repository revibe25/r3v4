#!/usr/bin/env python3
"""
Patch script for VSTManagerPage in src/App.tsx
Run from: ~/Stable/R3 v4/client/
  python3 patch_vst_manager.py
"""

import re, shutil, sys
from pathlib import Path

APP = Path('src/App.tsx')

if not APP.exists():
    sys.exit(f"ERROR: {APP} not found. Run from the client/ directory.")

# ── backup ──────────────────────────────────────────────────────────────────
shutil.copy(APP, APP.with_suffix('.tsx.bak'))
print("✓ Backed up App.tsx → App.tsx.bak")

src = APP.read_text()

# ============================================================
# PATCH 1 — add two missing imports after existing VST imports
# ============================================================
OLD_IMPORTS = "import { MixerChannel } from '@/audio/mixer/mixer-channel';"
NEW_IMPORTS = """import { MixerChannel } from '@/audio/mixer/mixer-channel';
import { VSTProjectSerializer } from '@/audio/fx/vst-project-serializer';
import { FXChain } from '@/audio/fx/fx-chain';"""

if 'VSTProjectSerializer' in src:
    print("⚠  VSTProjectSerializer import already present — skipping import patch")
elif OLD_IMPORTS not in src:
    sys.exit("ERROR: Could not find import anchor. Aborting.")
else:
    src = src.replace(OLD_IMPORTS, NEW_IMPORTS, 1)
    print("✓ Added VSTProjectSerializer + FXChain imports")

# ============================================================
# PATCH 2 — replace VSTManagerPage function
# ============================================================

# Find exact function boundaries with brace-counting
start_marker = 'function VSTManagerPage()'
start_idx = src.find(start_marker)
if start_idx == -1:
    sys.exit("ERROR: Could not find 'function VSTManagerPage()'. Aborting.")

depth = 0
end_idx = start_idx
for i, ch in enumerate(src[start_idx:], start_idx):
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            end_idx = i + 1
            break

old_fn = src[start_idx:end_idx]

NEW_FN = '''function VSTManagerPage() {
  const vstContext = useVSTContext();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // ── Save ──────────────────────────────────────────────────
  const handleProjectSave = () => {
    setSaveStatus('saving');
    try {
      // Build FX chain map from live channels
      const chainMap = new Map<string, FXChain>();
      vstContext.channels.forEach(ch => chainMap.set(ch.id, ch.fxChain));

      const data = VSTProjectSerializer.serializeProject(
        chainMap,
        vstContext.sidechainRouter,
        vstContext.audioContext,
      );

      // Auto-backup every save (keeps last 10)
      VSTProjectSerializer.createBackup(data, `auto-${Date.now()}`);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return data;
    } catch (err) {
      console.error('[VSTManagerPage] Save failed:', err);
      setSaveStatus('error');
      throw err;
    }
  };

  // ── Load ──────────────────────────────────────────────────
  const handleProjectLoad = async (data: any) => {
    setLoadError(null);

    // 1. Basic validation
    if (!data?.version || !Array.isArray(data?.chains)) {
      const msg = 'Invalid project file: missing "version" or "chains".';
      setLoadError(msg);
      throw new Error(msg);
    }

    // 2. Backup current state before we destroy anything
    try {
      const chainMap = new Map<string, FXChain>();
      vstContext.channels.forEach(ch => chainMap.set(ch.id, ch.fxChain));
      const snapshot = VSTProjectSerializer.serializeProject(
        chainMap,
        vstContext.sidechainRouter,
        vstContext.audioContext,
      );
      VSTProjectSerializer.createBackup(snapshot, `pre-load-${Date.now()}`);
    } catch (backupErr) {
      // Non-fatal — warn and continue
      console.warn('[VSTManagerPage] Pre-load backup failed:', backupErr);
    }

    // 3. Tear down existing channels
    const oldIds = vstContext.channels.map(ch => ch.id);
    oldIds.forEach(id => vstContext.removeChannel(id));

    // 4. Re-create channels and restore mixer state
    for (const chainData of data.chains) {
      const ch = vstContext.addChannel(chainData.channelId);
      if (chainData.volume  != null) ch.setVolume(chainData.volume);
      if (chainData.pan     != null) ch.setPan(chainData.pan);
      if (chainData.muted   != null) ch.setMute(chainData.muted);
      if (chainData.solo    != null) ch.setSolo(chainData.solo);
      if (chainData.armed   != null) ch.setArmed(chainData.armed);
      if (chainData.name)            ch.setName(chainData.name);
    }

    // 5. Deserialize FX chains (VST plugins, native effects)
    try {
      const restoredChains = await VSTProjectSerializer.deserializeProject(
        data,
        vstContext.audioContext,
      );

      restoredChains.forEach((fxChain, channelId) => {
        const ch = vstContext.getChannel(channelId);
        if (!ch) return;
        ch.clearFX();
        fxChain.getAllEffects().forEach(fx => ch.addFX(fx));
      });
    } catch (fxErr) {
      // Partially fatal — channels exist but some FX may be missing
      const warning = 'Project loaded with warnings: one or more FX plugins could not be restored.';
      console.error('[VSTManagerPage] FX restore error:', fxErr);
      setLoadError(warning);
    }

    // 6. Restore sidechain connections
    if (Array.isArray(data.sidechains) && data.sidechains.length > 0) {
      try {
        // Clear stale connections first
        const existing = vstContext.sidechainRouter.getAllConnections();
        existing.forEach(conn => {
          try {
            vstContext.sidechainRouter.removeConnection(
              conn.config.sourceId,
              conn.config.targetId,
            );
          } catch (_) { /* ignore individual removal errors */ }
        });

        // Restore saved connections
        data.sidechains.forEach((config: any) => {
          try {
            vstContext.sidechainRouter.addConnection(config);
          } catch (e) {
            console.warn('[VSTManagerPage] Sidechain restore skipped:', config, e);
          }
        });
      } catch (scErr) {
        console.warn('[VSTManagerPage] Sidechain restore failed:', scErr);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-[#f0f0f0] font-mono">
      <PageNav />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-widest uppercase text-[#a3e635]">
            🔌 VST Plugin Manager
          </h1>
          <p className="text-[#888] mt-2 text-xs tracking-wider">
            Manage your VST plugins, performance monitoring, and routing
          </p>

          {/* Save status indicator */}
          {saveStatus === 'saved' && (
            <div className="mt-2 text-xs text-[#a3e635] tracking-wider">
              ✓ Project saved &amp; backed up
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="mt-2 text-xs text-red-400 tracking-wider">
              ✗ Save failed — check console
            </div>
          )}

          {/* Load error banner */}
          {loadError && (
            <div className="mt-3 flex items-start gap-2 rounded-none border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 tracking-wider">
              <span>⚠</span>
              <span>{loadError}</span>
              <button
                onClick={() => setLoadError(null)}
                className="ml-auto text-yellow-400 hover:text-yellow-200"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback message="Loading VST Master Panel..." />}>
            <VSTMasterPanel
              performanceMonitor={vstContext.performanceMonitor}
              sidechainRouter={vstContext.sidechainRouter}
              automationEngine={vstContext.automationEngine}
              channels={vstContext.channels}
              onProjectSave={handleProjectSave}
              onProjectLoad={handleProjectLoad}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}'''

src = src.replace(old_fn, NEW_FN, 1)
APP.write_text(src)
print("✓ VSTManagerPage replaced with full implementation")
print("\nDone! Changes:")
print("  • handleProjectSave  → uses VSTProjectSerializer.serializeProject() + auto-backup")
print("  • handleProjectLoad  → validates → pre-load backup → clear channels → restore")
print("                         mixer state → deserialize FX chains → restore sidechains")
print("  • Error banner UI for load warnings / FX-restore failures")
print("  • Save status badge (saved / error)")
print("\nRun: npm run dev  to verify.")
