import { Router } from "express";
import pool from "../db.js";
import { requireAdmin } from "../auth-middleware.js";

const router = Router();
const ROLES = ["GUEST", "ADMIN"];

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

export default router;
