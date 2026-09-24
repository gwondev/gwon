import { motion, AnimatePresence } from "framer-motion";

function StatBlock({ label, value, tone }) {
  return (
    <div className={`b-spot-stat ${tone ? `is-${tone}` : ""}`}>
      <span className="b-spot-stat__label">{label}</span>
      <strong className="b-spot-stat__value">{value}</strong>
    </div>
  );
}

export default function TopPick({ best, runnersUp, loading }) {
  const isShort = best?.side === "SHORT";

  return (
    <section className="b-section b-spotlight-section">
      <div className="b-section__header">
        <div>
          <h2 className="b-section__title">🎯 지금 포지션 들어가기 가장 좋은 코인</h2>
          <span className="b-section__desc">기회 점수 1위 후보 — AI 스코어링 기준 실시간 갱신</span>
        </div>
      </div>

      {loading ? (
        <div className="b-card b-spotlight is-loading">
          <div className="b-loading-box">후보 스캔 중...</div>
        </div>
      ) : !best ? (
        <div className="b-card b-spotlight is-empty">
          <div className="b-empty-box">현재 조건을 만족하는 후보가 없습니다.</div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={best.symbol}
            className={`b-spotlight ${isShort ? "is-short" : "is-long"}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="b-spotlight__glow" aria-hidden />
            <div className="b-spotlight__top">
              <div className="b-spotlight__id">
                <span className={`b-side-badge is-${isShort ? "short" : "long"} b-spotlight__badge`}>
                  {best.side}
                </span>
                <h3 className="b-spotlight__symbol">{best.symbol}</h3>
              </div>
              <div className="b-spotlight__score">
                <div className="b-spotlight__score-ring" style={{ "--pct": `${best.score}%` }}>
                  <span className="b-spotlight__score-num">{best.score}</span>
                  <span className="b-spotlight__score-unit">SCORE</span>
                </div>
              </div>
            </div>

            <p className="b-spotlight__reason">“{best.reason}”</p>

            <div className="b-spotlight__stats">
              <StatBlock label="현재가" value={best.lastPrice} />
              <StatBlock
                label="24h 변동률"
                value={`${best.priceChangePercent >= 0 ? "+" : ""}${best.priceChangePercent}%`}
                tone={best.priceChangePercent >= 0 ? "profit" : "loss"}
              />
              <StatBlock label="거래대금" value={best.volumeFormatted} />
              <StatBlock label="펀딩비율" value={`${best.fundingRatePercent}%`} />
            </div>

            {runnersUp?.length > 0 && (
              <div className="b-spotlight__runners">
                <span className="b-spotlight__runners-label">다음 후보</span>
                <div className="b-spotlight__runners-list">
                  {runnersUp.map((it, i) => (
                    <span key={it.symbol} className="b-spotlight__runner">
                      <b>#{i + 2}</b> {it.symbol}
                      <em>{it.score}점 · {it.side}</em>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
