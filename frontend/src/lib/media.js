// 사진·영상+글 묶음(JSON 문자열) 파싱/직렬화 + 콤마 태그 헬퍼

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

export function hasMediaContent(m) {
  return Boolean(m && (m.image || m.video || m.pdf || (m.caption && m.caption.trim())));
}

export function stringifyMedia(list) {
  const cleaned = (list || [])
    .filter(hasMediaContent)
    .map((m) => ({
      name: m.name || "",
      image: m.image || "",
      video: m.video || "",
      pdf: m.pdf || "",
      caption: m.caption || "",
    }));
  // 빈 배열도 "[]" 로 저장해야 전부 삭제 시 서버 반영됨 (pick() 가 빈 문자열은 건너뜀)
  return JSON.stringify(cleaned);
}

// 이름이 없으면 저장 순서 기준 임시 이름을 만든다 (사진1, 동영상1, PDF1 …)
export function mediaKindLabel(m) {
  if (m?.pdf) return "PDF";
  if (m?.video) return "동영상";
  return "사진";
}

export function mediaDisplayName(m, indexByKind) {
  if (m?.name && m.name.trim()) return m.name.trim();
  return `${mediaKindLabel(m)}${indexByKind}`;
}

export function splitTags(raw) {
  return String(raw || "")
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
