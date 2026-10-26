import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconChat } from "./ActionIcons";
import PortfolioChat from "./PortfolioChat";
import "./ChatWidget.css";

export default function ChatWidget({ home = false }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`chat-widget ${home ? "chat-widget--home" : ""}`}>
      <AnimatePresence>
        {open && home && (
          <motion.div
            className="chat-widget__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="chat-widget__square"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <PortfolioChat floating home onClose={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
        {open && !home && (
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
        aria-label={open ? "챗봇 닫기" : "내장 AI 열기"}
        whileHover={home ? undefined : { scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
      >
        {!home && <span className="chat-widget__ring" aria-hidden />}
        <span className="chat-widget__fab-icon">
          {open ? "✕" : <IconChat width={home ? 18 : 22} height={home ? 18 : 22} />}
        </span>
      </motion.button>
    </div>
  );
}
