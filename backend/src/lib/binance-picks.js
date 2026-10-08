import { publicFuturesRequest } from "./binance-api.js";
import { askGeminiJson } from "./gemini.js";
import { loadBotSettings } from "./binance-settings.js";

const CACHE_TTL_MS = 3 * 60 * 1000;
const MIN_QUOTE_VOLUME = 80_000_000;
const CANDIDATE_N = 24;
const TOP_N = 10;

export const DEFAULT_PICK_CRITERIA = `시가총액이 적당히 큰 코인 (소형 펌핑 코인 제외)
1X로 숏 쳐도 청산·급등 위험이 거의 없음
지금까지의 움직임이 방향이 깔끔하고 딱 좋음
일주일 정도 들고 있으면 기대 수익률이 가장 좋음
1X 롱도 포함 · 롱/숏 통합 상위 10개`;

const PICK_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          side: { type: "string", enum: ["LONG", "SHORT"] },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["symbol", "side", "score"],
      },
    },
  },
  required: ["picks"],
};

let cache = { at: 0, key: "", payload: null };

export function invalidatePicksCache() {
  cache = { at: 0, key: "", payload: null };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function formatVolume(val) {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
  return `${Math.round(val).toLocaleString()}`;
}

function criteriaTextOf(settings) {
  const raw = settings?.scoring_prompt?.trim();
  return raw || DEFAULT_PICK_CRITERIA;
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
  return clamp(Math.round(size + safety + move + week), 0, 100);
}

function heuristicPicks(metrics) {
  return metrics
    .map((m) => {
      const longScore = scoreSide("LONG", m);
      const shortScore = scoreSide("SHORT", m);
      const side = longScore >= shortScore ? "LONG" : "SHORT";
      return {
        symbol: m.symbol,
        side,
        score: side === "LONG" ? longScore : shortScore,
        lastPrice: m.lastPrice,
        chg24: m.chg24,
        ret7d: m.ret7d,
        volumeFormatted: m.volumeFormatted,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
}

async function loadMetrics() {
  const [tickers, premium] = await Promise.all([
    publicFuturesRequest("/fapi/v1/ticker/24hr"),
    publicFuturesRequest("/fapi/v1/premiumIndex"),
  ]);

  const fundingMap = new Map();
  if (Array.isArray(premium)) {
    for (const p of premium) fundingMap.set(p.symbol, Number(p.lastFundingRate) || 0);
  }

  return (Array.isArray(tickers) ? tickers : [])
    .filter((t) => t.symbol.endsWith("USDT") && !t.symbol.includes("_") && Number(t.quoteVolume) >= MIN_QUOTE_VOLUME)
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, CANDIDATE_N)
    .map((t) => {
      const last = Number(t.lastPrice) || 0;
      const high = Number(t.highPrice) || 0;
      const low = Number(t.lowPrice) || 0;
      const chg24 = Number(t.priceChangePercent) || 0;
      return {
        symbol: t.symbol,
        lastPrice: last,
        quoteVolume: Number(t.quoteVolume) || 0,
        volumeFormatted: formatVolume(Number(t.quoteVolume) || 0),
        chg24: Number(chg24.toFixed(2)),
        ret7d: Number(chg24.toFixed(2)),
        funding: (fundingMap.get(t.symbol) || 0) * 100,
        rangePos: high > low ? ((last - low) / (high - low)) * 100 : 50,
      };
    });
}

async function geminiRank(criteria, metrics) {
  const decision = await askGeminiJson({
    system: `당신은 바이낸스 USDT 무기한 선물 롱/숏을 평가한다.
아래 [사용자 기준]을 최우선으로 각 심볼에 0~100점과 방향(LONG/SHORT)을 매긴다.
입력 목록에 있는 심볼만 쓰고, 상위 ${TOP_N}개만 반환한다.
JSON만 출력한다.

[사용자 기준]
${criteria}`,
    message: JSON.stringify(
      metrics.map((m) => ({
        symbol: m.symbol,
        lastPrice: m.lastPrice,
        chg24h: m.chg24,
        volume: m.volumeFormatted,
        fundingPercent: Number(m.funding.toFixed(4)),
        rangePos: Number(m.rangePos.toFixed(1)),
      }))
    ),
    schema: PICK_SCHEMA,
  });
  const bySymbol = new Map(metrics.map((m) => [m.symbol, m]));
  const list = Array.isArray(decision?.picks) ? decision.picks : [];
  return list
    .filter((d) => d && bySymbol.has(d.symbol) && (d.side === "LONG" || d.side === "SHORT"))
    .map((d) => {
      const m = bySymbol.get(d.symbol);
      return {
        symbol: d.symbol,
        side: d.side,
        score: clamp(Math.round(Number(d.score) || 0), 0, 100),
        reason: String(d.reason || "").slice(0, 120),
        lastPrice: m.lastPrice,
        chg24: m.chg24,
        ret7d: m.ret7d,
        volumeFormatted: m.volumeFormatted,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
}

export async function getTopPicks({ force = false } = {}) {
  const settings = await loadBotSettings();
  const criteria = criteriaTextOf(settings);
  const cacheKey = criteria;
  if (!force && cache.payload && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }

  const metrics = await loadMetrics();
  let picks = [];
  let source = "rules";
  let error = null;
  try {
    picks = await geminiRank(criteria, metrics);
    source = "ai+rules";
  } catch (err) {
    error = err.message;
    console.warn("[binance-picks] Gemini 순위 실패, 규칙 점수로 대체:", err.message);
    picks = heuristicPicks(metrics);
  }

  const payload = {
    criteria,
    computedAt: new Date().toISOString(),
    source,
    error,
    picks,
  };
  cache = { at: Date.now(), key: cacheKey, payload };
  return payload;
}
