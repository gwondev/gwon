import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { worldState } from "./worldState.js";
import {
  INTRO_END,
  JOURNEY_END,
  JOURNEY_PROJECTS,
  PROFILE_TABS,
  liveProjects,
  projectCount,
  sceneMax,
  isProfileScene,
  projectIndexAt,
  projectIndexFromScene,
  projectLocal,
  projectStage,
  profileTabFromScene,
  regionSceneAt,
  sceneFromProfileTab,
  sceneFromProjectIndex,
  sceneToProgress,
  warpStartOf,
} from "../../lib/journey.js";
import { fileToCompressedDataUrl } from "../../lib/image.js";
import { fileToVideoDataUrl } from "../../lib/video.js";
import { useAuth } from "../../context/AuthContext";
import { useViewMode } from "../../context/ViewModeContext";
import { blankSlide } from "../../lib/homeLayout.js";
import { useHomeLayout } from "../../lib/useHomeLayout.js";
import "./WorldExperience.css";

const NeuralCanvas = lazy(() => import("./neural/NeuralCanvas.jsx"));

const WHEEL_THRESHOLD = 30;
const WHEEL_REPEAT_THRESHOLD = 280;
const WHEEL_GESTURE_IDLE_MS = 160;
const WHEEL_STEP_GAP_MS = 72;
const SWIPE_THRESHOLD = 56;
const MEDIA_PLAY_DELAY = 420;
const WARP_SECONDS = 0.95;

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

function setWorldEffect(scene) {
  const i = projectIndexFromScene(scene);
  if (i >= 0) {
    worldState.effect = (liveProjects()[i] || JOURNEY_PROJECTS[i])?.effect || "none";
    worldState.effectIndex = i;
    return;
  }
  worldState.effect = isProfileScene(scene) ? "network" : "none";
  worldState.effectIndex = -1;
}

