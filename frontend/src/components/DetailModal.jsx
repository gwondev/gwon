import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import "./DetailModal.css";

export default function DetailModal({ open, onClose, title, media = [], children }) {
  const [index, setIndex] = useState(0);
  const hasMedia = media.length > 0;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && hasMedia) setIndex((i) => Math.min(i + 1, media.length - 1));
      else if (e.key === "ArrowLeft" && hasMedia) setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, hasMedia, media.length, onClose]);

  const go = (dir) => setIndex((i) => Math.min(Math.max(i + dir, 0), media.length - 1));
  const current = media[index];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="detail-modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            className="detail-modal"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="detail-modal__close" onClick={onClose} aria-label="닫기">
              ✕
            </button>

            <div className="detail-modal__scroll">
              <div className="detail-modal__info">{children}</div>

              {hasMedia && (
                <div className="detail-modal__gallery">
                  <div className="detail-modal__stage">
                    {media.length > 1 && (
                      <button
                        className="detail-modal__nav detail-modal__nav--prev"
                        onClick={() => go(-1)}
                        disabled={index === 0}
                        aria-label="이전"
                      >
                        ‹
                      </button>
                    )}

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={index}
                        className="detail-modal__slide"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        drag={media.length > 1 ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_e, info) => {
                          if (info.offset.x < -60) go(1);
                          else if (info.offset.x > 60) go(-1);
                        }}
                      >
                        {current?.pdf ? (
                          <div className="detail-modal__pdf">
                            <iframe
                              src={current.pdf}
                              title={current.name || current.caption || "PDF"}
                              className="detail-modal__pdf-frame"
                            />
                            <a
                              className="detail-modal__pdf-open"
                              href={current.pdf}
                              target="_blank"
                              rel="noreferrer"
                            >
                              새 탭에서 PDF 열기 ↗
                            </a>
                          </div>
                        ) : current?.video ? (
                          <video
                            src={current.video}
                            controls
                            playsInline
                            className="detail-modal__video"
                          />
                        ) : current?.image ? (
                          <img src={current.image} alt={current.caption || ""} draggable={false} />
                        ) : null}
                      </motion.div>
                    </AnimatePresence>

                    {media.length > 1 && (
                      <button
                        className="detail-modal__nav detail-modal__nav--next"
                        onClick={() => go(1)}
                        disabled={index === media.length - 1}
                        aria-label="다음"
                      >
                        ›
                      </button>
                    )}
                  </div>

                  {current?.name && current.name.trim() && (
                    <p className="detail-modal__media-name">{current.name.trim()}</p>
                  )}
                  {current?.caption && (
                    <p className="detail-modal__caption">{current.caption}</p>
                  )}

                  {media.length > 1 && (
                    <div className="detail-modal__dots">
                      {media.map((_, i) => (
                        <button
                          key={i}
                          className={`detail-modal__dot ${i === index ? "is-on" : ""}`}
                          onClick={() => setIndex(i)}
                          aria-label={`${i + 1}번째 미디어`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
