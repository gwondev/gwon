import pool from "../db.js";
import { getIncomeHistory } from "./binance-api.js";

const INCOME_TYPES = ["REALIZED_PNL", "COMMISSION", "FUNDING_FEE"];
const CHUNK_MS = 6 * 24 * 60 * 60 * 1000;
const PERIOD_DAYS = { "1d": 1, "1w": 7, "1m": 30, "3m": 90, all: 180 };
let lastSync = { at: 0, lookbackMs: 0 };

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

async function fetchIncomeChunks(incomeType, fromMs, toMs) {
  const all = [];
  for (let start = fromMs; start < toMs; start += CHUNK_MS) {
    const end = Math.min(start + CHUNK_MS - 1, toMs);
    let cursor = start;
    for (let page = 0; page < 8; page++) {
      let batch;
      try {
        batch = await getIncomeHistory({
          startTime: cursor,
          endTime: end,
          incomeType,
          limit: 1000,
        });
      } catch (err) {
        console.warn(`[binance-income] ${incomeType} ${cursor}-${end}:`, err.message);
        break;
      }
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      if (batch.length < 1000) break;
      const lastTime = Number(batch[batch.length - 1].time) || 0;
      if (lastTime >= end) break;
      cursor = lastTime + 1;
    }
  }
  return all;
}

async function upsertEntries(entries) {
  let n = 0;
  for (const e of entries) {
    const incomeTime = Number(e.time);
    const attribution = await attributeIncomeTime(e.symbol, incomeTime);
    await pool.query(
      `INSERT INTO binance_income_ledger (binance_tran_id, symbol, income_type, income, attribution, income_time, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         income = VALUES(income),
         income_type = VALUES(income_type),
         attribution = VALUES(attribution)`,
      [
        e.tranId,
        e.symbol || "",
        e.incomeType,
        e.income,
        attribution,
        incomeTime,
        JSON.stringify(e),
      ]
    );
    n += 1;
  }
  return n;
}

/** 바이낸스는 income 조회 구간이 약 7일로 막혀 있어 구간을 나눠 가져온다. */
export async function syncIncomeLedger(lookbackMs = 90 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  if (now - lastSync.at < 8 * 60 * 1000 && lookbackMs <= lastSync.lookbackMs) return;
  const toMs = now;
  const fromMs = toMs - lookbackMs;
  let total = 0;
  for (const type of INCOME_TYPES) {
    const entries = await fetchIncomeChunks(type, fromMs, toMs);
    total += await upsertEntries(entries);
  }
  lastSync = { at: Date.now(), lookbackMs };
  if (total) console.log(`[binance-income] ${total}건 동기화`);
}

export async function getPnlSummary() {
  const [rows] = await pool.query(
    `SELECT attribution, COALESCE(SUM(income), 0) AS total
     FROM binance_income_ledger
     WHERE income_type = 'REALIZED_PNL'
     GROUP BY attribution`
  );
  const realized = { BOT: 0, MANUAL: 0, UNKNOWN: 0 };
  for (const r of rows) realized[r.attribution] = Number(r.total);
  return realized;
}

export async function getPaperPnlSummary() {
  const [rows] = await pool.query(
    "SELECT COALESCE(SUM(realized_pnl), 0) AS total FROM binance_bot_positions WHERE is_paper = 1 AND status = 'CLOSED'"
  );
  return Number(rows[0]?.total || 0);
}

function ymdKst(ms) {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getPnlSeries(period = "1w") {
  const days = PERIOD_DAYS[period] || 7;
  const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
  await syncIncomeLedger(Math.max(days, 30) * 24 * 60 * 60 * 1000);

  const [dailyRows] = await pool.query(
    `SELECT income_time, income_type, income
     FROM binance_income_ledger
     WHERE income_time >= ?`,
    [startMs]
  );

  const byDay = new Map();
  const breakdown = { REALIZED_PNL: 0, COMMISSION: 0, FUNDING_FEE: 0, OTHER: 0 };
  let trades = 0;
  for (const r of dailyRows) {
    const type = r.income_type || "OTHER";
    const amt = Number(r.income) || 0;
    if (breakdown[type] == null) breakdown.OTHER += amt;
    else breakdown[type] += amt;
    if (type === "REALIZED_PNL") trades += 1;
    const key = ymdKst(Number(r.income_time));
    byDay.set(key, (byDay.get(key) || 0) + amt);
  }

  const points = [];
  let cumulative = 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymdKst(d.getTime());
    const daily = byDay.get(key) || 0;
    cumulative += daily;
    points.push({ date: key, daily: Number(daily.toFixed(4)), cumulative: Number(cumulative.toFixed(4)) });
  }

  const [recent] = await pool.query(
    `SELECT symbol, income_type, income, income_time
     FROM binance_income_ledger
     WHERE income_time >= ?
     ORDER BY income_time DESC
     LIMIT 10`,
    [startMs]
  );

  const realized = Number(breakdown.REALIZED_PNL || 0);
  const commission = Number(breakdown.COMMISSION || 0);
  const funding = Number(breakdown.FUNDING_FEE || 0);
  const net = realized + commission + funding + Number(breakdown.OTHER || 0);

  return {
    period,
    total: Number(net.toFixed(4)),
    realized: Number(realized.toFixed(4)),
    commission: Number(commission.toFixed(4)),
    funding: Number(funding.toFixed(4)),
    trades,
    points,
    recent: recent.map((r) => ({
      symbol: r.symbol,
      type: r.income_type,
      income: Number(r.income),
      time: Number(r.income_time),
    })),
  };
}
