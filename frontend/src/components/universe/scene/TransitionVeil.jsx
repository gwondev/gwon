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
 *
 * 전환 도중 목적지가 바뀌면 효과를 갈아 끼우지 않고 이전 효과(A)에서 새 효과(B)로 섞어 넘긴다.
 * 여러 섹션을 한 번에 건너뛰면 지나치는 섹션들의 색이 차례로 스치고 워프 줄무늬가 짙어진다.
 */
const STYLES = { fade: 0, horizon: 1, synapse: 2, grid: 3, implode: 4, dawn: 5, spiral: 6, burst: 7, nebula: 8 };
const BLEND_SPEED = 4.5;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uAmt;
  uniform float uTime;
  uniform float uAspect;
  uniform float uDir;
  uniform float uSpan;
  uniform float uMix;
  uniform int uStyleA;
  uniform int uStyleB;
  uniform vec3 uColorA;
  uniform vec3 uAccentA;
  uniform vec3 uColorB;
  uniform vec3 uAccentB;
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

  vec4 veil(int style, vec3 color, vec3 accent, vec2 p, float r, float a, float amt) {
    vec3 col = vec3(0.0);
    float cover = amt;
    if (style == 1) {
      float s = streaks(p, 260.0, 1.1, 0.72);
      float ring = exp(-pow((r - (1.15 - amt * 1.0)) * 10.0, 2.0));
      col = color * (s * 0.55 + ring * 0.35) * amt;
      cover = smoothstep(0.1, 0.9, amt);
    } else if (style == 2) {
      float s = streaks(p, 160.0, 1.8, 0.5);
      vec2 cell = floor(p * 28.0);
      float h = hash12(cell);
      float spark = step(0.985, h) * (0.5 + 0.5 * sin(uTime * 30.0 + h * 50.0));
      col = mix(color, accent, h) * (s * 1.5 + spark * 2.0) * amt + color * 0.06 * amt;
    } else if (style == 3) {
      float horizon = abs(p.y) + 0.035;
      float z = 0.32 / horizon;
      vec2 g = vec2(p.x * z * 3.0, z * 2.0 + uTime * 9.0 * uDir);
      vec2 l = abs(fract(g) - 0.5);
      float line = smoothstep(0.06 * z, 0.0, min(l.x, l.y) * 1.0) * smoothstep(0.0, 0.3, abs(p.y));
      col = color * line * 1.3 * amt + accent * exp(-abs(p.y) * 18.0) * amt;
    } else if (style == 4) {
      float rings = pow(0.5 + 0.5 * sin(r * 46.0 + uTime * 26.0 * uDir), 8.0);
      float core = exp(-r * r * (30.0 - amt * 26.0));
      col = (color * rings * smoothstep(0.9, 0.1, r) * 0.9 + vec3(1.0) * core * 1.4) * amt;
    } else if (style == 5) {
      float band = exp(-pow(p.y * (9.0 - amt * 6.0), 2.0));
      float flare = exp(-pow(p.y * 70.0, 2.0)) * smoothstep(1.2, 0.0, abs(p.x));
      float sky = smoothstep(-0.6, 0.6, p.y);
      col = (color * band * 1.3 + vec3(1.0, 0.95, 0.85) * flare * 1.5 + mix(color, accent, sky) * 0.12) * amt;
    } else if (style == 6) {
      vec2 q = vec2(cos(a + r * 7.0 * amt * uDir), sin(a + r * 7.0 * amt * uDir)) * r;
      float s = streaks(q, 140.0, 0.9, 0.4);
      float core = exp(-r * 9.0);
      col = (mix(color, accent, smoothstep(0.0, 0.8, r)) * s * 1.6 + color * core) * amt;
    } else if (style == 7) {
      float rings = pow(0.5 + 0.5 * sin(r * 34.0 - uTime * 30.0 * uDir), 10.0);
      float flash = exp(-r * r * 6.0) * smoothstep(0.55, 1.0, amt);
      float s = streaks(p, 120.0, 2.4, 0.55);
      col = (mix(color, accent, r) * (rings * 0.8 + s * 1.4) + vec3(1.0, 0.95, 0.9) * flash * 2.0) * amt;
    } else if (style == 8) {
      float n = fbm(p * 2.4 + vec2(uTime * 0.25, -uTime * 0.18));
      float m = fbm(p * 5.0 - n * 1.7);
      col = mix(color, accent, m) * pow(n, 1.6) * 1.4 * amt;
    } else {
      col = color * 0.04 * amt;
    }
    return vec4(col, cover);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(p);
    float a = atan(p.y, p.x);
    vec4 b = veil(uStyleB, uColorB, uAccentB, p, r, a, uAmt);
    vec4 v = b;
    if (uMix < 0.999) {
      vec4 va = veil(uStyleA, uColorA, uAccentA, p, r, a, uAmt);
      v = mix(va, b, uMix);
    }
    float warp = clamp((uSpan - 1.0) * 0.3, 0.0, 0.85);
    if (warp > 0.0) {
      v.rgb += mix(uColorB, vec3(1.0), 0.35) * streaks(p, 220.0, 2.6, 0.55) * warp * uAmt;
    }
    float vig = smoothstep(0.2, 1.1, r);
    gl_FragColor = vec4(v.rgb, clamp(v.a * (0.9 + vig * 0.1), 0.0, 0.97));
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

/** 지금 프레임에서 보여야 할 효과. 여러 칸을 건너면 진행에 따라 중간 섹션의 색을 지나간다. */
function wanted() {
  const fromId = live.ids[live.from];
  const toId = live.ids[live.to];
  const dest = SECTION_BY_ID[toId] || SECTION_BY_ID.gateway;
  const look = toId === "gateway" ? SECTION_BY_ID[fromId] || dest : dest;
  const style = live.reduced ? "fade" : "horizon";
  const color = style === "horizon" ? "#f0c890" : look.color;
  return { style: STYLES[style] ?? 0, color, accent: look.accent, span: 1, key: `${style}|${color}|${look.accent}` };
}

export default function TransitionVeil() {
  const mesh = useRef(null);
  const state = useRef({ key: "", mix: 1 });
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
          uSpan: { value: 1 },
          uMix: { value: 1 },
          uStyleA: { value: 0 },
          uStyleB: { value: 0 },
          uColorA: { value: new THREE.Color() },
          uAccentA: { value: new THREE.Color() },
          uColorB: { value: new THREE.Color() },
          uAccentB: { value: new THREE.Color() },
        },
      }),
    []
  );

  useFrame((frame, dt) => {
    if (!mesh.current) return;
    const amt = live.active ? veilAmount(live.t, live.reduced) : 0;
    mesh.current.visible = amt > 0.001;
    const s = state.current;
    const u = material.uniforms;
    if (!mesh.current.visible) {
      s.key = "";
      return;
    }
    const w = wanted();
    if (w.key !== s.key) {
      if (s.key) {
        const shown = u.uMix.value;
        if (shown >= 0.5) u.uStyleA.value = u.uStyleB.value;
        u.uColorA.value.lerp(u.uColorB.value, shown);
        u.uAccentA.value.lerp(u.uAccentB.value, shown);
        s.mix = 0;
      } else {
        s.mix = 1;
      }
      s.key = w.key;
      u.uStyleB.value = w.style;
      u.uColorB.value.set(w.color);
      u.uAccentB.value.set(w.accent);
    }
    s.mix = Math.min(1, s.mix + dt * BLEND_SPEED);
    u.uMix.value = s.mix * s.mix * (3 - 2 * s.mix);
    u.uAmt.value = amt;
    u.uTime.value = frame.clock.elapsedTime;
    u.uAspect.value = size.width / Math.max(1, size.height);
    u.uDir.value = 1;
    u.uSpan.value = 1;
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
