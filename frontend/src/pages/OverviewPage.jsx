import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import TabNav from "../components/TabNav";
import { api } from "../lib/api";
import { SECTIONS, TECH_STACK, ABOUT } from "../lib/sections";
import "./OverviewPage.css";

const RESOURCE_BY_KEY = {
  projects: "projects",
  activities: "activities",
  certifications: "certifications",
  career: "careers",
};

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all(
      SECTIONS.map((s) =>
        api(`/${RESOURCE_BY_KEY[s.key]}`)
          .then((data) => ({ key: s.key, items: data.items || [] }))
          .catch(() => ({ key: s.key, items: [] }))
      )
    ).then((results) => {
      if (!alive) return;
      const c = {};
      const r = {};
      for (const { key, items } of results) {
        c[key] = items.length;
        r[key] = items.slice(0, 3);
      }
      setCounts(c);
      setRecent(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <PageTransition className="page overview">
      <div className="overview__top">
        <TabNav active="overview" />
      </div>

      <motion.header
        className="overview__head"
        initial="hidden"
        animate="show"
        variants={fade}
      >
        <span className="eyebrow">OVERVIEW · 한번에 보기</span>
        <h1 className="section-title">전체 요약</h1>
        <p className="lead overview__intro">{ABOUT.intro}</p>
      </motion.header>

      {/* 간단 소개 하이라이트 */}
      <motion.section
        className="overview__block"
        initial="hidden"
        animate="show"
        variants={fade}
      >
        <h2 className="overview__block-title">간단 소개</h2>
        <ul className="overview__highlights">
          {ABOUT.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </motion.section>

      {/* 기술 스택 */}
      <motion.section
        className="overview__block"
        initial="hidden"
        animate="show"
        variants={fade}
      >
        <h2 className="overview__block-title">기술 스택</h2>
        <div className="overview__stack">
          {TECH_STACK.map((g) => (
            <div className="stack-group" key={g.group}>
              <span className="stack-group__name">{g.group}</span>
              <div className="stack-group__items">
                {g.items.map((it) => (
                  <span className="stack-chip" key={it}>
                    {it}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 전체 요약 (각 섹션 카운트 + 최근 항목) */}
      <motion.section
        className="overview__block"
        initial="hidden"
        animate="show"
        variants={fade}
      >
        <div className="overview__block-head">
          <h2 className="overview__block-title">전체 요약</h2>
          <span className="overview__total">총 {total}건</span>
        </div>
        <div className="overview__summary">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className="summary-card"
              onClick={() => navigate(s.path)}
            >
              <div className="summary-card__top">
                <span className="summary-card__title">{s.title}</span>
                <span className="summary-card__count">{counts[s.key] ?? 0}</span>
              </div>
              <ul className="summary-card__list">
                {(recent[s.key] || []).length > 0 ? (
                  recent[s.key].map((it) => (
                    <li key={it.id}>{it.title}</li>
                  ))
                ) : (
                  <li className="summary-card__empty">아직 등록된 항목 없음</li>
                )}
              </ul>
              <span className="summary-card__more">자세히 보기 →</span>
            </button>
          ))}
        </div>
      </motion.section>
    </PageTransition>
  );
}
