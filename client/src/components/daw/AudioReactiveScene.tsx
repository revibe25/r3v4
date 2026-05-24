// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: WebGL/Three.js scene energy color — CSS variables cannot be used in Three.Color()
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
/**
 * client/src/components/daw/AudioReactiveScene.tsx
 * Three.js r128 audio-reactive visual layer for R3 v4 (Phase 2 Pro / Elite).
 *
 * Architecture:
 *  - Full-viewport canvas rendered via useRef + manual Three.js r128 init
 *  - ShaderMaterial uniforms driven frame-by-frame from useLoopEngineFFTRef
 *  - InstancedMesh grid (32×32 = 1024 cubes) pulsed by FFT band energy
 *  - Beat flash: sub-bass energy (beatEnergy) scales Y of center ring
 *  - NO CapsuleGeometry (not in r128) — BoxGeometry used for mesh tiles
 *  - NO OrbitControls import (not in r128 CDN) — manual camera orbit
 *  - Respects existing dark aesthetic: emissive accent colors from track palette
 *
 * Usage in DAW.tsx:
 *   import { AudioReactiveScene } from '../components/daw/AudioReactiveScene';
 *   <AudioReactiveScene fftRef={fftRef} visible={sceneVisible} />
 *
 * Props:
 *   fftRef   — ref from useLoopEngineFFTRef (updated every rAF, no re-render)
 *   visible  — when false the canvas is hidden (Three.js render loop paused)
 *   accent   — primary emissive color (default: amber var(--status-warn))
 */

import React, { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';
import type { FFTFrame } from '../../hooks/useLoopEngineFFTRef';

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uBeat;
  uniform float uRMS;
  varying vec2  vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Subtle wave displacement on Y
    float wave = sin(pos.x * 0.4 + uTime * 1.2) * cos(pos.z * 0.4 + uTime * 0.8);
    pos.y += wave * uRMS * 0.6;

    // Beat pulse on Y
    pos.y += uBeat * 0.3;

    vElevation = pos.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform float uRMS;
  uniform float uBeat;
  uniform vec3  uAccent;
  varying vec2  vUv;
  varying float vElevation;

  void main() {
    // Base dark background
    vec3 base = vec3(0.05, 0.05, 0.05);

    // Energy-driven accent
    float energy = clamp(uRMS * 2.0 + uBeat * 0.5, 0.0, 1.0);
    vec3  col    = mix(base, uAccent, energy);

    // Edge glow
    float edge = 1.0 - smoothstep(0.3, 0.5, abs(vUv.x - 0.5) * 2.0);
    col += uAccent * edge * 0.15;

    // Elevation tint (top: brighter)
    col += vec3(vElevation * 0.05);

    gl_FragColor = vec4(col, 0.92);
  }
`;

// ── Instanced cube shader (for the 32×32 reactive grid) ───────────────────────

const CUBE_VERT = /* glsl */`
  attribute float aFFT;
  varying   float vFFT;

  void main() {
    vFFT = aFFT;
    vec3 pos = position;
    pos.y   += aFFT * 2.0;  // scale Y by FFT bin value
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(pos, 1.0));
  }
