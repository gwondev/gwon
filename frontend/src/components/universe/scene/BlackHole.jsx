import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { gatewayPull, live, presence, sectionIndex } from "../director.js";
import { rng } from "./util.js";

/**
 * 슈바르츠실트 블랙홀을 화면 전체 레이마칭으로 그린다(rs = 1).
 * 광선마다 실제 카메라 위치·방향에서 출발해 광자 측지선 근사식
 *   a = -1.5 · h² · x / |x|^5
 * 으로 휘어지며, 원반 평면을 지날 때마다 강착원반(r = 2.6..9.5)을 앞에서부터 합성한다.
 * 원반 위쪽·아래쪽 호(아인슈타인 링 형태)와 광자 고리는 이 적분에서 저절로 생긴다.
 *
 * 움직임
 *  - 원반 무늬는 케플러 회전(안쪽일수록 빠름)으로 흐르고, 두 위상을 엇갈려 섞어(flow map)
 *    시간이 지나도 무늬가 끝없이 감겨 뭉개지지 않는다. 동시에 안쪽으로 천천히 빨려 든다.
 *  - 안쪽 가장자리의 뜨거운 덩어리가 더 빠르게 돌며 깜빡인다.
 *  - 원반 평면이 아주 조금씩 세차운동해 천체가 공간 속에서 돌고 있다는 인상을 준다.
 *  - 진입(pull)할 때는 회전·유입이 빨라지고 별빛이 진행 방향으로 늘어지며 광자 고리가 밝아진다.
 *    회전 위상은 CPU 에서 적분하므로 속도가 바뀌어도 무늬가 튀지 않는다.
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
  uniform mat3 uDisk;
  uniform float uTime;
  uniform float uSpin;
  uniform float uFlow;
  uniform float uPull;
  uniform float uFade;
  uniform int uSteps;

  const float R_IN = 2.6;
  const float R_OUT = 9.5;
  const float TAU = 6.2831853;
  const float AZ = 32.0;
  const float SPIN = 2.5;
  const float CYCLE = 8.0;

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
  /* x 방향으로 per 마다 반복되는 값 잡음. 각도에 쓰면 이음매가 생기지 않는다. */
  float pnoise(vec2 p, float per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float i0 = mod(i.x, per);
    float i1 = mod(i.x + 1.0, per);
    return mix(mix(hash12(vec2(i0, i.y)), hash12(vec2(i1, i.y)), u.x),
               mix(hash12(vec2(i0, i.y + 1.0)), hash12(vec2(i1, i.y + 1.0)), u.x), u.y);
  }
  float pfbm(vec2 p, float per) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * pnoise(p, per);
      p = vec2(p.x * 2.0, p.y * 2.0 + 7.3);
      per *= 2.0;
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

  /* 한 위상의 원반 무늬. phase 만큼 케플러 회전시키고 uFlow 만큼 안쪽으로 끌어당긴다. */
  float diskLayer(float r, float ang, float phase, float seed) {
    float omega = pow(r, -1.5);
    float a = ang - omega * phase * SPIN;
    float u = fract(a / TAU) * AZ;
    float v = log(r) * 4.2 + uFlow + seed;
    float rings = pfbm(vec2(u, v), AZ);
    float streak = pfbm(vec2(u * 0.5, v * 3.4 + rings * 1.6), AZ * 0.5);
    return rings * (0.6 + 0.6 * streak);
  }

  vec4 sampleDisk(vec3 hit, vec3 dir) {
    float r = length(hit.xz);
    if (r < R_IN || r > R_OUT) return vec4(0.0);
    float ang = atan(hit.z, hit.x);

    float s = uSpin / CYCLE;
    float f0 = fract(s);
    float f1 = fract(s + 0.5);
    float w0 = 1.0 - abs(1.0 - 2.0 * f0);
    float pat = diskLayer(r, ang, f0 * CYCLE, 0.0) * w0 + diskLayer(r, ang, f1 * CYCLE, 17.0) * (1.0 - w0);

    float hsAng = ang - pow(3.4, -1.5) * uSpin * SPIN * 1.25;
    float hs = pnoise(vec2(fract(hsAng / TAU) * 7.0, r * 1.4 + 3.0), 7.0);
    hs = pow(smoothstep(0.58, 1.0, hs), 2.0) * smoothstep(6.0, 3.0, r) * (0.65 + 0.35 * sin(uTime * 1.9 + r * 3.1 + ang));

    float dens = 0.42 + 0.78 * pat + hs * 0.9;
    float edge = smoothstep(R_IN, R_IN + 0.35, r) * smoothstep(R_OUT, R_OUT - 3.2, r);

    vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x)) * sqrt(0.5 / r);
    float dop = 1.0 / (1.0 - dot(vel, -dir) * 1.6);
    float beam = pow(clamp(dop, 0.3, 1.9), 3.0);
    float grav = sqrt(max(0.0, 1.0 - 1.0 / r));

    vec3 col = diskColor(r) * dens * beam * grav * (0.95 + uPull * 0.55);
    col = mix(col, col * vec3(0.75, 0.85, 1.25), clamp(dop - 1.0, 0.0, 1.0) * 0.5 + uPull * 0.25);
    col += vec3(1.0, 0.9, 0.75) * hs * beam * 0.6;
    float alpha = clamp(edge * dens * 1.1, 0.0, 1.0);
    return vec4(col * edge, alpha);
  }

  void main() {
    vec4 view = uInvProj * vec4(vNdc, 1.0, 1.0);
    vec3 dirW = normalize((uCamWorld * vec4(normalize(view.xyz / view.w), 0.0)).xyz);
    vec3 fwdW = normalize((uCamWorld * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
    vec3 p = uDisk * uCamPos;
    vec3 v = uDisk * dirW;
    vec3 fwd = uDisk * fwdW;

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
      vec3 d = normalize(v);
      vec3 sc = stars(d);
      if (uPull > 0.01) {
        sc += stars(normalize(mix(d, fwd, 0.035 * uPull)));
        sc += stars(normalize(mix(d, fwd, 0.07 * uPull)));
        sc *= 0.5 + uPull * 0.4;
      }
      col += trans * sc;
    }
    float ring = exp(-pow((minR - 1.55) * 14.0, 2.0)) * (captured ? 0.0 : 1.0);
    col += vec3(1.0, 0.8, 0.55) * ring * (0.4 + uPull * 0.9) * trans;
    col += vec3(1.0, 0.6, 0.28) * glow * trans * (1.0 + uPull * 0.8);

    col = 1.0 - exp(-col * 0.95);
    col = pow(col, vec3(0.92));
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

/** 원반 둘레를 돌며 안쪽으로 감겨 들어가는 먼지. 각도는 반지름의 닫힌 식이라 속도가 바뀌어도 튀지 않는다. */
const dustVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uLife;
  uniform float uPull;
  uniform float uPixel;
  uniform mat3 uDiskInv;
  varying vec3 vColor;
  varying float vAlpha;

  const float R_OUTER = 15.0;
  const float R_INNER = 2.5;
  const float C = 260.0;

  void main() {
    float life = fract(aSeed.x + uLife * (0.7 + aSeed.w * 0.6));
    float b = R_OUTER - R_INNER;
    float r = R_OUTER - b * life;
    float theta = aSeed.y + C * (2.0 / b) * (inversesqrt(r) - inversesqrt(R_OUTER));
    float h = aSeed.z * (0.06 + 0.45 * (r / R_OUTER));
    vec3 pw = uDiskInv * vec3(cos(theta) * r, h, sin(theta) * r);
    vec4 mv = modelViewMatrix * vec4(pw, 1.0);
    gl_Position = projectionMatrix * mv;

    vec3 o = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 ray = normalize(mv.xyz);
    float along = dot(o, ray);
    float perp = length(o - ray * along);
    float hidden = (1.0 - smoothstep(2.5, 3.1, perp)) * step(along, length(mv.xyz));

    float heat = 1.0 - (r - R_INNER) / b;
    float fade = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.86, life);
    vAlpha = fade * (1.0 - hidden) * (0.25 + 0.55 * aSeed.w) * (1.0 + uPull * 0.8);
    vColor = mix(vec3(0.85, 0.4, 0.16), vec3(1.0, 0.93, 0.82), heat * heat) * (0.55 + heat * 1.3);
    gl_PointSize = (0.8 + aSeed.w * 1.9) * uPixel * (14.0 / max(0.5, -mv.z)) * (1.0 + uPull * 0.7);
  }
`;

const dustFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, pow(core, 1.8) * vAlpha);
  }
`;

const _euler = new THREE.Euler();
const _m4 = new THREE.Matrix4();

export default function BlackHole() {
  const mesh = useRef(null);
  const dust = useRef(null);
  const motion = useRef({ spin: 0, flow: 0, life: 0, pull: 0 });
  const camera = useThree((s) => s.camera);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);

  const disk = useMemo(() => ({ m: new THREE.Matrix3(), inv: new THREE.Matrix3() }), []);

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
          uDisk: { value: disk.m },
          uTime: { value: 0 },
          uSpin: { value: 0 },
          uFlow: { value: 0 },
          uPull: { value: 0 },
          uFade: { value: 1 },
          uSteps: { value: 200 },
        },
      }),
    [disk]
  );

  const dustCount = mobile ? 700 : 1900;
  const dustGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = rng(41);
    const seeds = new Float32Array(dustCount * 4);
    for (let i = 0; i < dustCount; i++) {
      seeds[i * 4] = rand();
      seeds[i * 4 + 1] = rand() * Math.PI * 2;
      seeds[i * 4 + 2] = (rand() - 0.5) * 2 * Math.pow(rand(), 1.5);
      seeds[i * 4 + 3] = Math.pow(rand(), 2.2);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [dustCount]);

  const dustMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uLife: { value: 0 },
          uPull: { value: 0 },
          uPixel: { value: 1 },
          uDiskInv: { value: disk.inv },
        },
      }),
    [disk]
  );

  useFrame((state, dt) => {
    const i = sectionIndex("gateway");
    const p = presence(i);
    if (!mesh.current) return;
    mesh.current.visible = p.visible;
    if (dust.current) dust.current.visible = p.visible && !live.reduced;
    if (!p.visible) return;

    const m = motion.current;
    const step = Math.min(dt, 0.1) * (live.reduced ? 0.25 : 1);
    m.pull = gatewayPull();
    m.spin += step * (1 + m.pull * 3.2);
    m.flow += step * (0.05 + m.pull * 0.55);
    m.life += (step / 45) * (1 + m.pull * 9);

    const time = state.clock.elapsedTime;
    const calm = live.reduced ? 0.2 : 1;
    _euler.set(0.07 * Math.sin(time * 0.07) * calm, 0, 0.055 * Math.sin(time * 0.05 + 1.3) * calm);
    _m4.makeRotationFromEuler(_euler);
    disk.m.setFromMatrix4(_m4);
    disk.inv.copy(disk.m).transpose();

    const u = material.uniforms;
    camera.updateMatrixWorld();
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uCamPos.value.copy(camera.position);
    u.uTime.value = time;
    u.uSpin.value = m.spin;
    u.uFlow.value = m.flow;
    u.uPull.value = m.pull;
    u.uSteps.value = mobile ? 110 : 200;
    u.uFade.value = Math.min(1, 0.15 + p.enter * 1.2);

    const du = dustMat.uniforms;
    du.uLife.value = m.life;
    du.uPull.value = m.pull;
    du.uPixel.value = dpr * (mobile ? 1.1 : 1);
  });

  return (
    <>
      <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-10}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <points ref={dust} geometry={dustGeo} material={dustMat} frustumCulled={false} renderOrder={-9} />
    </>
  );
}
