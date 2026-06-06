import { Router } from "express";
import pool from "../db.js";
import { requireAdmin } from "../auth-middleware.js";

// 테이블별 허용 컬럼 (화이트리스트) -> SQL 인젝션/오타 방지
const RESOURCES = {
  projects: ["title", "category", "host", "team_name", "members", "award", "period", "description"],
  activities: ["title", "organization", "role", "period", "description"],
  certifications: ["title", "issuer", "acquired", "score", "description"],
  careers: ["title", "category", "position", "period", "description"],
};

// 하나의 리소스에 대한 CRUD 라우터 생성
export function crudRouter(table) {
  const columns = RESOURCES[table];
  if (!columns) throw new Error(`unknown resource: ${table}`);
  const router = Router();

  const pick = (body) => {
    const data = {};
    for (const col of columns) {
      if (body[col] !== undefined && body[col] !== null && String(body[col]).trim() !== "") {
        data[col] = String(body[col]);
      }
    }
    return data;
  };

  const fetchOne = async (id) => {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    return rows[0] || null;
  };

  // GET 목록 (공개) — sort_order 오름차순
  router.get("/", async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` ORDER BY sort_order ASC, id ASC`
    );
    res.json({ items: rows });
  });

  // PUT 순서 변경 (관리자 전용) — 반드시 /:id 보다 먼저 등록
  router.put("/reorder", requireAdmin, async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids 배열이 필요합니다." });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < ids.length; i++) {
        await conn.query(`UPDATE \`${table}\` SET sort_order = ? WHERE id = ?`, [i, ids[i]]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` ORDER BY sort_order ASC, id ASC`
    );
    res.json({ items: rows });
  });

  // POST 생성 (관리자 전용)
  router.post("/", requireAdmin, async (req, res) => {
    const data = pick(req.body || {});
    if (!data.title) return res.status(400).json({ error: "제목(title)은 필수입니다." });
    const [[{ nextOrder }]] = await pool.query(
      `SELECT COALESCE(MIN(sort_order), 0) - 1 AS nextOrder FROM \`${table}\``
    );
    data.sort_order = nextOrder;
    const keys = Object.keys(data);
    const placeholders = keys.map(() => "?").join(", ");
    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(", ")}) VALUES (${placeholders})`,
      keys.map((k) => data[k])
    );
    res.status(201).json({ item: await fetchOne(result.insertId) });
  });

  // PUT 수정 (관리자 전용)
  router.put("/:id", requireAdmin, async (req, res) => {
    const data = pick(req.body || {});
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: "수정할 내용이 없습니다." });
    await pool.query(
      `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\` = ?`).join(", ")} WHERE id = ?`,
      [...keys.map((k) => data[k]), req.params.id]
    );
    const item = await fetchOne(req.params.id);
    if (!item) return res.status(404).json({ error: "대상을 찾을 수 없습니다." });
    res.json({ item });
  });

  // DELETE (관리자 전용)
  router.delete("/:id", requireAdmin, async (req, res) => {
    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [req.params.id]);
    res.status(204).end();
  });

  return router;
}
