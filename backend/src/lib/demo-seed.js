/** 포트폴리오 탭 미리보기용 임시 시드 데이터 (테이블이 비어 있을 때만 삽입) */
import { DEFAULT_TECH_STACK } from "./tech-stack-defaults.js";

export const DEMO_TECH_STACK = [
  { group: "Programming", items: ["Java", "Python", "C++", "JavaScript", "TypeScript"] },
  { group: "Infra", items: ["Docker", "Linux", "Git", "Cloudflare", "MySQL"] },
  { group: "IoT", items: ["MQTT", "Arduino", "ESP32", "Raspberry Pi"] },
  { group: "AI", items: ["TensorFlow", "PyTorch", "OpenCV", "scikit-learn"] },
];

export const DEMO_PROJECTS = [
  {
    title: "스마트팜 환경 모니터링",
    category: "IoT, AI",
    host: "교내 캡스톤",
    team_name: "그린아이",
    members: "이성권, 팀원A, 팀원B",
    period: "2025.03.01 ~ 2025.06.30",
    description: "IoT 센서와 AI 분석을 결합한 스마트팜 프로토타입.",
    home_featured: 1,
  },
  {
    title: "자율주행 청소 로봇",
    category: "AI, ROBOT",
    host: "교내 프로젝트",
    team_name: "TRESS",
    members: "이성권, 팀원C, 팀원D",
    period: "2024.09.01 ~ 2024.12.15",
    description: "SLAM·경로 계획 기반 실내 로봇 제어.",
    home_featured: 1,
  },
  {
    title: "실시간 이동 관리 시스템",
    category: "IoT, 웹",
    host: "교내 SW 경진대회",
    team_name: "MOVE",
    members: "이성권, 팀원E",
    period: "2025.01.15 ~ 2025.03.20",
    description: "GPS·IoT 디바이스 연동 이동 추적 웹 서비스.",
    home_featured: 0,
  },
  {
    title: "포트폴리오 웹 플랫폼",
    category: "웹",
    host: "개인 프로젝트",
    team_name: "DEVSIGN",
    members: "이성권",
    period: "2025.10.01 ~ 2026.03.01",
    url: "https://gwon.dev",
    description: "React + Node.js 기반 개인 포트폴리오 사이트.",
    home_featured: 0,
  },
  {
    title: "TRACE 해커톤",
    category: "IoT, AI",
    host: "OO 재단",
    team_name: "TRACE",
    members: "이성권, 팀원F, 팀원G",
    award: "똥쌍",
    period: "2024.05.10 ~ 2024.05.12",
    description: "48시간 해커톤 — 엣지 AI + IoT 연동 과제.",
  },
  {
    title: "TESS AI 챌린지",
    category: "AI",
    host: "XX 협회",
    team_name: "TESS",
    members: "이성권, 팀원H",
    award: "우쑤쌍",
    period: "2025.11.01 ~ 2025.11.03",
    description: "컴퓨터 비전 기반 분류 모델 경진.",
  },
];

export const DEMO_ACTIVITIES = [
  {
    title: "MG 청년누리",
    organization: "MG 지역 청년센터",
    role: "멘티",
    period: "2026.01.01 ~ 2026.12.31",
    description: "청년 역량 강화·멘토링 프로그램 참여.",
  },
  {
    title: "멋쟁이사자처럼 13기",
    organization: "멋쟁이사자처럼",
    role: "백엔드",
    period: "2024.02.01 ~ 2024.08.31",
    description: "아이디어톤·해커톤 중심 SW 창업 동아리 활동.",
  },
  {
    title: "GWON 프로젝트 동아리",
    organization: "OO대학교",
    role: "팀장",
    period: "2023.03.01 ~ 2024.02.28",
    description: "IoT·웹 프로젝트 기획 및 팀 운영.",
  },
  {
    title: "SW 마스터 Class",
    organization: "OO 재단",
    role: "수료",
    period: "2025.06.01 ~ 2025.08.31",
    description: "풀스택·클라우드 집중 과정.",
  },
];

export const DEMO_CERTIFICATIONS = [
  {
    title: "정보처리기사",
    issuer: "한국산업인력공단",
    acquired: "2025.06",
    score: "합격",
    description: "필기·실기 취득.",
  },
  {
    title: "SQLD",
    issuer: "한국데이터산업진흥원",
    acquired: "2024.11",
    score: "합격",
    description: "SQL 개발자 자격.",
  },
  {
    title: "AWS Solutions Architect Associate",
    issuer: "Amazon Web Services",
    acquired: "2025.03",
    description: "클라우드 아키텍처 설계.",
  },
  {
    title: "리눅스마스터 2급",
    issuer: "KAIT",
    acquired: "2024.08",
    score: "합격",
    description: "Linux 시스템 운영 기초.",
  },
];

export const DEMO_CAREERS = [
  {
    title: "(주)그원",
    category: "인턴",
    position: "백엔드 개발",
    period: "2025.07.01 ~ 2025.08.31",
    description: "Node.js API·MySQL 스키마 설계 및 유지보수.",
  },
  {
    title: "OO 카페",
    category: "알바",
    position: "매장 스태프",
    period: "2024.06.01 ~ 2024.06.30",
    description: "POS·재고 관리 및 고객 응대.",
  },
  {
    title: "스타트업 A",
    category: "계약직",
    position: "풀스택",
    period: "2025.09.01 ~ 2026.02.28",
    description: "React 프론트·Express 백엔드 기능 개발.",
  },
  {
    title: "교내 연구실",
    category: "연구보조",
    position: "IoT 연구",
    period: "2024.03.01 ~ 2024.05.31",
    description: "센서 데이터 수집 파이프라인 구축.",
  },
];

async function tableEmpty(conn, table) {
  const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
  return Number(cnt) === 0;
}

async function insertRows(conn, table, rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const data = { ...row, sort_order: i };
    const keys = Object.keys(data);
    const values = keys.map((k) => data[k]);
    const placeholders = keys.map(() => "?").join(", ");
    await conn.query(
      `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(", ")}) VALUES (${placeholders})`,
      values
    );
  }
}

export async function seedDemoContent(conn) {
  let seeded = false;

  if (await tableEmpty(conn, "projects")) {
    await insertRows(conn, "projects", DEMO_PROJECTS);
    console.log("[db] demo seed → projects");
    seeded = true;
  }

  if (await tableEmpty(conn, "activities")) {
    await insertRows(conn, "activities", DEMO_ACTIVITIES);
    console.log("[db] demo seed → activities");
    seeded = true;
  }

  if (await tableEmpty(conn, "certifications")) {
    await insertRows(conn, "certifications", DEMO_CERTIFICATIONS);
    console.log("[db] demo seed → certifications");
    seeded = true;
  }

  if (await tableEmpty(conn, "careers")) {
    await insertRows(conn, "careers", DEMO_CAREERS);
    console.log("[db] demo seed → careers");
    seeded = true;
  }

  const [techRows] = await conn.query("SELECT value FROM settings WHERE `key` = 'tech_stack' LIMIT 1");
  const techRaw = String(techRows[0]?.value || "").trim();
  let techParsed = [];
  try {
    techParsed = JSON.parse(techRaw);
  } catch {
    techParsed = [];
  }
  if (!Array.isArray(techParsed) || techParsed.length === 0) {
    await conn.query(
      "INSERT INTO settings (`key`, value) VALUES ('tech_stack', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [JSON.stringify(DEFAULT_TECH_STACK)]
    );
    console.log("[db] demo seed → tech_stack");
    seeded = true;
  }

  return seeded;
}
