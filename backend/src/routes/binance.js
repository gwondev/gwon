import { Router } from "express";
import pool from "../db.js";
import { requireSuperAdmin } from "../auth-middleware.js";
import {
  getBinanceCredentials,
  getSpotBalances,
  getFuturesBalances,
  getFuturesPositions,
  getMarkPrice,
  getTotalAssetUsdt,
  getPositionTrades,
  summarizePositionFills,
  formatPositionDossier,
  formatCompactDossier,
  getChartContext,
  publicFuturesRequest,
} from "../lib/binance-api.js";
import { getUsdKrwRate } from "../lib/fx-rate.js";
import { askGemini } from "../lib/gemini.js";
import { refreshOpportunityCacheIfStale } from "../lib/binance-scoring.js";
import { loadBotSettings, updateBotSettings, getOpenBotPosition } from "../lib/binance-settings.js";
import { getPnlSummary, getPaperPnlSummary, getPnlReport, getPnlSeries, syncIncomeLedger } from "../lib/binance-income.js";
import { getTopPicks, invalidatePicksCache, criteriaTextOf } from "../lib/binance-picks.js";
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
 * 1-1. 계정 총자산(USDT) + 원화 환산 (USD/KRW 환율은 하루 1회 갱신)
 */
router.get("/total-asset", async (_req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    if (!creds.hasCredentials) {
      return res.json({
        ok: false,
        hasCredentials: false,
        error: "서버 .env에 BINANCE_API_KEY 및 BINANCE_SECRET_KEY가 설정되지 않았습니다.",
      });
    }

    const [assetResult, fxResult] = await Promise.allSettled([getTotalAssetUsdt(), getUsdKrwRate()]);
    if (assetResult.status === "rejected") {
      console.warn("[binance] total-asset skip:", assetResult.reason?.message);
      return res.json({ ok: false, hasCredentials: true, silent: true });
    }

    const { totalUsdt } = assetResult.value;
    const fx = fxResult.status === "fulfilled" ? fxResult.value : null;
    let futures = null;
    try {
      futures = await getFuturesBalances();
    } catch (err) {
      console.warn("[binance] futures snapshot skip:", err.message);
    }
    res.json({
      ok: true,
      hasCredentials: true,
      totalUsdt,
      krwRate: fx?.rate ?? null,
      krwRateDate: fx?.dateKey ?? null,
      totalKrw: fx?.rate ? totalUsdt * fx.rate : null,
      fxError: fx ? null : fxResult.reason?.message || "환율 조회 실패",
      futures: futures
        ? {
            wallet: futures.totalWalletBalance,
            available: futures.availableBalance,
            unrealized: futures.totalUnrealizedProfit,
            margin: futures.totalMarginBalance,
          }
        : null,
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
        return res.json({ ok: false, error: e.message, positions: [], manual: null, bot: null });
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

    res.json({ ok: true, positions: live, manual, bot });
  } catch (err) {
    next(err);
  }
});

async function loadPositionStory(symbol) {
  const pair = String(symbol || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!pair) return { ok: false, error: "심볼이 필요합니다.", story: null };
  const live = await getFuturesPositions();
  const position = live.find((p) => p.symbol === pair) || null;
  if (!position) {
    return { ok: true, symbol: pair, position: null, story: { entry: null, addons: [], lastAdd: null, fillCount: 0, covered: false } };
  }
  const trades = await getPositionTrades(position);
  const story = summarizePositionFills(trades, position);
  return { ok: true, symbol: pair, position, story };
}

/**
 * 현재 포지션의 진입/추매 체결 (차트·비서 공통)
 */
router.get("/position-story", async (req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    if (!creds.hasCredentials) {
      return res.json({ ok: false, error: "바이낸스 API 키가 없습니다.", story: null });
    }
    const data = await loadPositionStory(req.query.symbol);
    res.json(data);
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
    if (fields.scoring_prompt != null) invalidatePicksCache();

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

router.get("/picks", async (req, res, next) => {
  try {
    const data = await getTopPicks({ force: req.query.refresh === "1" });
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error("[binance] picks error:", err);
    res.json({ ok: false, silent: true, picks: [], criteria: "" });
  }
});

router.get("/pnl-report", async (req, res, next) => {
  try {
    const period = String(req.query.period || "1m");
    res.json({ ok: true, ...(await getPnlReport(period)) });
  } catch (err) {
    next(err);
  }
});

router.get("/pnl-chart", async (req, res, next) => {
  try {
    const period = String(req.query.period || "1w");
    const series = await getPnlSeries(period);
    res.json({ ok: true, ...series });
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
router.post("/position-advice", async (req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    const settings = await loadBotSettings();
    const live = creds.hasCredentials ? await getFuturesPositions().catch(() => []) : [];
    const criteria = criteriaTextOf(settings);
    const positions = Array.isArray(live) ? live : [];
    const body = req.body || {};
    const userText = String(body.message || "").trim() || "지금 내 포지션에 대한 매매 추천을 해줘.";
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const fullSummary = body.mode === "summary" || /전체\s*요약/.test(userText);
    const actionMode = !fullSummary && (body.mode === "action" || /동작\s*추천/.test(userText));
    const focusSymbol = String(body.symbol || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const chartInterval = String(body.interval || "240");
    const ordered = [...positions].sort((a, b) => {
      if (a.symbol === focusSymbol) return -1;
      if (b.symbol === focusSymbol) return 1;
      return 0;
    });

    const fromClient = Array.isArray(body.picks) ? body.picks : [];
    let pickBrief = fromClient
      .slice(0, 10)
      .map((p) => `${p.symbol || ""} ${p.side || ""} ${p.marketCapFormatted || ""}`.trim())
      .filter(Boolean)
      .join(", ");
    if (!pickBrief) {
      try {
        const top = await getTopPicks({ force: false });
        pickBrief = (top?.picks || [])
          .slice(0, 10)
          .map((p) => `${p.symbol} ${p.side} ${p.marketCapFormatted || ""}`.trim())
          .join(", ");
      } catch {
        pickBrief = "";
      }
    }

    const dossiers = [];
    for (const p of ordered.slice(0, 4)) {
      try {
        const trades = await getPositionTrades(p);
        const story = summarizePositionFills(trades, p);
        let income = [];
        try {
          const [rows] = await pool.query(
            `SELECT income_type, income, income_time
             FROM binance_income_ledger
             WHERE symbol = ?
             ORDER BY income_time DESC
             LIMIT 40`,
            [p.symbol]
          );
          income = (rows || []).map((r) => ({
            type: r.income_type,
            amount: Number(r.income) || 0,
            time: Number(r.income_time) || 0,
          }));
        } catch {
          income = [];
        }
        dossiers.push({
          symbol: p.symbol,
          side: p.side,
          full: formatPositionDossier(p, story),
          compact: formatCompactDossier(p, story),
          story,
          income,
        });
      } catch (err) {
        console.warn("[binance] position dossier skip:", p.symbol, err.message);
        dossiers.push({
          symbol: p.symbol,
          side: p.side,
          full: formatPositionDossier(p, null),
          compact: formatCompactDossier(p, null),
          story: null,
          income: [],
        });
      }
    }

    let chartBrief = "(없음)";
    const chartSym = focusSymbol || ordered[0]?.symbol;
    if (chartSym) {
      try {
        chartBrief = `${chartSym}\n${await getChartContext(chartSym, chartInterval)}`;
      } catch (err) {
        console.warn("[binance] chart context skip:", err.message);
      }
    }

    const systemPrompt = fullSummary
      ? `당신은 이 계정의 현재 포지션 비서다.
답변은 한국어 평문만 사용한다. 마크다운, 별표 강조(**), 백틱, 이모지, 헤딩을 쓰지 마라.
[현재 포지션 기록]에 있는 체결·손익만 근거로 쓴다. 없는 숫자와 없는 체결을 만들지 마라.
이번 요청은 전체 요약이다. 반드시 아래 다섯 블록을 끝까지 쓴 뒤에만 멈춰라.
1) 지금 어떤 포지션을 얼마에, 몇 배로 들고 있는지
2) 처음 진입 가격과 시점. 이후 추매가 있으면 가격·수량·시점을 빠짐없이. 없으면 추매 없다고 말해라
3) 현재가 대비 추세와 손익 상태
4) 지금부터 할 일. HOLD / ADD / REDUCE / CLOSE / REVERSE 중 하나를 결정하고 이유를 설명한다
5) 추매·익절·손절을 한다면 어디 부근인지. 모르는 값은 추정하지 말고 조건으로만 말한다
중간에 끊지 마라.`
      : actionMode
        ? `당신은 이 계정의 현재 포지션 비서다.
답변은 한국어 평문만 사용한다. 마크다운, 별표 강조(**), 백틱, 이모지, 헤딩을 쓰지 마라.
이번 요청은 동작 추천이다. 이 코인의 체결 역사, 차트 봉, 최근 움직임을 근거로 지금부터 어떻게 할지 알려라.
체결 전체를 나열하지 마라. 전체 요약 양식을 쓰지 마라.
반드시 한 가지 동작을 고른다: HOLD / ADD / REDUCE / CLOSE / REVERSE
이유, 지금 차트가 그 동작을 지지하는지, 다음으로 볼 가격대를 짧게 말한다.
없는 숫자와 없는 체결을 만들지 마라. 2~4문단으로 끝낸다.`
      : `당신은 이 계정 주인의 옆자리에 앉은 노련한 트레이더 동료다. 주인은 반말·사투리·줄임말로 짧게 묻는다.
답변은 한국어 평문만 사용한다. 마크다운, 별표 강조(**), 백틱, 이모지, 헤딩을 쓰지 마라.

먼저 속으로 질문의 진짜 의도를 파악하라. 예:
- "쌍탑 찍은거여?" → 쌍탑이 맞는지 아닌지 판정 + 근거가 되는 두 고점과 넥라인 + 그게 내 포지션에 무슨 뜻인지
- "더 갈까?" → 지금 방향으로 더 갈 가능성과 근거, 막히는 가격
- "물타기 해?" / "던질까?" → 해라/하지 마라 결론과 조건
- "왜 빠져?" → 움직임의 원인으로 볼 수 있는 차트상 이유
질문이 패턴·지지·저항·추세처럼 특정 개념을 물으면 그 개념에 대해서만 판정한다.

답변 규칙:
1. 첫 문장에서 질문에 바로 답한다. "네/아니요/아직 아니다/반쯤 맞다" 같은 결론부터. 서론, 데이터 낭독, 면책 문구 금지.
2. 근거는 질문에 맞는 타임프레임을 골라 쓴다. [차트]에는 15분·1시간·4시간·일봉 요약과 스윙 고점/저점이 있다. 한 타임프레임만 고집하지 말고, 단기 질문이면 15분·1시간, 추세 질문이면 4시간·일봉을 쓴다. 타임프레임 이름을 매 문장 반복하지 마라.
3. 가격은 근거로 필요한 핵심 2~4개만 인용한다. 봉 시가·고가·저가·종가를 줄줄이 나열하지 마라.
4. 마지막에 이게 내 포지션(방향·평단·청산가)에 어떤 의미인지 한두 문장으로 연결한다.
5. 체결 전체를 나열하지 마라. 전체 요약 양식을 쓰지 마라. 이전 대화와 같은 말을 반복하지 마라.
6. 없는 숫자를 만들지 마라. 데이터로 판단이 안 되면 무엇이 확인되면 판단할 수 있는지 조건으로 말한다.
7. 전체 2~3문단, 짧고 단호하게. 행동 추천을 묻지 않았으면 HOLD/ADD 같은 단어를 붙이지 마라.`;

    const analysis = await askGemini({
      system: `${systemPrompt}

[사용자 매매 기준]
${criteria}

[현재 포지션 ${fullSummary ? "기록" : "요약"}]
${focusSymbol ? `지금 보고 있는 심볼: ${focusSymbol}` : ""}
${dossiers.length ? dossiers.map((d) => (fullSummary ? d.full : d.compact)).join("\n\n") : "(없음)"}

[차트]
${chartBrief}

[실현손익·펀딩·수수료]
${fullSummary && dossiers.some((d) => d.income?.length)
    ? JSON.stringify(dossiers.map((d) => ({ symbol: d.symbol, income: d.income })), null, 2)
    : fullSummary
      ? "(없음)"
      : "(질문 답변에서는 생략. 필요하면 요약 숫자만 언급)"}

[현재 추천 상위(참고)]
${pickBrief || "(없음)"}`,
      history,
      message: userText,
      maxOutputTokens: fullSummary ? 8192 : 4096,
      temperature: 0.35,
      thinkingBudget: fullSummary ? 0 : 1024,
    });
    const plain = String(analysis || "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`+/g, "")
      .replace(/^#{1,6}\s+/gm, "");
    res.json({ ok: true, analysis: plain, positionCount: positions.length });
  } catch (err) {
    console.error("[binance] position-advice error:", err);
    res.status(500).json({ ok: false, error: err.message || "AI 추천 생성 실패" });
  }
});

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
