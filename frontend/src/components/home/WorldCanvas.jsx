/**
 * Cinematic system world.
 * Three.js MIT — https://github.com/mrdoob/three.js
 * React Three Fiber MIT — https://github.com/pmndrs/react-three-fiber
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import { envelope, sampleCam, sceneMix, worldState } from "./worldState.js";
import { makePairs, makeTargets } from "./worldTargets.js";

const GOLD = "#d8c19a";
const DATA = "#8fb4d9";
const SIGNAL = "#3f8f5a";

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const icoGeo = new THREE.IcosahedronGeometry(1, 0);
const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const torusGeo = new THREE.TorusGeometry(1, 0.08, 8, 32);
const particleGeo = new THREE.IcosahedronGeometry(0.038, 0);

const metal = new THREE.MeshStandardMaterial({
  color: "#141416",
  metalness: 0.72,
  roughness: 0.28,
});
const goldMat = new THREE.MeshStandardMaterial({
  color: GOLD,
  metalness: 0.8,
  roughness: 0.22,
  emissive: GOLD,
  emissiveIntensity: 0.22,
});
const dataMat = new THREE.MeshStandardMaterial({
  color: DATA,
  metalness: 0.4,
  roughness: 0.3,
  emissive: DATA,
  emissiveIntensity: 0.35,
});
const signalMat = new THREE.MeshStandardMaterial({
  color: SIGNAL,
  metalness: 0.35,
  roughness: 0.4,
  emissive: SIGNAL,
  emissiveIntensity: 0.4,
});
const particleMat = new THREE.MeshBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
});
const lineMat = new THREE.LineBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.18,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const dummy = new THREE.Object3D();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

function Rig() {
  useFrame(({ camera }, delta) => {
    const p = worldState.reduced ? 1 : worldState.progress;
    const cam = sampleCam(p);
    _cam.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    _look.set(cam.look[0], cam.look[1], cam.look[2]);
    if (!worldState.reduced) {
      _cam.x += worldState.pointerX * 0.55;
      _cam.y += worldState.pointerY * 0.32;
    }
    camera.position.lerp(_cam, 1 - Math.exp(-delta * 3.2));
    camera.lookAt(_look);
  });
  return null;
}

function ParticleField({ count }) {
  const mesh = useRef();
  const lines = useRef();
  const targets = useMemo(() => makeTargets(count), [count]);
  const pairs = useMemo(() => makePairs(count), [count]);
  const linePos = useMemo(() => new Float32Array(pairs.length * 6), [pairs.length]);

  useFrame(() => {
    const meshObj = mesh.current;
    if (!meshObj) return;
    const p = worldState.reduced ? 1 : worldState.progress;
    const { i, t, j } = sceneMix(p);
    const A = targets[i];
    const B = targets[j];
    for (let n = 0; n < count; n++) {
      const o = n * 3;
      dummy.position.set(
        A[o] + (B[o] - A[o]) * t,
        A[o + 1] + (B[o + 1] - A[o + 1]) * t,
        A[o + 2] + (B[o + 2] - A[o + 2]) * t
      );
      dummy.scale.setScalar(n === 0 && i >= 2 ? 2.6 : 1);
      dummy.updateMatrix();
      meshObj.setMatrixAt(n, dummy.matrix);
    }
    meshObj.instanceMatrix.needsUpdate = true;

    const lineObj = lines.current;
    if (!lineObj) return;
    const arr = lineObj.geometry.attributes.position.array;
    for (let k = 0; k < pairs.length; k++) {
      const [ia, ib] = pairs[k];
      const dst = k * 6;
      arr[dst] = A[ia * 3] + (B[ia * 3] - A[ia * 3]) * t;
      arr[dst + 1] = A[ia * 3 + 1] + (B[ia * 3 + 1] - A[ia * 3 + 1]) * t;
      arr[dst + 2] = A[ia * 3 + 2] + (B[ia * 3 + 2] - A[ia * 3 + 2]) * t;
      arr[dst + 3] = A[ib * 3] + (B[ib * 3] - A[ib * 3]) * t;
      arr[dst + 4] = A[ib * 3 + 1] + (B[ib * 3 + 1] - A[ib * 3 + 1]) * t;
      arr[dst + 5] = A[ib * 3 + 2] + (B[ib * 3 + 2] - A[ib * 3 + 2]) * t;
    }
    lineObj.geometry.attributes.position.needsUpdate = true;
    const net = envelope(p, 0.08, 0.2, 0.38) + envelope(p, 0.88, 0.96, 1.02) * 0.7;
    lineObj.material.opacity = 0.05 + net * 0.28;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[particleGeo, particleMat, count]} frustumCulled={false} />
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
        </bufferGeometry>
        <primitive object={lineMat} attach="material" />
      </lineSegments>
    </>
  );
}

function FadeGroup({ pick, children }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    const show = pick();
    const target = show > 0.05 ? 1 : 0.001;
    const s = THREE.MathUtils.damp(ref.current.scale.x, target, 5.5, delta);
    ref.current.scale.setScalar(Math.max(0.001, s));
    ref.current.visible = s > 0.03;
  });
  return <group ref={ref}>{children}</group>;
}

function GwonWorld() {
  const spin = useRef();
  const nodes = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return [Math.cos(a) * 2.55, 0.05, Math.sin(a) * 2.55];
      }),
    []
  );
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.16;
  });
  return (
    <FadeGroup pick={() => (worldState.reduced ? 0 : envelope(worldState.progress, 0.18, 0.32, 0.44))}>
      <group ref={spin}>
        <mesh geometry={icoGeo} material={goldMat} scale={0.55} />
        {nodes.map((p) => (
          <mesh
            key={p.join()}
            geometry={boxGeo}
            material={metal}
            position={p}
            scale={[0.42, 0.32, 0.42]}
            onPointerOver={(e) => {
              e.stopPropagation();
              e.object.scale.set(0.56, 0.42, 0.56);
            }}
            onPointerOut={(e) => e.object.scale.set(0.42, 0.32, 0.42)}
          />
        ))}
        <mesh
          geometry={cylGeo}
          material={dataMat}
          rotation={[0, 0, Math.PI / 2.35]}
          scale={[0.032, 6.4, 0.032]}
        />
        <mesh geometry={torusGeo} material={goldMat} position={[-4.2, 0.6, 3.4]} rotation={[0.4, 0.8, 0]} scale={0.55} />
      </group>
    </FadeGroup>
  );
}

function MeterWorld() {
  const pulse = useRef();
  const sites = useMemo(
    () => [
      [-2.4, 0, -1.6],
      [2.2, 0, -1.8],
      [-2.0, 0, 1.8],
      [2.4, 0, 1.6],
      [0, 0, -2.6],
      [0.1, 0, 2.4],
    ],
    []
  );
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const u = (clock.elapsedTime * 0.22) % 1;
    const a = sites[Math.floor(u * sites.length) % sites.length];
    const b = [0, 3.1, 0];
    const t = (u * sites.length) % 1;
    pulse.current.position.set(a[0] + (b[0] - a[0]) * t, a[1] + 0.5 + (b[1] - 0.5) * t, a[2] + (b[2] - a[2]) * t);
    pulse.current.scale.setScalar(0.09 + (1 - t) * 0.16);
  });
  return (
    <FadeGroup pick={() => (worldState.reduced ? 0 : envelope(worldState.progress, 0.38, 0.5, 0.62))}>
      {sites.map((p) => (
        <group key={p.join()} position={p}>
          <mesh geometry={boxGeo} material={metal} scale={[1.15, 0.18, 1.15]} />
          <mesh geometry={cylGeo} material={dataMat} position={[0, 0.45, 0]} scale={[0.08, 0.7, 0.08]} />
        </group>
      ))}
      <mesh ref={pulse} geometry={sphereGeo} material={dataMat} />
    </FadeGroup>
  );
}

function GreeneyeWorld() {
  const core = useRef();
  useFrame((_, delta) => {
    if (core.current) core.current.rotation.y += delta * 0.4;
  });
  const objs = [
    [2.1, 0.2, 0],
    [-1.6, 0.35, 1.4],
    [0.4, -0.2, -2.0],
  ];
  return (
    <FadeGroup pick={() => (worldState.reduced ? 0 : envelope(worldState.progress, 0.54, 0.64, 0.74))}>
      <mesh ref={core} geometry={icoGeo} material={goldMat} scale={0.7} />
      {objs.map((p, i) => (
        <mesh key={p.join()} geometry={boxGeo} material={i === 0 ? signalMat : metal} position={p} scale={0.32} />
      ))}
    </FadeGroup>
  );
}

function TressWorld() {
  const piston = useRef();
  useFrame(({ clock }) => {
    if (!piston.current) return;
    piston.current.position.y = Math.sin(clock.elapsedTime * 3.1) * 0.26;
  });
  return (
    <FadeGroup pick={() => (worldState.reduced ? 0 : envelope(worldState.progress, 0.66, 0.76, 0.86))}>
      <mesh geometry={cylGeo} material={metal} scale={[0.85, 1.6, 0.85]} />
      <mesh geometry={cylGeo} material={goldMat} position={[0, 1.05, 0]} scale={[0.7, 0.12, 0.7]} />
      <mesh ref={piston} geometry={boxGeo} material={dataMat} position={[0, 0.2, 0]} scale={[0.55, 0.18, 0.55]} />
      <mesh geometry={boxGeo} material={metal} position={[0, -1.05, 0]} scale={[1.3, 0.2, 1.3]} />
    </FadeGroup>
  );
}

function OjWorld() {
  const ring = useRef();
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.x += delta * 0.65;
  });
  return (
    <FadeGroup pick={() => (worldState.reduced ? 0 : envelope(worldState.progress, 0.78, 0.86, 0.94))}>
      <mesh geometry={icoGeo} material={goldMat} scale={0.45} />
      <mesh ref={ring} geometry={torusGeo} material={dataMat} scale={1.8} />
      <mesh geometry={torusGeo} material={metal} rotation={[Math.PI / 2, 0, 0]} scale={2.3} />
    </FadeGroup>
  );
}

function FinaleWorld() {
  const nodes = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return [Math.cos(a) * 3.2, 0.2, Math.sin(a) * 3.2];
      }),
    []
  );
  return (
    <FadeGroup pick={() => (worldState.reduced ? 1 : envelope(worldState.progress, 0.88, 0.97, 1.08))}>
      <mesh geometry={icoGeo} material={goldMat} scale={0.4} />
      {nodes.map((p) => (
        <mesh key={p.join()} geometry={sphereGeo} material={goldMat} position={p} scale={0.18} />
      ))}
    </FadeGroup>
  );
}

function Scene({ count }) {
  return (
    <>
      <AdaptiveDpr pixelated />
      <color attach="background" args={["#050506"]} />
      <fog attach="fog" args={["#050506", 11, 28]} />
      <ambientLight intensity={0.28} />
      <pointLight position={[5, 7, 6]} intensity={10} color={GOLD} />
      <pointLight position={[-6, 2, 3]} intensity={4} color={DATA} />
      <Rig />
      <ParticleField count={count} />
      <GwonWorld />
      <MeterWorld />
      <GreeneyeWorld />
      <TressWorld />
      <OjWorld />
      <FinaleWorld />
    </>
  );
}

export default function WorldCanvas() {
  const count = worldState.mobile ? 110 : 260;
  return (
    <Canvas
      className="world-canvas"
      dpr={[1, worldState.mobile ? 1.05 : 1.45]}
      gl={{ antialias: !worldState.mobile, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0.2, 16.5], fov: 42, near: 0.1, far: 70 }}
    >
      <Scene count={count} />
    </Canvas>
  );
}
