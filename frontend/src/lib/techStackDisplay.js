/** 기술명 앞 * → 강조 표시 (저장값은 * 포함) */
export function parseTechItem(raw) {
  const value = String(raw ?? "").trim();
  const accent = value.startsWith("*");
  const label = accent ? value.slice(1).trim() : value;
  return { value, label, accent };
}

export function formatTechItemLabel(raw) {
  return parseTechItem(raw).label;
}
