/**
 * Journey copy — only facts stated in the owner's materials.
 * Images: /projects/{id}.png|webp if present, else DB media cover, else abstract.
 */
export const JOURNEY_PROJECTS = [
  {
    id: "gwon",
    no: "01",
    title: "GWON",
    subtitle: "1-Person E2E Service Implementation",
    period: "",
    role: "1-Person",
    keywords: ["Frontend", "Backend", "Database", "Docker", "Cloudflare", "Server"],
    stack: ["Node.js", "Express", "MySQL", "React", "Docker", "Cloudflare Tunnel", "JWT", "Google OAuth"],
    description: "Bare-metal home server 위에서 여러 서비스를 Docker로 묶어 운영하는 개인 인프라.",
    result: "100+ DAYS UPTIME",
    image: "/projects/gwon.png",
    imageAlt: "GWON 홈 서버 인프라",
    match: ["gwon"],
    effect: "infrastructure",
  },
  {
    id: "meter",
    no: "02",
    title: "METER",
    subtitle: "AIoT Smart Waste Management",
    period: "2026",
    role: "Team Lead",
    keywords: ["AIoT", "Real-time Data", "IoT Infrastructure"],
    stack: ["ESP32", "C/C++", "MQTT", "Spring Boot", "MySQL", "React", "Gemini", "Docker", "Cloudflare"],
    description: "물리 센서 상태를 데이터화해 MQTT와 서버, AI, 대시보드까지 연결한 AIoT 시스템.",
    result: "ICT 빌드업 선정 · 국가지원 300만원",
    image: "/projects/meter.png",
    imageAlt: "METER AIoT 시스템",
    match: ["meter"],
    effect: "data-flow",
  },
  {
    id: "greeneye",
    no: "03",
    title: "GREENEYE",
    subtitle: "AI · IoT · Recycling",
    period: "",
    role: "",
    keywords: ["AI", "IoT", "Recognition", "Reward"],
    stack: ["React", "Spring Boot", "ESP32", "MQTT", "Docker"],
    description: "수거 대상을 인식하고 IoT로 검증한 뒤 리워드로 이어지는 순환 시스템.",
    image: "/projects/greeneye.png",
    imageAlt: "GREENEYE 인식·리워드",
    match: ["greeneye", "그린아이", "greenegye"],
    effect: "neural-recognition",
  },
  {
    id: "tress",
    no: "04",
    title: "TRESS",
    subtitle: "AI Waste Compressor",
    period: "",
    role: "",
    keywords: ["Camera", "YOLO", "Decision", "Motor"],
    stack: ["React", "Spring Boot", "MySQL", "Docker", "MQTT", "Raspberry Pi", "YOLOv8-Lite"],
    description: "비전 판단이 실제 모터와 압축 장치로 이어지는 사이버네틱 머신.",
    image: "/projects/tress.png",
    imageAlt: "TRESS 압축 장치",
    match: ["tress"],
    effect: "mechanical-pulse",
  },
  {
    id: "oj",
    no: "05",
    title: "DEVSIGN OJ",
    subtitle: "Online Judge · Live Service",
    period: "",
    role: "",
    keywords: ["CODE", "COMPILE", "EXECUTE", "RESULT"],
    stack: ["오픈소스 OJ", "자체 서버", "서브도메인"],
    description: "오픈소스 저지를 자체 서버에 올려 실제 동시 접속을 운영한 서비스.",
    result: "50+ CONCURRENT USERS",
    image: "/projects/devsign.png",
    imageAlt: "DEVSIGN Online Judge",
    match: ["devsign", "oj"],
    effect: "code-stream",
  },
];

export const PROJECT_EFFECTS = Object.fromEntries(JOURNEY_PROJECTS.map((p) => [p.id, p.effect]));

export const PROFILE_TABS = [
  { id: "experience", label: "EXPERIENCE" },
  { id: "career", label: "CAREER" },
  { id: "certs", label: "CERTIFICATIONS" },
];

export const WORLDS = [
  { id: "profile", no: "01", label: "PROFILE", world: "earth", hint: "Homeworld" },
  { id: "projects", no: "02", label: "PROJECTS", world: "singularity", hint: "Singularity" },
  { id: "infrastructure", no: "03", label: "INFRASTRUCTURE", world: "station", hint: "Orbital" },
  { id: "credentials", no: "04", label: "CREDENTIALS", world: "atom", hint: "Nucleus" },
  { id: "career", no: "05", label: "CAREER", world: "sun", hint: "Solar core" },
  { id: "activities", no: "06", label: "ACTIVITIES", world: "mars", hint: "Exploration" },
  { id: "awards", no: "07", label: "AWARDS", world: "nebula", hint: "Remnant" },
];

export const PLANET_POS = [
  [0.55, 0.12, -14],
  [-0.7, 0.28, -40],
  [0.85, -0.18, -66],
  [-0.5, 0.32, -92],
  [0.2, 0.08, -118],
  [-0.9, 0.22, -144],
  [0.4, -0.12, -170],
];

export const INTRO_END = 0.08;
export const CORE_END = INTRO_END;
export const PROJECT_SPAN = 0.145;
export const CONNECT_START = 0.82;
export const PROFILE_START = 0.9;
export const JOURNEY_END = 0.985;
export const WORLD_COUNT = WORLDS.length;

export const PROJECT_COUNT = JOURNEY_PROJECTS.length;
export const INTRO_SCENE = 0;
export const EXPERIENCE_SCENE = 6;
export const CAREER_SCENE = 5;
export const CERTS_SCENE = 4;
export const PROFILE_SCENE = 1;
export const SCENE_MAX = WORLD_COUNT;

