import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live } from "../director.js";
import { POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";

/**
 * CAREER & PROFILE — 두뇌와 인공신경망.
 * 겉은 주름(이랑·고랑)이 있는 대뇌 두 반구·소뇌·뇌간을 점으로 빚은 피질, 속은 뉴런 그래프다.
 * 신호는 세 군데 발화점에서 시냅스 연결(그래프 거리)을 따라 퍼지고, 같은 파면이 피질 표면에도 번진다.
 *  - 프로필: 중심부가 밝아진다.
 *  - 경력: 경력 하나당 중심에서 바깥으로 이어진 신경 경로 하나. 고른 경력의 경로로 신호가 달린다.
 *  - 기술: 뇌 바깥 은닉층을 거쳐 기술 노드로 이어진 축삭이 차례로 켜진다.
 * live.brainMode(0 프로필, 1 경력, 2 기술)와 live.focus 를 패널이 정한다.
 */
const S = 2.45;

function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => r());
  const h = (x, y, z) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = f(x - xi);
    const v = f(y - yi);
    const w = f(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w
    );
  };
}

/** 대뇌 한 점: 방향 d 에서 반구 모양을 만들고 이랑 높이(ridge)를 돌려준다. */
function cortexPoint(d, noise, out) {
  const side = d.x >= 0 ? 1 : -1;
  out.set(d.x * 1.02, d.y * 0.86, d.z * 1.3);
  const fissure = Math.exp(-((d.x / 0.13) ** 2));
  out.multiplyScalar(1 - 0.08 * fissure);
  out.y -= 0.22 * fissure * Math.max(0, d.y);
  out.x += side * 0.05;
  if (out.y < -0.22) out.y = -0.22 + (out.y + 0.22) * 0.55;
  // 측두엽: 아래 옆쪽으로 불룩
  const tx = out.x - side * 0.86;
  const ty = out.y + 0.3;
  const tz = out.z - 0.2;
  const temporal = Math.exp(-(tx * tx + ty * ty * 2 + tz * tz * 0.8) / 0.14);
  out.x += side * 0.1 * temporal;
  out.y -= 0.06 * temporal;
  // 전두엽은 살짝 낮고 둥글게, 후두엽은 좁게
  out.y -= 0.08 * Math.max(0, out.z) * Math.max(0, -d.y);
  out.x *= 1 - 0.1 * Math.max(0, -out.z - 0.6);
  // 이랑·고랑
  const n1 = noise(out.x * 3.4 + 11, out.y * 3.4, out.z * 3.4);
  const n2 = noise(out.x * 7 + 3, out.y * 7 + 5, out.z * 7);
  const ridge = Math.pow(1 - Math.abs(n1 * 2 - 1), 2.2) * 0.75 + n2 * 0.25;
  const len = out.length();
  out.multiplyScalar((len + (ridge - 0.5) * 0.075) / len);
  return ridge;
}

const SQ = /* glsl */ `
  float sq(float x) { return x * x; }
  vec3 sq3(vec3 x) { return x * x; }
`;

const CORTEX_VERT = /* glsl */ `
${SQ}
  attribute float aRidge;
  attribute float aSeed;
  uniform float uTime;
  uniform float uEnter;
  uniform float uPixel;
  uniform float uCore;
  uniform vec3 uSrc[3];
  uniform vec3 uFront;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position * (0.82 + 0.18 * uEnter);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // 표면을 천천히 훑는 빛
    float flow = pow(0.5 + 0.5 * sin(dot(position, vec3(0.35, 0.8, 0.5)) * 1.3 - uTime * 0.7), 8.0);
    float flow2 = pow(0.5 + 0.5 * sin(dot(position, vec3(-0.7, 0.2, 0.6)) * 1.7 - uTime * 0.45 + 2.0), 10.0);
    // 신경망을 따라 퍼지는 신호 파면이 피질에도 번진다
    float wave = 0.0;
    for (int k = 0; k < 3; k++) {
      float d = length(position - uSrc[k]);
      wave += exp(-sq((d - uFront[k]) * 2.6)) * (1.0 - smoothstep(4.0, 8.0, uFront[k]));
    }
    float lit = flow * 0.6 + flow2 * 0.4 + wave * 0.9 + uCore * 0.25;
    vColor = mix(uColor * 0.55, mix(uColor, uAccent, aSeed * 0.5), aRidge) + vec3(0.85, 0.95, 1.0) * lit * 0.6;
    vAlpha = (0.16 + 0.42 * aRidge + lit * 0.5) * uEnter;
    gl_PointSize = (0.7 + aRidge * 0.9 + lit * 0.8) * uPixel * (30.0 / -mv.z);
  }
`;

