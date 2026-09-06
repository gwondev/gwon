const TIMEFRAMES = ["1S", "1M", "5M", "30M", "1H", "1D", "1W"];

export default function TimeframeSelector({ value, onChange }) {
  return (
    <div className="b-timeframe">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          className={`b-timeframe__btn ${value === tf ? "is-active" : ""}`}
          onClick={() => onChange(tf)}
          title={
            tf === "1S"
              ? "초봉은 TradingView 무료 임베드에서 지원되지 않아 1분봉으로 표시됩니다."
              : undefined
          }
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
