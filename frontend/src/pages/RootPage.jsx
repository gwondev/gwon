import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import QuickActions from "../components/QuickActions";
import { useAuth } from "../context/AuthContext";
import { SECTIONS, isCompetition } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { usePortfolioPreview } from "../lib/usePortfolioPreview";
import { formatTechItemLabel } from "../lib/techStackDisplay";
import {
  formatActivityPreviewParts,
  formatCareerPreviewParts,
  formatCertificationPreviewParts,
  formatCompetitionPreviewParts,
  formatProjectPreviewParts,
  orderProjectsForPreview,
} from "../lib/format";
import "./RootPage.css";

function previewLineTitle(row) {
  if (row.kind === "tech") return `[${row.group}] ${row.items}`;
  if (row.kind === "cert") return row.meta ? `${row.main} (${row.meta})` : row.main;
  if (row.kind === "split") {
    if (row.accentFirst && row.accent) return `(${row.accent}) ${row.main}`;
    if (row.accent) return `${row.main}(${row.accent})`;
    return row.main;
  }
  return row.text || "";
}

function previewRows(key, preview, techGroups) {
  if (key === "techstack") {
    return techGroups.map((g) => ({
      kind: "tech",
      group: String(g.group || "").trim().toUpperCase(),
      items: g.items.map(formatTechItemLabel).join(", ").toUpperCase(),
    }));
  }

  const pool = preview.projects || [];

  if (key === "competitions") {
    return pool
      .filter(isCompetition)
      .slice(0, 4)
      .map((it) => ({ kind: "split", ...formatCompetitionPreviewParts(it) }));
  }

  if (key === "projects") {
    return orderProjectsForPreview(pool, 4).map((it) => ({
      kind: "split",
      ...formatProjectPreviewParts(it),
    }));
  }

  const items = preview[key] || [];

  if (key === "activities") {
    return items.slice(0, 4).map((it) => ({
      kind: "split",
      ...formatActivityPreviewParts(it),
    }));
  }

  if (key === "career") {
    return items.slice(0, 4).map((it) => ({
      kind: "split",
      ...formatCareerPreviewParts(it),
    }));
  }

  if (key === "certifications") {
    return items.slice(0, 4).map((it) => ({
      kind: "cert",
      ...formatCertificationPreviewParts(it),
    }));
  }

  return items.map((it) => ({ kind: "plain", text: String(it.title || "") }));
}

function PreviewRow({ row }) {
  const title = previewLineTitle(row);

  if (row.kind === "tech") {
    return (
      <span className="cat-card__preview-item cat-card__preview-item--split" title={title}>
        <span className="cat-card__preview-accent">[{row.group}]</span>
        <span className="cat-card__preview-main"> {row.items}</span>
      </span>
    );
  }

  if (row.kind === "cert") {
    return (
      <span className="cat-card__preview-item cat-card__preview-item--split" title={title}>
        <span className="cat-card__preview-accent">{row.main}</span>
        {row.meta ? <span className="cat-card__preview-main"> ({row.meta})</span> : null}
      </span>
    );
  }

  if (row.kind === "split") {
    return (
      <span className="cat-card__preview-item cat-card__preview-item--split" title={title}>
        {row.accentFirst && row.accent ? (
          <span className="cat-card__preview-accent">({row.accent}) </span>
        ) : null}
        <span className="cat-card__preview-main">{row.main}</span>
        {!row.accentFirst && row.accent ? (
          <span className="cat-card__preview-accent">({row.accent})</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="cat-card__preview-item cat-card__preview-item--plain" title={title}>
      {row.text}
    </span>
  );
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
  const { preview } = usePortfolioPreview();
  const { groups: techGroups } = useTechStack();
  const { isSuperAdmin } = useAuth();

  return (
    <PageTransition className="page root">
      <div className="root__masthead">
        <motion.section className="hero" variants={heroStagger} initial="hidden" animate="show">
          <motion.h1
            className={`display hero__name ${isSuperAdmin ? "hero__name--admin" : ""}`}
            variants={rise}
            onClick={isSuperAdmin ? () => navigate("/data") : undefined}
            role={isSuperAdmin ? "button" : undefined}
            tabIndex={isSuperAdmin ? 0 : undefined}
            onKeyDown={
              isSuperAdmin
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate("/data");
                    }
                  }
                : undefined
            }
            title={isSuperAdmin ? "데이터 보관함 열기" : undefined}
          >
            이성권
          </motion.h1>
          <motion.p className="hero__lead" variants={rise}>
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
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <span className="cat-card__sheen" aria-hidden />
              <span className="cat-card__body">
                <span className="cat-card__title">{s.title}</span>
                <span className="cat-card__divider" aria-hidden />
                <span className="cat-card__preview cat-card__preview--grid">
                  {rows.length > 0 ? (
                    rows.map((row, i) => <PreviewRow key={`${s.key}-${i}`} row={row} />)
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
