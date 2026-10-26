import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { NOISE_GLSL, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * EXPERIENCE — 살아있는 환경.
 * 사람은 빛 입자로 된 몸이다. 뼈대(골반·척추·팔다리·머리)를 GPU 에서 보행 주기로 계산하고,
 * 입자는 각 뼈 둘레에 붙어 함께 움직인다. 걷는 사람·뛰는 사람·모여서 이야기하는 사람이 있고,
 * 하늘은 새벽에서 해질녘으로 천천히 바뀐다. 경험 항목 하나가 사람들이 모인 자리 하나다.
 */
const SEGMENTS = [
  // [jointA, jointB, radius, weight]
  [0, 1, 0.13, 3.2], // spine
  [2, 2, 0.11, 1.6], // head
  [3, 4, 0.05, 0.6], // shoulders
  [3, 5, 0.045, 0.9], // upper arm L
  [5, 6, 0.04, 0.8], // forearm L
  [4, 7, 0.045, 0.9], // upper arm R
  [7, 8, 0.04, 0.8], // forearm R
  [9, 10, 0.08, 0.5], // hips
  [9, 11, 0.065, 1.4], // thigh L
  [11, 12, 0.05, 1.2], // shin L
  [10, 13, 0.065, 1.4], // thigh R
  [13, 14, 0.05, 1.2], // shin R
];

const FIGURE_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute vec4 aOrigin;   // x, z, heading, pathLen
  attribute vec4 aMotion;   // speed, offset, mode(0 walk 1 run 2 talk), seed
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 limb(float a, float len) { return vec3(0.0, -cos(a), sin(a)) * len; }

  void main() {
    float seg = position.x;
    float along = position.y;
    float rf = position.z;
    float mode = aMotion.z;
    float seed = aMotion.w;
    float speed = aMotion.x;
    float pathLen = aOrigin.w;

    float travel = 0.0;
    float edge = 1.0;
    float ph;
    if (mode < 1.5) {
      float d = mod(uTime * speed + aMotion.y, pathLen);
      travel = d - pathLen * 0.5;
      edge = smoothstep(0.0, 3.0, d) * smoothstep(pathLen, pathLen - 3.0, d);
      ph = d / (mode < 0.5 ? 1.35 : 2.3) * 6.28318;
    } else {
      ph = uTime * 1.6 + seed * 20.0;
    }

    float s = sin(ph);
    float c = cos(ph);
    float run = step(0.5, mode) * (1.0 - step(1.5, mode));
    float talk = step(1.5, mode);
    float amp = mix(1.0, 1.6, run) * (1.0 - talk);
    float lean = run * 0.18;

    vec3 pelvis = vec3(0.0, 0.95 + (0.035 + run * 0.04) * cos(ph * 2.0) * (1.0 - talk), 0.0);
    vec3 neck = pelvis + vec3(sin(talk * sin(uTime * 0.7 + seed * 9.0) * 0.08) * 0.1, 0.5 * cos(lean), 0.5 * sin(lean));
    vec3 head = neck + vec3(0.0, 0.17, 0.02 + talk * 0.03 * sin(uTime * 2.3 + seed * 5.0));
    vec3 shL = neck + vec3(0.19, -0.04, 0.0);
    vec3 shR = neck + vec3(-0.19, -0.04, 0.0);
    float armA = -0.42 * s * amp;
    float elb = 0.3 + run * 1.1;
    vec3 elL = shL + limb(armA, 0.3);
    vec3 haL = elL + limb(armA + elb, 0.28);
    float gest = talk * (0.5 + 0.45 * sin(uTime * 2.1 + seed * 13.0));
    vec3 elR = shR + limb(-armA + gest * 0.9, 0.3) + vec3(-gest * 0.06, 0.0, 0.0);
    vec3 haR = elR + limb(-armA + elb + gest * 1.4, 0.28);
    vec3 hpL = pelvis + vec3(0.1, 0.0, 0.0);
    vec3 hpR = pelvis + vec3(-0.1, 0.0, 0.0);
    float thL = 0.45 * s * amp;
    float thR = -0.45 * s * amp;
    float knL = (0.08 + 0.75 * max(0.0, sin(ph + 1.9))) * (1.0 - talk) * mix(1.0, 1.5, run);
    float knR = (0.08 + 0.75 * max(0.0, sin(ph + 1.9 + 3.14159))) * (1.0 - talk) * mix(1.0, 1.5, run);
    vec3 kL = hpL + limb(thL, 0.45);
    vec3 fL = kL + limb(thL - knL, 0.45);
    vec3 kR = hpR + limb(thR, 0.45);
    vec3 fR = kR + limb(thR - knR, 0.45);

    vec3 J[15];
    J[0] = pelvis; J[1] = neck; J[2] = head; J[3] = shL; J[4] = shR;
    J[5] = elL; J[6] = haL; J[7] = elR; J[8] = haR; J[9] = hpL; J[10] = hpR;
    J[11] = kL; J[12] = fL; J[13] = kR; J[14] = fR;

    int si = int(seg + 0.5);
    ivec2 ab = ivec2(0, 1);
    float rad = 0.1;
    ${SEGMENTS.map(([a, b, r], i) => `if (si == ${i}) { ab = ivec2(${a}, ${b}); rad = ${r.toFixed(3)}; }`).join("\n    ")}
    vec3 pa = J[0];
    vec3 pb = J[0];
    for (int k = 0; k < 15; k++) {
      if (k == ab.x) pa = J[k];
      if (k == ab.y) pb = J[k];
    }
    float taper = si == 0 ? mix(1.0, 1.25, along) : 1.0;
    vec3 local = mix(pa, pb, along) + aDir * rad * rf * taper;

    float h = aOrigin.z;
    mat2 rot = mat2(cos(h), -sin(h), sin(h), cos(h));
    vec2 xz = rot * local.xz;
    vec2 fwd = rot * vec2(0.0, 1.0);
    vec3 world = vec3(aOrigin.x + xz.x + fwd.x * travel, local.y, aOrigin.y + xz.y + fwd.y * travel);

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float light = 0.55 + 0.45 * max(0.0, dot(normalize(vec3(rot * aDir.xz, aDir.y).xzy), normalize(vec3(-0.4, 0.7, 0.6))));
    float rim = pow(rf, 3.0);
    float group = talk * (1.0 - step(0.5, abs(aMotion.y - uFocus)));
    vColor = aTint * (light + rim * 0.6) * (1.0 + group * 0.8);
    float rise = smoothstep(seed * 0.6, seed * 0.6 + 0.4, uEnter);
    vAlpha = edge * rise * (0.55 + 0.45 * rim);
    gl_PointSize = (1.3 + rf * 0.9) * uPixel * (14.0 / -mv.z);
  }
`;

const FIGURE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d) * vAlpha);
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  varying vec3 vDir;
  ${NOISE_GLSL}
  void main() {
    float day = 0.5 + 0.5 * sin(uTime * 0.05);
    vec3 dawnLow = vec3(1.0, 0.55, 0.32);
    vec3 duskLow = vec3(0.92, 0.38, 0.5);
    vec3 low = mix(duskLow, dawnLow, day);
    vec3 high = mix(vec3(0.03, 0.04, 0.12), vec3(0.12, 0.2, 0.42), day);
    float y = vDir.y;
    vec3 col = mix(low, high, smoothstep(-0.02, 0.45, y));
    vec3 sunDir = normalize(vec3(-0.5, 0.06 + day * 0.12, -1.0));
    float sun = pow(max(0.0, dot(vDir, sunDir)), 220.0) * 3.0 + pow(max(0.0, dot(vDir, sunDir)), 8.0) * 0.45;
    col += vec3(1.0, 0.8, 0.55) * sun;
    float cloud = fbm(vec2(atan(vDir.z, vDir.x) * 3.0 + uTime * 0.01, y * 9.0));
    col = mix(col, low * 1.2, smoothstep(0.55, 0.85, cloud) * smoothstep(0.35, 0.05, y) * 0.35);
    float alpha = (1.0 - smoothstep(0.35, 0.85, y) * (1.0 - day * 0.6)) * uEnter;
    gl_FragColor = vec4(col, alpha);
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
  varying vec2 vXZ;
  ${NOISE_GLSL}
  void main() {
    float d = length(vXZ);
    float day = 0.5 + 0.5 * sin(uTime * 0.05);
    vec3 base = mix(vec3(0.05, 0.035, 0.05), vec3(0.09, 0.075, 0.07), day);
    float n = fbm(vXZ * 0.18);
    float paths = smoothstep(0.08, 0.0, abs(fract(vXZ.x * 0.12 + n * 0.6) - 0.5) - 0.45) * 0.35;
    vec3 col = base * (0.7 + n * 0.6) + vec3(1.0, 0.7, 0.45) * paths * 0.12;
    float horizon = smoothstep(70.0, 20.0, d);
    vec3 haze = mix(vec3(0.92, 0.38, 0.5), vec3(1.0, 0.55, 0.32), day) * 0.35;
    col = mix(haze, col, horizon);
    gl_FragColor = vec4(col * uEnter, 1.0);
  }
`;

function figureBase(points) {
  const weights = SEGMENTS.map((s) => s[3]);
  const total = weights.reduce((a, b) => a + b, 0);
  const r = rng(3);
  const pos = new Float32Array(points * 3);
  const dir = new Float32Array(points * 3);
  const v = new THREE.Vector3();
  let i = 0;
  SEGMENTS.forEach((_, si) => {
    const n = si === SEGMENTS.length - 1 ? points - i : Math.round((weights[si] / total) * points);
    for (let k = 0; k < n && i < points; k++, i++) {
      v.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      pos[i * 3] = si;
      pos[i * 3 + 1] = si === 1 ? 0 : r();
      pos[i * 3 + 2] = Math.pow(r(), 0.35);
      v.toArray(dir, i * 3);
    }
  });
  return { pos, dir };
}

function buildPeople(spotCount, mobile) {
  const r = rng(77 + spotCount);
  const spots = Array.from({ length: spotCount }, (_, i) => {
    const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, spotCount - 1));
    const rad = 5 + (i % 2) * 3.2;
    return new THREE.Vector3(Math.cos(a) * rad * 1.35, 0, -Math.sin(a) * rad + 3.5);
  });
  const people = [];
  spots.forEach((s, gi) => {
    const n = 3 + (gi % 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r();
      const x = s.x + Math.cos(a) * 0.75;
      const z = s.z + Math.sin(a) * 0.75;
      const heading = Math.atan2(s.x - x, s.z - z);
      people.push({ x, z, heading, path: 1, speed: 0, offset: gi, mode: 2, seed: r() });
    }
  });
  const walkers = mobile ? 12 : 26;
  for (let i = 0; i < walkers; i++) {
    const run = r() < 0.2;
    people.push({
      x: (r() - 0.5) * 30,
      z: (r() - 0.5) * 22 - 4,
      heading: r() * Math.PI * 2,
      path: 26 + r() * 14,
      speed: run ? 2.6 + r() * 1.2 : 0.9 + r() * 0.5,
      offset: r() * 40,
      mode: run ? 1 : 0,
      seed: r(),
    });
  }
  return { spots, people };
}

