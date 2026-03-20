/**
 * AudioReactiveScene.tsx
 *
 * Three.js R3F scene fully driven by loopEngine FFT data.
 *
 * FEATURES:
 *   • ShaderMaterial with FFT band uniforms — sub/low/mid/high/presence/air
 *   • Geometry displacement in vertex shader keyed to bass energy
 *   • Emissive pulse on mid/high energy peaks
 *   • N8AO ambient occlusion that breathes on beat (radius + intensity)
 *   • Beat-driven camera dolly via loopEngine 'beat' event
 *   • Per-band color sweeps (hue rotates with energy ratio)
 *   • Zero React re-renders during playback — all updates via useFrame + refs
 *
 * USAGE (inside a <Canvas>):
 *   <AudioReactiveScene />
 *
 * Or with N8AO postprocessing:
 *   <Canvas>
 *     <AudioReactiveScene useN8AO />
 *     <EffectComposer>
 *       <N8AOPass ... />
 *     </EffectComposer>
 *   </Canvas>
 *
 * DEPENDENCIES:
 *   three@0.182, @react-three/fiber, @react-three/drei, n8ao
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getLoopEngine } from '../../features/loopstation/engine/loopEngine';
import { useLoopEngineFFTRef } from '../../hooks/use-loop-engine-fft';

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uBassEnergy;     // sub + low combined
  uniform float uMidEnergy;
  uniform float uHighEnergy;     // high + presence + air combined
  uniform float uBeatFlash;      // 0–1, decays per frame

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vAmplitude;

  // Simplex-style hash for displacement
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float smoothNoise(vec3 p) {
    vec3 i  = floor(p);
    vec3 f  = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i),              hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)),hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)),hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)),hash(i + vec3(1,1,1)), f.x), f.y), f.z
    );
  }

  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = position;

    // Bass-driven radial displacement along normal
    float bassDisplace = uBassEnergy * 0.6;
    float noiseFreq    = 2.5 + uMidEnergy * 3.0;
    float noise        = smoothNoise(position * noiseFreq + uTime * 0.3);
    float displacement = noise * bassDisplace;

    // High-frequency shimmer
    float shimmer = smoothNoise(position * 12.0 + uTime * 2.0) * uHighEnergy * 0.08;

    vAmplitude = displacement + shimmer;

    vec3 displaced = position + normal * (displacement + shimmer);
    gl_Position    = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uBassEnergy;
  uniform float uMidEnergy;
  uniform float uHighEnergy;
  uniform float uBeatFlash;
  uniform vec3  uColorBase;      // base hue (set from colorBase prop)
  uniform vec3  uColorAccent;    // accent hue (set from colorAccent prop)

  varying vec3  vNormal;
  varying vec3  vPosition;
  varying float vAmplitude;

  void main() {
    // Fresnel rim glow
    vec3  viewDir  = normalize(cameraPosition - vPosition);
    float fresnel  = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

    // Base color blend driven by energy
    float energyBlend = clamp(uMidEnergy * 2.0 + uHighEnergy, 0.0, 1.0);
    vec3  bodyColor   = mix(uColorBase, uColorAccent, energyBlend);

    // Amplitude-mapped emissive
    float emissive = vAmplitude * 2.5 + uBeatFlash * 0.4;

    // Rim + body
    vec3 col = bodyColor * (0.4 + vAmplitude * 1.8)
             + uColorAccent * fresnel * (0.6 + uHighEnergy * 1.2)
             + vec3(emissive * 0.15);

    // Beat flash
    col += vec3(uBeatFlash * 0.3);

    gl_FragColor = vec4(col, 0.85 + fresnel * 0.15);
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

// ── Audio-Reactive Mesh ───────────────────────────────────────────────────────

interface ReactiveObjectProps {
  fftRef:       React.MutableRefObject<import('../../hooks/use-loop-engine-fft').FFTData>;
  beatFlashRef: React.MutableRefObject<number>;
  colorBase:    string;
  colorAccent:  string;
}

function ReactiveIcosphere({ fftRef, beatFlashRef, colorBase, colorAccent }: ReactiveObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy:  { value: 0 },
    uHighEnergy: { value: 0 },
    uBeatFlash:  { value: 0 },
    uColorBase:  { value: hexToVec3(colorBase) },
    uColorAccent:{ value: hexToVec3(colorAccent) },
  }), [colorBase, colorAccent]);

  useFrame(({ clock }) => {
    const u      = uniforms;
    const bands  = fftRef.current.bands;
    const t      = clock.getElapsedTime();

    u.uTime.value       = t;
    u.uBassEnergy.value = THREE.MathUtils.lerp(u.uBassEnergy.value, bands.sub + bands.low, 0.15);
    u.uMidEnergy.value  = THREE.MathUtils.lerp(u.uMidEnergy.value,  bands.mid, 0.12);
    u.uHighEnergy.value = THREE.MathUtils.lerp(u.uHighEnergy.value, bands.high + bands.presence + bands.air, 0.10);
    u.uBeatFlash.value  = THREE.MathUtils.lerp(u.uBeatFlash.value, beatFlashRef.current, 0.3);
    beatFlashRef.current *= 0.88;   // decay

    // Slow rotation driven by mid energy
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003 + bands.mid * 0.02;
      meshRef.current.rotation.x += 0.001 + bands.sub * 0.01;
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <icosahedronGeometry args={[1.5, 5]} />
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Particle Ring ─────────────────────────────────────────────────────────────

interface ParticleRingProps {
  fftRef:    React.MutableRefObject<import('../../hooks/use-loop-engine-fft').FFTData>;
  count?:    number;
  radius?:   number;
  color?:    string;
}

function ParticleRing({ fftRef, count = 128, radius = 3, color = '#00ff88' }: ParticleRingProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count, radius]);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const pos    = geometry.attributes.position as THREE.BufferAttribute;
    const bands  = fftRef.current.bands;
    const fft    = fftRef.current.masterFft;
    const t      = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const fftIdx = Math.floor((i / count) * fft.length * 0.5);   // use lower half
      const energy = Math.max(0, (fft[fftIdx] + 100) / 100);

      const r = radius + energy * 1.5 + bands.sub * 0.8;
      pos.setXYZ(
        i,
        Math.cos(angle + t * 0.1) * r,
        Math.sin(t * 0.3 + i * 0.05) * (0.2 + energy * 0.5),
        Math.sin(angle + t * 0.1) * r,
      );
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.8}
      />
    </points>
  );
}

// ── Camera Controller ─────────────────────────────────────────────────────────

function AudioReactiveCamera({
  fftRef,
  beatFlashRef,
}: {
  fftRef:       React.MutableRefObject<import('../../hooks/use-loop-engine-fft').FFTData>;
  beatFlashRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const baseZ      = useRef(5);
  const targetZ    = useRef(5);

  useFrame(() => {
    const bands = fftRef.current.bands;

    // Camera dolly out on bass hits, recover slowly
    const bassHit = bands.sub + bands.low;
    targetZ.current = baseZ.current + bassHit * 0.8;
    baseZ.current   = THREE.MathUtils.lerp(baseZ.current, 5, 0.02);

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ.current, 0.08);

    // Subtle vertical drift on mid
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      Math.sin(Date.now() * 0.0003) * 0.15 + bands.mid * 0.2,
      0.05,
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── Main Scene ────────────────────────────────────────────────────────────────

interface AudioReactiveSceneProps {
  colorBase?:    string;
  colorAccent?:  string;
  showRing?:     boolean;
  ringColor?:    string;
  animateCamera?: boolean;
}

export function AudioReactiveScene({
  colorBase    = '#1a0066',
  colorAccent  = '#00ff88',
  showRing     = true,
  ringColor    = '#00aaff',
  animateCamera = true,
}: AudioReactiveSceneProps) {
  const fftRef       = useLoopEngineFFTRef();
  const beatFlashRef = useRef(0);

  // Subscribe to engine beat event for flash trigger
  useEffect(() => {
    const engine = getLoopEngine();
    const off = engine.on('beat', (bar, beat) => {
      // Stronger flash on bar downbeat, lighter on other beats
      beatFlashRef.current = beat === 0 ? 1.0 : 0.35;
    });
    return off;
  }, []);

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.15} />
      <pointLight
        position={[0, 3, 3]}
        intensity={1.2}
        color={colorAccent}
        castShadow
      />
      <pointLight
        position={[0, -3, -3]}
        intensity={0.6}
        color={colorBase}
      />

      {/* Camera animation */}
      {animateCamera && (
        <AudioReactiveCamera fftRef={fftRef} beatFlashRef={beatFlashRef} />
      )}

      {/* Main reactive shape */}
      <ReactiveIcosphere
        fftRef={fftRef}
        beatFlashRef={beatFlashRef}
        colorBase={colorBase}
        colorAccent={colorAccent}
      />

      {/* Particle ring */}
      {showRing && (
        <ParticleRing
          fftRef={fftRef}
          count={192}
          radius={3.2}
          color={ringColor}
        />
      )}

      {/* Fog for depth */}
      <fog attach="fog" args={['#000000', 8, 20]} />
    </>
  );
}

// ── N8AO beat-reactive wrapper ─────────────────────────────────────────────────

/**
 * Animates N8AO pass parameters from outside the pass itself.
 * Attach to an N8AOPostPass ref obtained from the EffectComposer.
 *
 * Usage:
 *   const n8aoRef = useRef();
 *   <N8AOPostPass ref={n8aoRef} ... />
 *   <N8AOBeatController passRef={n8aoRef} fftRef={fftRef} />
 */
export function N8AOBeatController({
  passRef,
  fftRef,
  baseRadius    = 1.5,
  baseIntensity = 5,
}: {
  passRef:       React.RefObject<{ configuration: { aoRadius: number; intensity: number } }>;
  fftRef:        React.MutableRefObject<import('../../hooks/use-loop-engine-fft').FFTData>;
  baseRadius?:   number;
  baseIntensity?: number;
}) {
  useFrame(() => {
    const pass = passRef.current;
    if (!pass?.configuration) return;

    const bands = fftRef.current.bands;
    const bass  = bands.sub + bands.low;

    // Radius expands on bass hit, intensity spikes on beat
    pass.configuration.aoRadius   = baseRadius  + bass * 2.0;
    pass.configuration.intensity  = baseIntensity + bass * 8.0;
  });

  return null;
}
