import pool from "../db.js";
import {
  getFuturesPositions,
  getSymbolFilters,
  setMarginType,
  setLeverage,
  placeMarketOrder,
  placeTakeProfitMarketOrder,
  placeStopMarketOrder,
  getOpenOrders,
  getMarkPrice,
} from "./binance-api.js";
import { askGeminiJson } from "./gemini.js";
import { loadOpportunityCache, refreshOpportunityCacheIfStale } from "./binance-scoring.js";
import {
  loadBotSettings,
  getOpenBotPosition,
  logBot,
  resetErrorCount,
  bumpErrorCountAndMaybePause,
} from "./binance-settings.js";
import { syncIncomeLedger } from "./binance-income.js";

// LLM 출력값을 절대 그대로 신뢰하지 않기 위한 코드 레벨 방어 상한.
// UI/DB 어디에도 노출하지 않는다 — 사용자가 지운 구조화 컨트롤과 무관한 순수 안전장치.
const ABSOLUTE_MAX_LEVERAGE = 5;
const CYCLE_INTERVAL_MS = 60_000;

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["OPEN", "SKIP"] },
    symbol: { type: "string" },
    side: { type: "string", enum: ["LONG", "SHORT"] },
    marginUsdt: { type: "number" },
    leverage: { type: "number" },
    marginType: { type: "string", enum: ["ISOLATED", "CROSSED"] },
    takeProfitPercent: { type: "number" },
    stopLossPercent: { type: "number" },
    reasonText: { type: "string" },
  },
  required: ["action"],
};

function buildDecisionSystemPrompt(rulesPrompt) {
  return `당신은 바이낸스 USDT 무기한 선물 자동매매 봇의 실행 판단 모듈입니다.
아래 [매매 규칙]을 반드시 지키면서, 입력으로 주어지는 [기회 점수 리스트] 중 지금 신규 진입할 가치가
있는 후보가 있는지 판단하세요. 확신이 부족하면 반드시 action="SKIP"을 선택하세요.
레버리지/증거금은 시스템이 별도로 상한선을 강제하니 규칙에 맞는 합리적인 값을 제안하면 됩니다.

[매매 규칙]
${rulesPrompt}`;
}

function computeMinimumQuantity(filters, markPrice) {
  const byNotional = filters.minNotional / markPrice;
  const rawMin = Math.max(filters.minQty, byNotional);
  const steps = Math.ceil(rawMin / filters.stepSize);
  const qty = steps * filters.stepSize;
  const precision = filters.quantityPrecision ?? 0;
  return Number(qty.toFixed(precision));
}

function computeGuardedTpSl(decision) {
  const tp = Number(decision.takeProfitPercent);
  const sl = Number(decision.stopLossPercent);
  // 비상식적인 값(0, 음수, 극단값) 방어 — 합리적 범위로 클램프
  const tpPercent = Number.isFinite(tp) ? Math.min(50, Math.max(0.5, tp)) : 3;
  const slPercent = Number.isFinite(sl) ? Math.min(50, Math.max(1, sl)) : 10;
  return { tpPercent, slPercent };
}

function computeTpSlPrices({ side, entryPrice, tpPercent, slPercent, filters }) {
  const isLong = side === "LONG";
  const tpRaw = isLong ? entryPrice * (1 + tpPercent / 100) : entryPrice * (1 - tpPercent / 100);
  const slRaw = isLong ? entryPrice * (1 - slPercent / 100) : entryPrice * (1 + slPercent / 100);
  const precision = filters.pricePrecision ?? 4;
  return {
    tpPrice: Number(tpRaw.toFixed(precision)),
    slPrice: Number(slRaw.toFixed(precision)),
  };
}

let cycleRunning = false;

async function reconcileClosedPosition(botRow) {
  await pool.query(
    "UPDATE binance_bot_positions SET status='CLOSED', close_reason='EXCHANGE_CLOSED', closed_at=NOW() WHERE id=?",
    [botRow.id]
  );
  await logBot(botRow.symbol, "POSITION_CLOSED", `${botRow.symbol} 봇 포지션이 거래소에서 종료됨(청산/TP/SL 체결 추정)`);
}

