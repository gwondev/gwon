import { listTable } from "./list-table.js";

const ABOUT = {
  intro:
    "안녕하세요, 이성권입니다. 프로젝트와 공모전, 활동, 자격증, 경력을 한곳에 정리해 두었습니다.",
  highlights: [
    "다양한 분야의 프로젝트·공모전 경험",
    "동아리·대외활동 기반의 협업 역량",
    "실무 경험과 자격증으로 뒷받침되는 기본기",
  ],
};

const TECH_STACK = [
  { group: "Frontend", items: ["React", "JavaScript", "HTML/CSS", "Vite"] },
  { group: "Backend", items: ["Node.js", "Express", "Java", "Spring"] },
  { group: "Database", items: ["MySQL", "Redis"] },
  { group: "Infra / DevOps", items: ["Docker", "Linux", "Cloudflare", "Git"] },
  { group: "IoT / etc", items: ["MQTT", "Arduino", "Python"] },
];

function lines(items, fmt) {
  if (!items?.length) return "  (없음)";
  return items.map((it) => `  - ${fmt(it)}`).join("\n");
}

export async function buildPortfolioContext() {
  const projects = await listTable("projects");
  const activities = await listTable("activities");
  const certifications = await listTable("certifications");
  const careers = await listTable("careers");

  const tech = TECH_STACK.map((g) => `  [${g.group}] ${g.items.join(", ")}`).join("\n");

  return [
    "=== 소개 ===",
    ABOUT.intro,
    ...ABOUT.highlights.map((h) => `- ${h}`),
    "",
    "=== 기술 스택 (요약 페이지) ===",
    tech,
    "",
    "=== 프로젝트 & 공모전 ===",
    lines(projects, (p) =>
      [
        p.title,
        p.category && `분류:${p.category}`,
        p.host && `주관:${p.host}`,
        p.team_name && `팀:${p.team_name}`,
        p.members && `팀원:${p.members}`,
        p.award && `결과:${p.award}`,
        p.period && `기간:${p.period}`,
        p.description && `설명:${p.description}`,
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    "",
    "=== 활동 ===",
    lines(activities, (a) =>
      [
        a.title,
        a.organization && `단체:${a.organization}`,
        a.role && `역할:${a.role}`,
        a.period && `기간:${a.period}`,
        a.description && `설명:${a.description}`,
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    "",
    "=== 자격증 ===",
    lines(certifications, (c) =>
      [
        c.title,
        c.issuer && `발급:${c.issuer}`,
        c.acquired && `취득:${c.acquired}`,
        c.score && `등급:${c.score}`,
        c.description && `비고:${c.description}`,
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    "",
    "=== 경력 ===",
    lines(careers, (c) =>
      [
        c.title,
        c.category && `구분:${c.category}`,
        c.position && `직무:${c.position}`,
        c.period && `기간:${c.period}`,
        c.description && `업무:${c.description}`,
      ]
        .filter(Boolean)
        .join(" | ")
    ),
  ].join("\n");
}
