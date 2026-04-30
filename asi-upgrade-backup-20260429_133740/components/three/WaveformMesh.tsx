/**
 * WaveformMesh.tsx
 *
 * Three.js R3F InstancedMesh waveform renderer.
 * Single GPU draw call for all BIN_COUNT bars. Zero React re-renders.
 *
 * Props:
 *   trackIndex  — loopEngine track index (-1 = master waveform)
 *   binCount    — instanced bar count (default 256)
 *   width/height/depth — world-unit dimensions
 *   gain        — visual amplitude multiplier (default 1.5)
 *   colorLow/colorHigh — hex color at low/high amplitude
 *   useFft      — read FFT bars instead of waveform
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLoopEngine } from "../../features/loopstation/engine/loopEngine";

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

export function WaveformMesh({
  trackIndex,
  binCount  = 256,
  width     = 4,
  height    = 1,
  depth     = 0.04,
  gain      = 1.5,
  colorLow  = "#00ff88",
  colorHigh = "#ff2244",
  useFft    = false,
  position  = [0, 0, 0],
  rotation  = [0, 0, 0],
}: WaveformMeshProps) {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const colorBuf  = useMemo(() => new THREE.Color(), []);
  const colorLoV  = useMemo(() => new THREE.Color(colorLow),  [colorLow]);
  const colorHiV  = useMemo(() => new THREE.Color(colorHigh), [colorHigh]);
  const barWidth  = width / binCount;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const engine = getLoopEngine();
    if (!engine.initialized) return;

    const raw = useFft
      ? (trackIndex < 0 ? engine.getMasterFft()      : engine.getTrackFft(trackIndex))
      : (trackIndex < 0 ? engine.getMasterWaveform() : engine.getTrackWaveform(trackIndex));
    if (!raw?.length) return;

    const step = Math.max(1, Math.floor(raw.length / binCount));

    for (let i = 0; i < binCount; i++) {
      const sample = raw[i * step] ?? 0;
      const amp    = Math.min(1, Math.abs(useFft ? Math.max(0, (sample + 100) / 100) : sample) * gain);
      const barH   = Math.max(0.001, amp * height);

      dummy.position.set((i / (binCount - 1) - 0.5) * width, barH * 0.5, 0);
      dummy.scale.set(barWidth * 0.85, barH, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colorBuf.lerpColors(colorLoV, colorHiV, amp);
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
      castShadow receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.3} metalness={0.6} emissiveIntensity={0.2} />
    </instancedMesh>
  );
}
