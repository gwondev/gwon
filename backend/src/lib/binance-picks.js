import { publicFuturesRequest } from "./binance-api.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_QUOTE_VOLUME = 80_000_000;
const CANDIDATE_N = 40;
const TOP_N = 10;

export const PICK_CRITERIA = [
  "시가총액이 적당히 큰 코인 (소형 펌핑 코인 제외)",
  "1X로 숏 쳐도 청산·급등 위험이 거의 없음",
  "지금까지의 움직임이 방향이 깔끔하고 딱 좋음",
  "일주일 정도 들고 있으면 기대 수익률이 가장 좋음",
  "1X 롱도 포함 · 롱/숏 통합 상위 10개",
];

let cache = { at: 0, payload: null };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function formatVolume(val) {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
  return `${Math.round(val).toLocaleString()}`;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch {
        out[idx] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function scoreSide(side, m) {
  const abs7 = Math.abs(m.ret7d);
  const abs24 = Math.abs(m.chg24);

  const size = clamp(Math.log10(Math.max(m.quoteVolume, 1) / 1e8) / 2.2, 0, 1) * 25;

  let safety = 25;
  if (abs24 > 18) safety -= 8;
  if (abs24 > 28) safety -= 8;
  if (abs7 > 45) safety -= 6;
  if (side === "SHORT" && m.ret7d > 22) safety -= 10;
  if (side === "LONG" && m.ret7d < -22) safety -= 10;
  if (side === "SHORT" && m.funding < -0.05) safety -= 6;
  if (side === "LONG" && m.funding > 0.08) safety -= 5;
  if (m.quoteVolume > 500_000_000) safety += 3;
  safety = clamp(safety, 0, 25);

  const aligned =
    (side === "LONG" && m.ret7d > 0 && m.chg24 >= -1) ||
    (side === "SHORT" && m.ret7d < 0 && m.chg24 <= 1);
  const fadeShort = side === "SHORT" && m.rangePos >= 82 && m.ret7d > 6 && abs24 < 16;
  const fadeLong = side === "LONG" && m.rangePos <= 18 && m.ret7d < -6 && abs24 < 16;
  let move = aligned ? 18 : 8;
  if (fadeShort || fadeLong) move += 6;
  if (Math.sign(m.ret7d) === Math.sign(m.chg24) && abs7 > 2) move += 4;
  move = clamp(move, 0, 25);

  let week = abs7 * 1.4;
  if (side === "LONG" && m.ret7d > 0) week += 6;
  if (side === "SHORT" && m.ret7d < 0) week += 6;
  if (fadeShort || fadeLong) week += 4;
  if (!aligned && !fadeShort && !fadeLong) week *= 0.45;
  week = clamp(week, 0, 25);

  const total = Math.round(size + safety + move + week);
  return {
    score: clamp(total, 0, 100),
    parts: {
      size: Math.round(size),
      safety: Math.round(safety),
      move: Math.round(move),
      week: Math.round(week),
    },
  };
}

async function computePicks() {
  const [tickers, premium] = await Promise.all([
    publicFuturesRequest("/fapi/v1/ticker/24hr"),
    publicFuturesRequest("/fapi/v1/premiumIndex"),
  ]);

  const fundingMap = new Map();
  if (Array.isArray(premium)) {
    for (const p of premium) fundingMap.set(p.symbol, Number(p.lastFundingRate) || 0);
  }

  const usdt = (Array.isArray(tickers) ? tickers : []).filter(
    (t) => t.symbol.endsWith("USDT") && !t.symbol.includes("_")
  );
  const large = usdt
    .filter((t) => Number(t.quoteVolume) >= MIN_QUOTE_VOLUME)
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, CANDIDATE_N);

  const klines = await mapPool(large, 8, async (t) => {
    const rows = await publicFuturesRequest("/fapi/v1/klines", {
      symbol: t.symbol,
      interval: "1d",
      limit: "8",
    });
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const open = Number(rows[0][1]) || 0;
    const close = Number(rows[rows.length - 1][4]) || 0;
    if (!open) return null;
    return { symbol: t.symbol, ret7d: ((close - open) / open) * 100 };
  });

  const retMap = new Map();
  for (const k of klines) {
    if (k) retMap.set(k.symbol, k.ret7d);
  }

  const scored = [];
  for (const t of large) {
    const last = Number(t.lastPrice) || 0;
    const high = Number(t.highPrice) || 0;
    const low = Number(t.lowPrice) || 0;
    const m = {
      quoteVolume: Number(t.quoteVolume) || 0,
      chg24: Number(t.priceChangePercent) || 0,
      ret7d: retMap.get(t.symbol) ?? (Number(t.priceChangePercent) || 0),
      funding: (fundingMap.get(t.symbol) || 0) * 100,
      rangePos: high > low ? ((last - low) / (high - low)) * 100 : 50,
    };
    const longS = scoreSide("LONG", m);
    const shortS = scoreSide("SHORT", m);
    const pick = longS.score >= shortS.score
      ? { side: "LONG", ...longS }
      : { side: "SHORT", ...shortS };

    scored.push({
      symbol: t.symbol,
      side: pick.side,
      score: pick.score,
      parts: pick.parts,
      lastPrice: last,
      chg24: Number(m.chg24.toFixed(2)),
      ret7d: Number(m.ret7d.toFixed(2)),
      volumeFormatted: formatVolume(m.quoteVolume),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    criteria: PICK_CRITERIA,
    computedAt: new Date().toISOString(),
    picks: scored.slice(0, TOP_N),
  };
}

export async function getTopPicks({ force = false } = {}) {
  if (!force && cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }
  const payload = await computePicks();
  cache = { at: Date.now(), payload };
  return payload;
}
