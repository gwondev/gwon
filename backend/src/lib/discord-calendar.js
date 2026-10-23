import pool from "../db.js";

const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);
const SNAPSHOT_KEY = "calendar_discord_snapshot";
const LAST_RUN_KEY = "calendar_discord_last_run";

let digestTimer = null;
let ticking = false;

const DEFAULT_KEYWORD_EMOJI = {
  TODO: "✅",
  MONEY: "💰",
  DRINK: "🍻",
  JOB: "🎓",
  DATE: "💕",
  TRIP: "✈️",
};

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
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour,
    minute: Number(map.minute),
  };
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function weekdayIndex(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function digestDates(today) {
  if (weekdayIndex(today) !== 1) return [today];
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

function dateKeyOf(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
}

function timeOf(value) {
  if (!value) return "";
  const match = String(value).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function dateHeader(dateKey) {
  const [, month, day] = String(dateKey).split("-");
  return `${Number(month)}/${Number(day)}`;
}

function fingerprint(event) {
  return [event.date, event.emoji, event.start, event.end, event.title].join("|");
}

function compareEvents(a, b) {
  if (a.start && !b.start) return -1;
  if (!a.start && b.start) return 1;
  if (a.start !== b.start) return String(a.start).localeCompare(String(b.start));
  return String(a.title).localeCompare(String(b.title), "ko");
}

function formatLine(event, mark) {
  const when = event.start ? `${event.start}${event.end ? ` ${event.end}` : ""}` : "종일";
  return `${event.emoji || ""}${when} : ${event.title}${mark ? ` (${mark})` : ""}`;
}

function buildMessage(dates, current, snapshot, markChanges) {
  const currentById = new Map(current.map((event) => [event.id, event]));
  const blocks = [];

  for (const date of dates) {
    const dayEvents = current.filter((event) => event.date === date).sort(compareEvents);
    const deleted = markChanges
      ? Object.values(snapshot)
          .filter((event) => event?.date === date && !currentById.has(event.id))
          .sort(compareEvents)
      : [];
    const lines = [dateHeader(date)];
    if (!dayEvents.length && !deleted.length) {
      lines.push("없음");
    } else {
      for (const event of dayEvents) {
        const prev = snapshot[event.id];
        const changed = Boolean(markChanges && prev && fingerprint(prev) !== fingerprint(event));
        lines.push(formatLine(event, changed ? "수정" : ""));
      }
      for (const event of deleted) lines.push(formatLine(event, "삭제"));
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

async function loadKeywordEmojis() {
  const map = { ...DEFAULT_KEYWORD_EMOJI };
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = 'calendar_keywords' LIMIT 1");
    const items = JSON.parse(rows[0]?.value || "[]");
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item?.id && item?.emoji) map[item.id] = String(item.emoji);
      }
    }
  } catch {
    /* 기본 이모지 유지 */
  }
  return map;
}

async function loadRange(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.appointment_type
     FROM calendar_events e
     JOIN users u ON u.id = e.owner_id
     WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
       AND e.event_date BETWEEN ? AND ?
     ORDER BY e.event_date ASC, e.id ASC`,
    [startDate, endDate]
  );
  return rows || [];
}

async function loadSnapshot() {
  const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [SNAPSHOT_KEY]);
  if (!rows[0]?.value) return {};
  try {
    const parsed = JSON.parse(rows[0].value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (\`key\`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [key, value]
  );
}

function nextSnapshot(previous, dates, current, today) {
  const covered = new Set(dates);
  const cutoff = addDays(today, -21);
  const next = {};
  for (const [id, event] of Object.entries(previous)) {
    if (!event?.date || event.date < cutoff || covered.has(event.date)) continue;
    next[id] = event;
  }
  for (const event of current) {
    if (covered.has(event.date)) next[event.id] = event;
  }
  return next;
}

async function postContent(content) {
  const url = webhookUrl();
  if (!url) {
    const error = new Error("DISCORD_CALENDAR_WEBHOOK_URL 이 설정되어 있지 않습니다.");
    error.status = 400;
    throw error;
  }

  const chunks = [];
  let rest = content;
  while (rest.length > 1900) {
    const cut = rest.lastIndexOf("\n", 1900);
    const at = cut > 0 ? cut : 1900;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);

  for (const chunk of chunks) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gwon 일정", content: chunk }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = new Error(`Discord 전송 실패 (${res.status}) ${detail.slice(0, 180)}`);
      error.status = 502;
      throw error;
    }
  }
}

export async function sendCalendarDigest({ markChanges = false, now = kstParts() } = {}) {
  const dates = digestDates(now.date);
  const emojis = await loadKeywordEmojis();
  const [rows, snapshot] = await Promise.all([
    loadRange(dates[0], dates[dates.length - 1]),
    loadSnapshot(),
  ]);
  const current = rows.map((row) => ({
    id: String(row.id),
    date: dateKeyOf(row.event_date),
    title: String(row.title || "").trim() || "(제목 없음)",
    start: timeOf(row.start_time),
    end: timeOf(row.end_time),
    emoji: emojis[String(row.appointment_type || "")] || "",
  }));
  const content = buildMessage(dates, current, snapshot, markChanges);
  await postContent(content);
  await saveSetting(SNAPSHOT_KEY, JSON.stringify(nextSnapshot(snapshot, dates, current, now.date)));
  return { content, dates };
}

async function tickDigest() {
  if (ticking) return;
  const now = kstParts();
  if (now.hour !== 9 || now.minute > 2) return;
  ticking = true;
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [LAST_RUN_KEY]);
    if (rows[0]?.value === now.date) return;
    if (!webhookUrl()) return;
    await sendCalendarDigest({ markChanges: false, now });
    await saveSetting(LAST_RUN_KEY, now.date);
    console.log(`[discord] ${now.date} 알림 전송`);
  } catch (err) {
    console.warn("[discord] morning digest failed:", err.message);
  } finally {
    ticking = false;
  }
}

export function startCalendarDigestScheduler() {
  if (digestTimer) return;
  digestTimer = setInterval(() => {
    tickDigest().catch((err) => console.warn("[discord] digest tick:", err.message));
  }, 30 * 1000);
  tickDigest().catch((err) => console.warn("[discord] digest tick:", err.message));
}
