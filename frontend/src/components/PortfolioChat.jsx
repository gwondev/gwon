import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./PortfolioChat.css";

export default function PortfolioChat({ floating = false, onClose }) {
  const { token, isAuthed, localMode } = useAuth();
  const authedRequest = isAuthed && !localMode && token;

  const [compact, setCompact] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [quota, setQuota] = useState(null);
  const logRef = useRef(null);

  const useCompact = compact && !floating;

  const visible = useCompact
    ? messages.length >= 2
      ? messages.slice(-2)
      : messages
    : messages;

  const guestExhausted = quota?.tier === "guest" && quota.remaining === 0 && !localMode;

  useEffect(() => {
    let alive = true;
    api("/chat/quota", { token: authedRequest ? token : undefined })
      .then((data) => alive && setQuota(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, authedRequest]);

  const hasLog = messages.length > 0 || busy;

  useEffect(() => {
    if (logRef.current && hasLog) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, useCompact, busy, hasLog]);

  const submitMessage = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    if (quota?.remaining === 0) {
      setErr(
        guestExhausted
          ? "오늘 질문 횟수를 모두 사용하셨습니다. 로그인하시면 하루 100회까지 질문하실 수 있습니다."
          : "오늘 질문 가능 횟수를 모두 사용하셨습니다."
      );
      return;
    }

    setInput("");
    setErr(null);
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const history = messages.slice(-8);
      const data = await api("/chat", {
        method: "POST",
        body: { message: text, history },
        token: authedRequest ? token : undefined,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.quota) setQuota(data.quota);
    } catch (e2) {
      if (e2.quota) setQuota(e2.quota);
      setErr(e2.message);
      setMessages((prev) => prev.slice(0, -1));
      if (!textOverride) setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    submitMessage();
  };

  const askExample = (text) => {
    if (busy || quota?.remaining === 0) return;
    submitMessage(text);
  };

  const examplesDisabled = busy || quota?.remaining === 0;

  return (
    <motion.section
      className={`portfolio-chat ${floating ? "portfolio-chat--floating" : ""}`}
      initial={{ opacity: 0, y: floating ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: floating ? 0.35 : 0.75, delay: floating ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="portfolio-chat__head">
        <div className="portfolio-chat__head-text">
          <span className="portfolio-chat__title">
            {floating ? "AI 챗봇" : "저에 대해 질문해주세요!!"}
          </span>
        </div>
        {floating ? (
          <button type="button" className="portfolio-chat__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        ) : (
          <button
            type="button"
            className="portfolio-chat__toggle"
            hidden={!hasLog}
            onClick={() => setCompact((c) => !c)}
          >
            {compact ? "전체 보기" : "간략화"}
          </button>
        )}
      </div>

      {guestExhausted && (
        <p className="portfolio-chat__limit-notice">
          <strong>오늘 무료 질문 횟수를 모두 사용하셨습니다.</strong>
          <br />
          로그인하시면 하루 100회까지 질문하실 수 있습니다. 왼쪽 상단 또는 오른쪽 메뉴에서
          로그인해 주세요.
        </p>
      )}

      {!hasLog && (
        <div className="portfolio-chat__examples">
          <button
            type="button"
            className="portfolio-chat__example"
            disabled={examplesDisabled}
            onClick={() => askExample("이성권의 강점")}
          >
            이성권의 강점
          </button>
          <button
            type="button"
            className="portfolio-chat__example"
            disabled={examplesDisabled}
            onClick={() => askExample("자기소개")}
          >
            자기소개
          </button>
        </div>
      )}

      {hasLog && (
        <div
          ref={logRef}
          className={`portfolio-chat__log ${useCompact ? "is-compact" : "is-full"}`}
        >
          {visible.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={`portfolio-chat__bubble portfolio-chat__bubble--${m.role}`}
            >
              <span className="portfolio-chat__who">{m.role === "user" ? "Q" : "A"}</span>
              <p>{m.content}</p>
            </div>
          ))}
          {busy && (
            <div className="portfolio-chat__bubble portfolio-chat__bubble--assistant">
              <span className="portfolio-chat__who">A</span>
              <p className="portfolio-chat__typing">답변 생성 중…</p>
            </div>
          )}
        </div>
      )}

      {err && <p className="portfolio-chat__err">{err}</p>}

      <form className="portfolio-chat__form" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            quota?.remaining === 0
              ? "오늘 질문 횟수를 모두 사용하셨습니다"
              : "질문을 입력해 주세요"
          }
          maxLength={500}
          disabled={busy || quota?.remaining === 0}
        />
        <button
          type="submit"
          className="btn btn-accent"
          disabled={busy || !input.trim() || quota?.remaining === 0}
        >
          전송
        </button>
      </form>
    </motion.section>
  );
}
