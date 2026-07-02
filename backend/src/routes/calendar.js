import { Router } from "express";
import pool from "../db.js";
import {
  requireCalendarAdmin,
  isSuperAdminRole,
  isCalendarAdminRole,
  getUserRole,
} from "../auth-middleware.js";

const router = Router();

const INCOME_TYPES = ["ALBA", "WORK", "SCHOLARSHIP"];
const APPOINTMENT_TYPES = ["MONEY", "DRINK"];
const THEME_COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
];

function makeSeriesId() {
  return `series_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseJsonOwnerIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  } catch {
    return [];
  }
}

function normalizeOwnerIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
}

function resolveEventOwnerIds(row) {
  const ids = parseJsonOwnerIds(row.shared_owner_ids);
  if (ids.length) return ids;
  return [row.owner_id];
}

function publicEvent(row) {
  const sharedOwnerIds = resolveEventOwnerIds(row);
  return {
    id: row.id,
    ownerId: row.owner_id,
    seriesId: row.series_id || `single-${row.id}`,
    seriesStartDate: row.series_start_date
      ? String(row.series_start_date).slice(0, 10)
      : (row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date).slice(0, 10)),
    seriesEndDate: row.series_end_date
      ? String(row.series_end_date).slice(0, 10)
      : (row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date).slice(0, 10)),
    spanDays: Number(row.series_span_days) || 1,
    repeatWeeks: Number(row.series_repeat_weeks) || 1,
    weekdays: normalizeWeekdays(row.series_weekdays),
    repeat: row.series_repeat_freq
      ? {
          freq: row.series_repeat_freq,
          interval: Number(row.series_repeat_interval) || 1,
          weekdays: normalizeWeekdays(row.series_weekdays),
          until: row.series_repeat_until
            ? String(row.series_repeat_until).slice(0, 10)
            : null,
        }
      : null,
    appointmentType: row.appointment_type || null,
    sharedOwnerIds,
    sharedOwnerNames: row.sharedOwnerNames || [],
    createdBy: row.created_by,
    title: row.title,
    description: row.description || "",
    eventDate: row.event_date instanceof Date
      ? row.event_date.toISOString().slice(0, 10)
      : String(row.event_date).slice(0, 10),
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    incomeType: row.income_type || null,
    locationName: row.location_name || null,
    locationLat: row.location_lat != null ? Number(row.location_lat) : null,
    locationLng: row.location_lng != null ? Number(row.location_lng) : null,
    ownerName: row.owner_name || row.owner_nickname || null,
    ownerThemeColor: row.owner_theme_color || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ADMIN·SUPER_ADMIN 은 캘린더 안에서 서로 동등한 "공동 작업자"로 취급한다.
async function canManageOwner(actorId, actorRole, ownerId) {
  if (actorId === ownerId) return true;
  if (!isCalendarAdminRole(actorRole)) return false;
  const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [ownerId]);
  const owner = rows[0];
  if (!owner) return false;
  return isCalendarAdminRole(owner.role);
}

async function canManageEvent(actorId, actorRole, eventRow) {
  if (eventRow.owner_id === actorId || eventRow.created_by === actorId) return true;
  if (resolveEventOwnerIds(eventRow).includes(actorId)) return true;
  if (!isCalendarAdminRole(actorRole)) return false;
  return canManageOwner(actorId, actorRole, eventRow.owner_id);
}

async function resolveOwnerId(req, requestedOwnerId) {
  const actorId = req.auth.uid;
  const actorRole = req.userRole || (await getUserRole(actorId));

  if (!requestedOwnerId || Number(requestedOwnerId) === actorId) {
    return actorId;
  }

  const ownerId = Number(requestedOwnerId);
  if (!Number.isFinite(ownerId)) {
    throw Object.assign(new Error("유효하지 않은 ownerId 입니다."), { status: 400 });
  }

  if (!(await canManageOwner(actorId, actorRole, ownerId))) {
    throw Object.assign(new Error("해당 사용자의 일정에 접근할 수 없습니다."), { status: 403 });
  }

  return ownerId;
}

function parseOwnerIdsQuery(raw) {
  if (!raw) return [];
  const parts = String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(parts)];
}

function toDateKey(input) {
  if (input == null) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function toTimeMinute(v) {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

async function resolveOwnerIds(req, requestedOwnerIds) {
  const actorId = req.auth.uid;
  const actorRole = req.userRole || (await getUserRole(actorId));
  const ids = Array.isArray(requestedOwnerIds)
    ? [...new Set(requestedOwnerIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (ids.length === 0) return [actorId];

  for (const id of ids) {
    if (id !== actorId && !(await canManageOwner(actorId, actorRole, id))) {
      throw Object.assign(new Error("선택한 일정 주체에 접근할 수 없습니다."), { status: 403 });
    }
  }

  return ids;
}

async function canViewOwner(actorId, actorRole, ownerId) {
  if (actorId === ownerId) return true;
  if (!isCalendarAdminRole(actorRole)) return false;
  const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [ownerId]);
  const target = rows[0];
  return Boolean(target && isCalendarAdminRole(target.role));
}

async function resolveViewOwnerIds(req, requestedOwnerIds) {
  const actorId = req.auth.uid;
  const actorRole = req.userRole || (await getUserRole(actorId));
  const ids = Array.isArray(requestedOwnerIds)
    ? [...new Set(requestedOwnerIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  if (ids.length === 0) return [actorId];

  for (const id of ids) {
    if (!(await canViewOwner(actorId, actorRole, id))) {
      throw Object.assign(new Error("선택한 일정 주체에 접근할 수 없습니다."), { status: 403 });
    }
  }
  return ids;
}

async function getVisibleOwnerIds(actorId, actorRole) {
  if (!isCalendarAdminRole(actorRole)) return [actorId];
  const [rows] = await pool.query(
    `SELECT id FROM users
     WHERE role IN ('ADMIN', 'SUPER_ADMIN')
     ORDER BY FIELD(role, 'SUPER_ADMIN', 'ADMIN'), id ASC`
  );
  return rows.map((u) => u.id);
}

async function buildOwnerNameMap(ownerIds) {
  const ids = normalizeOwnerIds(ownerIds);
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT id, name, nickname, email FROM users WHERE id IN (${placeholders})`,
    ids
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.id, row.nickname || row.name || row.email || `#${row.id}`);
  }
  return map;
}

