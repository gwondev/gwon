const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);

function webhookUrl() {
  const raw = String(process.env.DISCORD_CALENDAR_WEBHOOK_URL || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return "";
    if (!WEBHOOK_HOSTS.has(u.hostname)) return "";
    if (!u.pathname.startsWith("/api/webhooks/")) return "";
    return raw;
  } catch {
    return "";
  }
}

function whenText(event) {
  const date = event?.eventDate || "";
  const start = event?.startTime || "";
  const end = event?.endTime || "";
  if (start && end) return `${date}  ${start}–${end}`;
  if (start) return `${date}  ${start}`;
  return date || "-";
}

function clip(text, max = 400) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function embedOf(action, event) {
  const titles = { add: "일정 추가", edit: "일정 변경", delete: "일정 삭제" };
  const colors = { add: 0xd8c19a, edit: 0x60a5fa, delete: 0xf87171 };
  const fields = [
    { name: "일시", value: whenText(event), inline: false },
  ];
  if (event?.locationName) {
    fields.push({ name: "장소", value: clip(event.locationName, 200), inline: false });
  }
  if (event?.description) {
    fields.push({ name: "메모", value: clip(event.description, 400), inline: false });
  }
  return {
    title: `${titles[action] || "일정"} · ${clip(event?.title || "(제목 없음)", 80)}`,
    color: colors[action] || 0xd8c19a,
    fields,
  };
}

export function notifyCalendarChange(action, event) {
  const url = webhookUrl();
  if (!url || !event) return;
  const body = {
    username: "gwon 일정",
    embeds: [embedOf(action, event)],
  };
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.warn("[discord] calendar notify failed:", err.message);
  });
}
