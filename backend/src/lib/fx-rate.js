const FX_URL = "https://open.er-api.com/v6/latest/USD";

let cache = { dateKey: null, rate: null, updatedAt: null };

function kstDateKey(d = new Date()) {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * USD→KRW 환율. KST 날짜 기준 하루 한 번만 새로 받아오고,
 * 갱신에 실패하면 직전에 받아둔 값을 그대로 쓴다.
 */
export async function getUsdKrwRate() {
  const today = kstDateKey();
  if (cache.rate && cache.dateKey === today) return cache;

  try {
    const res = await fetch(FX_URL);
    if (!res.ok) throw new Error(`환율 API 오류 (${res.status})`);
    const data = await res.json();
    const rate = Number(data?.rates?.KRW);
    if (data?.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("환율 응답 형식이 올바르지 않습니다.");
    }
    cache = {
      dateKey: today,
      rate,
      updatedAt: data.time_last_update_unix ? new Date(data.time_last_update_unix * 1000).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[fx] USD/KRW 환율 갱신 실패:", err.message);
    if (!cache.rate) throw err;
  }
  return cache;
}
