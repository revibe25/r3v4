// FILE: client/src/components/DrumStage.tsx
// Enhanced 10x: reflective floor, stage platform, truss rails, LED strips,
// per-pad point lights, overhead spotlights, atmospheric fog, floor grid,
// velocity-reactive ground halo. All original pad positions preserved.

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PadMesh } from './padmesh';
import { ThreeStage } from './threestage';

// ── Constants (identical pad positions as original) ───────────────────────────
const PAD_COLS    = 4;
const PAD_SPACING = 1.6;
const PAD_OFFSET  = -2.4;
const ACID        = new THREE.Color('#a3e635');
const ACID_DIM    = new THREE.Color('#4d6b18');

function padPosition(i: number): [number, number, number] {
  return [
    (i % PAD_COLS) * PAD_SPACING + PAD_OFFSET,
    0,
    -Math.floor(i / PAD_COLS) * PAD_SPACING,
  ];
}

// ── Reflective metallic floor ─────────────────────────────────────────────────
function MetallicFloor() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.envMapIntensity =
        0.6 + Math.sin(clock.elapsedTime * 0.4) * 0.1;
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial
        ref={matRef}
        color="#0a0a0a"
        metalness={0.95}
        roughness={0.06}
      />
    </mesh>
  );
}

// ── Faint grid lines on the floor ────────────────────────────────────────────
function FloorGrid() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = -10; i <= 10; i++) {
      pts.push(i * 1.6, -0.175, -18,   i * 1.6, -0.175,  18);
      pts.push(-18, -0.175, i * 1.6,   18, -0.175, i * 1.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#1a2a0a" opacity={0.28} transparent />
    </lineSegments>
  );
}

// ── Slightly raised stage platform ───────────────────────────────────────────
function StagePlatform() {
  return (
    <mesh position={[0, -0.185, -1.6]} receiveShadow>
      <boxGeometry args={[9.2, 0.03, 6.0]} />
      <meshStandardMaterial color="#0d0d0d" metalness={0.65} roughness={0.45} />
    </mesh>
  );
}

// ── Truss frame (4 corner posts + 4 overhead crossbeams) ─────────────────────
function StageRails() {
  const mat = (
    <meshStandardMaterial color="#1a1a1a" metalness={0.88} roughness={0.22} />
  );

  const posts: [number, number, number][] = [
    [-4.5, 0, 1.4],  [4.5, 0, 1.4],
    [-4.5, 0, -4.8], [4.5, 0, -4.8],
  ];

  const beams: [[number,number,number],[number,number,number]][] = [
    [[-4.5, 3.2,  1.4], [4.5, 3.2,  1.4]],
    [[-4.5, 3.2, -4.8], [4.5, 3.2, -4.8]],
    [[-4.5, 3.2,  1.4], [-4.5, 3.2, -4.8]],
    [[ 4.5, 3.2,  1.4], [ 4.5, 3.2, -4.8]],
  ];

  return (
    <group>
      {posts.map(([x,, z], i) => (
        <mesh key={`post-${i}`} position={[x, 1.6, z]} castShadow>
          <cylinderGeometry args={[0.042, 0.042, 3.2, 6]} />
          {mat}
        </mesh>
      ))}
      {beams.map(([s, e], i) => {
        const mid: [number,number,number] = [(s[0]+e[0])/2, (s[1]+e[1])/2, (s[2]+e[2])/2];
        const len = Math.hypot(e[0]-s[0], e[2]-s[2]);
        const ang = Math.atan2(e[2]-s[2], e[0]-s[0]);
        return (
          <mesh key={`beam-${i}`} position={mid} rotation={[0, -ang, Math.PI/2]} castShadow>
            <cylinderGeometry args={[0.026, 0.026, len, 6]} />
            {mat}
          </mesh>
        );
      })}
    </group>
  );
}

