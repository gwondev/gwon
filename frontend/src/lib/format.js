// 프로젝트 카드 제목: 팀명(주제명)
export function formatProjectHeadline(item) {
  const team = String(item?.team_name || "").trim();
  const title = String(item?.title || "").trim();
  if (team && title) return `${team}(${title})`;
  return team || title;
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
