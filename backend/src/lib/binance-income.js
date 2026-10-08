import pool from "../db.js";
import { getIncomeHistory } from "./binance-api.js";

/** 어떤 income 항목이 봇/수동 중 어디 귀속인지 판단: 봇 포지션의 보유 구간에 겹치면 BOT, 아니면 MANUAL */
async function attributeIncomeTime(symbol, incomeTimeMs) {
  const [rows] = await pool.query(
    `SELECT id FROM binance_bot_positions
     WHERE symbol = ?
       AND UNIX_TIMESTAMP(opened_at) * 1000 <= ?
       AND (closed_at IS NULL OR UNIX_TIMESTAMP(closed_at) * 1000 + 300000 >= ?)
     LIMIT 1`,
    [symbol, incomeTimeMs, incomeTimeMs]
  );
  return rows.length ? "BOT" : "MANUAL";
}

/** 최근 REALIZED_PNL income 이력을 가져와 원장에 dedupe 저장하고 봇/수동 귀속을 매긴다. */
export async function syncIncomeLedger() {
  const [lastRows] = await pool.query("SELECT MAX(income_time) AS last_time FROM binance_income_ledger");
  const startTime = lastRows[0]?.last_time
    ? Number(lastRows[0].last_time) + 1
    : Date.now() - 90 * 24 * 60 * 60 * 1000;

  let entries = [];
  try {
    entries = await getIncomeHistory({ startTime, incomeType: "REALIZED_PNL", limit: 1000 });
  } catch (err) {
    console.error("[binance-income] income 조회 실패:", err.message);
    return;
  }
  if (!Array.isArray(entries) || !entries.length) return;

  for (const e of entries) {
    const incomeTime = Number(e.time);
    const attribution = await attributeIncomeTime(e.symbol, incomeTime);
    await pool.query(
      `INSERT INTO binance_income_ledger (binance_tran_id, symbol, income_type, income, attribution, income_time, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE attribution = VALUES(attribution)`,
      [e.tranId, e.symbol, e.incomeType, e.income, attribution, incomeTime, JSON.stringify(e)]
    );
  }
  console.log(`[binance-income] ${entries.length}건 동기화 완료`);
}

export async function getPnlSummary() {
  const [rows] = await pool.query(
    `SELECT attribution, COALESCE(SUM(income), 0) AS total
     FROM binance_income_ledger GROUP BY attribution`
  );
  const realized = { BOT: 0, MANUAL: 0, UNKNOWN: 0 };
  for (const r of rows) realized[r.attribution] = Number(r.total);
  return realized;
}

/** 모의(paper) 거래 누적 손익 — 실제 자금과는 무관한 시뮬레이션 결과로, 페이퍼 검증 기간에만 참고용으로 노출한다. */
export async function getPaperPnlSummary() {
  const [rows] = await pool.query(
    "SELECT COALESCE(SUM(realized_pnl), 0) AS total FROM binance_bot_positions WHERE is_paper = 1 AND status = 'CLOSED'"
  );
  return Number(rows[0]?.total || 0);
}

const PERIOD_DAYS = { "1d": 1, "1w": 7, "1m": 30, "3m": 90, all: 365 };

/** 기간별 일간 실현손익 + 누적 곡선 */
export async function getPnlSeries(period = "1w") {
  const days = PERIOD_DAYS[period] || 7;
  const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const [rows] = await pool.query(
    `SELECT
       DATE(FROM_UNIXTIME(income_time / 1000)) AS d,
       COALESCE(SUM(income), 0) AS pnl
     FROM binance_income_ledger
     WHERE income_time >= ?
     GROUP BY d
     ORDER BY d`,
    [startMs]
  );

  const byDay = new Map();
  for (const r of rows) {
    const key = typeof r.d === "string" ? r.d.slice(0, 10) : new Date(r.d).toISOString().slice(0, 10);
    byDay.set(key, Number(r.pnl) || 0);
  }

  const points = [];
  let cumulative = 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const daily = byDay.get(key) || 0;
    cumulative += daily;
    points.push({ date: key, daily, cumulative: Number(cumulative.toFixed(4)) });
  }

  return {
    period,
    total: Number(cumulative.toFixed(4)),
    points,
  };
}