`;

const CUBE_FRAG = /* glsl */`
  uniform vec3  uAccent;
  uniform float uBeat;
  varying float vFFT;

  void main() {
    float intensity = vFFT + uBeat * 0.3;
    vec3  col       = mix(vec3(0.08), uAccent, clamp(intensity, 0.0, 1.0));
    gl_FragColor    = vec4(col, 1.0);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  fftRef:  React.MutableRefObject<FFTFrame>;
  visible: boolean;
  accent?: string;  // hex color string
}

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export const AudioReactiveScene = memo(({ fftRef, visible, accent = 'var(--status-warn)' }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene:    THREE.Scene;
    camera:   THREE.PerspectiveCamera;
    mesh:     THREE.Mesh;
    instanced: THREE.InstancedMesh;
    fftAttr:  THREE.InstancedBufferAttribute;
    uniforms: Record<string, THREE.IUniform>;
    cubeUni:  Record<string, THREE.IUniform>;
    raf:      number;
    clock:    THREE.Clock;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 0, 0);

    // ── Background plane with shader ──────────────────────────────────────
    const accentVec = hexToVec3(accent);
    const uniforms: Record<string, THREE.IUniform> = {
      uTime:   { value: 0 },
      uRMS:    { value: 0 },
      uBeat:   { value: 0 },
      uAccent: { value: accentVec },
    };

    const planeMat  = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, side: THREE.DoubleSide });
    const planeGeo  = new THREE.PlaneGeometry(40, 20, 32, 32);
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.rotation.x = -Math.PI / 3;
    planeMesh.position.y = -2;
    scene.add(planeMesh);

    // ── Instanced 32×32 reactive grid ─────────────────────────────────────
    const GRID = 32;
    const COUNT = GRID * GRID;
    const cubeUni: Record<string, THREE.IUniform> = {
      uAccent: { value: accentVec },
      uBeat:   { value: 0 },
    };
    const cubeMat = new THREE.ShaderMaterial({
      vertexShader: CUBE_VERT, fragmentShader: CUBE_FRAG,
      uniforms: cubeUni,
    });
    // BoxGeometry — NOT CapsuleGeometry (r128 constraint)
    const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const instMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, COUNT);
    instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const fftAttr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
    fftAttr.setUsage(THREE.DynamicDrawUsage);
    (cubeGeo as THREE.BufferGeometry).setAttribute('aFFT', fftAttr);

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        dummy.position.set((x - GRID / 2) * 0.7, 0, (z - GRID / 2) * 0.7 - 4);
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    instMesh.instanceMatrix.needsUpdate = true;
    scene.add(instMesh);

    // ── Ambient light (minimal — emissive material is self-lit) ───────────
    scene.add(new THREE.AmbientLight(0x111111, 0.5));
    const pointLight = new THREE.PointLight(new THREE.Color(accent), 2, 30);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const clock = new THREE.Clock();

    // ── Manual orbit (mouse drag) — no OrbitControls in r128 ─────────────
    let isDragging = false;
    let prevX = 0;
    let cameraTheta = 0;
    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      cameraTheta += (e.clientX - prevX) * 0.005;
      prevX = e.clientX;
      const r = 22;
      camera.position.x = Math.sin(cameraTheta) * r;
      camera.position.z = Math.cos(cameraTheta) * r;
      camera.lookAt(0, 2, 0);
    };
    const onMouseUp = () => { isDragging = false; };
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!visible) return; // skip render when hidden (save GPU)

      const t      = clock.getElapsedTime();
      const frame  = fftRef.current;
      const rms    = frame.rms;
      const beat   = frame.beatEnergy;

      // Update background shader uniforms
      uniforms.uTime.value  = t;
      uniforms.uRMS.value   = rms;
      uniforms.uBeat.value  = beat;
      cubeUni.uBeat.value   = beat;

      // Update instanced grid FFT heights
      const fftData = frame.fft;
      for (let i = 0; i < COUNT; i++) {
        const binIdx = i % 128;
        (fftAttr.array as Float32Array)[i] = fftData[binIdx];
      }
      fftAttr.needsUpdate = true;

      // Pulse point light with beat
      pointLight.intensity = 1.5 + beat * 3;

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, mesh: planeMesh, instanced: instMesh, fftAttr, uniforms, cubeUni, raf, clock };

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      planeMat.dispose();
      planeGeo.dispose();
      cubeMat.dispose();
      cubeGeo.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [accent]); // eslint-disable-line react-hooks/exhaustive-deps -- fftRef is a stable ref

  // Sync visibility — don't destroy/recreate just to hide
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.renderer.domElement.style.opacity = visible ? '1' : '0';
    s.renderer.domElement.style.pointerEvents = visible ? 'auto' : 'none';
  }, [visible]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        zIndex: 0,
      }}
    />
  );
});
AudioReactiveScene.displayName = 'AudioReactiveScene';
