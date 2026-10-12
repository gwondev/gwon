import { getSetting } from "./settings.js";

function lines(items, fmt) {
  if (!items?.length) return "  (없음)";
  return items.map((it) => `  - ${fmt(it)}`).join("\n");
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

  return [
    "=== 소개 ===",
    [hero.kicker, hero.name, hero.line].filter(Boolean).join(" | ") || "이성권. 홈에 정리된 프로젝트와 프로필이 기준이다.",
    "",
    "=== 프로젝트 ===",
    lines(projects, (p) =>
      [
        p.title,
        p.subtitle,
        p.description,
        ...(Array.isArray(p.slides) ? p.slides.map((s) => s.caption).filter(Boolean) : []),
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    ...tabs.flatMap((tab) => [
      "",
      `=== ${tab.label || tab.id || "TAB"} ===`,
      lines(tab.items, (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
    ]),
  ].join("\n");
}
