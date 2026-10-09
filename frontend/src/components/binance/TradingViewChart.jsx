export default function TradingViewChart({ symbol, interval = "60" }) {
  const pair = String(symbol || "BTCUSDT").replace(/[^A-Z0-9]/gi, "") || "BTCUSDT";
  const tvSymbol = `BINANCE:${pair}.P`;
  const src =
    "https://s.tradingview.com/widgetembed/?" +
    new URLSearchParams({
      symbol: tvSymbol,
      interval: String(interval),
      hidesidetoolbar: "0",
      hidetoptoolbar: "1",
      symboledit: "0",
      saveimage: "0",
      toolbarbg: "0c0c0e",
      theme: "dark",
      style: "1",
      timezone: "Asia/Seoul",
      withdateranges: "0",
      hideideas: "1",
      locale: "kr",
      hide_legend: "0",
    }).toString();

  return (
    <div className="b-tvstage">
      <iframe className="b-tv" title={`${pair} chart`} src={src} loading="lazy" />
    </div>
  );
}