function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) {
    if (typeof weekdays === "string" && weekdays.trim()) {
      return normalizeWeekdays(weekdays.split(","));
    }
    return [];
  }
  return [...new Set(weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
    (a, b) => a - b
  );
}

function dateKeyOf(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const MAX_EXPAND_DAYS = 800;

function parseDateKey(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function expandEventDates(eventDate, spanDays, repeatWeeks, weekdays, endDate) {
  const start = parseDateKey(eventDate);
  if (!start) return [];
  const weeks = Math.min(Math.max(Number(repeatWeeks) || 1, 1), 52);
  const end = parseDateKey(endDate);
  const dates = new Set();

  const wd = normalizeWeekdays(weekdays);
  if (wd.length) {
    const wdSet = new Set(wd);
    // 종료일이 지정되면 시작~종료 사이의 선택 요일만
    if (end) {
      if (end < start) return [];
      const dt = new Date(start);
      let guard = 0;
      while (dt <= end && guard < MAX_EXPAND_DAYS) {
        if (wdSet.has(dt.getDay())) dates.add(dateKeyOf(dt));
        dt.setDate(dt.getDate() + 1);
        guard += 1;
      }
      return [...dates].sort();
    }
    // 아니면 시작일이 속한 주(일요일)부터 N주 동안, 선택 요일만 (시작일 이전 제외)
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay());
    for (let w = 0; w < weeks; w++) {
      for (let day = 0; day < 7; day++) {
        const dt = new Date(weekStart);
        dt.setDate(weekStart.getDate() + w * 7 + day);
        if (!wdSet.has(dt.getDay())) continue;
        if (dt < start) continue;
        dates.add(dateKeyOf(dt));
      }
    }
    return [...dates].sort();
  }

  if (end) {
    if (end < start) return [];
    const dt = new Date(start);
    let guard = 0;
    while (dt <= end && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + 1);
      guard += 1;
    }
    return [...dates].sort();
  }

  const span = Math.min(Math.max(Number(spanDays) || 1, 1), 366);
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < span; day++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + day);
      dates.add(dateKeyOf(dt));
    }
  }
  return [...dates].sort();
}

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function normalizeRepeat(repeat) {
  if (!repeat || typeof repeat !== "object" || !repeat.freq) return null;
  const freq = String(repeat.freq);
  if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) return null;
  return {
    freq,
    interval: Math.min(Math.max(Number(repeat.interval) || 1, 1), 99),
    weekdays: normalizeWeekdays(repeat.weekdays),
    until: repeat.until && /^\d{4}-\d{2}-\d{2}/.test(String(repeat.until))
      ? String(repeat.until).slice(0, 10)
      : null,
  };
}

