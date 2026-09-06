import mysql from "mysql2/promise";

import { DEFAULT_CHAT_SYSTEM_PROMPT } from "./lib/chat-prompt-defaults.js";
import { DEFAULT_TECH_STACK } from "./lib/tech-stack-defaults.js";
import { seedDemoContent } from "./lib/demo-seed.js";

const DB_HOST = process.env.DB_HOST || "gwon-db";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "gwon";

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  // DATE 컬럼을 'YYYY-MM-DD' 문자열로 그대로 받는다.
  // (Date 객체로 받으면 서버 타임존에 따라 toISOString() 시 하루가 밀려
  //  캘린더 날짜 매칭이 어긋나는 문제가 생긴다.)
  dateStrings: ["DATE"],
});

/** 풀은 DB_NAME 에 붙으므로, 스키마가 없으면 서버에만 붙어서 만든다. */
async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    charset: "utf8mb4",
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

// ── 최근 DB 쿼리 로그(메모리 링버퍼) ─────────────────────────────────
// 전체 쿼리(SELECT 포함)와 쓰기 작업(INSERT/UPDATE/DELETE)을 분리 보관한다.
// 분리하는 이유: 관리자 페이지를 열 때 자체 SELECT가 다량 발생하여 다른 페이지에서
// 일어난 INSERT/DELETE 가 단일 버퍼의 최근 N개 밖으로 밀려나 안 보이던 문제 해결.
const DB_LOG_MAX = 200;
const DB_WRITE_LOG_MAX = 80;
const dbLogBuffer = [];
const dbWriteBuffer = [];

