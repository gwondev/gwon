import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TradingViewChart from "../components/binance/TradingViewChart";
import PnlReport from "../components/binance/PnlReport";
import { useAuth } from "../context/AuthContext";
import { api, isQuietNetworkError } from "../lib/api";
import "./BinancePage.css";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "pnl", label: "수익금" },
  { id: "picks", label: "진입추천" },
];
const TAB_KEY = "gwon.binance.tab";
const TAB_IDS = TABS.map((t) => t.id);

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
  note: "",
};

const SUMMARY_CHIP = "전체 요약";
const ACTION_CHIP = "동작 추천";
const ENTRY_CHIP = "어디 들어갈까";
const ENTRY_ONE_CHIP = "이 코인 진입";
const LAST_SYMBOL_KEY = "gwon.binance.lastSymbol";

function readLastSymbol() {
  try {
    return localStorage.getItem(LAST_SYMBOL_KEY) || "";
  } catch {
    return "";
  }
}

function positionSize(p) {
  const notional = Math.abs(Number(p.notional) || 0);
  return notional || Math.abs((Number(p.positionAmt) || 0) * (Number(p.markPrice) || 0));
}

function formatWhen(ms) {
  const n = Number(ms);
  if (!n) return "";
  return new Date(n).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        note: String(parsed.note || ""),
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

export default function BinancePage() {
  const { isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();
  const chatLog = useRef(null);
  const entryLog = useRef(null);
  const symbolRef = useRef("");
  // 사용자가 직접 고른 심볼(추천 코인 등)은 포지션 목록에 없어도 유지한다.
  const userPickedRef = useRef(false);
  const loadedRef = useRef(false);
  const [asset, setAsset] = useState(null);
  const [positions, setPositions] = useState([]);
  const [positionsReady, setPositionsReady] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState(readLastSymbol);
  const [picks, setPicks] = useState(null);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return TAB_IDS.includes(saved) ? saved : "overview";
    } catch {
      return "overview";
    }
  });
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "차트와 지금 포지션을 보고 질문에 답합니다. 체결 전체가 필요하면 전체 요약을 누르세요.",
    },
  ]);
  const [entryMessages, setEntryMessages] = useState([
    {
      role: "assistant",
      text: "추천 리스트와 차트를 보고 어디를, 어느 가격에 들어갈지 답합니다. 이미 든 포지션 관리는 Overview에서 물어보세요.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [entryDraft, setEntryDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pickError, setPickError] = useState("");
  const [story, setStory] = useState(null);

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
      } else if (!isQuietNetworkError({ message: data.error, status: data.status })) {
        setError("");
      }
    } catch (err) {
      if (!isQuietNetworkError(err)) setError("");
    }
  }, [token]);

  // 실패하면 직전 포지션을 그대로 두고 false 를 돌려준다(일시 오류로 BTC 로 튀지 않게).
  const loadPositions = useCallback(async () => {
    if (!token) return false;
    try {
      const data = await api("/binance/positions", { token });
      if (data.ok === false) return false;
      const raw = Array.isArray(data.positions) ? data.positions : [data.manual, data.bot].filter(Boolean);
      const list = [...raw].sort((a, b) => positionSize(b) - positionSize(a));
      const firstLoad = !loadedRef.current;
      loadedRef.current = true;
      setPositions(list);
      setPositionsReady(true);
      setActiveSymbol((cur) => {
        if (firstLoad && !userPickedRef.current) return list[0]?.symbol || cur || "BTCUSDT";
        if (cur && (userPickedRef.current || list.some((p) => p.symbol === cur))) return cur;
        return list[0]?.symbol || cur || "BTCUSDT";
      });
      return true;
    } catch {
      return false;
    }
  }, [token]);

  const pickSymbol = useCallback((symbol, { fromPosition = false } = {}) => {
    userPickedRef.current = !fromPosition;
    setActiveSymbol(symbol);
  }, []);

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
      if (data.ok) {
        if (data.error && !isQuietNetworkError({ message: data.error })) {
          setPickError("");
        }
      }
    } catch (err) {
      if (!isQuietNetworkError(err)) setPickError("");
    }
  }, [token]);

  const loadStory = useCallback(async (symbol) => {
    if (!token || !symbol) {
      setStory(null);
      return;
    }
    try {
      const data = await api(`/binance/position-story?symbol=${encodeURIComponent(symbol)}`, { token });
      setStory(data.ok ? data : null);
    } catch {
      setStory(null);
    }
  }, [token]);

  const saveRules = async () => {
    setBusy("save");
    setPickError("");
    try {
      await api("/binance/bot", { method: "PUT", token, body: { scoringPrompt: JSON.stringify(rules) } });
      await loadPicks(true);
    } catch (err) {
      if (!isQuietNetworkError(err)) setPickError("");
    } finally {
      setBusy("");
    }
  };

  const askAdvice = async ({ message, history, mode, symbol }) => {
    const data = await api("/binance/position-advice", {
      method: "POST",
      token,
      body: {
        message,
        history,
        symbol: symbol || "",
        interval: tvInterval,
        mode,
        picks: (picks?.picks || []).map((p) => ({
          symbol: p.symbol,
          side: p.side,
          marketCapFormatted: p.marketCapFormatted,
          marketCapRank: p.marketCapRank,
          score: p.score,
        })),
      },
    });
    const reply = stripMd(data.analysis || "");
    return reply || (isQuietNetworkError({ message: data.error, status: data.status }) ? "잠시 연결이 불안정합니다. 다시 보내보세요." : "응답이 비었습니다.");
  };

  const sendChat = async (text, { summary = false, action = false } = {}) => {
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
      const reply = await askAdvice({
        message,
        history,
        mode: summary ? "summary" : action ? "action" : "ask",
        symbol: activeSymbol || positions[0]?.symbol || "",
      });
      setMessages([...next, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", text: isQuietNetworkError(err) ? "잠시 연결이 불안정합니다. 다시 보내보세요." : "지금은 답변을 만들지 못했습니다." },
      ]);
    } finally {
      setBusy("");
    }
  };

  const sendEntryChat = async (text, { scan = false, focus = false } = {}) => {
    const message = (text || entryDraft).trim();
    if (!message || busy === "entry") return;
    const next = [...entryMessages, { role: "user", text: message }];
    setEntryMessages(next);
    setEntryDraft("");
    setBusy("entry");
    try {
      const history = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.text }));
      const reply = await askAdvice({
        message,
        history,
        mode: scan ? "entry-scan" : focus ? "entry-focus" : "entry",
        symbol: activeSymbol || picks?.picks?.[0]?.symbol || "",
      });
      setEntryMessages([...next, { role: "assistant", text: reply }]);
    } catch (err) {
      setEntryMessages([
        ...next,
        { role: "assistant", text: isQuietNetworkError(err) ? "잠시 연결이 불안정합니다. 다시 보내보세요." : "지금은 답변을 만들지 못했습니다." },
      ]);
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
    const el = entryLog.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entryMessages, busy]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    let cancelled = false;
    loadAsset();
    loadBot();
    loadPicks(false);
    (async () => {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        if (await loadPositions()) return;
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
      if (!cancelled) {
        setPositionsReady(true);
        setActiveSymbol((cur) => cur || "BTCUSDT");
      }
    })();
    const timer = setInterval(() => {
      loadAsset();
      loadPositions();
      if (symbolRef.current) loadStory(symbolRef.current);
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, isSuperAdmin, loadAsset, loadPositions, loadBot, loadPicks, loadStory]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    symbolRef.current = activeSymbol;
    if (!activeSymbol) return;
    try {
      localStorage.setItem(LAST_SYMBOL_KEY, activeSymbol);
    } catch {
      /* ignore */
    }
    if (!token || !isSuperAdmin) return;
    loadStory(activeSymbol);
  }, [token, isSuperAdmin, activeSymbol, loadStory]);

  if (authLoading || !isAuthed || !isSuperAdmin) return null;

  const chartSymbol = activeSymbol || positions[0]?.symbol || "";
  const active = positions.find((p) => p.symbol === chartSymbol) || null;
  const fills = story?.symbol === chartSymbol ? story.story : null;
  const chartLevels = [];
  if (active) {
    chartLevels.push({
      id: "mark",
      kind: "mark",
      label: "현재",
      price: Number(active.markPrice),
      priceText: formatNumber(active.markPrice, 4),
    });
    chartLevels.push({
      id: "entry",
      kind: "entry",
      label: "평단",
      price: Number(active.entryPrice),
      priceText: formatNumber(active.entryPrice, 4),
      timeText: fills?.entry?.time ? formatWhen(fills.entry.time) : "",
    });
    if (fills?.lastAdd) {
      chartLevels.push({
        id: "add",
        kind: "add",
        label: "추매",
        price: Number(fills.lastAdd.price),
        priceText: formatNumber(fills.lastAdd.price, 4),
        timeText: formatWhen(fills.lastAdd.time),
      });
    }
    if (Number(active.liquidationPrice) > 0) {
      chartLevels.push({
        id: "liq",
        kind: "liq",
        label: "청산",
        price: Number(active.liquidationPrice),
        priceText: formatNumber(active.liquidationPrice, 4),
      });
    }
  }

  return (
    <main className="page binance-page">
      <nav className="b-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "pnl" ? (
        <PnlReport token={token} />
      ) : tab === "picks" ? (
      <div className="b-shell b-shell--picks">
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
          <div className="b-desk__body">
          <div className="b-rules">
            <div className="b-rules__row">
              <span className="b-rules__lab">기간</span>
              <div className="b-seg b-seg--spread">
                {HORIZONS.map((h) => (
                  <button key={h.id} type="button" className={rules.horizon === h.id ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, horizon: h.id }))}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">레버</span>
              <div className="b-seg b-seg--spread">
                {LEVERS.map((n) => (
                  <button key={n} type="button" className={Number(rules.leverage) === n ? "is-on" : ""} onClick={() => setRules((r) => ({ ...r, leverage: n }))}>
                    {n}X
                  </button>
                ))}
              </div>
            </div>
            <div className="b-rules__row">
              <span className="b-rules__lab">방향</span>
              <div className="b-seg b-seg--spread">
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
            <label className="b-rules__note">
              <span className="b-rules__lab">주관</span>
              <textarea
                value={rules.note || ""}
                onChange={(e) => setRules((r) => ({ ...r, note: e.target.value }))}
                placeholder="내 주관적 개입. 예: 알트 빼고 BTC·ETH 위주, 숏 선호"
                rows={5}
              />
            </label>
            {pickError && <p className="b-err">{pickError}</p>}
          </div>
          <ol className="b-picks__list">
            {(picks?.picks || []).map((row, i) => {
              const score = Math.max(0, Math.min(100, Math.round(Number(row.score) || 0)));
              const rank = Number(row.marketCapRank) || 0;
              return (
                <li key={`${row.symbol}-${row.side}-${i}`}>
                  <button
                    type="button"
                    className={row.symbol === chartSymbol ? "is-on" : ""}
                    onClick={() => pickSymbol(row.symbol)}
                  >
                    <span className="b-pick__no">{String(i + 1).padStart(2, "0")}</span>
                    <span className="b-pick__main">
                      <span className="b-pick__name">{row.symbol.replace("USDT", "")}</span>
                      <span className="b-pick__cap">{rank ? `시총 ${rank}위` : row.marketCapFormatted || "시총 -"}</span>
                    </span>
                    <em className={`b-side is-${String(row.side).toLowerCase()}`}>{row.side === "LONG" ? "롱" : "숏"}</em>
                    <span className="b-pick__score" title={`추천점수 ${score}`}>
                      <b>{score}</b>
                      <i style={{ width: `${score}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
            {!picks?.picks?.length && <li className="b-muted">추천을 불러오는 중…</li>}
          </ol>
          </div>
        </section>
        <section className="b-card b-chat b-chat--entry">
          <div className="b-chat__bar">
            <p className="b-card__kicker">AI 진입 비서{activeSymbol ? ` · ${activeSymbol.replace("USDT", "")}` : ""}</p>
            <div className="b-seg b-chat__chips">
              <button type="button" className="is-on" onClick={() => sendEntryChat(ENTRY_CHIP, { scan: true })} disabled={busy === "entry"}>
                {ENTRY_CHIP}
              </button>
              <button type="button" onClick={() => sendEntryChat(ENTRY_ONE_CHIP, { focus: true })} disabled={busy === "entry" || !activeSymbol}>
                {ENTRY_ONE_CHIP}
              </button>
            </div>
          </div>
          <div className="b-chat__log" ref={entryLog}>
            {entryMessages.map((m, i) => (
              <div key={i} className={`b-chat__bubble is-${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy === "entry" && <div className="b-chat__bubble is-assistant">추천과 차트를 읽고 있습니다…</div>}
          </div>
          <form
            className="b-chat__form"
            onSubmit={(e) => {
              e.preventDefault();
              sendEntryChat();
            }}
          >
            <input value={entryDraft} onChange={(e) => setEntryDraft(e.target.value)} placeholder="지금 들어가도 돼? 어디가 제일 괜찮아?" />
            <button type="submit" className="b-btn" disabled={busy === "entry"}>
              전송
            </button>
          </form>
        </section>
      </div>
      ) : (
      <div className="b-shell b-shell--overview">
        <section className="b-card b-pos">
            {asset ? (
              <p className="b-asset-line">
                <strong>{formatNumber(asset.totalUsdt, 2)}USDT</strong>
                {asset.totalKrw != null && <span>≈ {formatNumber(asset.totalKrw, 0)}원</span>}
              </p>
            ) : (
              !error && <p className="b-muted">총자산 불러오는 중…</p>
            )}
            {error && <p className="b-err">{error}</p>}
            <div className="b-pos__head">
              <p className="b-card__kicker">현재 포지션 요약</p>
              {positions.length ? (
                <div className="b-mini">
                  {positions.map((p, i) => {
                    const on = p.symbol === chartSymbol;
                    const up = Number(p.unRealizedProfit) >= 0;
                    return (
                      <button
                        key={`${p.symbol}-${p.side}`}
                        type="button"
                        className={on ? "is-on" : ""}
                        onClick={() => pickSymbol(p.symbol, { fromPosition: true })}
                        title={`명목 ${formatNumber(positionSize(p), 2)} USDT`}
                      >
                        <span className="b-mini__no">포지션{i + 1}</span>
                        <b>{p.symbol.replace("USDT", "")}</b>
                        <em className={`b-side is-${String(p.side).toLowerCase()}`}>{p.side === "LONG" ? "롱" : "숏"}</em>
                        <span className={up ? "is-up" : "is-down"}>{formatPct(p.roe)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="b-muted">{positionsReady ? "열린 포지션 없음" : "포지션 불러오는 중…"}</p>
              )}
            </div>
            {active ? (
              <div className="b-pos__grid">
                <div>
                  <span>방향</span>
                  <strong className={`b-side is-${String(active.side).toLowerCase()}`}>
                    {active.side === "LONG" ? "롱" : "숏"} {active.leverage}X
                  </strong>
                </div>
                <div>
                  <span>평단</span>
                  <strong>{formatNumber(active.entryPrice, 4)}</strong>
                </div>
                <div>
                  <span>현재가</span>
                  <strong>{formatNumber(active.markPrice, 4)}</strong>
                </div>
                <div>
                  <span>청산가</span>
                  <strong>{formatNumber(active.liquidationPrice, 4)}</strong>
                </div>
                <div>
                  <span>미실현</span>
                  <strong className={Number(active.unRealizedProfit) >= 0 ? "is-up" : "is-down"}>{formatNumber(active.unRealizedProfit, 2)}</strong>
                </div>
              </div>
            ) : (
              <p className="b-muted">선택된 포지션이 없습니다.</p>
            )}
        </section>

        <section className="b-card b-trade">
          <div className="b-split">
          <div className="b-tvwrap">
            <div className="b-tvwrap__head">
              <p className="b-card__kicker">{chartSymbol.replace("USDT", "")} 차트</p>
              {active && (
                <div className="b-avg">
                  <span>현재</span>
                  <strong>{formatNumber(active.markPrice, 4)}</strong>
                  <span>평단 {formatNumber(active.entryPrice, 4)}</span>
                  {fills?.lastAdd && (
                    <span>
                      추매 {formatNumber(fills.lastAdd.price, 4)} · {formatWhen(fills.lastAdd.time)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {chartSymbol ? (
              <TradingViewChart symbol={chartSymbol} interval={tvInterval} levels={chartLevels} />
            ) : (
              <div className="b-tvstage b-tvstage--wait">
                <p className="b-muted">포지션 불러오는 중…</p>
              </div>
            )}
          </div>

          <div className="b-chat">
            <div className="b-chat__bar">
              <p className="b-card__kicker">AI 포지션 비서</p>
              <div className="b-seg b-chat__chips">
                <button type="button" className="is-on" onClick={() => sendChat(SUMMARY_CHIP, { summary: true })} disabled={busy === "ai"}>
                  {SUMMARY_CHIP}
                </button>
                <button type="button" onClick={() => sendChat(ACTION_CHIP, { action: true })} disabled={busy === "ai"}>
                  {ACTION_CHIP}
                </button>
              </div>
            </div>
            <div className="b-chat__log" ref={chatLog}>
              {messages.map((m, i) => (
                <div key={i} className={`b-chat__bubble is-${m.role}`}>
                  {m.text}
                </div>
              ))}
              {busy === "ai" && <div className="b-chat__bubble is-assistant">포지션을 읽고 있습니다…</div>}
            </div>
            <form
              className="b-chat__form"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="방금 움직임이 어떤 신호냐?" />
              <button type="submit" className="b-btn" disabled={busy === "ai"}>
                전송
              </button>
            </form>
          </div>
          </div>
        </section>
      </div>
      )}
    </main>
  );
}
