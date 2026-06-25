import { Router } from "express";
import pool, { getRecentDbLogs } from "../db.js";
import { requireSuperAdmin } from "../auth-middleware.js";

import { getSetting, setSetting } from "../lib/settings.js";
import { getTechStack, saveTechStack } from "../lib/tech-stack.js";
import { listRecentChatLogs } from "../lib/chat-logs.js";

const router = Router();
const ROLES = ["GUEST", "ADMIN", "SUPER_ADMIN"];

const TABLE_LABELS = {
  users: "회원",
  projects: "프로젝트 & 공모전",
  activities: "활동",
  certifications: "자격증",
  careers: "경력",
};

// GET /api/admin/stats  -> 전체 DB 테이블 요약
router.get("/stats", requireSuperAdmin, async (req, res) => {
  const tables = Object.keys(TABLE_LABELS);
  const counts = {};

  for (const table of tables) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    counts[table] = Number(rows[0].count);
  }

  const [roleRows] = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users GROUP BY role"
  );
  const roles = { GUEST: 0, ADMIN: 0, SUPER_ADMIN: 0 };
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

// GET /api/admin/db-logs -> 최근 DB 쿼리 로그 (메모리)
router.get("/db-logs", requireSuperAdmin, async (_req, res) => {
  res.json({ items: getRecentDbLogs(20) });
});

// GET /api/admin/users?q=검색어  -> 회원 목록 / 이름·닉네임·이메일 검색
router.get("/users", requireSuperAdmin, async (req, res) => {
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
router.put("/users/:id/role", requireSuperAdmin, async (req, res) => {
  const role = (req.body?.role || "").toUpperCase();
  const targetId = Number(req.params.id);

  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "role 은 GUEST, ADMIN, SUPER_ADMIN 이어야 합니다." });
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

// GET /api/admin/chat-prompt — AI 프롬프트 (DB)
router.get("/chat-prompt", requireSuperAdmin, async (_req, res) => {
  const [systemPrompt, extraPrompt] = await Promise.all([
    getSetting("chat_system_prompt", ""),
    getSetting("chat_extra_prompt", ""),
  ]);
  res.json({ systemPrompt, extraPrompt });
});

// GET /api/admin/chat-logs — 최근 AI 질문·답변 로그
router.get("/chat-logs", requireSuperAdmin, async (_req, res) => {
  try {
    const items = await listRecentChatLogs(20);
    res.json({ items });
  } catch (err) {
    console.error("[admin/chat-logs]", err.message);
    res.status(500).json({ error: err.message || "로그 조회 실패" });
  }
});

// PUT /api/admin/chat-prompt — AI 프롬프트 저장
router.put("/chat-prompt", requireSuperAdmin, async (req, res) => {
  const { systemPrompt, extraPrompt } = req.body || {};
  if (systemPrompt !== undefined) {
    await setSetting("chat_system_prompt", String(systemPrompt));
  }
  if (extraPrompt !== undefined) {
    await setSetting("chat_extra_prompt", String(extraPrompt));
  }
  const [savedSystem, savedExtra] = await Promise.all([
    getSetting("chat_system_prompt", ""),
    getSetting("chat_extra_prompt", ""),
  ]);
  res.json({ systemPrompt: savedSystem, extraPrompt: savedExtra });
});

// GET /api/admin/tech-stack
router.get("/tech-stack", requireSuperAdmin, async (_req, res) => {
  const groups = await getTechStack();
  res.json({ groups });
});

// PUT /api/admin/tech-stack
router.put("/tech-stack", requireSuperAdmin, async (req, res) => {
  const groups = await saveTechStack(req.body?.groups);
  res.json({ groups });
});

export default router;
