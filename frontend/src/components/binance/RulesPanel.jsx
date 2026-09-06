import { useState, useEffect } from "react";

export default function RulesPanel({ settings, onSave, saving, saveMsg }) {
  const [tradingRulesPrompt, setTradingRulesPrompt] = useState("");
  const [scoringPrompt, setScoringPrompt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [paperMode, setPaperMode] = useState(true);
  const [maxMarginUsdt, setMaxMarginUsdt] = useState(20);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTradingRulesPrompt(settings.tradingRulesPrompt || "");
    setScoringPrompt(settings.scoringPrompt || "");
    setIsActive(Boolean(settings.isActive));
    setPaperMode(Boolean(settings.paperMode));
    setMaxMarginUsdt(settings.maxMarginUsdt ?? 20);
  }, [settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      tradingRulesPrompt,
      scoringPrompt,
      isActive,
      paperMode,
      maxMarginUsdt: Number(maxMarginUsdt),
    });
  };

  return (
    <section className="b-section b-rules-section">
      <div className="b-section__header">
        <h2 className="b-section__title">매매 규칙 & 안전 설정</h2>
        <button
          type="button"
          className="b-btn b-btn--xs"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {!collapsed && (
        <form className="b-card b-rules-form" onSubmit={handleSubmit}>
          {settings?.autoPaused && (
            <div className="b-alert b-alert--warning">
              ⚠️ 연속 오류로 봇이 안전 자동정지되었습니다: {settings.lastErrorMessage || "원인 미상"}.
              저장하면 다시 활성화됩니다.
            </div>
          )}

          <div className="b-safety-controls">
            <label className="b-toggle-label">
              <span>봇 활성화:</span>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span className={isActive ? "is-on" : "is-off"}>{isActive ? "운영 중" : "일시정지"}</span>
            </label>

            <label className="b-toggle-label">
              <span>거래 모드:</span>
              <input type="checkbox" checked={paperMode} onChange={(e) => setPaperMode(e.target.checked)} />
              <span className={paperMode ? "is-paper" : "is-live"}>
                {paperMode ? "모의 매매 (PAPER)" : "실전 매매 (LIVE)"}
              </span>
            </label>

            <label className="b-margin-input">
              <span>봇 최대 증거금 (USDT):</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={maxMarginUsdt}
                onChange={(e) => setMaxMarginUsdt(e.target.value)}
              />
            </label>
          </div>

          <div className="b-field">
            <label className="b-field__label">
              <strong>매매 규칙 (자유 텍스트)</strong>
              <span>레버리지, 마진타입, 진입 금액, 시가총액 제한 등을 자유롭게 서술하세요.</span>
            </label>
            <textarea
              className="b-textarea"
              rows={8}
              value={tradingRulesPrompt}
              onChange={(e) => setTradingRulesPrompt(e.target.value)}
              placeholder="예: 1배 레버리지만 사용, isolated 마진, 최소 진입 금액만 진입..."
            />
          </div>

          <div className="b-field">
            <label className="b-field__label">
              <strong>기회 점수 산정 기준 (자유 텍스트)</strong>
              <span>롱/숏 통합 점수를 어떻게 매길지 서술하세요. 비워두면 기본 기준이 사용됩니다.</span>
            </label>
            <textarea
              className="b-textarea"
              rows={6}
              value={scoringPrompt}
              onChange={(e) => setScoringPrompt(e.target.value)}
              placeholder="비워두면 기본 스코어링 기준(추세/변동성/유동성/펀딩비/뉴스)이 적용됩니다."
            />
          </div>

          <div className="b-bot-actions">
            <button type="submit" className="b-btn b-btn--primary" disabled={saving}>
              {saving ? "저장 중..." : "규칙 & 설정 저장"}
            </button>
            {saveMsg && <span className="b-bot-save-msg">{saveMsg}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