/**
 * 모의(paper) 포지션은 실거래소에 존재하지 않으므로 "거래소에 없으면 종료"로 판단하면 안 된다.
 * 현재가로 TP/SL 도달 여부를 직접 시뮬레이션해서 도달했을 때만 종료 처리한다.
 */
async function checkAndClosePaperPosition(botRow) {
  let markPrice;
  try {
    markPrice = await getMarkPrice(botRow.symbol);
  } catch (err) {
    console.warn("[binance-bot] 모의 포지션 현재가 조회 실패:", err.message);
    return false;
  }

  const entryPrice = Number(botRow.entry_price);
  const movePercent =
    botRow.side === "LONG"
      ? ((markPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - markPrice) / entryPrice) * 100;

  const tpPercent = Number(botRow.tp_percent) || 3;
  const slPercent = Number(botRow.sl_percent) || 10;

  let closeReason = null;
  if (movePercent >= tpPercent) closeReason = "PAPER_TP";
  else if (movePercent <= -slPercent) closeReason = "PAPER_SL";
  if (!closeReason) return false;

  const realizedPnl = Number(
    (((movePercent / 100) * Number(botRow.leverage)) * Number(botRow.margin_usdt)).toFixed(4)
  );
  await pool.query(
    "UPDATE binance_bot_positions SET status='CLOSED', close_reason=?, realized_pnl=?, closed_at=NOW() WHERE id=?",
    [closeReason, realizedPnl, botRow.id]
  );
  await logBot(
    botRow.symbol,
    "PAPER_CLOSE",
    `[모의] ${closeReason} 도달로 청산 (변동률 ${movePercent.toFixed(2)}%, PnL ${realizedPnl} USDT)`
  );
  return true;
}

async function ensureProtectiveOrdersExist(botRow) {
  if (botRow.is_paper) return; // 모의 포지션은 실제 거래소 주문이 없음
  let openOrders = [];
  try {
    openOrders = await getOpenOrders(botRow.symbol);
  } catch (err) {
    console.error("[binance-bot] 미체결 주문 조회 실패:", err.message);
    return;
  }
  const hasTp = openOrders.some((o) => o.type === "TAKE_PROFIT_MARKET");
  const hasSl = openOrders.some((o) => o.type === "STOP_MARKET");
  if (hasTp && hasSl) return;

  const closeSide = botRow.side === "LONG" ? "SELL" : "BUY";
  const filters = await getSymbolFilters(botRow.symbol);
  const { tpPrice, slPrice } = computeTpSlPrices({
    side: botRow.side,
    entryPrice: Number(botRow.entry_price),
    tpPercent: Number(botRow.tp_percent) || 3,
    slPercent: Number(botRow.sl_percent) || 10,
    filters,
  });

  try {
    if (!hasTp) {
      await placeTakeProfitMarketOrder({
        symbol: botRow.symbol,
        side: closeSide,
        stopPrice: tpPrice,
        clientOrderId: `${botRow.client_order_tag}_tp2`,
      });
    }
    if (!hasSl) {
      await placeStopMarketOrder({
        symbol: botRow.symbol,
        side: closeSide,
        stopPrice: slPrice,
        clientOrderId: `${botRow.client_order_tag}_sl2`,
      });
    }
    await logBot(botRow.symbol, "PROTECTIVE_ORDER_RESTORED", "취소돼 있던 TP/SL 보호주문을 재설치했습니다.");
  } catch (err) {
    // 보호주문 재설치 실패는 무방비 노출 상태이므로 CRITICAL로 별도 기록(자동 정지 판단은 상위 catch에서)
    await logBot(botRow.symbol, "PROTECTIVE_ORDER_FAILED", `TP/SL 재설치 실패: ${err.message}`);
    throw err;
  }
}

