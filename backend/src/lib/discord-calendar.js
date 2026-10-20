import pool from "../db.js";

const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

let digestTimer = null;
let lastDigestDate = "";
let todayNotifyTimer = null;
let todayNotifyAction = "edit";

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

function clip(text, max = 400) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}`;
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

export function notifyCalendarChange(action) {
  todayNotifyAction = action || "edit";
  clearTimeout(todayNotifyTimer);
  todayNotifyTimer = setTimeout(() => {
    sendTodaySnapshot(todayNotifyAction).catch((err) => {
      console.warn("[discord] today snapshot failed:", err.message);
    });
  }, 500);
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
  const [, m, d] = String(dateKey).split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function eventTime(row) {
  const start = timeOf(row.start_time);
  const end = timeOf(row.end_time);
  if (start && end) return `${start} ${end}`;
  if (start) return start;
  return "종일";
}

function isAllDay(row) {
  return !timeOf(row.start_time);
}

function compactTodayEmbed(rows, { today, action = "morning" }) {
  const allDay = rows.filter(isAllDay);
  const timed = rows.filter((r) => !isAllDay(r));
  const parts = [];
  if (allDay.length) {
    parts.push(`종일 : ${allDay.map((r) => clip(r.title || "", 10)).join(" · ")}`);
  }
  const timedBits = timed.map(
    (r, i) => `일정${i + 1} : ${clip(r.title || "(없음)", 12)} ${eventTime(r)}`
  );
  for (let i = 0; i < timedBits.length; i += 2) {
    parts.push(timedBits.slice(i, i + 2).join("    "));
  }
  if (!parts.length) parts.push("일정 없음");

  const colors = { add: 0x86efac, edit: 0xd8c19a, delete: 0xf87171, morning: 0xd8c19a };
  return {
    title: `오늘일정 (${formatLong(today)})`,
    color: colors[action] || 0xd8c19a,
    description: parts.join("\n"),
  };
}

async function sendTodaySnapshot(action) {
  if (!webhookUrl()) return;
  const today = kstParts().date;
  const rows = await loadRange(today, today);
  await postWebhook({
    embeds: [compactTodayEmbed(rows, { today, action })],
  });
}

function weekSummaryEmbed(today, until, rows) {
  const lines = [];
  for (let i = 0; i <= 7; i++) {
    const key = addDays(today, i);
    const dayRows = rows.filter((r) => dateKeyOf(r.event_date) === key);
    const items = dayRows.length
      ? dayRows
          .map((r) => (isAllDay(r) ? clip(r.title || "", 10) : `${eventTime(r)} ${clip(r.title || "", 16)}`))
          .join(" · ")
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

export async function sendMorningDigest() {
  if (!webhookUrl()) return;
  const today = kstParts().date;
  const until = addDays(today, 7);
  const rows = await loadRange(today, until);
  const todayRows = rows.filter((r) => dateKeyOf(r.event_date) === today);

  await postWebhook({
    embeds: [
      compactTodayEmbed(todayRows, { today, action: "morning" }),
      weekSummaryEmbed(today, until, rows),
    ],
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
