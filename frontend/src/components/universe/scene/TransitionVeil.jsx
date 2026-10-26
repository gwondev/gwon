import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { SECTION_BY_ID } from "../sections.js";
import { NOISE_GLSL, smooth } from "./util.js";

/**
 * 전환의 한가운데(t = 0.5)에서 장면이 바뀌는 순간을 덮는 화면 효과.
 * 카메라가 이전 세계 안으로 빨려 들어가는 끝과 다음 세계에서 빠져나오는 시작이 여기서 이어진다.
 * 도착하는 세계마다 모양이 다르다.
 */
const STYLES = { fade: 0, horizon: 1, synapse: 2, grid: 3, implode: 4, dawn: 5, spiral: 6, burst: 7, nebula: 8 };

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uAmt;
  uniform float uTime;
  uniform float uAspect;
  uniform float uDir;
  uniform int uStyle;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  ${NOISE_GLSL}

  float streaks(vec2 p, float dens, float speed, float keep) {
    float r = length(p);
    float a = atan(p.y, p.x) / 6.28318 + 0.5;
    float id = floor(a * dens);
    float h = hash12(vec2(id, 3.1));
    float lane = abs(fract(a * dens) - 0.5);
    float len = fract(h * 7.0 + (uTime * speed * (0.5 + h) - r * 0.8) * uDir);
    float s = smoothstep(0.09, 0.0, lane) * smoothstep(0.0, 0.25, len) * smoothstep(1.0, 0.55, len);
    return s * smoothstep(0.08, 0.7, r) * step(keep, h) * (0.4 + 0.6 * h);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(p);
    float a = atan(p.y, p.x);
    float amt = uAmt;
    vec3 col = vec3(0.0);
    float cover = amt;

    if (uStyle == 1) {
      float s = streaks(p, 260.0, 1.1, 0.72);
      float ring = exp(-pow((r - (1.15 - amt * 1.0)) * 10.0, 2.0));
      col = uColor * (s * 0.55 + ring * 0.35) * amt;
      cover = smoothstep(0.1, 0.9, amt);
    } else if (uStyle == 2) {
      float s = streaks(p, 160.0, 1.8, 0.5);
      vec2 cell = floor(p * 28.0);
      float h = hash12(cell);
      float spark = step(0.985, h) * (0.5 + 0.5 * sin(uTime * 30.0 + h * 50.0));
      col = mix(uColor, uAccent, h) * (s * 1.5 + spark * 2.0) * amt + uColor * 0.06 * amt;
    } else if (uStyle == 3) {
      float horizon = abs(p.y) + 0.035;
      float z = 0.32 / horizon;
      vec2 g = vec2(p.x * z * 3.0, z * 2.0 + uTime * 9.0 * uDir);
      vec2 l = abs(fract(g) - 0.5);
      float line = smoothstep(0.06 * z, 0.0, min(l.x, l.y) * 1.0) * smoothstep(0.0, 0.3, abs(p.y));
      col = uColor * line * 1.3 * amt + uAccent * exp(-abs(p.y) * 18.0) * amt;
    } else if (uStyle == 4) {
      float rings = pow(0.5 + 0.5 * sin(r * 46.0 + uTime * 26.0 * uDir), 8.0);
      float core = exp(-r * r * (30.0 - amt * 26.0));
      col = (uColor * rings * smoothstep(0.9, 0.1, r) * 0.9 + vec3(1.0) * core * 1.4) * amt;
    } else if (uStyle == 5) {
      float band = exp(-pow(p.y * (9.0 - amt * 6.0), 2.0));
      float flare = exp(-pow(p.y * 70.0, 2.0)) * smoothstep(1.2, 0.0, abs(p.x));
      float sky = smoothstep(-0.6, 0.6, p.y);
      col = (uColor * band * 1.3 + vec3(1.0, 0.95, 0.85) * flare * 1.5 + mix(uColor, uAccent, sky) * 0.12) * amt;
    } else if (uStyle == 6) {
      vec2 q = vec2(cos(a + r * 7.0 * amt * uDir), sin(a + r * 7.0 * amt * uDir)) * r;
      float s = streaks(q, 140.0, 0.9, 0.4);
      float core = exp(-r * 9.0);
      col = (mix(uColor, uAccent, smoothstep(0.0, 0.8, r)) * s * 1.6 + uColor * core) * amt;
    } else if (uStyle == 7) {
      float rings = pow(0.5 + 0.5 * sin(r * 34.0 - uTime * 30.0 * uDir), 10.0);
      float flash = exp(-r * r * 6.0) * smoothstep(0.55, 1.0, amt);
      float s = streaks(p, 120.0, 2.4, 0.55);
      col = (mix(uColor, uAccent, r) * (rings * 0.8 + s * 1.4) + vec3(1.0, 0.95, 0.9) * flash * 2.0) * amt;
    } else if (uStyle == 8) {
      float n = fbm(p * 2.4 + vec2(uTime * 0.25, -uTime * 0.18));
      float m = fbm(p * 5.0 - n * 1.7);
      col = mix(uColor, uAccent, m) * pow(n, 1.6) * 1.4 * amt;
    } else {
      col = uColor * 0.04 * amt;
    }

    float vig = smoothstep(0.2, 1.1, r);
    gl_FragColor = vec4(col, clamp(cover * (0.9 + vig * 0.1), 0.0, 0.97));
  }
`;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function veilAmount(t, reduced) {
  if (reduced) return t < 0.5 ? smooth(0.0, 0.5, t) : 1 - smooth(0.5, 1.0, t);
  return t < 0.5 ? smooth(0.2, 0.5, t) : 1 - smooth(0.5, 0.88, t);
}

export default function TransitionVeil() {
  const mesh = useRef(null);
  const size = useThree((s) => s.size);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uAmt: { value: 0 },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uDir: { value: 1 },
          uStyle: { value: 0 },
          uColor: { value: new THREE.Color() },
          uAccent: { value: new THREE.Color() },
        },
      }),
    []
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const amt = live.active ? veilAmount(live.t, live.reduced) : 0;
    mesh.current.visible = amt > 0.001;
    if (!mesh.current.visible) return;
    const from = live.ids[live.from];
    const to = live.ids[live.to];
    const dest = SECTION_BY_ID[to] || SECTION_BY_ID.gateway;
    const style = live.reduced ? "fade" : from === "gateway" || to === "gateway" ? "horizon" : dest.veil;
    const look = to === "gateway" ? SECTION_BY_ID[from] || dest : dest;
    const u = material.uniforms;
    u.uAmt.value = amt;
    u.uTime.value = state.clock.elapsedTime;
    u.uAspect.value = size.width / Math.max(1, size.height);
    u.uDir.value = live.dir;
    u.uStyle.value = STYLES[style] ?? 0;
    u.uColor.value.set(style === "horizon" ? "#f0c890" : look.color);
    u.uAccent.value.set(look.accent);
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
