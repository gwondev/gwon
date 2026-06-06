// 4개 핵심 섹션. RootPage 카드 / 내부 탭 내비게이션 공용.
export const SECTIONS = [
  {
    key: "projects",
    path: "/projects",
    no: "01",
    title: "프로젝트 & 공모전",
    sub: "Projects & Competitions",
    desc: "주관처·팀·분류별로 정리한 개발 기록.",
  },
  {
    key: "activities",
    path: "/activities",
    no: "02",
    title: "활동",
    sub: "Activities",
    desc: "동아리, 대외활동, 커뮤니티.",
  },
  {
    key: "certifications",
    path: "/certifications",
    no: "03",
    title: "자격증",
    sub: "Certifications",
    desc: "취득한 자격과 인증.",
  },
  {
    key: "career",
    path: "/career",
    no: "04",
    title: "경력",
    sub: "Career",
    desc: "인턴십과 실무 경험.",
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
