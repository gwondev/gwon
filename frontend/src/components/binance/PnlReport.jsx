import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const PERIODS = [
  { id: "1d", label: "1일" },
  { id: "1w", label: "1주" },
  { id: "1m", label: "1개월" },
  { id: "3m", label: "3개월" },
  { id: "all", label: "전체" },
];

function num(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(v, digits = 2) {
  const n = Number(v) || 0;
  return `${n > 0 ? "+" : ""}${num(n, digits)}`;
}

function tone(v) {
  const n = Number(v) || 0;
  return n > 0 ? "is-up" : n < 0 ? "is-down" : "";
}

function shortDate(key) {
  return key ? key.slice(5).replace("-", ".") : "";
}

function when(ms) {
  return new Date(Number(ms)).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function coin(symbol) {
  return String(symbol || "-").replace(/USDT$/, "");
}

function Kpi({ label, value, sub, className = "" }) {
  return (
    <div className="b-rep__kpi">
      <span>{label}</span>
      <strong className={className}>{value}</strong>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function EquityChart({ days }) {
  const [hover, setHover] = useState(null);
  const geo = useMemo(() => {
    if (!days?.length) return null;
    const cum = days.map((d) => d.cumulative);
    const nets = days.map((d) => d.net);
    const lo = Math.min(0, ...cum);
    const hi = Math.max(0, ...cum);
    const span = hi - lo || 1;
    const n = days.length;
    const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
    const y = (v) => 6 + (1 - (v - lo) / span) * 88;
    const line = cum.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
    const area = `${line} L${x(n - 1).toFixed(2)},${y(lo).toFixed(2)} L${x(0).toFixed(2)},${y(lo).toFixed(2)} Z`;
    const maxAbs = Math.max(...nets.map((v) => Math.abs(v)), 1e-9);
    return { line, area, zero: y(0), lo, hi, maxAbs, n };
  }, [days]);

  if (!geo) return <p className="b-muted">이 기간에는 손익 기록이 없습니다.</p>;
  const up = days[days.length - 1].cumulative >= 0;
  const color = up ? "#d8c19a" : "#f87171";
  const h = hover != null ? days[hover] : days[days.length - 1];

  return (
    <div className="b-rep__equity">
      <div className="b-rep__readout">
        <span>{h.date}</span>
        <span>
          일 손익 <b className={tone(h.net)}>{signed(h.net)}</b>
        </span>
        <span>
          실현 <b className={tone(h.realized)}>{signed(h.realized)}</b>
        </span>
        <span>
          수수료·펀딩 <b className={tone(h.fees)}>{signed(h.fees)}</b>
        </span>
        <span>
          누적 <b className={tone(h.cumulative)}>{signed(h.cumulative)}</b>
        </span>
      </div>
      <div className="b-rep__plot">
        <div className="b-rep__axis">
          <span>{num(geo.hi)}</span>
          <span>{num(geo.lo)}</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="b-rep__svg">
          <defs>
            <linearGradient id="bRepFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1="0" x2="100" y1={geo.zero} y2={geo.zero} className="b-rep__zero" vectorEffect="non-scaling-stroke" />
          <path d={geo.area} fill="url(#bRepFill)" />
          <path d={geo.line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="b-rep__hits" style={{ gridTemplateColumns: `repeat(${geo.n}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <i key={d.date} className={hover === i ? "is-on" : ""} onMouseEnter={() => setHover(i)} />
          ))}
        </div>
      </div>
      <div
        className="b-rep__bars"
        style={{ gridTemplateColumns: `repeat(${geo.n}, minmax(0, 1fr))`, gap: geo.n > 90 ? 0 : undefined }}
      >
        {days.map((d, i) => (
          <span key={d.date} className={hover === i ? "is-on" : ""} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i
              className={d.net >= 0 ? "is-up" : "is-down"}
              style={{ height: `${(Math.abs(d.net) / geo.maxAbs) * 100}%` }}
            />
          </span>
        ))}
      </div>
      <div className="b-rep__dates">
        <span>{shortDate(days[0].date)}</span>
        <span>{shortDate(days[Math.floor((days.length - 1) / 2)].date)}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default function PnlReport({ token }) {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (p) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const res = await api(`/binance/pnl-report?period=${encodeURIComponent(p)}`, { token });
        setData(res.ok ? res : null);
        if (!res.ok) setError(res.error || "수익금 리포트를 불러오지 못했습니다.");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load(period);
  }, [period, load]);

  const s = data?.summary;
  const attrTotal = data ? Math.abs(data.attribution.manual) + Math.abs(data.attribution.bot) : 0;

  return (
    <div className="b-rep">
      <header className="b-rep__head">
        <div>
          <p className="b-card__kicker">순수익 {data ? `· ${data.rangeFrom} ~ ${data.rangeTo}` : ""}</p>
          <strong className={`b-rep__net ${tone(s?.net)}`}>
            {s ? signed(s.net) : "-"}
            <small>USDT</small>
          </strong>
          {s?.returnPct != null && (
            <span className={`b-rep__ret ${tone(s.returnPct)}`}>
              {signed(s.returnPct)}% <em>기간 시작 자산 대비</em>
            </span>
          )}
        </div>
        <div className="b-seg">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className={period === p.id ? "is-on" : ""} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="b-err">{error}</p>}
      {!data && loading && <p className="b-muted">불러오는 중…</p>}

      {s && (
        <>
          <section className="b-rep__kpis">
            <Kpi label="실현손익" value={signed(s.realized)} className={tone(s.realized)} />
            <Kpi label="수수료" value={signed(s.commission)} className={tone(s.commission)} />
            <Kpi label="펀딩비" value={signed(s.funding)} className={tone(s.funding)} />
            <Kpi label="현재 총자산" value={num(s.currentAsset)} sub="USDT" />
            <Kpi
              label="승률"
              value={s.winRate == null ? "-" : `${num(s.winRate, 1)}%`}
              sub={`청산 ${s.closes}건 · 익절 ${s.wins} · 손절 ${s.losses}`}
            />
            <Kpi label="손익비 (Profit Factor)" value={s.profitFactor == null ? "-" : num(s.profitFactor, 2)} sub="총익절 ÷ 총손절" />
            <Kpi label="평균 익절 / 손절" value={`${signed(s.avgWin)} / ${signed(s.avgLoss)}`} />
            <Kpi label="최대 낙폭" value={s.maxDrawdown ? `-${num(s.maxDrawdown)}` : "0.00"} className={s.maxDrawdown ? "is-down" : ""} sub="누적 고점 대비" />
            <Kpi label="수익일 / 손실일" value={`${s.profitDays} / ${s.lossDays}`} />
            <Kpi
              label="최고의 날"
              value={s.bestDay ? signed(s.bestDay.net) : "-"}
              className={tone(s.bestDay?.net)}
              sub={s.bestDay?.date}
            />
            <Kpi
              label="최악의 날"
              value={s.worstDay ? signed(s.worstDay.net) : "-"}
              className={tone(s.worstDay?.net)}
              sub={s.worstDay?.date}
            />
            <Kpi
              label="최고 / 최악 청산"
              value={s.bestClose ? `${signed(s.bestClose.pnl)} / ${signed(s.worstClose?.pnl)}` : "-"}
              sub={s.bestClose ? `${coin(s.bestClose.symbol)} / ${coin(s.worstClose?.symbol)}` : ""}
            />
          </section>

          <section className="b-card b-rep__card">
            <div className="b-card__head">
              <p className="b-card__kicker">누적 수익 곡선 · 일별 손익</p>
              {loading && <span className="b-muted">갱신 중…</span>}
            </div>
            <EquityChart days={data.days} />
          </section>

          <div className="b-rep__grid">
            <section className="b-card b-rep__card">
              <div className="b-card__head">
                <p className="b-card__kicker">코인별 손익</p>
              </div>
              {data.symbols.length ? (
                <div className="b-rep__tablewrap">
                  <table className="b-rep__table">
                    <thead>
                      <tr>
                        <th>코인</th>
                        <th>순손익</th>
                        <th>실현</th>
                        <th>수수료</th>
                        <th>펀딩</th>
                        <th>청산</th>
                        <th>승률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.symbols.map((r) => (
                        <tr key={r.symbol}>
                          <td className="b-sym">{coin(r.symbol)}</td>
                          <td className={tone(r.net)}>{signed(r.net)}</td>
                          <td className={tone(r.realized)}>{signed(r.realized)}</td>
                          <td>{signed(r.commission)}</td>
                          <td>{signed(r.funding)}</td>
                          <td>{r.closes}</td>
                          <td>{r.winRate == null ? "-" : `${num(r.winRate, 0)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="b-muted">기록 없음</p>
              )}
            </section>

            <section className="b-card b-rep__card">
              <div className="b-card__head">
                <p className="b-card__kicker">수동 vs 봇</p>
              </div>
              <div className="b-rep__attr">
                {[
                  { id: "manual", label: "수동 매매", v: data.attribution.manual },
                  { id: "bot", label: "봇", v: data.attribution.bot },
                ].map((a) => (
                  <div key={a.id}>
                    <span>{a.label}</span>
                    <strong className={tone(a.v)}>{signed(a.v)}</strong>
                    <i>
                      <b
                        className={a.v >= 0 ? "is-up" : "is-down"}
                        style={{ width: `${attrTotal ? (Math.abs(a.v) / attrTotal) * 100 : 0}%` }}
                      />
                    </i>
                  </div>
                ))}
              </div>

              <div className="b-card__head b-rep__subhead">
                <p className="b-card__kicker">최근 청산 체결</p>
              </div>
              {data.recentCloses.length ? (
                <div className="b-rep__tablewrap b-rep__tablewrap--tall">
                  <table className="b-rep__table">
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>코인</th>
                        <th>구분</th>
                        <th>실현손익</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentCloses.map((c, i) => (
                        <tr key={`${c.time}-${i}`}>
                          <td>{when(c.time)}</td>
                          <td className="b-sym">{coin(c.symbol)}</td>
                          <td>{c.attribution === "BOT" ? "봇" : "수동"}</td>
                          <td className={tone(c.pnl)}>{signed(c.pnl, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="b-muted">기록 없음</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
