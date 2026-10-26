import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * SYSTEMS — 회로 도시.
 * 서버 타워가 회로 기판 같은 바닥 위에 서 있고, 거리(버스 라인)를 따라 데이터 패킷이 달린다.
 * 기술 항목 하나가 신호등을 단 코어 타워 하나다.
 */
const GRID = 13;
const CELL = 2.1;

const TOWER_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aCore;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying float vSeed;
  varying float vCore;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vLocal = position;
    vSeed = aSeed;
    vCore = aCore;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const TOWER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  uniform float uFocus;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying float vSeed;
  varying float vCore;
  varying vec3 vNormal;
  void main() {
    float rise = smoothstep(vSeed * 0.6, vSeed * 0.6 + 0.4, uEnter);
    if (vWorld.y > 14.0 * rise + 0.05) discard;
    float top = step(0.98, vNormal.y);
    float side = 1.0 - top;
    float band = abs(fract(vWorld.y * 3.0 + vSeed) - 0.5);
    float stripe = smoothstep(0.035, 0.0, band - 0.46) * side;
    float row = floor(vWorld.y * 3.0 + vSeed);
    float col2 = floor((vLocal.x + vLocal.z) * 6.0);
    float flick = step(0.72, fract(sin(row * 12.9 + col2 * 4.1 + vSeed * 78.2) * 43758.5));
    float scan = smoothstep(0.0, 0.12, fract(uTime * 0.1 + vSeed) - fract(vWorld.y * 0.05));
    vec2 e = abs(vLocal.xz);
    float edge = smoothstep(0.46, 0.5, min(e.x, e.y)) * side;
    float isFocus = 1.0 - step(0.5, abs(vCore - uFocus));
    vec3 glass = vec3(0.012, 0.02, 0.028) + vec3(0.02, 0.035, 0.045) * (0.4 + 0.6 * max(0.0, dot(vNormal, normalize(vec3(0.5, 0.4, 0.8)))));
    vec3 tint = mix(uColor, uAccent, vSeed);
    vec3 lit = tint * stripe * flick * (0.22 + 0.4 * scan);
    vec3 rim = tint * edge * (vCore >= 0.0 ? 0.55 : 0.18);
    vec3 cap = tint * top * (vCore >= 0.0 ? 0.8 : 0.12);
    vec3 col = glass + lit * (vCore >= 0.0 ? 1.1 : 0.55) + rim + cap + tint * isFocus * (0.12 + edge * 0.6);
    float fog = exp(-length(vWorld.xz) * 0.05);
    gl_FragColor = vec4(col * (0.25 + 0.75 * fog), 1.0);
  }
`;

const GROUND_VERT = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  uniform vec3 uColor;
  varying vec2 vXZ;
  float line(float x, float w) {
    float d = 0.5 - abs(fract(x) - 0.5);
    float aa = fwidth(x) * 1.2;
    return 1.0 - smoothstep(w, w + aa, d);
  }
  void main() {
    vec2 g = vXZ / ${CELL.toFixed(2)};
    float minor = max(line(g.x + 0.5, 0.01), line(g.y + 0.5, 0.01)) * 0.12;
    float major = max(line(g.x / 3.0, 0.006), line(g.y / 3.0, 0.006));
    float d = length(vXZ);
    float wave = smoothstep(1.4, 0.0, abs(d - mod(uTime * 6.0, 60.0)));
    float reveal = smoothstep(uEnter * 46.0 + 2.0, uEnter * 46.0 - 4.0, d);
    float fade = exp(-d * 0.06);
    vec3 base = vec3(0.006, 0.012, 0.014);
    vec3 col = base + uColor * (minor + major * (0.28 + wave * 0.9)) * fade * reveal;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PACKET_VERT = /* glsl */ `
  attribute float aLane;
  attribute float aAxis;
  attribute float aSpeed;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float span = ${(GRID * CELL).toFixed(2)};
    float s = fract(aSeed + uTime * aSpeed / span) * span - span * 0.5;
    vec3 p = aAxis < 0.5 ? vec3(s, 0.12, aLane) : vec3(aLane, 0.12, s);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(uColor, uAccent, aSeed);
    vAlpha = uEnter * smoothstep(span * 0.5, span * 0.3, abs(s));
    gl_PointSize = (2.0 + aSeed * 2.5) * uPixel * (40.0 / -mv.z);
  }
