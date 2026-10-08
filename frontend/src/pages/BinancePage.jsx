import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./BinancePage.css";

function formatNumber(v, digits) {
  return Number(v).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function BinancePage() {
  const { isAuthed, loading: authLoading, isSuperAdmin, token } = useAuth();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthed || !isSuperAdmin)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthed, isSuperAdmin, navigate]);

  const loadAsset = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/binance/total-asset", { token });
      if (data.ok) {
        setAsset(data);
        setError("");
      } else {
        setError(data.error || "총자산을 불러오지 못했습니다.");
      }
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    loadAsset();
    const timer = setInterval(loadAsset, 60000);
    return () => clearInterval(timer);
  }, [token, isSuperAdmin, loadAsset]);

  if (authLoading || !isAuthed || !isSuperAdmin) {
    return null;
  }

  return (
    <PageTransition className="page binance-page">
      <motion.section
        className="b-asset"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="b-asset__label">내 지갑 총자산</span>
        {asset ? (
          <>
            <strong className="b-asset__usdt">
              {formatNumber(asset.totalUsdt, 2)} <small>USDT</small>
            </strong>
            {asset.totalKrw != null ? (
              <span className="b-asset__krw">≈ {formatNumber(asset.totalKrw, 0)}원</span>
            ) : (
              <span className="b-asset__krw is-dim">원화 환율을 불러오지 못했습니다.</span>
            )}
            {asset.krwRate != null && (
              <span className="b-asset__rate">
                1 USD = {formatNumber(asset.krwRate, 2)}원 · {asset.krwRateDate} 기준 (매일 갱신)
              </span>
            )}
          </>
        ) : (
          !error && <span className="b-asset__krw is-dim">불러오는 중…</span>
        )}
        {error && <p className="b-asset__error">{error}</p>}
      </motion.section>
    </PageTransition>
  );
}