// 통합 날짜 생성기 (프론트 calendarUtils.expandOccurrences 와 동일 규칙)
function expandOccurrences(spec) {
  const start = parseDateKey(spec && spec.startDate);
  if (!start) return [];
  const dates = new Set();
  const repeat = normalizeRepeat(spec && spec.repeat);

  if (!repeat) {
    const end = parseDateKey(spec && spec.endDate) || start;
    if (end < start) return [dateKeyOf(start)];
    const dt = new Date(start);
    let guard = 0;
    while (dt <= end && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + 1);
      guard += 1;
    }
    return [...dates].sort();
  }

  const interval = repeat.interval;
  const until = parseDateKey(repeat.until) || start;
  if (until < start) return [dateKeyOf(start)];

  if (repeat.freq === "daily") {
    const dt = new Date(start);
    let guard = 0;
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + interval);
      guard += 1;
    }
  } else if (repeat.freq === "weekly") {
    const wd = repeat.weekdays.length ? repeat.weekdays : [start.getDay()];
    const wdSet = new Set(wd);
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay());
    let guard = 0;
    for (let w = 0; guard < MAX_EXPAND_DAYS; w += interval) {
      const base = new Date(weekStart);
      base.setDate(weekStart.getDate() + w * 7);
      if (base > until) break;
      for (let day = 0; day < 7; day++) {
        const dt = new Date(base);
        dt.setDate(base.getDate() + day);
        if (!wdSet.has(dt.getDay())) continue;
        if (dt < start || dt > until) continue;
        dates.add(dateKeyOf(dt));
      }
      guard += 1;
    }
  } else if (repeat.freq === "monthly") {
    let guard = 0;
    let dt = new Date(start);
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt = addMonths(start, (guard + 1) * interval);
      guard += 1;
    }
  } else if (repeat.freq === "yearly") {
    const dt = new Date(start);
    let guard = 0;
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setFullYear(dt.getFullYear() + interval);
      guard += 1;
    }
  }
  return [...dates].sort();
}

async function insertEvent(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO calendar_events
     (owner_id, created_by, shared_owner_ids, series_id, series_start_date, series_end_date, series_span_days, series_repeat_weeks, series_weekdays,
      series_repeat_freq, series_repeat_interval, series_repeat_until,
      appointment_type, location_name, location_lat, location_lng, title, description, event_date, start_time, end_time, income_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.ownerId,
      data.actorId,
      JSON.stringify(data.sharedOwnerIds || [data.ownerId]),
      data.seriesId || null,
      data.seriesStartDate || null,
      data.seriesEndDate || null,
      data.seriesSpanDays || 1,
      data.seriesRepeatWeeks || 1,
      data.seriesWeekdays && data.seriesWeekdays.length ? data.seriesWeekdays.join(",") : null,
      data.repeat?.freq || null,
      data.repeat?.freq ? data.repeat.interval || 1 : null,
      data.repeat?.until || null,
      data.appointmentType || null,
      data.locationName || null,
      data.locationLat ?? null,
      data.locationLng ?? null,
      data.title,
      data.description || null,
      data.eventDate,
      data.startTime || null,
      data.endTime || null,
      data.incomeType || null,
    ]
  );
  const [rows] = await conn.query(
    `SELECT e.*, u.name AS owner_name, u.nickname AS owner_nickname,
            u.calendar_theme_color AS owner_theme_color
     FROM calendar_events e
     JOIN users u ON u.id = e.owner_id
     WHERE e.id = ?`,
    [result.insertId]
  );
  return rows[0];
}

