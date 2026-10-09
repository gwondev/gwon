import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TradingViewChart from "../components/binance/TradingViewChart";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./BinancePage.css";

const PERIODS = [
  { id: "1d", label: "1일" },
  { id: "1w", label: "1주" },
  { id: "1m", label: "1개월" },
  { id: "3m", label: "3개월" },
  { id: "all", label: "전체" },
];

const HORIZONS = [
  { id: "scalp", label: "초단기", interval: "5" },
  { id: "1d", label: "1일", interval: "15" },
  { id: "week", label: "7일", interval: "240" },
  { id: "month", label: "한달", interval: "D" },
];

const LEVERS = [1, 2, 3, 5, 10];

const DEFAULT_RULES = {
  horizon: "week",
  minSize: 72,
  safety: 70,
  leverage: 1,
  allowLong: true,
  allowShort: true,
};

const CHAT_CHIPS = ["지금 홀드?", "익절·손절 라인", "방향 바꿀까?"];

function formatNumber(v, digits) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPct(v) {
  const n = Number(v) || 0;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function liqDistance(p) {
  const mark = Number(p?.markPrice);
  const liq = Number(p?.liquidationPrice);
  if (!mark || !liq) return null;
  const dist = p.side === "SHORT" ? ((liq - mark) / mark) * 100 : ((mark - liq) / mark) * 100;
  return Number.isFinite(dist) ? dist : null;
}

function parseRules(raw) {
  if (!raw) return { ...DEFAULT_RULES };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.horizon) {
      const horizon = parsed.horizon === "short" ? "scalp" : parsed.horizon === "swing" ? "month" : parsed.horizon;
      return {
        ...DEFAULT_RULES,
        ...parsed,
        horizon,
        safety: Number(parsed.safety ?? parsed.shortSafety) || DEFAULT_RULES.safety,
        leverage: Number(parsed.leverage) || 1,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_RULES };
}

function stripMd(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`+/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function formatBucket(ms) {
  return new Date(ms).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\s/g, "");
}

function PnlChart({ points, total }) {
  const { path, area, min, max } = useMemo(() => {
    const vals = (points || []).map((p) => p.cumulative);
    if (!vals.length) return { path: "", area: "", min: 0, max: 0 };
    const minV = Math.min(0, ...vals);
    const maxV = Math.max(0, ...vals);
    const span = maxV - minV || 1;
    const xy = vals.map((v, i) => {
      const x = vals.length === 1 ? 50 : (i / (vals.length - 1)) * 100;
      const y = 8 + (1 - (v - minV) / span) * 84;
      return [x, y];
    });
    const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    const last = xy[xy.length - 1];
    const first = xy[0];
    return { path: d, area: `${d} L${last[0].toFixed(2)},100 L${first[0].toFixed(2)},100 Z`, min: minV, max: maxV };
  }, [points]);

  const up = total >= 0;
  if (!points?.length) return <div className="b-chart__empty">실현손익 기록이 없습니다.</div>;
  return (
    <div className="b-chart__plot">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="b-chart__svg">
        <defs>
          <linearGradient id="bPnlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#d8c19a" : "#f87171"} stopOpacity="0.32" />
            <stop offset="100%" stopColor={up ? "#d8c19a" : "#f87171"} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bPnlFill)" />
        <path d={path} fill="none" stroke={up ? "#d8c19a" : "#f87171"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="b-chart__axis">
        <span>{formatNumber(max, 2)}</span>
        <span>{formatNumber(min, 2)}</span>
      </div>
    </div>
  );
}

export default function BinancePage() {
  const { isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();
  const chatLog = useRef(null);
  const [asset, setAsset] = useState(null);
  const [positions, setPositions] = useState([]);
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT");
  const [picks, setPicks] = useState(null);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [period, setPeriod] = useState("1w");
  const [chart, setChart] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "포지션과 대형 코인 기준으로 짧게 제안합니다." },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pickError, setPickError] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthed || !isSuperAdmin)) navigate("/", { replace: true });
  }, [authLoading, isAuthed, isSuperAdmin, navigate]);

  const tvInterval = HORIZONS.find((h) => h.id === rules.horizon)?.interval || "240";

  const loadAsset = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/total-asset", { token });
      if (data.ok) {
        setAsset(data);
        setError("");
      } else setError(data.error || "총자산을 불러오지 못했습니다.");
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const loadPositions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/positions", { token });
      const list = Array.isArray(data.positions) ? data.positions : [data.manual, data.bot].filter(Boolean);
      setPositions(list);
      setActiveSymbol((cur) => {
        if (list.some((p) => p.symbol === cur)) return cur;
        return list[0]?.symbol || "BTCUSDT";
      });
    } catch {
      setPositions([]);
    }
  }, [token]);

  const loadBot = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/bot", { token });
      setRules(parseRules(data.settings?.scoringPrompt));
    } catch {
      /* keep default */
    }
  }, [token]);

  const loadPicks = useCallback(async (refresh = false) => {
    if (!token) return;
    setPickError("");
    try {
      const data = await api(`/binance/picks${refresh ? "?refresh=1" : ""}`, { token });
      setPicks(data);
      if (!data.ok) setPickError(data.error || "추천 실패");
      else if (data.error) setPickError("규칙 점수로 추천합니다.");
    } catch (err) {
      setPickError(err.message);
    }
  }, [token]);

  const loadChart = useCallback(async (p) => {
    if (!token) return;
    try {
      const data = await api(`/binance/pnl-chart?period=${encodeURIComponent(p)}`, { token });
      setChart(data.ok ? data : { points: [], total: 0, period: p });
    } catch {
      setChart({ points: [], total: 0, period: p });
    }
  }, [token]);

  const saveRules = async () => {
    setBusy("save");
    setPickError("");
    try {
      await api("/binance/bot", { method: "PUT", token, body: { scoringPrompt: JSON.stringify(rules) } });
      await loadPicks(true);
    } catch (err) {
      setPickError(err.message);
    } finally {
      setBusy("");
    }
  };

  const sendChat = async (text) => {
    const message = (text || draft).trim();
    if (!message || busy === "ai") return;
    const next = [...messages, { role: "user", text: message }];
    setMessages(next);
    setDraft("");
    setBusy("ai");
    try {
      const history = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.text }));
      const data = await api("/binance/position-advice", {
        method: "POST",
        token,
        body: {
          message,
          history,
          picks: (picks?.picks || []).map((p) => ({
            symbol: p.symbol,
            side: p.side,
            marketCapFormatted: p.marketCapFormatted,
          })),
        },
      });
      setMessages([...next, { role: "assistant", text: stripMd(data.analysis || data.error || "응답이 비었습니다.") }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", text: err.message }]);
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    const el = chatLog.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    loadAsset();
    loadPositions();
    loadBot();
    loadPicks(false);
    const timer = setInterval(() => {
      loadAsset();
      loadPositions();
    }, 30000);
    return () => clearInterval(timer);
  }, [token, isSuperAdmin, loadAsset, loadPositions, loadBot, loadPicks]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    loadChart(period);
  }, [token, isSuperAdmin, period, loadChart]);

  if (authLoading || !isAuthed || !isSuperAdmin) return null;

  const active = positions.find((p) => p.symbol === activeSymbol) || positions[0] || null;
  const chartSymbol = active?.symbol || activeSymbol;
  const fut = asset?.futures;

  return (
    <main className="page binance-page">
      <div className="b-shell">
        <section className="b-card b-asset">
          <p className="b-card__kicker">총자산</p>
          {asset ? (
            <>
              <div className="b-asset__hero">
                <strong>
                  {formatNumber(asset.totalUsdt, 2)}
                  <small>USDT</small>
                </strong>
                {asset.totalKrw != null && <span>≈ {formatNumber(asset.totalKrw, 0)}원</span>}
              </div>
              <div className="b-facts b-facts--3">
                <div>
                  <span>지갑</span>
                  <strong>{formatNumber(fut?.wallet, 2)}</strong>
                </div>
                <div>
                  <span>가용</span>
                  <strong>{formatNumber(fut?.available, 2)}</strong>
                </div>
                <div>
                  <span>미실현</span>
                  <strong className={(fut?.unrealized || 0) >= 0 ? "is-up" : "is-down"}>{formatNumber(fut?.unrealized, 2)}</strong>
                </div>
              </div>
              {positions.length ? (
                <div className="b-mini">
                  {positions.map((p) => {
                    const on = p.symbol === chartSymbol;
                    const up = Number(p.unRealizedProfit) >= 0;
                    return (
                      <button key={`${p.symbol}-${p.side}`} type="button" className={on ? "is-on" : ""} onClick={() => setActiveSymbol(p.symbol)}>
                        <b>{p.symbol.replace("USDT", "")}</b>
                        <em className={`b-side is-${String(p.side).toLowerCase()}`}>{p.side === "LONG" ? "롱" : "숏"}</em>
                        <span className={up ? "is-up" : "is-down"}>{formatPct(p.roe)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="b-muted">열린 포지션 없음</p>
              )}
            </>
          ) : (
            !error && <p className="b-muted">불러오는 중…</p>
          )}
          {error && <p className="b-err">{error}</p>}
        </section>

        <section className="b-card b-pnl">
          <div className="b-chart__head">
            <div>
              <p className="b-card__kicker">수익률</p>
              <strong className={`b-total ${(chart?.total || 0) >= 0 ? "is-up" : "is-down"}`}>
                {(chart?.total || 0) >= 0 ? "+" : ""}
                {formatNumber(chart?.total || 0, 2)}
                <small>USDT</small>
              </strong>
            </div>
            <div className="b-seg">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" className={period === p.id ? "is-on" : ""} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="b-stats">
            <div>
              <span>실현</span>
              <strong className={(chart?.realized || 0) >= 0 ? "is-up" : "is-down"}>{formatNumber(chart?.realized || 0, 2)}</strong>
            </div>
            <div>
              <span>펀딩</span>
              <strong className={(chart?.funding || 0) >= 0 ? "is-up" : "is-down"}>{formatNumber(chart?.funding || 0, 2)}</strong>
            </div>
            <div>
              <span>수수료</span>
              <strong className={(chart?.commission || 0) >= 0 ? "is-up" : "is-down"}>{formatNumber(chart?.commission || 0, 2)}</strong>
            </div>
            <div>
              <span>건수</span>
              <strong>{chart?.trades || 0}</strong>
            </div>
          </div>
          <div className="b-pnl__body">
            <PnlChart points={chart?.points} total={chart?.total || 0} />
            {!!chart?.buckets?.length && (
              <ul className="b-buckets">
                {chart.buckets.map((b, i) => (
                  <li key={i}>
                    <span>{formatBucket(b.from)}</span>
                    <strong className={b.returnPct >= 0 ? "is-up" : "is-down"}>
                      {b.returnPct > 0 ? "+" : ""}
                      {Number(b.returnPct).toFixed(1)}%
                    </strong>
                    <em className={b.pnl >= 0 ? "is-up" : "is-down"}>
                      {b.pnl >= 0 ? "+" : ""}
                      {formatNumber(b.pnl, 1)}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="b-card b-desk">
          <div className="b-card__head">
            <p className="b-card__kicker">추천 기준 · 10</p>
            <div className="b-desk__acts">
              <button type="button" className="b-btn" disabled={busy === "save"} onClick={saveRules}>
                {busy === "save" ? "저장…" : "저장·추천"}
              </button>
              <button type="button" className="b-btn" onClick={() => loadPicks(true)}>
                새로고침
              </button>
            </div>
          </div>
          <div className="b-rules">
            <div className="b-rules__row">
              <span className="b-rules__lab">기간</span>
              <div className="b-seg">
                {HORIZONS.map((h) => (
                  <button key={h.id} type="button" className={rules.horizon === h.id ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, horizon: h.id }))}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">레버</span>
              <div className="b-seg">
                {LEVERS.map((n) => (
                  <button key={n} type="button" className={Number(rules.leverage) === n ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, leverage: n }))}>
                    {n}X
                  </button>
                ))}
              </div>
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">방향</span>
              <div className="b-seg">
                <button type="button" className={rules.allowLong ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, allowLong: !r.allowLong }))}>
                  롱
                </button>
                <button type="button" className={rules.allowShort ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, allowShort: !r.allowShort }))}>
                  숏
                </button>
              </div>
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">안전 {rules.safety}</span>
              <input type="range" min="40" max="100" value={rules.safety} onChange={(e) => setRules((r) => ({ ...r, safety: Number(e.target.value) }))} />
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">규모 {rules.minSize}</span>
              <input type="range" min="20" max="95" value={rules.minSize} onChange={(e) => setRules((r) => ({ ...r, minSize: Number(e.target.value) }))} />
            </div>
            {pickError && <p className="b-err">{pickError}</p>}
          </div>
          <ol className="b-picks__list">
            {(picks?.picks || []).map((row, i) => (
              <li key={`${row.symbol}-${row.side}-${i}`}>
                <button type="button" onClick={() => setActiveSymbol(row.symbol)}>
                  <span className="b-rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="b-sym">{row.symbol.replace("USDT", "")}</span>
                  <em className={`b-side is-${String(row.side).toLowerCase()}`}>{row.side === "LONG" ? "롱" : "숏"}</em>
                  <span className="b-mcap">{row.marketCapFormatted || "-"}</span>
                </button>
              </li>
            ))}
            {!picks?.picks?.length && <li className="b-muted">추천을 불러오는 중…</li>}
          </ol>
        </section>

        <section className="b-card b-trade">
          <div className="b-tvwrap__head">
            <p className="b-card__kicker">{chartSymbol.replace("USDT", "")} 차트</p>
            {active && (
              <div className="b-avg">
                <span>평단</span>
                <strong>{formatNumber(active.entryPrice, 4)}</strong>
                <span>마크 {formatNumber(active.markPrice, 4)}</span>
                <em className={`b-side is-${String(active.side).toLowerCase()}`}>
                  {active.side === "LONG" ? "롱" : "숏"} {active.leverage}X
                </em>
              </div>
            )}
          </div>
          <TradingViewChart symbol={chartSymbol} interval={tvInterval} />
          <div className="b-chat">
            <div className="b-chat__bar">
              <p className="b-card__kicker">AI 매매추천</p>
              <div className="b-seg b-chat__chips">
                {CHAT_CHIPS.map((c) => (
                  <button key={c} type="button" onClick={() => sendChat(c)} disabled={busy === "ai"}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="b-chat__log" ref={chatLog}>
              {messages.map((m, i) => (
                <div key={i} className={`b-chat__bubble is-${m.role}`}>
                  {m.text}
                </div>
              ))}
              {busy === "ai" && <div className="b-chat__bubble is-assistant">분석 중…</div>}
            </div>
            <form
              className="b-chat__form"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="포지션에 대해 물어보기" />
              <button type="submit" className="b-btn" disabled={busy === "ai"}>
                전송
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
