import mysql from "mysql2/promise";

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
    role ENUM('GUEST','ADMIN') NOT NULL DEFAULT 'GUEST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    host VARCHAR(255),
    team_name VARCHAR(255),
    members TEXT,
    award VARCHAR(255),
    period VARCHAR(128),
    description TEXT,
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

async function runMigrations(conn) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN role ENUM('GUEST','ADMIN') NOT NULL DEFAULT 'GUEST'",
    "ALTER TABLE careers ADD COLUMN category VARCHAR(64) AFTER title",
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
