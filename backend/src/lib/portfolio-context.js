import { getSetting } from "./settings.js";

function lines(items, fmt) {
  if (!items?.length) return "  (없음)";
  return items.map((it) => `  - ${fmt(it)}`).join("\n");
}

function filled(items) {
  return (items || []).filter((it) => it && (it.title || it.subtitle || it.description));
}

function fileName(src) {
  if (!src || typeof src !== "string") return "";
  if (src.startsWith("data:")) return src.startsWith("data:video") ? "내장 영상" : "내장 이미지";
  const name = src.split("?")[0].split("/").pop();
  return name && name.length < 90 ? name : "";
}

function cellLine(cell) {
  if (!cell) return "";
  return [cell.kind, fileName(cell.src), cell.caption].filter(Boolean).join(" · ");
}

function parseHome() {
  return getSetting("home_layout", "").then((raw) => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
}

export async function buildPortfolioContext() {
  const layout = await parseHome();
  const hero = layout.hero && typeof layout.hero === "object" ? layout.hero : {};
  const projects = Array.isArray(layout.projects) ? layout.projects : [];
  const tabs = Array.isArray(layout.profile?.tabs) ? layout.profile.tabs : [];
  const worlds = layout.worlds && typeof layout.worlds === "object" ? layout.worlds : {};

  const worldBlocks = [
    ["기술 · 인프라", worlds.infrastructure],
    ["공모전 · 수상", worlds.awards],
    ["프로필", worlds.profile],
  ].flatMap(([label, block]) => [
    "",
    `=== ${label} ===`,
    block?.one ? `한 줄: ${block.one}` : "",
    lines(filled(block?.items), (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
  ]);

  return [
    "=== 사이트 구조 · 변화 ===",
    "홈은 시네마틱 3D 우주. 섹션 순서: 관문 → 프로젝트 → 공모전 수상 → 기술 인프라 → 자격증 → 경험 활동 → 경력 → 프로필.",
    "메뉴 카드: 일정(/schedule), 바이낸스(/binance), 관리자페이지(/admin, 회원+DS 합침), AI 챗봇 개설예정(/ai).",
    "홈 오른쪽 위 버튼은 이 사이트에 내장된 안내 AI다. /ai 는 별도 챗봇 페이지로 아직 개설 전이다.",
    "드라이브 금고는 관리자 전용이며, Google Drive 연동은 서버 환경변수가 있어야 동작한다.",
    "",
    "=== 소개 ===",
    [hero.kicker, hero.name, hero.line, hero.tagline].filter(Boolean).join(" | ") ||
      "이성권. 홈에 정리된 프로젝트와 프로필이 기준이다.",
    "",
    "=== 프로젝트 ===",
    lines(projects, (p) => {
      const pages = Array.isArray(p.pages)
        ? p.pages
            .map((pg) => {
              const cells = [cellLine(pg.left), cellLine(pg.right)].filter(Boolean).join(" / ");
              return [pg.name, cells].filter(Boolean).join(": ");
            })
            .filter(Boolean)
        : [];
      const slides = Array.isArray(p.slides) ? p.slides.map((s) => s.caption || fileName(s.src)).filter(Boolean) : [];
      return [
        p.title,
        p.subtitle,
        p.period,
        p.role,
        Array.isArray(p.stack) && p.stack.length ? `스택 ${p.stack.join(", ")}` : "",
        p.description,
        p.result,
        pages.length ? `파일/페이지 ${pages.join(" · ")}` : "",
        slides.length ? `슬라이드 ${slides.join(" · ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    }),
    ...tabs.flatMap((tab) => [
      "",
      `=== ${tab.label || tab.id || "TAB"} ===`,
      tab.one ? `한 줄: ${tab.one}` : "",
      lines(filled(tab.items), (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
    ]),
    ...worldBlocks,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
