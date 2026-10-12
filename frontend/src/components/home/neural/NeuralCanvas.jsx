/**
 * Neural space — particles, lines, simple planets, camera warp.
 * Shared NeuralWorld + per-project effect presets. No downloaded 3D models.
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
  liveProjects,
  PROFILE_START,
  projectIndexAt,
  projectLocal,
  projectStage,
  warpEase,
} from "../../../lib/journey.js";
import { worldState } from "../worldState.js";
import { buildNetwork } from "./network.js";

const GOLD = "#d8c19a";
const CYAN = "#9bb8c4";
const ico = new THREE.IcosahedronGeometry(0.028, 0);
const sph = new THREE.SphereGeometry(1, 32, 32);
const torus = new THREE.TorusGeometry(1.38, 0.007, 8, 72);
const nodeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.78, depthWrite: false });
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
const goldC = new THREE.Color(GOLD);
const cyanC = new THREE.Color(CYAN);
const tint = new THREE.Color();

function planets() {
  return worldState.planets?.length ? worldState.planets : PLANET_POS;
}

function cameraTarget(p) {
  const reduced = worldState.reduced;
  if (p < INTRO_END) {
    const u = p / INTRO_END;
    return {
      cam: [0, 0.2, 22 - u * 8],
      look: [0, 0, -8],
      fov: 45,
      warp: 0,
    };
  }
  if (p >= PROFILE_START) {
    const last = planets()[planets().length - 1] || [0, 0, -76];
    const u = (p - PROFILE_START) / 0.1;
    return {
      cam: [last[0] * 0.08, last[1] + 0.5 + u * 0.4, last[2] - 6 - u * 4],
      look: [0, 0, last[2] - 18],
      fov: 38,
      warp: 0,
    };
  }
  if (p >= CONNECT_START) {
    const last = planets()[planets().length - 1] || [0, 0, -76];
    const u = (p - CONNECT_START) / Math.max(0.001, PROFILE_START - CONNECT_START);
    return {
      cam: [last[0] * 0.12, last[1] + 0.4 + u * 0.2, last[2] + 2.1 - u * 8],
      look: [0, 0, last[2] - 16],
      fov: 40 - u * 2,
      warp: 0.08,
    };
  }

  const { i, t } = projectLocal(p);
  const planet = planets()[i] || planets()[0];
  const fromScene = worldState.warpFrom ?? i;
  const prev = fromScene <= 0 ? [0, 0.2, 12] : lookFrom(planets()[fromScene - 1], 2.35);
  const arrive = lookFrom(planet, 3.15);
  const read = lookFrom(planet, 2.35);
  const stage = projectStage(t);

  if (stage.id === "network") {
    return { cam: prev, look: planet, fov: 46 - stage.u * 2, warp: 0 };
  }
  if (stage.id === "warp") {
    const e = reduced ? stage.u : warpEase(stage.u);
    _from.set(prev[0], prev[1], prev[2]);
    _to.set(arrive[0], arrive[1], arrive[2]);
    _from.lerp(_to, e);
    return { cam: [_from.x, _from.y, _from.z], look: planet, fov: 44 - e * 2, warp: e * 0.28 };
  }
  if (stage.id === "arrive") {
    _from.set(arrive[0], arrive[1], arrive[2]);
    _to.set(read[0], read[1], read[2]);
    _from.lerp(_to, stage.u);
    return { cam: [_from.x, _from.y, _from.z], look: planet, fov: 42 - stage.u, warp: (1 - stage.u) * 0.08 };
  }
  if (stage.id === "read") {
    return { cam: read, look: planet, fov: 41, warp: 0 };
  }
  const nextPlanet = i < planets().length - 1 ? planets()[i + 1] : [0, 0, -94];
  const nextCam = lookFrom(nextPlanet, 5.2);
  _from.set(read[0], read[1], read[2]);
  _to.set(nextCam[0], nextCam[1], nextCam[2]);
  _from.lerp(_to, stage.u);
  return { cam: [_from.x, _from.y, _from.z], look: nextPlanet, fov: 41, warp: stage.u * 0.16 };
}

function lookFrom(planet, dist) {
  return [planet[0] * 0.15, planet[1] + 0.35, planet[2] + dist];
}

function introAmt(p) {
  if (p >= INTRO_END) return 0;
  return 1 - p / INTRO_END;
}

function Rig() {
  const last = useRef(0);
  useFrame(({ camera, clock }, delta) => {
    const p = worldState.progress;
    const tgt = cameraTarget(p);
    _cam.set(tgt.cam[0], tgt.cam[1], tgt.cam[2]);
    _look.set(tgt.look[0], tgt.look[1], tgt.look[2]);
    const warp = tgt.warp;
    if (!worldState.reduced) {
      const sway = 1 - Math.min(1, warp * 1.4);
      _cam.x += worldState.pointerX * 0.35 * sway;
      _cam.y += worldState.pointerY * 0.22 * sway;
      const idle = introAmt(p);
      if (idle > 0.05) {
        const t = clock.elapsedTime;
        _cam.x += Math.sin(t * 0.11) * 0.22 * idle;
        _cam.y += Math.cos(t * 0.08) * 0.12 * idle;
      }
    }
    const follow = worldState.warpBack ? 7.2 : warp > 0.35 ? 4.2 : 2.6;
    const k = 1 - Math.exp(-delta * follow);
    camera.position.lerp(_cam, k);
    camera.lookAt(_look);
    camera.fov += (tgt.fov - camera.fov) * (1 - Math.exp(-delta * 3.4));
    camera.updateProjectionMatrix();
    worldState.warp = warp;
    const spd = Math.abs(p - last.current) / Math.max(delta, 0.0008);
    worldState.velocity = THREE.MathUtils.lerp(worldState.velocity, Math.min(1, spd * 6.5), 0.18);
    last.current = p;
  });
  return null;
}

function applyEffect(i, time, px, py, pz, planet, effect, warp, live) {
  if (!planet || live < 0.12 || worldState.reduced) return { x: px, y: py, z: pz, s: 1, streak: 1 };
  const dx = px - planet[0];
  const dy = py - planet[1];
  const dz = pz - planet[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  let x = px;
  let y = py;
  let z = pz;
  let s = 1;
  let streak = 1;

  if (effect === "infrastructure" && d < 4.4) {
    const ang = time * 0.42 + i * 0.31;
    const r = 1.05 + (i % 6) * 0.22;
    const w = Math.max(0, 1 - d / 4.4);
    x = THREE.MathUtils.lerp(px, planet[0] + Math.cos(ang) * r, w * 0.85);
    y = THREE.MathUtils.lerp(py, planet[1] + Math.sin(ang * 0.7) * 0.18, w * 0.6);
    z = THREE.MathUtils.lerp(pz, planet[2] + Math.sin(ang) * r, w * 0.85);
    s = 1 + w * 0.35;
  } else if (effect === "data-flow") {
    const flow = (time * 0.55 + i * 0.017) % 1;
    const w = Math.max(0, 1 - d / 8);
    x = THREE.MathUtils.lerp(px, planet[0], flow * w * 0.55);
    y = THREE.MathUtils.lerp(py, planet[1], flow * w * 0.55);
    z = THREE.MathUtils.lerp(pz, planet[2], flow * w * 0.55);
    s = 0.75 + (1 - flow) * 0.7 * w;
    streak = 1 + w * 1.8;
  } else if (effect === "neural-recognition") {
    const wave = (Math.sin(time * 1.1 - d * 1.35 + i * 0.04) + 1) * 0.5;
    if (d < 5.2) s = 0.7 + wave * 1.6;
  } else if (effect === "mechanical-pulse") {
    const pulse = Math.pow(Math.max(0, Math.sin(time * 2.1 - d * 0.9)), 8);
    if (d < 5) {
      const kick = pulse * 0.55;
      x += dx * kick * 0.08;
      z += dz * kick * 0.08;
      s = 1 + pulse * (d < 2.2 ? 2.2 : 0.6);
    }
  } else if (effect === "code-stream") {
    const lane = (i % 9) - 4;
    const run = (time * 1.15 + i * 0.03) % 1;
    const w = Math.max(0, 1 - Math.abs(dy) / 3.2);
    x = THREE.MathUtils.lerp(px, planet[0] + lane * 0.22, w * 0.7);
    z = THREE.MathUtils.lerp(pz, planet[2] + (run - 0.5) * 4.5, w * 0.45);
    streak = 1 + w * 3.4;
    s = 0.65 + (1 - Math.abs(run - 0.5) * 2) * 0.5 * w;
  } else if (effect === "network") {
    s = 1 + Math.sin(time * 0.4 + i) * 0.08;
  }

  if (warp > 0.04) {
    z -= warp * 1.8 * ((i % 7) - 3) * 0.08;
    streak *= 1 + warp * 4.8;
  }
  const vel = worldState.velocity || 0;
  streak *= 1 + vel * 3.2;
  return { x, y, z, s, streak };
}

function NeuralField({ count }) {
  const mesh = useRef();
  const lines = useRef();
  const planetList = planets();
  const net = useMemo(() => buildNetwork(count, planetList), [count, planetList.length]);
  const colors = useMemo(() => {
    const c = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      c[i * 3] = goldC.r;
      c[i * 3 + 1] = goldC.g;
      c[i * 3 + 2] = goldC.b;
    }
    return c;
  }, [count]);

  useFrame(({ clock }) => {
    const meshObj = mesh.current;
    if (!meshObj) return;
    const quiet = Math.min(1, Math.max(0, worldState.quiet || (worldState.progress >= PROFILE_START ? 0.85 : 0)));
    const live = 1 - quiet;
    const p = worldState.progress;
    const intro = introAmt(p);
    const breathAmp = worldState.reduced || quiet > 0.6 ? 0 : (0.012 + intro * 0.028) * live;
    const breath = 1 + Math.sin(clock.elapsedTime * (0.35 + intro * 0.12)) * breathAmp;
    const warp = (worldState.warp || 0) * live;
    const idx = projectIndexAt(p);
    const active = idx >= 0 ? planetList[idx] : null;
    const hover = worldState.hoverIndex;
    const highlight = hover >= 0 ? planetList[hover] : active;
    const effectPlanet = worldState.effectIndex >= 0 ? planetList[worldState.effectIndex] : highlight;
    const effect = worldState.effect || "none";
    const t = clock.elapsedTime;
    const connect = p >= CONNECT_START;
    const eventGate = Math.sin(t * 0.21) * Math.sin(t * 0.093 + 1.4);
    const event = eventGate > 0.62 ? (eventGate - 0.62) / 0.38 : 0;

    for (let i = 0; i < count; i++) {
      const o = i * 3;
      let baseX = net.pos[o] * breath;
      let baseY = net.pos[o + 1] * breath;
      let baseZ = net.pos[o + 2] * breath;
      if (intro > 0.04 && !worldState.reduced) {
        baseY += Math.sin(t * 0.48 + baseX * 0.32 + baseZ * 0.11) * 0.11 * intro;
        baseX += Math.cos(t * 0.31 + baseZ * 0.18) * 0.06 * intro;
        const travel = Math.sin(t * 0.38 - baseZ * 0.16 + i * 0.01);
        baseY += event * Math.max(0, travel) * 0.16 * intro;
      }
      const efx = applyEffect(i, t, baseX, baseY, baseZ, connect ? null : effectPlanet, connect ? "network" : effect, warp, live);
      dummy.position.set(efx.x, efx.y, efx.z);
      let s = efx.s;
      if (highlight && live > 0.15) {
        const dx = dummy.position.x - highlight[0];
        const dy = dummy.position.y - highlight[1];
        const dz = dummy.position.z - highlight[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 3.2) s += (1 - d / 3.2) * 1.4 * live;
      }
      if (intro > 0.04 && !worldState.reduced) {
        const spark = Math.pow(Math.max(0, Math.sin(t * 0.27 + i * 0.37)), 16);
        s += spark * 1.8 * intro;
        s += event * Math.max(0, Math.sin(t * 0.38 - dummy.position.z * 0.16)) * 0.9 * intro;
      }
      dummy.scale.set(s, s, s * efx.streak);
      dummy.updateMatrix();
      meshObj.setMatrixAt(i, dummy.matrix);

      if (effect === "data-flow" && !connect) {
        const flow = (t * 0.55 + i * 0.017) % 1;
        tint.lerpColors(goldC, cyanC, 0.28 * flow * live);
      } else {
        tint.copy(goldC);
      }
      meshObj.setColorAt(i, tint);
    }
    meshObj.instanceMatrix.needsUpdate = true;
    if (meshObj.instanceColor) meshObj.instanceColor.needsUpdate = true;
    if (lines.current) {
      const pulse = quiet > 0.85 ? 0 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.45 * Math.max(0.15, live));
      const introPulse = intro * (0.05 + 0.08 * pulse + event * 0.1);
      lines.current.material.opacity = 0.05 + 0.08 * pulse * live + warp * 0.16 + (worldState.velocity || 0) * 0.08 + introPulse;
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[ico, nodeMat, count]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      </instancedMesh>
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
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = worldState.progress;
    const idx = projectIndexAt(p);
    const { t } = projectLocal(p);
    const stage = idx >= 0 ? projectStage(t).id : "";
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.05) * 0.08;
    group.current.children.forEach((child, i) => {
      const on = idx === i && (stage === "warp" || stage === "arrive" || stage === "read");
      const leave = idx === i && stage === "leave";
      const connect = p >= CONNECT_START;
      const hover = worldState.hoverIndex === i;
      const target = connect ? 0.62 : on ? 1 : hover ? 0.72 : 0.28;
      const scale = leave ? 1 - projectStage(t).u * 0.35 : target;
      child.scale.setScalar(THREE.MathUtils.lerp(child.scale.x, Math.max(0.12, scale), 0.07));
      const ring = child.children[2];
      if (!ring) return;
      const effect = JOURNEY_PROJECTS[i]?.effect;
      const show = connect || on || hover;
      ring.visible = show && (effect === "infrastructure" || effect === "mechanical-pulse");
      ring.rotation.z = clock.elapsedTime * (effect === "infrastructure" ? 0.18 : 0.55);
      if (effect === "mechanical-pulse" && on) {
        ring.scale.setScalar(pulse);
      } else {
        ring.scale.setScalar(1);
      }
      ring.material.opacity = effect === "mechanical-pulse" && on ? 0.12 + (pulse - 1) * 2 : 0.2;
    });
  });
  return (
    <group ref={group}>
      {planets().map((pos, i) => (
        <group key={(liveProjects()[i] || JOURNEY_PROJECTS[i])?.id || i} position={pos}>
          <mesh geometry={sph} material={planetMat} scale={0.82} />
          <mesh geometry={sph} material={atmoMat} scale={1.12} />
          <mesh geometry={torus} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <meshBasicMaterial color={GOLD} transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StarField({ count }) {
  const points = useRef();
  const colorAttr = useRef();
  const { pos, phase, mix } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const mix = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const far = i % 5 === 0;
      pos[i * 3] = (Math.random() - 0.5) * (far ? 56 : 36);
      pos[i * 3 + 1] = (Math.random() - 0.5) * (far ? 32 : 20);
      pos[i * 3 + 2] = -6 - Math.random() * (far ? 88 : 52);
      phase[i] = Math.random() * Math.PI * 2;
      mix[i] = Math.random();
    }
    return { pos, phase, mix };
  }, [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame(({ clock }) => {
    const attr = colorAttr.current;
    if (!attr) return;
    const t = clock.elapsedTime;
    const intro = Math.max(0.22, introAmt(worldState.progress));
    const hush = worldState.reduced ? 0.35 : 1;
    const eventGate = Math.sin(t * 0.19) * Math.sin(t * 0.077 + 0.8);
    const event = eventGate > 0.68 ? (eventGate - 0.68) / 0.32 : 0;
    for (let i = 0; i < count; i++) {
      const a = Math.sin(t * (0.33 + (i % 7) * 0.05) + phase[i]);
      const b = Math.sin(t * 0.16 + phase[i] * 1.9);
      const product = a * b;
      const flash = product > 0.86 ? Math.pow((product - 0.86) / 0.14, 1.6) : 0;
      const glow = 0.14 + 0.1 * (a * 0.5 + 0.5);
      const travel = Math.max(0, Math.sin(t * 0.34 - pos[i * 3 + 2] * 0.12 + phase[i]));
      const bright = (glow + flash * 0.95 + event * travel * 0.55) * intro * hush;
      tint.lerpColors(goldC, cyanC, mix[i] * 0.35);
      colors[i * 3] = tint.r * bright;
      colors[i * 3 + 1] = tint.g * bright;
      colors[i * 3 + 2] = tint.b * bright;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute ref={colorAttr} attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={worldState.mobile ? 0.055 : 0.07}
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function Scene({ count }) {
  return (
    <>
      <AdaptiveDpr />
      <color attach="background" args={["#050506"]} />
      <fog attach="fog" args={["#050506", 10, 48]} />
      <ambientLight intensity={0.32} />
      <pointLight position={[4, 6, 8]} intensity={8} color={GOLD} />
      <Rig />
      <StarField count={worldState.mobile ? 140 : 260} />
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
      camera={{ position: [0, 0.2, 22], fov: 45, near: 0.1, far: 120 }}
    >
      <Scene count={count} />
    </Canvas>
  );
}