export function makePlanetPos(n) {
  const count = Math.max(1, n);
  return Array.from({ length: count }, (_, i) => PLANET_POS[i] || [
    Math.sin(i * 1.7) * 0.9,
    Math.cos(i * 1.1) * 0.35,
    -14 - i * 26,
  ]);
}

export function worldCount() {
  return WORLD_COUNT;
}

export function destSpan() {
  return (JOURNEY_END - CORE_END) / WORLD_COUNT;
}

export function worldFromScene(scene) {
  if (scene <= 0) return { id: "core", no: "00", label: "CORE", world: "neural", hint: "Neural core" };
  return WORLDS[scene - 1] || WORLDS[0];
}

export function sceneFromWorld(id) {
  if (id === "core") return 0;
  const i = WORLDS.findIndex((w) => w.id === id);
  return i < 0 ? 0 : i + 1;
}

function liveList() {
  const list = globalThis.__gwonLiveProjects;
  return Array.isArray(list) && list.length ? list : JOURNEY_PROJECTS;
}

export function setLiveProjects(list) {
  globalThis.__gwonLiveProjects = Array.isArray(list) && list.length ? list : null;
}

export function liveProjects() {
  return liveList();
}

export function projectCount() {
  return liveList().length;
}

export function projectSpan() {
  return (CONNECT_START - INTRO_END) / projectCount();
}

export function profileCount() {
  return PROFILE_TABS.length;
}

export function profileSpan() {
  return (JOURNEY_END - CONNECT_START) / profileCount();
}

export function journeyCount() {
  return WORLD_COUNT;
}

export function experienceScene() {
  return sceneFromWorld("activities");
}

export function careerScene() {
  return sceneFromWorld("career");
}

export function certsScene() {
  return sceneFromWorld("credentials");
}

export function sceneMax() {
  return WORLD_COUNT;
}

export function livePlanets() {
  return makePlanetPos(WORLD_COUNT);
}

export function isProfileScene(scene) {
  const id = worldFromScene(scene).id;
  return id === "credentials" || id === "career" || id === "activities" || id === "awards" || id === "profile" || id === "infrastructure";
}

export function profileTabFromScene(scene) {
  const id = worldFromScene(scene).id;
  if (id === "career") return "career";
  if (id === "credentials") return "certs";
  if (id === "activities") return "experience";
  return null;
}

export function sceneFromProfileTab(tab) {
  if (tab === "career") return careerScene();
  if (tab === "certs") return certsScene();
  return experienceScene();
}

function spanOf(scene) {
  return scene <= 0 ? CORE_END : destSpan();
}

function originOf(scene) {
  if (scene <= 0) return 0;
  return CORE_END + (scene - 1) * destSpan();
}

export function sceneToProgress(scene) {
  if (scene <= INTRO_SCENE) return 0.02;
  return originOf(scene) + spanOf(scene) * 0.8;
}

export function warpStartOf(scene) {
  if (scene <= 0) return 0.01;
  return originOf(scene) + spanOf(scene) * 0.14;
}

export function warpEndOf(scene) {
  return originOf(scene) + spanOf(scene) * 0.579;
}

export function leaveHiddenOf(scene) {
  return originOf(scene) + spanOf(scene) * 0.96;
}

export function regionSceneAt(p) {
  for (let s = sceneMax(); s >= 1; s--) {
    if (p >= warpStartOf(s)) return s;
  }
  return 0;
}

export function projectIndexFromScene(scene) {
  return scene <= 0 ? -1 : scene - 1;
}

export function sceneFromProjectIndex(i) {
  return sceneFromWorld("projects");
}

export function projectIndexAt(p) {
  if (p < CORE_END) return -1;
  return Math.min(WORLD_COUNT - 1, Math.floor((p - CORE_END) / destSpan()));
}

export function projectLocal(p) {
  const i = projectIndexAt(p);
  if (i < 0) return { i, t: 0 };
  const span = destSpan();
  const t = (p - CORE_END - i * span) / span;
  return { i, t: Math.min(1, Math.max(0, t)) };
}

export function projectStage(t) {
  if (t < 0.14) return { id: "network", u: t / 0.14 };
  if (t < 0.58) return { id: "warp", u: (t - 0.14) / 0.44 };
  if (t < 0.7) return { id: "arrive", u: (t - 0.58) / 0.12 };
  if (t < 0.9) return { id: "read", u: (t - 0.7) / 0.2 };
  return { id: "leave", u: (t - 0.9) / 0.1 };
}

/** 첫 프레임부터 움직이고(선형 성분), 가운데서 가속했다가 도착하며 감속한다. */
export function warpEase(u) {
  const x = Math.min(1, Math.max(0, u));
  return 0.3 * x + 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * x));
}

/** Slow → accelerate → peak → decelerate → settle. GSAP ease(t). */
export function cinematicEase(t) {
  return waterEase(t);
}

/** cinematicEase 를 시간축으로 뒤집은 것. 뒤로 갈 때 앞으로 가는 움직임을 그대로 역재생한다. */
export function reversedCinematicEase(t) {
  return 1 - waterEase(1 - t);
}

/** 처음 0.1초부터 움직이고, 중간은 물처럼 이어진다. */
export function waterEase(t) {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.08) return x * 1.4;
  const k = (x - 0.08) / 0.92;
  return 0.112 + (1 - Math.pow(1 - k, 1.75)) * 0.888;
}

export function matchLive(item, project) {
  const hay = `${item?.team_name || ""} ${item?.title || ""}`.toLowerCase();
  return project.match.some((k) => hay.includes(k));
}
