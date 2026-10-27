import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { live, setFocus } from "../director.js";
import { POINT_FRAG, glowTexture, rng } from "./util.js";
import { publishFocus, useSectionFrame } from "./useSection.js";
import { cardFacts, cardStyle } from "./cardStyles.js";

/**
 * CERTIFICATIONS — 우주 속 홀로그램 카드.
 * 자격증 하나가 카드 한 장이다. 고르지 않은 카드는 뒤쪽 고리를 따라 천천히 돌고,
 * 고른 카드는 무게감 있게 앞으로 나와 뒤집히며 정면을 본다. 표면에는 시야각에 따라 변하는
 * 무지갯빛 반사, 가로지르는 빛줄기, 별빛 반짝임, 테두리를 따라 흐르는 빛이 있다.
 * 카드 꾸밈(색·문양)은 cardStyles.js 에서 따로 관리하고, 글자는 실제 자격증 데이터만 쓴다.
 */
const W = 2.0;
const H = 2.8;
const R = 0.13;
const T = 0.03;
const BEVEL = 0.014;
const FACE_Z = T / 2 + BEVEL + 0.002;
const TEX_W = 420;
const TEX_H = 588;

const SQ = /* glsl */ `
  float sq(float x) { return x * x; }
  vec3 sq3(vec3 x) { return x * x; }
`;

const FACE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FACE_FRAG = /* glsl */ `
${SQ}
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uSweep;
  uniform float uFocus;
  uniform float uDim;
  uniform float uEnter;
  uniform float uSeed;
  uniform float uBack;
  uniform vec3 uGlow;
  uniform vec3 uAccent;
  uniform vec3 uBase;
  uniform vec2 uSize;
  uniform float uRadius;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRound(p, uSize * 0.5, uRadius);
    if (d > 0.0) discard;
    float alpha = smoothstep(0.0, -0.006, d) * uEnter;

    vec4 tex = texture2D(uMap, vUv);
    vec3 col = tex.rgb;
    if (uBack > 0.5) col = mix(uBase, uGlow, tex.r) + uAccent * tex.g * 0.9;

    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float facing = max(dot(n, v), 0.0);
    float fres = pow(1.0 - facing, 1.4);

    // 시야각과 위치에 따라 띠처럼 바뀌는 무지갯빛. 글자(밝은 곳)에는 약하게.
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float mask = smoothstep(0.85, 0.12, lum);
    float ang = dot(v, vec3(1.3, 0.9, 0.4)) * 2.4 + (vUv.x * 0.9 + vUv.y * 1.3) * 1.6 + uSeed;
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + ang));
    irid = mix(irid, uGlow, 0.35);
    col += irid * (0.06 + 0.32 * fres + 0.08 * uFocus) * mask;

    // 표면을 대각선으로 가로지르는 빛줄기.
    float s = vUv.x * 0.62 + (1.0 - vUv.y) * 0.38;
    float band = exp(-sq((s - uSweep) * 7.5));
    float thin = exp(-sq((s - uSweep + 0.07) * 26.0));
    col += mix(vec3(1.0), irid, 0.45) * (band * 0.42 + thin * 0.35);

    // 별빛 반짝임: 칸마다 하나의 별이 제 박자로 깜빡인다.
    vec2 g = vUv * vec2(18.0, 25.0);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + uSeed * 7.0);
    vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.55;
    vec2 q = f - off;
    float tw = pow(0.5 + 0.5 * sin(uTime * (0.8 + h * 2.2) + h * 40.0), 10.0);
    float core = smoothstep(0.09, 0.0, length(q));
    float crs = smoothstep(0.018, 0.0, abs(q.x)) * smoothstep(0.32, 0.0, abs(q.y))
                + smoothstep(0.018, 0.0, abs(q.y)) * smoothstep(0.32, 0.0, abs(q.x));
    float spark = step(0.86, h) * tw * (core + crs * 0.7);
    col += mix(vec3(1.0), uGlow, 0.3) * spark * (0.55 + 0.6 * fres + 0.3 * uFocus) * mask;

    // 테두리 안쪽을 따라 흐르는 빛.
    float rim = smoothstep(-0.07, 0.0, d);
    float around = atan(p.y, p.x);
    float flow = pow(0.5 + 0.5 * sin(around * 2.0 - uTime * 1.1 + uSeed), 3.0);
    col += uGlow * rim * (0.18 + 0.5 * flow * (0.35 + 0.65 * uFocus));

    col *= mix(1.0, 0.42, uDim);
    gl_FragColor = vec4(col, alpha);
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
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.05 + aSeed * 0.08) + 4.0, 8.0) - 4.0;
    p.x += sin(uTime * 0.3 + aSeed * 50.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.7), step(0.7, aSeed));
    vAlpha = (0.2 + 0.8 * pow(0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 80.0), 6.0)) * uEnter;
    gl_PointSize = (0.6 + aSeed * 1.4) * uPixel * (34.0 / -mv.z);
  }
`;

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function starPath(g, cx, cy, outer, inner, points, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
}