async function updateEventRow(conn, id, data) {
  await conn.query(
    `UPDATE calendar_events SET
       owner_id = ?, shared_owner_ids = ?, series_id = ?,
       series_start_date = ?, series_end_date = ?, series_span_days = ?, series_repeat_weeks = ?, series_weekdays = ?,
       series_repeat_freq = ?, series_repeat_interval = ?, series_repeat_until = ?,
       appointment_type = ?, location_name = ?, location_lat = ?, location_lng = ?,
       title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, income_type = ?
     WHERE id = ?`,
    [
      data.ownerId,
      JSON.stringify(data.sharedOwnerIds || [data.ownerId]),
      data.seriesId || null,
      data.seriesStartDate || null,
      data.seriesEndDate || null,
      data.seriesSpanDays || 1,
      data.seriesRepeatWeeks || 1,
      data.seriesWeekdays && data.seriesWeekdays.length ? data.seriesWeekdays.join(",") : null,
      data.repeat?.freq || null,
      data.repeat?.freq ? data.repeat.interval || 1 : null,
      data.repeat?.until || null,
      data.appointmentType || null,
      data.locationName || null,
      data.locationLat ?? null,
      data.locationLng ?? null,
      data.title,
      data.description || null,
      data.eventDate,
      data.startTime || null,
      data.endTime || null,
      data.incomeType || null,
      id,
    ]
  );
}

async function createSeriesEvents(conn, data) {
  const repeat = normalizeRepeat(data.repeat);
  const weekdays = repeat?.freq === "weekly" ? repeat.weekdays : [];
  const dates = expandOccurrences({ startDate: data.eventDate, endDate: data.endDate, repeat });
  if (!dates.length) {
    throw Object.assign(new Error("유효한 날짜가 없습니다."), { status: 400 });
  }
  const seriesId = data.seriesId || makeSeriesId();
  const seriesStartDate = dates[0];
  const seriesEndDate = dates[dates.length - 1];
  const created = [];
  for (const date of dates) {
    const row = await insertEvent(conn, {
      ...data,
      eventDate: date,
      seriesId,
      seriesStartDate,
      seriesEndDate,
      seriesSpanDays: dates.length,
      seriesRepeatWeeks: 1,
      seriesWeekdays: weekdays,
      repeat,
    });
    created.push(row);
  }
  return created;
}

function parseLocationFields(body, existing = null) {
  if (body.locationName === undefined && body.locationLat === undefined && body.locationLng === undefined) {
    if (!existing) return { locationName: null, locationLat: null, locationLng: null };
    return {
      locationName: existing.location_name || null,
      locationLat: existing.location_lat != null ? Number(existing.location_lat) : null,
      locationLng: existing.location_lng != null ? Number(existing.location_lng) : null,
    };
  }

  const locationName = body.locationName ? String(body.locationName).trim() : null;
  const locationLat =
    body.locationLat != null && body.locationLat !== "" ? Number(body.locationLat) : null;
  const locationLng =
    body.locationLng != null && body.locationLng !== "" ? Number(body.locationLng) : null;

  if (locationName && (!Number.isFinite(locationLat) || !Number.isFinite(locationLng))) {
    throw Object.assign(new Error("위치 좌표가 올바르지 않습니다."), { status: 400 });
  }

  if (!locationName) {
    return { locationName: null, locationLat: null, locationLng: null };
  }

  return { locationName, locationLat, locationLng };
}

