import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import DetailModal from "../components/DetailModal";
import GitHubIcon from "../components/GitHubIcon";
import RecordUrl from "../components/RecordUrl";
import { useAuth } from "../context/AuthContext";
import { isCompetition, isProjectRecord } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { usePortfolioPreview } from "../lib/usePortfolioPreview";
import { parseTechItem } from "../lib/techStackDisplay";
import { splitTags } from "../lib/media";
import { normalizeUrl } from "../lib/url";
import { formatProjectHeadline } from "../lib/format";
import "./RootPage.css";

// 프로젝트별 아이콘 + 그라디언트 (Galaxy 스타일 앱 타일)
const TILE_META = [
  { match: ["gwon"], icon: "🖥️", grad: ["#7dd3fc", "#3b82f6"] },
  { match: ["meter"], icon: "🧭", grad: ["#34d399", "#0ea5e9"] },
  { match: ["greeneye"], icon: "♻️", grad: ["#4ade80", "#16a34a"] },
  { match: ["devsign oj", "devsign(oj)"], icon: "🧑‍💻", grad: ["#c4b5fd", "#818cf8"] },
  { match: ["devsign"], icon: "📚", grad: ["#a78bfa", "#7c3aed"] },
  { match: ["tress"], icon: "🗑️", grad: ["#fbbf24", "#f97316"] },
  { match: ["move"], icon: "🚌", grad: ["#f472b6", "#ec4899"] },
];
const DEFAULT_TILE = { icon: "🚀", grad: ["#7dd3fc", "#b79bff"] };

function tileMeta(item) {
  const key = String(item?.team_name || item?.title || "").trim().toLowerCase();
  const found = TILE_META.find((t) => t.match.some((m) => key.includes(m)));
  return found || DEFAULT_TILE;
}

function ProjectTile({ item, index, onOpen }) {
  const meta = tileMeta(item);
  const tags = splitTags(item.category);
  const url = String(item.url || "").trim();
  const github = String(item.github_url || "").trim();

  return (
    <motion.article
      className="dtile"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
    >
      <div className="dtile__top">
        <span
          className="dtile__icon"
          style={{ background: `linear-gradient(135deg, ${meta.grad[0]}, ${meta.grad[1]})` }}
        >
          {meta.icon}
        </span>
        <div className="dtile__head">
          <h3 className="dtile__title">{formatProjectHeadline(item)}</h3>
          {tags.length > 0 && (
            <div className="dtile__tags">
              {tags.slice(0, 3).map((t) => (
                <span key={t} className="dtile__tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {item.description && <p className="dtile__desc">{item.description}</p>}

      <div className="dtile__foot" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <a className="dtile__visit" href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer">
            바로가기 ↗
          </a>
        ) : (
          <span className="dtile__visit dtile__visit--muted">자세히 보기</span>
        )}
        {github && (
          <a
            className="dtile__github"
            href={normalizeUrl(github)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GitHubIcon size={14} />
          </a>
        )}
      </div>
    </motion.article>
  );
}

export default function RootPage() {
  const { preview } = usePortfolioPreview();
  const { groups: techGroups } = useTechStack();
  const { isSuperAdmin } = useAuth();
  const [active, setActive] = useState(null);

  const projects = (preview.projects || []).filter(isProjectRecord);
  const awardsCount = (preview.projects || []).filter(isCompetition).length;
  const certsCount = (preview.certifications || []).length;
  const careerCount = (preview.career || []).length;

  const flatTech = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const g of techGroups) {
      for (const raw of g.items || []) {
        const { label } = parseTechItem(raw);
        if (label && !seen.has(label)) {
          seen.add(label);
          out.push(label);
        }
      }
    }
    return out;
  }, [techGroups]);

  return (
    <PageTransition className="page root">
      {/* ── COMPACT HERO ── */}
      <section className="dash-hero">
        <div className="dash-hero__id">
          <span className="dash-hero__eyebrow">AIoT ENGINEER · SOLO END-TO-END</span>
          <h1 className={`dash-hero__name ${isSuperAdmin ? "is-admin" : ""}`}>이성권</h1>
          <p className="dash-hero__lead">
            하드웨어 센서 제어부터 Docker 인프라, 배포까지 —{" "}
            <span>서비스의 하드웨어·서버 연결 구간을 혼자 리딩합니다.</span>
          </p>
        </div>
        <div className="dash-hero__stats">
          <div className="dash-stat">
            <b>{projects.length}</b>
            <span>PROJECTS</span>
          </div>
          <div className="dash-stat">
            <b>{awardsCount}</b>
            <span>AWARDS</span>
          </div>
          <div className="dash-stat">
            <b>{certsCount}</b>
            <span>CERTS</span>
          </div>
          <div className="dash-stat">
            <b>{careerCount}</b>
            <span>CAREER</span>
          </div>
        </div>
      </section>

      {/* ── PROJECT DASHBOARD ── */}
      <section className="dash-grid-wrap">
        {projects.length > 0 ? (
          <div className="dash-grid">
            {projects.map((p, i) => (
              <ProjectTile key={p.id ?? `${p.title}-${i}`} item={p} index={i} onOpen={() => setActive(p)} />
            ))}
          </div>
        ) : (
          <p className="root-empty">아직 등록된 프로젝트가 없습니다.</p>
        )}
      </section>

      {/* ── SLIM CLOSER: 기술 스택 + 컨택 ── */}
      <section className="dash-closer">
        {flatTech.length > 0 && (
          <div className="dash-closer__stack">
            {flatTech.map((t) => (
              <span key={t} className="dash-closer__chip">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="dash-closer__contact">
          <a className="btn btn-accent" href="mailto:gwondev0323@gmail.com">
            이메일
          </a>
          <a
            className="btn btn-ghost"
            href="https://github.com/gwondev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon size={15} /> GitHub
          </a>
        </div>
      </section>

      <DetailModal open={Boolean(active)} onClose={() => setActive(null)} title={active ? formatProjectHeadline(active) : ""}>
        {active && (
          <>
            <div className="record__head">
              <span className="record__title">{formatProjectHeadline(active)}</span>
              {splitTags(active.category).map((c) => (
                <span className="record__tag" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <div className="record__meta">
              {active.host && (
                <span>
                  <b>주관처</b>
                  {active.host}
                </span>
              )}
              {active.team_name && (
                <span>
                  <b>팀명</b>
                  {active.team_name}
                </span>
              )}
              {active.members && (
                <span>
                  <b>팀원</b>
                  {active.members}
                </span>
              )}
              {active.period && (
                <span>
                  <b>기간</b>
                  {active.period}
                </span>
              )}
            </div>
            <RecordUrl url={active.url} githubUrl={active.github_url} />
            {active.description && <p className="record__desc">{active.description}</p>}
          </>
        )}
      </DetailModal>
    </PageTransition>
  );
}
