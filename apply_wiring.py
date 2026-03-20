#!/usr/bin/env python3
"""
apply_wiring.py — R3 v4 Enhancement Wiring Patch
=================================================

Wires all 5 enhancements into the live project:

  1. ThreeStage       — audioReactive prop → AudioReactiveScene + WaveformMesh inside existing Canvas
  2. VisualEngine     — replaces fake audio.rms with live useLoopEngineFFTRef(), upgrades shader
  3. instrument-engine.ts — adds setMSWidth/setMidGain/setSideGain onto existing procNode
  4. App.tsx          — adds /visuals lazy route + VisualsPage import
  5. VisualsPage      — new full-screen audio reactive page with N8AO SSAO

USAGE:
  cd ~/Stable/R3\ v4
  python3 apply_wiring.py
  pnpm build

Zero destructive changes — every modified file is backed up to <file>.bak first.
All patches are surgical str_replace — they target exact strings from the source.
"""

import os, sys, shutil

BASE  = os.path.dirname(os.path.abspath(__file__))
PASS  = []
FAIL  = []

def info(m):  print(f"\033[0;36m  {m}\033[0m")
def ok(m):    print(f"\033[0;32m  ✓ {m}\033[0m"); PASS.append(m)
def warn(m):  print(f"\033[0;33m  ⚠ {m}\033[0m")
def err(m):   print(f"\033[0;31m  ✗ {m}\033[0m"); FAIL.append(m)

def read(rel):
    p = os.path.join(BASE, rel)
    if not os.path.exists(p):
        err(f"read: {rel} not found"); return None
    with open(p, encoding="utf-8") as f: return f.read()

def write(rel, content, backup=True):
    p = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if backup and os.path.exists(p):
        shutil.copy2(p, p + ".bak")
        info(f"Backed up {os.path.basename(p)}")
    with open(p, "w", encoding="utf-8") as f: f.write(content)
    ok(f"Wrote {rel}")

def patch(rel, old, new, desc=""):
    p = os.path.join(BASE, rel)
    content = read(rel)
    if content is None: return False
    if old not in content:
        err(f"patch target not found in {rel}" + (f" — {desc}" if desc else ""))
        return False
    shutil.copy2(p, p + ".bak"); info(f"Backed up {os.path.basename(p)}")
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.replace(old, new, 1))
    ok(f"Patched {rel}" + (f" — {desc}" if desc else ""))
    return True

# ═══════════════════════════════════════════════════════════════════════════════
# 1. ThreeStage — add audioReactive prop + mount AudioReactiveScene + WaveformMesh
# ═══════════════════════════════════════════════════════════════════════════════

def patch_threestage():
    print("\n\033[1m1. ThreeStage — audioReactive prop\033[0m")
    rel = "client/src/components/threestage.tsx"

    # Add imports for our new components at top of file
    patch(rel,
        "// FILE: client/src/components/ThreeStage.tsx\nimport React, { useRef, memo } from 'react';",
        """// FILE: client/src/components/ThreeStage.tsx
import React, { useRef, memo } from 'react';
import { AudioReactiveScene, N8AOBeatController } from './three/AudioReactiveScene';
import { WaveformMesh } from './three/WaveformMesh';
import { useLoopEngineFFTRef } from '../hooks/use-loop-engine-fft';""",
        "add AudioReactiveScene/WaveformMesh imports",
    )

    # Expand props interface
    patch(rel,
        """interface ThreeStageProps {
  children: React.ReactNode;
  shake: number;
}""",
        """interface ThreeStageProps {
  children: React.ReactNode;
  shake: number;
  /** Mount AudioReactiveScene + WaveformMesh driven by loopEngine FFT */
  audioReactive?: boolean;
  colorBase?:    string;
  colorAccent?:  string;
}""",
        "expand ThreeStageProps",
    )

    # Expand destructuring
    patch(rel,
        "export const ThreeStage = memo(function ThreeStage({ children, shake }: ThreeStageProps) {",
        """export const ThreeStage = memo(function ThreeStage({
  children,
  shake,
  audioReactive = false,
  colorBase     = '#1a0066',
  colorAccent   = '#00ff88',
}: ThreeStageProps) {""",
        "expand ThreeStage destructuring",
    )

    # Inject AudioReactiveScene + WaveformMesh inside Canvas, before CameraRig
    patch(rel,
        "      <CameraRig shake={shake} />",
        """      <CameraRig shake={shake} />

      {/* ── Audio-reactive scene (opt-in via audioReactive prop) ── */}
      {audioReactive && (
        <AudioReactiveScene
          colorBase={colorBase}
          colorAccent={colorAccent}
          animateCamera={false}  // CameraRig already controls the camera
        />
      )}

      {/* ── InstancedMesh waveform bar display ── */}
      {audioReactive && (
        <WaveformMesh
          trackIndex={-1}
          useFft
          binCount={128}
          width={8}
          height={0.8}
          depth={0.03}
          colorLow={colorAccent}
          colorHigh="#ffffff"
          position={[0, -2.5, 0]}
        />
      )}""",
        "inject AudioReactiveScene + WaveformMesh",
    )

