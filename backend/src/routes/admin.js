import { Router } from "express";
import pool from "../db.js";
import { requireAdmin } from "../auth-middleware.js";

import { getSetting, setSetting } from "../lib/settings.js";

const router = Router();
const ROLES = ["GUEST", "ADMIN"];

const TABLE_LABELS = {
  users: "회원",
  projects: "프로젝트 & 공모전",
  activities: "활동",
  certifications: "자격증",
  careers: "경력",
};

// GET /api/admin/stats  -> 전체 DB 테이블 요약
router.get("/stats", requireAdmin, async (req, res) => {
  const tables = Object.keys(TABLE_LABELS);
  const counts = {};

  for (const table of tables) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    counts[table] = Number(rows[0].count);
  }

  const [roleRows] = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users GROUP BY role"
  );
  const roles = { GUEST: 0, ADMIN: 0 };
  for (const row of roleRows) roles[row.role] = Number(row.count);

  res.json({
    database: "gwon",
    tables: tables.map((key) => ({
      key,
      label: TABLE_LABELS[key],
      count: counts[key],
    })),
    roles,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  });
});

// GET /api/admin/users?q=검색어  -> 회원 목록 / 이름·닉네임·이메일 검색
router.get("/users", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    [rows] = await pool.query(
      `SELECT id, email, name, nickname, role, created_at
       FROM users
       WHERE name LIKE ? OR nickname LIKE ? OR email LIKE ?
       ORDER BY id DESC`,
      [like, like, like]
    );
  } else {
    [rows] = await pool.query(
      `SELECT id, email, name, nickname, role, created_at FROM users ORDER BY id DESC`
    );
  }
  res.json({ items: rows });
});

// PUT /api/admin/users/:id/role  { role }  -> 권한 변경
router.put("/users/:id/role", requireAdmin, async (req, res) => {
  const role = (req.body?.role || "").toUpperCase();
  const targetId = Number(req.params.id);

  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "role 은 GUEST 또는 ADMIN 이어야 합니다." });
  }
  // 본인 권한은 변경 불가 (실수로 자기 관리자 권한을 잃는 것 방지)
  if (targetId === req.auth.uid) {
    return res.status(400).json({ error: "본인의 권한은 변경할 수 없습니다." });
  }

  const [result] = await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, targetId]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
  }
  const [rows] = await pool.query(
    "SELECT id, email, name, nickname, role, created_at FROM users WHERE id = ?",
    [targetId]
  );
  res.json({ item: rows[0] });
});

// GET /api/admin/chat-prompt — AI 추가 지침
router.get("/chat-prompt", requireAdmin, async (_req, res) => {
  const extraPrompt = await getSetting("chat_extra_prompt", "");
  res.json({ extraPrompt });
});

// PUT /api/admin/chat-prompt — AI 추가 지침 저장
router.put("/chat-prompt", requireAdmin, async (req, res) => {
  const extraPrompt = String(req.body?.extraPrompt ?? "");
  await setSetting("chat_extra_prompt", extraPrompt);
  res.json({ extraPrompt });
});

export default router;