async function insertPositionRow({ decision, quantity, leverage, marginType, requiredMargin, tag, isPaper, entryPrice, orders }) {
  const { tpPercent, slPercent } = computeGuardedTpSl(decision);
  await pool.query(
    `INSERT INTO binance_bot_positions
      (symbol, side, status, entry_price, quantity, leverage, margin_type, margin_usdt,
       tp_percent, sl_percent, entry_order_id, tp_order_id, sl_order_id, client_order_tag,
       reason_text, is_paper)
     VALUES (?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      decision.symbol,
      decision.side,
      entryPrice,
      quantity,
      leverage,
      marginType,
      requiredMargin,
      tpPercent,
      slPercent,
      orders?.entryOrderId || null,
      orders?.tpOrderId || null,
      orders?.slOrderId || null,
      tag,
      String(decision.reasonText || "").slice(0, 2000),
      isPaper ? 1 : 0,
    ]
  );
}

async function executeOpen(decision, settings) {
  const filters = await getSymbolFilters(decision.symbol);
  const opportunityCache = await loadOpportunityCache();
  const candidate = opportunityCache?.candidates?.find((c) => c.symbol === decision.symbol);
  const markPrice = candidate?.lastPrice;
  if (!markPrice) {
    await logBot(decision.symbol, "ENTRY_BLOCKED", "현재가 정보를 찾을 수 없어 진입을 취소했습니다.");
    return;
  }

  const clampedLeverage = Math.min(Math.max(1, Math.round(Number(decision.leverage) || 1)), ABSOLUTE_MAX_LEVERAGE);
  const marginType = decision.marginType === "CROSSED" ? "CROSSED" : "ISOLATED";

  // 규칙: 첫 진입은 항상 해당 심볼의 거래소 최소 주문 금액만큼만 — LLM 제안 수량이 아니라
  // 코드가 직접 "최소 수량"을 계산해 그것만 사용한다(자유 텍스트 규칙을 신뢰 대신 구조적으로 강제).
  const quantity = computeMinimumQuantity(filters, markPrice);
  const requiredMargin = Number(((quantity * markPrice) / clampedLeverage).toFixed(4));

  const maxMargin = Number(settings.max_margin_usdt);
  if (requiredMargin > maxMargin) {
    await logBot(
      decision.symbol,
      "ENTRY_BLOCKED",
      `최소 주문 필요 증거금(${requiredMargin} USDT)이 봇 최대 증거금 한도(${maxMargin} USDT)를 초과하여 진입을 취소했습니다.`
    );
    return;
  }

  const tag = `gwonbot_${Date.now()}`;

  if (settings.paper_mode) {
    await insertPositionRow({
      decision,
      quantity,
      leverage: clampedLeverage,
      marginType,
      requiredMargin,
      tag,
      isPaper: true,
      entryPrice: markPrice,
    });
    await logBot(decision.symbol, "PAPER_OPEN", `[모의] ${decision.side} ${quantity} 진입 (증거금 ${requiredMargin} USDT)`);
    return;
  }

  // ── 실거래 진입 ──
  await setMarginType(decision.symbol, marginType);
  await setLeverage(decision.symbol, clampedLeverage);

  const entrySide = decision.side === "LONG" ? "BUY" : "SELL";
  const entryOrder = await placeMarketOrder({
    symbol: decision.symbol,
    side: entrySide,
    quantity,
    clientOrderId: `${tag}_e`,
  });

  const { tpPercent, slPercent } = computeGuardedTpSl(decision);
  const { tpPrice, slPrice } = computeTpSlPrices({
    side: decision.side,
    entryPrice: markPrice,
    tpPercent,
    slPercent,
    filters,
  });
  const closeSide = decision.side === "LONG" ? "SELL" : "BUY";

  try {
    const tpOrder = await placeTakeProfitMarketOrder({
      symbol: decision.symbol,
      side: closeSide,
      stopPrice: tpPrice,
      clientOrderId: `${tag}_tp`,
    });
    const slOrder = await placeStopMarketOrder({
      symbol: decision.symbol,
      side: closeSide,
      stopPrice: slPrice,
      clientOrderId: `${tag}_sl`,
    });
    await insertPositionRow({
      decision,
      quantity,
      leverage: clampedLeverage,
      marginType,
      requiredMargin,
      tag,
      isPaper: false,
      entryPrice: markPrice,
      orders: { entryOrderId: entryOrder.orderId, tpOrderId: tpOrder.orderId, slOrderId: slOrder.orderId },
    });
    await logBot(decision.symbol, "LIVE_OPEN", `${decision.side} ${quantity} 실진입 (증거금 ${requiredMargin} USDT, TP ${tpPrice} / SL ${slPrice})`);
  } catch (protectErr) {
    // TP/SL 설치 실패 시 무방비 포지션을 절대 남기지 않는다: 즉시 강제 시장가 청산
    try {
      await placeMarketOrder({
        symbol: decision.symbol,
        side: closeSide,
        quantity,
        reduceOnly: true,
        clientOrderId: `${tag}_forceclose`,
      });
    } finally {
      await logBot(
        decision.symbol,
        "PROTECTIVE_ORDER_FAILED_FORCECLOSE",
        `TP/SL 설치 실패로 즉시 강제 청산 실행: ${protectErr.message}`
      );
    }
    throw protectErr;
  }
}

export async function runBotCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const settings = await loadBotSettings();
    if (!settings || !settings.is_active) return;

    syncIncomeLedger().catch((err) => console.error("[binance-bot] income 동기화 실패:", err.message));

    const live = await getFuturesPositions();
    const openBotRow = await getOpenBotPosition();

    if (openBotRow) {
      if (openBotRow.is_paper) {
        // 모의 포지션: 거래소엔 원래 없으므로 현재가 기준 TP/SL 시뮬레이션으로만 종료 여부 판단
        await checkAndClosePaperPosition(openBotRow);
      } else {
        const stillOpen = live.find((p) => p.symbol === openBotRow.symbol && p.side === openBotRow.side);
        if (!stillOpen) {
          await reconcileClosedPosition(openBotRow);
        } else {
          await ensureProtectiveOrdersExist(openBotRow);
        }
      }
      await resetErrorCount();
      return; // 봇 포지션이 있으면 이번 사이클은 관리만 하고 신규 진입하지 않는다
    }

    const opportunityCache = await refreshOpportunityCacheIfStale();
    const opportunities = opportunityCache?.candidates || [];
    if (!opportunities.length) {
      await resetErrorCount();
      return;
    }

    const rulesPrompt = settings.prompt?.trim();
    if (!rulesPrompt) {
      await resetErrorCount();
      return;
    }

    const decision = await askGeminiJson({
      system: buildDecisionSystemPrompt(rulesPrompt),
      message: JSON.stringify({ opportunities: opportunities.slice(0, 15) }),
      schema: DECISION_SCHEMA,
    });

    if (!decision || decision.action !== "OPEN" || !decision.symbol || !decision.side) {
      await resetErrorCount();
      return;
    }
    const validSymbol = opportunities.some((o) => o.symbol === decision.symbol);
    if (!validSymbol) {
      await logBot(decision.symbol, "ENTRY_BLOCKED", "기회 리스트에 없는 심볼이라 진입을 거부했습니다.");
      await resetErrorCount();
      return;
    }

    await executeOpen(decision, settings);
    await resetErrorCount();
  } catch (err) {
    console.error("[binance-bot] 사이클 오류:", err.message);
    await bumpErrorCountAndMaybePause(err).catch(() => {});
  } finally {
    cycleRunning = false;
  }
}

let botTimer = null;

export function startBotEngine() {
  if (botTimer) return;
  botTimer = setInterval(() => {
    runBotCycle().catch((err) => console.error("[binance-bot] 예기치 못한 오류:", err.message));
  }, CYCLE_INTERVAL_MS);
  console.log("[binance-bot] 실행 엔진 시작 (60초 주기)");
}
