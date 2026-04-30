/**
 * client/src/components/daw/WaveformMesh.tsx
 * Per-frame waveform renderer using Three.js r128 InstancedMesh.
 *
 * Architecture:
 *  - 128 bar instances driven by waveform samples from useLoopEngineFFTRef
 *  - InstancedMesh with DynamicDrawUsage — only matrix buffer updated per frame
 *  - No OrbitControls, no CapsuleGeometry (r128 constraints honoured)
 *  - Renders into a fixed-height canvas overlay on the arrangement strip
 *  - Color driven by track color prop; emissive on active samples
 *
 * Usage in DAW.tsx (inline under arrangement track label, or as panel overlay):
 *   <WaveformMesh fftRef={fftRef} color="#f59e0b" height={48} />
 *
 * Rendering notes:
 *  - Uses BoxGeometry(1,1,0.1) — flat bars, NOT CapsuleGeometry
 *  - InstancedMesh.count = 128 (matching FFT_SIZE in useLoopEngineFFTRef)
 *  - Camera is orthographic for pixel-accurate waveform layout
 */

import React, { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';
import type { FFTFrame } from '../../hooks/useLoopEngineFFTRef';

const BAR_COUNT = 128;

interface Props {
  fftRef:   React.MutableRefObject<FFTFrame>;
  color?:   string;     // hex, default amber
  height?:  number;     // canvas height px, default 48
  mode?:    'waveform' | 'spectrum';  // what data to render
  playing?: boolean;
}

export const WaveformMesh = memo(({
  fftRef,
  color   = '#f59e0b',
  height  = 48,
  mode    = 'waveform',
  playing = false,
}: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth || 320;
    const H = height;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(1); // crisp at native res, no supersampling needed
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Orthographic camera — exact pixel mapping ─────────────────────────
    const camera = new THREE.OrthographicCamera(
      -BAR_COUNT / 2, BAR_COUNT / 2,   // left, right
       H / 2,        -H / 2,            // top, bottom (Y flipped for canvas coords)
      0.1, 10,
    );
    camera.position.z = 5;

    const scene = new THREE.Scene();

    // ── Instanced bar mesh ─────────────────────────────────────────────────
    // BoxGeometry — NOT CapsuleGeometry (r128)
    const barGeo = new THREE.BoxGeometry(0.7, 1, 0.1);
    const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    const mesh   = new THREE.InstancedMesh(barGeo, barMat, BAR_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    const dummy = new THREE.Object3D();

    // ── Resize observer ───────────────────────────────────────────────────
    let currentW = W;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        currentW = entry.contentRect.width;
        renderer.setSize(currentW, H);
        camera.left  = -currentW / 2;
        camera.right =  currentW / 2;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(mount);

    // ── Animation loop ────────────────────────────────────────────────────
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      const frame = fftRef.current;
      const data  = mode === 'waveform' ? frame.waveform : frame.fft;
      const barW  = currentW / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        const sample = data[i] ?? 0;
        // Map sample to bar height: waveform is [-1,1], fft is [0,1]
        const barH   = mode === 'waveform'
          ? Math.abs(sample) * (H * 0.8)
          : sample * (H * 0.95);

        // X position: evenly spread across width
        const x = (i - BAR_COUNT / 2) * (currentW / BAR_COUNT) + barW / 2;
        // Y position: bars extend upward from center (waveform) or bottom (spectrum)
        const y = mode === 'waveform' ? 0 : -(H / 2) + barH / 2;

        dummy.position.set(x * (BAR_COUNT / currentW), y * (H / currentW), 0);
        dummy.scale.set(0.8, Math.max(0.5, barH), 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      // Color modulation: brighten active bars on beat
      const beat = frame.beatEnergy;
      const baseColor = new THREE.Color(color);
      const brightColor = baseColor.clone().multiplyScalar(1 + beat * 0.5);
      barMat.color.copy(playing ? brightColor : baseColor);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      barGeo.dispose();
      barMat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [color, height, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
        borderRadius: 2,
        opacity: playing ? 1 : 0.5,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
});
WaveformMesh.displayName = 'WaveformMesh';
