// @ts-nocheck
// client/src/components/visual-engine.tsx

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { ShaderMaterial } from 'three';
import { useTheme } from '@/components/theme-provider';

const fragmentShader = `
uniform float time;
uniform float energy;

void main() {
  vec2 uv = gl_FragCoord.xy / 800.0;
  float glow = sin(uv.x * 10.0 + time * 4.0) * energy;
  gl_FragColor = vec4(uv.x + glow, uv.y, glow, 1.0);
}
`;

function ShaderPlane() {
  const mat = useRef<ShaderMaterial>(null!);
  const { audio } = useTheme();

  useFrame(({ clock }) => {
    mat.current.uniforms.time.value = clock.elapsedTime;
    mat.current.uniforms.energy.value = audio.rms * 2.0;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        fragmentShader={fragmentShader}
        uniforms={{
          time: { value: 0 },
          energy: { value: 0 },
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
