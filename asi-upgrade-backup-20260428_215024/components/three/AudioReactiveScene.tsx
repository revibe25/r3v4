/**
 * AudioReactiveScene.tsx
 *
 * R3F Three.js scene driven by loopEngine FFT data.
 *
 * Features:
 *   - ShaderMaterial with 6 band energy uniforms (sub/low/mid/high/presence/air)
 *   - Vertex shader: bass-driven geometry displacement via smooth noise
 *   - Fragment shader: emissive pulse, fresnel rim, beat flash
 *   - Particle ring keyed to per-bin FFT
 *   - Camera dolly: pulls back on bass hit, recovers slowly
 *   - N8AOBeatController: animates SSAO aoRadius + intensity on beat
 *
 * Usage (inside <Canvas>):
 *   <AudioReactiveScene />
 *
 * For N8AO SSAO (optional):
 *   const n8aoRef = useRef();
 *   <N8AOPostPass ref={n8aoRef} ... />
 *   <N8AOBeatController passRef={n8aoRef} fftRef={fftRef} />
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getLoopEngine } from "../../features/loopstation/engine/loopEngine";
import { useLoopEngineFFTRef } from "../../hooks/use-loop-engine-fft";

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uBeatFlash;
varying vec3  vNormal;
varying vec3  vPosition;
varying float vAmplitude;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float sNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

void main() {
  vNormal   = normalize(normalMatrix * normal);
  vPosition = position;
  float n   = sNoise(position * (2.5 + uMidEnergy * 3.0) + uTime * 0.3);
  float d   = n * uBassEnergy * 0.6;
  float sh  = sNoise(position * 12.0 + uTime * 2.0) * uHighEnergy * 0.08;
  vAmplitude = d + sh;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal*(d+sh), 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uBeatFlash;
uniform vec3  uColorBase;
uniform vec3  uColorAccent;
varying vec3  vNormal;
varying vec3  vPosition;
varying float vAmplitude;

void main() {
  vec3  vDir    = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(vDir, vNormal), 0.0), 3.0);
  float blend   = clamp(uMidEnergy * 2.0 + uHighEnergy, 0.0, 1.0);
  vec3  body    = mix(uColorBase, uColorAccent, blend);
  vec3  col     = body * (0.4 + vAmplitude * 1.8)
                + uColorAccent * fresnel * (0.6 + uHighEnergy * 1.2)
                + vec3(vAmplitude * 0.15 + uBeatFlash * 0.3);
  gl_FragColor  = vec4(col, 0.85 + fresnel * 0.15);
}`;

// ── Reactive icosphere ────────────────────────────────────────────────────────

function ReactiveIcosphere({ fftRef, beatFlashRef, colorBase, colorAccent }: {
  fftRef:       React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  beatFlashRef: React.MutableRefObject<number>;
  colorBase:    string;
  colorAccent:  string;
}) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const toV3     = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy:  { value: 0 },
    uHighEnergy: { value: 0 },
    uBeatFlash:  { value: 0 },
    uColorBase:  { value: toV3(colorBase) },
    uColorAccent:{ value: toV3(colorAccent) },
  }), [colorBase, colorAccent]);

  useFrame(({ clock }) => {
    const u = uniforms;
    const b = fftRef.current.bands;
    u.uTime.value       = clock.getElapsedTime();
    u.uBassEnergy.value = THREE.MathUtils.lerp(u.uBassEnergy.value, b.sub + b.low, 0.15);
    u.uMidEnergy.value  = THREE.MathUtils.lerp(u.uMidEnergy.value,  b.mid, 0.12);
    u.uHighEnergy.value = THREE.MathUtils.lerp(u.uHighEnergy.value, b.high + b.presence + b.air, 0.10);
    u.uBeatFlash.value  = THREE.MathUtils.lerp(u.uBeatFlash.value,  beatFlashRef.current, 0.3);
    beatFlashRef.current *= 0.88;
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003 + b.mid * 0.02;
      meshRef.current.rotation.x += 0.001 + b.sub * 0.01;
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <icosahedronGeometry args={[1.5, 5]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG}
        uniforms={uniforms} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ── Particle ring ─────────────────────────────────────────────────────────────

function ParticleRing({ fftRef, count = 128, radius = 3.2, color = "#00aaff" }: {
  fftRef:   React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  count?:   number; radius?: number; color?: string;
}) {
  const ptsRef  = useRef<THREE.Points>(null);
  const geo     = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pos[i*3]=Math.cos(a)*radius; pos[i*3+1]=0; pos[i*3+2]=Math.sin(a)*radius;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, radius]);

  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const fft = fftRef.current.masterFft;
    const b   = fftRef.current.bands;
    const t   = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const a   = (i / count) * Math.PI * 2;
      const idx = Math.floor((i / count) * fft.length * 0.5);
      const e   = Math.max(0, (fft[idx] + 100) / 100);
      const r   = radius + e * 1.5 + b.sub * 0.8;
      pos.setXYZ(i,
        Math.cos(a + t*0.1)*r,
        Math.sin(t*0.3 + i*0.05) * (0.2 + e*0.5),
        Math.sin(a + t*0.1)*r,
      );
    }
    pos.needsUpdate = true;
  });

  return <points ref={ptsRef} geometry={geo}>
    <pointsMaterial color={color} size={0.06} sizeAttenuation transparent opacity={0.8} />
  </points>;
}

// ── Camera controller ─────────────────────────────────────────────────────────

function AudioReactiveCamera({ fftRef }: {
  fftRef: React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
}) {
  const { camera } = useThree();
  const baseZ      = useRef(5);

  useFrame(() => {
    const b = fftRef.current.bands;
    const bass = b.sub + b.low;
    baseZ.current = THREE.MathUtils.lerp(baseZ.current, 5, 0.02);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ.current + bass * 0.8, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, Math.sin(Date.now()*0.0003)*0.15 + b.mid*0.2, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── Main scene ────────────────────────────────────────────────────────────────

interface AudioReactiveSceneProps {
  colorBase?:     string;
  colorAccent?:   string;
  showRing?:      boolean;
  ringColor?:     string;
  animateCamera?: boolean;
}

export function AudioReactiveScene({
  colorBase     = "#1a0066",
  colorAccent   = "#00ff88",
  showRing      = true,
  ringColor     = "#00aaff",
  animateCamera = true,
}: AudioReactiveSceneProps) {
  const fftRef       = useLoopEngineFFTRef();
  const beatFlashRef = useRef(0);

  useEffect(() => {
    const off = getLoopEngine().on("beat", (_, beat) => {
      beatFlashRef.current = beat === 0 ? 1.0 : 0.35;
    });
    return off;
  }, []);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0,3,3]}   intensity={1.2} color={colorAccent} castShadow />
      <pointLight position={[0,-3,-3]} intensity={0.6} color={colorBase} />
      {animateCamera && <AudioReactiveCamera fftRef={fftRef} />}
      <ReactiveIcosphere fftRef={fftRef} beatFlashRef={beatFlashRef}
        colorBase={colorBase} colorAccent={colorAccent} />
      {showRing && <ParticleRing fftRef={fftRef} color={ringColor} />}
      <fog attach="fog" args={["#000000", 8, 20]} />
    </>
  );
}

// ── N8AO beat controller (attach to N8AOPostPass ref) ────────────────────────

export function N8AOBeatController({ passRef, fftRef, baseRadius = 1.5, baseIntensity = 5 }: {
  passRef:        React.RefObject<{ configuration: { aoRadius: number; intensity: number } }>;
  fftRef:         React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  baseRadius?:    number;
  baseIntensity?: number;
}) {
  useFrame(() => {
    const pass = passRef.current;
    if (!pass?.configuration) return;
    const bass = fftRef.current.bands.sub + fftRef.current.bands.low;
    pass.configuration.aoRadius  = baseRadius   + bass * 2.0;
    pass.configuration.intensity = baseIntensity + bass * 8.0;
  });
  return null;
}
