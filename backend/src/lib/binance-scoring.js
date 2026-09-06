import pool from "../db.js";
import { publicFuturesRequest } from "./binance-api.js";
import { askGeminiJson } from "./gemini.js";
import { loadTodayNewsDigest } from "./binance-news.js";
import { loadBotSettings } from "./binance-settings.js";
import { DEFAULT_SCORING_PROMPT } from "./binance-defaults.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const VOLUME_TOP_N = 40;
const MOVE_TOP_N = 20;

// Gemini 구조화 출력은 최상위 스키마가 object여야 하므로 배열을 opportunities 필드로 감싼다.
const OPPORTUNITY_SCHEMA = {
  type: "object",
  properties: {
    opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          side: { type: "string", enum: ["LONG", "SHORT"] },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["symbol", "side", "score", "reason"],
      },
    },
  },
  required: ["opportunities"],
};

function formatVolumeUSD(val) {
  if (val >= 1000000000) return `${(val / 1000000000).toFixed(2)}B$`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M$`;
  return `${Math.round(val).toLocaleString()}$`;
}

function toLeanMetrics(t, fundingMap) {
  const fund = fundingMap.get(t.symbol) || { rate: 0 };
  const lastPrice = Number(t.lastPrice) || 0;
  const highPrice = Number(t.highPrice) || 0;
  const lowPrice = Number(t.lowPrice) || 0;
  return {
    symbol: t.symbol,
    lastPrice,
    priceChangePercent: Number(Number(t.priceChangePercent).toFixed(2)),
    quoteVolume: Number(t.quoteVolume) || 0,
    volumeFormatted: formatVolumeUSD(Number(t.quoteVolume) || 0),
    fundingRatePercent: Number((fund.rate * 100).toFixed(4)),
    highLowPosition:
      highPrice > lowPrice ? Number((((lastPrice - lowPrice) / (highPrice - lowPrice)) * 100).toFixed(1)) : 50,
  };
}

function buildScoringSystemPrompt(scoringPrompt) {
  return `당신은 바이낸스 USDT 무기한 선물시장의 롱/숏 기회를 평가하는 퀀트 애널리스트입니다.
아래 [점수 산정 기준]과 입력으로 주어지는 [후보 코인 지표], [오늘의 뉴스 요약]을 근거로,
각 후보 심볼마다 0~100점의 통합 기회 점수와 방향(LONG 또는 SHORT), 간결한 근거(한국어 40자 이내)를 산정하세요.
반드시 입력에 주어진 심볼 목록 안에서만 평가하고, 목록에 없는 심볼을 만들어내지 마세요.
응답은 반드시 유효한 JSON이어야 하며, 마크다운 코드펜스나 설명 문장을 절대 덧붙이지 마세요.

[점수 산정 기준]
${scoringPrompt}`;
}

async function fetchCandidates() {
  const [tickers, premiumData] = await Promise.all([
    publicFuturesRequest("/fapi/v1/ticker/24hr"),
    publicFuturesRequest("/fapi/v1/premiumIndex"),
  ]);

  const fundingMap = new Map();
  if (Array.isArray(premiumData)) {
    for (const p of premiumData) {
      fundingMap.set(p.symbol, { rate: Number(p.lastFundingRate) || 0 });
    }
  }

  const usdt = (Array.isArray(tickers) ? tickers : []).filter(
    (t) => t.symbol.endsWith("USDT") && !t.symbol.includes("_")
  );

  const byVolume = [...usdt].sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume)).slice(0, VOLUME_TOP_N);
  const byMove = [...usdt]
    .sort((a, b) => Math.abs(Number(b.priceChangePercent)) - Math.abs(Number(a.priceChangePercent)))
    .slice(0, MOVE_TOP_N);

  const seen = new Set();
  const merged = [];
  for (const t of [...byVolume, ...byMove]) {
    if (seen.has(t.symbol)) continue;
    seen.add(t.symbol);
    merged.push(t);
  }

  return merged.map((t) => toLeanMetrics(t, fundingMap));
}

function validateAndSort(decision, candidates) {
  const validSymbols = new Set(candidates.map((c) => c.symbol));
  const bySymbol = new Map(candidates.map((c) => [c.symbol, c]));
  const list = Array.isArray(decision?.opportunities) ? decision.opportunities : [];

  return list
    .filter((d) => d && validSymbols.has(d.symbol) && (d.side === "LONG" || d.side === "SHORT"))
    .map((d) => ({
      symbol: d.symbol,
      side: d.side,
      score: Math.max(0, Math.min(100, Math.round(Number(d.score) || 0))),
      reason: String(d.reason || "").slice(0, 300),
      lastPrice: bySymbol.get(d.symbol)?.lastPrice ?? null,
      priceChangePercent: bySymbol.get(d.symbol)?.priceChangePercent ?? null,
      volumeFormatted: bySymbol.get(d.symbol)?.volumeFormatted ?? null,
      fundingRatePercent: bySymbol.get(d.symbol)?.fundingRatePercent ?? null,
    }))
    .sort((a, b) => b.score - a.score);
}

export async function loadOpportunityCache() {
  const [rows] = await pool.query("SELECT * FROM binance_opportunity_cache WHERE id = 1");
  if (!rows[0]) return null;
  // mysql2는 JSON 컬럼을 이미 JS 객체로 파싱해서 반환하므로, 문자열일 때만 다시 파싱한다.
  const raw = rows[0].candidates_json;
  const candidates = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { ...rows[0], candidates };
}

/** 기회 점수 캐시가 오래됐으면(기본 5분) 재계산한다. force=true면 무조건 재계산. */
export async function refreshOpportunityCacheIfStale({ force = false } = {}) {
  if (!force) {
    const [rows] = await pool.query("SELECT computed_at FROM binance_opportunity_cache WHERE id = 1");
    if (rows[0] && Date.now() - new Date(rows[0].computed_at).getTime() < CACHE_TTL_MS) {
      return loadOpportunityCache();
    }
  }

  const candidates = await fetchCandidates();
  const settings = await loadBotSettings();
  const news = await loadTodayNewsDigest();
  const scoringPrompt = settings?.scoring_prompt?.trim() || DEFAULT_SCORING_PROMPT;
  const modelUsed = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  let sorted = [];
  try {
    const decision = await askGeminiJson({
      system: buildScoringSystemPrompt(scoringPrompt),
      message: JSON.stringify({
        candidates,
        newsDigest: news?.summary_text || "(오늘자 뉴스 요약 없음)",
      }),
      schema: OPPORTUNITY_SCHEMA,
    });
    sorted = validateAndSort(decision, candidates);
  } catch (err) {
    console.error("[binance-scoring] Gemini 점수 산정 실패:", err.message);
    return loadOpportunityCache(); // 실패 시 기존 캐시 유지 반환
  }

  await pool.query(
    `INSERT INTO binance_opportunity_cache (id, computed_at, candidates_json, model_used)
     VALUES (1, NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE
       computed_at = VALUES(computed_at),
       candidates_json = VALUES(candidates_json),
       model_used = VALUES(model_used)`,
    [JSON.stringify(sorted), modelUsed]
  );

  return loadOpportunityCache();
}
