import pool from "../db.js";

const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com"]);
const SNAPSHOT_KEY = "calendar_discord_snapshot";
const LAST_RUN_KEY = "calendar_discord_last_run";
const MSG_KEY = {
  today: "calendar_discord_msg_today",
  week: "calendar_discord_msg_week",
};

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

function sanitizeWebhook(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return "";
    if (!WEBHOOK_HOSTS.has(u.hostname)) return "";
    if (!u.pathname.startsWith("/api/webhooks/")) return "";
    return value;
  } catch {
    return "";
  }
}

function webhookToday() {
  return sanitizeWebhook(
    process.env.GWON_SCHEDULE_TODAY ||
      process.env.DISCORD_SCHEDULE_TODAY ||
      process.env.gwon_schedule_today
  );
}

function webhookWeek() {
  return sanitizeWebhook(
    process.env.GWON_SCHEDULE_WEEK ||
      process.env.DISCORD_SCHEDULE_WEEK ||
      process.env.gwon_schedule_week
  );
}

function webhookFor(channel) {
  return channel === "week" ? webhookWeek() : webhookToday();
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

/** 해당 날짜가 속한 주의 월요일(KST 달력 기준, 월~일). */
function mondayOfWeek(dateKey) {
  const wd = weekdayIndex(dateKey);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(dateKey, offset);
}

/** 오늘을 제외한 이번 주(월~일) 날짜. */
export function weekDatesExceptToday(today) {
  const mon = mondayOfWeek(today);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter((d) => d !== today);
}

/** 종 버튼 대상: today | week | null(숨김). */
export function notifyChannelForDate(dateKey, today = kstParts().date) {
  if (!dateKey) return null;
  if (dateKey === today) return "today";
  if (weekDatesExceptToday(today).includes(dateKey)) return "week";
  return null;
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

function todayTitle(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function fingerprint(event) {
  return [event.date, event.emoji, event.start, event.end, event.title, event.description || ""].join("|");
}

function compareEvents(a, b) {
  if (a.start && !b.start) return -1;
  if (!a.start && b.start) return 1;
  if (a.start !== b.start) return String(a.start).localeCompare(String(b.start));
  return String(a.title).localeCompare(String(b.title), "ko");
}

function formatLine(event, mark) {
  const when = event.start ? `${event.start}${event.end ? ` ${event.end}` : ""}` : "종일";
  const base = `${event.emoji || ""}${when} : ${event.title}`;
  return mark ? `${base} (${mark})` : base;
}

function buildEmbeds(dates, current, snapshot, markChanges, { heading } = {}) {
  const currentById = new Map(current.map((event) => [event.id, event]));
  const embeds = [];

  for (const date of dates) {
    const dayEvents = current.filter((event) => event.date === date).sort(compareEvents);
    const deleted = markChanges
      ? Object.values(snapshot)
          .filter((event) => event?.date === date && !currentById.has(event.id))
          .sort(compareEvents)
      : [];

    const fields = [];
    for (const event of dayEvents) {
      const prev = snapshot[event.id];
      const changed = Boolean(markChanges && prev && fingerprint(prev) !== fingerprint(event));
      const desc = String(event.description || "").trim();
      fields.push({
        name: formatLine(event, changed ? "수정" : ""),
        value: desc || "\u200b",
        inline: false,
      });
    }
    for (const event of deleted) {
      fields.push({
        name: formatLine(event, "삭제"),
        value: String(event.description || "").trim() || "\u200b",
        inline: false,
      });
    }

    const embed = {
      title: dates.length === 1 && heading ? heading : dateHeader(date),
      color: 0x5865f2,
    };
    if (!fields.length) {
      embed.description = "없음";
    } else {
      // Discord 필드 상한 25. 넘치면 description 으로 이어 붙인다.
      embed.fields = fields.slice(0, 25);
      if (fields.length > 25) {
        const extra = fields.slice(25).map((f) => `**${f.name}**\n${f.value === "\u200b" ? "" : f.value}`).join("\n\n");
        embed.description = extra.slice(0, 4000);
      }
    }
    embeds.push(embed);
  }

  return embeds.slice(0, 10);
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
    `SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.appointment_type
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

async function loadMessageId(channel) {
  const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [MSG_KEY[channel]]);
  return String(rows[0]?.value || "").trim();
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

async function postOrEdit(channel, embeds) {
  const url = webhookFor(channel);
  if (!url) {
    const error = new Error(
      channel === "week"
        ? "GWON_SCHEDULE_WEEK 웹훅이 설정되어 있지 않습니다."
        : "GWON_SCHEDULE_TODAY 웹훅이 설정되어 있지 않습니다."
    );
    error.status = 400;
    throw error;
  }

  const body = {
    username: channel === "week" ? "gwon 일정 · 일주일" : "gwon 일정 · 오늘",
    embeds,
    allowed_mentions: { parse: [] },
  };

  const existingId = await loadMessageId(channel);
  if (existingId) {
    const editUrl = `${url}/messages/${encodeURIComponent(existingId)}`;
    const editRes = await fetch(editUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (editRes.ok) return { messageId: existingId, edited: true };
    // 메시지가 지워졌으면 새로 보낸다.
  }

  const createRes = await fetch(`${url}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    const error = new Error(`Discord 전송 실패 (${createRes.status}) ${detail.slice(0, 180)}`);
    error.status = 502;
    throw error;
  }
  const created = await createRes.json().catch(() => ({}));
  const messageId = String(created?.id || "").trim();
  if (messageId) await saveSetting(MSG_KEY[channel], messageId);
  return { messageId, edited: false };
}

function mapRows(rows, emojis) {
  return rows.map((row) => ({
    id: String(row.id),
    date: dateKeyOf(row.event_date),
    title: String(row.title || "").trim() || "(제목 없음)",
    description: String(row.description || "").trim(),
    start: timeOf(row.start_time),
    end: timeOf(row.end_time),
    emoji: emojis[String(row.appointment_type || "")] || "",
  }));
}

async function sendChannel(channel, dates, { markChanges = false, now = kstParts(), snapshot } = {}) {
  if (!dates.length) {
    // 주간 채널에 남은 날이 없으면 "없음" 한 장으로 덮어쓴다.
    const embeds = [
      {
        title: channel === "week" ? "이번 주 (오늘 제외)" : todayTitle(now.date),
        description: "없음",
        color: 0x5865f2,
      },
    ];
    await postOrEdit(channel, embeds);
    return { channel, dates, embeds };
  }

  const start = dates[0];
  const end = dates[dates.length - 1];
  const emojis = await loadKeywordEmojis();
  const snap = snapshot ?? (await loadSnapshot());
  const rows = await loadRange(start, end);
  const current = mapRows(rows, emojis).filter((e) => dates.includes(e.date));
  const embeds = buildEmbeds(dates, current, snap, markChanges, {
    heading: channel === "today" ? todayTitle(dates[0]) : undefined,
  });
  await postOrEdit(channel, embeds);
  return { channel, dates, current, snapshot: snap, embeds };
}

/**
 * @param {{ markChanges?: boolean, channel?: "today"|"week"|"both", now?: ReturnType<typeof kstParts> }} opts
 */
export async function sendCalendarDigest({
  markChanges = false,
  channel = "both",
  now = kstParts(),
} = {}) {
  const todayDates = [now.date];
  const weekDates = weekDatesExceptToday(now.date);
  const allDates = [...new Set([...todayDates, ...weekDates])].sort();
  const snapshot = await loadSnapshot();

  const results = [];
  if (channel === "today" || channel === "both") {
    results.push(await sendChannel("today", todayDates, { markChanges, now, snapshot }));
  }
  if (channel === "week" || channel === "both") {
    results.push(await sendChannel("week", weekDates, { markChanges, now, snapshot }));
  }

  const coveredCurrent = [];
  for (const r of results) {
    if (r.current) coveredCurrent.push(...r.current);
  }
  // both 가 아니면 스냅샷은 해당 채널 날짜만 갱신
  const coveredDates =
    channel === "today" ? todayDates : channel === "week" ? weekDates : allDates;

  // 부분 전송 시에도 해당 날짜 이벤트는 최신으로 맞춘다.
  let currentForSnap = coveredCurrent;
  if (channel !== "both") {
    const emojis = await loadKeywordEmojis();
    const rows = await loadRange(coveredDates[0] || now.date, coveredDates[coveredDates.length - 1] || now.date);
    currentForSnap = mapRows(rows, emojis).filter((e) => coveredDates.includes(e.date));
  }

  await saveSetting(
    SNAPSHOT_KEY,
    JSON.stringify(nextSnapshot(snapshot, coveredDates, currentForSnap, now.date))
  );

  return {
    channel,
    dates: coveredDates,
    channels: results.map((r) => r.channel),
  };
}

/**
 * 날짜 기준으로 today/week 채널에 덮어쓴다.
 * 이번 주 밖이면 400.
 */
export async function sendCalendarNotifyForDate(dateKey, { markChanges = true, now = kstParts() } = {}) {
  const channel = notifyChannelForDate(dateKey, now.date);
  if (!channel) {
    const error = new Error("오늘·이번 주(오늘 제외) 일정만 디스코드로 보낼 수 있습니다.");
    error.status = 400;
    throw error;
  }
  return sendCalendarDigest({ markChanges, channel, now });
}

async function tickDigest() {
  if (ticking) return;
  const now = kstParts();
  if (now.hour !== 9 || now.minute > 2) return;
  ticking = true;
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [LAST_RUN_KEY]);
    if (rows[0]?.value === now.date) return;
    if (!webhookToday() && !webhookWeek()) return;
    await sendCalendarDigest({ markChanges: false, channel: "both", now });
    await saveSetting(LAST_RUN_KEY, now.date);
    console.log(`[discord] ${now.date} 오늘·일주일 알림 전송`);
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