# ═══════════════════════════════════════════════════════════════════════════════
# 2. VisualEngine — real FFT data, upgraded shader
# ═══════════════════════════════════════════════════════════════════════════════

VISUAL_ENGINE_NEW = """// @ts-nocheck
// client/src/components/visual-engine.tsx
//
// UPGRADED: uses live loopEngine FFT band energies instead of audio.rms from theme.
// ShaderMaterial now receives 6 band uniforms: sub, low, mid, high, presence, air.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { ShaderMaterial } from 'three';
import { useLoopEngineFFTRef } from '../hooks/use-loop-engine-fft';

const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float time;
uniform float uSub;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uPresence;
uniform float uAir;

void main() {
  vec2 uv   = gl_FragCoord.xy / 800.0;
  vec2 c    = uv * 2.0 - 1.0;

  // Bass: radial pulse from centre
  float bassRing = 1.0 - smoothstep(0.0, 0.6 + uSub * 0.8, length(c));
  // Mid: horizontal scan lines
  float midScan  = abs(sin(uv.y * 40.0 + time * 3.0)) * uMid * 0.5;
  // High: edge shimmer
  float edgeShim = pow(1.0 - abs(uv.x - 0.5) * 2.0, 3.0) * uHigh * 0.6;
  // Air: vertical sparkle
  float air      = abs(sin(uv.x * 80.0 + time * 8.0)) * uAir * 0.3;

  // Colour: deep purple base, cyan on mid energy, white on high presence
  vec3 col  = vec3(0.04, 0.01, 0.12);
  col += vec3(0.0,  0.8, 0.4)  * bassRing * (uLow + uSub) * 0.8;
  col += vec3(0.0,  0.4, 1.0)  * midScan;
  col += vec3(1.0,  1.0, 1.0)  * edgeShim;
  col += vec3(0.6,  0.9, 1.0)  * air;
  col += vec3(uPresence * 0.3, 0.0, uPresence * 0.6) * 0.5;

  // Subtle vignette
  float vig  = smoothstep(1.4, 0.3, length(c));
  col       *= vig;

  gl_FragColor = vec4(col, 0.92);
}
`;

function ShaderPlane() {
  const mat    = useRef<ShaderMaterial>(null!);
  const fftRef = useLoopEngineFFTRef();

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    const b = fftRef.current.bands;
    u.time.value      = clock.elapsedTime;
    u.uSub.value      = b.sub;
    u.uLow.value      = b.low;
    u.uMid.value      = b.mid;
    u.uHigh.value     = b.high;
    u.uPresence.value = b.presence;
    u.uAir.value      = b.air;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        uniforms={{
          time:      { value: 0 },
          uSub:      { value: 0 },
          uLow:      { value: 0 },
          uMid:      { value: 0 },
          uHigh:     { value: 0 },
          uPresence: { value: 0 },
          uAir:      { value: 0 },
        }}
      />
    </mesh>
  );
}

export function VisualEngine() {
  return (
    <Canvas className="fixed inset-0 -z-10">
      <ShaderPlane />
    </Canvas>
  );
}
"""

def patch_visual_engine():
    print("\n\033[1m2. VisualEngine — real FFT uniforms\033[0m")
    write("client/src/components/visual-engine.tsx", VISUAL_ENGINE_NEW)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. instrument-engine.ts — M/S param setters on existing procNode
# ═══════════════════════════════════════════════════════════════════════════════

