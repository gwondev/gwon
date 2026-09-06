import { useState } from "react";
import TradingViewChart from "./TradingViewChart";
import TimeframeSelector from "./TimeframeSelector";

export default function PositionPanel({ mode, data }) {
  const [timeframe, setTimeframe] = useState("1M");
  const label = mode === "manual" ? "내 수동 포지션" : "봇 자동 포지션";

  if (!data) {
    return (
      <section className={`b-pos-panel b-pos-panel--${mode} is-empty`}>
        <div className="b-pos-panel__head">
          <h3>{label}</h3>
        </div>
        <div className="b-pos-panel__empty">대기 중 — 현재 오픈된 포지션이 없습니다.</div>
      </section>
    );
  }

  return (
    <section className={`b-pos-panel b-pos-panel--${mode}`}>
      <div className="b-pos-panel__head">
        <div className="b-pos-panel__title-group">
          <span className={`b-side-badge is-${(data.side || "").toLowerCase()}`}>
            {data.side} {data.leverage}x
          </span>
          <strong className="b-pos-panel__symbol">{data.symbol}</strong>
          {data.isPaper && <span className="b-paper-badge">PAPER</span>}
        </div>
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      </div>

      <div className="b-pos-panel__metrics">
        <span>
          진입가: <strong>{data.entryPrice}</strong>
        </span>
        <span>
          현재가: <strong>{data.markPrice}</strong>
        </span>
        <span className={data.roe >= 0 ? "is-profit" : "is-loss"}>
          ROE: <strong>{data.roe >= 0 ? "+" : ""}{data.roe}%</strong>
        </span>
      </div>

      <div className="b-card b-chart-card">
        <TradingViewChart symbol={data.symbol} timeframe={timeframe} />
      </div>

      <p className="b-pos-panel__reason">{data.reasonText || `${label} — 사유 정보 없음`}</p>
    </section>
  );
}
