import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WORLDS, makePlanetPos } from "../../../lib/journey.js";
import { worldState } from "../worldState.js";
import {
  planetVert,
  earthFrag,
  atmoFrag,
  sunFrag,
  marsFrag,
  holeFrag,
  nebulaFrag,
} from "./shaders.js";

function useCamUniform(mat) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.elapsedTime;
    if (mat.current.uniforms.uCam) mat.current.uniforms.uCam.value.copy(camera.position);
  });
}

function Earth({ scale = 1 }) {
  const mat = useRef();
  const atmo = useRef();
  const earth = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
        vertexShader: planetVert,
        fragmentShader: earthFrag,
      }),
    []
  );
  const haze = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color("#6ea0ff") }, uTime: { value: 0 } },
        vertexShader: planetVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    []
  );
  mat.current = earth;
  atmo.current = haze;
  useCamUniform(mat);
  useCamUniform(atmo);
  return (
    <group scale={scale}>
      <mesh material={earth} rotation={[0.2, 0, 0.1]}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
      <mesh material={haze} scale={1.08}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
    </group>
  );
}

function Sun() {
  const mat = useRef();
  const sun = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: planetVert,
        fragmentShader: sunFrag,
      }),
    []
  );
  mat.current = sun;
  useCamUniform(mat);
  return (
    <group>
      <mesh material={sun}>
        <sphereGeometry args={[1.15, 64, 64]} />
      </mesh>
      <mesh scale={1.35}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ffb45a" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <pointLight color="#ffcc77" intensity={18} distance={28} />
    </group>
  );
}

function Mars() {
  const mat = useRef();
  const m = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: planetVert,
        fragmentShader: marsFrag,
      }),
    []
  );
  mat.current = m;
  useCamUniform(mat);
  return (
    <mesh material={m}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

function Singularity() {
  const mat = useRef();
  const hole = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: planetVert,
        fragmentShader: holeFrag,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
  mat.current = hole;
  useCamUniform(mat);
  const disk = useRef();
  useFrame(({ clock }) => {
    if (disk.current) disk.current.rotation.z = clock.elapsedTime * 0.12;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={disk} material={hole} rotation={[1.15, 0.15, 0]}>
        <sphereGeometry args={[1.55, 64, 64]} />
      </mesh>
    </group>
  );
}

function Station() {
  const g = useRef();
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.z = clock.elapsedTime * 0.08;
  });
  return (
    <group ref={g}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.08, 12, 64]} />
        <meshStandardMaterial color="#8a8680" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.045, 10, 48]} />
        <meshStandardMaterial color="#6e6a64" metalness={0.8} roughness={0.32} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * 0.9]}>
          <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
          <meshStandardMaterial color="#9a958c" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.42, 0.28, 0.42]} />
        <meshStandardMaterial color="#c4b89a" metalness={0.4} roughness={0.4} emissive="#d8c19a" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[1.35, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#8899aa" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Atom() {
  const e = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    e.current.forEach((m, i) => {
      if (!m) return;
      const a = t * (0.6 + i * 0.22) + i;
      const r = 0.7 + i * 0.28;
      m.position.set(Math.cos(a) * r, Math.sin(a * 0.7) * 0.22, Math.sin(a) * r);
    });
  });
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color="#e8d4a8" emissive="#d8c19a" emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0.4 + i * 0.5, i * 1.1, 0.2]}>
          <torusGeometry args={[0.7 + i * 0.28, 0.008, 8, 64]} />
          <meshBasicMaterial color="#9bb8c4" transparent opacity={0.35} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`e${i}`} ref={(n) => (e.current[i] = n)}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#cfe6ff" />
        </mesh>
      ))}
    </group>
  );
}

function Nebula() {
  const mat = useRef();
  const n = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: planetVert,
        fragmentShader: nebulaFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );
  mat.current = n;
  useCamUniform(mat);
  return (
    <group>
      <mesh material={n} scale={[2.4, 1.6, 2.4]}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
      <pointLight color="#cc6644" intensity={8} distance={16} />
    </group>
  );
}

const MAP = {
  earth: Earth,
  singularity: Singularity,
  station: Station,
  atom: Atom,
  sun: Sun,
  mars: Mars,
  nebula: Nebula,
};

export default function Worlds() {
  const group = useRef();
  const pos = makePlanetPos(WORLDS.length);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const idx = Math.max(0, worldState.effectIndex);
    group.current.children.forEach((child, i) => {
      const on = idx === i;
      const target = on ? 1 : 0.42;
      child.scale.setScalar(THREE.MathUtils.lerp(child.scale.x, target, 0.06));
      child.rotation.y = clock.elapsedTime * (0.04 + (on ? 0.03 : 0));
    });
  });
  return (
    <group ref={group}>
      {WORLDS.map((w, i) => {
        const Body = MAP[w.world] || Earth;
        return (
          <group key={w.id} position={pos[i]}>
            <Body />
          </group>
        );
      })}
    </group>
  );
}