// GET /api/calendar/places?q=
router.get("/places", requireCalendarAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ items: [] });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("countrycodes", "kr");

    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "gwon-portfolio-calendar/1.0 (contact: portfolio)",
      },
    });

    if (!resp.ok) {
      return res.status(502).json({ error: "장소 검색에 실패했습니다." });
    }

    const data = await resp.json();
    const items = (Array.isArray(data) ? data : []).map((row) => ({
      name: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar/owners
router.get("/owners", requireCalendarAdmin, async (req, res, next) => {
  try {
    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));

    // ADMIN·SUPER_ADMIN 모두 캘린더 안에서는 동일하게 전체 공동 작업자 목록을 본다.
    if (isCalendarAdminRole(actorRole)) {
      const [rows] = await pool.query(
        `SELECT id, name, nickname, email, role, calendar_theme_color AS calendarThemeColor
         FROM users
         WHERE role IN ('ADMIN', 'SUPER_ADMIN')
         ORDER BY FIELD(role, 'SUPER_ADMIN', 'ADMIN'), id ASC`
      );
      const items = rows.map((u) => ({
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        email: u.email,
        role: u.role,
        calendarThemeColor: u.calendarThemeColor,
      }));
      return res.json({ items, selfId: actorId });
    }

    const [selfRows] = await pool.query(
      `SELECT id, name, nickname, email, role, calendar_theme_color AS calendarThemeColor
       FROM users WHERE id = ?`,
      [actorId]
    );
    res.json({ items: selfRows, selfId: actorId });
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar/filter — 저장된 일정 보기 필터
router.get("/filter", requireCalendarAdmin, async (req, res, next) => {
  try {
    const actorId = req.auth.uid;
    const [rows] = await pool.query(
      "SELECT calendar_filter_owner_ids FROM users WHERE id = ?",
      [actorId]
    );
    let ownerIds = null;
    const raw = rows[0]?.calendar_filter_owner_ids;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) ownerIds = parsed;
      } catch {
        ownerIds = null;
      }
    }

    if (ownerIds?.length) {
      ownerIds = await resolveViewOwnerIds(req, ownerIds);
    } else {
      ownerIds = null;
    }

    res.json({ ownerIds });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/calendar/filter { ownerIds: number[] }
router.put("/filter", requireCalendarAdmin, async (req, res, next) => {
  try {
    const ownerIds = await resolveViewOwnerIds(req, req.body?.ownerIds);
    if (!ownerIds.length) {
      return res.status(400).json({ error: "최소 한 명은 선택해야 합니다." });
    }

    await pool.query("UPDATE users SET calendar_filter_owner_ids = ? WHERE id = ?", [
      JSON.stringify(ownerIds),
      req.auth.uid,
    ]);

    res.json({ ownerIds });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/calendar/events?ownerIds=1,2&year=&month=
router.get("/events", requireCalendarAdmin, async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: "year, month 가 필요합니다." });
    }

    const queryIds = parseOwnerIdsQuery(req.query.ownerIds);
    const legacyId = req.query.ownerId ? [Number(req.query.ownerId)] : [];
    const requested = queryIds.length ? queryIds : legacyId;
    const ownerIds = await resolveViewOwnerIds(req, requested);
    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));
    const visibleOwnerIds = await getVisibleOwnerIds(actorId, actorRole);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const placeholders = visibleOwnerIds.map(() => "?").join(", ");
    const [rows] = await pool.query(
      `SELECT e.*, u.name AS owner_name, u.nickname AS owner_nickname,
              u.calendar_theme_color AS owner_theme_color
       FROM calendar_events e
       JOIN users u ON u.id = e.owner_id
       WHERE e.owner_id IN (${placeholders}) AND e.event_date BETWEEN ? AND ?
       ORDER BY e.event_date ASC,
         CASE WHEN e.start_time IS NULL THEN 0 ELSE 1 END,
         e.start_time ASC,
         e.id ASC`,
      [...visibleOwnerIds, startDate, endDate]
    );

    const filteredRows = rows.filter((row) =>
      resolveEventOwnerIds(row).some((id) => ownerIds.includes(id))
    );

    console.log(
      `[calendar] GET /events uid=${actorId} role=${actorRole} ${year}-${String(month).padStart(2, "0")} ` +
        `requested=[${requested.join(",")}] resolved=[${ownerIds.join(",")}] visible=[${visibleOwnerIds.join(",")}] ` +
        `rawRows=${rows.length} filtered=${filteredRows.length}` +
        (rows.length && !filteredRows.length
          ? ` | WARN: ${rows.length}건 조회됐으나 ownerIds 필터에서 모두 제외됨 ` +
            `(rowOwners=[${rows.map((r) => r.owner_id).join(",")}] sharedRaw=[${rows.map((r) => r.shared_owner_ids).join("|")}])`
          : "") +
        (filteredRows.length
          ? ` dates=[${filteredRows.map((r) => String(r.event_date).slice(0, 10)).join(",")}]`
          : "")
    );

    const participantIds = filteredRows.flatMap((row) => resolveEventOwnerIds(row));
    const nameMap = await buildOwnerNameMap(participantIds);
    const items = filteredRows.map((row) =>
      publicEvent({
        ...row,
        sharedOwnerNames: resolveEventOwnerIds(row).map((id) => nameMap.get(id) || `#${id}`),
      })
    );

    res.json({ items, ownerIds });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/calendar/events
router.post("/events", requireCalendarAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const eventDate = toDateKey(body.eventDate);
    const description = String(body.description || "").trim();
    const startTime = body.startTime ? String(body.startTime).trim() : null;
    const endTime = body.endTime ? String(body.endTime).trim() : null;
    const incomeType = body.incomeType ? String(body.incomeType).toUpperCase() : null;
    const appointmentType = body.appointmentType ? String(body.appointmentType).toUpperCase() : null;
    const repeat = normalizeRepeat(body.repeat);
    const endDate = body.endDate ? toDateKey(body.endDate) : null;
    const location = parseLocationFields(body);

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }
    if (appointmentType && !APPOINTMENT_TYPES.includes(appointmentType)) {
      return res.status(400).json({ error: "appointmentType 이 올바르지 않습니다." });
    }
    // 같은 날 시간 지정일 때만 순서 검증 (종료일이 다르면 종일/다일에 걸친 것으로 허용)
    if (!endDate && startTime && endTime && toTimeMinute(endTime) <= toTimeMinute(startTime)) {
      return res.status(400).json({ error: "종료 시간은 시작 시간보다 뒤로 설정해주세요." });
    }

    const requestedOwnerIds = normalizeOwnerIds(body.ownerIds);
    const ownerIds = requestedOwnerIds.length
      ? await resolveOwnerIds(req, requestedOwnerIds)
      : [await resolveOwnerId(req, body.ownerId)];
    const ownerId = ownerIds[0];
    const actorId = req.auth.uid;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const rows = await createSeriesEvents(conn, {
        ownerId,
        sharedOwnerIds: ownerIds,
        actorId,
        title,
        description,
        eventDate,
        startTime,
        endTime,
        incomeType,
        appointmentType,
        endDate,
        repeat,
        ...location,
      });
      const ownerNameMap = await buildOwnerNameMap(ownerIds);
      const created = rows.map((row) =>
        publicEvent({
          ...row,
          sharedOwnerNames: ownerIds.map((id) => ownerNameMap.get(id) || `#${id}`),
        })
      );
      await conn.commit();
      console.log(
        `[calendar] POST /events uid=${actorId} owners=[${ownerIds.join(",")}] ` +
          `inserted=${created.length} series=${created[0]?.seriesId || "?"} ` +
          `repeat=${repeat?.freq || "none"} title="${title}"`
      );
      res.status(201).json({ items: created, item: created[0] });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/calendar/events/:id
router.put("/events/:id", requireCalendarAdmin, async (req, res, next) => {
  try {
    const [existingRows] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));
    if (!(await canManageEvent(actorId, actorRole, existing))) {
      return res.status(403).json({ error: "이 일정을 수정할 권한이 없습니다." });
    }

    const body = req.body || {};
    const title = String(body.title ?? existing.title).trim();
    const description = String(body.description ?? existing.description ?? "").trim();
    const eventDate = toDateKey(body.eventDate ?? existing.series_start_date ?? existing.event_date);
    const startTime = body.startTime !== undefined ? (body.startTime ? String(body.startTime).trim() : null) : (existing.start_time ? String(existing.start_time).slice(0, 5) : null);
    const endTime = body.endTime !== undefined ? (body.endTime ? String(body.endTime).trim() : null) : (existing.end_time ? String(existing.end_time).slice(0, 5) : null);
    const incomeType = body.incomeType !== undefined
      ? (body.incomeType ? String(body.incomeType).toUpperCase() : null)
      : existing.income_type;
    const appointmentType = body.appointmentType !== undefined
      ? (body.appointmentType ? String(body.appointmentType).toUpperCase() : null)
      : existing.appointment_type;
    const repeat = body.repeat !== undefined
      ? normalizeRepeat(body.repeat)
      : (existing.series_repeat_freq
          ? normalizeRepeat({
              freq: existing.series_repeat_freq,
              interval: existing.series_repeat_interval,
              weekdays: existing.series_weekdays,
              until: existing.series_repeat_until,
            })
          : null);
    const endDate = body.endDate !== undefined
      ? (body.endDate ? toDateKey(body.endDate) : null)
      : (existing.series_end_date ? String(existing.series_end_date).slice(0, 10) : null);
    const location = parseLocationFields(body, existing);
    const requestedOwnerIds = normalizeOwnerIds(body.ownerIds);
    const ownerIds = requestedOwnerIds.length
      ? await resolveOwnerIds(req, requestedOwnerIds)
      : resolveEventOwnerIds(existing);
    const ownerId = ownerIds[0];

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }
    if (appointmentType && !APPOINTMENT_TYPES.includes(appointmentType)) {
      return res.status(400).json({ error: "appointmentType 이 올바르지 않습니다." });
    }
    if (!endDate && !repeat && startTime && endTime && toTimeMinute(endTime) <= toTimeMinute(startTime)) {
      return res.status(400).json({ error: "종료 시간은 시작 시간보다 뒤로 설정해주세요." });
    }

    // 시리즈 식별자는 그대로 유지(없으면 새로 부여)
    const seriesId = existing.series_id || makeSeriesId();

    // 새로 적용할 날짜 목록
    const newDates = expandOccurrences({ startDate: eventDate, endDate: repeat ? null : endDate, repeat });
    if (!newDates.length) {
      return res.status(400).json({ error: "유효한 날짜가 없습니다." });
    }
    const seriesStartDate = newDates[0];
    const seriesEndDate = newDates[newDates.length - 1];

    // 기존 시리즈 행들을 날짜순으로 가져온다. (가능한 한 그대로 UPDATE)
    const [seriesRows] = await pool.query(
      "SELECT id FROM calendar_events WHERE series_id = ? OR id = ? ORDER BY event_date ASC, id ASC",
      [existing.series_id || "__no_series__", existing.id]
    );

    const common = {
      ownerId,
      sharedOwnerIds: ownerIds,
      title,
      description,
      startTime,
      endTime,
      incomeType,
      appointmentType,
      seriesId,
      seriesStartDate,
      seriesEndDate,
      seriesSpanDays: newDates.length,
      seriesRepeatWeeks: 1,
      seriesWeekdays: repeat?.freq === "weekly" ? repeat.weekdays : [],
      repeat,
      ...location,
    };

    // ── 작업 계획 산정 ────────────────────────────────────────────────
    // 기존 시리즈 행 id (날짜순) 을 새 날짜 목록과 1:1 매칭한다.
    const reuseIds = seriesRows.slice(0, newDates.length).map((r) => r.id); // UPDATE 대상
    const insertCount = Math.max(0, newDates.length - seriesRows.length);   // 추가 INSERT 수
    const deleteIds = seriesRows.slice(newDates.length).map((r) => r.id);   // 삭제 대상

    // ── 무결성 검사 ──────────────────────────────────────────────────
    // UPDATE 와 DELETE 대상 id 가 겹치면 절대 안 됨 (데이터 유실 방지)
    const reuseSet = new Set(reuseIds);
    const overlap = deleteIds.filter((id) => reuseSet.has(id));
    if (overlap.length) {
      console.error(`[calendar] PUT integrity ABORT: update/delete id 충돌 ${overlap.join(",")}`);
      return res.status(500).json({ error: "내부 무결성 오류로 수정을 중단했습니다. (데이터는 보존됨)" });
    }
    // 정상 편집에서는 시리즈 전체가 삭제될 수 없다 (최소 1개는 유지/갱신)
    if (newDates.length === 0 || (seriesRows.length > 0 && reuseIds.length === 0)) {
      console.error(`[calendar] PUT integrity ABORT: 갱신 대상 0개 (전체 삭제 위험)`);
      return res.status(400).json({ error: "유효한 날짜가 없어 수정을 중단했습니다." });
    }

    const willDelete = deleteIds.length;
    const isShrink = newDates.length < seriesRows.length;

    console.log(
      `[calendar] PUT /events/${req.params.id} uid=${actorId} series=${seriesId} ` +
        `existingRows=${seriesRows.length} newDates=${newDates.length} ` +
        `plan{update:${reuseIds.length}, insert:${insertCount}, delete:${willDelete}} ` +
        `repeat:${repeat?.freq || "none"} title="${title}"`
    );

    // 삭제가 발생하는데 개수가 줄어든 것이 아니라면 경고 로그 (원인 추적용)
    if (willDelete > 0 && !isShrink) {
      console.warn(
        `[calendar] PUT WARN: ${willDelete}개 행이 삭제 예정이나 축소가 감지되지 않음. ` +
          `deleteIds=${deleteIds.join(",")}`
      );
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) 겹치는 만큼은 기존 행을 UPDATE (id 보존)
      for (let i = 0; i < newDates.length; i++) {
        if (i < seriesRows.length) {
          await updateEventRow(conn, seriesRows[i].id, {
            ...common,
            eventDate: newDates[i],
          });
        } else {
          // 2) 날짜가 더 늘어난 경우에만 추가 INSERT
          await insertEvent(conn, {
            ...common,
            actorId,
            eventDate: newDates[i],
          });
        }
      }

      // 3) 날짜가 줄어든 경우 남는 기존 행만 삭제
      if (deleteIds.length) {
        const placeholders = deleteIds.map(() => "?").join(", ");
        const [delResult] = await conn.query(
          `DELETE FROM calendar_events WHERE id IN (${placeholders})`,
          deleteIds
        );
        // 무결성 검사: 의도한 개수만큼만 삭제되었는지 확인
        if (Number(delResult.affectedRows) !== deleteIds.length) {
          throw new Error(
            `삭제 행 수 불일치 (예상 ${deleteIds.length}, 실제 ${delResult.affectedRows})`
          );
        }
      }

      await conn.commit();
      console.log(
        `[calendar] PUT OK series=${seriesId} updated=${reuseIds.length} inserted=${insertCount} deleted=${deleteIds.length}`
      );
    } catch (e) {
      await conn.rollback();
      console.error(`[calendar] PUT FAILED -> rollback (데이터 보존): ${e.code || e.message}`);
      throw e;
    } finally {
      conn.release();
    }

    const [finalRows] = await pool.query(
      `SELECT e.*, u.name AS owner_name, u.nickname AS owner_nickname,
              u.calendar_theme_color AS owner_theme_color
       FROM calendar_events e
       JOIN users u ON u.id = e.owner_id
       WHERE e.series_id = ?
       ORDER BY e.event_date ASC, e.id ASC
       LIMIT 1`,
      [seriesId]
    );
    const createdRow = finalRows[0];

    const ownerNameMap = await buildOwnerNameMap(ownerIds);
    res.json({
      item: publicEvent({
        ...createdRow,
        sharedOwnerNames: ownerIds.map((id) => ownerNameMap.get(id) || `#${id}`),
      }),
    });
  } catch (err) {
    console.error(`[calendar] PUT /events/${req.params.id} error: ${err.code || err.message}`);
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/calendar/events/:id
router.delete("/events/:id", requireCalendarAdmin, async (req, res, next) => {
  try {
    const [existingRows] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));
    if (!(await canManageEvent(actorId, actorRole, existing))) {
      return res.status(403).json({ error: "이 일정을 삭제할 권한이 없습니다." });
    }

    const seriesId = existing.series_id;
    let result;
    if (seriesId) {
      [result] = await pool.query("DELETE FROM calendar_events WHERE series_id = ?", [seriesId]);
    } else {
      [result] = await pool.query("DELETE FROM calendar_events WHERE id = ?", [req.params.id]);
    }
    console.log(
      `[calendar] DELETE /events/${req.params.id} uid=${actorId} ` +
        `series=${seriesId || "(none)"} deleted=${result?.affectedRows ?? "?"}`
    );
    res.status(204).end();
  } catch (err) {
    console.error(`[calendar] DELETE /events/${req.params.id} error: ${err.code || err.message}`);
    next(err);
  }
});

