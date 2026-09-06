import { Router } from "express";
import pool from "../db.js";
import { requireSuperAdmin } from "../auth-middleware.js";
import {
  getBinanceCredentials,
  getSpotBalances,
  getFuturesBalances,
  getFuturesPositions,
  getMarkPrice,
  publicFuturesRequest,
} from "../lib/binance-api.js";
import { askGemini } from "../lib/gemini.js";
import { refreshOpportunityCacheIfStale } from "../lib/binance-scoring.js";
import { loadBotSettings, updateBotSettings, getOpenBotPosition } from "../lib/binance-settings.js";
import { getPnlSummary, getPaperPnlSummary, syncIncomeLedger } from "../lib/binance-income.js";
import { DEFAULT_RULES_PROMPT, DEFAULT_SCORING_PROMPT } from "../lib/binance-defaults.js";

const router = Router();

// 모든 엔드포인트는 SUPER_ADMIN 전용 (히든 페이지 보안)
router.use(requireSuperAdmin);

/**
 * 1. 지갑 잔고 조회 (선물 USDT 잔고 + 현물 잔고)
 */
router.get("/wallet", async (_req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    if (!creds.hasCredentials) {
      return res.json({
        ok: false,
        hasCredentials: false,
        error: "서버 .env에 BINANCE_API_KEY 및 BINANCE_SECRET_KEY가 설정되지 않았습니다.",
        futures: {
          totalWalletBalance: 0,
          totalUnrealizedProfit: 0,
          totalMarginBalance: 0,
          availableBalance: 0,
          usdt: { walletBalance: 0, unrealizedProfit: 0, availableBalance: 0 },
        },
        spot: { usdtFree: 0, usdtTotal: 0, balances: [] },
      });
    }

    let futures = null;
    let spot = null;
    let futuresError = null;
    let spotError = null;

    try {
      futures = await getFuturesBalances();
    } catch (e) {
      futuresError = e.message;
      console.error("[binance] futures balance error:", e.message);
    }

    try {
      spot = await getSpotBalances();
    } catch (e) {
      spotError = e.message;
      console.error("[binance] spot balance error:", e.message);
    }

    res.json({
      ok: true,
      hasCredentials: true,
      futuresError,
      spotError,
      futures: futures || {
        totalWalletBalance: 0,
        totalUnrealizedProfit: 0,
        totalMarginBalance: 0,
        availableBalance: 0,
        usdt: { walletBalance: 0, unrealizedProfit: 0, availableBalance: 0 },
      },
      spot: spot || { usdtFree: 0, usdtTotal: 0, balances: [] },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. 현재 포지션 — 사용자 수동 포지션 1개 + 봇 자동 포지션 1개로 분리해서 반환
 */
router.get("/positions", async (_req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    const openBotRow = await getOpenBotPosition();

    let live = [];
    if (creds.hasCredentials) {
      try {
        live = await getFuturesPositions();
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message, manual: null, bot: null });
      }
    }

    const botSymbol = openBotRow?.symbol || null;
    const manualLive = live.find((p) => p.symbol !== botSymbol) || null;
    const botLive = botSymbol ? live.find((p) => p.symbol === botSymbol) || null : null;

    let bot = null;
    if (openBotRow) {
      if (botLive) {
        bot = { ...botLive, reasonText: openBotRow.reason_text, openedAt: openBotRow.opened_at, isPaper: false };
      } else if (openBotRow.is_paper) {
        // 모의 포지션: 실거래소엔 없으므로 현재가로 시뮬레이션 PnL 계산
        let markPrice = Number(openBotRow.entry_price);
        try {
          markPrice = await getMarkPrice(openBotRow.symbol);
        } catch {
          /* 조회 실패 시 진입가로 폴백 */
        }
        const entryPrice = Number(openBotRow.entry_price);
        const isLong = openBotRow.side === "LONG";
        const priceDiffPct = isLong
          ? ((markPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - markPrice) / entryPrice) * 100;
        const roe = Number((priceDiffPct * Number(openBotRow.leverage)).toFixed(2));
        bot = {
          symbol: openBotRow.symbol,
          side: openBotRow.side,
          entryPrice,
          markPrice,
          leverage: Number(openBotRow.leverage),
          roe,
          unRealizedProfit: Number(((roe / 100) * Number(openBotRow.margin_usdt)).toFixed(2)),
          notional: Number(openBotRow.quantity) * markPrice,
          reasonText: openBotRow.reason_text,
          openedAt: openBotRow.opened_at,
          isPaper: true,
        };
      }
    }

    const manual = manualLive
      ? { ...manualLive, reasonText: null, isPaper: false }
      : null;

    res.json({ ok: true, manual, bot });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. 통합 롱/숏 기회 점수 리스트 (1B 등 임의 필터 없음, 점수순 정렬)
 */
router.get("/opportunities", async (req, res, next) => {
  try {
    const force = req.query.refresh === "1";
    const cache = await refreshOpportunityCacheIfStale({ force });
    res.json({
      ok: true,
      computedAt: cache?.computed_at || null,
      opportunities: cache?.candidates || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. 봇 설정 조회
 */
router.get("/bot", async (_req, res, next) => {
  try {
    const settings = await loadBotSettings();
    const [logs] = await pool.query(
      "SELECT * FROM binance_bot_logs ORDER BY id DESC LIMIT 30"
    );
    res.json({
      ok: true,
      settings: settings
        ? {
            tradingRulesPrompt: settings.prompt || DEFAULT_RULES_PROMPT,
            scoringPrompt: settings.scoring_prompt || DEFAULT_SCORING_PROMPT,
            isActive: Boolean(settings.is_active),
            paperMode: Boolean(settings.paper_mode),
            maxMarginUsdt: Number(settings.max_margin_usdt),
            consecutiveErrorCount: settings.consecutive_error_count,
            lastErrorMessage: settings.last_error_message,
            lastCycleAt: settings.last_cycle_at,
            autoPaused: Boolean(settings.auto_paused),
          }
        : null,
      logs: logs || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. 봇 설정 저장 (자유 텍스트 규칙/점수기준 + 안전 하드캡 3종만)
 */
router.put("/bot", async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = {};
    if (typeof b.tradingRulesPrompt === "string") fields.prompt = b.tradingRulesPrompt.trim();
    if (typeof b.scoringPrompt === "string") fields.scoring_prompt = b.scoringPrompt.trim();
    if (typeof b.isActive === "boolean") fields.is_active = b.isActive ? 1 : 0;
    if (typeof b.paperMode === "boolean") fields.paper_mode = b.paperMode ? 1 : 0;
    if (b.maxMarginUsdt != null) {
      const v = Number(b.maxMarginUsdt);
      if (!Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ ok: false, error: "봇 최대 증거금은 0보다 큰 숫자여야 합니다." });
      }
      fields.max_margin_usdt = v;
    }

    // 재활성화 시 auto_paused 플래그와 에러 카운트를 함께 리셋해준다(사용자가 원인 확인 후 다시 켠 것으로 간주)
    if (fields.is_active === 1) {
      await pool.query(
        "UPDATE binance_bot_settings SET auto_paused = 0, consecutive_error_count = 0, last_error_message = NULL WHERE id = 1"
      );
    }

    await updateBotSettings(fields);

    await pool.query(
      "INSERT INTO binance_bot_logs (symbol, action, message) VALUES (?, ?, ?)",
      ["SYSTEM", "UPDATE_SETTINGS", "봇 설정이 저장되었습니다."]
    );

    res.json({ ok: true, message: "봇 설정이 성공적으로 저장되었습니다." });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. 사용자/봇 누적 실현손익 요약
 */
router.get("/pnl-summary", async (_req, res, next) => {
  try {
    syncIncomeLedger().catch((err) => console.error("[binance] income sync 실패:", err.message));
    const realized = await getPnlSummary();
    const paperRealized = await getPaperPnlSummary();
    res.json({ ok: true, realized, paperRealized });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. 상단 바용 통합 대시보드 조회
 */
router.get("/dashboard", async (_req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    let futures = null;
    if (creds.hasCredentials) {
      try {
        futures = await getFuturesBalances();
      } catch {
        /* 무시 - 잔고는 없어도 나머지 정보는 반환 */
      }
    }
    const settings = await loadBotSettings();
    const realized = await getPnlSummary();
    const paperRealized = await getPaperPnlSummary();
    const openBotRow = await getOpenBotPosition();

    res.json({
      ok: true,
      hasCredentials: creds.hasCredentials,
      futures,
      realizedPnl: realized,
      paperBotPnl: paperRealized,
      bot: {
        isActive: Boolean(settings?.is_active),
        paperMode: Boolean(settings?.paper_mode),
        autoPaused: Boolean(settings?.auto_paused),
        hasOpenPosition: Boolean(openBotRow),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Gemini AI 실시간 시장 분석 & 전략 진단 (범용 롱/숏 문구)
 */
router.post("/bot/ai-diagnose", async (req, res, next) => {
  try {
    const { promptText, targetSymbol } = req.body || {};

    const [tickers, premiumData] = await Promise.all([
      publicFuturesRequest("/fapi/v1/ticker/24hr"),
      publicFuturesRequest("/fapi/v1/premiumIndex"),
    ]);

    const fundingMap = new Map();
    if (Array.isArray(premiumData)) {
      for (const p of premiumData) {
        fundingMap.set(p.symbol, (Number(p.lastFundingRate) || 0) * 100);
      }
    }

    const topCoins = (Array.isArray(tickers) ? tickers : [])
      .filter((t) => t.symbol.endsWith("USDT") && Number(t.quoteVolume) >= 100000000)
      .sort((a, b) => Math.abs(Number(b.priceChangePercent)) - Math.abs(Number(a.priceChangePercent)))
      .slice(0, 10)
      .map((t) => ({
        symbol: t.symbol,
        price: t.lastPrice,
        change24h: `${Number(t.priceChangePercent).toFixed(2)}%`,
        volume24h: t.quoteVolume,
        fundingRate: `${(fundingMap.get(t.symbol) || 0).toFixed(4)}%`,
      }));

    const systemPrompt = `당신은 최고 수준의 가상자산 헤지펀드 퀀트 트레이더입니다.
사용자가 제공하는 [매매 규칙]과 [실시간 시장 데이터]를 정밀 대조하여, 롱/숏을 가리지 않고
냉철하고 명확하게 진단 리포트를 작성하십시오.
형식:
1. [현재 시장 상황 및 롱/숏 유망 타겟 평가]
2. [사용자 규칙 부합도 분석]
3. [추천 액션 플랜 (진입/청산/대기)]
4. [주의해야 할 리스크 경고]`;

    const userMessage = `[사용자 매매 규칙]:
${promptText || "(기본 규칙 적용)"}

[주요 관심 심볼]: ${targetSymbol || "상위 변동 코인 전체"}

[실시간 바이낸스 주요 변동 코인 현황]:
${JSON.stringify(topCoins, null, 2)}

위 데이터를 바탕으로 지금 즉시 진입하기에 가장 적합한 코인(롱/숏 무관)과, 근거 및 주의사항을 브리핑해줘.`;

    const result = await askGemini({ system: systemPrompt, message: userMessage });

    await pool.query(
      "INSERT INTO binance_bot_logs (symbol, action, message) VALUES (?, ?, ?)",
      [targetSymbol || "MARKET", "AI_DIAGNOSE", "Gemini AI 전략 진단 실행 완료"]
    );

    res.json({ ok: true, analysis: result });
  } catch (err) {
    console.error("[binance] ai-diagnose error:", err);
    res.status(500).json({ ok: false, error: err.message || "AI 진단 생성 실패" });
  }
});

export default router;
