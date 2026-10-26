import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import CameraRig, { placeCamera } from "./CameraRig.jsx";
import BlackHole from "./BlackHole.jsx";
import SpaceBackdrop from "./SpaceBackdrop.jsx";
import TransitionVeil from "./TransitionVeil.jsx";
import NeuralWorld from "./NeuralWorld.jsx";
import InfraWorld from "./InfraWorld.jsx";
import AtomWorld from "./AtomWorld.jsx";
import LivingWorld from "./LivingWorld.jsx";
import TimeWorld from "./TimeWorld.jsx";
import CreationWorld from "./CreationWorld.jsx";
import OriginWorld from "./OriginWorld.jsx";

/**
 * 하나의 캔버스, 하나의 카메라. 모든 세계는 같은 원점에 있고 지금 보이는 것만 그린다.
 * CameraRig 를 가장 먼저 두어 매 프레임 카메라가 먼저 움직이고 나머지가 그 값을 읽게 한다.
 */
export default function UniverseCanvas({ ids, projects, counts, mobile }) {
  const [dpr, setDpr] = useState(() => (mobile ? Math.min(1.25, window.devicePixelRatio || 1) : Math.min(1.6, window.devicePixelRatio || 1)));
  const has = (id) => ids.includes(id);

  return (
    <Canvas
      className="uv-canvas"
      dpr={dpr}
      camera={{ fov: 40, near: 0.05, far: 500, position: [0, 0.8, 14.5] }}
      gl={{ antialias: !mobile, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ camera, gl, size }) => {
        gl.setClearColor("#020203", 1);
        placeCamera(camera, size.width / Math.max(1, size.height));
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(mobile ? 0.7 : 0.85, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(mobile ? 1.25 : 1.6, d + 0.15))}
        flipflops={3}
      />
      <CameraRig />
      <BlackHole />
      <SpaceBackdrop />
      {has("projects") && <NeuralWorld projects={projects} />}
      {has("infrastructure") && <InfraWorld items={counts.infrastructureItems} />}
      {has("credentials") && <AtomWorld count={counts.credentials} />}
      {has("activities") && <LivingWorld count={counts.activities} />}
      {has("career") && <TimeWorld count={counts.career} />}
      {has("awards") && <CreationWorld count={counts.awards} />}
      {has("profile") && <OriginWorld />}
      <TransitionVeil />
    </Canvas>
  );
}
