import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import pool from "../db.js";
import { signToken, requireAuth } from "../auth-middleware.js";

const router = Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// .env.production -> SUPER_ADMIN_EMAILS / ADMIN_EMAILS (쉼표 구분) 로그인 시 승격
// 이름은 누구나 바꿀 수 있으므로 승격 근거로 쓰지 않는다 (검증된 이메일만).
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.avatar || row.picture,
    nickname: row.nickname,
    role: row.role || "GUEST",
    calendarThemeColor: row.calendar_theme_color || null,
  };
}

async function findUserById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

// POST /api/auth/google  { credential }  -> Google ID 토큰 검증 후 세션 발급
router.post("/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "credential 이 없습니다." });
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: "서버에 GOOGLE_CLIENT_ID 가 설정되지 않았습니다." });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();

    await pool.query(
      `INSERT INTO users (google_sub, email, name, picture)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), picture = VALUES(picture)`,
      [p.sub, p.email, p.name, p.picture]
    );

    // SUPER_ADMIN_EMAILS → SUPER_ADMIN, ADMIN_EMAILS → ADMIN (email_verified 필수, 강등하지 않음)
    const email = p.email_verified === true ? p.email?.trim().toLowerCase() : null;
    if (email && SUPER_ADMIN_EMAILS.includes(email)) {
      await pool.query("UPDATE users SET role = 'SUPER_ADMIN' WHERE google_sub = ?", [p.sub]);
    } else if (email && ADMIN_EMAILS.includes(email)) {
      await pool.query(
        "UPDATE users SET role = 'ADMIN' WHERE google_sub = ? AND role != 'SUPER_ADMIN'",
        [p.sub]
      );
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE google_sub = ?", [p.sub]);
    const user = rows[0];
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("[auth/google]", err.message);
    res.status(401).json({ error: "구글 인증에 실패했습니다." });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.auth.uid);
  if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  res.json({ user: publicUser(user) });
});

// PUT /api/auth/nickname  { nickname }
router.put("/nickname", requireAuth, async (req, res) => {
  const nickname = (req.body?.nickname || "").trim();
  if (!nickname) return res.status(400).json({ error: "닉네임을 입력해주세요." });
  if (nickname.length > 20) return res.status(400).json({ error: "닉네임은 20자 이하여야 합니다." });

  await pool.query("UPDATE users SET nickname = ? WHERE id = ?", [nickname, req.auth.uid]);
  const user = await findUserById(req.auth.uid);
  res.json({ user: publicUser(user) });
});

// PUT /api/auth/avatar  { avatar: dataURL | null }
router.put("/avatar", requireAuth, async (req, res) => {
  const avatar = req.body?.avatar;
  if (avatar != null && avatar !== "") {
    if (typeof avatar !== "string" || !avatar.startsWith("data:image/")) {
      return res.status(400).json({ error: "이미지 파일이 아닙니다." });
    }
    if (avatar.length > 480000) return res.status(400).json({ error: "사진이 너무 큽니다. 더 작은 이미지로 올려주세요." });
  }
  await pool.query("UPDATE users SET avatar = ? WHERE id = ?", [avatar || null, req.auth.uid]);
  const user = await findUserById(req.auth.uid);
  res.json({ user: publicUser(user) });
});

export default router;
