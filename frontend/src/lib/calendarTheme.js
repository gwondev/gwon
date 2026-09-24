export const CALENDAR_THEME_COLORS = [
  { id: "gray", label: "회색", accent: "#9ca3af", soft: "rgba(156, 163, 175, 0.14)" },
  { id: "slate", label: "슬레이트", accent: "#64748b", soft: "rgba(100, 116, 139, 0.14)" },
  { id: "red", label: "빨강", accent: "#ef4444", soft: "rgba(239, 68, 68, 0.14)" },
  { id: "rose", label: "로즈", accent: "#f43f5e", soft: "rgba(244, 63, 94, 0.14)" },
  { id: "orange", label: "주황", accent: "#f97316", soft: "rgba(249, 115, 22, 0.14)" },
  { id: "amber", label: "호박", accent: "#f59e0b", soft: "rgba(245, 158, 11, 0.14)" },
  { id: "yellow", label: "노랑", accent: "#eab308", soft: "rgba(234, 179, 8, 0.12)" },
  { id: "lime", label: "라임", accent: "#84cc16", soft: "rgba(132, 204, 22, 0.12)" },
  { id: "green", label: "초록", accent: "#22c55e", soft: "rgba(34, 197, 94, 0.12)" },
  { id: "emerald", label: "에메랄드", accent: "#10b981", soft: "rgba(16, 185, 129, 0.12)" },
  { id: "teal", label: "청록", accent: "#14b8a6", soft: "rgba(20, 184, 166, 0.12)" },
  { id: "cyan", label: "시안", accent: "#06b6d4", soft: "rgba(6, 182, 212, 0.12)" },
  { id: "sky", label: "하늘", accent: "#0ea5e9", soft: "rgba(14, 165, 233, 0.12)" },
  { id: "blue", label: "파랑", accent: "#3b82f6", soft: "rgba(59, 130, 246, 0.12)" },
  { id: "indigo", label: "남색", accent: "#6366f1", soft: "rgba(99, 102, 241, 0.12)" },
  { id: "violet", label: "바이올렛", accent: "#8b5cf6", soft: "rgba(139, 92, 246, 0.12)" },
  { id: "purple", label: "보라", accent: "#a855f7", soft: "rgba(168, 85, 247, 0.12)" },
  { id: "pink", label: "분홍", accent: "#ec4899", soft: "rgba(236, 72, 153, 0.12)" },
];

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function getThemeById(id) {
  if (id && HEX_COLOR_RE.test(id)) {
    return { id, label: id.toUpperCase(), accent: id, soft: `${id}22` };
  }
  return CALENDAR_THEME_COLORS.find((c) => c.id === id) || CALENDAR_THEME_COLORS[0];
}

export const INCOME_OPTIONS = [
  { id: "ALBA", label: "알바" },
  { id: "WORK", label: "일" },
  { id: "SCHOLARSHIP", label: "근로장학생" },
];

function formatDateDotShort(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [, m, d] = dateKey.split("-");
  return `${m}.${d}`;
}

export function formatEventTime(event, { continuousSpan = false } = {}) {
  if (!event?.startTime) return "종일";
  const seriesStart = event.seriesStartDate || event.eventDate;
  const seriesEnd = event.seriesEndDate || event.eventDate;
  const isContinuous =
    continuousSpan &&
    !event.repeat?.freq &&
    seriesStart &&
    seriesEnd &&
    seriesStart !== seriesEnd;

  if (isContinuous) {
    const endDot = formatDateDotShort(seriesEnd);
    if (event.endTime) return `${event.startTime}~${endDot} ${event.endTime}`;
    return event.startTime;
  }

  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
}

export function roleLabel(role) {
  if (role === "SUPER_ADMIN") return "슈퍼 관리자 (SUPER ADMIN)";
  if (role === "ADMIN") return "관리자 (ADMIN)";
  return "일반 (GUEST)";
}
