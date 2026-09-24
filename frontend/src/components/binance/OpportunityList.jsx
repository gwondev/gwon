const TOP_N = 20;

export default function OpportunityList({ items, loading, onRefresh }) {
  const top20 = (items || []).slice(0, TOP_N);

  return (
    <section className="b-section b-opportunity-section">
      <div className="b-section__header">
        <div>
          <h2 className="b-section__title">포지션 진입 상위 {TOP_N}개</h2>
          <span className="b-section__desc">
            롱/숏 통합 기회 점수 랭킹 — 기준은 아래 "기회 점수 산정 기준"에서 자유롭게 수정할 수 있습니다.
          </span>
        </div>
        <button type="button" className="b-btn b-btn--refresh" onClick={onRefresh}>
          ↻ 새로고침
        </button>
      </div>

      <div className="b-card b-table-card">
        {loading ? (
          <div className="b-loading-box">기회 점수 계산 중...</div>
        ) : !top20.length ? (
          <div className="b-empty-box">표시할 후보가 없습니다.</div>
        ) : (
          <div className="b-table-wrap">
            <table className="b-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>심볼</th>
                  <th>방향</th>
                  <th>현재가</th>
                  <th className="b-col-hide-sm">24h 변동률</th>
                  <th className="b-col-hide-sm">거래대금</th>
                  <th>기회 점수</th>
                </tr>
              </thead>
              <tbody>
                {top20.map((it, i) => (
                  <tr key={it.symbol} className={`b-row ${i === 0 ? "is-rank1" : ""}`}>
                    <td className="b-td-rank">{i + 1}</td>
                    <td className="b-td-sym">
                      <strong>{it.symbol}</strong>
                    </td>
                    <td>
                      <span className={`b-side-badge is-${(it.side || "").toLowerCase()}`}>{it.side}</span>
                    </td>
                    <td className="b-td-num">{it.lastPrice}</td>
                    <td
                      className={`b-td-num b-col-hide-sm ${
                        it.priceChangePercent >= 0 ? "is-profit" : "is-loss"
                      }`}
                    >
                      {it.priceChangePercent >= 0 ? "+" : ""}
                      {it.priceChangePercent}%
                    </td>
                    <td className="b-td-num b-td-dim b-col-hide-sm">{it.volumeFormatted}</td>
                    <td>
                      <div className={`b-score-bar-wrap ${it.side === "SHORT" ? "is-short" : "is-long"}`}>
                        <div className="b-score-bar" style={{ width: `${it.score}%` }} />
                        <span className="b-score-text">{it.score}점</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
