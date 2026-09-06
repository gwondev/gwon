import pool from "../db.js";
import { askGemini } from "./gemini.js";

const RSS_FEEDS = [
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cointelegraph.com/rss",
];

const NEWS_SUMMARY_SYSTEM_PROMPT = `당신은 암호화폐 선물시장 트레이더를 위한 뉴스 브리핑 어시스턴트입니다.
주어진 오늘자 헤드라인 목록을 읽고, 시장 전반의 롱/숏 심리에 영향을 줄 만한 내용 위주로
5~8문장 이내 한국어로 요약하세요. 특정 코인/섹터에 대한 호재/악재는 코인명을 명시해서 언급하세요.
과장하지 말고 사실 위주로 간결하게 작성하세요.`;

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function parseRssTitles(xmlText, limit = 15) {
  const items = [...xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
  return items
    .map((m) => {
      const raw = m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1];
      return raw?.trim();
    })
    .filter(Boolean);
}

async function fetchHeadlines() {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((url) => fetch(url, { signal: AbortSignal.timeout(10000) }).then((r) => r.text()))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? parseRssTitles(r.value) : []));
}

export async function loadTodayNewsDigest() {
  const [rows] = await pool.query("SELECT * FROM binance_news_digest WHERE id = 1");
  return rows[0] || null;
}

/** 오늘(KST) 아직 갱신 안 됐으면 RSS 수집 + Gemini 요약 후 저장. 이미 갱신됐으면 아무 것도 안 함. */
export async function refreshNewsDigestIfStale() {
  const today = todayKST();
  const existing = await loadTodayNewsDigest();
  if (existing?.digest_date === today) return existing;

  const headlines = await fetchHeadlines();
  if (!headlines.length) {
    console.warn("[binance-news] RSS 수집 실패 — 이번 주기 갱신 스킵");
    return existing;
  }

  let summary;
  try {
    summary = await askGemini({
      system: NEWS_SUMMARY_SYSTEM_PROMPT,
      message: headlines.join("\n"),
    });
  } catch (err) {
    console.error("[binance-news] Gemini 요약 실패:", err.message);
    return existing;
  }

  await pool.query(
    `INSERT INTO binance_news_digest (id, digest_date, summary_text, source_count, raw_headlines)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       digest_date = VALUES(digest_date),
       summary_text = VALUES(summary_text),
       source_count = VALUES(source_count),
       raw_headlines = VALUES(raw_headlines)`,
    [today, summary, headlines.length, JSON.stringify(headlines)]
  );
  console.log(`[binance-news] 뉴스 요약 갱신 완료 (${headlines.length}건)`);
  return loadTodayNewsDigest();
}

let newsTimer = null;

/** 서버 부팅 시 1회 호출 — 매시 정각마다 "오늘 이미 갱신됐는지" 체크하며 하루 1회만 실제 갱신한다. */
export function startNewsDigestScheduler() {
  if (newsTimer) return;
  refreshNewsDigestIfStale().catch((err) => console.error("[binance-news] 초기 갱신 실패:", err.message));
  newsTimer = setInterval(() => {
    refreshNewsDigestIfStale().catch((err) => console.error("[binance-news] 정기 갱신 실패:", err.message));
  }, 60 * 60 * 1000);
}