function summarizeSql(sql) {
  return String(sql || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function parseSqlVerb(sql) {
  const m = String(sql || "").trimStart().match(/^([a-zA-Z]+)/);
  return m ? m[1].toUpperCase() : "OTHER";
}

const WRITE_VERBS = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE"]);

function parseSqlTable(sql, verb) {
  const text = String(sql || "");
  let m = null;
  if (verb === "INSERT" || verb === "REPLACE") {
    m = text.match(/\binto\s+`?([a-zA-Z0-9_]+)`?/i);
  } else if (verb === "UPDATE") {
    m = text.match(/\bupdate\s+`?([a-zA-Z0-9_]+)`?/i);
  } else if (verb === "DELETE") {
    m = text.match(/\bfrom\s+`?([a-zA-Z0-9_]+)`?/i);
  }
  return m ? m[1] : null;
}

function recordDbLog(entry) {
  dbLogBuffer.push(entry);
  if (dbLogBuffer.length > DB_LOG_MAX) dbLogBuffer.shift();

  if (entry.isWrite) {
    dbWriteBuffer.push(entry);
    if (dbWriteBuffer.length > DB_WRITE_LOG_MAX) dbWriteBuffer.shift();
  }

  const tag = entry.ok ? `[db:${entry.verb}]` : `[db:${entry.verb}:ERR]`;
  const rows = entry.rows != null ? ` rows=${entry.rows}` : "";
  const msg = `${tag} ${entry.ms}ms${rows} ${entry.sql}${entry.error ? ` :: ${entry.error}` : ""}`;
  if (!entry.ok) console.error(msg);
  else if (entry.isWrite) console.log(msg); // 쓰기 작업은 항상 눈에 띄게 출력
  else console.log(msg);
}

export function getRecentDbLogs(limit = 20) {
  return dbLogBuffer.slice(-limit).reverse();
}

export function getRecentDbWrites(limit = 30) {
  return dbWriteBuffer.slice(-limit).reverse();
}

function affectedRowsOf(result) {
  // mysql2: [rowsOrHeader, fields]
  const head = Array.isArray(result) ? result[0] : null;
  if (head && typeof head === "object" && "affectedRows" in head) {
    return Number(head.affectedRows);
  }
  return null;
}

function wrapQuery(rawFn, target) {
  return async function loggedQuery(sql, params) {
    const started = Date.now();
    const sqlText = typeof sql === "string" ? sql : sql?.sql || "";
    const verb = parseSqlVerb(sqlText);
    const isWrite = WRITE_VERBS.has(verb);
    try {
      const result = await rawFn.call(target, sql, params);
      recordDbLog({
        ok: true,
        verb,
        isWrite,
        table: isWrite ? parseSqlTable(sqlText, verb) : null,
        rows: isWrite ? affectedRowsOf(result) : null,
        sql: summarizeSql(sqlText),
        ms: Date.now() - started,
        at: new Date().toISOString(),
      });
      return result;
    } catch (err) {
      recordDbLog({
        ok: false,
        verb,
        isWrite,
        table: isWrite ? parseSqlTable(sqlText, verb) : null,
        rows: null,
        sql: summarizeSql(sqlText),
        ms: Date.now() - started,
        at: new Date().toISOString(),
        error: err.code || err.message,
      });
      throw err;
    }
  };
}

// pool.query / pool.execute 래핑
const rawPoolQuery = pool.query;
pool.query = wrapQuery(rawPoolQuery, pool);

// 트랜잭션용 커넥션도 로깅되도록 getConnection 래핑
const rawGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function loggedGetConnection() {
  const conn = await rawGetConnection();
  if (!conn.__queryLogPatched) {
    const rawConnQuery = conn.query;
    conn.query = wrapQuery(rawConnQuery, conn);
    conn.__queryLogPatched = true;
  }
  return conn;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_sub VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255),
    name VARCHAR(255),
    picture VARCHAR(512),
    nickname VARCHAR(64),
    role ENUM('GUEST','ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'GUEST',
    calendar_theme_color VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS calendar_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    created_by INT NOT NULL,
    shared_owner_ids TEXT DEFAULT NULL,
    series_id VARCHAR(64) DEFAULT NULL,
    series_start_date DATE DEFAULT NULL,
    series_end_date DATE DEFAULT NULL,
    series_span_days INT DEFAULT NULL,
    series_repeat_weeks INT DEFAULT NULL,
    series_weekdays VARCHAR(32) DEFAULT NULL,
    series_repeat_freq VARCHAR(16) DEFAULT NULL,
    series_repeat_interval INT DEFAULT NULL,
    series_repeat_until DATE DEFAULT NULL,
    appointment_type ENUM('MONEY','DRINK') DEFAULT NULL,
    location_name VARCHAR(255) DEFAULT NULL,
    location_lat DECIMAL(10, 7) DEFAULT NULL,
    location_lng DECIMAL(10, 7) DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    income_type ENUM('ALBA','WORK','SCHOLARSHIP') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_calendar_owner_date (owner_id, event_date),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    host VARCHAR(255),
    team_name VARCHAR(255),
    members TEXT,
    award VARCHAR(255),
    period VARCHAR(128),
    url VARCHAR(512),
    github_url VARCHAR(512),
    description TEXT,
    media LONGTEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    role VARCHAR(255),
    period VARCHAR(128),
    description TEXT,
    media LONGTEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS certifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    issuer VARCHAR(255),
    acquired VARCHAR(128),
    score VARCHAR(128),
    description TEXT,
    media LONGTEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS careers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    position VARCHAR(255),
    period VARCHAR(128),
    description TEXT,
    media LONGTEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(64) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS chat_daily_usage (
    subject_key VARCHAR(128) NOT NULL,
    usage_date DATE NOT NULL,
    count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (subject_key, usage_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS chat_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    nickname VARCHAR(64) NULL,
    ip VARCHAR(64) NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_logs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS binance_bot_settings (
    id INT PRIMARY KEY DEFAULT 1,
    prompt TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    paper_mode TINYINT(1) NOT NULL DEFAULT 1,
    leverage INT NOT NULL DEFAULT 5,
    order_size_percent DECIMAL(5, 2) NOT NULL DEFAULT 3.00,
    min_volume_threshold BIGINT NOT NULL DEFAULT 1000000000,
    min_funding_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    max_ladder_levels INT NOT NULL DEFAULT 4,
    tp_percent DECIMAL(5, 2) NOT NULL DEFAULT 3.00,
    sl_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS binance_bot_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    action VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_b_logs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const CONTENT_TABLES = ["projects", "activities", "certifications", "careers"];

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function backfillSortOrder(conn, table) {
  const [rows] = await conn.query(`SELECT id FROM \`${table}\` ORDER BY id DESC`);
  for (let i = 0; i < rows.length; i++) {
    await conn.query(`UPDATE \`${table}\` SET sort_order = ? WHERE id = ?`, [i, rows[i].id]);
  }
}

async function ensureSortOrder(conn, table) {
  if (await hasColumn(conn, table, "sort_order")) return;
  console.log(`[db] add sort_order → ${table}`);
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN sort_order INT NOT NULL DEFAULT 0`);
  await backfillSortOrder(conn, table);
}

async function seedDefaultSettings(conn) {
  const defaults = {
    chat_system_prompt: DEFAULT_CHAT_SYSTEM_PROMPT,
    tech_stack: JSON.stringify(DEFAULT_TECH_STACK),
  };
  for (const [key, value] of Object.entries(defaults)) {
    const [rows] = await conn.query("SELECT value FROM settings WHERE `key` = ? LIMIT 1", [
      key,
    ]);
    if (!rows.length) {
      await conn.query("INSERT INTO settings (`key`, value) VALUES (?, ?)", [key, value]);
    } else if (key === "chat_system_prompt" && !String(rows[0].value || "").trim()) {
      await conn.query("UPDATE settings SET value = ? WHERE `key` = ?", [value, key]);
    } else if (key === "tech_stack" && !String(rows[0].value || "").trim()) {
      await conn.query("UPDATE settings SET value = ? WHERE `key` = ?", [value, key]);
    }
  }

  // 봇 기본 프롬프트 & 전략 설정 초기화
  const defaultPrompt = `[1B 이상 급등 코인 거미줄 숏 매매 규칙]
1. 모니터링 대상: 24시간 거래대금 1,000,000,000 USDT (1B) 이상이며 24시간 변동률이 +8% 이상 급등한 대형/준대형 코인
2. 펀딩비 필터:
   - 양수 펀딩비 (+0.01% 이상): 롱이 숏에게 펀딩비를 지급하므로 거미줄 숏 유지 시 펀딩비 수익 발생 (우선 진입 타겟)
   - 극단적 음수 펀딩비 (-0.05% 이하): 숏 포지션이 펀딩비를 지불해야 하고 숏 스퀴즈 위험이 크므로 신규 진입 배제
3. 거미줄(DCA) 진입 규칙:
   - 1차 진입 (25%): 24시간 고점 인근 또는 저항선 터치 시
   - 2차 진입 (25%): 1차 진입가 대비 +2.0%
   - 3차 진입 (25%): 1차 진입가 대비 +4.5%
   - 4차 진입 (25%): 1차 진입가 대비 +7.5%
4. 수익 실현 (TP):
   - 평단가 대비 -3.0% 도달 시 50% 부분 익절 및 본절 스탑로스 설정
   - 평단가 대비 -6.0% 도달 시 잔여 물량 전량 익절
5. 리스크 관리 (SL):
   - 4차 거미줄까지 체결된 후 추가로 +4.0% 이상 대량 거래량 동반 돌파 시 손절 실행`;

  const [bRows] = await conn.query("SELECT id FROM binance_bot_settings WHERE id = 1");
  if (!bRows.length) {
    await conn.query(
      `INSERT INTO binance_bot_settings (id, prompt, is_active, paper_mode, leverage, order_size_percent, min_volume_threshold, min_funding_rate, max_ladder_levels, tp_percent, sl_percent)
       VALUES (1, ?, 1, 1, 5, 3.00, 1000000000, 0.0000, 4, 3.00, 10.00)`,
      [defaultPrompt]
    );
  }
}

async function ensureOwnerSuperAdmin(conn) {
  const [result] = await conn.query(
    "UPDATE users SET role = 'SUPER_ADMIN' WHERE TRIM(name) = '이성권' OR name LIKE '%이성권%'"
  );
  if (result.affectedRows > 0) {
    console.log(`[db] promoted ${result.affectedRows} user(s) → SUPER_ADMIN (이성권)`);
  }
}

async function runMigrations(conn) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN role ENUM('GUEST','ADMIN') NOT NULL DEFAULT 'GUEST'",
    "ALTER TABLE users MODIFY COLUMN role ENUM('GUEST','ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'GUEST'",
    "ALTER TABLE users ADD COLUMN calendar_theme_color VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE careers ADD COLUMN category VARCHAR(64) AFTER title",
    // 다중 분류 저장을 위한 컬럼 확장
    "ALTER TABLE projects MODIFY COLUMN category VARCHAR(255)",
    // 사진+글 묶음(JSON) 저장 컬럼
    "ALTER TABLE projects ADD COLUMN media LONGTEXT AFTER description",
    "ALTER TABLE activities ADD COLUMN media LONGTEXT AFTER description",
    "ALTER TABLE certifications ADD COLUMN media LONGTEXT AFTER description",
    "ALTER TABLE certifications ADD COLUMN logo LONGTEXT AFTER description",
    "ALTER TABLE careers ADD COLUMN media LONGTEXT AFTER description",
    "ALTER TABLE projects ADD COLUMN url VARCHAR(512) AFTER period",
    "ALTER TABLE projects ADD COLUMN github_url VARCHAR(512) AFTER url",
    "ALTER TABLE projects ADD COLUMN home_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order",
    "ALTER TABLE projects ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order",
    "ALTER TABLE activities ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order",
    "ALTER TABLE certifications ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order",
    "ALTER TABLE careers ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order",
    "ALTER TABLE users ADD COLUMN calendar_filter_owner_ids TEXT DEFAULT NULL",
    "ALTER TABLE calendar_events ADD COLUMN shared_owner_ids TEXT DEFAULT NULL AFTER created_by",
    "ALTER TABLE calendar_events ADD COLUMN series_id VARCHAR(64) DEFAULT NULL AFTER shared_owner_ids",
    "ALTER TABLE calendar_events ADD COLUMN series_start_date DATE DEFAULT NULL AFTER series_id",
    "ALTER TABLE calendar_events ADD COLUMN series_end_date DATE DEFAULT NULL AFTER series_start_date",
    "ALTER TABLE calendar_events ADD COLUMN series_span_days INT DEFAULT NULL AFTER series_end_date",
    "ALTER TABLE calendar_events ADD COLUMN series_repeat_weeks INT DEFAULT NULL AFTER series_span_days",
    "ALTER TABLE calendar_events ADD COLUMN series_weekdays VARCHAR(32) DEFAULT NULL AFTER series_repeat_weeks",
    "ALTER TABLE calendar_events ADD COLUMN series_repeat_freq VARCHAR(16) DEFAULT NULL AFTER series_weekdays",
    "ALTER TABLE calendar_events ADD COLUMN series_repeat_interval INT DEFAULT NULL AFTER series_repeat_freq",
    "ALTER TABLE calendar_events ADD COLUMN series_repeat_until DATE DEFAULT NULL AFTER series_repeat_interval",
    "ALTER TABLE calendar_events ADD COLUMN appointment_type ENUM('MONEY','DRINK') DEFAULT NULL AFTER series_repeat_weeks",
    "ALTER TABLE calendar_events ADD COLUMN location_name VARCHAR(255) DEFAULT NULL AFTER appointment_type",
    "ALTER TABLE calendar_events ADD COLUMN location_lat DECIMAL(10, 7) DEFAULT NULL AFTER location_name",
    "ALTER TABLE calendar_events ADD COLUMN location_lng DECIMAL(10, 7) DEFAULT NULL AFTER location_lat",
    "ALTER TABLE calendar_events ADD COLUMN is_major TINYINT(1) NOT NULL DEFAULT 0 AFTER appointment_type",
  ];
  for (const sql of migrations) {
    try {
      await conn.query(sql);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.warn(`[db] migration skipped: ${err.code || err.message}`);
      }
    }
  }
  for (const table of CONTENT_TABLES) {
    await ensureSortOrder(conn, table);
  }
}

// DB 컨테이너가 늦게 뜨는 경우를 대비해 재시도하며 초기화
export async function initDb(retries = 15, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await ensureDatabase();
      const conn = await pool.getConnection();
      try {
        for (const sql of SCHEMA) await conn.query(sql);
        await runMigrations(conn);
        await seedDefaultSettings(conn);
        await seedDemoContent(conn);
        await ensureOwnerSuperAdmin(conn);
      } finally {
        conn.release();
      }
      console.log("[db] schema ready");
      return;
    } catch (err) {
      console.warn(`[db] init attempt ${attempt}/${retries} failed: ${err.code || err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function pingDb() {
  await pool.query("SELECT 1");
}

export default pool;