const NODE_VERT = /* glsl */ `
${SQ}
  attribute vec3 aDist;
  attribute float aCore;
  attribute float aSeed;
  uniform float uTime;
  uniform float uEnter;
  uniform float uPixel;
  uniform float uCore;
  uniform vec3 uFront;
  uniform vec3 uColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position * (0.82 + 0.18 * uEnter), 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 hit = exp(-sq3((aDist - uFront) * 3.0));
    float fire = hit.x + hit.y + hit.z;
    float core = uCore * pow(aCore, 2.0);
    vColor = mix(uColor, vec3(1.0), clamp(fire * 0.7 + core * 0.6, 0.0, 1.0));
    vAlpha = (0.35 + fire * 0.9 + core * 0.9 + 0.12 * sin(uTime * 1.7 + aSeed * 40.0)) * uEnter;
    gl_PointSize = (2.0 + fire * 3.2 + core * 3.0) * uPixel * (34.0 / -mv.z);
  }
`;

const EDGE_VERT = /* glsl */ `
  attribute vec3 aDist;
  uniform float uEnter;
  varying vec3 vDist;
  void main() {
    vDist = aDist;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (0.82 + 0.18 * uEnter), 1.0);
  }
`;
const EDGE_FRAG = /* glsl */ `
${SQ}
  uniform float uEnter;
  uniform float uDim;
  uniform vec3 uFront;
  uniform vec3 uColor;
  varying vec3 vDist;
  void main() {
    vec3 hit = exp(-sq3((vDist - uFront) * 3.2));
    float pulse = hit.x + hit.y + hit.z;
    float a = (0.07 + pulse * 0.85) * uEnter * uDim;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), pulse * 0.6) * (1.0 + pulse), a);
  }
`;

/** 경로(경력)·축삭(기술) 공통: aT 를 따라 머리가 달리고 꼬리를 남긴다. */
const PATH_VERT = /* glsl */ `
  attribute float aT;
  attribute float aLane;
  uniform float uEnter;
  varying float vT;
  varying float vLane;
  void main() {
    vT = aT;
    vLane = aLane;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (0.82 + 0.18 * uEnter), 1.0);
  }
`;
const PATH_FRAG = /* glsl */ `
${SQ}
  uniform float uTime;
  uniform float uEnter;
  uniform float uWeight;
  uniform float uSel;
  uniform float uSeq;
  uniform float uRate;
  uniform vec3 uColor;
  varying float vT;
  varying float vLane;
  void main() {
    float on = 1.0 - step(0.5, abs(vLane - uSel));
    // 차례대로 켜짐: lane 마다 uSeq 가 지나가야 켜진다
    float ready = smoothstep(vLane * 0.35, vLane * 0.35 + 0.4, uSeq);
    float head = fract(uTime * uRate * (1.0 + on * 0.6) + vLane * 0.37);
    float glow = exp(-sq((vT - head) * 9.0));
    float trail = step(vT, head) * smoothstep(head - 0.35, head, vT) * 0.45;
    float base = 0.1 + on * 0.35;
    float level = uSel < -0.5 ? 0.55 : mix(0.22, 1.0, on);
    float a = (base + glow * 1.4 + trail) * level * ready * uWeight * uEnter;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), glow * 0.5 + on * 0.2) * (1.0 + glow), a);
  }
`;
const PATH_NODE_VERT = /* glsl */ `
${SQ}
  attribute float aT;
  attribute float aLane;
  attribute float aBig;
  uniform float uTime;
  uniform float uEnter;
  uniform float uPixel;
  uniform float uWeight;
  uniform float uSel;
  uniform float uSeq;
  uniform float uRate;
  uniform vec3 uColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position * (0.82 + 0.18 * uEnter), 1.0);
    gl_Position = projectionMatrix * mv;
    float on = 1.0 - step(0.5, abs(aLane - uSel));
    float ready = smoothstep(aLane * 0.35, aLane * 0.35 + 0.4, uSeq);
    float head = fract(uTime * uRate * (1.0 + on * 0.6) + aLane * 0.37);
    float hit = exp(-sq((aT - head) * 7.0));
    float level = uSel < -0.5 ? 0.6 : mix(0.25, 1.0, on);
    vColor = mix(uColor, vec3(1.0), hit * 0.7 + on * aBig * 0.4);
    vAlpha = (0.35 + hit + aBig * 0.5) * level * ready * uWeight * uEnter;
    gl_PointSize = (2.2 + hit * 3.0 + aBig * (3.5 + on * 3.5)) * uPixel * (34.0 / -mv.z);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uEnter;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = uTime * (0.02 + aSeed * 0.03);
    vec3 p = vec3(position.x * cos(a) - position.z * sin(a), position.y, position.x * sin(a) + position.z * cos(a));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(vec3(0.62, 0.66, 1.0), vec3(0.55, 0.95, 1.0), aSeed);
    vAlpha = (0.15 + 0.35 * sin(uTime * 0.9 + aSeed * 70.0) * sin(uTime * 0.9 + aSeed * 70.0)) * uEnter;
    gl_PointSize = (0.6 + aSeed * 1.2) * uPixel * (30.0 / -mv.z);
  }
`;

