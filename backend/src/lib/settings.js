import pool from "../db.js";

export async function getSetting(key, fallback = "") {
  const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ? LIMIT 1", [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key, value) {
  await pool.query(
    "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [key, value]
  );
}
