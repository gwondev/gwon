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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    role VARCHAR(255),
    period VARCHAR(128),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS certifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    issuer VARCHAR(255),
    acquired VARCHAR(128),
    score VARCHAR(128),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS careers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    period VARCHAR(128),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// 기존 테이블에 누락된 컬럼이 있으면 추가 (이미 있으면 무시)
async function runMigrations(conn) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN role ENUM('GUEST','ADMIN') NOT NULL DEFAULT 'GUEST'",
  ];
  for (const sql of migrations) {
    try {
      await conn.query(sql);
    } catch (err) {
      // 컬럼이 이미 존재하면(ER_DUP_FIELDNAME) 정상이므로 무시
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.warn(`[db] migration skipped: ${err.code || err.message}`);
      }
    }
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

export default pool;
