import crypto from "crypto";

const SPOT_BASE = "https://api.binance.com";
const FUTURES_BASE = "https://fapi.binance.com";

export function getBinanceCredentials() {
  const apiKey = (process.env.BINANCE_API_KEY || "").trim();
  const secretKey = (
    process.env.BINANCE_SECRET_KEY ||
    process.env.BINANCE_API_SECRET ||
    ""
  ).trim();
  return {
    apiKey,
    secretKey,
    hasCredentials: Boolean(apiKey && secretKey),
  };
}

let timeOffset = 0;
let lastSyncTime = 0;

async function syncTimeOffset(baseUrl) {
  try {
    const timePath = baseUrl.includes("fapi") ? "/fapi/v1/time" : "/api/v3/time";
    const res = await fetch(`${baseUrl}${timePath}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.serverTime) {
        timeOffset = Number(data.serverTime) - Date.now();
        lastSyncTime = Date.now();
      }
    }
  } catch (err) {
    console.warn("[binance] time sync warning:", err.message);
  }
}

function signQuery(queryString, secret) {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

/**
 * 서명된 바이낸스 API 호출 래퍼 (타임존 오프셋 자동 동기화 및 재시도 지원)
 */
export async function signedRequest(baseUrl, path, method = "GET", params = {}, isRetry = false) {
  const { apiKey, secretKey, hasCredentials } = getBinanceCredentials();
  if (!hasCredentials) {
    throw new Error("바이낸스 API 키(BINANCE_API_KEY, BINANCE_SECRET_KEY)가 설정되지 않았습니다.");
  }

  // 10분마다 서버 시간 자동 재동기화
  if (!lastSyncTime || Date.now() - lastSyncTime > 10 * 60 * 1000) {
    await syncTimeOffset(baseUrl);
  }

  const timestamp = Date.now() + timeOffset;
  const searchParams = new URLSearchParams({
    ...params,
    recvWindow: "60000",
    timestamp: String(timestamp),
  });

  const signature = signQuery(searchParams.toString(), secretKey);
  searchParams.append("signature", signature);

  const url = `${baseUrl}${path}?${searchParams.toString()}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    // 타임스탬프 오차(-1021) 발생 시 즉시 서버 시간 재동기화 후 1회 재시도
    if (data.code === -1021 && !isRetry) {
      console.warn("[binance] timestamp skew (-1021) detected. Resyncing server time...");
      await syncTimeOffset(baseUrl);
      return signedRequest(baseUrl, path, method, params, true);
    }
    const msg = data.msg || data.message || `바이낸스 API 오류 (${res.status})`;
    const err = new Error(msg);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * 공개 바이낸스 선물 API 호출
 */
export async function publicFuturesRequest(path, params = {}) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const res = await fetch(`${FUTURES_BASE}${path}${query}`);
  if (!res.ok) {
    throw new Error(`바이낸스 공개 API 오류: ${res.status}`);
  }
  return await res.json();
}

/**
 * 현물 지갑 및 잔고 조회
 */
export async function getSpotBalances() {
  const data = await signedRequest(SPOT_BASE, "/api/v3/account");
  const balances = (data.balances || [])
    .map((b) => ({
      asset: b.asset,
      free: Number(b.free) || 0,
      locked: Number(b.locked) || 0,
      total: (Number(b.free) || 0) + (Number(b.locked) || 0),
    }))
    .filter((b) => b.total > 0.00001);

  const usdtItem = balances.find((b) => b.asset === "USDT");
  return {
    canTrade: data.canTrade,
    usdtFree: usdtItem ? usdtItem.free : 0,
    usdtTotal: usdtItem ? usdtItem.total : 0,
    balances,
    updateTime: data.updateTime,
  };
}

/**
 * 선물 지갑 잔고 및 마진 정보 조회
 */
export async function getFuturesBalances() {
  const data = await signedRequest(FUTURES_BASE, "/fapi/v2/account");
  const assets = (data.assets || []).map((a) => ({
    asset: a.asset,
    walletBalance: Number(a.walletBalance) || 0,
    unrealizedProfit: Number(a.unrealizedProfit) || 0,
    marginBalance: Number(a.marginBalance) || 0,
    availableBalance: Number(a.availableBalance) || 0,
  }));

  const usdtAsset = assets.find((a) => a.asset === "USDT") || {
    walletBalance: Number(data.totalWalletBalance) || 0,
    unrealizedProfit: Number(data.totalUnrealizedProfit) || 0,
    marginBalance: Number(data.totalMarginBalance) || 0,
    availableBalance: Number(data.availableBalance) || 0,
  };

  return {
    totalWalletBalance: Number(data.totalWalletBalance) || 0,
    totalUnrealizedProfit: Number(data.totalUnrealizedProfit) || 0,
    totalMarginBalance: Number(data.totalMarginBalance) || 0,
    availableBalance: Number(data.availableBalance) || 0,
    usdt: usdtAsset,
    assets: assets.filter((a) => a.walletBalance > 0.01),
  };
}

/**
 * 현재 선물 실시간 포지션 목록 조회
 */
export async function getFuturesPositions() {
  const positions = await signedRequest(FUTURES_BASE, "/fapi/v2/positionRisk");
  return (positions || [])
    .map((p) => {
      const positionAmt = Number(p.positionAmt) || 0;
      const entryPrice = Number(p.entryPrice) || 0;
      const markPrice = Number(p.markPrice) || 0;
      const unRealizedProfit = Number(p.unRealizedProfit) || 0;
      const leverage = Number(p.leverage) || 1;
      const notional = Math.abs(positionAmt * markPrice);

      const margin = leverage > 0 ? notional / leverage : 0;
      const roe = margin > 0 ? (unRealizedProfit / margin) * 100 : 0;

      return {
        symbol: p.symbol,
        positionAmt,
        side: positionAmt > 0 ? "LONG" : positionAmt < 0 ? "SHORT" : "NONE",
        entryPrice,
        markPrice,
        unRealizedProfit,
        liquidationPrice: Number(p.liquidationPrice) || 0,
        leverage,
        marginType: p.marginType,
        notional,
        roe: Number(roe.toFixed(2)),
      };
    })
    .filter((p) => Math.abs(p.positionAmt) > 0);
}

/**
 * 심볼별 수량/가격 정밀도 및 최소주문 제한 조회 (exchangeInfo, 1시간 캐시)
 */
let exchangeInfoCache = { data: null, fetchedAt: 0 };
const EXCHANGE_INFO_TTL_MS = 60 * 60 * 1000;

export async function getExchangeInfo() {
  if (exchangeInfoCache.data && Date.now() - exchangeInfoCache.fetchedAt < EXCHANGE_INFO_TTL_MS) {
    return exchangeInfoCache.data;
  }
  const data = await publicFuturesRequest("/fapi/v1/exchangeInfo");
  exchangeInfoCache = { data, fetchedAt: Date.now() };
  return data;
}

export async function getSymbolFilters(symbol) {
  const info = await getExchangeInfo();
  const sym = (info.symbols || []).find((s) => s.symbol === symbol);
  if (!sym) throw new Error(`알 수 없는 심볼: ${symbol}`);

  const lot = sym.filters.find((f) => f.filterType === "LOT_SIZE") || {};
  const price = sym.filters.find((f) => f.filterType === "PRICE_FILTER") || {};
  const notional =
    sym.filters.find((f) => f.filterType === "MIN_NOTIONAL") ||
    sym.filters.find((f) => f.filterType === "NOTIONAL") ||
    {};

  return {
    stepSize: Number(lot.stepSize) || 0.001,
    minQty: Number(lot.minQty) || 0,
    tickSize: Number(price.tickSize) || 0.0001,
    minNotional: Number(notional.notional ?? notional.minNotional) || 5,
    quantityPrecision: Number(sym.quantityPrecision) || 0,
    pricePrecision: Number(sym.pricePrecision) || 0,
  };
}

/** 소수 step 단위로 내림(수량/가격 정밀도 규칙 준수) */
export function roundToStep(value, step, precision) {
  if (!step) return value;
  const rounded = Math.floor(value / step) * step;
  const p = precision != null ? precision : Math.max(0, String(step).split(".")[1]?.length || 0);
  return Number(rounded.toFixed(p));
}

export function roundToTick(value, tick, precision) {
  return roundToStep(value, tick, precision);
}

/**
 * 심볼의 마진 타입(ISOLATED/CROSSED) 설정. 이미 같은 타입이면 -4046 에러가 나는데
 * 이는 정상 상태이므로 무시한다.
 */
export async function setMarginType(symbol, marginType = "ISOLATED") {
  try {
    await signedRequest(FUTURES_BASE, "/fapi/v1/marginType", "POST", { symbol, marginType });
  } catch (err) {
    if (err.code === -4046) return; // 이미 해당 마진타입 — 정상
    throw err;
  }
}

/** 심볼의 레버리지 설정 */
export async function setLeverage(symbol, leverage) {
  return signedRequest(FUTURES_BASE, "/fapi/v1/leverage", "POST", {
    symbol,
    leverage: String(Math.max(1, Math.round(leverage))),
  });
}

/** 시장가 진입/청산 주문 */
export async function placeMarketOrder({ symbol, side, quantity, reduceOnly = false, clientOrderId }) {
  const params = {
    symbol,
    side, // "BUY" | "SELL"
    type: "MARKET",
    quantity: String(quantity),
  };
  if (reduceOnly) params.reduceOnly = "true";
  if (clientOrderId) params.newClientOrderId = clientOrderId;
  return signedRequest(FUTURES_BASE, "/fapi/v1/order", "POST", params);
}

/** 전량 청산용 익절 주문 (closePosition=true 라 수량 지정 불필요) */
export async function placeTakeProfitMarketOrder({ symbol, side, stopPrice, clientOrderId }) {
  return signedRequest(FUTURES_BASE, "/fapi/v1/order", "POST", {
    symbol,
    side,
    type: "TAKE_PROFIT_MARKET",
    stopPrice: String(stopPrice),
    closePosition: "true",
    workingType: "MARK_PRICE",
    newClientOrderId: clientOrderId,
  });
}

/** 전량 청산용 손절 주문 (closePosition=true 라 수량 지정 불필요) */
export async function placeStopMarketOrder({ symbol, side, stopPrice, clientOrderId }) {
  return signedRequest(FUTURES_BASE, "/fapi/v1/order", "POST", {
    symbol,
    side,
    type: "STOP_MARKET",
    stopPrice: String(stopPrice),
    closePosition: "true",
    workingType: "MARK_PRICE",
    newClientOrderId: clientOrderId,
  });
}

/** 심볼의 미체결 주문 전체 취소 (재진입/재설정 전 잔여 주문 정리용) */
export async function cancelAllOpenOrders(symbol) {
  return signedRequest(FUTURES_BASE, "/fapi/v1/allOpenOrders", "DELETE", { symbol });
}

/** 심볼의 현재 미체결 주문 목록 (TP/SL 보호주문이 살아있는지 확인하는 용도) */
export async function getOpenOrders(symbol) {
  return signedRequest(FUTURES_BASE, "/fapi/v1/openOrders", "GET", symbol ? { symbol } : {});
}

/** 공개 API로 현재가만 조회 (모의 포지션의 시뮬레이션 PnL 계산용) */
export async function getMarkPrice(symbol) {
  const data = await publicFuturesRequest("/fapi/v1/ticker/price", { symbol });
  return Number(data.price) || 0;
}

/** 실현손익(REALIZED_PNL) 등 income 이력 조회 */
export async function getIncomeHistory({ startTime, endTime, incomeType = "REALIZED_PNL", limit = 1000 } = {}) {
  const params = { incomeType, limit: String(limit) };
  if (startTime) params.startTime = String(startTime);
  if (endTime) params.endTime = String(endTime);
  return signedRequest(FUTURES_BASE, "/fapi/v1/income", "GET", params);
}
