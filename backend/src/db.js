import mysql from "mysql2/promise";

import { DEFAULT_CHAT_SYSTEM_PROMPT } from "./lib/chat-prompt-defaults.js";
import { DEFAULT_TECH_STACK } from "./lib/tech-stack-defaults.js";
import { DEFAULT_RULES_PROMPT } from "./lib/binance-defaults.js";

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
    appointment_type ENUM('MONEY','DRINK','JOB') DEFAULT NULL,
    theme_color VARCHAR(32) NOT NULL DEFAULT 'red',
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

  // 봇이 보유했던(보유 중인) 포지션 이력. status='OPEN' 인 행이 항상 최대 1개만 존재하도록
  // 애플리케이션 레벨에서 강제하며, "현재 봇 포지션"의 1차 신뢰 소스로 사용한다.
  `CREATE TABLE IF NOT EXISTS binance_bot_positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    side ENUM('LONG','SHORT') NOT NULL,
    status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
    entry_price DECIMAL(24, 10) NOT NULL,
    quantity DECIMAL(24, 10) NOT NULL,
    leverage INT NOT NULL,
    margin_type VARCHAR(16) NOT NULL,
    margin_usdt DECIMAL(18, 4) NOT NULL,
    tp_percent DECIMAL(6, 2) NULL,
    sl_percent DECIMAL(6, 2) NULL,
    entry_order_id VARCHAR(64) NULL,
    tp_order_id VARCHAR(64) NULL,
    sl_order_id VARCHAR(64) NULL,
    client_order_tag VARCHAR(40) NOT NULL,
    reason_text TEXT NULL,
    is_paper TINYINT(1) NOT NULL DEFAULT 1,
    realized_pnl DECIMAL(18, 4) NULL,
    close_reason VARCHAR(64) NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    INDEX idx_bot_pos_status (status),
    INDEX idx_bot_pos_symbol_time (symbol, opened_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 바이낸스 REALIZED_PNL income 이력 미러 + 사용자/봇 귀속 태그
  `CREATE TABLE IF NOT EXISTS binance_income_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    binance_tran_id BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    income_type VARCHAR(32) NOT NULL,
    income DECIMAL(24, 10) NOT NULL,
    attribution ENUM('BOT','MANUAL','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    income_time BIGINT NOT NULL,
    raw_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tran_type (binance_tran_id, income_type),
    INDEX idx_income_time (income_time),
    INDEX idx_attribution (attribution)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 하루 1회 갱신되는 뉴스 요약 캐시 (싱글턴 row)
  `CREATE TABLE IF NOT EXISTS binance_news_digest (
    id INT PRIMARY KEY DEFAULT 1,
    digest_date DATE NOT NULL,
    summary_text TEXT NOT NULL,
    source_count INT NOT NULL DEFAULT 0,
    raw_headlines JSON NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 통합 롱/숏 기회 점수 캐시 (싱글턴 row, TTL 기반 갱신)
  `CREATE TABLE IF NOT EXISTS binance_opportunity_cache (
    id INT PRIMARY KEY DEFAULT 1,
    computed_at TIMESTAMP NOT NULL,
    candidates_json JSON NOT NULL,
    model_used VARCHAR(64) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 일정 탭 체크리스트(개인 할 일). 완료 항목은 done_at 기준 30일 뒤 자동 정리된다.
  `CREATE TABLE IF NOT EXISTS todo_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    text VARCHAR(500) NOT NULL,
    due_date DATE DEFAULT NULL,
    done TINYINT(1) NOT NULL DEFAULT 0,
    done_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_todo_owner_done (owner_id, done),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // ── Google Drive 연동 ──────────────────────────────────────────────
  // 연결된 Drive 계정(싱글턴). refresh token 은 AES-256-GCM 으로 암호화 저장.
  `CREATE TABLE IF NOT EXISTS drive_credentials (
    id INT PRIMARY KEY DEFAULT 1,
    connected_by INT NULL,
    google_email VARCHAR(255) NULL,
    scopes TEXT NULL,
    refresh_token_enc TEXT NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Drive 파일/폴더 메타데이터 미러. 동기화는 행을 지우지 않고 status 로만 구분한다.
  `CREATE TABLE IF NOT EXISTS drive_resources (
    drive_id VARCHAR(128) PRIMARY KEY,
    parent_id VARCHAR(128) NULL,
    name VARCHAR(512) NULL,
    mime_type VARCHAR(255) NULL,
    is_folder TINYINT(1) NOT NULL DEFAULT 0,
    size BIGINT NULL,
    modified_time VARCHAR(40) NULL,
    owner_email VARCHAR(255) NULL,
    web_view_link VARCHAR(1024) NULL,
    icon_link VARCHAR(1024) NULL,
    has_thumbnail TINYINT(1) NOT NULL DEFAULT 0,
    trashed TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('ok','pending','trashed','missing','forbidden','error') NOT NULL DEFAULT 'pending',
    last_error TEXT NULL,
    last_checked_at TIMESTAMP NULL,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_drive_res_parent (parent_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 포트폴리오 콘텐츠 ↔ Drive 폴더/파일 매핑. Drive 파일이 사라져도 행은 지우지 않는다.
  `CREATE TABLE IF NOT EXISTS drive_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_kind VARCHAR(32) NOT NULL,
    content_id VARCHAR(191) NOT NULL DEFAULT '',
    folder_id VARCHAR(128) NULL,
    file_id VARCHAR(128) NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'folder',
    name VARCHAR(512) NULL,
    mime VARCHAR(255) NULL,
    modified_at VARCHAR(40) NULL,
    sync_status ENUM('ok','pending','syncing','error','missing','forbidden','conflict') NOT NULL DEFAULT 'pending',
    sync_error TEXT NULL,
    last_seen_at TIMESTAMP NULL,
    last_sync_at TIMESTAMP NULL,
    content_key VARCHAR(191) NULL,
    drive_id VARCHAR(128) NULL,
    note VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_drive_link_kind (content_kind, content_id, role),
    INDEX idx_drive_link_folder (folder_id),
    INDEX idx_drive_link_file (file_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS drive_sync_state (
    id INT PRIMARY KEY DEFAULT 1,
    page_token VARCHAR(255) NULL,
    start_page_token VARCHAR(255) NULL,
    status ENUM('idle','running','ok','error') NOT NULL DEFAULT 'idle',
    last_sync_at TIMESTAMP NULL,
    last_full_check_at TIMESTAMP NULL,
    last_error TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS drive_sync_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kind VARCHAR(32) NOT NULL,
    drive_id VARCHAR(128) NULL,
    name VARCHAR(512) NULL,
    detail TEXT NULL,
    INDEX idx_drive_log_at (at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

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

  // 봇 기본 매매 규칙 텍스트 초기화(범용, 특정 전략에 종속되지 않음)
  const [bRows] = await conn.query("SELECT id FROM binance_bot_settings WHERE id = 1");
  if (!bRows.length) {
    await conn.query(
      `INSERT INTO binance_bot_settings (id, prompt, is_active, paper_mode, leverage, order_size_percent, min_volume_threshold, min_funding_rate, max_ladder_levels, tp_percent, sl_percent, max_margin_usdt)
       VALUES (1, ?, 1, 1, 5, 3.00, 1000000000, 0.0000, 4, 3.00, 10.00, 20.0000)`,
      [DEFAULT_RULES_PROMPT]
    );
  }
}

// SUPER_ADMIN_EMAILS 에 명시된 이메일만 승격한다 (이름 기반 승격 금지, 강등하지 않음)
async function ensureOwnerSuperAdmin(conn) {
  const emails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return;
  const [result] = await conn.query(
    `UPDATE users SET role = 'SUPER_ADMIN'
     WHERE LOWER(TRIM(email)) IN (?) AND role <> 'SUPER_ADMIN'`,
    [emails]
  );
  if (result.affectedRows > 0) {
    console.log(`[db] promoted ${result.affectedRows} user(s) → SUPER_ADMIN (SUPER_ADMIN_EMAILS)`);
  }
}

async function runMigrations(conn) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN role ENUM('GUEST','ADMIN') NOT NULL DEFAULT 'GUEST'",
    "ALTER TABLE users MODIFY COLUMN role ENUM('GUEST','ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'GUEST'",
    "ALTER TABLE users ADD COLUMN calendar_theme_color VARCHAR(32) DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL",
    "DROP TABLE IF EXISTS projects",
    "DROP TABLE IF EXISTS activities",
    "DROP TABLE IF EXISTS certifications",
    "DROP TABLE IF EXISTS careers",
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
    // 바이낸스 봇: 구조화 전략 select를 걷어내고 자유 텍스트 규칙/점수기준 + 안전 하드캡으로 전환
    "ALTER TABLE binance_bot_settings ADD COLUMN scoring_prompt TEXT NULL AFTER prompt",
    "ALTER TABLE binance_bot_settings ADD COLUMN max_margin_usdt DECIMAL(18, 4) NOT NULL DEFAULT 20.0000 AFTER order_size_percent",
    "ALTER TABLE binance_bot_settings ADD COLUMN consecutive_error_count INT NOT NULL DEFAULT 0",
    "ALTER TABLE binance_bot_settings ADD COLUMN last_error_message TEXT NULL",
    "ALTER TABLE binance_bot_settings ADD COLUMN last_cycle_at TIMESTAMP NULL",
    "ALTER TABLE binance_bot_settings ADD COLUMN auto_paused TINYINT(1) NOT NULL DEFAULT 0",
    // 일정 색을 소유자 테마가 아니라 등록 시점에 고를 수 있게 (기본 빨강, 취업 관련이면 초록)
    "ALTER TABLE calendar_events MODIFY COLUMN appointment_type ENUM('MONEY','DRINK','JOB') DEFAULT NULL",
    "ALTER TABLE calendar_events ADD COLUMN theme_color VARCHAR(32) NOT NULL DEFAULT 'red' AFTER is_major",
    // 키워드 선택에 데이트/여행 추가
    "ALTER TABLE calendar_events MODIFY COLUMN appointment_type ENUM('MONEY','DRINK','JOB','DATE','TRIP') DEFAULT NULL",
    // 키워드를 사용자가 자유롭게 추가/삭제할 수 있도록 고정 ENUM에서 자유 문자열로 전환
    "ALTER TABLE calendar_events MODIFY COLUMN appointment_type VARCHAR(32) DEFAULT NULL",
    // 할 일 세부설명(선택) — 리스트에는 안 보이고 팝업으로만 확인
    "ALTER TABLE settings MODIFY COLUMN value LONGTEXT",
    "ALTER TABLE todo_items ADD COLUMN description TEXT DEFAULT NULL AFTER text",
    "ALTER TABLE binance_income_ledger DROP INDEX uniq_tran",
    "ALTER TABLE binance_income_ledger ADD UNIQUE KEY uniq_tran_type (binance_tran_id, income_type)",
    "ALTER TABLE calendar_events ADD COLUMN is_done TINYINT(1) NOT NULL DEFAULT 0 AFTER income_type",
    // Drive 미니 금고: 기존 drive_links / drive_sync_state 에 컬럼만 추가 (DROP 금지)
    "ALTER TABLE drive_links ADD COLUMN content_kind VARCHAR(32) NOT NULL DEFAULT 'root'",
    "ALTER TABLE drive_links ADD COLUMN content_id VARCHAR(191) NOT NULL DEFAULT ''",
    "ALTER TABLE drive_links ADD COLUMN folder_id VARCHAR(128) NULL",
    "ALTER TABLE drive_links ADD COLUMN file_id VARCHAR(128) NULL",
    "ALTER TABLE drive_links ADD COLUMN name VARCHAR(512) NULL",
    "ALTER TABLE drive_links ADD COLUMN mime VARCHAR(255) NULL",
    "ALTER TABLE drive_links ADD COLUMN modified_at VARCHAR(40) NULL",
    "ALTER TABLE drive_links ADD COLUMN sync_status ENUM('ok','pending','syncing','error','missing','forbidden','conflict') NOT NULL DEFAULT 'pending'",
    "ALTER TABLE drive_links ADD COLUMN sync_error TEXT NULL",
    "ALTER TABLE drive_links ADD COLUMN last_seen_at TIMESTAMP NULL",
    "ALTER TABLE drive_links ADD COLUMN last_sync_at TIMESTAMP NULL",
    "ALTER TABLE drive_links ADD UNIQUE KEY uniq_drive_link_kind (content_kind, content_id, role)",
    "ALTER TABLE drive_links ADD INDEX idx_drive_link_folder (folder_id)",
    "ALTER TABLE drive_links ADD INDEX idx_drive_link_file (file_id)",
    "ALTER TABLE drive_sync_state ADD COLUMN page_token VARCHAR(255) NULL",
    "ALTER TABLE drive_links MODIFY COLUMN drive_id VARCHAR(128) NULL",
    "ALTER TABLE drive_links MODIFY COLUMN content_key VARCHAR(191) NULL",
  ];
  for (const sql of migrations) {
    try {
      await conn.query(sql);
    } catch (err) {
      if (!["ER_DUP_FIELDNAME", "ER_CANT_DROP_FIELD_OR_KEY", "ER_DUP_KEYNAME", "ER_DUP_ENTRY"].includes(err.code)) {
        console.warn(`[db] migration skipped: ${err.code || err.message}`);
      }
    }
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
