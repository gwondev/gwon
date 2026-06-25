import { Router } from "express";
import pool from "../db.js";
import {
  requireCalendarAdmin,
  isSuperAdminRole,
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
    ownerName: row.owner_name || row.owner_nickname || null,
    ownerThemeColor: row.owner_theme_color || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function canManageOwner(actorId, actorRole, ownerId) {
  if (actorId === ownerId) return true;
  if (!isSuperAdminRole(actorRole)) return false;
  const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ?", [ownerId]);
  const owner = rows[0];
  if (!owner) return false;
  return owner.role === "ADMIN" || owner.id === actorId;
}

async function canManageEvent(actorId, actorRole, eventRow) {
  if (eventRow.owner_id === actorId || eventRow.created_by === actorId) return true;
  if (resolveEventOwnerIds(eventRow).includes(actorId)) return true;
  if (!isSuperAdminRole(actorRole)) return false;
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

async function getVisibleOwnerIds(actorId, actorRole) {
  if (!isSuperAdminRole(actorRole)) return [actorId];
  const [rows] = await pool.query(
    `SELECT id, role FROM users
     WHERE role IN ('ADMIN', 'SUPER_ADMIN')
     ORDER BY id ASC`
  );
  return rows
    .filter((u) => u.role !== "SUPER_ADMIN" || u.id === actorId)
    .map((u) => u.id);
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

function expandEventDates(eventDate, spanDays, repeatWeeks) {
  const span = Math.min(Math.max(Number(spanDays) || 1, 1), 31);
  const weeks = Math.min(Math.max(Number(repeatWeeks) || 1, 1), 52);
  const [y, m, d] = eventDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const dates = new Set();
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < span; day++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + day);
      dates.add(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
      );
    }
  }
  return [...dates].sort();
}

async function insertEvent(conn, data) {
  const [result] = await conn.query(
    `INSERT INTO calendar_events
     (owner_id, created_by, shared_owner_ids, series_id, series_start_date, series_end_date, series_span_days, series_repeat_weeks,
      appointment_type, title, description, event_date, start_time, end_time, income_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.ownerId,
      data.actorId,
      JSON.stringify(data.sharedOwnerIds || [data.ownerId]),
      data.seriesId || null,
      data.seriesStartDate || null,
      data.seriesEndDate || null,
      data.seriesSpanDays || 1,
      data.seriesRepeatWeeks || 1,
      data.appointmentType || null,
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

async function createSeriesEvents(conn, data) {
  const dates = expandEventDates(data.eventDate, data.spanDays, data.repeatWeeks);
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
      seriesSpanDays: data.spanDays,
      seriesRepeatWeeks: data.repeatWeeks,
    });
    created.push(row);
  }
  return created;
}

// GET /api/calendar/owners
router.get("/owners", requireCalendarAdmin, async (req, res, next) => {
  try {
    const actorId = req.auth.uid;
    const actorRole = req.userRole || (await getUserRole(actorId));

    if (isSuperAdminRole(actorRole)) {
      const [rows] = await pool.query(
        `SELECT id, name, nickname, email, role, calendar_theme_color AS calendarThemeColor
         FROM users
         WHERE role IN ('ADMIN', 'SUPER_ADMIN')
         ORDER BY FIELD(role, 'SUPER_ADMIN', 'ADMIN'), id ASC`
      );
      const items = rows
        .filter((u) => u.role !== "SUPER_ADMIN" || u.id === actorId)
        .map((u) => ({
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
      ownerIds = await resolveOwnerIds(req, ownerIds);
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
    const ownerIds = await resolveOwnerIds(req, req.body?.ownerIds);
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
    const ownerIds = await resolveOwnerIds(req, requested);
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
    const eventDate = String(body.eventDate || "").trim();
    const description = String(body.description || "").trim();
    const startTime = body.startTime ? String(body.startTime).trim() : null;
    const endTime = body.endTime ? String(body.endTime).trim() : null;
    const incomeType = body.incomeType ? String(body.incomeType).toUpperCase() : null;
    const appointmentType = body.appointmentType ? String(body.appointmentType).toUpperCase() : null;
    const spanDays = Math.min(Math.max(Number(body.spanDays) || 1, 1), 31);
    const repeatWeeks = Math.min(Math.max(Number(body.repeatWeeks) || 1, 1), 52);

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }
    if (appointmentType && !APPOINTMENT_TYPES.includes(appointmentType)) {
      return res.status(400).json({ error: "appointmentType 이 올바르지 않습니다." });
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
        spanDays,
        repeatWeeks,
      });
      const ownerNameMap = await buildOwnerNameMap(ownerIds);
      const created = rows.map((row) =>
        publicEvent({
          ...row,
          sharedOwnerNames: ownerIds.map((id) => ownerNameMap.get(id) || `#${id}`),
        })
      );
      await conn.commit();
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
    const eventDate = String(body.eventDate ?? existing.series_start_date ?? existing.event_date).trim();
    const startTime = body.startTime !== undefined ? (body.startTime ? String(body.startTime).trim() : null) : (existing.start_time ? String(existing.start_time).slice(0, 5) : null);
    const endTime = body.endTime !== undefined ? (body.endTime ? String(body.endTime).trim() : null) : (existing.end_time ? String(existing.end_time).slice(0, 5) : null);
    const incomeType = body.incomeType !== undefined
      ? (body.incomeType ? String(body.incomeType).toUpperCase() : null)
      : existing.income_type;
    const appointmentType = body.appointmentType !== undefined
      ? (body.appointmentType ? String(body.appointmentType).toUpperCase() : null)
      : existing.appointment_type;
    const spanDays = Math.min(Math.max(Number(body.spanDays ?? existing.series_span_days ?? 1) || 1, 1), 31);
    const repeatWeeks = Math.min(Math.max(Number(body.repeatWeeks ?? existing.series_repeat_weeks ?? 1) || 1, 1), 52);
    const requestedOwnerIds = normalizeOwnerIds(body.ownerIds);
    const ownerIds = requestedOwnerIds.length
      ? await resolveOwnerIds(req, requestedOwnerIds)
      : resolveEventOwnerIds(existing);
    const ownerId = ownerIds[0];

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }
    if (appointmentType && !APPOINTMENT_TYPES.includes(appointmentType)) {
      return res.status(400).json({ error: "appointmentType 이 올바르지 않습니다." });
    }

    const seriesId = existing.series_id || makeSeriesId();
    const conn = await pool.getConnection();
    let createdRow;
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM calendar_events WHERE series_id = ? OR id = ?", [seriesId, existing.id]);
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
        spanDays,
        repeatWeeks,
        seriesId,
      });
      createdRow = rows[0];
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const ownerNameMap = await buildOwnerNameMap(ownerIds);
    res.json({
      item: publicEvent({
        ...createdRow,
        sharedOwnerNames: ownerIds.map((id) => ownerNameMap.get(id) || `#${id}`),
      }),
    });
  } catch (err) {
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
    if (seriesId) {
      await pool.query("DELETE FROM calendar_events WHERE series_id = ?", [seriesId]);
    } else {
      await pool.query("DELETE FROM calendar_events WHERE id = ?", [req.params.id]);
    }
    res.status(204).end();
  } catch (err) {
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
