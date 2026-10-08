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

export const PLANET_POS = [
  [0.9, 0.15, -4],
  [-1.35, 0.55, -22],
  [1.55, -0.35, -40],
  [-1.05, 0.28, -58],
  [0.35, 0.48, -76],
];

export const INTRO_END = 0.07;
export const PROJECT_SPAN = 0.145;
export const CONNECT_START = INTRO_END + JOURNEY_PROJECTS.length * PROJECT_SPAN;
export const PROFILE_START = 0.9;

export const PROJECT_COUNT = JOURNEY_PROJECTS.length;
export const INTRO_SCENE = 0;
export const EXPERIENCE_SCENE = PROJECT_COUNT + 1;
export const CAREER_SCENE = PROJECT_COUNT + 2;
export const CERTS_SCENE = PROJECT_COUNT + 3;
export const PROFILE_SCENE = EXPERIENCE_SCENE;
export const SCENE_MAX = CERTS_SCENE;

export function isProfileScene(scene) {
  return scene >= EXPERIENCE_SCENE;
}

export function profileTabFromScene(scene) {
  if (scene === CAREER_SCENE) return "career";
  if (scene === CERTS_SCENE) return "certs";
  if (scene >= EXPERIENCE_SCENE) return "experience";
  return null;
}

export function sceneFromProfileTab(tab) {
  if (tab === "career") return CAREER_SCENE;
  if (tab === "certs") return CERTS_SCENE;
  return EXPERIENCE_SCENE;
}

/** Settled progress: 0 intro, 1–5 projects (read), 6–8 profile. */
export function sceneToProgress(scene) {
  if (scene <= INTRO_SCENE) return 0.018;
  if (scene <= PROJECT_COUNT) {
    const i = scene - 1;
    return INTRO_END + i * PROJECT_SPAN + PROJECT_SPAN * 0.8;
  }
  return Math.min(0.985, PROFILE_START + 0.045);
}

export function projectIndexFromScene(scene) {
  if (scene >= 1 && scene <= PROJECT_COUNT) return scene - 1;
  return -1;
}

export function sceneFromProjectIndex(i) {
  return Math.min(PROJECT_COUNT, Math.max(1, i + 1));
}

export function projectIndexAt(p) {
  if (p < INTRO_END) return -1;
  if (p >= CONNECT_START) return -2;
  return Math.min(JOURNEY_PROJECTS.length - 1, Math.floor((p - INTRO_END) / PROJECT_SPAN));
}

export function projectLocal(p) {
  const i = projectIndexAt(p);
  if (i < 0) return { i, t: 0 };
  const t = (p - INTRO_END - i * PROJECT_SPAN) / PROJECT_SPAN;
  return { i, t: Math.min(1, Math.max(0, t)) };
}

export function projectStage(t) {
  if (t < 0.14) return { id: "network", u: t / 0.14 };
  if (t < 0.58) return { id: "warp", u: (t - 0.14) / 0.44 };
  if (t < 0.7) return { id: "arrive", u: (t - 0.58) / 0.12 };
  if (t < 0.9) return { id: "read", u: (t - 0.7) / 0.2 };
  return { id: "leave", u: (t - 0.9) / 0.1 };
}

export function warpEase(u) {
  const x = Math.min(1, Math.max(0, u));
  if (x < 0.22) return (x / 0.22) * (x / 0.22) * 0.12;
  if (x < 0.55) {
    const k = (x - 0.22) / 0.33;
    return 0.12 + k * k * 0.7;
  }
  const k = (x - 0.55) / 0.45;
  return 0.82 + (1 - (1 - k) * (1 - k)) * 0.18;
}

/** Slow → accelerate → peak → decelerate → settle. GSAP ease(t). */
export function cinematicEase(t) {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.1) return x * x * 0.7;
  if (x < 0.36) {
    const k = (x - 0.1) / 0.26;
    return 0.007 + k * k * 0.4;
  }
  if (x < 0.58) {
    const k = (x - 0.36) / 0.22;
    return 0.407 + k * 0.33;
  }
  if (x < 0.82) {
    const k = (x - 0.58) / 0.24;
    return 0.737 + (1 - (1 - k) * (1 - k)) * 0.2;
  }
  const k = (x - 0.82) / 0.18;
  return 0.937 + (1 - (1 - k) * (1 - k)) * 0.063;
}

export function matchLive(item, project) {
  const hay = `${item?.team_name || ""} ${item?.title || ""}`.toLowerCase();
  return project.match.some((k) => hay.includes(k));
}
