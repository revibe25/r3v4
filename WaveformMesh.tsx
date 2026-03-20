/**
 * WaveformMesh.tsx
 *
 * Three.js R3F InstancedMesh waveform renderer.
 *
 * Replaces the 2D canvas approach for 3D contexts. Each frame:
 *   1. Reads waveform Float32Array from loopEngine.getTrackWaveform(trackIndex)
 *   2. Updates instance matrix Y-scale and Y-position for each bar
 *   3. Optionally writes instance color based on amplitude
 *
 * PERFORMANCE:
 *   • InstancedMesh: single draw call for all BIN_COUNT bars
 *   • Runs entirely in useFrame — zero React re-renders
 *   • Waveform read is O(n) Float32Array iteration in rAF
 *
 * PROPS:
 *   trackIndex    — which loopEngine track to visualise (or -1 for master waveform)
 *   binCount      — number of instanced bars (default 256)
 *   width         — total mesh width in world units (default 4)
 *   height        — max bar height in world units (default 1)
 *   depth         — bar Z-depth in world units (default 0.05)
 *   gain          — visual amplitude multiplier (default 1.5)
 *   colorLow      — bar color at low amplitude (hex string, default '#00ff88')
 *   colorHigh     — bar color at high amplitude (hex string, default '#ff2244')
 *   useFft        — read FFT instead of waveform (gives frequency-domain bars)
 *
 * USAGE:
 *   // Inside a <Canvas> (R3F):
 *   <WaveformMesh trackIndex={0} useFft width={6} height={2} />
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getLoopEngine } from '../../features/loopstation/engine/loopEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaveformMeshProps {
  trackIndex:  number;
  binCount?:   number;
  width?:      number;
  height?:     number;
  depth?:      number;
  gain?:       number;
  colorLow?:   string;
  colorHigh?:  string;
  useFft?:     boolean;
  position?:   [number, number, number];
  rotation?:   [number, number, number];
}

// ── Color lerp helpers ────────────────────────────────────────────────────────

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WaveformMesh({
  trackIndex,
  binCount   = 256,
  width      = 4,
  height     = 1,
  depth      = 0.04,
  gain       = 1.5,
  colorLow   = '#00ff88',
  colorHigh  = '#ff2244',
  useFft     = false,
  position   = [0, 0, 0],
  rotation   = [0, 0, 0],
}: WaveformMeshProps) {
  const meshRef    = useRef<THREE.InstancedMesh>(null);
  const dummy      = useMemo(() => new THREE.Object3D(), []);
  const colorLowV  = useMemo(() => hexToColor(colorLow),  [colorLow]);
  const colorHighV = useMemo(() => hexToColor(colorHigh), [colorHigh]);
  const colorBuf   = useMemo(() => new THREE.Color(), []);

  const barWidth = width / binCount;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const engine = getLoopEngine();
    if (!engine.initialized) return;

    const raw: Float32Array = useFft
      ? (trackIndex < 0 ? engine.getMasterFft()      : engine.getTrackFft(trackIndex))
      : (trackIndex < 0 ? engine.getMasterWaveform() : engine.getTrackWaveform(trackIndex));

    if (!raw || raw.length === 0) return;

    const step = Math.max(1, Math.floor(raw.length / binCount));

    for (let i = 0; i < binCount; i++) {
      // Sample waveform at this bar's position
      let amp: number;
      if (useFft) {
        // FFT values are in dBFS (-100 to 0). Convert to 0–1.
        amp = Math.max(0, (raw[i * step] + 100) / 100);
      } else {
        // Waveform values are -1 to 1. Take abs.
        amp = Math.abs(raw[i * step] ?? 0);
      }

      amp = Math.min(1, amp * gain);

      const barH   = Math.max(0.001, amp * height);
      const x      = (i / (binCount - 1) - 0.5) * width;
      const y      = barH * 0.5;   // pivot at bottom

      dummy.position.set(x, y, 0);
      dummy.scale.set(barWidth * 0.85, barH, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color: lerp low → high by amplitude
      colorBuf.lerpColors(colorLowV, colorHighV, amp);
      mesh.setColorAt(i, colorBuf);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, binCount]}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.3}
        metalness={0.6}
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
}

// ── Dual-channel stereo waveform (L+R side by side) ───────────────────────────

interface StereoWaveformMeshProps extends Omit<WaveformMeshProps, 'trackIndex'> {
  trackIndexL: number;
  trackIndexR: number;
  separation?: number;
}

/**
 * Renders two WaveformMesh side by side — one for left channel, one for right.
 * Uses tracks L and R (from a stereo track split).
 */
export function StereoWaveformMesh({
  trackIndexL,
  trackIndexR,
  separation = 0.1,
  width      = 4,
  ...rest
}: StereoWaveformMeshProps) {
  const halfW = (width - separation) / 2;
  const offset = halfW / 2 + separation / 2;

  return (
    <group>
      <WaveformMesh
        trackIndex={trackIndexL}
        width={halfW}
        position={[-offset, 0, 0]}
        colorLow="#00aaff"
        colorHigh="#0044ff"
        {...rest}
      />
      <WaveformMesh
        trackIndex={trackIndexR}
        width={halfW}
        position={[ offset, 0, 0]}
        colorLow="#ff6600"
        colorHigh="#ff0022"
        {...rest}
      />
    </group>
  );
}
