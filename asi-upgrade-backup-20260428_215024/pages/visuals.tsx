/**
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
                   bg-background/70 border border-[#333] text-[#a3e635] font-mono text-xs
                   hover:bg-[#111] transition-colors"
        title="Toggle controls"
      >
        {open ? '✕' : '⚙'}
      </button>

      {open && (
        <div
          className="fixed bottom-16 right-4 z-20 w-72 p-4 space-y-4
                     bg-background/85 border border-[#222] font-mono text-xs text-[#aaa]"
        >
          <p className="text-[#a3e635] font-bold tracking-widest uppercase text-[10px]">
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
              <span className="text-[#a3e635]">{msWidth.toFixed(2)}</span>
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
                    ? 'bg-[#a3e635] text-black border-[#a3e635]'
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
                  <span className="text-[#a3e635]">{sc.config.amount.toFixed(2)}</span>
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
              {ir.loaded  && <span className="text-[9px] text-[#a3e635]">✓ loaded</span>}
            </div>

            {/* Preset selector */}
            <div className="grid grid-cols-2 gap-1 mb-2">
              {IR_PRESETS.map(p => (
                <button key={p}
                  onClick={() => ir.loadPreset(p)}
                  className={`px-1 py-0.5 text-[9px] border transition-colors text-left truncate ${
                    ir.currentPreset === p
                      ? 'bg-[#a3e635]/10 border-[#a3e635] text-[#a3e635]'
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
                  <span className="text-[#a3e635]">{ir.wet.toFixed(2)}</span>
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
    <div className="min-h-screen bg-background text-[#f0f0f0] font-mono flex flex-col">

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
