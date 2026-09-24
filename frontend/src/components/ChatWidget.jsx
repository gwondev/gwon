import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconChat } from "./ActionIcons";
import PortfolioChat from "./PortfolioChat";
import "./ChatWidget.css";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-widget">
      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-widget__panel"
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <PortfolioChat floating onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`chat-widget__fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "챗봇 닫기" : "AI 챗봇 열기"}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
      >
        <span className="chat-widget__ring" aria-hidden />
        <span className="chat-widget__fab-icon">
          {open ? "✕" : <IconChat width={22} height={22} />}
        </span>
      </motion.button>
    </div>
  );
}
