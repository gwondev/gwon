import { Router } from "express";
import pool from "../db.js";
import {
  requireCalendarAdmin,
  isSuperAdminRole,
  getUserRole,
} from "../auth-middleware.js";

const router = Router();

const INCOME_TYPES = ["ALBA", "WORK", "SCHOLARSHIP"];
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

function publicEvent(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
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
     (owner_id, created_by, title, description, event_date, start_time, end_time, income_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.ownerId,
      data.actorId,
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

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const placeholders = ownerIds.map(() => "?").join(", ");
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
      [...ownerIds, startDate, endDate]
    );

    res.json({ items: rows.map(publicEvent), ownerIds });
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
    const spanDays = Math.min(Math.max(Number(body.spanDays) || 1, 1), 31);
    const repeatWeeks = Math.min(Math.max(Number(body.repeatWeeks) || 1, 1), 52);

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }

    const ownerId = await resolveOwnerId(req, body.ownerId);
    const actorId = req.auth.uid;
    const dates = expandEventDates(eventDate, spanDays, repeatWeeks);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const created = [];
      for (const date of dates) {
        const row = await insertEvent(conn, {
          ownerId,
          actorId,
          title,
          description,
          eventDate: date,
          startTime,
          endTime,
          incomeType,
        });
        created.push(publicEvent(row));
      }
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
    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const description = body.description !== undefined ? String(body.description).trim() : undefined;
    const eventDate = body.eventDate !== undefined ? String(body.eventDate).trim() : undefined;
    const startTime = body.startTime !== undefined ? (body.startTime ? String(body.startTime).trim() : null) : undefined;
    const endTime = body.endTime !== undefined ? (body.endTime ? String(body.endTime).trim() : null) : undefined;
    const incomeType = body.incomeType !== undefined
      ? (body.incomeType ? String(body.incomeType).toUpperCase() : null)
      : undefined;

    if (title === "") return res.status(400).json({ error: "일정명은 필수입니다." });
    if (eventDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }

    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description || null); }
    if (eventDate !== undefined) { updates.push("event_date = ?"); values.push(eventDate); }
    if (startTime !== undefined) { updates.push("start_time = ?"); values.push(startTime); }
    if (endTime !== undefined) { updates.push("end_time = ?"); values.push(endTime); }
    if (incomeType !== undefined) { updates.push("income_type = ?"); values.push(incomeType); }

    if (updates.length === 0) {
      return res.status(400).json({ error: "수정할 내용이 없습니다." });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE calendar_events SET ${updates.join(", ")} WHERE id = ?`, values);

    const [rows] = await pool.query(
      `SELECT e.*, u.name AS owner_name, u.nickname AS owner_nickname,
              u.calendar_theme_color AS owner_theme_color
       FROM calendar_events e
       JOIN users u ON u.id = e.owner_id
       WHERE e.id = ?`,
      [req.params.id]
    );
    res.json({ item: publicEvent(rows[0]) });
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

    await pool.query("DELETE FROM calendar_events WHERE id = ?", [req.params.id]);
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
