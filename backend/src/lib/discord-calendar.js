import pool from "../db.js";

const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const THEME_COLORS = {
  gray: 0x9ca3af,
  slate: 0x64748b,
  red: 0xef4444,
  rose: 0xf43f5e,
  orange: 0xf97316,
  amber: 0xf59e0b,
  yellow: 0xeab308,
  lime: 0x84cc16,
  green: 0x22c55e,
  emerald: 0x10b981,
  teal: 0x14b8a6,
  cyan: 0x06b6d4,
  sky: 0x0ea5e9,
  blue: 0x3b82f6,
  indigo: 0x6366f1,
  violet: 0x8b5cf6,
  purple: 0xa855f7,
  pink: 0xec4899,
};
const INCOME_LABEL = { ALBA: "알바", WORK: "일", SCHOLARSHIP: "근로장학생" };

let digestTimer = null;
let lastDigestDate = "";

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

function postWebhook(body) {
  const url = webhookUrl();
  if (!url) return Promise.resolve(false);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "gwon 일정", ...body }),
  })
    .then((res) => {
      if (!res.ok) console.warn(`[discord] webhook ${res.status}`);
      return res.ok;
    })
    .catch((err) => {
      console.warn("[discord] calendar notify failed:", err.message);
      return false;
    });
}

export function notifyCalendarChange(action, event) {
  if (!event) return;
  postWebhook({ embeds: [embedOf(action, event)] });
}

function kstParts(ms = Date.now()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function dateKeyOf(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const mo = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return String(value || "").slice(0, 10);
}

function timeOf(value) {
  return value ? String(value).slice(0, 5) : "";
}

function weekdayKo(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] || "";
}

function formatDot(dateKey) {
  const [, m, d] = String(dateKey).split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatLong(dateKey) {
  const [y, m, d] = String(dateKey).split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${weekdayKo(dateKey)})`;
}

function eventTime(row) {
  const start = timeOf(row.start_time);
  const end = timeOf(row.end_time);
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return "종일";
}

function eventKind(row) {
  if (row.appointment_type) return String(row.appointment_type);
  if (row.income_type && INCOME_LABEL[row.income_type]) return INCOME_LABEL[row.income_type];
  return "";
}

function hexColor(theme) {
  const named = THEME_COLORS[String(theme || "").toLowerCase()];
  if (named) return named;
  const hex = String(theme || "").replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return Number.parseInt(hex, 16);
  return THEME_COLORS.gray;
}

function todayCard(row) {
  const kind = eventKind(row);
  const fields = [{ name: "시간", value: eventTime(row), inline: true }];
  if (kind) fields.push({ name: "종류", value: kind, inline: true });
  if (row.location_name) fields.push({ name: "장소", value: clip(row.location_name, 200), inline: false });
  if (row.description) fields.push({ name: "메모", value: clip(row.description, 400), inline: false });
  return {
    title: clip(row.title || "(제목 없음)", 80),
    color: hexColor(row.theme_color),
    fields,
  };
}

function weekSummaryEmbed(today, until, rows) {
  const lines = [];
  for (let i = 0; i <= 7; i++) {
    const key = addDays(today, i);
    const dayRows = rows.filter((r) => dateKeyOf(r.event_date) === key);
    const items = dayRows.length
      ? dayRows.map((r) => `${eventTime(r)} ${r.title || "(제목 없음)"}`).join(" · ")
      : "없음";
    lines.push(`**${formatDot(key)} (${weekdayKo(key)})**  ${clip(items, 180)}`);
  }
  return {
    title: `일주일 요약  ·  ${formatDot(today)}–${formatDot(until)}`,
    color: 0xd8c19a,
    description: lines.join("\n"),
  };
}

async function loadRange(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT e.title, e.description, e.event_date, e.start_time, e.end_time,
            e.location_name, e.appointment_type, e.income_type, e.theme_color, e.is_done
     FROM calendar_events e
     JOIN users u ON u.id = e.owner_id
     WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
       AND e.event_date BETWEEN ? AND ?
     ORDER BY e.event_date ASC,
       CASE WHEN e.start_time IS NULL THEN 0 ELSE 1 END,
       e.start_time ASC,
       e.id ASC`,
    [startDate, endDate]
  );
  return rows || [];
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function sendMorningDigest() {
  if (!webhookUrl()) return;
  const today = kstParts().date;
  const until = addDays(today, 7);
  const rows = await loadRange(today, until);
  const todayRows = rows.filter((r) => dateKeyOf(r.event_date) === today && !r.is_done);

  const cards = todayRows.length
    ? todayRows.map(todayCard)
    : [{ title: "오늘 일정 없음", color: 0x64748b, description: formatLong(today) }];

  await postWebhook({
    content: `**오늘 일정**  ·  ${formatLong(today)}`,
    embeds: cards.slice(0, 10),
  });
  for (const extra of chunk(cards.slice(10), 10)) {
    await postWebhook({ embeds: extra });
  }
  await postWebhook({
    content: "**일주일 요약**  ·  오늘부터 7일",
    embeds: [weekSummaryEmbed(today, until, rows)],
  });
  console.log(`[discord] morning digest sent today=${today} cards=${todayRows.length} week=${rows.length}`);
}

async function tickDigest() {
  const { date, hour, minute } = kstParts();
  if (hour !== 9 || minute > 2) return;
  if (lastDigestDate === date) return;
  lastDigestDate = date;
  try {
    await sendMorningDigest();
  } catch (err) {
    lastDigestDate = "";
    console.warn("[discord] morning digest failed:", err.message);
  }
}

export function startCalendarDigestScheduler() {
  if (digestTimer) return;
  tickDigest().catch(() => {});
  digestTimer = setInterval(() => {
    tickDigest().catch((err) => console.warn("[discord] digest tick:", err.message));
  }, 60 * 1000);
}
