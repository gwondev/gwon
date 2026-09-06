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
async function signedRequest(baseUrl, path, method = "GET", params = {}, isRetry = false) {
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
