import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import QuickActions from "../components/QuickActions";
import { SECTIONS, isCompetition, isProjectRecord } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { formatTechItemLabel } from "../lib/techStackDisplay";
import { api } from "../lib/api";
import { formatCareerPeriodPreview } from "../lib/format";
import { splitTags } from "../lib/media";
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
  activities: (it) => it.title,
  certifications: (it) => it.title + (it.score ? ` (${it.score})` : ""),
  career: (it) => {
    const span = formatCareerPeriodPreview(it.period);
    return it.title + (span ? ` (${span})` : "");
  },
};

function previewRows(key, preview, techGroups) {
  if (key === "techstack") {
    return techGroups.map((g) => ({
      kind: "text",
      text: `[${g.group}] ${g.items.map(formatTechItemLabel).join(", ")}`,
    }));
  }

  const pool = preview.projects || [];
  const items =
    key === "competitions"
      ? pool.filter(isCompetition)
      : key === "projects"
        ? pool.filter(isProjectRecord)
        : preview[key] || [];

  if (key === "projects") {
    return items.map((it) => ({
      kind: "project",
      team: String(it.team_name || "").trim() || String(it.title || "").trim(),
      tags: splitTags(it.category),
    }));
  }

  return items.map((it) => ({ kind: "text", text: PREVIEW[key](it) }));
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

        <QuickActions />
      </div>

      <motion.div className="root__grid root__grid--sub" variants={gridStagger} initial="hidden" animate="show">
        {SECTIONS.map((s) => {
          const rows = previewRows(s.key, preview, techGroups);
          return (
            <motion.button
              key={s.key}
              variants={cardRise}
              className="cat-card"
              onClick={() => navigate(s.path)}
              whileHover={{ y: -6, opacity: 0.92 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <span className="cat-card__sheen" aria-hidden />
              <span className="cat-card__body">
                <span className="cat-card__title">{s.title}</span>
                <span className="cat-card__divider" aria-hidden />
                <span className="cat-card__preview">
                  {rows.length > 0 ? (
                    rows.map((row, i) =>
                      row.kind === "project" ? (
                        <span
                          className="cat-card__preview-item cat-card__preview-item--project"
                          key={`${s.key}-${i}`}
                        >
                          <span className="cat-card__preview-team">
                            {truncatePreview(row.team, previewMax)}
                          </span>
                          {row.tags.map((tag) => (
                            <span className="cat-card__preview-tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="cat-card__preview-item" key={`${s.key}-${i}`}>
                          {truncatePreview(row.text, previewMax)}
                        </span>
                      )
                    )
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