export default function WorldExperience() {
  const root = useRef(null);
  const { isSuperAdmin } = useAuth();
  const { viewAsUser } = useViewMode();
  const home = useHomeLayout();
  const projects = home.projects;
  const profile = home.profile;
  const canEditHome = isSuperAdmin && !viewAsUser;
  const [progress, setProgress] = useState(() => sceneToProgress(0));
  const [scene, setScene] = useState(0);
  const [webgl, setWebgl] = useState(true);
  const [tab, setTab] = useState("experience");
  const [slideI, setSlideI] = useState(0);

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

  // 인트로·프로젝트 구간 전용. 몇 칸을 건너가든 워프는 한 번만 한다.
  // 앞으로: 즉시 목표의 워프 시작점으로 점프(내용이 바로 사라짐) → 워프로 진입.
  // 뒤로: 앞으로 가는 것을 그대로 역재생(워프를 거꾸로 빠져나옴) → 끝에서 목표 장면으로 점프.
  // warpFrom 은 워프가 출발하는 장면이라, 여러 칸을 건너도 카메라가 현재 위치에서 곧장 날아간다.
  driveRef.current = () => {
    tweenRef.current?.kill();
    settleRef.current?.kill();
    const tgt = targetSceneRef.current;
    const p = worldState.progress;
    const k = regionSceneAt(p);
    if (k < 0) return;

    const set = (v) => {
      worldState.progress = v;
      setProgress(v);
    };
    const run = (to, duration, ease, then) => {
      tweenRef.current = gsap.to(worldState, {
        progress: to,
        duration: worldState.reduced ? 0.2 : duration,
        ease,
        overwrite: true,
        onUpdate: () => setProgress(worldState.progress),
        onComplete: () => {
          set(to);
          then?.();
        },
      });
    };

    if (tgt > k) {
      worldState.warpBack = false;
      worldState.warpFrom = k;
      set(warpStartOf(tgt));
      run(sceneToProgress(tgt), WARP_SECONDS, "power2.out", () => {
        worldState.warpFrom = null;
        driveRef.current();
      });
      return;
    }
    if (tgt < k) {
      // 휠 내리기와 같은 한 방: 목표 워프 시작으로 즉시 점프(지금 위젯 사라짐)
      // → 0.95s power2.out 으로 도착·읽기까지. 사진·제목은 도착 구간에서 같은 타이밍으로 뜬다.
      worldState.warpBack = true;
      worldState.warpFrom = k;
      if (tgt < 1) {
        set(warpStartOf(k));
        run(sceneToProgress(0), WARP_SECONDS, "power2.out", () => {
          worldState.warpFrom = null;
          worldState.warpBack = false;
          driveRef.current();
        });
        return;
      }
      set(warpStartOf(tgt));
      run(sceneToProgress(tgt), WARP_SECONDS, "power2.out", () => {
        worldState.warpFrom = null;
        worldState.warpBack = false;
        driveRef.current();
      });
      return;
    }
    const settle = sceneToProgress(k);
    if (Math.abs(p - settle) > 0.0005) run(settle, 0.55, "power2.out");
  };

  goToRef.current = (nextScene) => {
    const clamped = Math.max(0, Math.min(sceneMax(), nextScene));
    const mid = Boolean(tweenRef.current?.isActive?.());
    const target = sceneToProgress(clamped);
    const alreadyThere = Math.abs(worldState.progress - target) < 0.002;

    if (clamped === targetSceneRef.current && (clamped === sceneRef.current || mid) && (alreadyThere || mid)) {
      return;
    }

    targetSceneRef.current = clamped;
    sceneRef.current = clamped;
    setScene(clamped);
    if (isProfileScene(clamped)) setTab(profileTabFromScene(clamped) || "experience");
    accRef.current = 0;
    setWorldEffect(clamped);
    driveRef.current();
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

    const step = (dir) => {
      goToRef.current(targetSceneRef.current + dir);
    };

    const onWheel = (e) => {
      if (worldState.leverDrag) return;
      if (e.target?.closest?.("[contenteditable='true']")) return;
      const now = performance.now();
      const dy = e.deltaY;
      const gap = now - lastWheelRef.current;

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
      if (next && targetSceneRef.current >= sceneMax()) return;
      step(next ? 1 : -1);
    };

    const onTouchStart = (e) => {
      touchYRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchEnd = (e) => {
      const y = e.changedTouches[0]?.clientY ?? touchYRef.current;
      const dy = touchYRef.current - y;
      if (Math.abs(dy) < SWIPE_THRESHOLD) return;
      const dir = dy > 0 ? 1 : -1;
      if (dir > 0 && targetSceneRef.current >= sceneMax()) return;
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
      worldState.warpFrom = null;
      worldState.warpBack = false;
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
  const n = projectCount();
  const project = idx >= 0 && idx < n ? projects[idx] : null;
  const profileTab = idx >= n ? PROFILE_TABS[idx - n] : null;
  const stageVisible = stage.id === "arrive" || stage.id === "read" || (stage.id === "leave" && stage.u < 0.55);
  const showHero = progress < INTRO_END + 0.02;
  const showProject = Boolean(project) && stageVisible;
  const showProfile = Boolean(profileTab) && stageVisible;
  const imageReveal = !project && !profileTab
    ? 0
    : stage.id === "arrive"
      ? stage.u
      : stage.id === "read"
        ? 1
        : stage.id === "leave"
          ? 1 - stage.u
          : 0;
  const textReveal = stage.id === "read" ? Math.min(1, stage.u * 1.4) : stage.id === "leave" ? 1 - stage.u : 0;

  const profileTabs = profile?.tabs?.length ? profile.tabs : PROFILE_TABS;
  const liveProfileTab = profileTab ? profileTabs.find((item) => item.id === profileTab.id) || profileTab : null;
  const profileItems = liveProfileTab?.items || [];
  const slides = project?.slides || [];
  const slide = slides[Math.min(slideI, Math.max(0, slides.length - 1))] || null;

  useEffect(() => {
    setSlideI(0);
  }, [project?.id]);

  const counterLabel =
    navIndex >= 0
      ? `${String(navIndex + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`
      : isProfileScene(scene)
        ? "FILE"
        : `00 / ${String(n).padStart(2, "0")}`;

  const profileActive = profileTabFromScene(scene);
  const leverStops = [
    { scene: 0, label: "INTRO" },
    ...projects.map((p, i) => ({ scene: i + 1, label: p.title })),
        ...profileTabs.map((item, i) => ({ scene: n + 1 + i, label: item.label })),
  ];

  const scrubTo = (next) => {
    tweenRef.current?.kill();
    settleRef.current?.kill();
    const clamped = Math.max(0, Math.min(sceneMax(), next));
    targetSceneRef.current = clamped;
    sceneRef.current = clamped;
    setScene(clamped);
    if (isProfileScene(clamped)) setTab(profileTabFromScene(clamped) || "experience");
    accRef.current = 0;
    setWorldEffect(clamped);
    worldState.warpFrom = null;
    worldState.warpBack = false;
    const target = sceneToProgress(clamped);
    worldState.progress = target;
    setProgress(target);
  };

  return (
    <main className="page world-page" ref={root}>
      <div className="world-pin">
        {webgl ? (
          <Suspense fallback={<div className="world-boot" />}>
            <NeuralCanvas key={projects.map((p) => p.id).join("|")} />
          </Suspense>
        ) : (
          <div className="world-boot" />
        )}
      </div>

      {showHero && (
        <section className={`world-hero${canEditHome ? " is-editing" : ""}`}>
          <Field className="world-kicker" value={home.hero?.kicker} canEdit={canEditHome} onSave={(kicker) => home.patchHero({ kicker })} />
          <Field tag="h1" value={home.hero?.name} canEdit={canEditHome} onSave={(name) => home.patchHero({ name })} />
          <Field className="world-line" value={home.hero?.line} canEdit={canEditHome} onSave={(line) => home.patchHero({ line })} />
        </section>
      )}

      {showProject && project && (
        <section className={`world-stage${canEditHome ? " is-editing" : ""}`} style={{ opacity: Math.max(textReveal, imageReveal * 0.35) }}>
          <Field tag="h2" className="world-stage__title" value={project.title} canEdit={canEditHome} onSave={(title) => home.patchProject(project.id, { title })} />
          <Field className="world-stage__one" value={project.subtitle} canEdit={canEditHome} onSave={(subtitle) => home.patchProject(project.id, { subtitle })} />
          <div className="world-stage__media" style={{ opacity: imageReveal }}>
            <ProjectVisual
              image={slide?.kind === "image" ? slide.src : ""}
              video={slide?.kind === "video" ? slide.src : ""}
              reveal={imageReveal}
              alt={slide?.name || project.title}
              canEdit={canEditHome}
              onPick={async (file) => {
                if (!file) return;
                try {
                  const isVideo = file.type.startsWith("video/");
                  const src = isVideo ? await fileToVideoDataUrl(file) : await fileToCompressedDataUrl(file);
                  const next = slides.length
                    ? slides.map((s, i) => (i === slideI ? { ...s, kind: isVideo ? "video" : "image", src } : s))
                    : [{ i: 0, kind: isVideo ? "video" : "image", src, caption: "", name: "탭 1" }];
                  home.patchProject(project.id, { slides: next });
                } catch (err) {
                  window.alert(err.message || "미디어를 넣지 못했습니다.");
                }
              }}
            />
          </div>
          <Field
            className="world-stage__bar"
            value={slide?.caption || project.description}
            canEdit={canEditHome}
            onSave={(caption) => {
              if (!slides.length) {
                home.patchProject(project.id, { description: caption });
                return;
              }
              home.patchProject(project.id, {
                slides: slides.map((s, i) => (i === slideI ? { ...s, caption } : s)),
                description: caption,
              });
            }}
          />
          <div className="world-stage__tabs">
            {(slides.length ? slides : [{ i: 0, name: "탭 1" }]).map((s, i) => (
              <button key={s.i ?? i} type="button" className={i === slideI ? "is-on" : ""} onClick={() => setSlideI(i)}>
                {s.name || String(i + 1).padStart(2, "0")}
              </button>
            ))}
            {canEditHome && (
              <button
                type="button"
                className="world-stage__tabs-add"
                onClick={() => {
                  const next = [...slides, blankSlide(slides.length)];
                  home.patchProject(project.id, { slides: next });
                  setSlideI(next.length - 1);
                }}
              >
                +
              </button>
            )}
          </div>
        </section>
      )}

      {showProfile && liveProfileTab && (
        <section className={`world-stage${canEditHome ? " is-editing" : ""}`} style={{ opacity: Math.max(textReveal, imageReveal * 0.35) }}>
          <Field
            tag="h2"
            className="world-stage__title"
            value={liveProfileTab.label}
            canEdit={canEditHome}
            onSave={(label) => home.patchProfileTab(liveProfileTab.id, { label })}
          />
          <Field
            className="world-stage__one"
            value={liveProfileTab.one}
            canEdit={canEditHome}
            onSave={(one) => home.patchProfileTab(liveProfileTab.id, { one })}
          />
          <div className="world-stage__media world-stage__media--cards" style={{ opacity: imageReveal }}>
            <FileCards
              items={profileItems}
              canEdit={canEditHome}
              onPatch={(id, fields) => home.patchProfileItem(liveProfileTab.id, id, fields)}
              onAdd={() => home.addProfileItem(liveProfileTab.id)}
            />
          </div>
        </section>
      )}

      <p className="world-counter" aria-live="polite">
        {counterLabel}
      </p>

      <JourneyLever
        progress={progress}
        scene={scene}
        stops={leverStops}
        onScrub={scrubTo}
        onCommit={(next) => goToRef.current(next)}
      />

      <nav className="world-nav" aria-label="여정">
          <Field
            className="world-nav__label"
            value={home.nav?.projects}
            canEdit={canEditHome}
            onSave={(projects) => home.patchNav({ projects })}
          />
          {projects.map((p, i) => (
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
          <Field
            className="world-nav__label world-nav__label--gap"
            value={home.nav?.profile}
            canEdit={canEditHome}
            onSave={(profile) => home.patchNav({ profile })}
          />
          {profileTabs.map((item) => (
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

const Field = memo(function Field({ tag: Tag = "p", className, value, canEdit, onSave }) {
  const ref = useRef(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useLayoutEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      const next = value || "";
      if (ref.current.textContent !== next) ref.current.textContent = next;
    }
  }, [value]);

  if (!canEdit) {
    return <Tag className={className}>{value || ""}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      className={`${className || ""} is-edit`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => {
        const next = (ref.current?.textContent || "").replace(/\s+/g, " ").trim();
        if (next !== (value || "")) saveRef.current(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}, (a, b) => a.value === b.value && a.canEdit === b.canEdit && a.className === b.className && a.tag === b.tag);

function JourneyLever({ progress, scene, stops, onScrub, onCommit }) {
  const track = useRef(null);
  const [drag, setDrag] = useState(false);
  const index = Math.max(0, stops.findIndex((stop) => stop.scene === scene));
  const pct = Math.min(100, Math.max(0, ((progress - 0.018) / (JOURNEY_END - 0.018)) * 100));

  const sceneFromY = (clientY) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || !stops.length) return scene;
    const t = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return stops[Math.round(t * (stops.length - 1))].scene;
  };

  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(true);
    worldState.leverDrag = true;
    track.current?.setPointerCapture?.(e.pointerId);
    onScrub(sceneFromY(e.clientY));
    const move = (ev) => onScrub(sceneFromY(ev.clientY));
    const up = (ev) => {
      setDrag(false);
      worldState.leverDrag = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onCommit(sceneFromY(ev.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className={`world-lever${drag ? " is-drag" : ""}`} ref={track} onPointerDown={start} style={{ "--lever": `${pct}%` }}>
      <i className="world-lever__rail" />
      <i className="world-lever__fill" style={{ height: `${pct}%` }} />
      {stops.map((stop, i) => (
        <span
          key={stop.scene}
          className={`world-lever__tick${stop.scene === scene ? " is-on" : ""}`}
          style={{ top: `${stops.length <= 1 ? 0 : (i / (stops.length - 1)) * 100}%` }}
        />
      ))}
      <b className="world-lever__grip" style={{ top: `${pct}%` }} />
      <span className="world-lever__label">{stops[index]?.label}</span>
    </div>
  );
}

function ProjectVisual({ image, video, reveal, alt, canEdit, onPick }) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!video || reveal < 0.82) {
      setPlay(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setPlay(true), MEDIA_PLAY_DELAY);
    return () => window.clearTimeout(timer);
  }, [video, reveal]);

  const picker = canEdit ? (
    <label className="world-stage__upload">
      {image || video ? "사진·영상 바꾸기" : "사진·영상 넣기"}
      <input
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => {
          onPick?.(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  ) : null;

  if (play && video) {
    return (
      <>
        <video src={video} autoPlay muted loop playsInline />
        {picker}
      </>
    );
  }
  if (image) {
    return (
      <>
        <img src={image} alt={alt} />
        {picker}
      </>
    );
  }
  return (
    <div className="world-proj__void">
      {picker}
    </div>
  );
}

function FileCards({ items, canEdit, onPatch, onAdd, empty = "—" }) {
  const [open, setOpen] = useState(null);
  if (!items?.length && !canEdit) return <p className="world-empty">{empty}</p>;
  return (
    <>
      <ul className="world-cards">
        {items.map((it) => (
          <li key={it.id}>
            <div
              className="world-card"
              onClick={() => {
                if (!canEdit) setOpen(it);
              }}
              role={canEdit ? undefined : "button"}
            >
              <Field tag="b" value={it.title} canEdit={canEdit} onSave={(title) => onPatch(it.id, { title })} />
              <Field tag="span" value={it.subtitle} canEdit={canEdit} onSave={(subtitle) => onPatch(it.id, { subtitle })} />
              <Field tag="em" value={it.description} canEdit={canEdit} onSave={(description) => onPatch(it.id, { description })} />
            </div>
          </li>
        ))}
        {canEdit && (
          <li>
            <button type="button" className="world-card world-card--add" onClick={onAdd}>
              + 항목
            </button>
          </li>
        )}
      </ul>
      {open && (
        <div className="world-card-pop" onClick={() => setOpen(null)} role="presentation">
          <div className="world-card-pop__box" onClick={(e) => e.stopPropagation()} role="dialog">
            <strong>{open.title}</strong>
            <span>{open.subtitle}</span>
            <p>{open.description || "등록된 세부 설명이 없습니다."}</p>
            <button type="button" onClick={() => setOpen(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
