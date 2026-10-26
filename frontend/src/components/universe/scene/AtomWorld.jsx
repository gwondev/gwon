import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * CERTIFICATIONS — 원자 구조.
 * 가운데 핵(양성자·중성자), 그 둘레로 자격증 하나당 궤도 하나와 전자 하나가 돈다.
 * 궤도선은 전자가 지나간 자리만 밝게 남아 꼬리처럼 보인다. 바깥에는 오비탈 모양의 확률 구름이 있다.
 */
const ORBIT_VERT = /* glsl */ `
  attribute float aAng;
  varying float vAng;
  void main() {
    vAng = aAng;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ORBIT_FRAG = /* glsl */ `
  uniform float uPhase;
  uniform float uOn;
  uniform float uEnter;
  uniform vec3 uColor;
  varying float vAng;
  void main() {
    float behind = mod(uPhase - vAng, 6.28318);
    float trail = exp(-behind * 1.6);
    float a = (0.07 + uOn * 0.12 + trail * (0.75 + uOn * 0.6)) * uEnter;
    gl_FragColor = vec4(uColor * (1.0 + trail * 1.4), a);
  }
`;

const CLOUD_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position * (0.6 + 0.4 * uEnter);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(uColor, uAccent, aSeed * aSeed);
    vAlpha = (0.25 + 0.35 * sin(uTime * 1.3 + aSeed * 90.0)) * uEnter;
    gl_PointSize = (1.0 + aSeed * 1.6) * uPixel * (40.0 / -mv.z);
  }
`;

const ORBIT_COLORS = ["#a9c4ff", "#ffd58a", "#8fe8ff", "#c9b0ff", "#ffb0a0", "#9ff0c8", "#ffe7b0", "#b0d0ff"];

function orbitGeometry(a, b) {
  const n = 256;
  const pos = new Float32Array((n + 1) * 3);
  const ang = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pos[i * 3] = Math.cos(t) * a;
    pos[i * 3 + 2] = Math.sin(t) * b;
    ang[i] = t;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aAng", new THREE.BufferAttribute(ang, 1));
  return g;
}

