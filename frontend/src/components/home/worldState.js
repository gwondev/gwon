/** Shared scroll/pointer state. Read from R3F useFrame, written from the page. */
export const worldState = {
  progress: 0,
  pointerX: 0,
  pointerY: 0,
  reduced: false,
  mobile: false,
};

export const SCENE_COUNT = 8;

export function sceneMix(p) {
  const x = Math.min(SCENE_COUNT - 1, Math.max(0, p) * (SCENE_COUNT - 1));
  const i = Math.min(SCENE_COUNT - 2, Math.floor(x));
  const raw = x - i;
  const t = raw * raw * (3 - 2 * raw);
  return { i, t, j: i + 1 };
}

/** Smooth 0→1→0 envelope inside [a,b] peaking at m. */
export function envelope(p, a, m, b) {
  if (p <= a || p >= b) return 0;
  if (p < m) return (p - a) / (m - a);
  return 1 - (p - m) / (b - m);
}

export const CAM = [
  { t: 0.0, pos: [0.0, 0.2, 16.5], look: [0, 0, 0] },
  { t: 0.1, pos: [0.2, 0.1, 9.2], look: [0, 0, 0] },
  { t: 0.2, pos: [3.4, 1.4, 6.4], look: [0, 0, 0] },
  { t: 0.34, pos: [0.6, 0.9, 5.2], look: [0, 0.1, 0] },
  { t: 0.42, pos: [0.0, 7.2, 7.5], look: [0, 0, 0] },
  { t: 0.5, pos: [0.0, 1.4, 3.6], look: [0, 0.2, 0] },
  { t: 0.62, pos: [0.2, 0.3, 5.0], look: [0, 0, 0] },
  { t: 0.74, pos: [2.8, 0.15, 2.8], look: [0, 0.1, 0] },
  { t: 0.86, pos: [0.0, 0.6, 7.2], look: [0, 0, 0] },
  { t: 1.0, pos: [0.0, 5.4, 18.0], look: [0, 0, 0] },
];

export function sampleCam(p) {
  const t = Math.min(1, Math.max(0, p));
  let k = 0;
  while (k < CAM.length - 2 && CAM[k + 1].t < t) k += 1;
  const a = CAM[k];
  const b = CAM[k + 1];
  const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
  const s = u * u * (3 - 2 * u);
  return {
    pos: [
      a.pos[0] + (b.pos[0] - a.pos[0]) * s,
      a.pos[1] + (b.pos[1] - a.pos[1]) * s,
      a.pos[2] + (b.pos[2] - a.pos[2]) * s,
    ],
    look: [
      a.look[0] + (b.look[0] - a.look[0]) * s,
      a.look[1] + (b.look[1] - a.look[1]) * s,
      a.look[2] + (b.look[2] - a.look[2]) * s,
    ],
  };
}

export const CAPTIONS = [
  {
    kicker: "END-TO-END SYSTEM ENGINEERING",
    title: "GWON",
    line: "BUILDING SYSTEMS, NOT JUST SOFTWARE.",
  },
  {
    kicker: "REVEAL",
    title: "SYSTEM",
    line: "DEVICE · NETWORK · SERVER · AI · INFRASTRUCTURE",
  },
  {
    kicker: "INFRASTRUCTURE",
    title: "GWON",
    line: "MULTI-PROJECT HOME SERVER",
    meta: "Docker · Node.js · MySQL · Cloudflare · JWT / OAuth",
  },
  {
    kicker: "PHYSICAL WORLD → DATA",
    title: "METER",
    line: "SENSOR · MQTT · BACKEND · AI · DASHBOARD",
    meta: "ESP32 · C/C++ · Spring Boot · MySQL · Gemini · Docker",
    note: "2026 ICT이노베이션스퀘어 ICT 빌드업 · 국가지원 300만원",
  },
  {
    kicker: "AI → RECOGNITION → ACTION",
    title: "GREENEYE",
    line: "IMAGE · CLASSIFICATION · IOT · REWARD",
    meta: "React · Spring Boot · ESP32 · MQTT · Docker",
  },
  {
    kicker: "AI → MACHINE",
    title: "TRESS",
    line: "VISION · DECISION · MOTOR · COMPRESSION",
    meta: "Raspberry Pi · YOLOv8-Lite · MQTT · Spring Boot · MySQL",
  },
  {
    kicker: "CODE → COMPUTE → RESULT",
    title: "DEVSIGN OJ",
    line: "COMPILE · EXECUTE · QUEUE · RESULT",
    meta: "오픈소스 OJ · 자체 서버 · 서브도메인 · 동시 접속 운영",
  },
  {
    kicker: "THE SYSTEM",
    title: "I BUILD SYSTEMS.",
    line: "DEVICE → DATA → SOFTWARE → INFRASTRUCTURE",
  },
];
