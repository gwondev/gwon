import { Router } from "express";
import pool from "../db.js";
import { getSetting } from "../lib/settings.js";

const router = Router();

/** 홈/개요 미리보기 — media 원문은 빼고 대표 사진·영상만 붙여 보낸다 */
const PREVIEW_SELECT = {
  projects:
    "id, title, category, host, team_name, members, award, period, url, github_url, description, media, home_featured, sort_order, created_at, updated_at",
  activities:
    "id, title, organization, role, period, description, media, sort_order, created_at, updated_at",
  certifications:
    "id, title, issuer, acquired, score, description, media, sort_order, created_at, updated_at",
  careers:
    "id, title, category, position, period, description, media, sort_order, created_at, updated_at",
};

function mediaCovers(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  const image = list.find((m) => m?.image)?.image || "";
  const video = list.find((m) => m?.video)?.video || "";
  return { coverImage: image, coverVideo: video };
}

function withCovers(rows) {
  return (rows || []).map((row) => {
    const { media, ...rest } = row;
    return { ...rest, ...mediaCovers(media) };
  });
}

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
        .filter((c) => c !== "sort_order" && c !== "home_featured" && c !== "media")
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
      projects: withCovers(projects),
      activities: withCovers(activities),
      certifications: withCovers(certifications),
      careers: withCovers(careers),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/home-layout", async (_req, res, next) => {
  try {
    const raw = await getSetting("home_layout", "");
    let layout = null;
    if (raw) {
      try {
        layout = JSON.parse(raw);
      } catch {
        layout = null;
      }
    }
    res.json({ layout });
  } catch (err) {
    next(err);
  }
});

export default router;
