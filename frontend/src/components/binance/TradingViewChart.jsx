const INTERVAL_MAP = { "1S": "1", "1M": "1", "5M": "5", "30M": "30", "1H": "60", "1D": "D", "1W": "W" };

export default function TradingViewChart({ symbol, timeframe = "1M" }) {
  const cleanSymbol = (symbol || "BTCUSDT").toUpperCase();
  const tvSymbol = `BINANCE:${cleanSymbol}.P`;
  const interval = INTERVAL_MAP[timeframe] || "1";

  const iframeSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FSeoul&withdateranges=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=kr&utm_source=gwon.run`;

  return (
    <div className="b-chart-frame">
      <iframe
        key={`${tvSymbol}-${interval}`}
        title={`TradingView Chart ${tvSymbol}`}
        src={iframeSrc}
        className="b-chart-iframe"
        allowTransparency="true"
        scrolling="no"
        allowFullScreen
      />
    </div>
  );
}
