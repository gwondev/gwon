import { Router } from "express";
import pool from "../db.js";
import { requireSuperAdmin } from "../auth-middleware.js";
import {
  getBinanceCredentials,
  getSpotBalances,
  getFuturesBalances,
  getFuturesPositions,
  publicFuturesRequest,
} from "../lib/binance-api.js";
import { askGemini } from "../lib/gemini.js";

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
 * 2. 현재 포지션 및 다음 행동 추천
 */
router.get("/positions", async (_req, res, next) => {
  try {
    const creds = getBinanceCredentials();
    if (!creds.hasCredentials) {
      return res.json({ ok: false, positions: [], error: "API 키 미설정" });
    }

    let positions = [];
    try {
      positions = await getFuturesPositions();
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message, positions: [] });
    }

    // 각 포지션별 펀딩비 및 추천 다음 행동 분석
    let premiumData = [];
    try {
      premiumData = await publicFuturesRequest("/fapi/v1/premiumIndex");
    } catch {
      premiumData = [];
    }
    const fundingMap = new Map();
    if (Array.isArray(premiumData)) {
      for (const p of premiumData) {
        fundingMap.set(p.symbol, {
          rate: (Number(p.lastFundingRate) || 0) * 100,
          nextFundingTime: Number(p.nextFundingTime) || 0,
        });
      }
    }

    const analyzed = positions.map((pos) => {
      const fund = fundingMap.get(pos.symbol) || { rate: 0, nextFundingTime: 0 };
      const isShort = pos.side === "SHORT";
      const isLong = pos.side === "LONG";
      const roe = pos.roe;

      let action = "포지션 관망";
      let actionType = "HOLD"; // TP, LADDER, SL, HOLD
      let actionDesc = "현재 시장 흐름을 주시하며 기존 거미줄 주문 대기";
      let ladderAdvice = null;

      if (isShort) {
        // 숏 포지션 전략 분석
        const ladder2 = Number((pos.entryPrice * 1.02).toFixed(4));
        const ladder3 = Number((pos.entryPrice * 1.045).toFixed(4));
        const ladder4 = Number((pos.entryPrice * 1.075).toFixed(4));
        const tp1 = Number((pos.entryPrice * 0.97).toFixed(4));
        const tp2 = Number((pos.entryPrice * 0.94).toFixed(4));

        ladderAdvice = {
          entry: pos.entryPrice,
          ladder2,
          ladder3,
          ladder4,
          tp1,
          tp2,
        };

        if (roe >= 6.0) {
          action = "전량 익절 추천 (TP2 도달)";
          actionType = "TP";
          actionDesc = `수익률 +${roe}% 달성. 목표 구간 도달로 전량 익절 또는 트레일링 스탑 적용.`;
        } else if (roe >= 2.5) {
          action = "1차 분할 익절 (TP1 권장)";
          actionType = "TP";
          actionDesc = `수익률 +${roe}% 달성. 50% 분할 익절 후 스탑로스를 본절가(${pos.entryPrice})로 설정.`;
        } else if (roe <= -8.0) {
          action = "손절 및 헷징 점검 (SL Alert)";
          actionType = "SL";
          actionDesc = `손실률 ${roe}%. 거미줄 상단 저항 돌파 시 추가 손실 방지를 위한 손절선 준수.`;
        } else if (roe <= -3.0) {
          action = "3~4차 거미줄 추가 진입 대기";
          actionType = "LADDER";
          actionDesc = `단기 과열 진행 중. 평단가 견인을 위해 상단 거미줄(${ladder3} ~ ${ladder4}) 체결 감시.`;
        } else if (roe <= -1.0) {
          action = "2차 거미줄 진입 대기 (+2.0%)";
          actionType = "LADDER";
          actionDesc = `1차 진입 대비 소폭 반등. 2차 거미줄 주문(${ladder2}) 체결 여부 확인.`;
        } else {
          action = "포지션 안정 유지";
          actionType = "HOLD";
          actionDesc = "진입가 부근 횡보 중. 펀딩비 수익 수취하며 변곡점 대기.";
        }
      } else if (isLong) {
        if (roe >= 5.0) {
          action = "익절 권장 (TP)";
          actionType = "TP";
          actionDesc = `수익률 +${roe}%. 상승 탄력 둔화 시 분할 익절 권장.`;
        } else if (roe <= -5.0) {
          action = "손절선 점검";
          actionType = "SL";
          actionDesc = `손실률 ${roe}%. 하방 지지 이탈 주의.`;
        }
      }

      return {
        ...pos,
        fundingRate: fund.rate,
        nextFundingTime: fund.nextFundingTime,
        action,
        actionType,
        actionDesc,
        ladderAdvice,
      };
    });

    res.json({ ok: true, positions: analyzed });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. 1B 이상 급등 코인 감시 및 백분위 숏/롱 추천 스캐너
 */
router.get("/scanner", async (_req, res, next) => {
  try {
    const [tickers, premiumData] = await Promise.all([
      publicFuturesRequest("/fapi/v1/ticker/24hr"),
      publicFuturesRequest("/fapi/v1/premiumIndex"),
    ]);

    const fundingMap = new Map();
    if (Array.isArray(premiumData)) {
      for (const p of premiumData) {
        fundingMap.set(p.symbol, {
          rate: (Number(p.lastFundingRate) || 0) * 100,
          nextFundingTime: Number(p.nextFundingTime) || 0,
        });
      }
    }

    // USDT 선물 페어만 필터
    const usdtTickers = (Array.isArray(tickers) ? tickers : [])
      .filter((t) => t.symbol.endsWith("USDT") && !t.symbol.includes("_"))
      .map((t) => {
        const lastPrice = Number(t.lastPrice) || 0;
        const highPrice = Number(t.highPrice) || 0;
        const lowPrice = Number(t.lowPrice) || 0;
        const priceChangePercent = Number(t.priceChangePercent) || 0;
        const quoteVolume = Number(t.quoteVolume) || 0; // 24h 거래대금 USDT
        const fund = fundingMap.get(t.symbol) || { rate: 0, nextFundingTime: 0 };

        const is1B = quoteVolume >= 1000000000; // 1B 달러 (10억$) 이상

        // 거미줄 숏 백분위 점수 계산 (0 ~ 100)
        // 1) 급등폭 점수 (최대 40점): +5% ~ +30% 이상일 때 고득점
        let surgeScore = 0;
        if (priceChangePercent >= 20) surgeScore = 40;
        else if (priceChangePercent >= 10) surgeScore = 32 + (priceChangePercent - 10) * 0.8;
        else if (priceChangePercent >= 5) surgeScore = 20 + (priceChangePercent - 5) * 2.4;
        else if (priceChangePercent > 0) surgeScore = priceChangePercent * 4;

        // 2) 거래대금 유동성 점수 (최대 30점): 1B 이상이면 30점 만점
        let volScore = 0;
        if (is1B) volScore = 30;
        else if (quoteVolume >= 500000000) volScore = 25; // 500M
        else if (quoteVolume >= 200000000) volScore = 18; // 200M
        else volScore = Math.min(15, (quoteVolume / 200000000) * 15);

        // 3) 펀딩비 수익 우호도 점수 (최대 20점):
        //    양수 펀딩비는 숏 보유 시 수취하므로 가산 (+0.01% 이상 우수)
        //    심한 음수(-0.04% 이하)는 숏 스퀴즈 위험 및 펀딩비 손실로 대폭 감점
        let fundScore = 10;
        if (fund.rate >= 0.05) fundScore = 20;
        else if (fund.rate >= 0.01) fundScore = 16;
        else if (fund.rate >= 0) fundScore = 12;
        else if (fund.rate >= -0.02) fundScore = 8;
        else if (fund.rate >= -0.05) fundScore = 2;
        else fundScore = -15; // 극단 음수: 강력 감점

        // 4) 24h 고점 근접도 점수 (최대 10점): 고점 대비 95% 이상 위치 시 첫 거미줄 최적
        let highRatio = highPrice > lowPrice ? (lastPrice - lowPrice) / (highPrice - lowPrice) : 0.5;
        let topScore = Math.round(highRatio * 10);

        let shortScore = Math.min(100, Math.max(0, Math.round(surgeScore + volScore + fundScore + topScore)));

        // 롱 점수는 역방향 (과매도 반등 탐지)
        let longScore = Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (priceChangePercent < -5 ? Math.abs(priceChangePercent) * 2.5 : 5) +
                (fund.rate < -0.02 ? 30 : 10) +
                volScore * 0.8
            )
          )
        );

        // 거미줄 4단 분할 가격 가이드
        const ladder1 = lastPrice;
        const ladder2 = Number((lastPrice * 1.02).toFixed(lastPrice < 1 ? 5 : 2));
        const ladder3 = Number((lastPrice * 1.045).toFixed(lastPrice < 1 ? 5 : 2));
        const ladder4 = Number((lastPrice * 1.075).toFixed(lastPrice < 1 ? 5 : 2));

        return {
          symbol: t.symbol,
          lastPrice,
          highPrice,
          lowPrice,
          priceChangePercent: Number(priceChangePercent.toFixed(2)),
          quoteVolume,
          volumeFormatted: formatVolumeUSD(quoteVolume),
          is1B,
          fundingRate: Number(fund.rate.toFixed(4)),
          nextFundingTime: fund.nextFundingTime,
          shortScore,
          longScore,
          ladders: { ladder1, ladder2, ladder3, ladder4 },
        };
      });

    // 1B 이상 코인 목록과 급등 탑 종목 분리
    const coins1B = usdtTickers
      .filter((t) => t.is1B)
      .sort((a, b) => b.shortScore - a.shortScore);

    const topShortPicks = usdtTickers
      .slice()
      .sort((a, b) => b.shortScore - a.shortScore)
      .slice(0, 15);

    const topGainers = usdtTickers
      .slice()
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, 15);

    res.json({
      ok: true,
      totalTracked: usdtTickers.length,
      count1B: coins1B.length,
      coins1B,
      topShortPicks,
      topGainers,
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
    const [rows] = await pool.query("SELECT * FROM binance_bot_settings WHERE id = 1");
    const [logs] = await pool.query(
      "SELECT * FROM binance_bot_logs ORDER BY id DESC LIMIT 20"
    );
    res.json({
      ok: true,
      settings: rows[0] || null,
      logs: logs || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. 봇 설정 저장 (프롬프트, 모드 등)
 */
router.put("/bot", async (req, res, next) => {
  try {
    const b = req.body || {};
    const prompt = String(b.prompt || "").trim();
    const isActive = b.isActive ? 1 : 0;
    const paperMode = b.paperMode ? 1 : 0;
    const leverage = Math.min(50, Math.max(1, Number(b.leverage) || 5));
    const orderSizePercent = Number(b.orderSizePercent) || 3.0;

    await pool.query(
      `UPDATE binance_bot_settings SET
         prompt = ?, is_active = ?, paper_mode = ?, leverage = ?, order_size_percent = ?
       WHERE id = 1`,
      [prompt, isActive, paperMode, leverage, orderSizePercent]
    );

    // 로그 기록
    await pool.query(
      "INSERT INTO binance_bot_logs (symbol, action, message) VALUES (?, ?, ?)",
      ["SYSTEM", "UPDATE_SETTINGS", `봇 전략 프롬프트 및 설정 저장 (모드: ${paperMode ? "모의" : "실전"})`]
    );

    res.json({ ok: true, message: "봇 설정이 성공적으로 저장되었습니다." });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Gemini AI 실시간 시장 분석 & 프롬프트 전략 진단
 */
router.post("/bot/ai-diagnose", async (req, res, next) => {
  try {
    const { promptText, targetSymbol } = req.body || {};

    // 실시간 시장 티커 및 펀딩비 수집
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
      .filter((t) => t.symbol.endsWith("USDT") && Number(t.quoteVolume) >= 300000000)
      .sort((a, b) => Number(b.priceChangePercent) - Number(a.priceChangePercent))
      .slice(0, 10)
      .map((t) => ({
        symbol: t.symbol,
        price: t.lastPrice,
        change24h: `${Number(t.priceChangePercent).toFixed(2)}%`,
        volume24h: formatVolumeUSD(Number(t.quoteVolume)),
        fundingRate: `${(fundingMap.get(t.symbol) || 0).toFixed(4)}%`,
      }));

    const systemPrompt = `당신은 최고 수준의 가상자산 헤지펀드 퀀트 트레이더이자, '1B 이상 대형 급등 코인 거미줄 숏(Laddered Short DCA)' 전략 전문 AI입니다.
사용자가 제공하는 [프롬프트 매매 규칙]과 [실시간 시장 데이터]를 정밀 대조하여 냉철하고 명확하게 진단 리포트를 작성하십시오.
형식:
1. [현재 시장 과열도 및 1B 이상 유망 숏 타겟 평가]
2. [사용자 프롬프트 규칙 부합도 분석 (펀딩비, 거래대금, 거미줄 분할 라인)]
3. [현재 포지션 및 추천 액션 플랜 (TP / SL / 거미줄 2~4차 대기 가격대)]
4. [주의해야 할 블랙스완/스퀴즈 리스크 경고]`;

    const userMessage = `[사용자 봇 전략 프롬프트]:
${promptText || "(기본 1B 이상 거미줄 숏 전략)"}

[주요 관심 심볼]: ${targetSymbol || "상위 급등 1B 코인 전체"}

[실시간 바이낸스 대형 급등 코인 현황]:
${JSON.stringify(topCoins, null, 2)}

위 데이터를 바탕으로 지금 즉시 거미줄 숏을 치기에 가장 적합한 코인과, 구체적인 4단계 진입 가격대 및 주의사항을 브리핑해줘.`;

    const result = await askGemini({
      system: systemPrompt,
      message: userMessage,
    });

    // 진단 로그 저장
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

function formatVolumeUSD(val) {
  if (val >= 1000000000) return `${(val / 1000000000).toFixed(2)}B$`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M$`;
  return `${Math.round(val).toLocaleString()}$`;
}

export default router;
