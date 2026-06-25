import jwt from "jsonwebtoken";
import pool from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ uid: user.id, sub: user.google_sub }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

export async function getUserRole(uid) {
  const [rows] = await pool.query("SELECT role FROM users WHERE id = ?", [uid]);
  return rows[0]?.role || null;
}

export function isSuperAdminRole(role) {
  return role === "SUPER_ADMIN";
}

export function isCalendarAdminRole(role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// Bearer 토큰이 있으면 req.auth 설정 (없거나 무효면 게스트)
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.auth = jwt.verify(token, JWT_SECRET);
    } catch {
      // 무효 토큰 → 비로그인(IP 제한)으로 처리
    }
  }
  next();
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

async function attachRole(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return null;
  }
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
    return null;
  }
  const role = await getUserRole(req.auth.uid);
  if (!role) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return null;
  }
  req.userRole = role;
  return role;
}

// SUPER_ADMIN 전용 (메뉴 CRUD, 관리자 페이지)
export async function requireSuperAdmin(req, res, next) {
  try {
    const role = await attachRole(req, res);
    if (!role) return;
    if (!isSuperAdminRole(role)) {
      return res.status(403).json({ error: "슈퍼 관리자 권한이 필요합니다." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// ADMIN 또는 SUPER_ADMIN (일정 추가·조회)
export async function requireCalendarAdmin(req, res, next) {
  try {
    const role = await attachRole(req, res);
    if (!role) return;
    if (!isCalendarAdminRole(role)) {
      return res.status(403).json({ error: "일정 관리 권한이 필요합니다." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// 하위 호환: 메뉴 CRUD는 SUPER_ADMIN만
export const requireAdmin = requireSuperAdmin;
