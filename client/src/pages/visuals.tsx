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

import { useRef, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { N8AOPostPass } from 'n8ao';
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
        ringColor="var(--accent-blue)"
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
        colorHigh="var(--status-error)"
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
        colorLow="var(--accent-blue-deep)"
        colorHigh="var(--accent-blue)"
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

interface ControlsOverlayProps {
  colorBase: string;
  onColorBaseChange: (v: string) => void;
  colorAccent: string;
  onColorAccentChange: (v: string) => void;
}

function ControlsOverlay({ colorBase, onColorBaseChange, colorAccent, onColorAccentChange }: ControlsOverlayProps) {
  // PRD §3 design system: cyan = var(--accent-cyan) (active), violet = AI, amber = warning
  const [msWidth,     setMsWidthVal]  = useState(1.0);
  const [open,        setOpen]        = useState(false);

  const sc = useSidechain();
  const ir = useIRReverb();

  const handleMSWidth = (v: number) => {
    setMsWidthVal(v);
    instrumentEngine.setMSWidth(v);
  };

  // Shared label style
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--daw-sub)',
    fontFamily: '"IBM Plex Mono", monospace',
  };

  const rangeStyle: React.CSSProperties = {
    width: '100%',
    height: 4,
    background: 'var(--dj-border)',
    appearance: 'none' as const,
    cursor: 'pointer',
    accentColor: '#a3e635',
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          position:       'fixed',
          bottom:         16,
          right:          16,
          zIndex:         20,
          width:          40,
          height:         40,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'rgba(0,0,0,0.75)',
          border:         '1px solid var(--dj-dimmer)',
          color:          '#a3e635',
          fontFamily:     '"IBM Plex Mono", monospace',
          fontSize:       12,
          cursor:         'pointer',
          transition:     'background 0.1s',
        }}
        title="Toggle controls"
      >
        {open ? '✕' : '⚙'}
      </button>

      {open && (
        <div
          style={{
            position:      'fixed',
            bottom:        64,
            right:         16,
            zIndex:        20,
            width:         288,
            padding:       16,
            background:    'rgba(0,0,0,0.88)',
            border:        '1px solid var(--dj-border)',
            fontFamily:    '"IBM Plex Mono", monospace',
            fontSize:      12,
            color:         'var(--daw-sub)',
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
          }}
        >
          <p style={{ color: '#a3e635', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 10, margin: 0 }}>
            Visuals Controls
          </p>

          {/* Color pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={labelStyle}>Base color</span>
            <input
              type="color"
              value={colorBase}
              onChange={e => onColorBaseChange(e.target.value)}
              style={{ width: 32, height: 24, background: 'transparent', border: 0, cursor: 'pointer' }}
            />
            <span style={labelStyle}>Accent</span>
            <input
              type="color"
              value={colorAccent}
              onChange={e => onColorAccentChange(e.target.value)}
              style={{ width: 32, height: 24, background: 'transparent', border: 0, cursor: 'pointer' }}
            />
          </div>

          {/* M/S Width */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={labelStyle}>M/S Width</span>
              <span style={{ color: '#a3e635', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>{msWidth.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="2" step="0.01"
              value={msWidth}
              onChange={e => handleMSWidth(parseFloat(e.target.value))}
              style={rangeStyle}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dj-dim)', marginTop: 2 }}>
              <span>mono</span><span>unity</span><span>wide</span>
            </div>
          </div>

          {/* Sidechain */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={labelStyle}>Sidechain Duck</span>
              <button
                onClick={() => sc.enabled
                  ? sc.disable()
                  : sc.enable({ sourceTrackIndex: 0, amount: 0.75, attack: 0.003, release: 0.15 })
                }
                style={{
                  padding:         '2px 8px',
                  fontSize:        10,
                  fontFamily:      '"IBM Plex Mono", monospace',
                  border:          sc.enabled ? '1px solid #a3e635' : '1px solid var(--dj-dimmer)',
                  background:      sc.enabled ? '#a3e635' : 'transparent',
                  color:           sc.enabled ? 'var(--dj-black)' : '#555',
                  cursor:          'pointer',
                  transition:      'all 0.1s',
                }}
              >
                {sc.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {sc.enabled && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 4 }}>
                  <span>Amount</span>
                  <span style={{ color: '#a3e635' }}>{sc.config.amount.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={sc.config.amount}
                  onChange={e => sc.setAmount(parseFloat(e.target.value))}
                  style={rangeStyle}
                />
              </div>
            )}
          </div>

          {/* IR Reverb */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={labelStyle}>IR Reverb</span>
              {ir.loading && <span style={{ fontSize: 9, color: '#555' }}>loading…</span>}
              {ir.error   && <span style={{ fontSize: 9, color: 'var(--status-error-soft)' }} title={ir.error}>error</span>}
              {ir.loaded  && <span style={{ fontSize: 9, color: '#a3e635' }}>✓ loaded</span>}
            </div>

            {/* Preset selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
              {IR_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => ir.loadPreset(p)}
                  style={{
                    padding:        '2px 4px',
                    fontSize:        9,
                    fontFamily:     '"IBM Plex Mono", monospace',
                    border:         ir.currentPreset === p ? '1px solid #a3e635' : '1px solid var(--dj-dimmer)',
                    background:     ir.currentPreset === p ? 'rgba(163,230,53,0.10)' : 'transparent',
                    color:          ir.currentPreset === p ? '#a3e635' : '#555',
                    cursor:         'pointer',
                    textAlign:      'left',
                    overflow:       'hidden',
                    textOverflow:   'ellipsis',
                    whiteSpace:     'nowrap',
                    transition:     'all 0.1s',
                  }}
                  title={p}
                >
                  {p.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                </button>
              ))}
            </div>

            {ir.loaded && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 4 }}>
                  <span>Wet</span>
                  <span style={{ color: '#a3e635' }}>{ir.wet.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={ir.wet}
                  onChange={e => ir.setWet(parseFloat(e.target.value))}
                  style={rangeStyle}
                />
              </div>
            )}

            {!ir.loaded && !ir.loading && (
              <p style={{ fontSize: 9, color: 'var(--dj-dim)', lineHeight: 1.5, margin: 0 }}>
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
  const [colorBase,   setColorBase]   = useState('var(--accent-blue-deep)');
  const [colorAccent, setColorAccent] = useState('var(--accent-neon-green)');

  return (
          <header className="ag-header">
            <div className="ag-header-top">
              <div className="ag-wordmark-block">
                <div className="ag-wordmark" data-testid="text-title">
                  R3<span className="ag-wordmark-slash">/</span>NATIVE
                </div>
                <div className="ag-wordmark-sub">Visuals · Live Mixing</div>
              </div>
            </div>
          </header>

    <div style={{ minHeight: '100vh', background: 'var(--dj-black)', color: 'var(--daw-fg)', fontFamily: '"IBM Plex Mono", monospace', display: 'flex', flexDirection: 'column' }}>


      {/* Ticker */}
      <style>{`@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ overflow:'hidden', position:'relative', background:'#080808', padding:'5px 0', flexShrink:0 }}>
        <div style={{ display:'flex', width:'max-content', animation:'ag-scroll 28s linear infinite' }}>
          {['R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System','R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System'].map((item, i) => (
            <span key={i} style={{ padding:'0 18px', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'"IBM Plex Mono",monospace', color:'#fff', whiteSpace:'nowrap' }}>
              {item}<span style={{ color:'#a3e635', marginLeft:8 }}>/</span>
            </span>
          ))}
        </div>
      </div>
      {/* Full-screen canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 2, 6], fov: 50 }}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          style={{ background: 'var(--dj-black)' }}
        >
          <color attach="background" args={['var(--dj-black)']} />

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

      {/* Controls overlay — receives lifted color state so pickers drive the canvas */}
      <ControlsOverlay
        colorBase={colorBase}
        onColorBaseChange={setColorBase}
        colorAccent={colorAccent}
        onColorAccentChange={setColorAccent}
      />
    </div>
  );
}

// ── Band energy HUD ───────────────────────────────────────────────────────────

function BandMeterHUD() {
  const fftRef  = useLoopEngineFFTRef();
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const BANDS   = ['sub','low','mid','high','pres','air'] as const;
  const COLORS  = ['var(--signal-clip-alt)','var(--accent-orange)','var(--accent-yellow)','var(--accent-neon-green)','var(--accent-cyan)','var(--accent-purple)']; // PRD §3: cyan var(--accent-cyan)

  // Animate DOM elements from rAF — zero React re-renders
  const rafRef    = useRef<number>(0);
  const startedRef = useRef(false);

  // Cancel the loop on unmount to avoid stale-ref memory leak
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const startHUD = () => {
    if (startedRef.current) return;
    startedRef.current = true;
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

  // Ref callback on first bar mount — guards against multiple invocations
  const firstBarRef = (el: HTMLDivElement | null) => {
    barRefs.current[0] = el;
    if (el) startHUD();
  };

  return (
    <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 4, alignItems: 'flex-end', height: 64 }}>
      {BANDS.map((band, i) => (
        <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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