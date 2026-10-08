/**
 * Neural space — particles, lines, simple planets, camera warp.
 * Three.js MIT. No downloaded 3D models.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import {
  CONNECT_START,
  INTRO_END,
  JOURNEY_PROJECTS,
  PLANET_POS,
  PROFILE_START,
  projectIndexAt,
  projectLocal,
  projectStage,
  warpEase,
} from "../../../lib/journey.js";
import { worldState } from "../worldState.js";
import { buildNetwork } from "./network.js";

const GOLD = "#d8c19a";
const ico = new THREE.IcosahedronGeometry(0.028, 0);
const sph = new THREE.SphereGeometry(1, 32, 32);
const nodeMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.78, depthWrite: false });
const lineMat = new THREE.LineBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.14,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const planetMat = new THREE.MeshStandardMaterial({
  color: "#16151a",
  metalness: 0.55,
  roughness: 0.38,
  emissive: GOLD,
  emissiveIntensity: 0.08,
});
const atmoMat = new THREE.MeshBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.09,
  side: THREE.BackSide,
  depthWrite: false,
});

const dummy = new THREE.Object3D();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

function cameraTarget(p) {
  const reduced = worldState.reduced;
  if (p < INTRO_END) {
    const u = p / INTRO_END;
    return {
      cam: [0, 0.2, 22 - u * 8],
      look: [0, 0, -8],
      fov: 42,
      warp: 0,
    };
  }
  if (p >= PROFILE_START) {
    const u = (p - PROFILE_START) / 0.1;
    return {
      cam: [0, 4.2 + u * 6, 28 + u * 14],
      look: [0, 0, -40],
      fov: 40,
      warp: 0,
    };
  }
  if (p >= CONNECT_START) {
    const u = (p - CONNECT_START) / Math.max(0.001, PROFILE_START - CONNECT_START);
    return {
      cam: [0, 2.2 + u * 2, 8 + u * 18],
      look: [0, 0, -40],
      fov: 42,
      warp: 0,
    };
  }

  const { i, t } = projectLocal(p);
  const planet = PLANET_POS[i] || PLANET_POS[0];
  const prev = i === 0 ? [0, 0.2, 12] : lookFrom(PLANET_POS[i - 1], 5.4);
  const arrive = lookFrom(planet, 3.15);
  const read = lookFrom(planet, 2.35);
  const stage = projectStage(t);

  if (stage.id === "network") {
    return { cam: prev, look: planet, fov: 42, warp: 0 };
  }
  if (stage.id === "warp") {
    const e = reduced ? stage.u : warpEase(stage.u);
    _from.set(prev[0], prev[1], prev[2]);
    _to.set(arrive[0], arrive[1], arrive[2]);
    _from.lerp(_to, e);
    const fov = 42 + Math.sin(stage.u * Math.PI) * (reduced ? 4 : 18);
    return { cam: [_from.x, _from.y, _from.z], look: planet, fov, warp: Math.sin(stage.u * Math.PI) };
  }
  if (stage.id === "arrive") {
    _from.set(arrive[0], arrive[1], arrive[2]);
    _to.set(read[0], read[1], read[2]);
    _from.lerp(_to, stage.u);
    return { cam: [_from.x, _from.y, _from.z], look: planet, fov: 40, warp: 0 };
  }
  if (stage.id === "read") {
    return { cam: read, look: planet, fov: 38, warp: 0 };
  }
  const nextLook = i < PLANET_POS.length - 1 ? PLANET_POS[i + 1] : [0, 0, -90];
  _from.set(read[0], read[1], read[2]);
  _to.set(prev[0] * 0.3 + nextLook[0] * 0.1, 1.2, read[2] + 6);
  _from.lerp(_to, stage.u);
  return { cam: [_from.x, _from.y, _from.z], look: planet, fov: 42, warp: stage.u * 0.25 };
}

function lookFrom(planet, dist) {
  return [planet[0] * 0.15, planet[1] + 0.35, planet[2] + dist];
}

function Rig() {
  const last = useRef(0);
  useFrame(({ camera }, delta) => {
    const p = worldState.progress;
    const tgt = cameraTarget(p);
    _cam.set(tgt.cam[0], tgt.cam[1], tgt.cam[2]);
    _look.set(tgt.look[0], tgt.look[1], tgt.look[2]);
    if (!worldState.reduced) {
      _cam.x += worldState.pointerX * 0.35;
      _cam.y += worldState.pointerY * 0.22;
    }
    const k = 1 - Math.exp(-delta * (tgt.warp > 0.4 ? 8 : 3.1));
    camera.position.lerp(_cam, k);
    camera.lookAt(_look);
    camera.fov += (tgt.fov - camera.fov) * (1 - Math.exp(-delta * 5));
    camera.updateProjectionMatrix();
    worldState.warp = tgt.warp;
    last.current = p;
  });
  return null;
}

function NeuralField({ count }) {
  const mesh = useRef();
  const lines = useRef();
  const net = useMemo(() => buildNetwork(count, PLANET_POS), [count]);

  useFrame(({ clock }) => {
    const meshObj = mesh.current;
    if (!meshObj) return;
    const quiet = Math.min(1, Math.max(0, worldState.quiet || (worldState.progress >= PROFILE_START ? 0.85 : 0)));
    const live = 1 - quiet;
    const breath = worldState.reduced || quiet > 0.6 ? 1 : 1 + Math.sin(clock.elapsedTime * 0.35) * 0.012 * live;
    const warp = (worldState.warp || 0) * live;
    const p = worldState.progress;
    const idx = projectIndexAt(p);
    const active = idx >= 0 ? PLANET_POS[idx] : null;
    const hover = worldState.hoverIndex;
    const highlight = hover >= 0 ? PLANET_POS[hover] : active;

    for (let i = 0; i < count; i++) {
      const o = i * 3;
      dummy.position.set(net.pos[o] * breath, net.pos[o + 1] * breath, net.pos[o + 2] * breath);
      if (warp > 0.05) dummy.position.z -= warp * 1.8 * ((i % 7) - 3) * 0.08;
      let s = 1;
      if (highlight && live > 0.15) {
        const dx = dummy.position.x - highlight[0];
        const dy = dummy.position.y - highlight[1];
        const dz = dummy.position.z - highlight[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 3.2) s = 1 + (1 - d / 3.2) * 1.8 * live;
      }
      dummy.scale.set(s, s, s * (1 + warp * 4.5));
      dummy.updateMatrix();
      meshObj.setMatrixAt(i, dummy.matrix);
    }
    meshObj.instanceMatrix.needsUpdate = true;
    if (lines.current) {
      const pulse = quiet > 0.85 ? 0 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.6 * live);
      lines.current.material.opacity = 0.05 + 0.08 * pulse * live + warp * 0.12;
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[ico, nodeMat, count]} frustumCulled={false} />
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[net.line, 3]} />
        </bufferGeometry>
        <primitive object={lineMat} attach="material" />
      </lineSegments>
    </>
  );
}

function Planets() {
  const group = useRef();
  useFrame(() => {
    if (!group.current) return;
    const p = worldState.progress;
    const idx = projectIndexAt(p);
    const { t } = projectLocal(p);
    const stage = idx >= 0 ? projectStage(t).id : "";
    group.current.children.forEach((child, i) => {
      const on = idx === i && (stage === "warp" || stage === "arrive" || stage === "read");
      const leave = idx === i && stage === "leave";
      const connect = p >= CONNECT_START;
      const hover = worldState.hoverIndex === i;
      const target = connect ? 0.55 : on ? 1 : hover ? 0.72 : 0.28;
      const scale = leave ? 1 - projectStage(t).u * 0.35 : target;
      child.scale.setScalar(THREE.MathUtils.lerp(child.scale.x, Math.max(0.12, scale), 0.08));
    });
  });
  return (
    <group ref={group}>
      {PLANET_POS.map((pos, i) => (
        <group key={JOURNEY_PROJECTS[i].id} position={pos}>
          <mesh geometry={sph} material={planetMat} scale={0.82} />
          <mesh geometry={sph} material={atmoMat} scale={1.12} />
        </group>
      ))}
    </group>
  );
}

function Scene({ count }) {
  return (
    <>
      <AdaptiveDpr />
      <color attach="background" args={["#050506"]} />
      <fog attach="fog" args={["#050506", 8, 42]} />
      <ambientLight intensity={0.32} />
      <pointLight position={[4, 6, 8]} intensity={8} color={GOLD} />
      <Rig />
      <NeuralField count={count} />
      <Planets />
    </>
  );
}

export default function NeuralCanvas() {
  const count = worldState.mobile ? 160 : 420;
  return (
    <Canvas
      className="world-canvas"
      dpr={[1, worldState.mobile ? 1.05 : 1.4]}
      gl={{ antialias: !worldState.mobile, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0.2, 22], fov: 42, near: 0.1, far: 120 }}
    >
      <Scene count={count} />
    </Canvas>
  );
}
