import { Router } from "express";
import pool from "../db.js";
import {
  requireCalendarAdmin,
  requireSuperAdmin,
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

// GET /api/calendar/owners — SUPER_ADMIN: 일정 주체 선택 목록
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

// GET /api/calendar/events?ownerId=&year=&month=
router.get("/events", requireCalendarAdmin, async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: "year, month 가 필요합니다." });
    }

    const ownerId = await resolveOwnerId(req, req.query.ownerId);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const [rows] = await pool.query(
      `SELECT * FROM calendar_events
       WHERE owner_id = ? AND event_date BETWEEN ? AND ?
       ORDER BY event_date ASC,
         CASE WHEN start_time IS NULL THEN 0 ELSE 1 END,
         start_time ASC,
         id ASC`,
      [ownerId, startDate, endDate]
    );

    res.json({ items: rows.map(publicEvent), ownerId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

function expandWeeklyDates(eventDate, weeks) {
  const [y, m, d] = eventDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const count = Math.min(Math.max(Number(weeks) || 1, 1), 52);
  const dates = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i * 7);
    dates.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
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
  const [rows] = await conn.query("SELECT * FROM calendar_events WHERE id = ?", [result.insertId]);
  return rows[0];
}

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
    const repeatWeekly = Boolean(body.repeatWeekly);
    const repeatWeeks = repeatWeekly ? Math.min(Math.max(Number(body.repeatWeeks) || 1, 1), 52) : 1;

    if (!title) return res.status(400).json({ error: "일정명은 필수입니다." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return res.status(400).json({ error: "eventDate 형식이 올바르지 않습니다." });
    }
    if (incomeType && !INCOME_TYPES.includes(incomeType)) {
      return res.status(400).json({ error: "incomeType 이 올바르지 않습니다." });
    }

    const ownerId = await resolveOwnerId(req, body.ownerId);
    const actorId = req.auth.uid;
    const dates = repeatWeekly ? expandWeeklyDates(eventDate, repeatWeeks) : [eventDate];

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

// PUT /api/calendar/events/:id — SUPER_ADMIN만
router.put("/events/:id", requireSuperAdmin, async (req, res, next) => {
  try {
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
    const [result] = await pool.query(
      `UPDATE calendar_events SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    const [rows] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [req.params.id]);
    res.json({ item: publicEvent(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/calendar/events/:id — SUPER_ADMIN만
router.delete("/events/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM calendar_events WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
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