function dijkstra(nodes, adj, src) {
  const n = nodes.length;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[src] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) (best = dist[i]), (u = i);
    if (u < 0) break;
    done[u] = 1;
    adj[u].forEach(([v, w]) => {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    });
  }
  return { dist, prev };
}

function buildBrain(mobile, careerCount, skillCount) {
  const r = rng(2026);
  const noise = makeNoise(7);
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();

  // 피질: 대뇌 + 소뇌 + 뇌간
  const total = mobile ? 7000 : 17000;
  const pos = new Float32Array(total * 3);
  const ridge = new Float32Array(total);
  const seed = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const kind = r();
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const sq = Math.sqrt(1 - u * u);
    d.set(sq * Math.cos(th), u, sq * Math.sin(th));
    let rg;
    if (kind < 0.8) {
      rg = cortexPoint(d, noise, v);
      if (r() < 0.12) v.multiplyScalar(0.9 + r() * 0.08);
    } else if (kind < 0.95) {
      // 소뇌: 두 덩이, 가로 주름
      const side = d.x >= 0 ? 1 : -1;
      v.set(d.x * 0.5 + side * 0.17, d.y * 0.27, d.z * 0.36);
      v.add(new THREE.Vector3(0, -0.6, -0.86));
      rg = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(d.y * 14 + d.z * 2)), 3);
      v.y += (rg - 0.5) * 0.02;
    } else {
      // 뇌간
      const t = r();
      const a = r() * Math.PI * 2;
      const rad = 0.13 * (1 - t * 0.3);
      v.set(Math.cos(a) * rad, -0.42 - t * 0.72, -0.32 - t * 0.2 + Math.sin(a) * rad);
      rg = 0.3 + r() * 0.3;
    }
    v.multiplyScalar(S).toArray(pos, i * 3);
    ridge[i] = rg;
    seed[i] = r();
  }

  // 속 뉴런: 대뇌 안쪽에 고르게
  const nodeCount = mobile ? 150 : 240;
  const nodes = [];
  let guard = 0;
  while (nodes.length < nodeCount && guard++ < 20000) {
    v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const q = (v.x / 0.92) ** 2 + (v.y / 0.74) ** 2 + (v.z / 1.18) ** 2;
    if (q > 1 || v.y < -0.3) continue;
    if (Math.abs(v.x) < 0.05) continue;
    const p = v.clone().multiplyScalar(S);
    if (nodes.some((o) => o.distanceToSquared(p) < 0.12)) continue;
    nodes.push(p);
  }
  const adj = nodes.map(() => []);
  const edgeSet = new Set();
  const edges = [];
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => [j, a.distanceTo(b)])
      .filter(([j]) => j !== i)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 3);
    near.forEach(([j, w]) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSet.has(key) || w > 2.2) return;
      edgeSet.add(key);
      edges.push([i, j]);
      adj[i].push([j, w]);
      adj[j].push([i, w]);
    });
  });

  const closest = (target) => {
    let best = 0;
    let bd = Infinity;
    nodes.forEach((p, i) => {
      const dd = p.distanceToSquared(target);
      if (dd < bd) (bd = dd), (best = i);
    });
    return best;
  };
  const core = closest(new THREE.Vector3(0.25, 0.1, 0));
  const sources = [core, closest(new THREE.Vector3(-1.4, 0.9, 2.2)), closest(new THREE.Vector3(1.3, 0.6, -2.4))];
  const runs = sources.map((s) => dijkstra(nodes, adj, s));
  const fin = (x) => (Number.isFinite(x) ? x : 99);
  const maxD = runs.map((rn) => Math.max(...Array.from(rn.dist).filter(Number.isFinite)));

  const nodePos = new Float32Array(nodes.length * 3);
  const nodeDist = new Float32Array(nodes.length * 3);
  const nodeCore = new Float32Array(nodes.length);
  const nodeSeed = new Float32Array(nodes.length);
  nodes.forEach((p, i) => {
    p.toArray(nodePos, i * 3);
    runs.forEach((rn, k) => (nodeDist[i * 3 + k] = fin(rn.dist[i])));
    nodeCore[i] = Math.max(0, 1 - p.distanceTo(nodes[core]) / (S * 0.85));
    nodeSeed[i] = r();
  });
  const edgePos = new Float32Array(edges.length * 6);
  const edgeDist = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], e) => {
    [a, b].forEach((n, k) => {
      nodes[n].toArray(edgePos, e * 6 + k * 3);
      runs.forEach((rn, s) => (edgeDist[e * 6 + k * 3 + s] = fin(rn.dist[n])));
    });
  });

  // 경력 경로: 중심에서 서로 멀리 떨어진 바깥 뉴런까지
  const outer = nodes
    .map((p, i) => [i, p.x * p.x / 0.85 + p.y * p.y / 0.55 + p.z * p.z / 1.4])
    .sort((x, y) => y[1] - x[1])
    .slice(0, Math.max(12, Math.floor(nodes.length * 0.3)))
    .map(([i]) => i)
    .filter((i) => Number.isFinite(runs[0].dist[i]));
  const targets = [];
  const lanes = Math.max(1, careerCount);
  for (let j = 0; j < lanes && outer.length; j++) {
    let best = outer[0];
    let bd = -1;
    outer.forEach((i) => {
      const md = targets.length ? Math.min(...targets.map((t) => nodes[t].distanceTo(nodes[i]))) : nodes[i].z + nodes[i].y;
      if (md > bd) (bd = md), (best = i);
    });
    targets.push(best);
  }
  const pathSeg = [];
  const pathPts = [];
  targets.forEach((tIdx, lane) => {
    const chain = [];
    for (let c = tIdx; c >= 0; c = runs[0].prev[c]) chain.unshift(c);
    const lens = [0];
    for (let k = 1; k < chain.length; k++) lens.push(lens[k - 1] + nodes[chain[k]].distanceTo(nodes[chain[k - 1]]));
    const L = lens[lens.length - 1] || 1;
    for (let k = 1; k < chain.length; k++) {
      pathSeg.push([nodes[chain[k - 1]], lens[k - 1] / L, lane], [nodes[chain[k]], lens[k] / L, lane]);
    }
    chain.forEach((c, k) => pathPts.push([nodes[c], lens[k] / L, lane, k === chain.length - 1 ? 1 : 0]));
  });

  // 기술: 뇌 바깥 은닉층을 거쳐 기술 노드로
  const m = Math.max(1, skillCount);
  const hiddenN = Math.min(6, Math.max(3, Math.ceil(m / 2)));
  // 뇌를 둘러싼 껍질 위에 고르게(황금각) 흩뿌린다. 위아래 끝은 피해 화면에 넓게 퍼지게.
  const shell = (count, rad, phase) =>
    Array.from({ length: count }, (_, i) => {
      const y = count === 1 ? 0.2 : 0.72 - (i / (count - 1)) * 1.3;
      const rr = Math.sqrt(1 - y * y);
      const a = phase + i * Math.PI * (3 - Math.sqrt(5));
      return new THREE.Vector3(Math.cos(a) * rr * rad * 1.15, y * rad * 0.8, Math.sin(a) * rr * rad * 0.7);
    });
  const hidden = shell(hiddenN, S * 1.45, 0.6);
  const skills = shell(m, S * 1.95, 0.2);
  const axSeg = [];
  const axPts = [];
  skills.forEach((sp, lane) => {
    const hA = hidden.reduce((b, h, i) => (h.distanceTo(sp) < hidden[b].distanceTo(sp) ? i : b), 0);
    const hB = (hA + 1) % hiddenN;
    [hA, hB].forEach((h, branch) => {
      const src = nodes[closest(hidden[h].clone().multiplyScalar(0.55))];
      const a = src.distanceTo(hidden[h]);
      const b = hidden[h].distanceTo(sp);
      const L = a + b;
      axSeg.push([src, 0, lane], [hidden[h], a / L, lane], [hidden[h], a / L, lane], [sp, 1, lane]);
      if (!branch) axPts.push([hidden[h], a / L, lane, 0.2]);
    });
    axPts.push([sp, 1, lane, 1]);
  });

  const lineGeo = (segs) => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(segs.length * 3);
    const t = new Float32Array(segs.length);
    const l = new Float32Array(segs.length);
    segs.forEach(([pt, tt, ll], i) => {
      pt.toArray(p, i * 3);
      t[i] = tt;
      l[i] = ll;
    });
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aLane", new THREE.BufferAttribute(l, 1));
    return g;
  };
  const pointGeo = (pts) => {
    const g = lineGeo(pts);
    g.setAttribute("aBig", new THREE.BufferAttribute(new Float32Array(pts.map((x) => x[3])), 1));
    return g;
  };

  const cortex = new THREE.BufferGeometry();
  cortex.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  cortex.setAttribute("aRidge", new THREE.BufferAttribute(ridge, 1));
  cortex.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute("aDist", new THREE.BufferAttribute(nodeDist, 3));
  nodeGeo.setAttribute("aCore", new THREE.BufferAttribute(nodeCore, 1));
  nodeGeo.setAttribute("aSeed", new THREE.BufferAttribute(nodeSeed, 1));
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute("aDist", new THREE.BufferAttribute(edgeDist, 3));

  return {
    cortex,
    nodeGeo,
    edgeGeo,
    pathLines: lineGeo(pathSeg),
    pathNodes: pointGeo(pathPts),
    axLines: lineGeo(axSeg),
    axNodes: pointGeo(axPts),
    src: sources.map((s) => nodes[s].clone()),
    corePos: nodes[core].clone(),
    maxD,
  };
}