const TINTS = ["#ffd2a6", "#ffe6c8", "#a8c8ff", "#ffc0a8", "#d8e4ff"];

export default function LivingWorld({ count }) {
  const group = useRef(null);
  const rings = useRef([]);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const spotCount = Math.max(3, Math.min(8, count));
  const world = useMemo(() => buildPeople(spotCount, mobile), [spotCount, mobile]);

  const figures = useMemo(() => {
    const per = mobile ? 300 : 560;
    const base = figureBase(per);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.pos, 3));
    g.setAttribute("aDir", new THREE.BufferAttribute(base.dir, 3));
    const n = world.people.length;
    const origin = new Float32Array(n * 4);
    const motion = new Float32Array(n * 4);
    const tint = new Float32Array(n * 3);
    const c = new THREE.Color();
    world.people.forEach((p, i) => {
      origin.set([p.x, p.z, p.heading, p.path], i * 4);
      motion.set([p.speed, p.offset, p.mode, p.seed], i * 4);
      c.set(TINTS[i % TINTS.length]).toArray(tint, i * 3);
    });
    g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(origin, 4));
    g.setAttribute("aMotion", new THREE.InstancedBufferAttribute(motion, 4));
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 3));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({
      vertexShader: FIGURE_VERT,
      fragmentShader: FIGURE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 }, uFocus: { value: -1 } },
    });
    return { g, m };
  }, [world, mobile]);

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uEnter: { value: 1 } },
      }),
    []
  );
  const ground = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: { uTime: { value: 0 }, uEnter: { value: 1 } } }),
    []
  );

  useEffect(
    () => () => {
      figures.g.dispose();
      figures.m.dispose();
    },
    [figures]
  );

  const focusPoint = useMemo(() => new THREE.Vector3(), []);

  useSectionFrame("activities", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.2 : 1);
    const target = live.focus >= 0 && live.focus < world.spots.length ? live.focus : -1;
    figures.m.uniforms.uTime.value = t;
    figures.m.uniforms.uEnter.value = p.enter;
    figures.m.uniforms.uFocus.value = target;
    figures.m.uniforms.uPixel.value = dpr * (mobile ? 1.2 : 1.6);
    sky.uniforms.uTime.value = state.clock.elapsedTime;
    sky.uniforms.uEnter.value = p.enter;
    ground.uniforms.uTime.value = state.clock.elapsedTime;
    ground.uniforms.uEnter.value = 0.25 + 0.75 * p.enter;
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const on = target === i;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ring.material.opacity = (on ? 0.95 : 0.4 + pulse * 0.2) * p.enter;
      ring.scale.setScalar(on ? 1.3 + pulse * 0.1 : 1);
    });
    if (target >= 0) focusPoint.copy(world.spots[target]).setY(1.1);
    publishFocus(p.settled, target >= 0 ? focusPoint : null);
  });

  return (
    <group ref={group}>
      <mesh material={sky} frustumCulled={false} renderOrder={-4}>
        <sphereGeometry args={[95, 32, 20]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={ground}>
        <planeGeometry args={[220, 220]} />
      </mesh>
      {world.spots.map((s, i) => (
        <group key={i} position={[s.x, 0.02, s.z]}>
          <mesh rotation-x={-Math.PI / 2} ref={(el) => (rings.current[i] = el)}>
            <ringGeometry args={[1.05, 1.18, 48]} />
            <meshBasicMaterial color="#ffcf9a" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <sprite position={[0, 0.5, 0]} scale={[2.6, 1.4, 1]}>
            <spriteMaterial map={glowTexture()} color="#ffb070" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
      <points geometry={figures.g} material={figures.m} frustumCulled={false} />
    </group>
  );
}
