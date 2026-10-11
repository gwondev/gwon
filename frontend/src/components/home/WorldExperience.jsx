import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { worldState } from "./worldState.js";
import {
  CONNECT_START,
  EXPERIENCE_SCENE,
  INTRO_END,
  JOURNEY_PROJECTS,
  PROFILE_START,
  PROFILE_TABS,
  PROJECT_COUNT,
  SCENE_MAX,
  cinematicEase,
  isProfileScene,
  projectIndexAt,
  projectIndexFromScene,
  projectLocal,
  projectStage,
  profileTabFromScene,
  arriveStartOf,
  regionSceneAt,
  sceneFromProfileTab,
  sceneFromProjectIndex,
  sceneToProgress,
  matchLive,
  warpEndOf,
  warpStartOf,
} from "../../lib/journey.js";
import { usePortfolioPreview } from "../../lib/usePortfolioPreview.js";
import { mediaCoverImage, mediaCoverVideo } from "../../lib/media.js";
import { formatCareerPeriodPreview } from "../../lib/format.js";
import { isProjectRecord } from "../../lib/sections.js";
import "./WorldExperience.css";

const NeuralCanvas = lazy(() => import("./neural/NeuralCanvas.jsx"));

const WHEEL_THRESHOLD = 30;
const WHEEL_REPEAT_THRESHOLD = 280;
const WHEEL_GESTURE_IDLE_MS = 160;
const WHEEL_STEP_GAP_MS = 72;
const SWIPE_THRESHOLD = 56;
const MEDIA_PLAY_DELAY = 420;

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

