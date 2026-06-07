import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import PortfolioChat from "../components/PortfolioChat";
import { SECTIONS, isCompetition, isProjectRecord } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { formatTechItemLabel } from "../lib/techStackDisplay";
import { api } from "../lib/api";
import { formatCareerPeriodPreview } from "../lib/format";
import "./RootPage.css";

const RESOURCE_BY_KEY = {
  projects: "projects",
  activities: "activities",
  certifications: "certifications",
  career: "careers",
};

const MOBILE_PREVIEW_MAX = 19;
const MOBILE_MQ = "(max-width: 820px)";

function subscribeMobileMq(cb) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMobileMq() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function truncatePreview(text, max) {
  const s = String(text || "");
  if (!max || s.length <= max) return s;
  return `${s.slice(0, max)}...`;
}

const PREVIEW = {
  competitions: (it) => (it.team_name || it.title) + (it.award ? ` (${it.award})` : ""),
  projects: (it) => it.team_name || it.title,
  activities: (it) => it.title,
  certifications: (it) => it.title + (it.score ? ` (${it.score})` : ""),
  career: (it) => {
    const span = formatCareerPeriodPreview(it.period);
    return it.title + (span ? ` (${span})` : "");
  },
};

function previewLines(key, preview, techGroups) {
  if (key === "techstack") {
    return techGroups.map(
      (g) => `[${g.group}] ${g.items.map(formatTechItemLabel).join(", ")}`
    );
  }

  const pool = preview.projects || [];
  const rows =
    key === "competitions"
      ? pool.filter(isCompetition)
      : key === "projects"
        ? pool.filter(isProjectRecord)
        : preview[key] || [];

  return rows.map((it) => PREVIEW[key](it));
}

const heroStagger = {
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

const gridStagger = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
};
const cardRise = {
  hidden: { opacity: 0, y: 48 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
};

export default function RootPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState({ projects: [] });
  const { groups: techGroups } = useTechStack();
  const isMobile = useSyncExternalStore(subscribeMobileMq, getMobileMq, () => false);
  const previewMax = isMobile ? MOBILE_PREVIEW_MAX : null;

  useEffect(() => {
    let alive = true;
    Promise.all(
      Object.entries(RESOURCE_BY_KEY).map(([key, resource]) =>
        api(`/${resource}`)
          .then((d) => ({ key, items: d.items || [] }))
          .catch(() => ({ key, items: [] }))
      )
    ).then((results) => {
      if (!alive) return;
      const next = { projects: [] };
      for (const { key, items } of results) next[key] = items;
      setPreview(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PageTransition className="page root">
      <div className="root__masthead">
        <motion.section className="hero" variants={heroStagger} initial="hidden" animate="show">
          <motion.h1 className="display hero__name" variants={rise}>
            이성권
          </motion.h1>
          <motion.p className="lead hero__lead" variants={rise}>
            PORTFOLIO OF LEE SEONG-GWON.
          </motion.p>
        </motion.section>

        <PortfolioChat />
      </div>

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
          <span className="overview-bar__title">전체 포트폴리오 요약</span>
          <span className="overview-bar__sub">
            {truncatePreview(
              "프로젝트·경력·스택을 한 페이지에서 펼쳐 보실 수 있습니다",
              previewMax
            )}
          </span>
        </span>
      </motion.button>

      <motion.div className="root__grid" variants={gridStagger} initial="hidden" animate="show">
        {SECTIONS.map((s) => {
          const rows = previewLines(s.key, preview, techGroups);
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
                <span className="cat-card__divider" aria-hidden />
                <span className="cat-card__preview">
                  {rows.length > 0 ? (
                    rows.map((line, i) => (
                      <span className="cat-card__preview-item" key={`${s.key}-${i}`}>
                        {truncatePreview(line, previewMax)}
                      </span>
                    ))
                  ) : (
                    <span className="cat-card__preview-empty">아직 등록된 항목 없음</span>
                  )}
                </span>
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </PageTransition>
  );
}
