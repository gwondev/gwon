import { JOURNEY_PROJECTS, PROFILE_TABS } from "./journey.js";

export const HOME_LAYOUT_KEY = "gwon.homeLayout";

/**
 * settings.home_layout JSON
 * 모든 화면 글자·사진이 이 한 덩어리. 배열 순서가 곧 화면 순서이고, 각 객체 i 가 그 인덱스다.
 *
 * hero            i=0     kicker, name, line
 * nav             i=0     projects, profile
 * projects[i]             id, no, title, subtitle, description, pages
 * projects[i].pages[j]    i, name, left, right
 * pages[j].left|right     kind(image|video), src, caption
 * profile.tabs[k]         i, id, label, one, items (experience 16, career 8, certs 16)
 * profile.tabs[k].items[n] i, id, title, subtitle, description  (certs 마지막 = 기타 자격증)
 */
export const HOME_LAYOUT_DOC = {
  hero: "hero.i=0 — kicker, name, line",
  nav: "nav.i=0 — projects, profile",
  projects: "projects[i].pages[j] — name, left|right {kind, src, caption}",
  profile: "experience 16칸, career 8칸, certs 16칸(마지막 기타 자격증), awards 16칸",
};

export const PROFILE_SLOTS = { experience: 16, career: 8, certs: 16, profile: 4, infrastructure: 8, awards: 16 };

function str(v, fallback = "") {
  return v == null ? fallback : String(v);
}

function cloneSlide(s, i) {
  const src = str(s?.src || s?.image || s?.video);
  const kind = s?.kind === "video" || s?.video || src.startsWith("data:video") ? "video" : "image";
  return {
    i,
    kind,
    src,
    caption: str(s?.caption),
    name: str(s?.name),
  };
}

function slidesOf(p) {
  if (Array.isArray(p?.slides) && p.slides.length) {
    return p.slides.slice(0, 12).map((s, i) => cloneSlide(s, i));
  }
  const slides = [];
  if (p?.image) slides.push(cloneSlide({ kind: "image", src: p.image, caption: p.description }, 0));
  if (p?.video) slides.push(cloneSlide({ kind: "video", src: p.video, caption: p.description }, slides.length));
  return slides;
}

export function cloneProject(p, i) {
  const pages = pagesOf(p);
  const cells = pages.flatMap((pg) => [pg.left, pg.right]);
  const firstImg = cells.find((c) => c.kind === "image" && c.src);
  const firstVid = cells.find((c) => c.kind === "video" && c.src);
  return {
    i,
    id: str(p?.id, `p-${i + 1}`),
    no: str(p?.no, String(i + 1).padStart(2, "0")),
    title: str(p?.title, "NEW PROJECT"),
    subtitle: str(p?.subtitle),
    period: str(p?.period),
    role: str(p?.role),
    keywords: Array.isArray(p?.keywords) ? p.keywords.map(String) : [],
    stack: Array.isArray(p?.stack) ? p.stack.map(String) : [],
    description: str(p?.description),
    result: str(p?.result),
    image: firstImg?.src || "",
    video: firstVid?.src || "",
    imageAlt: str(p?.imageAlt || p?.title),
    match: Array.isArray(p?.match) ? p.match.map(String) : [str(p?.id, `p-${i + 1}`)],
    effect: str(p?.effect, "none"),
    pages,
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
      description: "",
      keywords: ["Project"],
      effect: "none",
      slides: [],
    },
    index
  );
}

function emptyCell() {
  return { kind: "image", src: "", caption: "" };
}

function cloneCell(c) {
  const src = str(c?.src || c?.image || c?.video);
  const kind = c?.kind === "video" || c?.video || src.startsWith("data:video") ? "video" : "image";
  return { kind, src, caption: str(c?.caption) };
}

function clonePage(pg, i) {
  const src = pg && typeof pg === "object" ? pg : {};
  return {
    i,
    name: str(src.name, `탭 ${i + 1}`),
    left: cloneCell(src.left),
    right: cloneCell(src.right),
  };
}

export function blankPage(index) {
  return clonePage({ name: `탭 ${index + 1}`, left: emptyCell(), right: emptyCell() }, index);
}

export function blankSlide(index) {
  return cloneSlide({ kind: "image", src: "", caption: "", name: `탭 ${index + 1}` }, index);
}

