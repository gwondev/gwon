import { splitTags } from "./media";

// 프로젝트 카드 제목: 팀명(주제명)
export function formatProjectHeadline(item) {
  const team = String(item?.team_name || "").trim();
  const title = String(item?.title || "").trim();
  if (team && title) return `${team}(${title})`;
  return team || title;
}

/** 기간 문자열에서 연도 2자리 추출 (활동 미리보기용) */
export function extractPeriodYearShort(period) {
  if (!period) return "";
  const match = String(period).match(/(\d{4})/);
  return match ? match[1].slice(-2) : "";
}

export function formatActivityPreview(item) {
  const title = String(item?.title || "").trim();
  const yy = extractPeriodYearShort(item?.period);
  return yy ? `${title} (${yy})` : title;
}

export function formatActivityPreviewParts(item) {
  const main = String(item?.title || "").trim();
  const yy = extractPeriodYearShort(item?.period);
  return { main, accent: yy || "" };
}

export function formatCompetitionPreview(item) {
  const team = String(item?.team_name || item?.title || "").trim().toUpperCase();
  const award = String(item?.award || "").trim();
  return award ? `${team}(${award})` : team;
}

export function formatCompetitionPreviewParts(item) {
  const main = String(item?.team_name || item?.title || "").trim().toUpperCase();
  const accent = String(item?.award || "").trim();
  return { main, accent };
}

function parseYmd(raw) {
  const [y = "", m = "1", d = "1"] = String(raw || "").trim().split(".");
  const year = parseInt(y, 10);
  const month = parseInt(m, 10) || 1;
  const day = parseInt(d, 10) || 1;
  if (!year) return null;
  return new Date(year, month - 1, day);
}

/** 경력 기간 → "N개월" */
export function formatCareerDurationMonths(period) {
  if (!period) return "";
  const [startRaw = "", endRaw = ""] = period.split("~").map((s) => s.trim());
  const start = parseYmd(startRaw);
  if (!start) return "";
  const end = endRaw ? parseYmd(endRaw) : new Date();
  if (!end) return "";

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  if (months < 1) months = 1;
  return `${months}개월`;
}

export function formatCareerPreview(item) {
  const title = String(item?.title || "").trim();
  const span = formatCareerDurationMonths(item?.period);
  return span ? `(${span}) ${title}` : title;
}

export function formatCareerPreviewParts(item) {
  const main = String(item?.title || "").trim();
  const accent = formatCareerDurationMonths(item?.period);
  return { main, accent, accentFirst: true };
}

const PROJECT_PREVIEW_CATEGORY_OVERRIDES = {
  그린아이: ["IoT", "AI"],
  greeneye: ["IoT", "AI"],
  greenegye: ["IoT", "AI"],
  tress: ["AI", "ROBOT"],
  move: ["IoT", "웹"],
  devsign: ["웹"],
};

function resolveProjectPreviewTags(item) {
  const raw = String(item?.team_name || item?.title || "").trim();
  const key = raw.toLowerCase();
  const direct = PROJECT_PREVIEW_CATEGORY_OVERRIDES[key];
  if (direct) return direct;

  const fuzzy = Object.entries(PROJECT_PREVIEW_CATEGORY_OVERRIDES).find(
    ([k]) => key.includes(k) || k.includes(key)
  );
  if (fuzzy) return fuzzy[1];

  return splitTags(item?.category);
}

export function formatProjectPreviewLine(item) {
  const team = String(item?.team_name || item?.title || "").trim().toUpperCase();
  const tags = resolveProjectPreviewTags(item).map((t) => String(t).trim().toUpperCase()).filter(Boolean);
  return tags.length ? `${team}(${tags.join(", ")})` : team;
}

export function formatProjectPreviewParts(item) {
  const main = String(item?.team_name || item?.title || "").trim().toUpperCase();
  const accent = resolveProjectPreviewTags(item)
    .map((t) => String(t).trim().toUpperCase())
    .filter(Boolean)
    .join(", ");
  return { main, accent };
}

export function formatCertificationPreviewParts(item) {
  return {
    main: String(item?.title || "").trim(),
    meta: String(item?.score || "").trim(),
  };
}

export function orderProjectsForPreview(projects, limit = 4) {
  const list = projects.filter((p) => !String(p?.award || "").trim());
  const featured = list.filter(isHomeFeatured);
  const rest = list.filter((p) => !isHomeFeatured(p));
  return [...featured, ...rest].slice(0, limit);
}

export function isHomeFeatured(item) {
  const v = item?.home_featured;
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && v.toLowerCase() === "true") return true;
  return false;
}

// 경력 기간 미리보기: "2026.05.01 ~ 2026.09.03" -> "26.05~26.09"
export function formatCareerPeriodPreview(period) {
  if (!period) return "";

  const shortYm = (raw) => {
    const [y = "", m = ""] = raw.trim().split(".");
    if (!y && !m) return "";
    const yy = y.length >= 2 ? y.slice(-2) : y;
    if (!m) return yy;
    const mm = m.padStart(2, "0").slice(0, 2);
    return `${yy}.${mm}`;
  };

  const [start = "", end = ""] = period.split("~").map((s) => s.trim());
  const s = shortYm(start);
  const e = shortYm(end);
  if (s && e) return `${s}~${e}`;
  return s || e || period;
}