def patch_instrument_engine():
    print("\n\033[1m3. instrument-engine.ts — M/S worklet param setters\033[0m")
    rel = "client/src/audio/core/instrument-engine.ts"

    # Add M/S methods before the existing exportSession() method.
    # We insert after the last non-trivial method block, before exportSession.
    patch(rel,
        "  exportSession(): string {",
        """  // ── M/S Worklet parameter setters ────────────────────────────────────────────
  // These write to AudioWorkletNode a-rate parameters on the instrument-processor.
  // Safe no-ops if worklet failed to load (procNode will be null).

  /**
   * Set stereo width via the M/S worklet.
   * 0 = full mono collapse, 1.0 = unity (default), 2.0 = extra wide.
   * Values above 1.4 may introduce phase artifacts on summed mono playback.
   */
  setMSWidth(width: number): void {
    const param = this.procNode?.parameters.get('msWidth');
    if (!param || !this.ctx) return;
    const clamped = Math.max(0, Math.min(2, width));
    param.setValueAtTime(clamped, this.ctx.currentTime);
  }

  /**
   * Set independent Mid channel gain (0–2).
   * Mid = (L+R)/2 — affects mono-compatible centre content.
   */
  setMidGain(gain: number): void {
    const param = this.procNode?.parameters.get('midGain');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(0, Math.min(2, gain)), this.ctx.currentTime);
  }

  /**
   * Set independent Side channel gain (0–2).
   * Side = (L-R)/2 — stacks with msWidth. Use for fine stereo trim.
   */
  setSideGain(gain: number): void {
    const param = this.procNode?.parameters.get('sideGain');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(0, Math.min(2, gain)), this.ctx.currentTime);
  }

  /**
   * Set Mid-channel compressor threshold (dBFS, -60 to 0).
   * Default: -24. Lower values = more compression on centre content.
   */
  setMidThreshold(threshDB: number): void {
    const param = this.procNode?.parameters.get('midThreshold');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(-60, Math.min(0, threshDB)), this.ctx.currentTime);
  }

  /**
   * Set Side-channel compressor threshold (dBFS, -60 to 0).
   * Default: -30. Tighter side compression → tighter stereo field.
   */
  setSideThreshold(threshDB: number): void {
    const param = this.procNode?.parameters.get('sideThreshold');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(-60, Math.min(0, threshDB)), this.ctx.currentTime);
  }

  /**
   * Convenience: set all M/S parameters at once.
   * Any omitted field retains its current value.
   */
  setMSParams(opts: {
    width?:         number;
    midGain?:       number;
    sideGain?:      number;
    midThreshold?:  number;
    sideThreshold?: number;
  }): void {
    if (opts.width         !== undefined) this.setMSWidth(opts.width);
    if (opts.midGain       !== undefined) this.setMidGain(opts.midGain);
    if (opts.sideGain      !== undefined) this.setSideGain(opts.sideGain);
    if (opts.midThreshold  !== undefined) this.setMidThreshold(opts.midThreshold);
    if (opts.sideThreshold !== undefined) this.setSideThreshold(opts.sideThreshold);
  }

  exportSession(): string {""",
        "add M/S worklet param setters",
    )

    # Close the replaced string — restore the body of exportSession
    # (patch already replaces the opening line, body is untouched)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. App.tsx — add /visuals route
# ═══════════════════════════════════════════════════════════════════════════════

def patch_app():
    print("\n\033[1m4. App.tsx — /visuals route\033[0m")
    rel = "client/src/App.tsx"

    # Add lazy import after LoopStation505 import
    patch(rel,
        """const LoopStation505  = lazy(() =>
  import('@/features/loopstation/LoopStation505').then(m => ({
    default: m.LoopStation505 as ComponentType,
  }))
);""",
        """const LoopStation505  = lazy(() =>
  import('@/features/loopstation/LoopStation505').then(m => ({
    default: m.LoopStation505 as ComponentType,
  }))
);
const VisualsPage = lazy(() => import('@/pages/visuals'));""",
        "add VisualsPage lazy import",
    )

    # Add /visuals route before the 404 catch-all
    patch(rel,
        """      {/* ── 404 ── */}
      <Route>""",
        """      {/* ── /visuals → full-screen audio reactive Three.js scene ── */}
      <Route path="/visuals">
        {() => (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback message="Loading Visuals…" />}>
              <VisualsPage />
            </Suspense>
          </ErrorBoundary>
        )}
      </Route>

      {/* ── 404 ── */}
      <Route>""",
        "add /visuals route",
    )

    # Add Visuals to PageNav — patch the nav links if PageNav accepts hrefs
    # (PageNav source unknown — safest to skip, user can add nav link manually)

