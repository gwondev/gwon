import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { IconChat, IconGrid } from "./ActionIcons";
import PortfolioChat from "./PortfolioChat";
import "./QuickActions.css";

const ACTIONS = [
  {
    id: "chat",
    label: "AI 챗봇",
    sub: "포트폴리오 질문",
    glyph: "chat",
  },
  {
    id: "portfolio",
    label: "전체 포트폴리오",
    sub: "한 페이지 요약",
    glyph: "grid",
  },
];

function ActionGlyph({ type }) {
  if (type === "chat") return <IconChat />;
  return <IconGrid />;
}

export default function QuickActions() {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const handleClick = (id) => {
    if (id === "chat") {
      setChatOpen((v) => !v);
      return;
    }
    if (id === "portfolio") {
      navigate("/overview");
    }
  };

  return (
    <div className={`quick-actions ${chatOpen ? "is-chat-open" : ""}`}>
      <div className="quick-actions__buttons" role="toolbar" aria-label="빠른 이동">
        {ACTIONS.map((action, i) => (
          <motion.button
            key={action.id}
            type="button"
            className={`quick-actions__btn ${action.id === "chat" && chatOpen ? "is-active" : ""}`}
            onClick={() => handleClick(action.id)}
            aria-label={action.label}
            initial={{ opacity: 0, y: 28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.65,
              delay: 0.1 + i * 0.09,
              ease: [0.16, 1, 0.3, 1],
            }}
            whileHover={{ y: -10, scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="quick-actions__sheen" aria-hidden />
            <span className="quick-actions__glyph">
              <ActionGlyph type={action.glyph} />
            </span>
            <span className="quick-actions__label">{action.label}</span>
            <span className="quick-actions__sub">{action.sub}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.button
              type="button"
              className="quick-actions__scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              aria-label="챗봇 닫기"
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              className="quick-actions__center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="quick-actions__panel"
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <PortfolioChat floating onClose={() => setChatOpen(false)} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
