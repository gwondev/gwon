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
  },
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
  if (t < 0.16) return { id: "network", u: t / 0.16 };
  if (t < 0.42) return { id: "warp", u: (t - 0.16) / 0.26 };
  if (t < 0.55) return { id: "arrive", u: (t - 0.42) / 0.13 };
  if (t < 0.86) return { id: "read", u: (t - 0.55) / 0.31 };
  return { id: "leave", u: (t - 0.86) / 0.14 };
}

export function warpEase(u) {
  const x = Math.min(1, Math.max(0, u));
  if (x < 0.18) return (x / 0.18) * 0.07;
  if (x < 0.55) {
    const k = (x - 0.18) / 0.37;
    return 0.07 + k * k * 0.78;
  }
  const k = (x - 0.55) / 0.45;
  return 0.85 + (1 - (1 - k) * (1 - k)) * 0.15;
}

export function matchLive(item, project) {
  const hay = `${item?.team_name || ""} ${item?.title || ""}`.toLowerCase();
  return project.match.some((k) => hay.includes(k));
}
