import mysql from "mysql2/promise";

import { DEFAULT_CHAT_SYSTEM_PROMPT } from "./lib/chat-prompt-defaults.js";
import { DEFAULT_TECH_STACK } from "./lib/tech-stack-defaults.js";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gwon",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

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
    "ALTER TABLE careers ADD COLUMN media LONGTEXT AFTER description",
    "ALTER TABLE projects ADD COLUMN url VARCHAR(512) AFTER period",
    "ALTER TABLE projects ADD COLUMN github_url VARCHAR(512) AFTER url",
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
      const conn = await pool.getConnection();
      try {
        for (const sql of SCHEMA) await conn.query(sql);
        await runMigrations(conn);
        await seedDefaultSettings(conn);
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