// GET /api/calendar/theme?ownerId=
router.get("/theme", requireCalendarAdmin, async (req, res, next) => {
  try {
    const ownerId = await resolveOwnerId(req, req.query.ownerId);
    const [rows] = await pool.query(
      "SELECT calendar_theme_color FROM users WHERE id = ?",
      [ownerId]
    );
    if (!rows[0]) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    res.json({
      ownerId,
      themeColor: rows[0].calendar_theme_color || null,
      presets: THEME_COLORS,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/calendar/theme { ownerId?, themeColor }
router.put("/theme", requireCalendarAdmin, async (req, res, next) => {
  try {
    const themeColor = String(req.body?.themeColor || "").trim().toLowerCase();
    if (!THEME_COLORS.includes(themeColor)) {
      return res.status(400).json({ error: "지원하지 않는 테마 색상입니다." });
    }

    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));
    let ownerId = actorId;

    if (req.body?.ownerId && Number(req.body.ownerId) !== actorId) {
      if (!isSuperAdminRole(actorRole)) {
        return res.status(403).json({ error: "다른 사용자의 테마는 변경할 수 없습니다." });
      }
      ownerId = await resolveOwnerId(req, req.body.ownerId);
    }

    await pool.query("UPDATE users SET calendar_theme_color = ? WHERE id = ?", [
      themeColor,
      ownerId,
    ]);

    res.json({ ownerId, themeColor, presets: THEME_COLORS });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
