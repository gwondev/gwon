import pool from "../db.js";
import { getClientIp } from "./chat-quota.js";

export async function insertChatLog(req, question, answer) {
  let userId = null;
  let nickname = null;
  const ip = getClientIp(req);

  if (req.auth?.uid) {
    userId = req.auth.uid;
    const [rows] = await pool.query("SELECT nickname FROM users WHERE id = ? LIMIT 1", [
      userId,
    ]);
    nickname = rows[0]?.nickname || null;
  }

  await pool.query(
    "INSERT INTO chat_logs (user_id, nickname, ip, question, answer) VALUES (?, ?, ?, ?, ?)",
    [userId, nickname, ip, question, answer]
  );
}

export async function listRecentChatLogs(limit = 20) {
  const [rows] = await pool.query(
    `SELECT id, user_id, nickname, ip, question, answer, created_at
     FROM chat_logs
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    userLabel: row.user_id && row.nickname ? row.nickname : row.ip || "unknown",
    userType: row.user_id ? "user" : "guest",
    createdAt: row.created_at,
  }));
}
