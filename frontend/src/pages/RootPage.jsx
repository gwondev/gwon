import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DetailModal from "../components/DetailModal";
import GitHubIcon from "../components/GitHubIcon";
import RecordUrl from "../components/RecordUrl";

const HeroScene = lazy(() => import("../components/home/HeroScene"));
import { isCompetition, isProjectRecord } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { usePortfolioPreview } from "../lib/usePortfolioPreview";
import { parseTechItem } from "../lib/techStackDisplay";
import { splitTags } from "../lib/media";
import { formatProjectHeadline, formatCareerPeriodPreview } from "../lib/format";
import "./RootPage.css";

const EMAIL = "gwondev0323@gmail.com";

export default function RootPage() {
  const { preview } = usePortfolioPreview();
  const { groups: techGroups } = useTechStack();
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);
  const [workIndex, setWorkIndex] = useState(0);

  const projects = (preview.projects || []).filter(isProjectRecord);
  const awards = (preview.projects || []).filter(isCompetition);
  const certs = preview.certifications || [];
  const career = preview.career || [];
  const featured = projects[workIndex] || null;

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
    return out.slice(0, 8);
  }, [techGroups]);

  const copyMail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  const shiftWork = (dir) => {
    if (!projects.length) return;
    setWorkIndex((i) => (i + dir + projects.length) % projects.length);
  };

  return (
    <main className="page home-page">
      <Suspense fallback={null}>
        <HeroScene />
      </Suspense>

      <div className="home-overlay">
        <section className="home-hero">
          <p className="home-hello">
            Hi, I am 이성권 <span className="waving-hand">👋</span>
          </p>
          <h1 className="home-tag">Building AIoT from sensor to deploy</h1>
        </section>

        <div className="home-spacer" />

        <section className="home-bento">
          <article className="home-cell home-cell--work">
            <div className="home-cell__head">
              <p>Work</p>
              {projects.length > 1 && (
                <div className="home-arrows">
                  <button type="button" onClick={() => shiftWork(-1)} aria-label="이전">
                    ‹
                  </button>
                  <button type="button" onClick={() => shiftWork(1)} aria-label="다음">
                    ›
                  </button>
                </div>
              )}
            </div>
            {featured ? (
              <button type="button" className="home-work" onClick={() => setActive(featured)}>
                <span className="home-work__no">{String(workIndex + 1).padStart(2, "0")}</span>
                <strong>{formatProjectHeadline(featured)}</strong>
                <em>{splitTags(featured.category).slice(0, 2).join(" · ") || "Project"}</em>
              </button>
            ) : (
              <p className="home-muted">등록된 프로젝트가 없습니다.</p>
            )}
            <Link className="home-more" to="/projects">
              전체 보기
            </Link>
          </article>

          <article className="home-cell">
            <p>Resume</p>
            <ul>
              {(career[0] ? [career[0]] : []).map((it) => (
                <li key={it.id}>
                  <b>{it.title}</b>
                  <span>{formatCareerPeriodPreview(it.period) || ""}</span>
                </li>
              ))}
              {(certs[0] ? [certs[0]] : []).map((it) => (
                <li key={it.id}>
                  <b>{it.title}</b>
                  <span>{it.score || "자격"}</span>
                </li>
              ))}
              {(awards[0] ? [awards[0]] : []).map((it) => (
                <li key={it.id}>
                  <b>{formatProjectHeadline(it)}</b>
                  <span>{it.award || "수상"}</span>
                </li>
              ))}
              {!career.length && !certs.length && !awards.length && <li className="home-muted">이력이 없습니다.</li>}
            </ul>
            <Link className="home-more" to="/overview">
              한번에 보기
            </Link>
          </article>

          <article className="home-cell">
            <p>Stack & Contact</p>
            <div className="home-chips">
              {flatTech.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="home-cta">
              <button type="button" className="home-beam" onClick={copyMail}>
                <span className="home-beam__ping" />
                <span className="home-beam__dot" />
                {copied ? "Copied" : "Let’s work together"}
              </button>
              <a href={`mailto:${EMAIL}`} className="home-iconlink" aria-label="email">
                ✉
              </a>
              <a
                href="https://github.com/gwondev"
                target="_blank"
                rel="noopener noreferrer"
                className="home-iconlink"
                aria-label="GitHub"
              >
                <GitHubIcon size={14} />
              </a>
            </div>
          </article>
        </section>
      </div>

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
    </main>
  );
}
