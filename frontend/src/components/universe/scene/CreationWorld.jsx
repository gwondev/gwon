import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * AWARDS — 창조의 장.
 * 한 점에서 빛의 필라멘트가 뻗어 나가 자라고, 충격파 고리가 주기적으로 퍼진다.
 * 먼지는 바깥으로 팽창하고, 수상 항목 하나가 필라멘트 끝에서 맺힌 결정 하나다.
 */
const FIL_VERT = /* glsl */ `
  attribute float aU;
  attribute float aSeed;
  varying float vU;
  varying float vSeed;
  void main() {
    vU = aU;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FIL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying float vU;
  varying float vSeed;
  void main() {
    float cycle = fract(uTime * (0.06 + vSeed * 0.05) + vSeed);
    float grow = min(uEnter * 1.2, smoothstep(0.0, 0.7, cycle) * 1.1);
    if (vU > grow) discard;
    float tip = exp(-pow((grow - vU) * 14.0, 2.0));
    float fade = 1.0 - smoothstep(0.75, 1.0, cycle);
    vec3 col = mix(uAccent, uColor, vU);
    float a = (0.12 + tip * 0.9) * fade * (1.0 - vU * 0.5);
    gl_FragColor = vec4(col * (1.0 + tip * 2.0), a);
  }
`;
const DUST_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = mod(aSeed * 14.0 + uTime * (0.25 + aSeed * 0.5), 14.0);
    vec3 p = aDir * r * (0.4 + 0.6 * uEnter);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(uColor, uAccent, smoothstep(2.0, 12.0, r));
    vAlpha = smoothstep(0.0, 1.5, r) * smoothstep(14.0, 9.0, r) * uEnter * 0.8;
    gl_PointSize = (1.0 + aSeed * 2.0) * uPixel * (40.0 / -mv.z);
  }
`;

const CRYSTAL_COLORS = ["#ffe0a0", "#ff9fcf", "#a8d8ff", "#ffc0e8", "#fff0c8", "#c8b0ff", "#ffd0a0", "#a0f0e0"];

function buildFilaments(n, crystals) {
  const r = rng(99);
  const seg = 28;
  const pos = [];
  const u = [];
  const seed = [];
  const v = new THREE.Vector3();
  const p = new THREE.Vector3();
  const curl = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    const aim = f < crystals.length ? crystals[f].clone().normalize() : v.set(r() - 0.5, (r() - 0.5) * 0.8, r() - 0.5).normalize().clone();
    const len = f < crystals.length ? crystals[f].length() : 4 + r() * 6;
    curl.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.8);
    const s = r();
    let prev = new THREE.Vector3();
    for (let i = 1; i <= seg; i++) {
      const t = i / seg;
      p.copy(aim).multiplyScalar(len * t);
      p.addScaledVector(curl, Math.sin(t * Math.PI) * (f < crystals.length ? 0.4 : 1));
      pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      u.push((i - 1) / seg, t);
      seed.push(s, s);
      prev = p.clone();
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aU", new THREE.BufferAttribute(new Float32Array(u), 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));
  return g;
}

export default function CreationWorld({ count }) {
  const group = useRef(null);
  const core = useRef(null);
  const shocks = useRef([]);
  const gems = useRef([]);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const k = Math.max(3, Math.min(8, count));
  const color = useMemo(() => new THREE.Color("#ffe0a0"), []);
  const accent = useMemo(() => new THREE.Color("#ff7ab8"), []);

  const crystals = useMemo(() => {
    const r = rng(5 + k);
    return Array.from({ length: k }, (_, i) => {
      const a = (i / k) * Math.PI * 2 + 0.4;
      return new THREE.Vector3(Math.cos(a) * 5.6, Math.sin(a) * 3.4 + (r() - 0.5) * 0.8, (r() - 0.5) * 3);
    });
  }, [k]);

  const filaments = useMemo(() => {
    const g = buildFilaments(mobile ? 90 : 230, crystals);
    const m = new THREE.ShaderMaterial({
      vertexShader: FIL_VERT,
      fragmentShader: FIL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uEnter: { value: 1 }, uColor: { value: color }, uAccent: { value: accent } },
    });
    return { g, m };
  }, [mobile, crystals, color, accent]);

  const dust = useMemo(() => {
    const n = mobile ? 1200 : 3200;
    const r = rng(31);
    const dir = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize();
      v.toArray(dir, i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 }, uColor: { value: color }, uAccent: { value: accent } },
    });
    return { g, m };
  }, [mobile, color, accent]);

  useEffect(
    () => () => {
      filaments.g.dispose();
      filaments.m.dispose();
      dust.g.dispose();
      dust.m.dispose();
    },
    [filaments, dust]
  );

  const focusPoint = useMemo(() => new THREE.Vector3(), []);

  useSectionFrame("awards", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.2 : 1);
    const target = live.focus >= 0 && live.focus < k ? live.focus : -1;
    filaments.m.uniforms.uTime.value = t;
    filaments.m.uniforms.uEnter.value = p.enter;
    dust.m.uniforms.uTime.value = t;
    dust.m.uniforms.uEnter.value = p.enter;
    dust.m.uniforms.uPixel.value = dpr;
    const beat = 0.5 + 0.5 * Math.sin(t * 1.7);
    core.current.scale.setScalar((2.2 + beat * 0.8) * (0.4 + 0.6 * p.enter));
    shocks.current.forEach((s, i) => {
      if (!s) return;
      const c = (t * 0.22 + i / 3) % 1;
      s.scale.setScalar(0.5 + c * 12);
      s.material.opacity = (1 - c) * (1 - c) * 0.22 * p.enter;
    });
    gems.current.forEach((g, i) => {
      if (!g) return;
      const on = target === i;
      g.rotation.y = t * 0.8 + i;
      g.rotation.x = t * 0.4;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, (on ? 1.6 : 1) * p.enter, 0.1));
    });
    group.current.rotation.y = Math.sin(t * 0.07) * 0.25;
    if (target >= 0) focusPoint.copy(crystals[target]).applyMatrix4(group.current.matrixWorld);
    publishFocus(p.settled, target >= 0 ? focusPoint : null);
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.3} />
      <pointLight intensity={50} distance={30} color="#ffd8b0" />
      <sprite ref={core}>
        <spriteMaterial map={glowTexture()} color="#fff4e0" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[10, 10, 1]}>
        <spriteMaterial map={glowTexture()} color="#ff7ab8" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <lineSegments geometry={filaments.g} material={filaments.m} frustumCulled={false} />
      <points geometry={dust.g} material={dust.m} frustumCulled={false} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (shocks.current[i] = el)} rotation={[Math.PI / 2 + i * 0.35, i * 0.6, 0]}>
          <ringGeometry args={[0.988, 1, 128]} />
          <meshBasicMaterial color="#ffd0e8" transparent side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {crystals.map((c, i) => (
        <group key={i} position={c} ref={(el) => (gems.current[i] = el)}>
          <mesh>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color={CRYSTAL_COLORS[i % CRYSTAL_COLORS.length]} emissive={CRYSTAL_COLORS[i % CRYSTAL_COLORS.length]} emissiveIntensity={0.45} roughness={0.15} metalness={0.4} flatShading />
          </mesh>
          <mesh scale={1.35}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshBasicMaterial color={CRYSTAL_COLORS[i % CRYSTAL_COLORS.length]} wireframe transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <sprite scale={[1.8, 1.8, 1]}>
            <spriteMaterial map={glowTexture()} color={CRYSTAL_COLORS[i % CRYSTAL_COLORS.length]} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
