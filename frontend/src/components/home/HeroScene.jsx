import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

const GOLD = "#d8c19a";
const INK = "#121214";
const SCREEN = "#0a0a0c";

function HeroCamera({ children }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.42, 3.2, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.18, 3.2, delta);
  });
  return <group ref={group}>{children}</group>;
}

function Monitor({ position, rotation, scale = 1 }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[1.7, 1.05, 0.08]} />
        <meshStandardMaterial color={INK} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.72, 0.045]}>
        <planeGeometry args={[1.52, 0.88]} />
        <meshStandardMaterial color={SCREEN} emissive={GOLD} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.28, 12]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0.04]}>
        <boxGeometry args={[0.55, 0.05, 0.32]} />
        <meshStandardMaterial color="#1c1c20" />
      </mesh>
    </group>
  );
}

function Desk() {
  return (
    <group position={[0, -1.55, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[5.4, 0.12, 2.4]} />
        <meshStandardMaterial color="#161618" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[-1.9, -0.7, 0]}>
        <boxGeometry args={[0.14, 1.3, 2.2]} />
        <meshStandardMaterial color="#101012" />
      </mesh>
      <mesh position={[1.9, -0.7, 0]}>
        <boxGeometry args={[0.14, 1.3, 2.2]} />
        <meshStandardMaterial color="#101012" />
      </mesh>
      <Monitor position={[-0.85, 0.08, -0.15]} rotation={[0, 0.18, 0]} />
      <Monitor position={[0.95, 0.08, -0.22]} rotation={[0, -0.28, 0]} scale={0.92} />
      <mesh position={[-0.2, 0.1, 0.55]}>
        <boxGeometry args={[1.8, 0.06, 0.62]} />
        <meshStandardMaterial color="#222226" />
      </mesh>
      <mesh position={[1.7, 0.28, 0.35]}>
        <boxGeometry args={[0.55, 0.42, 0.7]} />
        <meshStandardMaterial color="#0f0f12" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function SpinCube({ position }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.55;
    ref.current.rotation.y += delta * 0.72;
  });
  return (
    <Float floatIntensity={1.4} speed={1.6}>
      <mesh ref={ref} position={position}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.22} />
      </mesh>
    </Float>
  );
}

function Rings({ position }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.35;
    ref.current.rotation.y -= delta * 0.28;
  });
  return (
    <group ref={ref} position={position} scale={0.42}>
      {[0.7, 1.15, 1.6, 2.05].map((r) => (
        <mesh key={r}>
          <torusGeometry args={[r, 0.07, 12, 48]} />
          <meshStandardMaterial color={GOLD} metalness={0.65} roughness={0.25} emissive={GOLD} emissiveIntensity={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function Atom({ position }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.8;
  });
  return (
    <Float speed={2} floatIntensity={1.2}>
      <group ref={ref} position={position} scale={0.32}>
        <mesh>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.35} />
        </mesh>
        {[0, Math.PI / 3, -Math.PI / 3].map((rot) => (
          <mesh key={rot} rotation={[rot, 0.4, rot]}>
            <torusGeometry args={[0.85, 0.045, 8, 48]} />
            <meshStandardMaterial color="#c4b8ff" metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.15, 8.2]} fov={42} />
      <color attach="background" args={["#060606"]} />
      <fog attach="fog" args={["#060606", 10, 22]} />
      <ambientLight intensity={0.42} />
      <spotLight position={[5, 8, 6]} angle={0.45} penumbra={0.55} intensity={22} color={GOLD} />
      <pointLight position={[-5, 2.5, 3]} intensity={8} color="#8ea2c8" />
      <HeroCamera>
        <group position={[0.15, 0.15, 0]}>
          <Desk />
          <SpinCube position={[2.35, 1.15, 0.2]} />
          <Rings position={[-2.7, 1.35, -0.6]} />
          <Atom position={[2.05, -0.15, 1.15]} />
        </group>
      </HeroCamera>
    </>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      className="home-canvas"
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
