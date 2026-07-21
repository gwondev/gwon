import { Router } from "express";
import pool from "../db.js";

const router = Router();

/** 홈/개요 미리보기용 — media(LONGTEXT) 제외한 경량 필드만 */
const PREVIEW_SELECT = {
  projects:
    "id, title, category, host, team_name, members, award, period, url, github_url, description, home_featured, sort_order, created_at, updated_at",
  activities:
    "id, title, organization, role, period, description, sort_order, created_at, updated_at",
  certifications:
    "id, title, issuer, acquired, score, description, sort_order, created_at, updated_at",
  careers:
    "id, title, category, position, period, description, sort_order, created_at, updated_at",
};

async function listPreview(table, columns) {
  try {
    const [rows] = await pool.query(
      `SELECT ${columns} FROM \`${table}\` ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      // sort_order / home_featured 없을 때 폴백
      const fallbackCols = columns
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c !== "sort_order" && c !== "home_featured")
        .join(", ");
      const [rows] = await pool.query(
        `SELECT ${fallbackCols} FROM \`${table}\` ORDER BY id DESC`
      );
      return rows;
    }
    throw err;
  }
}

// GET /api/portfolio/preview — 메인 화면용 일괄 경량 조회
router.get("/preview", async (_req, res, next) => {
  try {
    const [projects, activities, certifications, careers] = await Promise.all([
      listPreview("projects", PREVIEW_SELECT.projects),
      listPreview("activities", PREVIEW_SELECT.activities),
      listPreview("certifications", PREVIEW_SELECT.certifications),
      listPreview("careers", PREVIEW_SELECT.careers),
    ]);

    res.json({
      projects,
      activities,
      certifications,
      careers,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