function useResolvedMedia(liveProjects) {
  const [map, setMap] = useState({});
  useEffect(() => {
    let alive = true;
    const next = {};
    const jobs = JOURNEY_PROJECTS.map((p) => {
      const live = (liveProjects || []).find((it) => matchLive(it, p));
      const fromDb = mediaCoverImage(live?.media);
      const video = mediaCoverVideo(live?.media);
      const candidates = fromDb
        ? [fromDb, p.image, p.image.replace(".png", ".webp")]
        : [p.image, p.image.replace(".png", ".webp")];
      return probe(candidates).then((url) => {
        next[p.id] = { image: url, video };
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

function setWorldEffect(scene) {
  const i = projectIndexFromScene(scene);
  if (i >= 0) {
    worldState.effect = JOURNEY_PROJECTS[i].effect || "none";
    worldState.effectIndex = i;
    return;
  }
  worldState.effect = isProfileScene(scene) ? "network" : "none";
  worldState.effectIndex = -1;
}

export default function WorldExperience() {
  const root = useRef(null);
  const { preview } = usePortfolioPreview();
  const liveProjects = useMemo(() => (preview.projects || []).filter(isProjectRecord), [preview.projects]);
  const media = useResolvedMedia(liveProjects);
  const [progress, setProgress] = useState(() => sceneToProgress(0));
  const [scene, setScene] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [tab, setTab] = useState("experience");

  const sceneRef = useRef(0);
  const targetSceneRef = useRef(0);
  const accRef = useRef(0);
  const lastWheelRef = useRef(0);
  const tweenRef = useRef(null);
  const settleRef = useRef(null);
  const touchYRef = useRef(0);
  const goToRef = useRef(() => {});
  const driveRef = useRef(() => {});
  const wheelRef = useRef({ unit: 0, gestureSteps: 0 });

  useEffect(() => {
    worldState.progress = sceneToProgress(0);
    setWorldEffect(0);
  }, []);

  // 인트로·프로젝트 구간 전용. 진행도만 보고 다음 한 걸음을 정한다.
  // 앞으로: 즉시 다음 워프 시작점으로 점프(내용이 바로 사라짐) → 워프로 진입.
  // 뒤로: 즉시 워프 끝점으로 점프(내용이 바로 사라짐) → 워프를 거꾸로 빠져나와 이전 장면에 안착.
  driveRef.current = () => {
    tweenRef.current?.kill();
    settleRef.current?.kill();
    const tgt = targetSceneRef.current;
    const p = worldState.progress;
    const k = regionSceneAt(p);
    if (k < 0 || isProfileScene(tgt)) return;

    const set = (v) => {
      worldState.progress = v;
      setProgress(v);
    };
    const run = (to, duration, then) => {
      tweenRef.current = gsap.to(worldState, {
        progress: to,
        duration: worldState.reduced ? 0.2 : duration,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => setProgress(worldState.progress),
        onComplete: () => {
          set(to);
          then?.();
        },
      });
    };
    const rush = Math.abs(tgt - k) >= 2;
    const rev = worldState.reverse;
    if (!(tgt < k && rev?.from === k)) worldState.reverse = null;

    if (tgt > k) {
      set(warpStartOf(k + 1));
      run(sceneToProgress(k + 1), rush ? 0.42 : 0.95, () => driveRef.current());
      return;
    }
    if (tgt < k) {
      // 내용은 즉시 숨기고(워프 끝점), 카메라는 역방향 전용 경로로 빠져나온 뒤 이전 장면에 도착한다.
      set(Math.min(p, warpEndOf(k)));
      const back = rev?.from === k ? rev : { from: k, u: 0 };
      worldState.reverse = back;
      const full = rush ? 0.42 : 0.82;
      tweenRef.current = gsap.to(back, {
        u: 1,
        duration: worldState.reduced ? 0.2 : Math.max(0.12, full * (1 - back.u)),
        ease: "none",
        onComplete: () => {
          worldState.reverse = null;
          set(k - 1 >= 1 ? arriveStartOf(k - 1) : sceneToProgress(0));
          driveRef.current();
        },
      });
      return;
    }
    const settle = sceneToProgress(k);
    if (Math.abs(p - settle) > 0.0005) run(settle, 0.55);
  };

  goToRef.current = (nextScene) => {
    const clamped = Math.max(0, Math.min(SCENE_MAX, nextScene));
    const mid = Boolean(tweenRef.current?.isActive?.());
    const inbound = worldState.progress < PROFILE_START - 0.012;
    const target = sceneToProgress(clamped);
    const alreadyThere = Math.abs(worldState.progress - target) < 0.002;

    if (clamped === targetSceneRef.current && (clamped === sceneRef.current || mid) && (alreadyThere || mid)) {
      return;
    }

    const from = targetSceneRef.current;
    const fromProfile = isProfileScene(from);
    const toProfile = isProfileScene(clamped);
    targetSceneRef.current = clamped;
    sceneRef.current = clamped;
    setScene(clamped);
    if (toProfile || fromProfile) setTab(profileTabFromScene(clamped) || "experience");
    accRef.current = 0;
    setWorldEffect(clamped);

    if (!toProfile && regionSceneAt(worldState.progress) >= 0) {
      driveRef.current();
      return;
    }
    worldState.reverse = null;

    if (fromProfile && toProfile && !inbound && alreadyThere) {
      tweenRef.current?.kill();
      settleRef.current?.kill();
      worldState.progress = target;
      setProgress(target);
      return;
    }

    const fromProgress = worldState.progress;
    const dist = Math.abs(target - fromProgress);
    const duration = worldState.reduced
      ? 0.2
      : mid
        ? Math.max(0.28, Math.min(0.78, 0.24 + dist * 1.45))
        : Math.max(0.38, Math.min(1.28, 0.36 + dist * 2.55));

    tweenRef.current?.kill();
    settleRef.current?.kill();
    tweenRef.current = gsap.fromTo(
      worldState,
      { progress: fromProgress },
      {
        progress: target,
        duration,
        ease: mid ? "power2.out" : cinematicEase,
        overwrite: true,
        onUpdate: () => {
          setProgress(worldState.progress);
        },
        onComplete: () => {
          const live = targetSceneRef.current;
          const liveTarget = sceneToProgress(live);
          worldState.progress = liveTarget;
          setProgress(liveTarget);
          if (Math.abs(liveTarget - target) > 0.002) {
            goToRef.current(live);
          }
        },
      }
    );
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
      let next = targetSceneRef.current + dir;
      const flyingToProfile =
        isProfileScene(targetSceneRef.current) && worldState.progress < PROFILE_START - 0.012;
      if (dir > 0 && flyingToProfile) {
        next = EXPERIENCE_SCENE;
      }
      goToRef.current(next);
    };

    const onWheel = (e) => {
      const now = performance.now();
      const dy = e.deltaY;
      const gap = now - lastWheelRef.current;

      if (isProfileScene(targetSceneRef.current)) {
        const panel = inProfilePanel(e.target);
        if (panel && panel.scrollHeight > panel.clientHeight + 2) {
          const atTop = panel.scrollTop <= 0;
          const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
          if (e.deltaY < 0 && atTop) {
            e.preventDefault();
            if (gap >= WHEEL_STEP_GAP_MS) {
              lastWheelRef.current = now;
              step(-1);
            }
          } else if (e.deltaY > 0 && atBottom) {
            e.preventDefault();
            if (gap >= WHEEL_STEP_GAP_MS && targetSceneRef.current < SCENE_MAX) {
              lastWheelRef.current = now;
              step(1);
            }
          }
          return;
        }
      }

      e.preventDefault();
      const px = e.deltaMode === 1 ? dy * 40 : e.deltaMode === 2 ? dy * 800 : dy;
      if (!px) return;
      const dir = px > 0 ? 1 : -1;
      const abs = Math.abs(px);
      const w = wheelRef.current;
      lastWheelRef.current = now;

      // 마우스 휠 한 칸: 크고 매번 같은 크기(또는 빠르게 굴리면 그 배수로 합쳐져) 들어온다
      // → 연타해도 한 칸 = 한 장면, 하나도 버리지 않는다.
      const ratio = w.unit ? abs / w.unit : 0;
      const multiple = ratio >= 0.98 && Math.abs(ratio - Math.round(ratio)) < 0.03;
      const fresh = abs >= 50 && gap > WHEEL_GESTURE_IDLE_MS;
      const notch = e.deltaMode === 1 || fresh || (abs >= 50 && multiple);
      if (notch) {
        if (fresh && e.deltaMode !== 1) w.unit = abs;
        const count = e.deltaMode === 1 ? 1 : multiple ? Math.round(ratio) : 1;
        accRef.current = 0;
        w.gestureSteps = 1;
        for (let i = 0; i < Math.min(count, 4); i++) step(dir);
        return;
      }

      // 트랙패드·고해상도 휠: 작은 값이 관성으로 길게 이어진다 → 누적해서 넘기고,
      // 한 제스처 안에서 두 번째부터는 훨씬 많이 밀어야 넘어가게 해 관성으로 여러 장 넘어가지 않게 한다.
      if (gap > WHEEL_GESTURE_IDLE_MS) w.gestureSteps = 0;
      if (Math.sign(accRef.current) !== dir) accRef.current = 0;
      accRef.current += px;
      const need = w.gestureSteps === 0 ? WHEEL_THRESHOLD : WHEEL_REPEAT_THRESHOLD;
      if (Math.abs(accRef.current) < need) return;
      accRef.current = 0;
      w.gestureSteps += 1;
      step(dir);
    };

    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const next = e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Spacebar";
      const prev = e.key === "ArrowUp" || e.key === "PageUp";
      if (!next && !prev) return;
      e.preventDefault();
      if (next && targetSceneRef.current >= SCENE_MAX) return;
      step(next ? 1 : -1);
    };

    const onTouchStart = (e) => {
      if (isProfileScene(sceneRef.current) && inProfilePanel(e.target)) return;
      touchYRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e) => {
      if (isProfileScene(sceneRef.current) && inProfilePanel(e.target)) return;
      const y = e.changedTouches[0]?.clientY ?? touchYRef.current;
      const dy = touchYRef.current - y;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      const dir = dy > 0 ? 1 : -1;
      if (dir > 0 && targetSceneRef.current >= SCENE_MAX) return;
      step(dir);
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
      worldState.reverse = null;
      tweenRef.current?.kill();
      settleRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    worldState.quiet = isProfileScene(scene) ? (tab === "certs" ? 0.95 : tab === "career" ? 0.82 : 0.7) : 0;
  }, [scene, tab]);

  const idx = projectIndexAt(progress);
  const navIndex = projectIndexFromScene(scene);
  const { t } = projectLocal(progress);
  const stage = idx >= 0 ? projectStage(t) : { id: progress < INTRO_END ? "intro" : "after", u: 0 };
  const project = idx >= 0 ? JOURNEY_PROJECTS[idx] : null;
  const showHero = progress < INTRO_END + 0.02;
  const showProject = idx >= 0 && (stage.id === "arrive" || stage.id === "read" || (stage.id === "leave" && stage.u < 0.55));
  const showConnect = isProfileScene(scene) && progress >= CONNECT_START && progress < PROFILE_START;
  const showProfile = isProfileScene(scene) && progress >= PROFILE_START;
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
  const certs = (preview.certifications || []).map((it) => ({
    id: it.id,
    name: it.title,
    organization: it.issuer,
    date: it.acquired,
    status: it.score,
    description: it.description,
  }));

  const counterLabel =
    navIndex >= 0
      ? `${String(navIndex + 1).padStart(2, "0")} / ${String(PROJECT_COUNT).padStart(2, "0")}`
      : isProfileScene(scene)
        ? "FILE"
        : "00 / 05";

  const profileActive = profileTabFromScene(scene);

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
          <section
            className={`world-proj is-${idx % 3} is-${project.effect || "none"} ${stage.id === "leave" ? "is-out" : ""}`}
            aria-label={project.title}
            style={{ "--scan": imageReveal }}
          >
            <div
              className="world-proj__visual"
              style={{
                opacity: imageReveal,
                filter: `blur(${(1 - imageReveal) * 16}px)`,
                transform: `scale(${0.92 + imageReveal * 0.08})`,
              }}
            >
              <ProjectVisual
                image={media[project.id]?.image}
                video={media[project.id]?.video}
                reveal={imageReveal}
                alt={project.imageAlt}
              />
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
              {PROFILE_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? "is-on" : ""}
                  onClick={() => goToRef.current(sceneFromProfileTab(item.id))}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div key={tab} className="world-file__panel" role="tabpanel">
              {tab === "experience" && (
                <FileCards
                  items={activities}
                  titleOf={(it) => it.title}
                  subOf={(it) => [it.organization, it.role, it.period].filter(Boolean).join(" · ")}
                  detailOf={(it) => it.description}
                />
              )}
              {tab === "career" && (
                <FileCards
                  items={career.length ? career : activities}
                  titleOf={(it) => it.title}
                  subOf={(it) =>
                    career.length
                      ? [it.position || it.category, formatCareerPeriodPreview(it.period) || it.period].filter(Boolean).join(" · ")
                      : [it.role, it.organization, it.period].filter(Boolean).join(" · ")
                  }
                  detailOf={(it) => it.description}
                  empty="등록된 경력이 없습니다."
                />
              )}
              {tab === "certs" && (
                <FileCards
                  items={certs}
                  titleOf={(it) => it.name}
                  subOf={(it) => [it.organization, it.date, it.status].filter(Boolean).join(" · ")}
                  detailOf={(it) => it.description}
                  empty="등록된 자격증이 없습니다."
                />
              )}
            </div>
          </section>
        )}
      </div>

      <p className="world-counter" aria-live="polite">
        {counterLabel}
      </p>

      <nav className="world-nav" aria-label="Site">
        <p className="world-nav__label">PROJECTS</p>
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
        <p className="world-nav__label world-nav__label--gap">PROFILE</p>
        {PROFILE_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={profileActive === item.id ? "is-on" : ""}
            onClick={() => goToRef.current(sceneFromProfileTab(item.id))}
          >
            <i />
            <span aria-hidden />
            <em>{item.label}</em>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ProjectVisual({ image, video, reveal, alt }) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!video || reveal < 0.82) {
      setPlay(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setPlay(true), MEDIA_PLAY_DELAY);
    return () => window.clearTimeout(timer);
  }, [video, reveal]);

  if (play && video) {
    return <video src={video} autoPlay muted loop playsInline />;
  }
  if (image) return <img src={image} alt={alt} />;
  return <div className="world-proj__void" aria-hidden />;
}

function FileCards({ items, titleOf, subOf, detailOf, empty = "—" }) {
  const [open, setOpen] = useState(null);
  if (!items?.length) return <p className="world-empty">{empty}</p>;
  return (
    <>
      <ul className="world-cards">
        {items.map((it) => {
          const detail = detailOf?.(it);
          return (
            <li key={it.id}>
              <button type="button" className="world-card" onClick={() => setOpen(it)}>
                <b>{titleOf(it)}</b>
                <span>{subOf(it)}</span>
                {detail && <em>{detail}</em>}
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <div className="world-card-pop" onClick={() => setOpen(null)} role="presentation">
          <div className="world-card-pop__box" onClick={(e) => e.stopPropagation()} role="dialog">
            <strong>{titleOf(open)}</strong>
            <span>{subOf(open)}</span>
            <p>{detailOf?.(open) || "등록된 세부 설명이 없습니다."}</p>
            <button type="button" onClick={() => setOpen(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