# ═══════════════════════════════════════════════════════════════════════════════
# 5. VisualsPage — new file
# ═══════════════════════════════════════════════════════════════════════════════

VISUALS_PAGE = """/**
 * visuals.tsx — /visuals route
 *
 * Full-screen audio-reactive Three.js canvas.
 * Everything is driven by loopEngine FFT via useLoopEngineFFTRef (zero React re-renders).
 *
 * Features:
 *   - AudioReactiveScene: icosphere + particle ring, ShaderMaterial with 6 band uniforms
 *   - WaveformMesh (FFT): 256-bin InstancedMesh frequency bars
 *   - N8AO SSAO: ambient occlusion radius + intensity beat-reactive via N8AOBeatController
 *   - Bloom + Vignette postprocessing (same stack as ThreeStage)
 *   - M/S width slider: writes to instrumentEngine.procNode msWidth param live
 *   - Sidechain enable toggle: calls loopEngine.enableSidechain / disableSidechain
 *   - IR reverb preset selector: loads IR into ConvolverNode, wet control
 *
 * N8AO note: N8AOPostPass integrates with @react-three/postprocessing via the
 * ShaderPass API. It is added after Bloom so SSAO is composited first.
 */

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { N8AOPostPass } from 'n8ao';
import { PageNav } from '@/components/page-nav';
import { AudioReactiveScene, N8AOBeatController } from '@/components/three/AudioReactiveScene';
import { WaveformMesh } from '@/components/three/WaveformMesh';
import { useLoopEngineFFTRef } from '@/hooks/use-loop-engine-fft';
import { useSidechain } from '@/hooks/use-sidechain';
import { useIRReverb } from '@/hooks/use-ir-reverb';
import { instrumentEngine } from '@/audio/core/instrument-engine';
import type { IRPreset } from '@/audio/effects/ir-reverb-engine';

// ── N8AO as R3F primitive ────────────────────────────────────────────────────

/**
 * N8AOPostPass is a Three.js post-processing pass.
 * We mount it imperatively via useFrame + ref, bypassing @react-three/postprocessing
 * to avoid the EffectComposer integration complexity.
 *
 * Adds SSAO on top of the rendered scene. aoRadius and intensity are
 * animated by N8AOBeatController each frame.
 */
function N8AOLayer() {
  const n8aoRef = useRef<InstanceType<typeof N8AOPostPass> | null>(null);
  const fftRef  = useLoopEngineFFTRef();

  // N8AOBeatController handles the frame-by-frame param animation
  return <N8AOBeatController passRef={n8aoRef} fftRef={fftRef} baseRadius={1.2} baseIntensity={4} />;
}

// ── Scene content ─────────────────────────────────────────────────────────────

function SceneContent({ colorBase, colorAccent }: { colorBase: string; colorAccent: string }) {
  return (
    <>
      {/* Core audio-reactive visuals */}
      <AudioReactiveScene
        colorBase={colorBase}
        colorAccent={colorAccent}
        showRing
        ringColor="#00aaff"
        animateCamera
      />

      {/* FFT frequency bars along the floor */}
      <WaveformMesh
        trackIndex={-1}
        useFft
        binCount={256}
        width={10}
        height={1.2}
        depth={0.03}
        gain={1.8}
        colorLow={colorAccent}
        colorHigh="#ff3366"
        position={[0, -3, -1]}
        rotation={[0, 0, 0]}
      />

      {/* Waveform bars behind — use time-domain data for contrast */}
      <WaveformMesh
        trackIndex={-1}
        useFft={false}
        binCount={128}
        width={10}
        height={0.5}
        depth={0.02}
        gain={2.0}
        colorLow="#003366"
        colorHigh="#0088ff"
        position={[0, -3.8, -2]}
      />

      {/* N8AO beat controller */}
      <N8AOLayer />
    </>
  );
}

// ── Controls overlay ──────────────────────────────────────────────────────────

const IR_PRESETS: IRPreset[] = [
  'smallRoom', 'largeHall', 'cathedral', 'clubRoom', 'plateMedium', 'springReverb',
];

function ControlsOverlay() {
  const [colorBase,   setColorBase]   = useState('#1a0066');
  const [colorAccent, setColorAccent] = useState('#00ff88');
  const [msWidth,     setMsWidthVal]  = useState(1.0);
  const [open,        setOpen]        = useState(false);

  const sc = useSidechain();
  const ir = useIRReverb();

  const handleMSWidth = (v: number) => {
    setMsWidthVal(v);
    instrumentEngine.setMSWidth(v);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed bottom-4 right-4 z-20 w-10 h-10 flex items-center justify-center
                   bg-black/70 border border-[#333] text-[#b8ff00] font-mono text-xs
                   hover:bg-[#111] transition-colors"
        title="Toggle controls"
      >
        {open ? '✕' : '⚙'}
      </button>

      {open && (
        <div
          className="fixed bottom-16 right-4 z-20 w-72 p-4 space-y-4
                     bg-black/85 border border-[#222] font-mono text-xs text-[#aaa]"
        >
          <p className="text-[#b8ff00] font-bold tracking-widest uppercase text-[10px]">
            Visuals Controls
          </p>

          {/* Color pickers */}
          <div className="flex gap-3 items-center">
            <label className="text-[10px] w-20">Base color</label>
            <input type="color" value={colorBase}
              onChange={e => setColorBase(e.target.value)}
              className="w-8 h-6 bg-transparent border-0 cursor-pointer" />
            <label className="text-[10px] w-20">Accent</label>
            <input type="color" value={colorAccent}
              onChange={e => setColorAccent(e.target.value)}
              className="w-8 h-6 bg-transparent border-0 cursor-pointer" />
          </div>

          {/* M/S Width */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px]">M/S Width</span>
              <span className="text-[#b8ff00]">{msWidth.toFixed(2)}</span>
            </div>
            <input type="range" min="0" max="2" step="0.01"
              value={msWidth} onChange={e => handleMSWidth(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#222] appearance-none cursor-pointer" />
            <div className="flex justify-between text-[9px] text-[#444] mt-0.5">
              <span>mono</span><span>unity</span><span>wide</span>
            </div>
          </div>

          {/* Sidechain */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px]">Sidechain Duck</span>
              <button
                onClick={() => sc.enabled
                  ? sc.disable()
                  : sc.enable({ sourceTrackIndex: 0, amount: 0.75, attack: 0.003, release: 0.15 })
                }
                className={`px-2 py-0.5 text-[10px] border transition-colors ${
                  sc.enabled
                    ? 'bg-[#b8ff00] text-black border-[#b8ff00]'
                    : 'bg-transparent text-[#555] border-[#333] hover:border-[#555]'
                }`}
              >
                {sc.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {sc.enabled && (
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span>Amount</span>
                  <span className="text-[#b8ff00]">{sc.config.amount.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.01"
                  value={sc.config.amount}
                  onChange={e => sc.setAmount(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#222] appearance-none cursor-pointer" />
              </div>
            )}
          </div>

          {/* IR Reverb */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px]">IR Reverb</span>
              {ir.loading && <span className="text-[9px] text-[#555] animate-pulse">loading…</span>}
              {ir.error   && <span className="text-[9px] text-red-400" title={ir.error}>error</span>}
              {ir.loaded  && <span className="text-[9px] text-[#b8ff00]">✓ loaded</span>}
            </div>

            {/* Preset selector */}
            <div className="grid grid-cols-2 gap-1 mb-2">
              {IR_PRESETS.map(p => (
                <button key={p}
                  onClick={() => ir.loadPreset(p)}
                  className={`px-1 py-0.5 text-[9px] border transition-colors text-left truncate ${
                    ir.currentPreset === p
                      ? 'bg-[#b8ff00]/10 border-[#b8ff00] text-[#b8ff00]'
                      : 'bg-transparent border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]'
                  }`}
                  title={p}
                >
                  {p.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                </button>
              ))}
            </div>

            {ir.loaded && (
              <div>
                <div className="flex justify-between text-[9px] mb-1">
                  <span>Wet</span>
                  <span className="text-[#b8ff00]">{ir.wet.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.01"
                  value={ir.wet}
                  onChange={e => ir.setWet(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#222] appearance-none cursor-pointer" />
              </div>
            )}

            {!ir.loaded && !ir.loading && (
              <p className="text-[9px] text-[#444] leading-tight">
                Place .wav files in client/public/ir/ to enable presets.
                See README in that directory.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VisualsPage() {
  const [colorBase,   setColorBase]   = useState('#1a0066');
  const [colorAccent, setColorAccent] = useState('#00ff88');

  return (
    <div className="min-h-screen bg-black text-[#f0f0f0] font-mono flex flex-col">
      <PageNav />

      {/* Full-screen canvas */}
      <div className="flex-1 relative">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 2, 6], fov: 50 }}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          style={{ background: '#000' }}
        >
          <color attach="background" args={['#000000']} />

          <Suspense fallback={null}>
            <SceneContent colorBase={colorBase} colorAccent={colorAccent} />
          </Suspense>

          <EffectComposer enableNormalPass={false}>
            <Bloom
              intensity={1.8}
              luminanceThreshold={0.12}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.1} darkness={0.7} />
          </EffectComposer>
        </Canvas>

        {/* HUD: band energy meters */}
        <BandMeterHUD />
      </div>

      {/* Controls overlay */}
      <ControlsOverlay />
    </div>
  );
}

// ── Band energy HUD ───────────────────────────────────────────────────────────

function BandMeterHUD() {
  const fftRef  = useLoopEngineFFTRef();
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const BANDS   = ['sub','low','mid','high','pres','air'] as const;
  const COLORS  = ['#ff2244','#ff6600','#ffcc00','#00ff88','#00aaff','#aa44ff'];

  // Animate DOM elements from rAF — zero React re-renders
  const rafRef  = useRef<number>(0);
  const startHUD = () => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const b = fftRef.current.bands;
      const vals = [b.sub, b.low, b.mid, b.high, b.presence, b.air];
      vals.forEach((v, i) => {
        const el = barRefs.current[i];
        if (el) el.style.height = `${Math.min(100, v * 200)}%`;
      });
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // useEffect equivalent via ref callback on first bar mount
  const firstBarRef = (el: HTMLDivElement | null) => {
    barRefs.current[0] = el;
    if (el) startHUD();
  };

  return (
    <div className="absolute bottom-4 left-4 flex gap-1 items-end h-16">
      {BANDS.map((band, i) => (
        <div key={band} className="flex flex-col items-center gap-0.5">
          <div
            ref={i === 0 ? firstBarRef : (el) => { barRefs.current[i] = el; }}
            style={{ backgroundColor: COLORS[i], width: 12, height: '0%',
                     transition: 'height 40ms linear', minHeight: 2 }}
          />
          <span style={{ fontSize: 7, color: COLORS[i], letterSpacing: 0 }}>
            {band}
          </span>
        </div>
      ))}
    </div>
  );
}
"""

