export default function WalletBar({ dashboard, expanded, onToggle }) {
  const wallet = dashboard?.futures?.usdt?.walletBalance ?? 0;
  const userPnl = dashboard?.realizedPnl?.MANUAL ?? 0;
  const isPaper = dashboard?.bot?.paperMode;
  const botPnl = isPaper ? dashboard?.paperBotPnl ?? 0 : dashboard?.realizedPnl?.BOT ?? 0;

  return (
    <div className={`b-wallet-bar ${expanded ? "is-expanded" : ""}`}>
      <button type="button" className="b-wallet-bar__summary" onClick={onToggle}>
        <span className="b-wallet-bar__label">선물 지갑 잔고</span>
        <strong className="b-wallet-bar__value">
          {Number(wallet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
          USDT
        </strong>
        {dashboard?.bot?.autoPaused && (
          <span className="b-status-pill b-status-pill--warn">봇 자동정지됨</span>
        )}
        <span className="b-wallet-bar__chevron">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="b-wallet-bar__detail">
          <div className="b-wallet-bar__stat">
            <span>사용자 누적 실현손익</span>
            <strong className={userPnl >= 0 ? "is-profit" : "is-loss"}>
              {userPnl >= 0 ? "+" : ""}
              {Number(userPnl).toFixed(2)} USDT
            </strong>
          </div>
          <div className="b-wallet-bar__stat">
            <span>봇 누적 {isPaper ? "모의 손익" : "실현손익"}</span>
            <strong className={botPnl >= 0 ? "is-profit" : "is-loss"}>
              {botPnl >= 0 ? "+" : ""}
              {Number(botPnl).toFixed(2)} USDT
            </strong>
          </div>
          <div className="b-wallet-bar__stat">
            <span>봇 상태</span>
            <strong>
              {dashboard?.bot?.isActive
                ? dashboard?.bot?.paperMode
                  ? "모의 운영 중"
                  : "실전 운영 중"
                : "일시정지"}
              {dashboard?.bot?.hasOpenPosition ? " · 포지션 보유 중" : " · 대기 중"}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
