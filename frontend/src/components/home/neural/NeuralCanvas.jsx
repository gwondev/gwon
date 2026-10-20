/**
 * Neural core + seven destination worlds.
 * Worlds are procedural shaders/geometry — not NASA scans.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  INTRO_END,
  journeyCount,
  makePlanetPos,
  projectIndexAt,
  projectLocal,
  projectStage,
  warpEase,
} from "../../../lib/journey.js";
import { worldState } from "../worldState.js";
import { buildNetwork } from "./network.js";
import Worlds from "./Worlds.jsx";

const GOLD = "#d8c19a";
const CYAN = "#9bb8c4";
const ico = new THREE.IcosahedronGeometry(0.022, 0);
const nodeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.82, depthWrite: false });
const lineMat = new THREE.LineBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.14,
  blending: THREE.AdditiveBlending,
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

function dests() {
  return worldState.planets?.length ? worldState.planets : makePlanetPos(journeyCount());
}

function attractors() {
  return [[0, 0.08, -5], ...dests()];
}

function cameraTarget(p) {
  const reduced = worldState.reduced;
  if (p < INTRO_END) {
    const u = p / INTRO_END;
    return {
      cam: [0.15, 0.55, 12.6 - u * 0.85],
      look: [0, -0.08, 3.4],
      fov: 34,
      warp: 0,
    };
  }
  const { i, t } = projectLocal(p);
  const planet = dests()[i] || dests()[0];
  const fromScene = worldState.warpFrom ?? i;
  const prevPlanet = fromScene > 0 ? dests()[fromScene - 1] : null;
  const prev = prevPlanet ? lookFrom(prevPlanet, 3.4) : [0, 0.18, 11];
  const arrive = lookFrom(planet, 4.6);
  const read = lookFrom(planet, 3.2);
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
  const nextPlanet = i < dests().length - 1 ? dests()[i + 1] : [0, 0, -200];
  const nextCam = lookFrom(nextPlanet, 7.2);
  _from.set(read[0], read[1], read[2]);
  _to.set(nextCam[0], nextCam[1], nextCam[2]);
  _from.lerp(_to, stage.u);
  return { cam: [_from.x, _from.y, _from.z], look: nextPlanet, fov: 41, warp: stage.u * 0.16 };
}

function lookFrom(planet, dist) {
  if (!planet) return [0, 0.2, 12];
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
  const planetList = dests();
  const net = useMemo(() => buildNetwork(count, attractors()), [count, planetList.length]);
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
    const quiet = Math.min(1, Math.max(0, worldState.quiet || 0));
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
    const connect = false;
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
      const veil = 1 - intro * 0.96;
      dummy.scale.set(s * veil, s * veil, s * efx.streak * veil);
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
      const veil = 1 - intro * 0.96;
      lines.current.material.opacity = (0.05 + 0.08 * pulse * live + warp * 0.16 + (worldState.velocity || 0) * 0.08 + introPulse) * veil;
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

function Gargantua() {
  const { scene } = useGLTF("/assets/blackhole/Blackhole.glb");
  const root = useRef();
  const body = useRef();
  const spin = useRef();
  const stars = useMemo(() => {
    const pos = new Float32Array(520 * 3);
    for (let i = 0; i < 520; i++) {
      const r = 3.5 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.42) * r * 0.72;
      pos[i * 3 + 2] = -8 - Math.random() * 54;
    }
    return pos;
  }, []);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.fog = false;
        mat.toneMapped = true;
        mat.side = THREE.DoubleSide;
        mat.depthWrite = true;
        if (mat.transparent && mat.opacity >= 1) mat.transparent = false;
        if (obj.name === "Blackhole_core_Blackhole_core_0") {
          const horizon = mat.clone();
          horizon.depthTest = false;
          horizon.depthWrite = false;
          horizon.fog = false;
          obj.material = horizon;
          obj.renderOrder = 3;
          if (!obj.userData.horizonScaled) {
            obj.scale.multiplyScalar(1.35);
            obj.userData.horizonScaled = true;
          }
        }
        if (mat.emissiveMap) mat.emissiveIntensity = 1.35;
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    const intro = introAmt(worldState.progress);
    const shown = intro > 0.04;
    if (root.current) root.current.visible = shown;
    if (body.current) {
      const s = 1.35 * Math.min(1.05, intro / 0.75);
      body.current.scale.setScalar(Math.max(s, 0.0001));
    }
    if (spin.current && shown && !worldState.reduced) spin.current.rotation.z += delta * 0.045;
  });

  return (
    <group ref={root}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#e4dfd4"
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.88}
          depthWrite={false}
        />
      </points>
      <group ref={body} position={[0, -0.02, 3.2]} rotation={[1.42, 0.04, 0]} scale={1.35}>
        <group ref={spin}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/assets/blackhole/Blackhole.glb");

function Scene({ count }) {
  return (
    <>
      <AdaptiveDpr />
      <color attach="background" args={["#030308"]} />
      <fog attach="fog" args={["#030308", 14, 72]} />
      <ambientLight intensity={0.22} />
      <pointLight position={[5, 8, 10]} intensity={12} color={GOLD} />
      <pointLight position={[-6, -2, -20]} intensity={6} color={CYAN} />
      <Rig />
      <StarField count={worldState.mobile ? 180 : 420} />
      <NeuralField count={count} />
      <Gargantua />
      <Worlds />
    </>
  );
}

export default function NeuralCanvas() {
  const count = worldState.mobile ? 220 : 720;
  return (
    <Canvas
      className="world-canvas"
      dpr={[1, worldState.mobile ? 1.1 : 1.6]}
      gl={{ antialias: !worldState.mobile, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0.18, 16], fov: 42, near: 0.08, far: 280 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene count={count} />
    </Canvas>
  );
}
