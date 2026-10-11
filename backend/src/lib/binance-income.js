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

async function periodBounds(period) {
  const isAll = period === "all";
  const lookback = isAll ? ALL_LOOKBACK_MS : Math.max(PERIOD_DAYS[period] || 7, 30) * DAY;
  await syncIncomeLedger(lookback);
  const endMs = Date.now();
  let startMs = endMs - (PERIOD_DAYS[period] || 7) * DAY;
  if (isAll) {
    const [bounds] = await pool.query("SELECT MIN(income_time) AS min_t FROM binance_income_ledger");
    const minT = Number(bounds[0]?.min_t);
    startMs = Number.isFinite(minT) && minT > 0 ? minT : endMs - ALL_LOOKBACK_MS;
  }
  return { startMs, endMs };
}

const round4 = (v) => Number((Number(v) || 0).toFixed(4));

/** 수익금 탭용 상세 리포트 (일별·코인별·수동/봇·체결 통계·최근 청산) */
export async function getPnlReport(period = "1m") {
  const { startMs, endMs } = await periodBounds(period);
  const [rows] = await pool.query(
    `SELECT symbol, income_type, income, attribution, income_time
     FROM binance_income_ledger
     WHERE income_time >= ? AND income_time <= ?
     ORDER BY income_time ASC`,
    [startMs, endMs]
  );

  const totals = { realized: 0, commission: 0, funding: 0, other: 0 };
  const byDay = new Map();
  const bySymbol = new Map();
  const byAttr = { MANUAL: 0, BOT: 0, UNKNOWN: 0 };
  const closes = [];

  for (const r of rows) {
    const amt = Number(r.income) || 0;
    const t = Number(r.income_time);
    const type = r.income_type;
    const sym = r.symbol || "-";
    const field =
      type === "REALIZED_PNL" ? "realized" : type === "COMMISSION" ? "commission" : type === "FUNDING_FEE" ? "funding" : "other";
    totals[field] += amt;

    const dayKey = ymdKst(t);
    const day = byDay.get(dayKey) || { realized: 0, commission: 0, funding: 0, other: 0 };
    day[field] += amt;
    byDay.set(dayKey, day);

    const s = bySymbol.get(sym) || { symbol: sym, realized: 0, commission: 0, funding: 0, closes: 0, wins: 0 };
    if (field !== "other") s[field] += amt;
    if (type === "REALIZED_PNL") {
      s.closes += 1;
      if (amt > 0) s.wins += 1;
      closes.push({ time: t, symbol: sym, pnl: amt, attribution: r.attribution || "UNKNOWN" });
    }
    bySymbol.set(sym, s);
    byAttr[r.attribution in byAttr ? r.attribution : "UNKNOWN"] += amt;
  }

  const net = totals.realized + totals.commission + totals.funding + totals.other;

  // 일별 시계열 (빈 날 포함) + 최대 낙폭
  const days = [];
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (let ms = startMs; ms <= endMs + DAY - 1; ms += DAY) {
    const key = ymdKst(ms);
    if (days.length && days[days.length - 1].date === key) continue;
    const d = byDay.get(key) || { realized: 0, commission: 0, funding: 0, other: 0 };
    const dayNet = d.realized + d.commission + d.funding + d.other;
    cumulative += dayNet;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    days.push({
      date: key,
      realized: round4(d.realized),
      fees: round4(d.commission + d.funding),
      net: round4(dayNet),
      cumulative: round4(cumulative),
    });
    if (key === ymdKst(endMs)) break;
  }

  const wins = closes.filter((c) => c.pnl > 0);
  const losses = closes.filter((c) => c.pnl < 0);
  const grossWin = wins.reduce((s, c) => s + c.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, c) => s + c.pnl, 0));
  const activeDays = days.filter((d) => d.net !== 0);
  const sortedDays = [...activeDays].sort((a, b) => b.net - a.net);
  const sortedCloses = [...closes].sort((a, b) => b.pnl - a.pnl);

  let currentAsset = 0;
  try {
    currentAsset = Number((await getTotalAssetUsdt())?.totalUsdt) || 0;
  } catch {
    /* 수익률 없이 */
  }
  const startEquity = currentAsset - net;
  const returnPct = Math.abs(startEquity) > 1 ? (net / startEquity) * 100 : null;

  return {
    period,
    rangeFrom: ymdKst(startMs),
    rangeTo: ymdKst(endMs),
    summary: {
      net: round4(net),
      realized: round4(totals.realized),
      commission: round4(totals.commission),
      funding: round4(totals.funding),
      returnPct: returnPct == null ? null : Number(returnPct.toFixed(2)),
      currentAsset: round4(currentAsset),
      closes: closes.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closes.length ? Number(((wins.length / closes.length) * 100).toFixed(1)) : null,
      avgWin: wins.length ? round4(grossWin / wins.length) : 0,
      avgLoss: losses.length ? round4(-grossLoss / losses.length) : 0,
      profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
      maxDrawdown: round4(maxDrawdown),
      profitDays: activeDays.filter((d) => d.net > 0).length,
      lossDays: activeDays.filter((d) => d.net < 0).length,
      bestDay: sortedDays[0] || null,
      worstDay: sortedDays.length ? sortedDays[sortedDays.length - 1] : null,
      bestClose: sortedCloses[0] || null,
      worstClose: sortedCloses.length ? sortedCloses[sortedCloses.length - 1] : null,
    },
    days,
    symbols: [...bySymbol.values()]
      .map((s) => ({
        ...s,
        realized: round4(s.realized),
        commission: round4(s.commission),
        funding: round4(s.funding),
        net: round4(s.realized + s.commission + s.funding),
        winRate: s.closes ? Number(((s.wins / s.closes) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => b.net - a.net),
    attribution: { manual: round4(byAttr.MANUAL), bot: round4(byAttr.BOT), unknown: round4(byAttr.UNKNOWN) },
    recentCloses: closes.slice(-60).reverse().map((c) => ({ ...c, pnl: round4(c.pnl) })),
  };
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
