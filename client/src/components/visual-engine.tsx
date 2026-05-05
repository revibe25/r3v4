// @ts-nocheck
// client/src/components/visual-engine.tsx
//
// UPGRADED: uses live loopEngine FFT band energies instead of audio.rms from theme.
// ShaderMaterial now receives 6 band uniforms: sub, low, mid, high, presence, air.

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { ShaderMaterial } from 'three';
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
