import pool from "../db.js";

export async function getSetting(key, fallback = "") {
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ? LIMIT 1", [
      key,
    ]);
    return rows[0]?.value ?? fallback;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return fallback;
    throw err;
  }
}

export async function setSetting(key, value) {
  try {
    await pool.query(
      "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [key, value]
    );
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      throw new Error("settings 테이블이 없습니다. 백엔드를 재시작해 주세요.");
    }
    throw err;
  }
}
