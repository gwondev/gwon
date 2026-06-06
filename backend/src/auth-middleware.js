import jwt from "jsonwebtoken";
import pool from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ uid: user.id, sub: user.google_sub }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

// Bearer 토큰 검증 미들웨어
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}

// 로그인 + ADMIN 권한까지 확인 (권한은 항상 DB 최신값으로 확인)
export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
  try {
    const [rows] = await pool.query("SELECT role FROM users WHERE id = ?", [req.auth.uid]);
    if (!rows[0]) return res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    if (rows[0].role !== "ADMIN") {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    next();
  } catch (err) {
    next(err);
  }
}
