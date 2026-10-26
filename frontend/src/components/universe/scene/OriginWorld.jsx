import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * PROFILE — 기원의 성운.
 * 커다란 부드러운 입자 층이 겹쳐 성운이 되고, 가운데 원시별이 양쪽으로 제트를 뿜는다.
 */
const CLOUD_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = uTime * (0.02 + aSeed * 0.02) * (1.0 - length(position.xz) / 30.0);
    vec3 p = vec3(position.x * cos(a) - position.z * sin(a), position.y, position.x * sin(a) + position.z * cos(a));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = uEnter * (0.032 + 0.018 * sin(uTime * 0.6 + aSeed * 30.0));
    gl_PointSize = aSize * uPixel * (60.0 / -mv.z);
  }
`;
const CLOUD_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha);
  }
`;

const HUES = ["#c4a8ff", "#7fd0ff", "#ff9fcf", "#8f7cff", "#ffd0a0"];

export default function OriginWorld() {
  const group = useRef(null);
  const star = useRef(null);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);

  const cloud = useMemo(() => {
    const n = mobile ? 700 : 1800;
    const r = rng(12);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const arm = i % 3;
      const t = Math.pow(r(), 0.7);
      const a = arm * 2.1 + t * 4.2 + (r() - 0.5) * 0.9;
      const rad = 1.2 + t * 11;
      pos[i * 3] = Math.cos(a) * rad + (r() - 0.5) * 2.2;
      pos[i * 3 + 1] = (r() - 0.5) * (3.2 - t * 1.6);
      pos[i * 3 + 2] = Math.sin(a) * rad + (r() - 0.5) * 2.2;
      seed[i] = r();
      size[i] = 18 + r() * 34;
      c.set(HUES[Math.floor(r() * HUES.length)]).toArray(col, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 } },
    });
    return { g, m };
  }, [mobile]);

  useEffect(
    () => () => {
      cloud.g.dispose();
      cloud.m.dispose();
    },
    [cloud]
  );

  useSectionFrame("profile", group, (state, dt, p) => {
    const t = state.clock.elapsedTime * (live.reduced ? 0.2 : 1);
    cloud.m.uniforms.uTime.value = t;
    cloud.m.uniforms.uEnter.value = p.enter;
    cloud.m.uniforms.uPixel.value = dpr;
    star.current.scale.setScalar((1.8 + Math.sin(t * 2.2) * 0.2) * p.enter);
    group.current.rotation.x = 0.35;
    publishFocus(p.settled, null);
  });

  return (
    <group ref={group}>
      <points geometry={cloud.g} material={cloud.m} frustumCulled={false} />
      <sprite ref={star}>
        <spriteMaterial map={glowTexture()} color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {[1, -1].map((s) => (
        <sprite key={s} position={[0, s * 2.6, 0]} scale={[0.6, 5.5, 1]}>
          <spriteMaterial map={glowTexture()} color="#9fd8ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
