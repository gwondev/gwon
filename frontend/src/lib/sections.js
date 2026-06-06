// 4개 핵심 섹션. RootPage 카드 / 내부 탭 내비게이션 공용.
export const SECTIONS = [
  {
    key: "projects",
    path: "/projects",
    no: "01",
    title: "프로젝트 & 공모전",
    sub: "Projects & Competitions",
    desc: "프로젝트·공모전 기록.",
  },
  {
    key: "activities",
    path: "/activities",
    no: "02",
    title: "활동",
    sub: "Activities",
    desc: "동아리·대외활동.",
  },
  {
    key: "certifications",
    path: "/certifications",
    no: "03",
    title: "자격증",
    sub: "Certifications",
    desc: "자격·인증.",
  },
  {
    key: "career",
    path: "/career",
    no: "04",
    title: "경력",
    sub: "Career",
    desc: "실무 경험.",
  },
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

// 기술 스택 (초안 — 나중에 수정)
export const TECH_STACK = [
  { group: "Frontend", items: ["React", "JavaScript", "HTML/CSS", "Vite"] },
  { group: "Backend", items: ["Node.js", "Express", "Java", "Spring"] },
  { group: "Database", items: ["MySQL", "Redis"] },
  { group: "Infra / DevOps", items: ["Docker", "Linux", "Cloudflare", "Git"] },
  { group: "IoT / etc", items: ["MQTT", "Arduino", "Python"] },
];