`;

function buildCity(coreCount, mobile) {
  const r = rng(91);
  const towers = [];
  const half = (GRID - 1) / 2;
  for (let x = 0; x < GRID; x++) {
    for (let z = 0; z < GRID; z++) {
      if (x % 3 === 1 || z % 3 === 1) continue;
      if (mobile && r() < 0.25) continue;
      const px = (x - half) * CELL;
      const pz = (z - half) * CELL;
      const d = Math.hypot(px, pz) / (half * CELL);
      const h = 0.6 + Math.pow(r(), 1.8) * 7 * (1.2 - d) + (d < 0.35 ? 2.5 : 0);
      towers.push({ x: px, z: pz, h: Math.max(0.4, h), w: 0.7 + r() * 0.75, seed: r(), core: -1, d });
    }
  }
  const byCenter = [...towers].sort((a, b) => a.d - b.d);
  const picks = [];
  for (const t of byCenter) {
    if (picks.length >= coreCount) break;
    if (picks.every((p) => Math.hypot(p.x - t.x, p.z - t.z) > CELL * 2.2)) picks.push(t);
  }
  picks.forEach((t, i) => {
    t.core = i;
    t.h = Math.max(t.h, 6.5 + r() * 3);
    t.w = Math.max(t.w, 1.15);
  });
  return { towers, cores: picks };
}

export default function InfraWorld({ items }) {
  const group = useRef(null);
  const mesh = useRef(null);
  const beacons = useRef([]);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const coreCount = Math.max(1, Math.min(8, items.length));
  const city = useMemo(() => buildCity(coreCount, mobile), [coreCount, mobile]);
  const color = useMemo(() => new THREE.Color("#7ff0cf"), []);
  const accent = useMemo(() => new THREE.Color("#4fa8ff"), []);

  const towerGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const seeds = new Float32Array(city.towers.length);
    const cores = new Float32Array(city.towers.length);
    city.towers.forEach((t, i) => {
      seeds[i] = t.seed;
      cores[i] = t.core;
    });
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    g.setAttribute("aCore", new THREE.InstancedBufferAttribute(cores, 1));
    return g;
  }, [city]);

  const towerMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: TOWER_VERT,
        fragmentShader: TOWER_FRAG,
        uniforms: { uTime: { value: 0 }, uEnter: { value: 1 }, uFocus: { value: -1 }, uColor: { value: color }, uAccent: { value: accent } },
      }),
    [color, accent]
  );
  const groundMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
        uniforms: { uTime: { value: 0 }, uEnter: { value: 1 }, uColor: { value: color } },
      }),
    [color]
  );

  const packets = useMemo(() => {
    const n = mobile ? 140 : 380;
    const r = rng(17);
    const half = (GRID - 1) / 2;
    const lanes = [];
    for (let i = 0; i < GRID; i++) if (i % 3 === 1) lanes.push((i - half) * CELL);
    const lane = new Float32Array(n);
    const axis = new Float32Array(n);
    const speed = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      lane[i] = lanes[Math.floor(r() * lanes.length)] + (r() - 0.5) * 0.5;
      axis[i] = r() < 0.5 ? 0 : 1;
      speed[i] = (2 + r() * 6) * (r() < 0.5 ? 1 : -1);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aLane", new THREE.BufferAttribute(lane, 1));
    g.setAttribute("aAxis", new THREE.BufferAttribute(axis, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: PACKET_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 }, uColor: { value: color }, uAccent: { value: accent } },
    });
    return { g, m };
  }, [mobile, color, accent]);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    city.towers.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.w, t.h, t.w));
      mesh.current.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [city]);

  useEffect(
    () => () => {
      towerGeo.dispose();
      packets.g.dispose();
      packets.m.dispose();
    },
    [towerGeo, packets]
  );

  const focusPoint = useMemo(() => new THREE.Vector3(), []);

  useSectionFrame("infrastructure", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.25 : 1);
    const target = live.focus >= 0 && live.focus < city.cores.length ? live.focus : -1;
    towerMat.uniforms.uTime.value = t;
    towerMat.uniforms.uEnter.value = p.enter;
    towerMat.uniforms.uFocus.value = target;
    groundMat.uniforms.uTime.value = t;
    groundMat.uniforms.uEnter.value = p.enter;
    packets.m.uniforms.uTime.value = t;
    packets.m.uniforms.uEnter.value = p.enter;
    packets.m.uniforms.uPixel.value = dpr;
    beacons.current.forEach((b, i) => {
      if (!b) return;
      const on = target === i;
      b.material.opacity = (0.35 + 0.25 * Math.sin(t * 2.5 + i)) * (on ? 2 : 1) * p.enter;
      b.scale.set(on ? 1.6 : 0.9, on ? 30 : 18, 1);
    });
    group.current.rotation.y = t * 0.012;
    if (target >= 0) {
      const c = city.cores[target];
      focusPoint.set(c.x, c.h * 0.6, c.z).applyMatrix4(group.current.matrixWorld);
    }
    publishFocus(p.settled, target >= 0 ? focusPoint : null);
  });

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} material={groundMat}>
        <planeGeometry args={[120, 120]} />
      </mesh>
      <instancedMesh ref={mesh} args={[towerGeo, towerMat, city.towers.length]} frustumCulled={false} />
      <points geometry={packets.g} material={packets.m} frustumCulled={false} />
      {city.cores.map((c, i) => (
        <sprite key={i} position={[c.x, c.h + 0.1, c.z]} ref={(el) => (beacons.current[i] = el)} center={[0.5, 0]}>
          <spriteMaterial map={glowTexture()} color="#9ff5dc" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
