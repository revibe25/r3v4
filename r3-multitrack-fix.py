#!/usr/bin/env python3
"""
r3-multitrack-fix.py
Fixes the /multitrack route Vite import failure.

Root cause: App.tsx imports MultiTrackPanel from components/multi-track-panel.tsx,
which references a ./multi-track-panel/ subdirectory that never existed.
The canonical component lives in pages/multi-track-panel.tsx but its own
./multi-track-panel/* imports also lack backing files.

Fix:
  1. Create pages/multi-track-panel/ with real implementations of every
     live dependency (AudioEngine, constants, utils, types, modals)
     plus null stubs for dead imports (MixerView, TimelineView).
  2. Patch App.tsx line 57 to import from pages/ instead of components/.

Usage:
  python3 r3-multitrack-fix.py           # dry-run
  python3 r3-multitrack-fix.py --run     # apply
  python3 r3-multitrack-fix.py --run --verify
"""

import argparse, datetime, shutil, subprocess, sys
from pathlib import Path

ROOT = Path.home() / "Stable"
SRC  = ROOT / "client/src"
TS   = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

# ── Files to create ────────────────────────────────────────────────────────────
# (path relative to SRC, file content)
NEW_FILES: list[tuple[str, str]] = []

# ── 1. audio-engine.ts ────────────────────────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/audio-engine.ts", """\
/**
 * pages/multi-track-panel/audio-engine.ts
 * Minimal Web Audio engine for MultiTrackPanel.
 * Provides: initialize, cleanup, loadAudioFile, generateWaveformData.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;

  async initialize(): Promise<void> {
    try {
      this.ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    } catch (err) {
      console.error('[AudioEngine] init failed:', err);
    }
  }

  cleanup(): void {
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }

  async loadAudioFile(file: File): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const ab = await file.arrayBuffer();
      return await this.ctx.decodeAudioData(ab);
    } catch (err) {
      console.error('[AudioEngine] loadAudioFile failed:', err);
      return null;
    }
  }

  generateWaveformData(buffer: AudioBuffer, samples = 200): number[] {
    const ch   = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / samples));
    const out: number[] = [];
    for (let i = 0; i < samples; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        peak = Math.max(peak, Math.abs(ch[i * step + j] ?? 0));
      }
      out.push(peak);
    }
    return out;
  }
}
"""))

# ── 2. constants.ts ───────────────────────────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/constants.ts", """\
/**
 * pages/multi-track-panel/constants.ts
 * Shared constants for MultiTrackPanel.
 * THEME_COLORS is a dead import in the monolith — exported for resolution only.
 */
export const THEME_COLORS = {
  primary:   '#a3e635',
  secondary: '#22d3ee',
  warning:   '#f59e0b',
  danger:    '#ef4444',
} as const;

export const TRACK_COLORS: string[] = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#a855f7', '#f43f5e',
];

/** Maps FXType string → short display label. */
export const FX_ICONS: Record<string, string> = {
  EQ:         'EQ',
  Compressor: 'CMP',
  Reverb:     'REV',
  Delay:      'DLY',
  Saturation: 'SAT',
  Limiter:    'LIM',
  Filter:     'FLT',
  Chorus:     'CHR',
  Phaser:     'PHS',
  Distortion: 'DST',
};
"""))

# ── 3. utils.ts ───────────────────────────────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/utils.ts", """\
/**
 * pages/multi-track-panel/utils.ts
 * Utility functions for MultiTrackPanel.
 */

export type TimeFormat = 'bars' | 'time' | 'frames';

/**
 * Formats a playback position (seconds) to a human-readable string.
 * bars   → "BAR:BEAT:TICK"
 * time   → "M:SS:mmm"
 * frames → "M:SS:FF  (30fps)"
 */
