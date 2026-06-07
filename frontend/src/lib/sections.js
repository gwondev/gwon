// 섹션 내비 + RootPage 카드 공용 (6개)
export const SECTIONS = [
  {
    key: "techstack",
    path: "/tech-stack",
    no: "01",
    title: "기술스택",
    sub: "Tech Stack",
    desc: "사용 기술과 도구.",
  },
  {
    key: "competitions",
    path: "/competitions",
    no: "02",
    title: "공모전 & 수상",
    sub: "Competitions & Awards",
    desc: "공모전·대회 수상 기록.",
  },
  {
    key: "projects",
    path: "/projects",
    no: "03",
    title: "프로젝트",
    sub: "Projects",
    desc: "프로젝트 기록.",
  },
  {
    key: "activities",
    path: "/activities",
    no: "04",
    title: "활동",
    sub: "Activities",
    desc: "동아리·대외활동.",
  },
  {
    key: "certifications",
    path: "/certifications",
    no: "05",
    title: "자격증",
    sub: "Certifications",
    desc: "자격·인증.",
  },
  {
    key: "career",
    path: "/career",
    no: "06",
    title: "경력",
    sub: "Career",
    desc: "실무 경험.",
  },
];

// 한번에 보기 페이지 — DB 연동 섹션 (6개 카드 중 DB 테이블)
export const OVERVIEW_SECTIONS = [
  { key: "projects", title: "프로젝트 & 공모전" },
  { key: "activities", title: "활동" },
  { key: "certifications", title: "자격증" },
  { key: "career", title: "경력" },
];

export const PROJECT_CATEGORIES = [
  "IoT",
  "AI",
  "웹",
  "앱",
  "임베디드",
  "데이터",
  "보안",
  "게임",
  "기타",
];

export function isCompetition(item) {
  return Boolean(item?.award?.trim());
}

export function isProjectRecord(item) {
  return !isCompetition(item);
}

// 전체 요약(한번에 보기) 페이지용 — 나중에 자유롭게 수정 가능한 초안
export const ABOUT = {
  intro:
    "안녕하세요, 이성권입니다. 프로젝트와 공모전, 활동, 자격증, 경력을 한곳에 정리해 두었습니다.",
  highlights: [
    "다양한 분야의 프로젝트·공모전 경험",
    "동아리·대외활동 기반의 협업 역량",
    "실무 경험과 자격증으로 뒷받침되는 기본기",
  ],
};

// API 실패·로컬 모드용 폴백
export const TECH_STACK_FALLBACK = [
  { group: "IoT", items: ["MQTT", "Arduino", "ESP32", "Python", "C++"] },
  { group: "App", items: ["React Native", "JavaScript", "Expo", "Android", "iOS"] },
  { group: "Infra", items: ["Docker", "Linux", "Cloudflare", "Git", "Redis"] },
  { group: "AI", items: ["Python", "TensorFlow", "OpenCV", "PyTorch"] },
  { group: "Web · Backend", items: ["React", "Node.js", "Express", "MySQL"] },
];