export default function BrainWorld({ careerCount, skillCount }) {
  const group = useRef(null);
  const spin = useRef(null);
  const coreGlow = useRef(null);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);

  const brain = useMemo(() => buildBrain(mobile, careerCount, skillCount), [mobile, careerCount, skillCount]);

  const mats = useMemo(() => {
    const shared = {
      uTime: { value: 0 },
      uEnter: { value: 1 },
      uPixel: { value: 1 },
      uCore: { value: 0 },
      uFront: { value: new THREE.Vector3(-9, -9, -9) },
    };
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const path = (color, rate) => ({
      uWeight: { value: 0 },
      uSel: { value: -1 },
      uSeq: { value: 0 },
      uRate: { value: rate },
      uColor: { value: new THREE.Color(color) },
    });
    const careerU = path("#ffd9a0", 0.32);
    const skillU = path("#7fe8ff", 0.42);
    return {
      shared,
      careerU,
      skillU,
      cortex: new THREE.ShaderMaterial({
        ...add,
        vertexShader: CORTEX_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: { ...shared, uSrc: { value: brain.src }, uColor: { value: new THREE.Color("#8f9cff") }, uAccent: { value: new THREE.Color("#c9a8ff") } },
      }),
      nodes: new THREE.ShaderMaterial({ ...add, vertexShader: NODE_VERT, fragmentShader: POINT_FRAG, uniforms: { ...shared, uColor: { value: new THREE.Color("#9fe2ff") } } }),
      edges: new THREE.ShaderMaterial({ ...add, vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, uniforms: { ...shared, uDim: { value: 1 }, uColor: { value: new THREE.Color("#6f8cff") } } }),
      pathLines: new THREE.ShaderMaterial({ ...add, vertexShader: PATH_VERT, fragmentShader: PATH_FRAG, uniforms: { ...shared, ...careerU } }),
      pathNodes: new THREE.ShaderMaterial({ ...add, vertexShader: PATH_NODE_VERT, fragmentShader: POINT_FRAG, uniforms: { ...shared, ...careerU } }),
      axLines: new THREE.ShaderMaterial({ ...add, vertexShader: PATH_VERT, fragmentShader: PATH_FRAG, uniforms: { ...shared, ...skillU } }),
      axNodes: new THREE.ShaderMaterial({ ...add, vertexShader: PATH_NODE_VERT, fragmentShader: POINT_FRAG, uniforms: { ...shared, ...skillU } }),
    };
  }, [brain]);

  const dust = useMemo(() => {
    const count = mobile ? 400 : 1100;
    const r = rng(31);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const rad = S * (1.4 + Math.pow(r(), 0.7) * 2.6);
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = (r() - 0.5) * S * 2.4;
      pos[i * 3 + 2] = Math.sin(a) * rad;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: mats.shared.uTime, uPixel: mats.shared.uPixel, uEnter: mats.shared.uEnter },
    });
    return { g, m };
  }, [mobile, mats]);

  useEffect(
    () => () => {
      ["cortex", "nodeGeo", "edgeGeo", "pathLines", "pathNodes", "axLines", "axNodes"].forEach((k) => brain[k].dispose());
    },
    [brain]
  );
  useEffect(
    () => () => {
      ["cortex", "nodes", "edges", "pathLines", "pathNodes", "axLines", "axNodes"].forEach((k) => mats[k].dispose());
    },
    [mats]
  );
  useEffect(
    () => () => {
      dust.g.dispose();
      dust.m.dispose();
    },
    [dust]
  );

  const w = useRef({ profile: 1, career: 0, skill: 0, seq: 0, mode: -1 });

  useSectionFrame("career", group, (state, dt, p) => {
    const calm = live.reduced ? 0.25 : 1;
    const t = state.clock.elapsedTime * calm;
    const u = mats.shared;
    const mode = live.brainMode;
    const st = w.current;
    if (mode !== st.mode) {
      st.mode = mode;
      st.seq = 0;
    }
    const ease = 1 - Math.exp(-2.4 * dt);
    st.profile += ((mode === 0 ? 1 : 0) - st.profile) * ease;
    st.career += ((mode === 1 ? 1 : 0) - st.career) * ease;
    st.skill += ((mode === 2 ? 1 : 0) - st.skill) * ease;
    st.seq += dt * (live.reduced ? 4 : 1.1);

    u.uTime.value = t;
    u.uEnter.value = p.enter;
    u.uPixel.value = dpr;
    u.uCore.value = st.profile * (0.75 + 0.25 * Math.sin(t * 1.2));
    // 세 발화점의 파면 위치. 그래프 끝까지 가면 다시 처음부터.
    const period = 7.5;
    u.uFront.value.set(
      ((t / period) % 1) * (brain.maxD[0] + 2) - 1,
      (((t + period / 3) / period) % 1) * (brain.maxD[1] + 2) - 1,
      (((t + (period * 2) / 3) / period) % 1) * (brain.maxD[2] + 2) - 1
    );
    mats.edges.uniforms.uDim.value = 1 - 0.45 * Math.max(st.career, st.skill);

    const sel = live.focus;
    mats.careerU.uWeight.value = st.career;
    mats.careerU.uSel.value = mode === 1 ? sel : -1;
    mats.careerU.uSeq.value = mode === 1 ? st.seq : 99;
    mats.skillU.uWeight.value = st.skill;
    mats.skillU.uSel.value = mode === 2 ? sel : -1;
    mats.skillU.uSeq.value = mode === 2 ? st.seq : 99;

    if (coreGlow.current) {
      coreGlow.current.material.opacity = (0.08 + 0.5 * st.profile * (0.8 + 0.2 * Math.sin(t * 1.2))) * p.enter;
      const sc = S * (1.4 + st.profile * 0.9);
      coreGlow.current.scale.set(sc, sc, 1);
    }
    if (spin.current) {
      spin.current.rotation.y = -0.62 + Math.sin(t * 0.11) * 0.2;
      spin.current.rotation.x = 0.1 + Math.sin(t * 0.08 + 1) * 0.03;
    }
    publishFocus(p.settled, null);
  });

  return (
    <group ref={group}>
      <group ref={spin}>
        <sprite ref={coreGlow} position={brain.corePos.toArray()} renderOrder={-1}>
          <spriteMaterial map={glowTexture()} color="#c8b8ff" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <points geometry={brain.cortex} material={mats.cortex} frustumCulled={false} />
        <lineSegments geometry={brain.edgeGeo} material={mats.edges} frustumCulled={false} />
        <points geometry={brain.nodeGeo} material={mats.nodes} frustumCulled={false} />
        <lineSegments geometry={brain.pathLines} material={mats.pathLines} frustumCulled={false} />
        <points geometry={brain.pathNodes} material={mats.pathNodes} frustumCulled={false} />
        <lineSegments geometry={brain.axLines} material={mats.axLines} frustumCulled={false} />
        <points geometry={brain.axNodes} material={mats.axNodes} frustumCulled={false} />
      </group>
      <points geometry={dust.g} material={dust.m} frustumCulled={false} />
    </group>
  );
}
