import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { SECTIONS } from "../lib/sections";
import "./RootPage.css";

// 한번에 보기 + 4개 섹션 = 가로 5개 카드
const CARDS = [
  {
    key: "overview",
    path: "/overview",
    no: "00",
    title: "한번에 보기",
    sub: "Overview",
    desc: "기술스택·소개·전체 요약.",
  },
  ...SECTIONS,
];

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

  return (
    <PageTransition className="page root">
      <motion.section className="hero" variants={heroStagger} initial="hidden" animate="show">
        <motion.h1 className="display hero__name" variants={rise}>
          이성권
        </motion.h1>
        <motion.p className="lead hero__lead" variants={rise}>
          저의 스펙을 보여드리는 웹사이트입니다.
        </motion.p>
      </motion.section>

      <motion.div className="root__grid" variants={gridStagger} initial="hidden" animate="show">
        {CARDS.map((s) => (
          <motion.button
            key={s.key}
            variants={cardRise}
            className={`cat-card ${s.key === "overview" ? "cat-card--overview" : ""}`}
            onClick={() => navigate(s.path)}
            whileHover={{ y: -14 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <span className="cat-card__sheen" aria-hidden />
            <span className="cat-card__no">{s.no}</span>
            <span className="cat-card__body">
              <span className="cat-card__title">{s.title}</span>
              <span className="cat-card__sub">{s.sub}</span>
            </span>
            <span className="cat-card__foot">
              <span className="cat-card__desc">{s.desc}</span>
              <span className="cat-card__arrow">→</span>
            </span>
          </motion.button>
        ))}
      </motion.div>
    </PageTransition>
  );
}
