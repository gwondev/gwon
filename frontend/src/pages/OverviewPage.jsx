import { useEffect, useState } from "react";
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

// 섹션별 표 컬럼 정의 (DB 컬럼 -> 헤더 라벨)
const TABLE_COLUMNS = {
  projects: [
    { field: "title", label: "프로젝트명" },
    { field: "category", label: "분류" },
    { field: "host", label: "주관처" },
    { field: "team_name", label: "팀명" },
    { field: "period", label: "기간" },
    { field: "award", label: "결과" },
  ],
  activities: [
    { field: "title", label: "활동명" },
    { field: "organization", label: "단체" },
    { field: "role", label: "역할" },
    { field: "period", label: "기간" },
  ],
  certifications: [
    { field: "title", label: "자격증명" },
    { field: "issuer", label: "발급기관" },
    { field: "acquired", label: "취득일" },
    { field: "score", label: "등급/점수" },
  ],
  career: [
    { field: "title", label: "회사 / 소속" },
    { field: "position", label: "직무" },
    { field: "period", label: "기간" },
  ],
};

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export default function OverviewPage() {
  const [data, setData] = useState({});

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
      setData(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const total = SECTIONS.reduce((sum, s) => sum + (data[s.key]?.length || 0), 0);

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

      {/* 전체 요약 — 각 페이지 DB를 표로 요약 */}
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

        {SECTIONS.map((s) => {
          const cols = TABLE_COLUMNS[s.key];
          const rows = data[s.key] || [];
          return (
            <div className="db-table" key={s.key}>
              <div className="db-table__head">
                <h3 className="db-table__title">{s.title}</h3>
                <span className="db-table__count">{rows.length}건</span>
              </div>

              {rows.length === 0 ? (
                <div className="db-table__empty">등록된 데이터가 없습니다.</div>
              ) : (
                <div className="db-table__scroll">
                  <table className="db-table__table">
                    <thead>
                      <tr>
                        {cols.map((c) => (
                          <th key={c.field}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          {cols.map((c) => (
                            <td key={c.field}>{row[c.field] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </motion.section>
    </PageTransition>
  );
}
