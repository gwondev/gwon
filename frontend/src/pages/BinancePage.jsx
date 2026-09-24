import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import WalletBar from "../components/binance/WalletBar";
import PositionPanel from "../components/binance/PositionPanel";
import TopPick from "../components/binance/TopPick";
import OpportunityList from "../components/binance/OpportunityList";
import RulesPanel from "../components/binance/RulesPanel";
import "./BinancePage.css";

export default function BinancePage() {
  const { isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();

  const [walletExpanded, setWalletExpanded] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [positions, setPositions] = useState({ manual: null, bot: null });
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [botSettings, setBotSettings] = useState(null);
  const [botSaving, setBotSaving] = useState(false);
  const [botSaveMsg, setBotSaveMsg] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthed || !isSuperAdmin)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthed, isSuperAdmin, navigate]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/dashboard", { token });
      setDashboard(data);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  }, [token]);

  const loadPositions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/positions", { token });
      if (data.ok) setPositions({ manual: data.manual, bot: data.bot });
    } catch (err) {
      console.error("Positions load error:", err);
    }
  }, [token]);

  const loadOpportunities = useCallback(
    async (refresh = false) => {
      if (!token) return;
      setOpportunitiesLoading(true);
      try {
        const data = await api(`/binance/opportunities${refresh ? "?refresh=1" : ""}`, { token });
        if (data.ok) setOpportunities(data.opportunities || []);
      } catch (err) {
        console.error("Opportunities load error:", err);
      } finally {
        setOpportunitiesLoading(false);
      }
    },
    [token]
  );

  const loadBotSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/bot", { token });
      if (data.ok) setBotSettings(data.settings);
    } catch (err) {
      console.error("Bot settings load error:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    loadDashboard();
    loadPositions();
    loadOpportunities();
    loadBotSettings();
  }, [token, isSuperAdmin, loadDashboard, loadPositions, loadOpportunities, loadBotSettings]);

  // 폴링: 대시보드/포지션은 자주, 기회 리스트는 서버 캐시 TTL(5분)에 맞춰 느리게
  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    const dashTimer = setInterval(loadDashboard, 20000);
    const posTimer = setInterval(loadPositions, 8000);
    const oppTimer = setInterval(() => loadOpportunities(false), 60000);
    return () => {
      clearInterval(dashTimer);
      clearInterval(posTimer);
      clearInterval(oppTimer);
    };
  }, [token, isSuperAdmin, loadDashboard, loadPositions, loadOpportunities]);

  const handleSaveBot = async (payload) => {
    setBotSaving(true);
    setBotSaveMsg("");
    try {
      await api("/binance/bot", { method: "PUT", token, body: payload });
      setBotSaveMsg("✓ 저장되었습니다.");
      await loadBotSettings();
      await loadDashboard();
      setTimeout(() => setBotSaveMsg(""), 4000);
    } catch (err) {
      setBotSaveMsg(`저장 실패: ${err.message}`);
    } finally {
      setBotSaving(false);
    }
  };

  if (authLoading || !isAuthed || !isSuperAdmin) {
    return null;
  }

  const bestPick = opportunities[0] || null;
  const runnersUp = opportunities.slice(1, 4);

  return (
    <PageTransition className="page binance-page">
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
            <span className="b-title__gold">POSITION</span> SCANNER
          </h1>
          <span className="b-subtitle">롱/숏 통합 진입 후보 스캐너 · AI 스코어링 & 자동매매 봇</span>
        </div>
      </motion.header>

      <WalletBar
        dashboard={dashboard}
        expanded={walletExpanded}
        onToggle={() => setWalletExpanded((v) => !v)}
      />

      <TopPick best={bestPick} runnersUp={runnersUp} loading={opportunitiesLoading} />

      <OpportunityList
        items={opportunities}
        loading={opportunitiesLoading}
        onRefresh={() => loadOpportunities(true)}
      />

      <RulesPanel settings={botSettings} onSave={handleSaveBot} saving={botSaving} saveMsg={botSaveMsg} />

      <div className="b-position-grid">
        <PositionPanel mode="manual" data={positions.manual} />
        <PositionPanel mode="bot" data={positions.bot} />
      </div>
    </PageTransition>
  );
}
