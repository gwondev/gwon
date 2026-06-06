import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import "./PortfolioChat.css";

export default function PortfolioChat() {
  const [compact, setCompact] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const logRef = useRef(null);

  const visible = compact
    ? messages.length >= 2
      ? messages.slice(-2)
      : messages
    : messages;

  useEffect(() => {
    if (!compact && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, compact]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

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
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e2) {
      setErr(e2.message);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      className="portfolio-chat"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="portfolio-chat__head">
        <span className="portfolio-chat__title">저에 대해 질문해주세요!!</span>
        <button
          type="button"
          className="portfolio-chat__toggle"
          onClick={() => setCompact((c) => !c)}
        >
          {compact ? "전체 보기" : "간략화"}
        </button>
      </div>

      <div
        ref={logRef}
        className={`portfolio-chat__log ${compact ? "is-compact" : "is-full"}`}
      >
        {visible.length === 0 && !busy && (
          <p className="portfolio-chat__placeholder">
            예: 이 사람의 강점은 뭐야? · 어떤 프로젝트를 했어?
          </p>
        )}
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

      {err && <p className="portfolio-chat__err">{err}</p>}

      <form className="portfolio-chat__form" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요"
          maxLength={500}
          disabled={busy}
        />
        <button type="submit" className="btn btn-accent" disabled={busy || !input.trim()}>
          전송
        </button>
      </form>
    </motion.section>
  );
}
