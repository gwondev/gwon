// 사진+글 묶음(JSON 문자열) 파싱/직렬화 + 콤마 태그 헬퍼

export function parseMedia(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function stringifyMedia(list) {
  const cleaned = (list || [])
    .filter((m) => m && (m.image || (m.caption && m.caption.trim())))
    .map((m) => ({ image: m.image || "", caption: m.caption || "" }));
  // 빈 배열도 "[]" 로 저장해야 전부 삭제 시 서버 반영됨 (pick() 가 빈 문자열은 건너뜀)
  return JSON.stringify(cleaned);
}

export function splitTags(raw) {
  return String(raw || "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
