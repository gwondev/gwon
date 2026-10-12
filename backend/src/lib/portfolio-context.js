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
  const projects = Array.isArray(layout.projects) ? layout.projects : [];
  const profile = layout.profile && typeof layout.profile === "object" ? layout.profile : {};
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const career = Array.isArray(profile.career) ? profile.career : [];
  const certs = Array.isArray(profile.certs) ? profile.certs : [];

  return [
    "=== 소개 ===",
    "이성권. 홈에 정리된 프로젝트와 프로필이 기준이다.",
    "",
    "=== 프로젝트 ===",
    lines(projects, (p) =>
      [p.title, p.subtitle, p.period, p.role, p.description, p.result].filter(Boolean).join(" | ")
    ),
    "",
    "=== EXPERIENCE ===",
    lines(experience, (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
    "",
    "=== CAREER ===",
    lines(career, (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
    "",
    "=== CERTIFICATIONS ===",
    lines(certs, (it) => [it.title, it.subtitle, it.description].filter(Boolean).join(" | ")),
  ].join("\n");
}
