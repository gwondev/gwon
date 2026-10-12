export const HOME_LAYOUT_DEFAULT = {
  desktop: {
    profileCols: 4,
    profileCardH: 430,
    projectMediaH: 52,
    projectMediaMax: 560,
  },
  mobile: {
    profileCols: 2,
    profileCardH: 280,
    projectMediaH: 36,
    projectMediaMax: 380,
  },
};

export const HOME_LAYOUT_KEY = "gwon.homeLayout";

function num(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function pick(src, fallback) {
  const x = src && typeof src === "object" ? src : {};
  return {
    profileCols: num(x.profileCols, fallback.profileCols, 1, 6),
    profileCardH: num(x.profileCardH, fallback.profileCardH, 140, 720),
    projectMediaH: num(x.projectMediaH, fallback.projectMediaH, 18, 80),
    projectMediaMax: num(x.projectMediaMax, fallback.projectMediaMax, 180, 900),
  };
}

export function mergeHomeLayout(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    desktop: pick(src.desktop, HOME_LAYOUT_DEFAULT.desktop),
    mobile: pick(src.mobile, HOME_LAYOUT_DEFAULT.mobile),
  };
}

export function layoutCssVars(bp) {
  return {
    "--file-cols": String(bp.profileCols),
    "--file-card-h": `${bp.profileCardH}px`,
    "--proj-media-h": `${bp.projectMediaH}vh`,
    "--proj-media-max": `${bp.projectMediaMax}px`,
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
    /* ignore */
  }
}