export function formatTime(
  seconds: number,
  format: TimeFormat | string = 'bars',
  tempo = 120,
): string {
  if (seconds < 0) seconds = 0;

  if (format === 'time') {
    const m   = Math.floor(seconds / 60);
    const s   = Math.floor(seconds % 60);
    const ms  = Math.floor((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
  }

  if (format === 'frames') {
    const totalFrames = Math.floor(seconds * 30);
    const ff = totalFrames % 30;
    const ss = Math.floor(totalFrames / 30) % 60;
    const mm = Math.floor(totalFrames / 30 / 60);
    return `${mm}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  }

  // bars (default)
  const beatsPerSecond = tempo / 60;
  const totalBeats     = seconds * beatsPerSecond;
  const bar  = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const tick = Math.floor((totalBeats % 1) * 480);
  return `${bar}:${beat}:${String(tick).padStart(3, '0')}`;
}

/** Generates a short unique ID (timestamp + random suffix). */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Converts linear gain [0–1.25] to dB. Returns -Infinity for gain ≤ 0. */
export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/** Clamps value between min and max (inclusive). */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Serializes the project state to a formatted JSON string. */
export function serializeProject(project: unknown): string {
  return JSON.stringify(project, (_key, value) => {
    // AudioBuffer and typed arrays can't be serialised — omit gracefully.
    if (value instanceof AudioBuffer) return undefined;
    if (value instanceof Float32Array) return Array.from(value);
    return value;
  }, 2);
}

/** Triggers a browser download of a text/JSON blob. */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
"""))

# ── 4. types.ts ───────────────────────────────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/types.ts", """\
/**
 * pages/multi-track-panel/types.ts
 * Shared TypeScript interfaces for MultiTrackPanel.
 * The parent component has @ts-nocheck so these are for resolution only,
 * but they are correct and complete for future type-safe migration.
 */

export type FXType =
  | 'EQ' | 'Compressor' | 'Reverb' | 'Delay'
  | 'Saturation' | 'Limiter' | 'Filter' | 'Chorus'
  | 'Phaser' | 'Distortion';

export type ViewMode = 'mixer' | 'timeline' | 'split';

export type AutomationMode = 'off' | 'read' | 'write' | 'touch' | 'latch';

export interface AudioClip {
  id:           string;
  trackId:      string;
  startTime:    number;
  duration:     number;
  audioBuffer?: AudioBuffer;
  fileName:     string;
  waveformData?: number[];
  color:        string;
}

export interface AdvancedTrack {
  id:             string;
  name:           string;
  type:           'audio' | 'midi' | 'aux' | 'master';
  color:          string;
  armed:          boolean;
  muted:          boolean;
  solo:           boolean;
  frozen:         boolean;
  volume:         number;
  pan:            number;
  fxChain:        FXType[];
  clips:          AudioClip[];
  automation:     { volume: number[]; pan: number[] };
  automationMode: AutomationMode;
  meter:          number;
  peak:           number;
  input:          string;
  output:         string;
  cpuUsage:       number;
}

export interface TransportState {
  isPlaying:     boolean;
  isRecording:   boolean;
  position:      number;
  loopEnabled:   boolean;
  loopStart:     number;
  loopEnd:       number;
  tempo:         number;
  timeSignature: string;
}

export interface Preferences {
  theme:        string;
  mixerView:    string;
  timeFormat:   string;
  viewMode:     ViewMode;
  autoSave:     boolean;
  bufferSize:   number;
  sampleRate:   number;
  showCpuMeter: boolean;
  showVSTPanel: boolean;
}

export interface ProjectState {
  title:        string;
  tracks:       AdvancedTrack[];
  transport:    TransportState;
  masterVolume: number;
  masterMeter:  number;
  masterPeak:   number;
  cpuUsage:     number;
}
"""))

# ── 5. components/preferences-modal.tsx ───────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/components/preferences-modal.tsx", """\
/**
 * pages/multi-track-panel/components/preferences-modal.tsx
 * Settings overlay for MultiTrackPanel.
 * Props: preferences, onUpdate, onClose.
 */
import type { CSSProperties } from 'react';
import type { Preferences, ViewMode } from '../types';

interface Props {
  preferences: Preferences;
  onUpdate:    (updates: Partial<Preferences>) => void;
  onClose:     () => void;
}

const AG = {
  black:  '#060606',
  panel:  '#0d0d0d',
  border: '#1c1c1c',
  acid:   '#a3e635',
  soft:   '#888',
  white:  '#f0f0f0',
};

const row: CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '6px 0',
  borderBottom: `1px solid ${AG.border}`,
};

const label: CSSProperties = {
  fontSize: 10, letterSpacing: '.15em',
  textTransform: 'uppercase', color: AG.soft,
  fontFamily: 'IBM Plex Mono, monospace',
};

const select: CSSProperties = {
  background: AG.black, border: `1px solid ${AG.border}`,
  color: AG.white, fontSize: 10, padding: '2px 6px',
  fontFamily: 'IBM Plex Mono, monospace', borderRadius: 0,
};

export function PreferencesModal({ preferences, onUpdate, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: AG.panel, border: `1px solid ${AG.border}`,
        width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
          background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: AG.acid }}>
            Preferences
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 16px' }}>
          <div style={row}>
            <span style={label}>Sample Rate</span>
            <select style={select} value={preferences.sampleRate}
              onChange={e => onUpdate({ sampleRate: Number(e.target.value) })}>
              {[44100, 48000, 96000].map(r => <option key={r} value={r}>{r / 1000}kHz</option>)}
            </select>
          </div>
          <div style={row}>
            <span style={label}>Buffer Size</span>
            <select style={select} value={preferences.bufferSize}
              onChange={e => onUpdate({ bufferSize: Number(e.target.value) })}>
              {[128, 256, 512, 1024, 2048].map(b => <option key={b} value={b}>{b} smp</option>)}
            </select>
          </div>
          <div style={row}>
            <span style={label}>View Mode</span>
            <select style={select} value={preferences.viewMode}
              onChange={e => onUpdate({ viewMode: e.target.value as ViewMode })}>
              {(['mixer', 'timeline', 'split'] as const).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={row}>
            <span style={label}>Time Format</span>
            <select style={select} value={preferences.timeFormat}
              onChange={e => onUpdate({ timeFormat: e.target.value })}>
              {['bars', 'time', 'frames'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={label}>CPU Meter</span>
            <input type="checkbox" checked={preferences.showCpuMeter}
              onChange={e => onUpdate({ showCpuMeter: e.target.checked })}
              style={{ accentColor: AG.acid, width: 14, height: 14 }} />
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={label}>Auto Save</span>
            <input type="checkbox" checked={preferences.autoSave}
              onChange={e => onUpdate({ autoSave: e.target.checked })}
              style={{ accentColor: AG.acid, width: 14, height: 14 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${AG.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: `1px solid ${AG.border}`,
              color: AG.soft, cursor: 'pointer', padding: '4px 14px',
              fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.borderColor = AG.acid;
              (e.target as HTMLButtonElement).style.color = AG.acid;
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.borderColor = AG.border;
              (e.target as HTMLButtonElement).style.color = AG.soft;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
"""))

# ── 6. components/vst-panel-modal.tsx ─────────────────────────────────────────
NEW_FILES.append(("pages/multi-track-panel/components/vst-panel-modal.tsx", """\
/**
 * pages/multi-track-panel/components/vst-panel-modal.tsx
 * VST plugin panel for a specific track.
 * Props: trackId, trackName, onClose.
 */
import { Link } from 'wouter';

interface Props {
  trackId:   string;
  trackName?: string;
  onClose:   () => void;
}

const AG = {
  panel:  '#0d0d0d',
  border: '#1c1c1c',
  acid:   '#a3e635',
  soft:   '#888',
  dim:    '#3a3a3a',
  white:  '#f0f0f0',
};

export function VSTPanelModal({ trackId, trackName, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: AG.panel, border: `1px solid ${AG.border}`,
        width: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
          background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: AG.acid }}>
            VST — {trackName ?? trackId}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <p style={{ fontSize: 11, color: AG.soft, lineHeight: 1.7, margin: 0 }}>
            VST plugin management for<br />
            <span style={{ color: AG.acid }}>{trackName ?? trackId}</span>
          </p>
          <p style={{ fontSize: 10, color: AG.dim, marginTop: 12 }}>
            Visit{' '}
            <Link href="/vst" style={{ color: AG.acid, textDecoration: 'none' }}>/vst</Link>
            {' '}to load and configure plugins.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${AG.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: `1px solid ${AG.border}`,
              color: AG.soft, cursor: 'pointer', padding: '4px 14px',
              fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
"""))

# ── 7. components/mixer-view.tsx (dead import stub) ───────────────────────────
NEW_FILES.append(("pages/multi-track-panel/components/mixer-view.tsx", """\
/**
 * pages/multi-track-panel/components/mixer-view.tsx
 * STUB — imported by multi-track-panel.tsx but mixer is rendered inline.
 * Exported to satisfy the import; never mounted.
 */
export function MixerView(): null { return null; }
"""))

# ── 8. components/timeline-view.tsx (dead import stub) ────────────────────────
NEW_FILES.append(("pages/multi-track-panel/components/timeline-view.tsx", """\
/**
 * pages/multi-track-panel/components/timeline-view.tsx
 * STUB — imported by multi-track-panel.tsx but timeline is rendered inline.
 * Exported to satisfy the import; never mounted.
 */
export function TimelineView(): null { return null; }
"""))

# ── App.tsx patch ──────────────────────────────────────────────────────────────
APP_PATCH = {
    "file":  "client/src/App.tsx",
    "label": "Redirect /multitrack import from components/ to pages/",
    "old":   "import MultiTrackPanel    from './components/multi-track-panel';",
    "new":   "import MultiTrackPanel    from './pages/multi-track-panel';",
}


def run(dry: bool, verify: bool) -> int:
    mode = "DRY-RUN" if dry else "APPLY"
    print(f"\n{'='*64}")
    print(f"  r3-multitrack-fix.py  [{mode}]  {TS}")
    print(f"{'='*64}\n")

    errors = 0

    # ── Create new files ───────────────────────────────────────────────────────
    print("── Creating missing subdirectory files\n")
    for rel_path, content in NEW_FILES:
        full = SRC / rel_path
        print(f"  {'[WOULD CREATE]' if dry else '[CREATE]'} {rel_path}")
        if not dry:
            full.parent.mkdir(parents=True, exist_ok=True)
            if full.exists():
                bak = Path(str(full) + f".bak.{TS}")
                shutil.copy2(full, bak)
                print(f"    💾 Backed up existing → {bak.name}")
            full.write_text(content, encoding="utf-8")
            print(f"    ✅ Written ({len(content.splitlines())} lines)")
        print()

    # ── Patch App.tsx ──────────────────────────────────────────────────────────
    print("── Patching App.tsx import\n")
    app_path = ROOT / APP_PATCH["file"]
    if not app_path.exists():
        print(f"  ❌ FILE NOT FOUND: {app_path}")
        errors += 1
    else:
        text  = app_path.read_text(encoding="utf-8")
        count = text.count(APP_PATCH["old"])
        if count == 0:
            # Check if already patched
            if APP_PATCH["new"] in text:
                print(f"  ✅ Already patched — skipping\n")
            else:
                print(f"  ❌ OLD string not found and new string absent — manual review needed\n")
                errors += 1
        elif count > 1:
            print(f"  ❌ OLD string found {count} times — not unique\n")
            errors += 1
        else:
            if dry:
                print(f"  ✔  Would patch App.tsx line 57\n")
            else:
                bak = Path(str(app_path) + f".bak.{TS}")
                shutil.copy2(app_path, bak)
                print(f"  💾 Backed up App.tsx → {bak.name}")
                new_text = text.replace(APP_PATCH["old"], APP_PATCH["new"], 1)
                app_path.write_text(new_text, encoding="utf-8")
                print(f"  ✅ Patched\n")

    # ── Verify ─────────────────────────────────────────────────────────────────
    if verify and not dry:
        print("\n── VERIFY\n")
        checks = [
            ("App.tsx imports from pages/multi-track-panel",
             ["grep", "-n", "pages/multi-track-panel", str(ROOT / "client/src/App.tsx")],
             True),
            ("App.tsx no longer imports from components/multi-track-panel",
             ["grep", "-n", "components/multi-track-panel'", str(ROOT / "client/src/App.tsx")],
             False),
            ("audio-engine.ts exists",
             ["test", "-f", str(SRC / "pages/multi-track-panel/audio-engine.ts")],
             True),
            ("preferences-modal.tsx exists",
             ["test", "-f", str(SRC / "pages/multi-track-panel/components/preferences-modal.tsx")],
             True),
            ("vst-panel-modal.tsx exists",
             ["test", "-f", str(SRC / "pages/multi-track-panel/components/vst-panel-modal.tsx")],
             True),
        ]
        for desc, cmd, expect_found in checks:
            result = subprocess.run(cmd, capture_output=True, text=True)
            found  = result.returncode == 0
            ok     = found == expect_found
            icon   = "✅" if ok else "❌"
            print(f"  {icon}  {desc}")
            if not ok:
                errors += 1
                if found and not expect_found:
                    print(f"       Stale: {result.stdout.strip()}")
                else:
                    print(f"       Not found")
            print()

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n{'='*64}")
    if errors:
        print(f"  ⚠️   {errors} issue(s) — review above")
    else:
        if dry:
            print(f"  ✅  Dry-run clean — {len(NEW_FILES)} files + 1 App.tsx patch ready")
            print(f"      Re-run with: --run --verify")
        else:
            print(f"  ✅  Done — {len(NEW_FILES)} files created, App.tsx patched")
            print(f"  ▶   cd ~/Stable && pnpm -w run typecheck")
            print(f"  ▶   Then: pnpm --filter client dev  → navigate to /multitrack")
    print(f"{'='*64}\n")
    return 1 if errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="R3 v4 — wire multi-track-panel pages/ backing files"
    )
    parser.add_argument("--run",    action="store_true", help="Apply changes (default: dry-run)")
    parser.add_argument("--verify", action="store_true", help="Grep-verify after applying (requires --run)")
    args = parser.parse_args()
    sys.exit(run(dry=not args.run, verify=args.verify))