export default function AtomWorld({ count }) {
  const group = useRef(null);
  const nucleus = useRef(null);
  const electrons = useRef([]);
  const orbitGroups = useRef([]);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const k = Math.max(3, Math.min(8, count));

  const orbits = useMemo(() => {
    const r = rng(42 + k);
    return Array.from({ length: k }, (_, i) => {
      const a = 3.1 + i * 0.62;
      const b = a * (0.78 + r() * 0.18);
      const euler = new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI * 0.6);
      const geo = orbitGeometry(a, b);
      const mat = new THREE.ShaderMaterial({
        vertexShader: ORBIT_VERT,
        fragmentShader: ORBIT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uPhase: { value: 0 }, uOn: { value: 0 }, uEnter: { value: 1 }, uColor: { value: new THREE.Color(ORBIT_COLORS[i % ORBIT_COLORS.length]) } },
      });
      return { a, b, euler, geo, mat, speed: (0.9 + r() * 0.6) / Math.sqrt(a / 3), phase: r() * Math.PI * 2, color: ORBIT_COLORS[i % ORBIT_COLORS.length] };
    });
  }, [k]);

  const nucleons = useMemo(() => {
    const n = 34;
    const out = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      const shell = i % 3 === 0 ? 0.45 : 0.95;
      out.push(new THREE.Vector3(Math.cos(th) * rad * shell, y * shell, Math.sin(th) * rad * shell));
    }
    return out;
  }, []);

  const nucleusGeo = useMemo(() => new THREE.SphereGeometry(0.36, 24, 18), []);
  const nucleusMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.15, emissive: new THREE.Color("#3a2410"), emissiveIntensity: 0.6 }), []);

  const cloud = useMemo(() => {
    const n = mobile ? 1300 : 3600;
    const r = rng(8);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      if (r() < 0.45) {
        const ax = axes[i % 3];
        const s = r() < 0.5 ? 1 : -1;
        const along = (1.5 + r() * 4.5) * s;
        const spread = Math.sin((Math.abs(along) / 6) * Math.PI) * 1.6;
        v.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(spread * Math.sqrt(r()));
        v.addScaledVector(ax, along);
      } else {
        const u = r() * 2 - 1;
        const th = r() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const rad = 2 + Math.pow(r(), 0.6) * 6.5;
        v.set(s * Math.cos(th) * rad, u * rad, s * Math.sin(th) * rad);
      }
      v.toArray(pos, i * 3);
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 }, uColor: { value: new THREE.Color("#8fb4ff") }, uAccent: { value: new THREE.Color("#ffd58a") } },
    });
    return { g, m };
  }, [mobile]);

  useEffect(
    () => () => {
      orbits.forEach((o) => {
        o.geo.dispose();
        o.mat.dispose();
      });
    },
    [orbits]
  );
  useEffect(
    () => () => {
      cloud.g.dispose();
      cloud.m.dispose();
    },
    [cloud]
  );

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const proton = useMemo(() => new THREE.Color("#ffbf6e"), []);
  const neutron = useMemo(() => new THREE.Color("#c8d6ff"), []);
  const focusPoint = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    nucleons.forEach((_, i) => nucleus.current.setColorAt(i, i % 2 ? proton : neutron));
    nucleus.current.instanceColor.needsUpdate = true;
  }, [nucleons, proton, neutron]);

  useSectionFrame("credentials", group, (state, dt, p) => {
    const calm = live.reduced ? 0.2 : 1;
    const t = state.clock.elapsedTime * calm;
    const target = live.focus >= 0 ? live.focus % k : -1;
    const gather = 0.35 + 0.65 * p.enter;

    nucleons.forEach((n, i) => {
      tmp.copy(n).multiplyScalar(gather);
      tmp.x += Math.sin(t * 7 + i * 1.3) * 0.025;
      tmp.y += Math.cos(t * 6 + i * 2.1) * 0.025;
      m4.compose(tmp, q, one);
      nucleus.current.setMatrixAt(i, m4);
    });
    nucleus.current.instanceMatrix.needsUpdate = true;
    nucleus.current.rotation.y = t * 0.3;
    nucleus.current.rotation.x = t * 0.17;

    orbits.forEach((o, i) => {
      const ang = (o.phase + t * o.speed) % (Math.PI * 2);
      o.mat.uniforms.uPhase.value = ang;
      o.mat.uniforms.uOn.value = target === i ? 1 : 0;
      o.mat.uniforms.uEnter.value = target >= 0 && target !== i ? 0.35 * p.enter : p.enter;
      const e = electrons.current[i];
      if (e) {
        e.position.set(Math.cos(ang) * o.a, 0, Math.sin(ang) * o.b);
        e.scale.setScalar((target === i ? 1.3 : 0.75) * p.enter);
      }
      const og = orbitGroups.current[i];
      if (og) og.rotation.y = o.euler.y + t * 0.03;
    });

    cloud.m.uniforms.uTime.value = t;
    cloud.m.uniforms.uEnter.value = p.enter;
    cloud.m.uniforms.uPixel.value = dpr;
    group.current.rotation.y = t * 0.04;

    if (target >= 0) {
      const og = orbitGroups.current[target];
      focusPoint.set(orbits[target].a, 0, 0);
      og.localToWorld(focusPoint);
      focusPoint.multiplyScalar(0.55);
    }
    publishFocus(p.settled, target >= 0 ? focusPoint : null);
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} color="#fff1dc" />
      <pointLight position={[-6, -3, 4]} intensity={30} color="#6f9dff" distance={30} />
      <instancedMesh ref={nucleus} args={[nucleusGeo, nucleusMat, nucleons.length]} />
      <sprite scale={[6, 6, 1]}>
        <spriteMaterial map={glowTexture()} color="#ffcf8a" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <points geometry={cloud.g} material={cloud.m} frustumCulled={false} />
      {orbits.map((o, i) => (
        <group key={i} rotation={[o.euler.x, o.euler.y, o.euler.z]} ref={(el) => (orbitGroups.current[i] = el)}>
          <lineLoop geometry={o.geo} material={o.mat} frustumCulled={false} />
          <group ref={(el) => (electrons.current[i] = el)}>
            <mesh>
              <sphereGeometry args={[0.09, 12, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <sprite scale={[0.9, 0.9, 1]}>
              <spriteMaterial map={glowTexture()} color={o.color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>
          </group>
        </group>
      ))}
    </group>
  );
}
