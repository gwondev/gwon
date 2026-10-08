import { useMemo, useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DetailModal from "../components/DetailModal";
import GitHubIcon from "../components/GitHubIcon";
import RecordUrl from "../components/RecordUrl";
import { useAuth } from "../context/AuthContext";
import { ABOUT, isCompetition, isProjectRecord } from "../lib/sections";
import { useTechStack } from "../lib/useTechStack";
import { usePortfolioPreview } from "../lib/usePortfolioPreview";
import { parseTechItem } from "../lib/techStackDisplay";
import { splitTags } from "../lib/media";
import { normalizeUrl } from "../lib/url";
import { formatProjectHeadline, formatCareerPeriodPreview } from "../lib/format";
import "./RootPage.css";

gsap.registerPlugin(ScrollTrigger);

const TILE_META = [
  { match: ["gwon"], icon: "01", grad: ["#d8c19a", "#8a7350"] },
  { match: ["meter"], icon: "02", grad: ["#d8c19a", "#8a7350"] },
  { match: ["greeneye"], icon: "03", grad: ["#d8c19a", "#8a7350"] },
  { match: ["devsign oj", "devsign(oj)"], icon: "04", grad: ["#d8c19a", "#8a7350"] },
  { match: ["devsign"], icon: "05", grad: ["#d8c19a", "#8a7350"] },
  { match: ["tress"], icon: "06", grad: ["#d8c19a", "#8a7350"] },
  { match: ["move"], icon: "07", grad: ["#d8c19a", "#8a7350"] },
];

function tileMeta(item, index) {
  const key = String(item?.team_name || item?.title || "").trim().toLowerCase();
  const found = TILE_META.find((t) => t.match.some((m) => key.includes(m)));
  return found || { icon: String(index + 1).padStart(2, "0"), grad: ["#d8c19a", "#8a7350"] };
}

export default function RootPage() {
  const { preview } = usePortfolioPreview();
  const { groups: techGroups } = useTechStack();
  const { isSuperAdmin } = useAuth();
  const [active, setActive] = useState(null);
  const root = useRef(null);
  const pinRef = useRef(null);
  const trackRef = useRef(null);

  const projects = (preview.projects || []).filter(isProjectRecord);
  const awards = (preview.projects || []).filter(isCompetition);
  const certs = preview.certifications || [];
  const career = preview.career || [];

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

  useGSAP(
    () => {
      gsap.from(".home-hero__name", { y: 48, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from(".home-hero__lead", { y: 24, opacity: 0, duration: 0.8, delay: 0.12, ease: "power3.out" });
      gsap.from(".home-hero__stat", {
        y: 18,
        opacity: 0,
        duration: 0.55,
        delay: 0.2,
        stagger: 0.06,
        ease: "power2.out",
      });

      const pin = pinRef.current;
      const track = trackRef.current;
      if (!pin || !track) return;
      const cards = gsap.utils.toArray(".home-work__card", track);
      if (cards.length < 2) return;
      if (window.matchMedia("(max-width: 720px)").matches) return;

      const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top 72px",
          end: () => `+=${distance() + window.innerHeight * 0.35}`,
          pin: true,
          scrub: 0.85,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { rotateY: 16, z: -90, opacity: 0.5, scale: 0.94 },
          {
            rotateY: 0,
            z: 0,
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              containerAnimation: tween,
              start: "left 92%",
              end: "left 42%",
              scrub: true,
            },
          }
        );
      });
    },
    { scope: root, dependencies: [projects.length] }
  );

  return (
    <main className="page home-page" ref={root}>
      <section className="home-hero">
        <p className="home-hero__eyebrow">AIoT ENGINEER · SOLO END-TO-END</p>
        <h1 className={`home-hero__name ${isSuperAdmin ? "is-admin" : ""}`}>이성권</h1>
        <p className="home-hero__lead">
          {ABOUT.intro} 하드웨어 센서 제어부터 Docker 인프라·배포까지,{" "}
          <span>서비스의 하드웨어·서버 연결 구간을 혼자 리딩합니다.</span>
        </p>
        <div className="home-hero__stats">
          <div className="home-hero__stat">
            <b>{projects.length}</b>
            <span>PROJECTS</span>
          </div>
          <div className="home-hero__stat">
            <b>{awards.length}</b>
            <span>AWARDS</span>
          </div>
          <div className="home-hero__stat">
            <b>{certs.length}</b>
            <span>CERTS</span>
          </div>
          <div className="home-hero__stat">
            <b>{career.length}</b>
            <span>CAREER</span>
          </div>
        </div>
      </section>

      <section className="home-work" ref={pinRef}>
        <div className="home-work__head">
          <p className="home-kicker">Selected Works</p>
          <h2>스크롤하면 프로젝트가 옆으로 넘어갑니다.</h2>
        </div>
        {projects.length ? (
          <div className="home-work__viewport">
            <div className="home-work__track" ref={trackRef}>
              {projects.map((p, i) => {
                const meta = tileMeta(p, i);
                const tags = splitTags(p.category);
                return (
                  <article
                    key={p.id ?? `${p.title}-${i}`}
                    className="home-work__card"
                    onClick={() => setActive(p)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(p)}
                  >
                    <span className="home-work__no">{meta.icon}</span>
                    <h3>{formatProjectHeadline(p)}</h3>
                    {tags.length > 0 && (
                      <div className="home-work__tags">
                        {tags.slice(0, 3).map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    )}
                    {p.description && <p>{p.description}</p>}
                    <span className="home-work__more">자세히 보기</span>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="home-empty">아직 등록된 프로젝트가 없습니다.</p>
        )}
      </section>

      <section className="home-resume">
        <p className="home-kicker">Resume</p>
        <div className="home-resume__grid">
          <div>
            <h3>경력</h3>
            {career.length ? (
              career.map((it) => (
                <p key={it.id}>
                  <b>{it.title}</b>
                  <span>{formatCareerPeriodPreview(it.period) || it.period || ""}</span>
                </p>
              ))
            ) : (
              <p className="home-empty">—</p>
            )}
          </div>
          <div>
            <h3>자격증</h3>
            {certs.length ? (
              certs.map((it) => (
                <p key={it.id}>
                  <b>{it.title}</b>
                  <span>{it.score || ""}</span>
                </p>
              ))
            ) : (
              <p className="home-empty">—</p>
            )}
          </div>
          <div>
            <h3>수상</h3>
            {awards.length ? (
              awards.map((it) => (
                <p key={it.id}>
                  <b>{formatProjectHeadline(it)}</b>
                  <span>{it.award || ""}</span>
                </p>
              ))
            ) : (
              <p className="home-empty">—</p>
            )}
          </div>
        </div>
      </section>

      <section className="home-closer">
        {flatTech.length > 0 && (
          <div className="home-marquee" aria-hidden>
            <div className="home-marquee__track">
              {[...flatTech, ...flatTech].map((t, i) => (
                <span key={`${t}-${i}`}>{t}</span>
              ))}
            </div>
          </div>
        )}
        <div className="home-closer__cta">
          <a className="btn btn-accent" href="mailto:gwondev0323@gmail.com">
            이메일
          </a>
          <a className="btn btn-ghost" href="https://github.com/gwondev" target="_blank" rel="noopener noreferrer">
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
    </main>
  );
}
