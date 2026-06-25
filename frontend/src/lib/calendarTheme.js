export const CALENDAR_THEME_COLORS = [
  { id: "red", label: "빨강", accent: "#ef4444", soft: "rgba(239, 68, 68, 0.14)" },
  { id: "orange", label: "주황", accent: "#f97316", soft: "rgba(249, 115, 22, 0.14)" },
  { id: "amber", label: "호박", accent: "#f59e0b", soft: "rgba(245, 158, 11, 0.14)" },
  { id: "yellow", label: "노랑", accent: "#eab308", soft: "rgba(234, 179, 8, 0.12)" },
  { id: "green", label: "초록", accent: "#22c55e", soft: "rgba(34, 197, 94, 0.12)" },
  { id: "teal", label: "청록", accent: "#14b8a6", soft: "rgba(20, 184, 166, 0.12)" },
  { id: "blue", label: "파랑", accent: "#3b82f6", soft: "rgba(59, 130, 246, 0.12)" },
  { id: "indigo", label: "남색", accent: "#6366f1", soft: "rgba(99, 102, 241, 0.12)" },
  { id: "purple", label: "보라", accent: "#a855f7", soft: "rgba(168, 85, 247, 0.12)" },
  { id: "pink", label: "분홍", accent: "#ec4899", soft: "rgba(236, 72, 153, 0.12)" },
];

export function getThemeById(id) {
  return CALENDAR_THEME_COLORS.find((c) => c.id === id) || CALENDAR_THEME_COLORS[0];
}

export const INCOME_OPTIONS = [
  { id: "ALBA", label: "알바" },
  { id: "WORK", label: "일" },
  { id: "SCHOLARSHIP", label: "근로장학생" },
];

export function formatEventTime(event) {
  if (!event.startTime) return "종일";
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
}

export function roleLabel(role) {
  if (role === "SUPER_ADMIN") return "슈퍼 관리자 (SUPER ADMIN)";
  if (role === "ADMIN") return "관리자 (ADMIN)";
  return "일반 (GUEST)";
}
