import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { worldState } from "./worldState.js";
import {
  CONNECT_START,
  INTRO_END,
  JOURNEY_PROJECTS,
  PROFILE_START,
  PROJECT_SPAN,
  projectIndexAt,
  projectLocal,
  projectStage,
  matchLive,
} from "../../lib/journey.js";
import { usePortfolioPreview } from "../../lib/usePortfolioPreview.js";
import { mediaCoverImage } from "../../lib/media.js";
import { formatCareerPeriodPreview } from "../../lib/format.js";
import { isProjectRecord } from "../../lib/sections.js";
import "./WorldExperience.css";

const NeuralCanvas = lazy(() => import("./neural/NeuralCanvas.jsx"));

function detectEnv() {
  worldState.mobile = window.innerWidth < 768;
  worldState.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function useResolvedImages(liveProjects) {
  const [map, setMap] = useState({});
  useEffect(() => {
    let alive = true;
    const next = {};
    const jobs = JOURNEY_PROJECTS.map((p) => {
      const live = (liveProjects || []).find((it) => matchLive(it, p));
      const fromDb = mediaCoverImage(live?.media);
      const candidates = fromDb
        ? [fromDb, p.image, p.image.replace(".png", ".webp")]
        : [p.image, p.image.replace(".png", ".webp")];
      return probe(candidates).then((url) => {
        next[p.id] = url;
      });
    });
    Promise.all(jobs).then(() => {
      if (alive) setMap(next);
    });
    return () => {
      alive = false;
    };
  }, [liveProjects]);
  return map;
}

function probe(urls) {
  return new Promise((resolve) => {
    const tryAt = (i) => {
      if (i >= urls.length) {
        resolve("");
        return;
      }
      const src = urls[i];
      if (!src) {
        tryAt(i + 1);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => tryAt(i + 1);
      img.src = src;
    };
    tryAt(0);
  });
}

export default function WorldExperience() {
  const root = useRef(null);
  const { preview } = usePortfolioPreview();
  const liveProjects = useMemo(() => (preview.projects || []).filter(isProjectRecord), [preview.projects]);
  const images = useResolvedImages(liveProjects);
  const [progress, setProgress] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [tab, setTab] = useState("experience");

  useEffect(() => {
    detectEnv();
    setWebgl(hasWebGL());
    worldState.hoverIndex = -1;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => {
      worldState.reduced = reducedQuery.matches;
    };
    reducedQuery.addEventListener("change", onReduce);

    let raf = 0;
    const sync = () => {
      const el = root.current;
      if (!el) return;
      const max = Math.max(1, el.scrollHeight - window.innerHeight);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / max));
      worldState.progress = p;
      setProgress(p);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    const onPointer = (e) => {
      worldState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      worldState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", () => {
      detectEnv();
      sync();
    });
    return () => {
      reducedQuery.removeEventListener("change", onReduce);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const idx = projectIndexAt(progress);
  const { t } = projectLocal(progress);
  const stage = idx >= 0 ? projectStage(t) : { id: progress < INTRO_END ? "intro" : "after", u: 0 };
  const project = idx >= 0 ? JOURNEY_PROJECTS[idx] : null;
  const showHero = progress < INTRO_END + 0.02;
  const showProject = idx >= 0 && (stage.id === "arrive" || stage.id === "read" || (stage.id === "leave" && stage.u < 0.55));
  const showConnect = progress >= CONNECT_START && progress < PROFILE_START;
  const showProfile = progress >= PROFILE_START;
  const imageReveal = !project
    ? 0
    : stage.id === "arrive"
      ? stage.u
      : stage.id === "read"
        ? 1
        : stage.id === "leave"
          ? 1 - stage.u
          : 0;
  const textReveal = stage.id === "read" ? Math.min(1, stage.u * 1.4) : stage.id === "leave" ? 1 - stage.u : 0;

  const scrollToProject = (i) => {
    const el = root.current;
    if (!el) return;
    const max = Math.max(1, el.scrollHeight - window.innerHeight);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const p = INTRO_END + i * PROJECT_SPAN + PROJECT_SPAN * 0.68;
    window.scrollTo({ top: top + p * max, behavior: worldState.reduced ? "auto" : "smooth" });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const cur = Math.max(0, idx);
      const next = e.key === "ArrowDown" ? Math.min(JOURNEY_PROJECTS.length - 1, cur + 1) : Math.max(0, cur - 1);
      scrollToProject(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]);

  const activities = preview.activities || [];
  const career = preview.career || [];
  const certs = preview.certifications || [];

  return (
    <main className="page world-page" ref={root}>
      <div className="world-pin">
        {webgl ? (
          <Suspense fallback={<div className="world-boot" />}>
            <NeuralCanvas />
          </Suspense>
        ) : (
          <div className="world-boot" />
        )}

        <p className="world-counter" aria-live="polite">
          {idx >= 0 ? `${String(idx + 1).padStart(2, "0")} / ${String(JOURNEY_PROJECTS.length).padStart(2, "0")}` : showProfile ? "FILE" : "00 / 05"}
        </p>

        <nav className="world-nav" aria-label="Projects">
          <span className="world-nav__track" style={{ transform: `translateY(${Math.max(0, idx) * 2.05}rem)` }} />
          {JOURNEY_PROJECTS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={i === idx ? "is-on" : ""}
              onMouseEnter={() => {
                if (!worldState.mobile) worldState.hoverIndex = i;
              }}
              onMouseLeave={() => {
                worldState.hoverIndex = -1;
              }}
              onClick={() => scrollToProject(i)}
            >
              <i />
              <span>{p.no}</span>
              {p.title}
            </button>
          ))}
        </nav>

        {showHero && (
          <header className="world-hero">
            <p className="world-kicker">ENGINEER</p>
            <h1>이성권</h1>
            <p className="world-line">systems from hardware to infrastructure</p>
          </header>
        )}

        {showProject && project && (
          <section className={`world-proj is-${idx % 3} ${stage.id === "leave" ? "is-out" : ""}`} aria-label={project.title}>
            <div
              className="world-proj__visual"
              style={{
                opacity: imageReveal,
                filter: `blur(${(1 - imageReveal) * 16}px)`,
                transform: `scale(${1.05 - imageReveal * 0.05})`,
              }}
            >
              {images[project.id] ? (
                <img src={images[project.id]} alt={project.imageAlt} />
              ) : (
                <div className="world-proj__void" aria-hidden />
              )}
            </div>
            <div className="world-proj__copy" style={{ opacity: Math.max(textReveal, imageReveal * 0.4) }}>
              <p className="world-kicker">
                PROJECT {project.no}
                {project.period ? ` · ${project.period}` : ""}
                {project.role ? ` · ${project.role}` : ""}
              </p>
              <h2>{project.title}</h2>
              <p className="world-line">{project.subtitle}</p>
              {textReveal > 0.35 && <p className="world-desc">{project.description}</p>}
              {textReveal > 0.55 && (
                <p className="world-meta">
                  {project.keywords.join("  ·  ")}
                  {project.stack?.length ? `  —  ${project.stack.slice(0, 6).join(" / ")}` : ""}
                </p>
              )}
              {textReveal > 0.75 && project.result && <p className="world-result">{project.result}</p>}
            </div>
          </section>
        )}

        {showConnect && (
          <div className="world-hero">
            <p className="world-kicker">THE SYSTEM</p>
            <h1>CONNECT.</h1>
            <p className="world-line">GWON · METER · GREENEYE · TRESS · DEVSIGN</p>
          </div>
        )}

        {showProfile && (
          <section className="world-file" aria-label="Profile">
            <div className="world-file__tabs" role="tablist">
              {[
                ["experience", "EXPERIENCE"],
                ["career", "CAREER"],
                ["certs", "CERTIFICATIONS"],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div key={tab} className="world-file__panel">
              {tab === "experience" && <FileList items={activities} titleOf={(it) => it.title} subOf={(it) => [it.role, it.period].filter(Boolean).join(" · ")} />}
              {tab === "career" && (
                <FileList
                  items={career}
                  titleOf={(it) => it.title}
                  subOf={(it) => [it.position || it.category, formatCareerPeriodPreview(it.period) || it.period].filter(Boolean).join(" · ")}
                />
              )}
              {tab === "certs" && <FileList items={certs} titleOf={(it) => it.title} subOf={(it) => [it.issuer, it.acquired || it.score].filter(Boolean).join(" · ")} />}
            </div>
            <footer className="world-end">
              <p className="world-kicker">이성권</p>
              <p className="world-end__mark">BUILD. CONNECT. DEPLOY.</p>
              <div className="world-end__links">
                <a href="mailto:gwondev0323@gmail.com">Email</a>
                <a href="https://github.com/gwondev" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
            </footer>
          </section>
        )}
      </div>
      <div className="world-spacer" aria-hidden />
    </main>
  );
}

function FileList({ items, titleOf, subOf }) {
  if (!items?.length) return <p className="world-empty">—</p>;
  return (
    <ul>
      {items.map((it) => (
        <li key={it.id}>
          <b>{titleOf(it)}</b>
          <span>{subOf(it)}</span>
        </li>
      ))}
    </ul>
  );
}
