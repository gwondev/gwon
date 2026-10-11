import { memo, useMemo } from "react";

function TradingViewChart({ symbol, interval = "60", levels = [] }) {
  const pair = String(symbol || "BTCUSDT").replace(/[^A-Z0-9]/gi, "") || "BTCUSDT";
  const src = useMemo(() => {
    const tvSymbol = `BINANCE:${pair}.P`;
    return (
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
      }).toString()
    );
  }, [pair, interval]);

  const rail = useMemo(() => {
    const rows = (levels || []).filter((l) => Number.isFinite(Number(l.price)) && Number(l.price) > 0);
    if (!rows.length) return [];
    const prices = rows.map((l) => Number(l.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.18 || Math.max(max * 0.002, 1);
    const lo = min - pad;
    const hi = max + pad;
    const span = hi - lo || 1;
    return rows
      .map((l) => ({
        ...l,
        y: ((hi - Number(l.price)) / span) * 100,
      }))
      .sort((a, b) => a.y - b.y);
  }, [levels]);

  return (
    <div className="b-tvstage">
      <iframe className="b-tv" title={`${pair} chart`} src={src} />
      {!!rail.length && (
        <aside className="b-tvrail" aria-label="포지션 위치">
          {rail.map((l) => (
            <div key={l.id} className={`b-tvrail__row is-${l.kind}`} style={{ top: `${l.y}%` }}>
              <i />
              <b>{l.label}</b>
              <strong>{l.priceText}</strong>
              {l.timeText ? <em>{l.timeText}</em> : null}
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

export default memo(TradingViewChart);
