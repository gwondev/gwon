import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./ChatAdminPage.css";

export default function ChatAdminPage() {
  const { isAdmin, loading, token, localMode } = useAuth();
  const navigate = useNavigate();

  const [systemPrompt, setSystemPrompt] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const load = useCallback(async () => {
    if (localMode) {
      setSystemPrompt("");
      setExtraPrompt("");
      setLogs([]);
      return;
    }
    try {
      const [promptData, logData] = await Promise.all([
        api("/admin/chat-prompt", { token }),
        api("/admin/chat-logs", { token }),
      ]);
      setSystemPrompt(promptData.systemPrompt || "");
      setExtraPrompt(promptData.extraPrompt || "");
      setLogs(logData.items || []);
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }, [token, localMode]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const save = async (e) => {
    e.preventDefault();
    if (localMode) {
      setMsg({ type: "ok", text: "로컬 모드 — 저장은 서버 배포 후 가능합니다." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api("/admin/chat-prompt", {
        method: "PUT",
        body: { systemPrompt, extraPrompt },
        token,
      });
      setMsg({ type: "ok", text: "AI 프롬프트가 저장되었습니다." });
    } catch (e2) {
      setMsg({ type: "err", text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageTransition className="page chat-admin">
      <div className="chat-admin__top">
        <button type="button" className="chat-admin__home" onClick={() => navigate("/")}>
          메인 화면
        </button>
      </div>

      <motion.header
        className="chat-admin__head"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="eyebrow">ADMIN · AI CHATBOT</span>
        <h1 className="section-title">AI 챗봇 관리</h1>
        <p className="lead chat-admin__desc">
          기본 규칙과 추가 지침은 DB에 저장되며, 메인 화면 챗봇 답변에 반영됩니다.
        </p>
      </motion.header>

      <motion.section
        className="chat-admin__section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      >
        <form className="chat-admin__form" onSubmit={save}>
          <label className="chat-admin__label">
            기본 규칙
            <textarea
              className="chat-admin__area"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              placeholder="AI 기본 답변 규칙"
            />
          </label>
          <label className="chat-admin__label">
            추가 지침
            <textarea
              className="chat-admin__area"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              rows={6}
              placeholder="예: 강점은 백엔드와 IoT 프로젝트 경험입니다. 수상 경력을 우선 언급해주세요."
            />
          </label>
          {msg && (
            <p className={`chat-admin__msg ${msg.type === "err" ? "is-err" : "is-ok"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? "저장 중…" : "지침 저장"}
          </button>
        </form>
      </motion.section>

      <motion.section
        className="chat-admin__section chat-admin__logs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="chat-admin__logs-head">
          <h2 className="chat-admin__logs-title">최근 질문·답변 로그</h2>
          <span className="chat-admin__logs-meta">최대 20건 · 회원은 닉네임, 비회원은 IP</span>
        </div>

        {localMode ? (
          <p className="chat-admin__logs-empty">로컬 모드 — 서버 배포 후 로그가 표시됩니다.</p>
        ) : logs.length === 0 ? (
          <p className="chat-admin__logs-empty">아직 저장된 대화 로그가 없습니다.</p>
        ) : (
          <ul className="chat-admin__log-list">
            {logs.map((log) => (
              <li key={log.id} className="chat-admin__log">
                <div className="chat-admin__log-top">
                  <span
                    className={`chat-admin__log-user ${log.userType === "user" ? "is-user" : "is-guest"}`}
                  >
                    {log.userLabel}
                  </span>
                  <time className="chat-admin__log-time">
                    {new Date(log.createdAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="chat-admin__log-q">
                  <span className="chat-admin__log-label">Q</span>
                  {log.question}
                </p>
                <p className="chat-admin__log-a">
                  <span className="chat-admin__log-label">A</span>
                  {log.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </PageTransition>
  );
}
