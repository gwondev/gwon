import { getSetting, setSetting } from "./settings.js";
import { DEFAULT_TECH_STACK } from "./tech-stack-defaults.js";

/** 기술명 앞 * → 강조 (저장값은 * 유지) */
export function formatTechItemLabel(raw) {
  const value = String(raw ?? "").trim();
  return value.startsWith("*") ? value.slice(1).trim() : value;
}

export function formatTechItemForContext(raw) {
  const value = String(raw ?? "").trim();
  if (value.startsWith("*")) return `${value.slice(1).trim()} (강점)`;
  return value;
}

export function normalizeTechStack(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_TECH_STACK];

  const groups = raw
    .map((g) => {
      const group = String(g?.group ?? "").trim();
      let items = [];
      if (Array.isArray(g?.items)) {
        items = g.items.map((it) => String(it).trim()).filter(Boolean);
      } else if (typeof g?.items === "string") {
        items = g.items
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return { group, items };
    })
    .filter((g) => g.group && g.items.length);

  return groups.length ? groups : [...DEFAULT_TECH_STACK];
}

export async function getTechStack() {
  const raw = await getSetting("tech_stack", "");
  if (!raw?.trim()) return [...DEFAULT_TECH_STACK];
  try {
    return normalizeTechStack(JSON.parse(raw));
  } catch {
    return [...DEFAULT_TECH_STACK];
  }
}

export async function saveTechStack(groups) {
  const normalized = normalizeTechStack(groups);
  await setSetting("tech_stack", JSON.stringify(normalized));
  return normalized;
}