// ── LED edge strips (front bright, others dimmer) ─────────────────────────────
function LEDStrips({ velocities }: { velocities: Map<number, number> }) {
  const frontRef = useRef<THREE.MeshStandardMaterial>(null);
  const sideRefs = [useRef<THREE.MeshStandardMaterial>(null), useRef<THREE.MeshStandardMaterial>(null)];

  useFrame(({ clock }) => {
    const total = Array.from(velocities.values()).reduce((a, b) => a + b, 0);
    const idle  = 0.08 + Math.sin(clock.elapsedTime * 1.8) * 0.025;
    const hit   = Math.min(total * 3, 4.0);
    if (frontRef.current) frontRef.current.emissiveIntensity = total > 0 ? hit : idle;
    sideRefs.forEach(r => {
      if (r.current) r.current.emissiveIntensity = idle * 0.4;
    });
  });

  return (
    <group>
      {/* Front strip */}
      <mesh position={[0, -0.155, 1.5]}>
        <boxGeometry args={[9.0, 0.05, 0.05]} />
        <meshStandardMaterial
          ref={frontRef}
          color="#040404"
          emissive={ACID}
          emissiveIntensity={0.08}
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>
      {/* Back strip */}
      <mesh position={[0, -0.155, -5.0]}>
        <boxGeometry args={[9.0, 0.05, 0.05]} />
        <meshStandardMaterial
          color="#040404"
          emissive={ACID_DIM}
          emissiveIntensity={0.03}
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>
      {/* Side strips */}
      {[-4.55, 4.55].map((x, i) => (
        <mesh key={x} position={[x, -0.155, -1.75]}>
          <boxGeometry args={[0.05, 0.05, 6.5]} />
          <meshStandardMaterial
            ref={sideRefs[i]}
            color="#040404"
            emissive={ACID_DIM}
            emissiveIntensity={0.025}
            metalness={0.9}
            roughness={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Per-pad reactive point lights ─────────────────────────────────────────────
function PadLights({ pads, velocities }: { pads: any[]; velocities: Map<number, number> }) {
  const refs = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    pads.forEach((pad, i) => {
      const light = refs.current[i];
      if (!light) return;
      const vel    = velocities.get(i) ?? 0;
      const active = pad.isActive || vel > 0;
      const target = active ? vel * 5.5 + 0.6 : 0;
      light.intensity = THREE.MathUtils.lerp(light.intensity, target, 0.22);
    });
  });

  return (
    <>
      {pads.map((_, i) => {
        const [x, , z] = padPosition(i);
        return (
          <pointLight
            key={i}
            ref={el => { refs.current[i] = el; }}
            position={[x, 0.75, z]}
            color={ACID}
            intensity={0}
            distance={3.8}
            decay={2}
          />
        );
      })}
    </>
  );
}

// ── Overhead spotlights ───────────────────────────────────────────────────────
function OverheadSpots() {
  const spots: [number,number,number][] = [
    [-2.4, 5.8,  2.0], [ 2.4, 5.8,  2.0],
    [-2.4, 5.8, -5.0], [ 2.4, 5.8, -5.0],
  ];
  return (
    <>
      {spots.map(([x,y,z], i) => (
        <spotLight
          key={i}
          position={[x, y, z]}
          intensity={0.75}
          angle={0.30}
          penumbra={0.65}
          distance={14}
          color="#eef5ee"
          castShadow
          shadow-mapSize={[512, 512]}
        />
      ))}
    </>
  );
}

// ── Thin emissive name plates above each pad ──────────────────────────────────
function PadNamePlates({ pads }: { pads: any[] }) {
  return (
    <>
      {pads.map((pad, i) => {
        const [x, , z] = padPosition(i);
        return (
          <mesh key={i} position={[x, 0.65, z]}>
            <boxGeometry args={[0.58, 0.014, 0.12]} />
            <meshStandardMaterial
              color="#050505"
              emissive={ACID_DIM}
              emissiveIntensity={pad.isActive ? 5 : 0.5}
              metalness={0.96}
              roughness={0.04}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ── Invisible emissive plane that feeds Bloom post-processing ─────────────────
function GroundHalo({ velocities }: { velocities: Map<number, number> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!matRef.current) return;
    const total = Array.from(velocities.values()).reduce((a, b) => a + b, 0);
    matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
      matRef.current.emissiveIntensity, total * 0.45, 0.12
    );
  });
  return (
    <mesh position={[0, -0.16, -1.75]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[9, 6.5]} />
      <meshStandardMaterial
        ref={matRef}
        color="#000"
        emissive={ACID}
        emissiveIntensity={0}
        transparent
        opacity={0.001}
      />
    </mesh>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function DrumStage({
  pads,
  velocities,
  shake,
}: {
  pads: { isActive: boolean; name?: string }[];
  velocities: Map<number, number>;
  shake: number;
}) {
  return (
    <ThreeStage shake={shake}>
      {/* Atmosphere */}
      <fog attach="fog" args={['#030803', 14, 32]} />

      {/* Environment */}
      <MetallicFloor />
      <FloorGrid />
      <StagePlatform />
      <StageRails />
      <LEDStrips velocities={velocities} />
      <PadNamePlates pads={pads} />

      {/* Lighting */}
      <OverheadSpots />
      <PadLights pads={pads} velocities={velocities} />
      <GroundHalo velocities={velocities} />

      {/* Original pad meshes — identical positions */}
      {pads.map((pad, i) => (
        <PadMesh
          key={i}
          active={pad.isActive}
          velocity={velocities.get(i) ?? 0}
          position={padPosition(i)}
        />
      ))}

      {/* Original shadow floor (retained from source) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </ThreeStage>
  );
}