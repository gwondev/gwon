import pool from "../db.js";

export async function listTable(table) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY id DESC`);
      return rows;
    }
    throw err;
  }
}
