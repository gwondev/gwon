import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { presence, sectionIndex } from "../director.js";

/**
 * 슈바르츠실트 블랙홀을 화면 전체 레이마칭으로 그린다(rs = 1).
 * 광선마다 실제 카메라 위치·방향에서 출발해 광자 측지선 근사식
 *   a = -1.5 · h² · x / |x|^5
 * 으로 휘어지며, 적도면(y=0)을 지날 때마다 강착원반(r = 3..9.5)을 앞에서부터 합성한다.
 * 원반 위쪽·아래쪽 호(아인슈타인 링 형태)와 광자 고리는 이 적분에서 저절로 생긴다.
 * 도플러 빔(다가오는 쪽이 밝음)과 중력 적색편이도 원반 밝기에 곱한다.
 */
const vertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vNdc;
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uCamPos;
  uniform float uTime;
  uniform float uFade;
  uniform int uSteps;

  const float R_IN = 2.6;
  const float R_OUT = 9.5;

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.07 + 13.7;
      a *= 0.5;
    }
    return v;
  }

  vec3 stars(vec3 d) {
    vec3 col = vec3(0.0);
    for (int layer = 0; layer < 2; layer++) {
      float scale = layer == 0 ? 90.0 : 220.0;
      vec3 p = d * scale;
      vec3 cell = floor(p);
      vec3 f = fract(p) - 0.5;
      float h = hash13(cell + float(layer) * 17.0);
      if (h > 0.965) {
        vec3 off = vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 5.1)) - 0.5;
        float dist = length(f - off * 0.7);
        float b = smoothstep(0.22, 0.0, dist) * (h - 0.965) * 28.0;
        vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.7, 0.82, 1.0), hash13(cell + 9.0));
        col += tint * b * (layer == 0 ? 1.0 : 0.55);
      }
    }
    float band = exp(-pow(d.y * 3.2 + d.x * 0.6, 2.0));
    float neb = fbm(vec2(atan(d.z, d.x) * 3.0, d.y * 6.0));
    col += vec3(0.22, 0.17, 0.12) * band * neb * 0.35;
    return col;
  }

  vec3 diskColor(float r) {
    float x = clamp((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0);
    vec3 hot = vec3(1.0, 0.93, 0.8);
    vec3 mid = vec3(1.0, 0.62, 0.26);
    vec3 cool = vec3(0.62, 0.2, 0.06);
    return x < 0.3 ? mix(hot, mid, x / 0.3) : mix(mid, cool, (x - 0.3) / 0.7);
  }

  vec4 sampleDisk(vec3 hit, vec3 dir) {
    float r = length(hit.xz);
    if (r < R_IN || r > R_OUT) return vec4(0.0);
    float ang = atan(hit.z, hit.x);
    float omega = 1.2 * pow(r, -1.5);
    float a = ang + uTime * omega * 2.4;
    float rings = fbm(vec2(r * 2.8, a * 2.0 + r * 0.35));
    float streak = fbm(vec2(r * 9.0, a * 0.6 + rings));
    float dens = 0.45 + 0.75 * rings * (0.6 + 0.6 * streak);
    float edge = smoothstep(R_IN, R_IN + 0.35, r) * smoothstep(R_OUT, R_OUT - 3.2, r);

    vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x)) * sqrt(0.5 / r);
    float dop = 1.0 / (1.0 - dot(vel, -dir) * 1.6);
    float beam = pow(clamp(dop, 0.3, 1.9), 3.0);
    float grav = sqrt(max(0.0, 1.0 - 1.0 / r));

    vec3 col = diskColor(r) * dens * beam * grav * 0.95;
    col = mix(col, col * vec3(0.75, 0.85, 1.25), clamp(dop - 1.0, 0.0, 1.0) * 0.5);
    float alpha = clamp(edge * dens * 1.1, 0.0, 1.0);
    return vec4(col * edge, alpha);
  }

  void main() {
    vec4 view = uInvProj * vec4(vNdc, 1.0, 1.0);
    vec3 dir = normalize((uCamWorld * vec4(normalize(view.xyz / view.w), 0.0)).xyz);
    vec3 p = uCamPos;
    vec3 v = dir;

    float h2 = pow(length(cross(p, v)), 2.0);
    vec3 col = vec3(0.0);
    float trans = 1.0;
    float glow = 0.0;
    bool captured = length(p) < 1.0;
    float minR = 1e4;

    for (int i = 0; i < 260; i++) {
      if (i >= uSteps || captured) break;
      float r = length(p);
      minR = min(minR, r);
      float dt = clamp(0.085 * r, 0.035, 0.9);
      if (r > 30.0 && dot(p, v) > 0.0) break;
      vec3 prev = p;
      vec3 acc = -1.5 * h2 * p / pow(r, 5.0);
      v += acc * dt;
      p += v * dt;
      if (length(p) < 1.0) {
        captured = true;
        break;
      }
      if (prev.y * p.y < 0.0) {
        vec3 hit = mix(prev, p, prev.y / (prev.y - p.y));
        vec4 d = sampleDisk(hit, normalize(v));
        col += trans * d.rgb * d.a;
        trans *= 1.0 - d.a;
        if (trans < 0.02) break;
      }
      float rr = length(p.xz);
      float thin = exp(-abs(p.y) * 7.0) * smoothstep(R_IN - 0.4, R_IN + 1.0, rr) * smoothstep(R_OUT + 1.5, R_OUT - 2.0, rr);
      glow += thin * dt * 0.02;
    }

    if (!captured && trans > 0.02) {
      col += trans * stars(normalize(v));
    }
    float ring = exp(-pow((minR - 1.55) * 14.0, 2.0)) * (captured ? 0.0 : 1.0);
    col += vec3(1.0, 0.8, 0.55) * ring * 0.4 * trans;
    col += vec3(1.0, 0.6, 0.28) * glow * trans;

    col = 1.0 - exp(-col * 0.95);
    col = pow(col, vec3(0.92));
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

export default function BlackHole() {
  const mesh = useRef(null);
  const camera = useThree((s) => s.camera);
  const mobile = useThree((s) => s.size.width < 768);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uInvProj: { value: new THREE.Matrix4() },
          uCamWorld: { value: new THREE.Matrix4() },
          uCamPos: { value: new THREE.Vector3() },
          uTime: { value: 0 },
          uFade: { value: 1 },
          uSteps: { value: 200 },
        },
      }),
    []
  );

  useFrame((state) => {
    const i = sectionIndex("gateway");
    const p = presence(i);
    if (!mesh.current) return;
    mesh.current.visible = p.visible;
    if (!p.visible) return;
    const u = material.uniforms;
    camera.updateMatrixWorld();
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uCamPos.value.copy(camera.position);
    u.uTime.value = state.clock.elapsedTime;
    u.uSteps.value = mobile ? 110 : 200;
    u.uFade.value = Math.min(1, 0.15 + p.enter * 1.2);
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
