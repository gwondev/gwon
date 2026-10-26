/**
 * 우주 여정의 섹션 정의. 순서가 곧 여정 순서다.
 * source: 콘텐츠가 settings.home_layout 의 어디에서 오는지.
 * veil: 이 섹션으로 들어올 때 재생되는 전환 효과.
 */
export const SECTIONS = [
  {
    id: "gateway",
    no: "00",
    label: "GATEWAY",
    world: "Event Horizon",
    ko: "관문",
    source: { kind: "hero" },
    veil: "horizon",
    color: "#f4f0e8",
    accent: "#ffffff",
  },
  {
    id: "projects",
    no: "01",
    label: "PROJECTS",
    world: "Neural Network",
    ko: "프로젝트",
    source: { kind: "projects" },
    veil: "synapse",
    color: "#8fd8ff",
    accent: "#9f8cff",
  },
  {
    id: "awards",
    no: "02",
    label: "AWARDS",
    world: "Creation Field",
    ko: "공모전 · 수상",
    source: { kind: "world", id: "awards", layout: "certs" },
    veil: "burst",
    color: "#ff9fcf",
    accent: "#ffe0a0",
  },
  {
    id: "infrastructure",
    no: "03",
    label: "SYSTEMS",
    world: "Circuit City",
    ko: "기술 · 인프라",
    source: { kind: "world", id: "infrastructure", layout: "experience" },
    veil: "grid",
    color: "#7ff0cf",
    accent: "#4fa8ff",
  },
  {
    id: "credentials",
    no: "04",
    label: "CERTIFICATIONS",
    world: "Atomic Structure",
    ko: "자격증",
    source: { kind: "tab", id: "certs", layout: "certs" },
    veil: "implode",
    color: "#a9c4ff",
    accent: "#ffd58a",
  },
  {
    id: "activities",
    no: "05",
    label: "EXPERIENCE",
    world: "Living Environment",
    ko: "경험 · 활동",
    source: { kind: "tab", id: "experience", layout: "experience" },
    veil: "dawn",
    color: "#ffc58f",
    accent: "#8fc2ff",
  },
  {
    id: "career",
    no: "06",
    label: "CAREER",
    world: "Orbit of Time",
    ko: "경력",
    source: { kind: "tab", id: "career", layout: "career" },
    veil: "spiral",
    color: "#ffd98a",
    accent: "#6f8dff",
  },
  {
    id: "profile",
    no: "07",
    label: "PROFILE",
    world: "Origin Nebula",
    ko: "프로필",
    source: { kind: "world", id: "profile", layout: "career" },
    veil: "nebula",
    color: "#c4a8ff",
    accent: "#7fd0ff",
    optional: true,
  },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function sectionItems(section, home) {
  const src = section.source;
  if (src.kind === "tab") return home.profile?.tabs?.find((t) => t.id === src.id)?.items || [];
  if (src.kind === "world") return home.worlds?.[src.id]?.items || [];
  if (src.kind === "projects") return home.projects || [];
  return [];
}

/** 빈 칸을 채우려고 자동으로 들어간 제목(설명·부제 없음)은 내용이 없는 것으로 본다. */
const PLACEHOLDER_TITLES = new Set(["새 항목", "기타 자격증"]);

export function filledItems(items) {
  return (items || []).filter((it) => {
    const title = (it.title || "").trim();
    const rest = (it.description || "").trim() || (it.subtitle || "").trim();
    if (rest) return true;
    return Boolean(title) && !PLACEHOLDER_TITLES.has(title);
  });
}

/** 방문자에게는 내용이 있는 선택 섹션만 보인다. 편집 중이면 모두 보인다. */
export function visibleSections(home, canEdit) {
  return SECTIONS.filter((s) => {
    if (!s.optional || canEdit) return true;
    return filledItems(sectionItems(s, home)).length > 0;
  });
}
