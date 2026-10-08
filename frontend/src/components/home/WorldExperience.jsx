import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { worldState } from "./worldState.js";
import {
  CONNECT_START,
  INTRO_END,
  JOURNEY_PROJECTS,
  PROFILE_SCENE,
  PROFILE_START,
  PROJECT_COUNT,
  SCENE_MAX,
  projectIndexAt,
  projectIndexFromScene,
  projectLocal,
  projectStage,
  sceneFromProjectIndex,
  sceneToProgress,
  matchLive,
} from "../../lib/journey.js";
import { usePortfolioPreview } from "../../lib/usePortfolioPreview.js";
import { mediaCoverImage } from "../../lib/media.js";
import { formatCareerPeriodPreview } from "../../lib/format.js";
import { isProjectRecord } from "../../lib/sections.js";
import "./WorldExperience.css";

const NeuralCanvas = lazy(() => import("./neural/NeuralCanvas.jsx"));

const WHEEL_THRESHOLD = 36;
const SWIPE_THRESHOLD = 56;

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
  const [progress, setProgress] = useState(() => sceneToProgress(0));
  const [scene, setScene] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [tab, setTab] = useState("experience");

  const sceneRef = useRef(0);
  const lockRef = useRef(false);
  const accRef = useRef(0);
  const coolRef = useRef(false);
  const lastWheelRef = useRef(0);
  const tweenRef = useRef(null);
  const settleRef = useRef(null);
  const touchYRef = useRef(0);
  const goToRef = useRef(() => {});

  useEffect(() => {
    worldState.progress = sceneToProgress(0);
  }, []);

  goToRef.current = (nextScene) => {
    const clamped = Math.max(0, Math.min(SCENE_MAX, nextScene));
    if (clamped === sceneRef.current) return;
    if (lockRef.current) return;

    const from = sceneRef.current;
    const dist = Math.abs(clamped - from);
    lockRef.current = true;
    sceneRef.current = clamped;
    setScene(clamped);
    accRef.current = 0;

    const target = sceneToProgress(clamped);
    const duration = worldState.reduced ? 0.28 : Math.min(1.85, 1.08 + dist * 0.22);

    tweenRef.current?.kill();
    settleRef.current?.kill();
    tweenRef.current = gsap.to(worldState, {
      progress: target,
      duration,
      ease: "power3.inOut",
      overwrite: true,
      onUpdate: () => {
        setProgress(worldState.progress);
      },
      onComplete: () => {
        worldState.progress = target;
        setProgress(target);
        settleRef.current = gsap.delayedCall(worldState.reduced ? 0.02 : 0.16, () => {
          lockRef.current = false;
          coolRef.current = true;
          accRef.current = 0;
        });
      },
    });
  };

  useEffect(() => {
    detectEnv();
    setWebgl(hasWebGL());
    worldState.hoverIndex = -1;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => {
      worldState.reduced = reducedQuery.matches;
    };
    reducedQuery.addEventListener("change", onReduce);

    const onPointer = (e) => {
      worldState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      worldState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const onResize = () => detectEnv();

    const inProfilePanel = (target) => {
      const el = target instanceof Element ? target : null;
      if (!el) return null;
      return el.closest(".world-file__panel");
    };

    const step = (dir) => {
      goToRef.current(sceneRef.current + dir);
    };

    const onWheel = (e) => {
      const now = performance.now();
      const gap = now - lastWheelRef.current;
      lastWheelRef.current = now;

      if (sceneRef.current === PROFILE_SCENE) {
        const panel = inProfilePanel(e.target);
        if (panel && panel.scrollHeight > panel.clientHeight + 2) {
          const atTop = panel.scrollTop <= 0;
          if (e.deltaY < 0 && atTop) {
            e.preventDefault();
            if (!lockRef.current) step(-1);
          }
          return;
        }
        e.preventDefault();
        if (e.deltaY < 0 && !lockRef.current) step(-1);
        return;
      }

      e.preventDefault();
      if (lockRef.current) return;

      if (coolRef.current) {
        if (gap > 140 || Math.abs(e.deltaY) < 8) {
          coolRef.current = false;
        } else {
          return;
        }
      }

      accRef.current += e.deltaY;
      if (Math.abs(accRef.current) < WHEEL_THRESHOLD) return;
      const dir = accRef.current > 0 ? 1 : -1;
      accRef.current = 0;
      step(dir);
    };

    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const next = e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Spacebar";
      const prev = e.key === "ArrowUp" || e.key === "PageUp";
      if (!next && !prev) return;
      e.preventDefault();
      if (lockRef.current) return;
      step(next ? 1 : -1);
    };

    const onTouchStart = (e) => {
      if (sceneRef.current === PROFILE_SCENE && inProfilePanel(e.target)) return;
      touchYRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e) => {
      if (sceneRef.current === PROFILE_SCENE && inProfilePanel(e.target)) return;
      const y = e.changedTouches[0]?.clientY ?? touchYRef.current;
      const dy = touchYRef.current - y;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      if (lockRef.current) return;
      step(dy > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      reducedQuery.removeEventListener("change", onReduce);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      tweenRef.current?.kill();
      settleRef.current?.kill();
      lockRef.current = false;
    };
  }, []);

  useEffect(() => {
    worldState.quiet = scene === PROFILE_SCENE ? (tab === "certs" ? 0.95 : tab === "career" ? 0.82 : 0.7) : 0;
  }, [scene, tab]);

  const idx = projectIndexAt(progress);
  const navIndex = projectIndexFromScene(scene);
  const { t } = projectLocal(progress);
  const stage = idx >= 0 ? projectStage(t) : { id: progress < INTRO_END ? "intro" : "after", u: 0 };
  const project = idx >= 0 ? JOURNEY_PROJECTS[idx] : null;
  const showHero = progress < INTRO_END + 0.02;
  const showProject = idx >= 0 && (stage.id === "arrive" || stage.id === "read" || (stage.id === "leave" && stage.u < 0.55));
  const showConnect = scene === PROFILE_SCENE && progress >= CONNECT_START && progress < PROFILE_START;
  const showProfile = scene === PROFILE_SCENE && progress >= PROFILE_START;
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

  const activities = preview.activities || [];
  const career = preview.career || [];
  const certs = preview.certifications || [];

  const counterLabel =
    navIndex >= 0
      ? `${String(navIndex + 1).padStart(2, "0")} / ${String(PROJECT_COUNT).padStart(2, "0")}`
      : scene === PROFILE_SCENE
        ? "FILE"
        : "00 / 05";

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
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "is-on" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div key={tab} className="world-file__panel" role="tabpanel">
              {tab === "experience" && (
                <FileList
                  items={activities}
                  titleOf={(it) => it.title}
                  subOf={(it) => [it.organization, it.role, it.period].filter(Boolean).join(" · ")}
                />
              )}
              {tab === "career" &&
                (career.length ? (
                  <FileList
                    items={career}
                    titleOf={(it) => it.title}
                    subOf={(it) => [it.position || it.category, formatCareerPeriodPreview(it.period) || it.period].filter(Boolean).join(" · ")}
                  />
                ) : (
                  <FileList
                    items={activities}
                    titleOf={(it) => it.title}
                    subOf={(it) => [it.role, it.organization, it.period].filter(Boolean).join(" · ")}
                    empty="등록된 경력이 없습니다."
                  />
                ))}
              {tab === "certs" && (
                <FileList
                  items={certs}
                  titleOf={(it) => it.title}
                  subOf={(it) => [it.issuer, it.acquired || it.score].filter(Boolean).join(" · ")}
                  empty="등록된 자격증이 없습니다."
                />
              )}
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

      <p className="world-counter" aria-live="polite">
        {counterLabel}
      </p>

      <nav className={`world-nav${scene === PROFILE_SCENE ? " is-away" : ""}`} aria-label="Projects">
        <span className="world-nav__spine" aria-hidden />
        <span
          className="world-nav__track"
          style={{
            opacity: navIndex >= 0 ? 1 : 0,
            transform: `translateY(${Math.max(0, navIndex) * 2.05}rem)`,
          }}
        />
        {JOURNEY_PROJECTS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={i === navIndex ? "is-on" : ""}
            onMouseEnter={() => {
              if (!worldState.mobile) worldState.hoverIndex = i;
            }}
            onMouseLeave={() => {
              worldState.hoverIndex = -1;
            }}
            onClick={() => goToRef.current(sceneFromProjectIndex(i))}
          >
            <i />
            <span>{p.no}</span>
            <em>{p.title}</em>
          </button>
        ))}
      </nav>
    </main>
  );
}

function FileList({ items, titleOf, subOf, empty = "—" }) {
  if (!items?.length) return <p className="world-empty">{empty}</p>;
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