/** 문양: 카드 가운데 장식. 스타일마다 다르게. */
function drawPattern(g, style, cx, cy, size, seed) {
  const r = rng(seed);
  g.save();
  g.strokeStyle = style.glow;
  g.fillStyle = style.glow;
  g.lineWidth = 1.2;
  switch (style.pattern) {
    case "orbit":
      for (let i = 0; i < 4; i++) {
        g.globalAlpha = 0.45 - i * 0.08;
        g.beginPath();
        g.ellipse(cx, cy, size * (0.45 + i * 0.17), size * (0.16 + i * 0.07), (i * Math.PI) / 5, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    case "rays":
      g.globalAlpha = 0.28;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const l = size * (i % 3 ? 0.62 : 0.95);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * size * 0.3, cy + Math.sin(a) * size * 0.3);
        g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
        g.stroke();
      }
      break;
    case "grid":
      g.globalAlpha = 0.18;
      for (let i = -5; i <= 5; i++) {
        g.beginPath();
        g.moveTo(cx + i * size * 0.16, cy - size);
        g.lineTo(cx + i * size * 0.16, cy + size);
        g.moveTo(cx - size, cy + i * size * 0.16);
        g.lineTo(cx + size, cy + i * size * 0.16);
        g.stroke();
      }
      break;
    case "waves":
      for (let k = 0; k < 7; k++) {
        g.globalAlpha = 0.12 + k * 0.03;
        g.beginPath();
        for (let x = -size; x <= size; x += 4) {
          const y = cy + (k - 3) * size * 0.16 + Math.sin(x / (size * 0.18) + k) * size * 0.06;
          if (x === -size) g.moveTo(cx + x, y);
          else g.lineTo(cx + x, y);
        }
        g.stroke();
      }
      break;
    case "rings":
      for (let i = 1; i <= 6; i++) {
        g.globalAlpha = 0.34 - i * 0.04;
        g.beginPath();
        g.arc(cx, cy, size * i * 0.15, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    case "lattice":
      g.globalAlpha = 0.22;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath();
        for (let k = 0; k <= 6; k++) {
          const b = (k / 6) * Math.PI * 2;
          const x = cx + Math.cos(a) * size * 0.42 + Math.cos(b) * size * 0.42;
          const y = cy + Math.sin(a) * size * 0.42 + Math.sin(b) * size * 0.42;
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      break;
    case "nova":
      g.globalAlpha = 0.2;
      for (let i = 0; i < 3; i++) {
        starPath(g, cx, cy, size * (0.95 - i * 0.22), size * (0.2 - i * 0.04), 8, (i * Math.PI) / 8);
        g.stroke();
      }
      break;
    case "meridian":
      for (let i = 0; i < 7; i++) {
        g.globalAlpha = 0.24;
        g.beginPath();
        g.ellipse(cx, cy, size * 0.85 * Math.abs(Math.cos((i / 7) * Math.PI)), size * 0.85, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(cx - size * 0.85, cy);
      g.lineTo(cx + size * 0.85, cy);
      g.stroke();
      break;
    case "prism":
      g.globalAlpha = 0.24;
      for (let i = 0; i < 5; i++) {
        const s = size * (0.3 + i * 0.16);
        g.beginPath();
        g.moveTo(cx, cy - s);
        g.lineTo(cx + s * 0.87, cy + s * 0.5);
        g.lineTo(cx - s * 0.87, cy + s * 0.5);
        g.closePath();
        g.stroke();
      }
      break;
    default: {
      // constellation
      const pts = Array.from({ length: 11 }, () => [cx + (r() - 0.5) * size * 1.8, cy + (r() - 0.5) * size * 1.6]);
      g.globalAlpha = 0.3;
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const [nx, ny] = pts[(i * 3 + 1) % pts.length];
        g.moveTo(x, y);
        g.lineTo(nx, ny);
      });
      g.stroke();
      g.globalAlpha = 0.8;
      pts.forEach(([x, y]) => {
        g.beginPath();
        g.arc(x, y, 1.4 + r() * 1.6, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  g.restore();
}

function wrap(g, text, maxW, maxLines) {
  const words = String(text).split(/(\s+)/);
  const lines = [];
  let line = "";
  const push = (piece) => {
    const test = line + piece;
    if (g.measureText(test).width <= maxW || !line) {
      line = test;
      return;
    }
    lines.push(line.trim());
    line = piece.trimStart();
  };
  words.forEach((w) => {
    if (g.measureText(w).width > maxW) [...w].forEach(push);
    else push(w);
  });
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/.$/, "")}…`;
  }
  return lines;
}

const SANS = '"Pretendard Variable", "Pretendard", system-ui, sans-serif';
const DISPLAY = '"Outfit", "Pretendard Variable", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function drawFace(canvas, item, index, total, style) {
  const g = canvas.getContext("2d");
  const w = canvas.width;
  const k = w / TEX_W;
  g.setTransform(k, 0, 0, k, 0, 0);
  const cw = TEX_W;
  const ch = TEX_H;
  const facts = cardFacts(item);

  const bg = g.createLinearGradient(0, 0, cw, ch);
  bg.addColorStop(0, style.base2);
  bg.addColorStop(0.55, style.base);
  bg.addColorStop(1, "#04050c");
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const glow = g.createRadialGradient(cw / 2, ch * 0.36, 10, cw / 2, ch * 0.36, cw * 0.62);
  glow.addColorStop(0, `${style.glow}55`);
  glow.addColorStop(1, `${style.glow}00`);
  g.fillStyle = glow;
  g.fillRect(0, 0, cw, ch);

  const r = rng(97 + index * 13);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.15 + r() * 0.5;
    g.fillStyle = r() > 0.8 ? style.accent : "#ffffff";
    g.fillRect(r() * cw, r() * ch, r() > 0.9 ? 1.6 : 0.9, r() > 0.9 ? 1.6 : 0.9);
  }
  g.globalAlpha = 1;

  // 액자 테두리 두 줄
  g.strokeStyle = style.glow;
  g.globalAlpha = 0.75;
  g.lineWidth = 1.6;
  roundRect(g, 16, 16, cw - 32, ch - 32, 18);
  g.stroke();
  g.globalAlpha = 0.3;
  g.lineWidth = 1;
  roundRect(g, 24, 24, cw - 48, ch - 48, 13);
  g.stroke();
  g.globalAlpha = 1;

  // 모서리 표식: 번호와 별 (포커 카드의 모서리 지표처럼, 반대쪽은 뒤집어서)
  const corner = (rot) => {
    g.save();
    if (rot) {
      g.translate(cw, ch);
      g.rotate(Math.PI);
    }
    g.fillStyle = "#ffffff";
    g.font = `600 30px ${DISPLAY}`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(String(index + 1).padStart(2, "0"), 50, 66);
    g.fillStyle = style.accent;
    starPath(g, 50, 88, 9, 3.4, style.points);
    g.fill();
    g.restore();
  };
  corner(false);
  corner(true);

  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `500 12px ${MONO}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("C E R T I F I E D", cw / 2, 52);
  g.fillText(`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, cw / 2, 72);

  // 가운데 문장(紋章)
  const ey = ch * 0.34;
  drawPattern(g, style, cw / 2, ey, 104, 31 + index * 7);
  g.save();
  g.strokeStyle = style.accent;
  g.globalAlpha = 0.85;
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(cw / 2, ey, 46, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.35;
  g.beginPath();
  g.arc(cw / 2, ey, 54, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  const sg = g.createRadialGradient(cw / 2, ey, 2, cw / 2, ey, 34);
  sg.addColorStop(0, "#ffffff");
  sg.addColorStop(1, style.accent);
  g.fillStyle = sg;
  starPath(g, cw / 2, ey, 30, 10, style.points);
  g.fill();
  g.restore();

  // 자격증 이름
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  let size = 34;
  g.font = `700 ${size}px ${SANS}`;
  let lines = wrap(g, facts.title, cw - 90, 3);
  if (lines.length > 2) {
    size = 28;
    g.font = `700 ${size}px ${SANS}`;
    lines = wrap(g, facts.title, cw - 90, 3);
  }
  const ty = ch * 0.56;
  lines.forEach((ln, i) => g.fillText(ln, cw / 2, ty + i * size * 1.22));
  const after = ty + (lines.length - 1) * size * 1.22;

  g.strokeStyle = style.glow;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.moveTo(cw / 2 - 60, after + 24);
  g.lineTo(cw / 2 + 60, after + 24);
  g.stroke();
  g.globalAlpha = 1;

  if (facts.issuer) {
    g.fillStyle = "rgba(235,240,255,0.82)";
    g.font = `500 18px ${SANS}`;
    const il = wrap(g, facts.issuer, cw - 100, 2);
    il.forEach((ln, i) => g.fillText(ln, cw / 2, after + 56 + i * 24));
  }
  if (facts.date) {
    g.fillStyle = "rgba(235,240,255,0.62)";
    g.font = `500 16px ${MONO}`;
    g.fillText(facts.date, cw / 2, ch - 96);
  }
  if (facts.grade) {
    g.font = `700 17px ${SANS}`;
    const tw = g.measureText(facts.grade).width + 34;
    g.fillStyle = `${style.accent}26`;
    g.strokeStyle = style.accent;
    roundRect(g, cw / 2 - tw / 2, ch - 80, tw, 30, 15);
    g.fill();
    g.stroke();
    g.fillStyle = style.accent;
    g.textBaseline = "middle";
    g.fillText(facts.grade, cw / 2, ch - 65);
  }
}

/** 뒷면은 한 장을 모든 카드가 나눠 쓴다. R=문양 밝기, G=강조. 셰이더에서 카드 색으로 물들인다. */
function drawBack(canvas) {
  const g = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = rng(5);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.round(80 + r() * 175)},0,0,1)`;
    g.fillRect(r() * w, r() * h, 1.2, 1.2);
  }
  g.strokeStyle = "rgb(150,0,0)";
  g.lineWidth = 1.2;
  roundRect(g, 18, 18, w - 36, h - 36, 18);
  g.stroke();
  g.strokeStyle = "rgb(70,0,0)";
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
    g.lineTo(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190);
    g.stroke();
  }
  for (let i = 1; i <= 4; i++) {
    g.strokeStyle = `rgb(${150 - i * 22},0,0)`;
    g.beginPath();
    g.arc(cx, cy, 40 + i * 30, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "rgb(255,255,0)";
  starPath(g, cx, cy, 34, 9, 4);
  g.fill();
  g.fillStyle = "rgb(200,0,0)";
  g.font = `600 15px ${MONO}`;
  g.textAlign = "center";
  g.fillText("G W O N . R U N", cx, h - 52);
}

/** 감쇠 스프링 하나. 너무 딱 떨어지지 않게 아주 살짝만 넘쳤다가 선다. */
function spring(state, key, target, dt, k = 30, c = 9.5) {
  const v = `${key}V`;
  state[v] = (state[v] || 0) + (target - state[key]) * k * dt;
  state[v] *= Math.exp(-c * dt);
  state[key] += state[v] * dt;
}

export default function CardWorld({ items }) {
  const group = useRef(null);
  const cardRefs = useRef([]);
  const spot = useRef(null);
  const keyLight = useRef(null);
  const mobile = useThree((s) => s.size.width < 768);
  const dpr = useThree((s) => s.viewport.dpr);
  const gl = useThree((s) => s.gl);
  const n = items.length;

  const shared = useMemo(() => {
    const face = new THREE.PlaneGeometry(W, H);
    const body = new THREE.ExtrudeGeometry(roundedShape(W - BEVEL * 2, H - BEVEL * 2, R - BEVEL), {
      depth: T,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 3,
      curveSegments: 10,
    });
    body.translate(0, 0, -T / 2);
    const backCanvas = document.createElement("canvas");
    backCanvas.width = 320;
    backCanvas.height = 448;
    drawBack(backCanvas);
    const back = new THREE.CanvasTexture(backCanvas);
    back.anisotropy = 4;
    return { face, body, back };
  }, []);

  const textKey = items.map((it) => `${it.id}|${it.title}|${it.subtitle}|${it.description}|${it.issuer}|${it.acquired}|${it.score}`).join("§");

  const cards = useMemo(() => {
    const scale = mobile ? 0.78 : 1;
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return items.map((item, i) => {
      const style = cardStyle(i);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(TEX_W * scale);
      canvas.height = Math.round(TEX_H * scale);
      drawFace(canvas, item, i, items.length, style);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      const uniforms = () => ({
        uTime: { value: 0 },
        uSweep: { value: -1 },
        uFocus: { value: 0 },
        uDim: { value: 0 },
        uEnter: { value: 1 },
        uSeed: { value: i * 1.37 },
        uGlow: { value: new THREE.Color(style.glow) },
        uAccent: { value: new THREE.Color(style.accent) },
        uBase: { value: new THREE.Color(style.base) },
        uSize: { value: new THREE.Vector2(W, H) },
        uRadius: { value: R },
      });
      const front = new THREE.ShaderMaterial({ vertexShader: FACE_VERT, fragmentShader: FACE_FRAG, transparent: true, uniforms: { ...uniforms(), uMap: { value: tex }, uBack: { value: 0 } } });
      const back = new THREE.ShaderMaterial({ vertexShader: FACE_VERT, fragmentShader: FACE_FRAG, transparent: true, uniforms: { ...uniforms(), uMap: { value: shared.back }, uBack: { value: 1 } } });
      const edge = new THREE.MeshStandardMaterial({ color: style.glow, metalness: 0.85, roughness: 0.28, emissive: new THREE.Color(style.glow), emissiveIntensity: 0.35, transparent: true });
      return { item, style, canvas, tex, front, back, edge, s: { x: 0, y: 0, z: -12, yaw: 0, pitch: 0, roll: 0, sc: 0.4, focus: 0, picked: -1 } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey, mobile, shared, gl]);

  // 웹폰트가 늦게 도착하면 카드 글자를 다시 그린다.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => {
      if (!alive) return;
      cards.forEach((c, i) => {
        drawFace(c.canvas, c.item, i, cards.length, c.style);
        c.tex.needsUpdate = true;
      });
    });
    return () => {
      alive = false;
    };
  }, [cards]);

  useEffect(
    () => () => {
      cards.forEach((c) => {
        c.tex.dispose();
        c.front.dispose();
        c.back.dispose();
        c.edge.dispose();
      });
    },
    [cards]
  );
  useEffect(
    () => () => {
      shared.face.dispose();
      shared.body.dispose();
      shared.back.dispose();
    },
    [shared]
  );

  const dust = useMemo(() => {
    const count = mobile ? 260 : 700;
    const r = rng(77);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * 16;
      pos[i * 3 + 1] = (r() - 0.5) * 8;
      pos[i * 3 + 2] = -6 + r() * 11;
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
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uEnter: { value: 1 } },
    });
    return { g, m };
  }, [mobile]);
  useEffect(
    () => () => {
      dust.g.dispose();
      dust.m.dispose();
    },
    [dust]
  );

  const spotColor = useMemo(() => new THREE.Color(), []);
  const pickedAt = useRef({ index: -1, time: 0 });

  useSectionFrame("credentials", group, (state, dt, p) => {
    const calm = live.reduced ? 0.25 : 1;
    const time = state.clock.elapsedTime;
    const t = time * calm;
    const sel = live.focus >= 0 && live.focus < n ? live.focus : -1;
    if (sel !== pickedAt.current.index) pickedAt.current = { index: sel, time };

    const ringR = Math.min(8.5, Math.max(4.4, 2.4 + n * 0.3));
    const ringZ = -ringR * 0.55 - (sel >= 0 ? 2.2 : 0.6);
    const ringY = sel >= 0 ? -0.6 : -0.2;
    const ringScale = (n > 14 ? 0.5 : 0.62) * (sel >= 0 ? 0.9 : 1);
    const spin = t * 0.045;
    const fast = live.reduced ? 3 : 1;

    cards.forEach((c, i) => {
      const s = c.s;
      const on = i === sel;
      let tx, ty, tz, tyaw, tpitch, troll, tsc;
      if (on) {
        if (s.picked !== pickedAt.current.time) {
          s.picked = pickedAt.current.time;
          // 정면까지 최소 반 바퀴는 돌아 들어오게 목표 각을 잡는다.
          s.flipTo = Math.ceil((s.yaw + Math.PI * 0.55) / (Math.PI * 2)) * Math.PI * 2;
        }
        tx = 0;
        // 모바일은 아래 목록 패널을 피해 화면 위쪽 빈자리에 세운다.
        ty = (mobile ? 3.8 : 0.05) + Math.sin(t * 0.8) * 0.05;
        tz = mobile ? 17 : 4.4;
        tyaw = s.flipTo + live.pointerX * 0.2 * calm + Math.sin(t * 0.55) * 0.05;
        tpitch = -live.pointerY * 0.13 * calm + Math.sin(t * 0.43) * 0.03;
        troll = Math.sin(t * 0.37) * 0.015;
        tsc = 1;
      } else {
        // 납작한 타원 궤도. 카드는 늘 앞면이 보이도록 카메라 쪽을 향하고, 궤도 방향으로만 살짝 튼다.
        const a = spin + (i / Math.max(1, n)) * Math.PI * 2;
        tx = Math.sin(a) * ringR * 1.25;
        tz = ringZ + Math.cos(a) * ringR * 0.55;
        ty = ringY + Math.sin(a * 2 + t * 0.4) * 0.18 - Math.cos(a) * 0.35;
        const face = Math.sin(a) * 0.55;
        tyaw = face + Math.PI * 2 * Math.round((s.yaw - face) / (Math.PI * 2));
        tpitch = 0.06;
        troll = Math.sin(t * 0.3 + i) * 0.03;
        tsc = ringScale;
      }
      const k = (on ? 26 : 18) * fast;
      spring(s, "x", tx, dt, k);
      spring(s, "y", ty, dt, k);
      spring(s, "z", tz, dt, k);
      spring(s, "yaw", tyaw, dt, on ? 16 * fast : 22 * fast, 7.5);
      spring(s, "pitch", tpitch, dt, 20, 8);
      spring(s, "roll", troll, dt, 20, 8);
      spring(s, "sc", tsc, dt, k);
      s.focus += ((on ? 1 : 0) - s.focus) * (1 - Math.exp(-3 * dt));

      const ref = cardRefs.current[i];
      if (ref) {
        ref.position.set(s.x, s.y, s.z);
        ref.rotation.set(s.pitch, s.yaw, s.roll);
        ref.scale.setScalar(Math.max(0.01, s.sc * (0.5 + 0.5 * p.enter)));
      }

      // 고른 카드는 도착하고 나서 빛줄기가 한 번 지나가고, 이후 몇 초마다 은은하게 다시 지나간다.
      let sweep;
      if (on) {
        const since = time - pickedAt.current.time - 0.7;
        sweep = since < 0 ? -1 : -0.4 + ((since % 6) / 1.5) * 1.8;
      } else {
        sweep = -0.4 + (((t * 0.12 + i * 0.37) % 1.6) / 1.6) * 3.2;
      }
      const dim = sel >= 0 && !on ? 0.55 : 0.12;
      [c.front, c.back].forEach((m) => {
        const u = m.uniforms;
        u.uTime.value = t;
        u.uSweep.value = sweep;
        u.uFocus.value = s.focus;
        u.uDim.value += (dim - u.uDim.value) * (1 - Math.exp(-3 * dt));
        u.uEnter.value = p.enter;
      });
      c.edge.opacity = p.enter;
      c.edge.emissiveIntensity = 0.25 + s.focus * 0.55;
    });

    // 고른 카드 뒤의 집중 조명.
    const pick = sel >= 0 ? cards[sel] : null;
    if (spot.current) {
      const target = pick ? 0.3 : 0;
      spot.current.material.opacity += (target * p.enter - spot.current.material.opacity) * (1 - Math.exp(-2.5 * dt));
      if (pick) {
        spot.current.position.set(pick.s.x, pick.s.y, pick.s.z - 0.6);
        spotColor.set(pick.style.glow);
        spot.current.material.color.lerp(spotColor, 1 - Math.exp(-3 * dt));
      }
    }
    if (keyLight.current) keyLight.current.intensity += ((pick ? 70 : 30) - keyLight.current.intensity) * (1 - Math.exp(-2 * dt));

    dust.m.uniforms.uTime.value = t;
    dust.m.uniforms.uPixel.value = dpr;
    dust.m.uniforms.uEnter.value = p.enter;
    publishFocus(p.settled, null);
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[-5, 6, 8]} intensity={1.6} color="#e8eeff" />
      <pointLight ref={keyLight} position={[0, 2.6, 7]} intensity={30} color="#fff3e0" distance={24} />
      <pointLight position={[6, -3, 2]} intensity={24} color="#7f9dff" distance={22} />
      <sprite ref={spot} scale={[7, 7, 1]} renderOrder={-1}>
        <spriteMaterial map={glowTexture()} color="#a9c4ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <points geometry={dust.g} material={dust.m} frustumCulled={false} />
      {cards.map((c, i) => (
        <group
          key={c.item.id || i}
          ref={(el) => (cardRefs.current[i] = el)}
          position={[0, 0, -12]}
          onClick={(e) => {
            e.stopPropagation();
            setFocus(live.focus === i ? -1 : i);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <mesh geometry={shared.body} material={c.edge} />
          <mesh geometry={shared.face} material={c.front} position={[0, 0, FACE_Z]} />
          <mesh geometry={shared.face} material={c.back} position={[0, 0, -FACE_Z]} rotation={[0, Math.PI, 0]} />
        </group>
      ))}
    </group>
  );
}
