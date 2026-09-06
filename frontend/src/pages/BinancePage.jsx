import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./BinancePage.css";

export default function BinancePage() {
  const { user, isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();

  // 1. 지갑 데이터
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);

  // 2. 포지션 데이터
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);

  // 3. 1B 스캐너 & 백분위 추천
  const [scanner, setScanner] = useState(null);
  const [scannerLoading, setScannerLoading] = useState(true);
  const [scannerTab, setScannerTab] = useState("1b"); // "1b" | "short" | "gainers"

  // 4. 선택된 차트 심볼
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");

  // 5. 봇 설정 & AI 진단
  const [botSettings, setBotSettings] = useState(null);
  const [botPrompt, setBotPrompt] = useState("");
  const [botActive, setBotActive] = useState(true);
  const [paperMode, setPaperMode] = useState(true);
  const [leverage, setLeverage] = useState(5);
  const [orderSize, setOrderSize] = useState(3.0);
  const [botSaving, setBotSaving] = useState(false);
  const [botSaveMsg, setBotSaveMsg] = useState("");

  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 권한 체크: SUPER_ADMIN만 접근 가능 (약간 히든 페이지)
  useEffect(() => {
    if (!authLoading && (!isAuthed || !isSuperAdmin)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthed, isSuperAdmin, navigate]);

  // 지갑 로드
  const loadWallet = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/wallet", { token });
      setWallet(data);
    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setWalletLoading(false);
    }
  }, [token]);

  // 포지션 로드
  const loadPositions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/positions", { token });
      if (data.ok) {
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error("Positions load error:", err);
    } finally {
      setPositionsLoading(false);
    }
  }, [token]);

  // 스캐너 로드
  const loadScanner = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/scanner", { token });
      if (data.ok) {
        setScanner(data);
        // 기본 선택 심볼이 아직 기본값이면 첫번째 1B 코인으로 세팅
        if (data.coins1B && data.coins1B.length > 0 && selectedSymbol === "BTCUSDT") {
          setSelectedSymbol(data.coins1B[0].symbol);
        }
      }
    } catch (err) {
      console.error("Scanner load error:", err);
    } finally {
      setScannerLoading(false);
    }
  }, [token, selectedSymbol]);

  // 봇 설정 로드
  const loadBotSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/bot", { token });
      if (data.ok && data.settings) {
        setBotSettings(data.settings);
        setBotPrompt(data.settings.prompt || "");
        setBotActive(Boolean(data.settings.is_active));
        setPaperMode(Boolean(data.settings.paper_mode));
        setLeverage(data.settings.leverage || 5);
        setOrderSize(data.settings.order_size_percent || 3.0);
      }
    } catch (err) {
      console.error("Bot settings load error:", err);
    }
  }, [token]);

  // 전체 데이터 갱신
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([loadWallet(), loadPositions(), loadScanner()]);
    setLastRefreshed(new Date());
  }, [loadWallet, loadPositions, loadScanner]);

  useEffect(() => {
    if (token && isSuperAdmin) {
      refreshAll();
      loadBotSettings();
    }
  }, [token, isSuperAdmin, refreshAll, loadBotSettings]);

  // 자동 갱신 (15초마다)
  useEffect(() => {
    if (!autoRefresh || !token || !isSuperAdmin) return;
    const timer = setInterval(() => {
      refreshAll();
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, token, isSuperAdmin, refreshAll]);

  // 봇 설정 저장
  const handleSaveBot = async (e) => {
    e?.preventDefault();
    setBotSaving(true);
    setBotSaveMsg("");
    try {
      await api("/binance/bot", {
        method: "PUT",
        token,
        body: {
          prompt: botPrompt,
          isActive: botActive,
          paperMode,
          leverage,
          orderSizePercent: orderSize,
        },
      });
      setBotSaveMsg("✓ 봇 전략과 규칙이 안전하게 저장되었습니다.");
      setTimeout(() => setBotSaveMsg(""), 4000);
    } catch (err) {
      setBotSaveMsg(`저장 실패: ${err.message}`);
    } finally {
      setBotSaving(false);
    }
  };

  // Gemini AI 시장 진단 요청
  const handleAiDiagnose = async () => {
    setAiLoading(true);
    setAiError("");
    setAiReport("");
    try {
      const data = await api("/binance/bot/ai-diagnose", {
        method: "POST",
        token,
        body: {
          promptText: botPrompt,
          targetSymbol: selectedSymbol,
        },
      });
      if (data.ok && data.analysis) {
        setAiReport(data.analysis);
      } else {
        throw new Error(data.error || "분석 리포트를 생성하지 못했습니다.");
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  if (authLoading || !isAuthed || !isSuperAdmin) {
    return null;
  }

  // 표시할 스캐너 리스트 결정
  const activeScannerList =
    scannerTab === "1b"
      ? scanner?.coins1B || []
      : scannerTab === "short"
      ? scanner?.topShortPicks || []
      : scanner?.topGainers || [];

  const selectedCoinData =
    scanner?.coins1B?.find((c) => c.symbol === selectedSymbol) ||
    scanner?.topShortPicks?.find((c) => c.symbol === selectedSymbol) ||
    scanner?.topGainers?.find((c) => c.symbol === selectedSymbol);

  return (
    <PageTransition className="page binance-page">
      {/* 1. 상단 터미널 헤더 바 */}
      <motion.header
        className="b-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="b-header__left">
          <div className="b-badge">
            <span className="b-badge__dot" />
            <span className="b-badge__label">SUPER ADMIN ONLY</span>
          </div>
          <h1 className="b-title">
            <span className="b-title__gold">BINANCE</span> QUANT TERMINAL
          </h1>
          <span className="b-subtitle">
            1B+ 급등 코인 거미줄 숏 감시 & 프롬프트 자동매매 엔진
          </span>
        </div>

        <div className="b-header__right">
          <div className="b-status-pill">
            <span
              className={`b-status-dot ${
                wallet?.hasCredentials ? "is-live" : "is-demo"
              }`}
            />
            <span>
              {wallet?.hasCredentials ? "API 연결됨 (LIVE)" : "API 키 점검 필요"}
            </span>
          </div>

          <button
            type="button"
            className="b-btn b-btn--refresh"
            onClick={refreshAll}
            title="실시간 새로고침"
          >
            ↻ {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </button>

          <label className="b-auto-toggle" title="15초마다 자동 실시간 갱신">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>실시간 자동갱신</span>
          </label>
        </div>
      </motion.header>

      {/* 2. 지갑 잔고 현황 (USDT 선물 지갑 + 현물 지갑) */}
      <motion.section
        className="b-section b-wallet"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05 }}
      >
        <div className="b-wallet__grid">
          {/* 선물 USDT 지갑 잔고 */}
          <div className="b-card b-wallet__card b-wallet__card--highlight">
            <div className="b-card__head">
              <span className="b-card__tag">FUTURES WALLET</span>
              <span className="b-card__hint">선물 USDT 잔고</span>
            </div>
            <div className="b-wallet__val">
              {walletLoading ? (
                <span className="b-skeleton">불러오는 중...</span>
              ) : (
                <>
                  <span className="b-wallet__num">
                    {(wallet?.futures?.usdt?.walletBalance || 0).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    )}
                  </span>
                  <span className="b-wallet__unit">USDT</span>
                </>
              )}
            </div>
            <div className="b-wallet__sub">
              <span>가용 마진:</span>
              <strong>
                {(wallet?.futures?.usdt?.availableBalance || 0).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}{" "}
                USDT
              </strong>
            </div>
          </div>

          {/* 선물 미실현 손익 */}
          <div className="b-card b-wallet__card">
            <div className="b-card__head">
              <span className="b-card__tag">UNREALIZED PnL</span>
              <span className="b-card__hint">미실현 손익</span>
            </div>
            <div className="b-wallet__val">
              {walletLoading ? (
                <span className="b-skeleton">불러오는 중...</span>
              ) : (
                <span
                  className={`b-wallet__num ${
                    (wallet?.futures?.totalUnrealizedProfit || 0) >= 0
                      ? "is-profit"
                      : "is-loss"
                  }`}
                >
                  {(wallet?.futures?.totalUnrealizedProfit || 0) >= 0 ? "+" : ""}
                  {(wallet?.futures?.totalUnrealizedProfit || 0).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )}
                  <span className="b-wallet__unit"> USDT</span>
                </span>
              )}
            </div>
            <div className="b-wallet__sub">
              <span>마진 잔고:</span>
              <strong>
                {(wallet?.futures?.totalMarginBalance || 0).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}{" "}
                USDT
              </strong>
            </div>
          </div>

          {/* 현물 지갑 USDT 잔고 */}
          <div className="b-card b-wallet__card">
            <div className="b-card__head">
              <span className="b-card__tag">SPOT WALLET (USDT)</span>
              <span className="b-card__hint">현물 계정 USDT</span>
            </div>
            <div className="b-wallet__val">
              {walletLoading ? (
                <span className="b-skeleton">불러오는 중...</span>
              ) : (
                <>
                  <span className="b-wallet__num">
                    {(wallet?.spot?.usdtFree || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="b-wallet__unit">USDT</span>
                </>
              )}
            </div>
            <div className="b-wallet__sub">
              <span>현물 총 보유:</span>
              <strong>
                {(wallet?.spot?.usdtTotal || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USDT
              </strong>
            </div>
          </div>

          {/* 현물 기타 보유 자산 */}
          <div className="b-card b-wallet__card b-wallet__card--assets">
            <div className="b-card__head">
              <span className="b-card__tag">SPOT ASSETS</span>
              <span className="b-card__hint">보유 현물 코인</span>
            </div>
            <div className="b-asset-chips">
              {walletLoading ? (
                <span className="b-skeleton">로딩 중...</span>
              ) : wallet?.spot?.balances?.length ? (
                wallet.spot.balances.slice(0, 5).map((b) => (
                  <span key={b.asset} className="b-asset-chip">
                    <strong>{b.asset}</strong> {b.total.toFixed(4)}
                  </span>
                ))
              ) : (
                <span className="b-empty-text">보유 중인 기타 현물 없음</span>
              )}
            </div>
          </div>
        </div>

        {/* API 연결 안내 (에러 발생 시) */}
        {wallet && !wallet.hasCredentials && (
          <div className="b-alert b-alert--warning">
            <span>
              ℹ️ 서버 <code>.env</code> 파일에 <code>BINANCE_API_KEY</code>와{" "}
              <code>BINANCE_SECRET_KEY</code>를 등록하고 컨테이너를 재시작하면
              실시간 계정 잔고와 포지션이 자동으로 동기화됩니다. (시장 감시 및 1B
              스캐너는 공개 API로 즉시 정상 작동 중)
            </span>
          </div>
        )}
      </motion.section>

      {/* 3. 현재 포지션 및 추천 다음 행동 (Action Advisor) */}
      <motion.section
        className="b-section"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1 }}
      >
        <div className="b-section__header">
          <div className="b-section__title-group">
            <h2 className="b-section__title">현재 포지션 & 추천 다음 행동</h2>
            <span className="b-section__badge">
              {positions.length}개 보유 중
            </span>
          </div>
          <span className="b-section__desc">
            거미줄 숏 및 보유 포지션의 PnL, 펀딩비, 수익률에 기반한 전략적 조언
          </span>
        </div>

        {positionsLoading ? (
          <div className="b-card b-loading-card">포지션 정보 동기화 중...</div>
        ) : positions.length === 0 ? (
          <div className="b-card b-empty-positions">
            <div className="b-empty-icon">🛡️</div>
            <strong>현재 오픈된 선물 포지션이 없습니다.</strong>
            <p>
              아래 1B 이상 급등 코인 스캐너를 통해 최적의 거미줄 숏 진입 타겟을
              선정하세요.
            </p>
          </div>
        ) : (
          <div className="b-pos-list">
            {positions.map((pos) => (
              <div
                key={pos.symbol}
                className={`b-card b-pos-card ${
                  pos.actionType === "TP"
                    ? "is-tp"
                    : pos.actionType === "SL"
                    ? "is-sl"
                    : pos.actionType === "LADDER"
                    ? "is-ladder"
                    : ""
                }`}
                onClick={() => setSelectedSymbol(pos.symbol)}
              >
                <div className="b-pos-card__top">
                  <div className="b-pos-card__sym-box">
                    <span
                      className={`b-side-badge ${
                        pos.side === "SHORT" ? "is-short" : "is-long"
                      }`}
                    >
                      {pos.side} {pos.leverage}x
                    </span>
                    <strong className="b-pos-card__sym">{pos.symbol}</strong>
                    <button
                      type="button"
                      className="b-btn b-btn--xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSymbol(pos.symbol);
                      }}
                    >
                      차트 보기 ↗
                    </button>
                  </div>

                  <div className="b-pos-card__roe-box">
                    <span className="b-pos-card__roe-label">ROE 수익률</span>
                    <strong
                      className={`b-pos-card__roe ${
                        pos.roe >= 0 ? "is-profit" : "is-loss"
                      }`}
                    >
                      {pos.roe >= 0 ? "+" : ""}
                      {pos.roe}%
                    </strong>
                    <span className="b-pos-card__pnl">
                      ({pos.unRealizedProfit >= 0 ? "+" : ""}
                      {pos.unRealizedProfit.toFixed(2)} USDT)
                    </span>
                  </div>
                </div>

                <div className="b-pos-card__meta">
                  <div>
                    <span>진입가:</span> <strong>{pos.entryPrice}</strong>
                  </div>
                  <div>
                    <span>현재가:</span> <strong>{pos.markPrice}</strong>
                  </div>
                  <div>
                    <span>포지션 규모:</span>{" "}
                    <strong>{pos.notional?.toFixed(1)} USDT</strong>
                  </div>
                  <div>
                    <span>실시간 펀딩비:</span>{" "}
                    <strong
                      className={pos.fundingRate >= 0 ? "is-profit" : "is-loss"}
                    >
                      {pos.fundingRate >= 0 ? "+" : ""}
                      {pos.fundingRate?.toFixed(4)}%
                    </strong>
                  </div>
                </div>

                {/* 추천 다음 행동 박스 */}
                <div className="b-pos-action">
                  <div className="b-pos-action__badge">
                    <span>추천 액션</span>
                    <strong>{pos.action}</strong>
                  </div>
                  <p className="b-pos-action__desc">{pos.actionDesc}</p>

                  {pos.ladderAdvice && (
                    <div className="b-ladder-guide">
                      <span className="b-ladder-guide__title">
                        거미줄 숏 가이드라인:
                      </span>
                      <div className="b-ladder-guide__steps">
                        <span>1차(진입): {pos.ladderAdvice.entry}</span>
                        <span>2차(+2%): {pos.ladderAdvice.ladder2}</span>
                        <span>3차(+4.5%): {pos.ladderAdvice.ladder3}</span>
                        <span>4차(+7.5%): {pos.ladderAdvice.ladder4}</span>
                        <span className="is-tp-text">
                          익절1(-3%): {pos.ladderAdvice.tp1}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* 4. 메인 2열 레이아웃: [좌측: 1B 스캐너 & 추천] + [우측: TradingView 실시간 차트 & AI] */}
      <div className="b-grid-main">
        {/* 좌측: 1B+ 급등 코인 감시 & 백분위 숏 추천 */}
        <motion.section
          className="b-section b-col-scanner"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          <div className="b-section__header b-section__header--tabs">
            <div>
              <h2 className="b-section__title">
                1B+ 대형 코인 거미줄 숏 스캐너
              </h2>
              <span className="b-section__desc">
                24h 거래대금 1B 달러 이상 & 펀딩비 우호 급등 코인 백분위 랭킹
              </span>
            </div>

            <div className="b-tabs">
              <button
                type="button"
                className={`b-tab ${scannerTab === "1b" ? "is-active" : ""}`}
                onClick={() => setScannerTab("1b")}
              >
                ★ 1B 이상 ({scanner?.count1B || 0})
              </button>
              <button
                type="button"
                className={`b-tab ${scannerTab === "short" ? "is-active" : ""}`}
                onClick={() => setScannerTab("short")}
              >
                숏 추천 점수 TOP
              </button>
              <button
                type="button"
                className={`b-tab ${
                  scannerTab === "gainers" ? "is-active" : ""
                }`}
                onClick={() => setScannerTab("gainers")}
              >
                급등률 TOP
              </button>
            </div>
          </div>

          <div className="b-card b-table-card">
            {scannerLoading ? (
              <div className="b-loading-box">1B 마켓 데이터 수집 중...</div>
            ) : activeScannerList.length === 0 ? (
              <div className="b-empty-box">표시할 코인 데이터가 없습니다.</div>
            ) : (
              <div className="b-table-wrap">
                <table className="b-table">
                  <thead>
                    <tr>
                      <th>코인 (심볼)</th>
                      <th>현재가</th>
                      <th>24h 변동률</th>
                      <th>24h 거래대금</th>
                      <th>펀딩비</th>
                      <th title="급등률, 1B 유동성, 펀딩비 종합 백분위 점수">
                        숏 기회 점수
                      </th>
                      <th>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScannerList.map((item) => {
                      const isSelected = item.symbol === selectedSymbol;
                      return (
                        <tr
                          key={item.symbol}
                          className={`b-row ${isSelected ? "is-selected" : ""}`}
                          onClick={() => setSelectedSymbol(item.symbol)}
                        >
                          <td className="b-td-sym">
                            <strong>{item.symbol}</strong>
                            {item.is1B && (
                              <span className="b-1b-badge">1B+</span>
                            )}
                          </td>
                          <td className="b-td-num">
                            {item.lastPrice < 1
                              ? item.lastPrice.toFixed(4)
                              : item.lastPrice.toLocaleString()}
                          </td>
                          <td
                            className={`b-td-num ${
                              item.priceChangePercent >= 0
                                ? "is-profit"
                                : "is-loss"
                            }`}
                          >
                            {item.priceChangePercent >= 0 ? "+" : ""}
                            {item.priceChangePercent}%
                          </td>
                          <td className="b-td-num b-td-dim">
                            {item.volumeFormatted}
                          </td>
                          <td
                            className={`b-td-num ${
                              item.fundingRate >= 0
                                ? "is-profit"
                                : item.fundingRate < -0.04
                                ? "is-loss"
                                : "is-dim"
                            }`}
                            title={
                              item.fundingRate >= 0
                                ? "양수 펀딩비: 숏 포지션이 펀딩비를 수취하여 유리"
                                : "음수 펀딩비: 숏 포지션이 펀딩비를 지출해야 함"
                            }
                          >
                            {item.fundingRate >= 0 ? "+" : ""}
                            {item.fundingRate}%
                          </td>
                          <td>
                            <div className="b-score-bar-wrap">
                              <div
                                className="b-score-bar"
                                style={{ width: `${item.shortScore}%` }}
                              />
                              <span className="b-score-text">
                                {item.shortScore}점
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`b-btn b-btn--chart ${
                                isSelected ? "is-active" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSymbol(item.symbol);
                              }}
                            >
                              {isSelected ? "차트 켜짐" : "차트"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>

        {/* 우측: 실시간 바이낸스 TradingView 차트 & 거미줄 주문 가이드 */}
        <motion.section
          className="b-section b-col-chart"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          <div className="b-section__header">
            <div className="b-section__title-group">
              <h2 className="b-section__title">
                {selectedSymbol} 실시간 차트 & 거미줄 분할선
              </h2>
              {selectedCoinData && (
                <span className="b-selected-metric">
                  24h: {selectedCoinData.priceChangePercent}% · 펀딩비:{" "}
                  {selectedCoinData.fundingRate}%
                </span>
              )}
            </div>
            <span className="b-section__desc">
              TradingView 바이낸스 선물 실시간 캔들 차트
            </span>
          </div>

          {/* 차트 임베드 카드 */}
          <div className="b-card b-chart-card">
            <TradingViewChart symbol={selectedSymbol} />
          </div>

          {/* 선택된 코인의 거미줄 4단계 진입 가격 가이드 */}
          {selectedCoinData && (
            <div className="b-card b-ladder-card">
              <div className="b-card__head">
                <span className="b-card__tag">
                  {selectedSymbol} 거미줄 숏 4단 진입 시뮬레이터
                </span>
                <span className="b-card__hint">
                  숏 점수: {selectedCoinData.shortScore}점
                </span>
              </div>
              <div className="b-ladder-grid">
                <div className="b-ladder-box">
                  <span className="b-ladder-step">1차 진입 (25%)</span>
                  <strong className="b-ladder-price">
                    {selectedCoinData.ladders?.ladder1}
                  </strong>
                  <span className="b-ladder-ratio">현재가</span>
                </div>
                <div className="b-ladder-box">
                  <span className="b-ladder-step">2차 거미줄 (25%)</span>
                  <strong className="b-ladder-price">
                    {selectedCoinData.ladders?.ladder2}
                  </strong>
                  <span className="b-ladder-ratio">+2.0%</span>
                </div>
                <div className="b-ladder-box">
                  <span className="b-ladder-step">3차 거미줄 (25%)</span>
                  <strong className="b-ladder-price">
                    {selectedCoinData.ladders?.ladder3}
                  </strong>
                  <span className="b-ladder-ratio">+4.5%</span>
                </div>
                <div className="b-ladder-box">
                  <span className="b-ladder-step">4차 거미줄 (25%)</span>
                  <strong className="b-ladder-price">
                    {selectedCoinData.ladders?.ladder4}
                  </strong>
                  <span className="b-ladder-ratio">+7.5%</span>
                </div>
              </div>
            </div>
          )}
        </motion.section>
      </div>

      {/* 5. 하단: 프롬프트 규칙 자동매매 봇 설정 & Gemini AI 시장 진단 */}
      <motion.section
        className="b-section b-bot-section"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="b-section__header">
          <div>
            <h2 className="b-section__title">
              프롬프트 규칙 기반 자동매매 봇 & AI 진단 엔진
            </h2>
            <span className="b-section__desc">
              3개월간 검증된 거미줄 숏 프롬프트 규칙 편집 및 실시간 Gemini AI 전략 리포트
            </span>
          </div>
        </div>

        <div className="b-bot-grid">
          {/* 봇 설정 및 프롬프트 편집기 */}
          <div className="b-card b-bot-config-card">
            <form onSubmit={handleSaveBot}>
              <div className="b-bot-controls">
                <div className="b-toggle-group">
                  <label className="b-toggle-label">
                    <span>봇 활성화:</span>
                    <input
                      type="checkbox"
                      checked={botActive}
                      onChange={(e) => setBotActive(e.target.checked)}
                    />
                    <span className={botActive ? "is-on" : "is-off"}>
                      {botActive ? "운영 중 (ACTIVE)" : "일시정지 (PAUSED)"}
                    </span>
                  </label>

                  <label className="b-toggle-label">
                    <span>거래 모드:</span>
                    <input
                      type="checkbox"
                      checked={paperMode}
                      onChange={(e) => setPaperMode(e.target.checked)}
                    />
                    <span className={paperMode ? "is-paper" : "is-live"}>
                      {paperMode ? "모의 매매 (PAPER)" : "실전 매매 (LIVE)"}
                    </span>
                  </label>
                </div>

                <div className="b-param-group">
                  <label>
                    <span>레버리지:</span>
                    <select
                      value={leverage}
                      onChange={(e) => setLeverage(Number(e.target.value))}
                    >
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                      <option value={5}>5x (추천)</option>
                      <option value={7}>7x</option>
                      <option value={10}>10x</option>
                    </select>
                  </label>

                  <label>
                    <span>1회 진입 비중:</span>
                    <select
                      value={orderSize}
                      onChange={(e) => setOrderSize(Number(e.target.value))}
                    >
                      <option value={1.5}>1.5%</option>
                      <option value={2.0}>2.0%</option>
                      <option value={3.0}>3.0% (표준)</option>
                      <option value={5.0}>5.0%</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="b-field">
                <label className="b-field__label">
                  <strong>거미줄 숏 매매 프롬프트 규칙 (Prompt Strategy)</strong>
                  <span>규칙을 자유롭게 수정하고 저장할 수 있습니다.</span>
                </label>
                <textarea
                  className="b-textarea"
                  rows={9}
                  value={botPrompt}
                  onChange={(e) => setBotPrompt(e.target.value)}
                  placeholder="봇의 진입, 분할 거미줄, 익절, 손절 조건을 작성하세요."
                />
              </div>

              <div className="b-bot-actions">
                <button
                  type="submit"
                  className="b-btn b-btn--primary"
                  disabled={botSaving}
                >
                  {botSaving ? "저장 중..." : "규칙 & 설정 저장"}
                </button>
                {botSaveMsg && (
                  <span className="b-bot-save-msg">{botSaveMsg}</span>
                )}
              </div>
            </form>
          </div>

          {/* Gemini AI 실시간 진단기 */}
          <div className="b-card b-bot-ai-card">
            <div className="b-card__head">
              <span className="b-card__tag">GEMINI AI QUANT DIAGNOSTIC</span>
              <button
                type="button"
                className="b-btn b-btn--ai"
                onClick={handleAiDiagnose}
                disabled={aiLoading}
              >
                {aiLoading ? "AI 분석 중..." : "⚡ 실시간 시장 AI 전략 진단 실행"}
              </button>
            </div>

            <div className="b-ai-content">
              {aiLoading ? (
                <div className="b-ai-loading">
                  <div className="b-spinner" />
                  <p>
                    Gemini AI가 실시간 1B 마켓 데이터와 사용자 거미줄 숏
                    규칙을 대조 분석하고 있습니다...
                  </p>
                </div>
              ) : aiError ? (
                <div className="b-ai-error">
                  <span>AI 진단 오류: {aiError}</span>
                </div>
              ) : aiReport ? (
                <div className="b-ai-report">
                  <pre>{aiReport}</pre>
                </div>
              ) : (
                <div className="b-ai-placeholder">
                  <p>
                    [실시간 시장 AI 전략 진단 실행] 버튼을 누르면, 현재 1B 이상
                    코인들의 호가/펀딩비 데이터와 사용자의 프롬프트를 바탕으로
                    실시간 전략 브리핑이 생성됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </PageTransition>
  );
}

/**
 * TradingView 바이낸스 선물 실시간 차트 위젯 컴포넌트
 */
function TradingViewChart({ symbol }) {
  const containerRef = useRef(null);

  // 선물 심볼 포맷: BINANCE:BTCUSDT.P
  const cleanSymbol = (symbol || "BTCUSDT").toUpperCase();
  const tvSymbol = `BINANCE:${cleanSymbol}.P`;

  const iframeSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FSeoul&withdateranges=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=kr&utm_source=gwon.run`;

  return (
    <div className="b-chart-frame" ref={containerRef}>
      <iframe
        key={tvSymbol}
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
