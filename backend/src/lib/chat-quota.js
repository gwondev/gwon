import crypto from "crypto";
import pool from "../db.js";

export const CHAT_LIMIT_USER = 100;
export const CHAT_LIMIT_GUEST = 10;

function kstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getClientIp(req) {
  const raw =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";
  return raw;
}

function hashIp(ip) {
  return crypto
    .createHash("sha256")
    .update(`${ip}:${process.env.JWT_SECRET || "gwon"}`)
    .digest("hex")
    .slice(0, 32);
}

export function getChatSubject(req) {
  if (req.auth?.uid) {
    return {
      key: `user:${req.auth.uid}`,
      tier: "user",
      limit: CHAT_LIMIT_USER,
    };
  }
  return {
    key: `ip:${hashIp(getClientIp(req))}`,
    tier: "guest",
    limit: CHAT_LIMIT_GUEST,
  };
}

async function readUsage(subjectKey, usageDate) {
  try {
    const [rows] = await pool.query(
      "SELECT count FROM chat_daily_usage WHERE subject_key = ? AND usage_date = ?",
      [subjectKey, usageDate]
    );
    return rows[0]?.count ?? 0;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return 0;
    throw err;
  }
}

function quotaExceededError(subject, used) {
  const err = new Error(
    subject.tier === "user"
      ? `오늘 질문 가능 횟수(${subject.limit}회)를 모두 사용했습니다. 내일 다시 이용해 주세요.`
      : `오늘 질문 가능 횟수(${subject.limit}회)를 모두 사용했습니다. 로그인하면 하루 ${CHAT_LIMIT_USER}회까지 질문할 수 있습니다.`
  );
  err.status = 429;
  err.quota = { tier: subject.tier, limit: subject.limit, used, remaining: 0 };
  return err;
}

export async function getChatQuota(req) {
  const subject = getChatSubject(req);
  const usageDate = kstDateString();
  const used = await readUsage(subject.key, usageDate);
  const remaining = Math.max(0, subject.limit - used);
  return { tier: subject.tier, limit: subject.limit, used, remaining, resets: "KST 00:00" };
}

export async function assertChatQuotaAvailable(req) {
  const quota = await getChatQuota(req);
  if (quota.remaining <= 0) {
    throw quotaExceededError(getChatSubject(req), quota.used);
  }
  return quota;
}

export async function incrementChatQuota(req) {
  const subject = getChatSubject(req);
  const usageDate = kstDateString();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT count FROM chat_daily_usage WHERE subject_key = ? AND usage_date = ? FOR UPDATE",
      [subject.key, usageDate]
    );
    const used = rows[0]?.count ?? 0;
    if (used >= subject.limit) {
      await conn.rollback();
      throw quotaExceededError(subject, used);
    }

    if (rows.length === 0) {
      await conn.query(
        "INSERT INTO chat_daily_usage (subject_key, usage_date, count) VALUES (?, ?, 1)",
        [subject.key, usageDate]
      );
    } else {
      await conn.query(
        "UPDATE chat_daily_usage SET count = count + 1 WHERE subject_key = ? AND usage_date = ?",
        [subject.key, usageDate]
      );
    }
    await conn.commit();

    const nextUsed = used + 1;
    return {
      tier: subject.tier,
      limit: subject.limit,
      used: nextUsed,
      remaining: subject.limit - nextUsed,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
