import pool from "../db.js";
import { getIncomeHistory, getTotalAssetUsdt } from "./binance-api.js";

const INCOME_TYPES = ["REALIZED_PNL", "COMMISSION", "FUNDING_FEE"];
const DAY = 24 * 60 * 60 * 1000;
const CHUNK_MS = 6 * DAY;
const PERIOD_DAYS = { "1d": 1, "1w": 7, "1m": 30, "3m": 90 };
const ALL_LOOKBACK_MS = 730 * DAY;
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

async function syncRange(fromMs, toMs) {
  let total = 0;
  for (const type of INCOME_TYPES) {
    const entries = await fetchIncomeChunks(type, fromMs, toMs);
    total += await upsertEntries(entries);
  }
  return total;
}

/** 바이낸스는 income 조회 구간이 약 7일로 막혀 있어 구간을 나눠 가져온다. */
export async function syncIncomeLedger(lookbackMs = 90 * DAY) {
  const now = Date.now();
  const needFresh = now - lastSync.at > 8 * 60 * 1000;
  const needOlder = lookbackMs > lastSync.lookbackMs;
  if (!needFresh && !needOlder) return;

  let total = 0;
  if (needFresh) {
    total += await syncRange(now - Math.min(lookbackMs, 8 * DAY), now);
  }
  if (needOlder) {
    const oldTo = now - Math.max(lastSync.lookbackMs, 8 * DAY);
    const oldFrom = now - lookbackMs;
    if (oldFrom < oldTo) total += await syncRange(oldFrom, oldTo);
  }
  lastSync = { at: now, lookbackMs: Math.max(lookbackMs, lastSync.lookbackMs) };
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
  const isAll = period === "all";
  const lookback = isAll ? ALL_LOOKBACK_MS : Math.max(PERIOD_DAYS[period] || 7, 30) * DAY;
  await syncIncomeLedger(lookback);

  const endMs = Date.now();
  let startMs = endMs - (PERIOD_DAYS[period] || 7) * DAY;
  if (isAll) {
    const [bounds] = await pool.query(
      "SELECT MIN(income_time) AS min_t FROM binance_income_ledger"
    );
    const minT = Number(bounds[0]?.min_t);
    startMs = Number.isFinite(minT) && minT > 0 ? minT : endMs - ALL_LOOKBACK_MS;
  }

  const [dailyRows] = await pool.query(
    `SELECT income_time, income_type, income
     FROM binance_income_ledger
     WHERE income_time >= ? AND income_time <= ?`,
    [startMs, endMs]
  );

  const byDay = new Map();
  const breakdown = { REALIZED_PNL: 0, COMMISSION: 0, FUNDING_FEE: 0, OTHER: 0 };
  let trades = 0;
  const timed = [];
  for (const r of dailyRows) {
    const type = r.income_type || "OTHER";
    const amt = Number(r.income) || 0;
    const t = Number(r.income_time);
    timed.push({ t, amt });
    if (breakdown[type] == null) breakdown.OTHER += amt;
    else breakdown[type] += amt;
    if (type === "REALIZED_PNL") trades += 1;
    const key = ymdKst(t);
    byDay.set(key, (byDay.get(key) || 0) + amt);
  }

  const days = Math.max(1, Math.ceil((endMs - startMs) / DAY));
  const points = [];
  let cumulative = 0;
  const start = new Date(startMs);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymdKst(d.getTime());
    const daily = byDay.get(key) || 0;
    cumulative += daily;
    points.push({ date: key, daily: Number(daily.toFixed(4)), cumulative: Number(cumulative.toFixed(4)) });
  }

  const realized = Number(breakdown.REALIZED_PNL || 0);
  const commission = Number(breakdown.COMMISSION || 0);
  const funding = Number(breakdown.FUNDING_FEE || 0);
  const net = realized + commission + funding + Number(breakdown.OTHER || 0);

  let currentAsset = 0;
  try {
    const asset = await getTotalAssetUsdt();
    currentAsset = Number(asset?.totalUsdt) || 0;
  } catch {
    /* 수익률 분모 없이 수익금만 */
  }

  const span = Math.max(endMs - startMs, 1);
  const buckets = [];
  for (let i = 0; i < 10; i++) {
    const a = startMs + (span * i) / 10;
    const b = i === 9 ? endMs + 1 : startMs + (span * (i + 1)) / 10;
    const pnl = timed.filter((r) => r.t >= a && r.t < b).reduce((s, r) => s + r.amt, 0);
    const afterStart = timed.filter((r) => r.t >= a).reduce((s, r) => s + r.amt, 0);
    const eq = currentAsset - afterStart;
    const returnPct = Math.abs(eq) > 1 ? (pnl / eq) * 100 : 0;
    buckets.push({
      from: Math.round(a),
      to: Math.round(b - 1),
      pnl: Number(pnl.toFixed(4)),
      returnPct: Number(returnPct.toFixed(2)),
    });
  }

  return {
    period,
    rangeFrom: ymdKst(startMs),
    rangeTo: ymdKst(endMs),
    total: Number(net.toFixed(4)),
    realized: Number(realized.toFixed(4)),
    commission: Number(commission.toFixed(4)),
    funding: Number(funding.toFixed(4)),
    trades,
    points,
    buckets,
  };
}
