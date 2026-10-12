import { JOURNEY_PROJECTS } from "./journey.js";

export const HOME_LAYOUT_KEY = "gwon.homeLayout";

export const UNIT_DEFAULTS = {
  hero: { x: 18, y: 28, w: 64, h: 40 },
  connect: { x: 18, y: 30, w: 64, h: 36 },
  projCopy: { x: 15, y: 18, w: 34, h: 60 },
  projMedia: { x: 51, y: 16, w: 36, h: 56, ox: 50, oy: 50 },
  profileTabs: { x: 16, y: 9, w: 58, h: 8 },
  profileCards: { x: 14, y: 18, w: 62, h: 66 },
  nav: { x: 1.2, y: 18, w: 16, h: 62 },
  counter: { x: 62, y: 6.4, w: 16, h: 5 },
  rail: { x: 62, y: 16, w: 16, h: 62 },
};

function num(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

export function clampBox(raw, fallback) {
  const x = raw && typeof raw === "object" ? raw : {};
  const box = {
    x: num(x.x, fallback.x, 0, 96),
    y: num(x.y, fallback.y, 0, 96),
    w: num(x.w, fallback.w, 6, 100),
    h: num(x.h, fallback.h, 4, 100),
  };
  if (fallback.ox != null || x.ox != null) {
    box.ox = num(x.ox, fallback.ox ?? 50, 0, 100);
    box.oy = num(x.oy, fallback.oy ?? 50, 0, 100);
  }
  return box;
}

function cloneProject(p, i) {
  return {
    id: String(p.id || `p-${i + 1}`),
    no: String(i + 1).padStart(2, "0"),
    title: String(p.title || "NEW PROJECT"),
    subtitle: String(p.subtitle || ""),
    period: String(p.period || ""),
    role: String(p.role || ""),
    keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
    stack: Array.isArray(p.stack) ? p.stack.map(String) : [],
    description: String(p.description || ""),
    result: String(p.result || ""),
    image: String(p.image || ""),
    video: String(p.video || ""),
    imageAlt: String(p.imageAlt || p.title || ""),
    match: Array.isArray(p.match) ? p.match.map(String) : [String(p.id || "")],
    effect: String(p.effect || "none"),
  };
}

export function defaultProjects() {
  return JOURNEY_PROJECTS.map((p, i) => cloneProject(p, i));
}

export function blankProject(index) {
  return cloneProject(
    {
      id: `p-${Date.now()}`,
      title: "NEW PROJECT",
      subtitle: "New work",
      description: "설명을 입력하세요.",
      keywords: ["Project"],
      effect: "none",
    },
    index
  );
}

function cloneCard(it, i) {
  return {
    id: String(it?.id || `c-${i + 1}`),
    title: String(it?.title || it?.name || ""),
    subtitle: String(it?.subtitle || it?.period || ""),
    description: String(it?.description || ""),
  };
}

function cloneProfile(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const pick = (key) => (Array.isArray(src[key]) ? src[key] : []).map((it, i) => cloneCard(it, i));
  return {
    experience: pick("experience"),
    career: pick("career"),
    certs: pick("certs"),
  };
}

export const HOME_LAYOUT_DEFAULT = {
  units: { ...UNIT_DEFAULTS },
  media: {},
  projects: defaultProjects(),
  profile: cloneProfile(null),
};

export function mergeHomeLayout(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const units = {};
  for (const [key, fallback] of Object.entries(UNIT_DEFAULTS)) {
    units[key] = clampBox(src.units?.[key], fallback);
  }
  const media = {};
  if (src.media && typeof src.media === "object") {
    for (const [id, box] of Object.entries(src.media)) {
      media[id] = clampBox(box, UNIT_DEFAULTS.projMedia);
    }
  }
  const incoming = Array.isArray(src.projects) && src.projects.length ? src.projects : defaultProjects();
  const projects = incoming.slice(0, 8).map((p, i) => cloneProject(p, i));
  return { units, media, projects, profile: cloneProfile(src.profile) };
}

export function unitBox(layout, id, fallbackId = id) {
  return layout?.units?.[id] || UNIT_DEFAULTS[fallbackId];
}

export function mediaBox(layout, projectId) {
  return layout?.media?.[projectId] || layout?.units?.projMedia || UNIT_DEFAULTS.projMedia;
}

export function boxStyle(box) {
  if (!box) return undefined;
  return {
    left: `${box.x}vw`,
    top: `${box.y}vh`,
    width: `${box.w}vw`,
    height: `${box.h}vh`,
  };
}

export function readStoredLayout() {
  try {
    return mergeHomeLayout(JSON.parse(localStorage.getItem(HOME_LAYOUT_KEY) || "null"));
  } catch {
    return mergeHomeLayout(null);
  }
}

export function writeStoredLayout(layout) {
  try {
    localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}
