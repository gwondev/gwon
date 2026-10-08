import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
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

const FALLBACK_CRITERIA = `시가총액이 적당히 큰 코인 (소형 펌핑 코인 제외)
1X로 숏 쳐도 청산·급등 위험이 거의 없음
지금까지의 움직임이 방향이 깔끔하고 딱 좋음
일주일 정도 들고 있으면 기대 수익률이 가장 좋음
1X 롱도 포함 · 롱/숏 통합 상위 10개`;

function formatNumber(v, digits) {
  return Number(v).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPct(v) {
  const n = Number(v) || 0;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function PnlChart({ points, total }) {
  const { path, area, min, max } = useMemo(() => {
    const vals = (points || []).map((p) => p.cumulative);
    if (!vals.length) return { path: "", area: "", min: 0, max: 0 };
    const minV = Math.min(0, ...vals);
    const maxV = Math.max(0, ...vals);
    const span = maxV - minV || 1;
    const w = 100;
    const h = 100;
    const padY = 8;
    const usable = h - padY * 2;
    const xy = vals.map((v, i) => {
      const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w;
      const y = padY + (1 - (v - minV) / span) * usable;
      return [x, y];
    });
    const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    const last = xy[xy.length - 1];
    const first = xy[0];
    return { path: d, area: `${d} L${last[0].toFixed(2)},${h} L${first[0].toFixed(2)},${h} Z`, min: minV, max: maxV };
  }, [points]);

  const up = total >= 0;
  if (!points?.length) {
    return <div className="b-chart__empty">아직 실현손익 기록이 없습니다.</div>;
  }

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

function PositionRow({ p }) {
  if (!p) return null;
  const up = Number(p.unRealizedProfit) >= 0;
  return (
    <li className="b-pos__row">
      <span className="b-picks__sym">{String(p.symbol || "").replace("USDT", "")}</span>
      <span className={`b-picks__side is-${String(p.side || "").toLowerCase()}`}>{p.side === "LONG" ? "롱" : "숏"}</span>
      <span>{p.leverage}X</span>
      <span className={up ? "is-up" : "is-down"}>{formatPct(p.roe)}</span>
      <span className={up ? "is-up" : "is-down"}>
        {up ? "+" : ""}
        {formatNumber(p.unRealizedProfit, 2)}
      </span>
    </li>
  );
}

export default function BinancePage() {
  const { isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [positions, setPositions] = useState([]);
  const [picks, setPicks] = useState(null);
  const [criteria, setCriteria] = useState(FALLBACK_CRITERIA);
  const [period, setPeriod] = useState("1w");
  const [chart, setChart] = useState(null);
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pickError, setPickError] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthed || !isSuperAdmin)) navigate("/", { replace: true });
  }, [authLoading, isAuthed, isSuperAdmin, navigate]);

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
    } catch {
      setPositions([]);
    }
  }, [token]);

  const loadBot = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/bot", { token });
      if (data.settings?.scoringPrompt) setCriteria(data.settings.scoringPrompt);
    } catch {
      /* keep fallback */
    }
  }, [token]);

  const loadPicks = useCallback(async (refresh = false) => {
    if (!token) return;
    setPickError("");
    try {
      const data = await api(`/binance/picks${refresh ? "?refresh=1" : ""}`, { token });
      setPicks(data);
      if (data.criteria) setCriteria(data.criteria);
      if (!data.ok) setPickError(data.error || "추천 실패");
      else if (data.error) setPickError(`AI 순위 실패 → 규칙 점수 사용: ${data.error}`);
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

  const saveCriteria = async () => {
    setBusy("save");
    setPickError("");
    try {
      await api("/binance/bot", { method: "PUT", token, body: { scoringPrompt: criteria } });
      await loadPicks(true);
    } catch (err) {
      setPickError(err.message);
    } finally {
      setBusy("");
    }
  };

  const askAdvice = async () => {
    setBusy("ai");
    setAdvice("");
    try {
      const data = await api("/binance/position-advice", { method: "POST", token, body: {} });
      setAdvice(data.analysis || data.error || "응답이 비었습니다.");
    } catch (err) {
      setAdvice(err.message);
    } finally {
      setBusy("");
    }
  };

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

  return (
    <PageTransition className="page binance-page">
      <div className="b-shell">
        <section className="b-asset">
          <span className="b-asset__label">내 지갑 총자산</span>
          {asset ? (
            <div className="b-asset__nums">
              <strong className="b-asset__usdt">
                {formatNumber(asset.totalUsdt, 2)}
                <small>USDT</small>
              </strong>
              {asset.totalKrw != null ? (
                <span className="b-asset__krw">≈ {formatNumber(asset.totalKrw, 0)}원</span>
              ) : (
                <span className="b-asset__krw is-dim">환율 없음</span>
              )}
              {asset.krwRate != null && (
                <span className="b-asset__rate">
                  {formatNumber(asset.krwRate, 1)}원 · {asset.krwRateDate}
                </span>
              )}
            </div>
          ) : (
            !error && <span className="b-asset__krw is-dim">불러오는 중…</span>
          )}
          {error && <p className="b-asset__error">{error}</p>}
        </section>

        <section className="b-card b-pos">
          <p className="b-card__kicker">내 포지션</p>
          {positions.length ? (
            <ol className="b-pos__list">
              {positions.map((p) => (
                <PositionRow key={`${p.symbol}-${p.side}`} p={p} />
              ))}
            </ol>
          ) : (
            <p className="b-empty">열려 있는 선물 포지션이 없습니다.</p>
          )}
        </section>

        <section className="b-card b-ai">
          <div className="b-card__head">
            <p className="b-card__kicker">포지션 AI 매매추천</p>
            <button type="button" className="b-btn" disabled={busy === "ai"} onClick={askAdvice}>
              {busy === "ai" ? "분석 중…" : "추천 받기"}
            </button>
          </div>
          <div className="b-ai__body">{advice || "현재 포지션을 기준으로 HOLD / 줄이기 / 청산 / 반전을 제안합니다."}</div>
        </section>

        <section className="b-card b-picks">
          <div className="b-picks__rules">
            <div className="b-card__head">
              <p className="b-card__kicker">내 기준</p>
              <button type="button" className="b-btn" disabled={busy === "save"} onClick={saveCriteria}>
                {busy === "save" ? "저장 중…" : "저장 후 추천"}
              </button>
            </div>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={7}
              spellCheck={false}
            />
            {pickError && <p className="b-asset__error">{pickError}</p>}
          </div>
          <div className="b-picks__board">
            <div className="b-card__head">
              <p className="b-card__kicker">추천 상위 10</p>
              <button type="button" className="b-btn" onClick={() => loadPicks(true)}>
                새로고침
              </button>
            </div>
            <ol className="b-picks__list">
              {(picks?.picks || []).map((row, i) => (
                <li key={row.symbol}>
                  <span className="b-picks__rank">{i + 1}</span>
                  <span className="b-picks__sym">{row.symbol.replace("USDT", "")}</span>
                  <span className={`b-picks__side is-${row.side.toLowerCase()}`}>{row.side === "LONG" ? "롱" : "숏"}</span>
                  <span className={`b-picks__week ${row.ret7d >= 0 ? "is-up" : "is-down"}`}>{formatPct(row.ret7d)}</span>
                  <span className="b-picks__score">{row.score}</span>
                </li>
              ))}
              {!picks?.picks?.length && <li className="b-picks__empty">추천을 불러오는 중…</li>}
            </ol>
          </div>
        </section>

        <section className="b-card b-chart">
          <div className="b-chart__head">
            <div>
              <p className="b-card__kicker">수익률</p>
              <strong className={`b-chart__total ${(chart?.total || 0) >= 0 ? "is-up" : "is-down"}`}>
                {(chart?.total || 0) >= 0 ? "+" : ""}
                {formatNumber(chart?.total || 0, 2)}
                <small>USDT</small>
              </strong>
            </div>
            <div className="b-chart__periods">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" className={period === p.id ? "is-on" : ""} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <PnlChart points={chart?.points} total={chart?.total || 0} />
        </section>
      </div>
    </PageTransition>
  );
}