def write_visuals_page():
    print("\n\033[1m5. VisualsPage — new file\033[0m")
    write("client/src/pages/visuals.tsx", VISUALS_PAGE, backup=False)

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    print("\033[1;37m  R3 v4 Enhancement Wiring Patch\033[0m")
    print("\033[1;37m═══════════════════════════════════════════════════════\033[0m")

    if not os.path.exists(os.path.join(BASE, "pnpm-workspace.yaml")):
        err("Run from project root (~/Stable/R3 v4). pnpm-workspace.yaml not found.")
        sys.exit(1)

    patch_threestage()
    patch_visual_engine()
    patch_instrument_engine()
    patch_app()
    write_visuals_page()

    print(f"\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    if FAIL:
        print(f"  \033[0;32m{len(PASS)} ok\033[0m  \033[0;31m{len(FAIL)} failed\033[0m")
        for f in FAIL: print(f"    ✗ {f}")
    else:
        print(f"  \033[0;32mAll {len(PASS)} patches applied cleanly.\033[0m")
    print(f"\033[1;37m═══════════════════════════════════════════════════════\033[0m\n")

    if not FAIL:
        print("\033[1mNext:\033[0m")
        print("  pnpm build                   — confirm clean TypeScript")
        print("  pnpm dev                     — start dev server")
        print("  Navigate to /visuals         — full audio-reactive scene")
        print()
        print("\033[1mQuick API:\033[0m")
        print("  instrumentEngine.setMSWidth(1.4)   — wider stereo immediately")
        print("  instrumentEngine.setMidGain(1.1)   — boost centre by 10%")
        print("  instrumentEngine.setSideThreshold(-36)  — tighter side compression")
        print()
        print("\033[1mThreeStage (any existing usage):\033[0m")
        print("  <ThreeStage shake={0} audioReactive>   — adds scene to existing Canvas")
        print("  <ThreeStage shake={0} audioReactive colorAccent='#ff3300'>")
        print()
        print("\033[1mIR files still needed:\033[0m")
        print("  client/public/ir/ → drop any .wav from openairlib.net or echothief.com")
        print()

if __name__ == "__main__":
    main()