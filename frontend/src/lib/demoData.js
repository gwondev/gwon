/** API·DB 비어 있을 때 전체/미리보기용 임시 데이터 */

const withIds = (rows, prefix) =>
  rows.map((row, i) => ({ ...row, id: `${prefix}-${i + 1}` }));

const DEMO_PROJECT_ROWS = [
  {
    title: "스마트팜 환경 모니터링",
    category: "IoT, AI",
    host: "교내 캡스톤",
    team_name: "그린아이",
    period: "2025.03.01 ~ 2025.06.30",
    home_featured: 1,
  },
  {
    title: "자율주행 청소 로봇",
    category: "AI, ROBOT",
    host: "교내 프로젝트",
    team_name: "TRESS",
    period: "2024.09.01 ~ 2024.12.15",
    home_featured: 1,
  },
  {
    title: "실시간 이동 관리 시스템",
    category: "IoT, 웹",
    host: "교내 SW 경진대회",
    team_name: "MOVE",
    period: "2025.01.15 ~ 2025.03.20",
  },
  {
    title: "포트폴리오 웹 플랫폼",
    category: "웹",
    host: "개인 프로젝트",
    team_name: "DEVSIGN",
    period: "2025.10.01 ~ 2026.03.01",
  },
  {
    title: "TRACE 해커톤",
    category: "IoT, AI",
    host: "OO 재단",
    team_name: "TRACE",
    award: "똥쌍",
    period: "2024.05.10 ~ 2024.05.12",
  },
  {
    title: "TESS AI 챌린지",
    category: "AI",
    host: "XX 협회",
    team_name: "TESS",
    award: "우쑤쌍",
    period: "2025.11.01 ~ 2025.11.03",
  },
];

export const DEMO_PROJECTS = withIds(DEMO_PROJECT_ROWS, "demo-p");

export const DEMO_ACTIVITIES = withIds(
  [
    { title: "MG 청년누리", organization: "MG 지역 청년센터", role: "멘티", period: "2026.01.01 ~ 2026.12.31" },
    { title: "멋쟁이사자처럼 13기", organization: "멋쟁이사자처럼", role: "백엔드", period: "2024.02.01 ~ 2024.08.31" },
    { title: "GWON 프로젝트 동아리", organization: "OO대학교", role: "팀장", period: "2023.03.01 ~ 2024.02.28" },
    { title: "SW 마스터 Class", organization: "OO 재단", role: "수료", period: "2025.06.01 ~ 2025.08.31" },
  ],
  "demo-a"
);

export const DEMO_CERTIFICATIONS = withIds(
  [
    { title: "정보처리기사", issuer: "한국산업인력공단", acquired: "2025.06", score: "합격" },
    { title: "SQLD", issuer: "한국데이터산업진흥원", acquired: "2024.11", score: "합격" },
    { title: "AWS Solutions Architect Associate", issuer: "Amazon Web Services", acquired: "2025.03" },
    { title: "리눅스마스터 2급", issuer: "KAIT", acquired: "2024.08", score: "합격" },
  ],
  "demo-c"
);

export const DEMO_CAREERS = withIds(
  [
    { title: "(주)그원", category: "인턴", position: "백엔드 개발", period: "2025.07.01 ~ 2025.08.31" },
    { title: "OO 카페", category: "알바", position: "매장 스태프", period: "2024.06.01 ~ 2024.06.30" },
    { title: "스타트업 A", category: "계약직", position: "풀스택", period: "2025.09.01 ~ 2026.02.28" },
    { title: "교내 연구실", category: "연구보조", position: "IoT 연구", period: "2024.03.01 ~ 2024.05.31" },
  ],
  "demo-r"
);

export function withDemoFallback(items, demoItems) {
  return Array.isArray(items) && items.length > 0 ? items : demoItems;
}
