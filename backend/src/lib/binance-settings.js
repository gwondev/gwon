import pool from "../db.js";

const MAX_CONSECUTIVE_ERRORS = 3;

export async function loadBotSettings() {
  const [rows] = await pool.query("SELECT * FROM binance_bot_settings WHERE id = 1");
  return rows[0] || null;
}

export async function updateBotSettings(fields) {
  const allowed = ["prompt", "scoring_prompt", "is_active", "paper_mode", "max_margin_usdt"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  await pool.query(`UPDATE binance_bot_settings SET ${setClause} WHERE id = 1`, keys.map((k) => fields[k]));
}

export async function logBot(symbol, action, message, details = null) {
  await pool.query(
    "INSERT INTO binance_bot_logs (symbol, action, message, details) VALUES (?, ?, ?, ?)",
    [symbol, action, message, details ? JSON.stringify(details) : null]
  );
}

export async function resetErrorCount() {
  await pool.query(
    "UPDATE binance_bot_settings SET consecutive_error_count = 0, last_error_message = NULL, last_cycle_at = NOW() WHERE id = 1"
  );
}

/** 연속 에러 카운트를 올리고, 임계치를 넘으면 안전을 위해 봇을 자동 정지시킨다. */
export async function bumpErrorCountAndMaybePause(err) {
  const message = err?.message || String(err);
  const [rows] = await pool.query(
    "UPDATE binance_bot_settings SET consecutive_error_count = consecutive_error_count + 1, last_error_message = ?, last_cycle_at = NOW() WHERE id = 1",
    [message]
  );
  const settings = await loadBotSettings();
  if (settings && settings.consecutive_error_count >= MAX_CONSECUTIVE_ERRORS && !settings.auto_paused) {
    await pool.query("UPDATE binance_bot_settings SET is_active = 0, auto_paused = 1 WHERE id = 1");
    await logBot(
      "SYSTEM",
      "AUTO_PAUSE",
      `연속 ${settings.consecutive_error_count}회 오류로 봇이 안전 자동정지되었습니다: ${message}`
    );
  } else {
    await logBot("SYSTEM", "CYCLE_ERROR", message);
  }
  return rows;
}

export async function getOpenBotPosition() {
  const [rows] = await pool.query(
    "SELECT * FROM binance_bot_positions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1"
  );
  return rows[0] || null;
}
