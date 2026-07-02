import { Router } from "express";
import pool from "../db.js";
import { requireAdmin } from "../auth-middleware.js";

// 테이블별 허용 컬럼 (화이트리스트) -> SQL 인젝션/오타 방지
const RESOURCES = {
  projects: ["title", "category", "host", "team_name", "members", "award", "period", "url", "github_url", "description", "media", "home_featured"],
  activities: ["title", "organization", "role", "period", "description", "media"],
  certifications: ["title", "issuer", "acquired", "score", "description", "media"],
  careers: ["title", "category", "position", "period", "description", "media"],
};

const listOrderCache = new Map();

async function listOrderClause(table) {
  if (listOrderCache.has(table)) return listOrderCache.get(table);
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'sort_order'`);
  const clause = cols.length ? "ORDER BY sort_order ASC, id ASC" : "ORDER BY id DESC";
  listOrderCache.set(table, clause);
  return clause;
}

async function listAll(table) {
  const order = await listOrderClause(table);
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` ${order}`);
  return rows;
}

// 하나의 리소스에 대한 CRUD 라우터 생성
export function crudRouter(table) {
  const columns = RESOURCES[table];
  if (!columns) throw new Error(`unknown resource: ${table}`);
  const router = Router();

  const pick = (body) => {
    const data = {};
    for (const col of columns) {
      if (body[col] === undefined || body[col] === null) continue;
      if (col === "home_featured") {
        data[col] = body[col] === true || body[col] === 1 || body[col] === "1" ? 1 : 0;
        continue;
      }
      if (String(body[col]).trim() !== "") {
        data[col] = String(body[col]);
      }
    }
    return data;
  };

  const capHomeFeatured = async (data, excludeId = null) => {
    if (table !== "projects" || Number(data.home_featured) !== 1) return;
    try {
      const params = excludeId != null ? [excludeId] : [];
      const exclude = excludeId != null ? " AND id <> ?" : "";
      const [rows] = await pool.query(
        `SELECT id FROM projects WHERE home_featured = 1${exclude} ORDER BY sort_order ASC, id ASC`,
        params
      );
      if (rows.length < 2) return;
      const drop = rows.slice(0, rows.length - 1);
      for (const row of drop) {
        await pool.query("UPDATE projects SET home_featured = 0 WHERE id = ?", [row.id]);
      }
    } catch (err) {
      if (err.code !== "ER_BAD_FIELD_ERROR") throw err;
    }
  };

  const fetchOne = async (id) => {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    return rows[0] || null;
  };

  // GET 목록 (공개)
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ items: await listAll(table) });
    } catch (err) {
      next(err);
    }
  });

  // PUT 순서 변경 (관리자 전용) — 반드시 /:id 보다 먼저 등록
  router.put("/reorder", requireAdmin, async (req, res, next) => {
    try {
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
      listOrderCache.delete(table);
      res.json({ items: await listAll(table) });
    } catch (err) {
      next(err);
    }
  });

  // POST 생성 (관리자 전용)
  router.post("/", requireAdmin, async (req, res, next) => {
    try {
      const data = pick(req.body || {});
      if (!data.title) return res.status(400).json({ error: "제목(title)은 필수입니다." });
      await capHomeFeatured(data);
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
    } catch (err) {
      next(err);
    }
  });

  // PUT 수정 (관리자 전용)
  router.put("/:id", requireAdmin, async (req, res, next) => {
    try {
      const data = pick(req.body || {});
      const keys = Object.keys(data);
      if (keys.length === 0) return res.status(400).json({ error: "수정할 내용이 없습니다." });
      await capHomeFeatured(data, req.params.id);
      await pool.query(
        `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\` = ?`).join(", ")} WHERE id = ?`,
        [...keys.map((k) => data[k]), req.params.id]
      );
      const item = await fetchOne(req.params.id);
      if (!item) return res.status(404).json({ error: "대상을 찾을 수 없습니다." });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  // DELETE (관리자 전용)
  router.delete("/:id", requireAdmin, async (req, res, next) => {
    try {
      await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [req.params.id]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