function pagesOf(p) {
  if (Array.isArray(p?.pages) && p.pages.length) {
    return p.pages.slice(0, 8).map((pg, i) => clonePage(pg, i));
  }
  const slides = slidesOf(p);
  if (!slides.length) return [blankPage(0)];
  const pages = [];
  for (let s = 0; s < slides.length; s += 2) {
    pages.push(
      clonePage(
        {
          name: slides[s].name || `탭 ${pages.length + 1}`,
          left: slides[s],
          right: slides[s + 1] || emptyCell(),
        },
        pages.length
      )
    );
  }
  return pages;
}

function cloneCard(it, i) {
  return {
    i,
    id: str(it?.id, `c-${i + 1}`),
    title: str(it?.title || it?.name),
    subtitle: str(it?.subtitle || it?.period),
    description: str(it?.description),
  };
}

function padItems(tabId, items) {
  const n = PROFILE_SLOTS[tabId] || items.length;
  const out = items.slice(0, n).map((it, j) => cloneCard(it, j));
  while (out.length < n) {
    const i = out.length;
    const title = tabId === "certs" && i === n - 1 ? "기타 자격증" : "";
    out.push({ i, id: `c-${tabId}-${i}`, title, subtitle: "", description: "" });
  }
  if (tabId === "certs" && !out[n - 1].title) out[n - 1].title = "기타 자격증";
  return out.map((it, i) => ({ ...it, i }));
}

function cloneProfileTab(tab, i, fallback) {
  const src = tab && typeof tab === "object" ? tab : {};
  const id = str(src.id, fallback.id);
  const items = Array.isArray(src.items) ? src.items : [];
  return {
    i,
    id,
    label: str(src.label, fallback.label),
    one: str(src.one, fallback.one),
    items: padItems(id, items),
  };
}

const PROFILE_ONES = {
  experience: "Work and activities",
  career: "Roles and periods",
  certs: "Licenses and scores",
};

export function cloneProfile(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  if (Array.isArray(src.tabs) && src.tabs.length) {
    return {
      tabs: src.tabs.map((tab, i) =>
        cloneProfileTab(tab, i, {
          id: PROFILE_TABS[i]?.id || `tab-${i}`,
          label: PROFILE_TABS[i]?.label || "TAB",
          one: PROFILE_ONES[PROFILE_TABS[i]?.id] || "",
        })
      ),
    };
  }
  return {
    tabs: PROFILE_TABS.map((tab, i) =>
      cloneProfileTab(
        { ...tab, one: PROFILE_ONES[tab.id], items: src[tab.id] || [] },
        i,
        { id: tab.id, label: tab.label, one: PROFILE_ONES[tab.id] }
      )
    ),
  };
}

export function cloneHero(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    i: 0,
    kicker: str(src.kicker, "ENGINEER"),
    name: str(src.name, "이성권"),
    line: str(src.line, "systems from hardware to infrastructure"),
    tagline: str(src.tagline, "ENGINEERING MY OWN UNIVERSE"),
    explore: str(src.explore, "EXPLORE"),
  };
}

function infraSeed() {
  const titles = [];
  for (const p of JOURNEY_PROJECTS) {
    for (const s of p.stack || []) {
      if (!titles.includes(s)) titles.push(s);
    }
  }
  return titles.slice(0, 8).map((title, i) => ({ i, id: `infra-${i}`, title, subtitle: "", description: "" }));
}

function cloneWorldBlock(id, raw, fallbackOne) {
  const src = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(src.items) ? src.items : id === "infrastructure" ? infraSeed() : [];
  return {
    i: 0,
    id,
    one: str(src.one, fallbackOne),
    items: padItems(id, items),
  };
}

export function cloneWorlds(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    profile: cloneWorldBlock("profile", src.profile, "Identity"),
    infrastructure: cloneWorldBlock("infrastructure", src.infrastructure, "Systems from the existing stack"),
    awards: cloneWorldBlock("awards", src.awards, "Recorded outcomes"),
  };
}

export function cloneNav(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    i: 0,
    projects: str(src.projects, "PROJECTS"),
    profile: str(src.profile, "PROFILE"),
  };
}

export const HOME_LAYOUT_DEFAULT = {
  _doc: HOME_LAYOUT_DOC,
  hero: cloneHero(null),
  nav: cloneNav(null),
  projects: defaultProjects(),
  profile: cloneProfile(null),
  worlds: cloneWorlds(null),
};

export function mergeHomeLayout(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const incoming = Array.isArray(src.projects) && src.projects.length ? src.projects : defaultProjects();
  return {
    _doc: HOME_LAYOUT_DOC,
    hero: cloneHero(src.hero),
    nav: cloneNav(src.nav),
    projects: incoming.slice(0, 8).map((p, i) => cloneProject(p, i)),
    profile: cloneProfile(src.profile),
    worlds: cloneWorlds(src.worlds),
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
