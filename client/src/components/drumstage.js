import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// P4-EXEMPT: #030803 #4d6b18 — Three.js <lineBasicMaterial color=...> props;
// CSS variables cannot be resolved by the Three.js material system at runtime.
// Exempted: p_final_patch residual pass.
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
const PAD_COLS = 4;
const PAD_SPACING = 1.6;
const PAD_OFFSET = -2.4;
const ACID = new THREE.Color('#a3e635');
const ACID_DIM = new THREE.Color('#4d6b18');
function padPosition(i) {
    return [
        (i % PAD_COLS) * PAD_SPACING + PAD_OFFSET,
        0,
        -Math.floor(i / PAD_COLS) * PAD_SPACING,
    ];
}
// ── Reflective metallic floor ─────────────────────────────────────────────────
function MetallicFloor() {
    const matRef = useRef(null);
    useFrame(({ clock }) => {
        if (matRef.current) {
            matRef.current.envMapIntensity =
                0.6 + Math.sin(clock.elapsedTime * 0.4) * 0.1;
        }
    });
    return (_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, -0.18, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [40, 40] }), _jsx("meshStandardMaterial", { ref: matRef, color: "#0a0a0a", metalness: 0.95, roughness: 0.06 })] }));
}
// ── Faint grid lines on the floor ────────────────────────────────────────────
function FloorGrid() {
    const geo = useMemo(() => {
        const pts = [];
        for (let i = -10; i <= 10; i++) {
            pts.push(i * 1.6, -0.175, -18, i * 1.6, -0.175, 18);
            pts.push(-18, -0.175, i * 1.6, 18, -0.175, i * 1.6);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        return g;
    }, []);
    return (_jsx("lineSegments", { geometry: geo, children: _jsx("lineBasicMaterial", { color: "var(--status-ok-dim)", opacity: 0.28, transparent: true }) }));
}
// ── Slightly raised stage platform ───────────────────────────────────────────
function StagePlatform() {
    return (_jsxs("mesh", { position: [0, -0.185, -1.6], receiveShadow: true, children: [_jsx("boxGeometry", { args: [9.2, 0.03, 6.0] }), _jsx("meshStandardMaterial", { color: "#0d0d0d", metalness: 0.65, roughness: 0.45 })] }));
}
// ── Truss frame (4 corner posts + 4 overhead crossbeams) ─────────────────────
function StageRails() {
    const mat = (_jsx("meshStandardMaterial", { color: "var(--t-b2x)", metalness: 0.88, roughness: 0.22 }));
    const posts = [
        [-4.5, 0, 1.4], [4.5, 0, 1.4],
        [-4.5, 0, -4.8], [4.5, 0, -4.8],
    ];
    const beams = [
        [[-4.5, 3.2, 1.4], [4.5, 3.2, 1.4]],
        [[-4.5, 3.2, -4.8], [4.5, 3.2, -4.8]],
        [[-4.5, 3.2, 1.4], [-4.5, 3.2, -4.8]],
        [[4.5, 3.2, 1.4], [4.5, 3.2, -4.8]],
    ];
    return (_jsxs("group", { children: [posts.map(([x, , z], i) => (_jsxs("mesh", { position: [x, 1.6, z], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.042, 0.042, 3.2, 6] }), mat] }, `post-${i}`))), beams.map(([s, e], i) => {
                const mid = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2, (s[2] + e[2]) / 2];
                const len = Math.hypot(e[0] - s[0], e[2] - s[2]);
                const ang = Math.atan2(e[2] - s[2], e[0] - s[0]);
                return (_jsxs("mesh", { position: mid, rotation: [0, -ang, Math.PI / 2], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.026, 0.026, len, 6] }), mat] }, `beam-${i}`));
            })] }));
}
// ── LED edge strips (front bright, others dimmer) ─────────────────────────────
function LEDStrips({ velocities }) {
    const frontRef = useRef(null);
    const sideRefs = [useRef(null), useRef(null)];
    useFrame(({ clock }) => {
        const total = Array.from(velocities.values()).reduce((a, b) => a + b, 0);
        const idle = 0.08 + Math.sin(clock.elapsedTime * 1.8) * 0.025;
        const hit = Math.min(total * 3, 4.0);
        if (frontRef.current)
            frontRef.current.emissiveIntensity = total > 0 ? hit : idle;
        sideRefs.forEach(r => {
            if (r.current)
                r.current.emissiveIntensity = idle * 0.4;
        });
    });
    return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, -0.155, 1.5], children: [_jsx("boxGeometry", { args: [9.0, 0.05, 0.05] }), _jsx("meshStandardMaterial", { ref: frontRef, color: "var(--panel-deep)", emissive: ACID, emissiveIntensity: 0.08, metalness: 0.9, roughness: 0.18 })] }), _jsxs("mesh", { position: [0, -0.155, -5.0], children: [_jsx("boxGeometry", { args: [9.0, 0.05, 0.05] }), _jsx("meshStandardMaterial", { color: "var(--panel-deep)", emissive: ACID_DIM, emissiveIntensity: 0.03, metalness: 0.9, roughness: 0.18 })] }), [-4.55, 4.55].map((x, i) => (_jsxs("mesh", { position: [x, -0.155, -1.75], children: [_jsx("boxGeometry", { args: [0.05, 0.05, 6.5] }), _jsx("meshStandardMaterial", { ref: sideRefs[i], color: "var(--panel-deep)", emissive: ACID_DIM, emissiveIntensity: 0.025, metalness: 0.9, roughness: 0.18 })] }, x)))] }));
}
// ── Per-pad reactive point lights ─────────────────────────────────────────────
function PadLights({ pads, velocities }) {
    const refs = useRef([]);
    useFrame(() => {
        pads.forEach((pad, i) => {
            const light = refs.current[i];
            if (!light)
                return;
            const vel = velocities.get(i) ?? 0;
            const active = pad.isActive || vel > 0;
            const target = active ? vel * 5.5 + 0.6 : 0;
            light.intensity = THREE.MathUtils.lerp(light.intensity, target, 0.22);
        });
    });
    return (_jsx(_Fragment, { children: pads.map((_, i) => {
            const [x, , z] = padPosition(i);
            return (_jsx("pointLight", { ref: el => { refs.current[i] = el; }, position: [x, 0.75, z], color: ACID, intensity: 0, distance: 3.8, decay: 2 }, i));
        }) }));
}
// ── Overhead spotlights ───────────────────────────────────────────────────────
function OverheadSpots() {
    const spots = [
        [-2.4, 5.8, 2.0], [2.4, 5.8, 2.0],
        [-2.4, 5.8, -5.0], [2.4, 5.8, -5.0],
    ];
    return (_jsx(_Fragment, { children: spots.map(([x, y, z], i) => (_jsx("spotLight", { position: [x, y, z], intensity: 0.75, angle: 0.30, penumbra: 0.65, distance: 14, color: "var(--text-primary)", castShadow: true, "shadow-mapSize": [512, 512] }, i))) }));
}
// ── Thin emissive name plates above each pad ──────────────────────────────────
function PadNamePlates({ pads }) {
    return (_jsx(_Fragment, { children: pads.map((pad, i) => {
            const [x, , z] = padPosition(i);
            return (_jsxs("mesh", { position: [x, 0.65, z], children: [_jsx("boxGeometry", { args: [0.58, 0.014, 0.12] }), _jsx("meshStandardMaterial", { color: "var(--panel)", emissive: ACID_DIM, emissiveIntensity: pad.isActive ? 5 : 0.5, metalness: 0.96, roughness: 0.04 })] }, i));
        }) }));
}
// ── Invisible emissive plane that feeds Bloom post-processing ─────────────────
function GroundHalo({ velocities }) {
    const matRef = useRef(null);
    useFrame(() => {
        if (!matRef.current)
            return;
        const total = Array.from(velocities.values()).reduce((a, b) => a + b, 0);
        matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, total * 0.45, 0.12);
    });
    return (_jsxs("mesh", { position: [0, -0.16, -1.75], rotation: [-Math.PI / 2, 0, 0], children: [_jsx("planeGeometry", { args: [9, 6.5] }), _jsx("meshStandardMaterial", { ref: matRef, color: "var(--dj-black)", emissive: ACID, emissiveIntensity: 0, transparent: true, opacity: 0.001 })] }));
}
// ── Main export ───────────────────────────────────────────────────────────────
export function DrumStage({ pads, velocities, shake, }) {
    return (_jsxs(ThreeStage, { shake: shake, children: [_jsx("fog", { attach: "fog", args: ['#030803', 14, 32] }), _jsx(MetallicFloor, {}), _jsx(FloorGrid, {}), _jsx(StagePlatform, {}), _jsx(StageRails, {}), _jsx(LEDStrips, { velocities: velocities }), _jsx(PadNamePlates, { pads: pads }), _jsx(OverheadSpots, {}), _jsx(PadLights, { pads: pads, velocities: velocities }), _jsx(GroundHalo, { velocities: velocities }), pads.map((pad, i) => (_jsx(PadMesh, { active: pad.isActive, velocity: velocities.get(i) ?? 0, position: padPosition(i) }, i))), _jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, -0.18, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [40, 40] }), _jsx("shadowMaterial", { opacity: 0.4 })] })] }));
}
