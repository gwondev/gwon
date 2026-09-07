import { Router } from "express";
import pool from "../db.js";
import { requireCalendarAdmin } from "../auth-middleware.js";

const router = Router();

const RETENTION_DAYS = 30;
const TEXT_MAX_LEN = 500;

function publicTodo(row) {
  return {
    id: row.id,
    text: row.text,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    done: Boolean(row.done),
    doneAt: row.done_at || null,
    createdAt: row.created_at,
  };
}

// 완료된 지 RETENTION_DAYS 지난 항목은 조용히 정리
async function purgeExpired(ownerId) {
  await pool.query(
    `DELETE FROM todo_items WHERE owner_id = ? AND done = 1 AND done_at < (NOW() - INTERVAL ? DAY)`,
    [ownerId, RETENTION_DAYS]
  );
}

// GET /api/todos
router.get("/", requireCalendarAdmin, async (req, res, next) => {
  try {
    const ownerId = req.auth.uid;
    await purgeExpired(ownerId);
    const [rows] = await pool.query(
      `SELECT * FROM todo_items WHERE owner_id = ? ORDER BY done ASC, created_at ASC`,
      [ownerId]
    );
    res.json({ items: rows.map(publicTodo) });
  } catch (err) {
    next(err);
  }
});

// POST /api/todos { text, dueDate }
router.post("/", requireCalendarAdmin, async (req, res, next) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "할 일을 입력해주세요." });
    if (text.length > TEXT_MAX_LEN) {
      return res.status(400).json({ error: `할 일은 ${TEXT_MAX_LEN}자 이내로 입력해주세요.` });
    }

    const dueDateRaw = req.body?.dueDate;
    const dueDate =
      dueDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(String(dueDateRaw)) ? String(dueDateRaw) : null;

    const ownerId = req.auth.uid;
    const [result] = await pool.query(
      `INSERT INTO todo_items (owner_id, text, due_date) VALUES (?, ?, ?)`,
      [ownerId, text, dueDate]
    );
    const [rows] = await pool.query(`SELECT * FROM todo_items WHERE id = ?`, [result.insertId]);
    res.status(201).json({ item: publicTodo(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/todos/:id/toggle { done? }
router.put("/:id/toggle", requireCalendarAdmin, async (req, res, next) => {
  try {
    const ownerId = req.auth.uid;
    const [rows] = await pool.query(`SELECT * FROM todo_items WHERE id = ? AND owner_id = ?`, [
      req.params.id,
      ownerId,
    ]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: "항목을 찾을 수 없습니다." });

    const done = req.body?.done !== undefined ? Boolean(req.body.done) : !existing.done;
    await pool.query(`UPDATE todo_items SET done = ?, done_at = ? WHERE id = ?`, [
      done ? 1 : 0,
      done ? new Date() : null,
      existing.id,
    ]);
    const [updatedRows] = await pool.query(`SELECT * FROM todo_items WHERE id = ?`, [existing.id]);
    res.json({ item: publicTodo(updatedRows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/todos/:id
router.delete("/:id", requireCalendarAdmin, async (req, res, next) => {
  try {
    const ownerId = req.auth.uid;
    const [result] = await pool.query(`DELETE FROM todo_items WHERE id = ? AND owner_id = ?`, [
      req.params.id,
      ownerId,
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: "항목을 찾을 수 없습니다." });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
