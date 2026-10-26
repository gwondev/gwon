import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { NOISE_GLSL, POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * CAREER — 시간의 궤도.
 * 가운데 항성을 감싸며 올라가는 나선이 시간축이다. 빛 입자가 나선을 따라 위로 흐르고,
 * 경력 항목 하나가 나선 위 행성 하나다. 바깥 고리에는 시계 눈금이 새겨져 있다.
 */
const TURNS = 2.25;
const RADIUS = 6.2;
const BOTTOM = -4.6;
const TOP = 4.6;

function helixPoint(u, out) {
  const a = u * TURNS * Math.PI * 2;
  return out.set(Math.cos(a) * RADIUS, THREE.MathUtils.lerp(BOTTOM, TOP, u), Math.sin(a) * RADIUS);
}

const STAR_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vView;
  void main() {
    vN = normalize(normalMatrix * normal);
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const STAR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vView;
  ${NOISE_GLSL}
  void main() {
    vec2 sp = vec2(atan(vP.z, vP.x) * 2.0, vP.y * 2.5);
    float g = fbm(sp * 3.0 + uTime * 0.08);
    float cells = fbm(sp * 9.0 - uTime * 0.15);
    float limb = pow(max(0.0, dot(vN, vView)), 0.45);
    vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.9, 0.62), g * 0.8 + cells * 0.35) * (0.5 + limb * 0.9);
    gl_FragColor = vec4(col * (1.4 + 0.3 * uEnter), 1.0);
  }
`;

const HELIX_VERT = /* glsl */ `
  attribute float aU;
  varying float vU;
  void main() {
    vU = aU;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const HELIX_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  uniform vec3 uColor;
  varying float vU;
  void main() {
    float drawn = smoothstep(uEnter * 1.05, uEnter * 1.05 - 0.05, vU);
    float flow = pow(0.5 + 0.5 * sin((vU * 48.0 - uTime * 1.6)), 6.0);
    float a = (0.16 + flow * 0.55) * drawn;
    gl_FragColor = vec4(uColor * (1.0 + flow), a);
  }
`;

const FLOW_VERT = /* glsl */ `
  attribute float aU;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float u = fract(aU + uTime * (0.012 + aSeed * 0.01));
    float a = u * ${TURNS.toFixed(2)} * 6.28318;
    float r = ${RADIUS.toFixed(2)} + (aSeed - 0.5) * 0.9;
    vec3 p = vec3(cos(a) * r, mix(${BOTTOM.toFixed(2)}, ${TOP.toFixed(2)}, u) + (fract(aSeed * 7.0) - 0.5) * 0.5, sin(a) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(uColor, uAccent, aSeed);
    vAlpha = uEnter * smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
    gl_PointSize = (1.5 + aSeed * 2.5) * uPixel * (40.0 / -mv.z);
  }
`;

const PLANET_COLORS = ["#ffd98a", "#8fb4ff", "#ffb48a", "#b8f0ff", "#e8b8ff", "#a8ffcf", "#ffe2b0", "#9fc8ff"];

export default function TimeWorld({ count }) {
  const group = useRef(null);
  const planets = useRef([]);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const k = Math.max(3, Math.min(8, count));
  const color = useMemo(() => new THREE.Color("#ffd98a"), []);
  const accent = useMemo(() => new THREE.Color("#6f8dff"), []);

  const helix = useMemo(() => {
    const n = 600;
    const pos = new Float32Array(n * 3);
    const u = new Float32Array(n);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      u[i] = i / (n - 1);
      helixPoint(u[i], v).toArray(pos, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: HELIX_VERT,
      fragmentShader: HELIX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uEnter: { value: 1 }, uColor: { value: color } },
    });
    return { g, m };
  }, [color]);

  const flow = useMemo(() => {
    const n = mobile ? 700 : 1800;
    const r = rng(23);
    const u = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      u[i] = r();
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 }, uColor: { value: color }, uAccent: { value: accent } },
    });
    return { g, m };
  }, [mobile, color, accent]);

  const dial = useMemo(() => {
    const ticks = [];
    const R = 9.2;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const len = i % 10 === 0 ? 0.55 : i % 5 === 0 ? 0.32 : 0.14;
      ticks.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R), new THREE.Vector3(Math.cos(a) * (R + len), 0, Math.sin(a) * (R + len)));
    }
    return new THREE.BufferGeometry().setFromPoints(ticks);
  }, []);

  const starMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uEnter: { value: 1 } } }),
    []
  );

  const markers = useMemo(() => {
    const v = new THREE.Vector3();
    return Array.from({ length: k }, (_, i) => helixPoint((i + 0.5) / k, v).clone());
  }, [k]);

  useEffect(
    () => () => {
      helix.g.dispose();
      helix.m.dispose();
      flow.g.dispose();
      flow.m.dispose();
      dial.dispose();
    },
    [helix, flow, dial]
  );

  const focusPoint = useMemo(() => new THREE.Vector3(), []);

  useSectionFrame("career", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.2 : 1);
    const target = live.focus >= 0 && live.focus < k ? live.focus : -1;
    helix.m.uniforms.uTime.value = t;
    helix.m.uniforms.uEnter.value = p.enter;
    flow.m.uniforms.uTime.value = t;
    flow.m.uniforms.uEnter.value = p.enter;
    flow.m.uniforms.uPixel.value = dpr;
    starMat.uniforms.uTime.value = t;
    starMat.uniforms.uEnter.value = p.enter;
    planets.current.forEach((pl, i) => {
      if (!pl) return;
      const on = target === i;
      pl.scale.setScalar(THREE.MathUtils.lerp(pl.scale.x, (on ? 1.5 : 1) * p.enter, 0.12));
      pl.rotation.y = t * 0.6;
    });
    group.current.rotation.y = t * 0.03;
    if (target >= 0) focusPoint.copy(markers[target]).applyMatrix4(group.current.matrixWorld);
    publishFocus(p.settled, target >= 0 ? focusPoint : null);
  });

  return (
    <group ref={group}>
      <mesh material={starMat}>
        <sphereGeometry args={[1.35, 64, 48]} />
      </mesh>
      <sprite scale={[7, 7, 1]}>
        <spriteMaterial map={glowTexture()} color="#ffb060" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[16, 16, 1]}>
        <spriteMaterial map={glowTexture()} color="#ff8040" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight intensity={60} distance={40} color="#ffcf8a" />
      <ambientLight intensity={0.12} />
      <line geometry={helix.g} material={helix.m} frustumCulled={false} />
      <points geometry={flow.g} material={flow.m} frustumCulled={false} />
      <lineSegments geometry={dial}>
        <lineBasicMaterial color="#ffd98a" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      {[3.2, 4.6].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[r, r + 0.015, 128]} />
          <meshBasicMaterial color="#8fa8ff" transparent opacity={0.25} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {markers.map((m, i) => (
        <group key={i} position={m} ref={(el) => (planets.current[i] = el)}>
          <mesh>
            <sphereGeometry args={[0.32, 32, 24]} />
            <meshStandardMaterial color={PLANET_COLORS[i % PLANET_COLORS.length]} emissive={PLANET_COLORS[i % PLANET_COLORS.length]} emissiveIntensity={0.25} roughness={0.55} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2 + 0.35}>
            <ringGeometry args={[0.55, 0.58, 64]} />
            <meshBasicMaterial color={PLANET_COLORS[i % PLANET_COLORS.length]} transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <sprite scale={[1.6, 1.6, 1]}>
            <spriteMaterial map={glowTexture()} color={PLANET_COLORS[i % PLANET_COLORS.length]} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
