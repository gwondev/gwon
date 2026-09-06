export default function OpportunityList({ items, loading, onRefresh }) {
  return (
    <section className="b-section b-opportunity-section">
      <div className="b-section__header">
        <div>
          <h2 className="b-section__title">통합 기회 점수 (롱/숏 통합)</h2>
          <span className="b-section__desc">
            점수 산정 기준은 아래 규칙 패널에서 자유롭게 수정할 수 있습니다.
          </span>
        </div>
        <button type="button" className="b-btn b-btn--refresh" onClick={onRefresh}>
          ↻ 새로고침
        </button>
      </div>

      <div className="b-card b-table-card">
        {loading ? (
          <div className="b-loading-box">기회 점수 계산 중...</div>
        ) : !items?.length ? (
          <div className="b-empty-box">표시할 후보가 없습니다.</div>
        ) : (
          <div className="b-table-wrap">
            <table className="b-table">
              <thead>
                <tr>
                  <th>심볼</th>
                  <th>방향</th>
                  <th>현재가</th>
                  <th className="b-col-hide-sm">24h 변동률</th>
                  <th className="b-col-hide-sm">거래대금</th>
                  <th>기회 점수</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.symbol} className="b-row">
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
                      <div className="b-score-bar-wrap">
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
