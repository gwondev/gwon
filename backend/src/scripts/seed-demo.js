/**
 * 임시 데모 데이터 강제 재시드 (기존 콘텐츠 삭제 후 삽입)
 * 사용: node src/scripts/seed-demo.js
 */
import pool, { initDb } from "../db.js";
import {
  DEMO_ACTIVITIES,
  DEMO_CAREERS,
  DEMO_CERTIFICATIONS,
  DEMO_PROJECTS,
  DEMO_TECH_STACK,
} from "../lib/demo-seed.js";

const CONTENT_TABLES = ["projects", "activities", "certifications", "careers"];

async function insertRows(conn, table, rows) {
  for (let i = 0; i < rows.length; i++) {
    const data = { ...rows[i], sort_order: i };
    const keys = Object.keys(data);
    await conn.query(
      `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
      keys.map((k) => data[k])
    );
  }
}

async function main() {
  await initDb();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const table of CONTENT_TABLES) {
      await conn.query(`DELETE FROM \`${table}\``);
    }
    await insertRows(conn, "projects", DEMO_PROJECTS);
    await insertRows(conn, "activities", DEMO_ACTIVITIES);
    await insertRows(conn, "certifications", DEMO_CERTIFICATIONS);
    await insertRows(conn, "careers", DEMO_CAREERS);
    await conn.query(
      "INSERT INTO settings (`key`, value) VALUES ('tech_stack', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [JSON.stringify(DEMO_TECH_STACK)]
    );
    await conn.commit();
    console.log("[seed-demo] done — projects, activities, certifications, careers, tech_stack");
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed-demo] failed:", err.message);
  process.exit(1);
});
