import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import PortfolioChat from "../components/PortfolioChat";
import { SECTIONS } from "../lib/sections";
import { api } from "../lib/api";
import { formatCareerPeriodPreview } from "../lib/format";
import "./RootPage.css";

const RESOURCE_BY_KEY = {
  projects: "projects",
  activities: "activities",
  certifications: "certifications",
  career: "careers",
};

// 카드 미리보기 한 줄 포맷 (DB row -> 텍스트)
const PREVIEW = {
  projects: (it) =>
    (it.team_name || it.title) + (it.award ? ` (${it.award})` : ""),
  activities: (it) => it.title,
  certifications: (it) => it.title + (it.score ? ` (${it.score})` : ""),
  career: (it) => {
    const span = formatCareerPeriodPreview(it.period);
    return it.title + (span ? ` (${span})` : "");
  },
};

const PREVIEW_LIMIT = 3;

const heroStagger = {
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

const gridStagger = {
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } },
};
const cardRise = {
  hidden: { opacity: 0, y: 48 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
};

export default function RootPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all(
      SECTIONS.map((s) =>
        api(`/${RESOURCE_BY_KEY[s.key]}`)
          .then((d) => ({ key: s.key, items: d.items || [] }))
          .catch(() => ({ key: s.key, items: [] }))
      )
    ).then((results) => {
      if (!alive) return;
      const next = {};
      for (const { key, items } of results) next[key] = items;
      setPreview(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PageTransition className="page root">
      <motion.section className="hero" variants={heroStagger} initial="hidden" animate="show">
        <motion.h1 className="display hero__name" variants={rise}>
          이성권
        </motion.h1>
        <motion.p className="lead hero__lead" variants={rise}>
          PORTFOLIO OF LEE SEONG-GWON.
        </motion.p>
      </motion.section>

      <PortfolioChat />

      <motion.button
        className="overview-bar"
        onClick={() => navigate("/overview")}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.99 }}
      >
        <span className="overview-bar__sheen" aria-hidden />
        <span className="overview-bar__center">
          <span className="overview-bar__title">
            <span className="overview-bar__star" aria-hidden>★</span>
            한번에 보기
          </span>
          <span className="overview-bar__sub">기술스택 · 소개 · 전체 요약</span>
        </span>
      </motion.button>

      <motion.div className="root__grid" variants={gridStagger} initial="hidden" animate="show">
        {SECTIONS.map((s) => {
          const rows = (preview[s.key] || []).slice(0, PREVIEW_LIMIT);
          return (
            <motion.button
              key={s.key}
              variants={cardRise}
              className="cat-card"
              onClick={() => navigate(s.path)}
              whileHover={{ y: -12 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <span className="cat-card__sheen" aria-hidden />
              <span className="cat-card__body">
                <span className="cat-card__title">{s.title}</span>
                <span className="cat-card__sub">{s.sub}</span>
                <span className="cat-card__preview">
                  {rows.length > 0 ? (
                    rows.map((it) => (
                      <span className="cat-card__preview-item" key={it.id}>
                        {PREVIEW[s.key](it)}
                      </span>
                    ))
                  ) : (
                    <span className="cat-card__preview-empty">아직 등록된 항목 없음</span>
                  )}
                </span>
              </span>
              <span className="cat-card__foot">
                <span className="cat-card__arrow">→</span>
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </PageTransition>
  );
}
