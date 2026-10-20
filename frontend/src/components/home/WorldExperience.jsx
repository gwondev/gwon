import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { worldState } from "./worldState.js";
import {
  INTRO_END,
  PROFILE_TABS,
  WORLDS,
  projectCount,
  sceneMax,
  isProfileScene,
  projectIndexAt,
  projectLocal,
  projectStage,
  profileTabFromScene,
  regionSceneAt,
  sceneFromWorld,
  worldFromScene,
  sceneToProgress,
  warpStartOf,
} from "../../lib/journey.js";
import { fileToCompressedDataUrl } from "../../lib/image.js";
import { fileToVideoDataUrl } from "../../lib/video.js";
import { useAuth } from "../../context/AuthContext";
import { useViewMode } from "../../context/ViewModeContext";
import { blankPage } from "../../lib/homeLayout.js";
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
  const w = worldFromScene(scene);
  worldState.effect = w.world || "none";
  worldState.effectIndex = scene <= 0 ? -1 : scene - 1;
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
  const [pageI, setPageI] = useState(0);
  const [projI, setProjI] = useState(0);

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

  // 몇 칸을 건너가든 워프는 한 번만 한다.
  // 다음으로 들어가나, 이전으로 돌아가나 같은 안으로 들어가는 워프를 재생한다.
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

    if (tgt !== k) {
      worldState.warpBack = false;
      worldState.warpFrom = k;
      set(warpStartOf(tgt));
      run(sceneToProgress(tgt), WARP_SECONDS, "power2.out", () => {
        worldState.warpFrom = null;
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
  const { t } = projectLocal(progress);
  const stage = idx >= 0 ? projectStage(t) : { id: progress < INTRO_END ? "intro" : "after", u: 0 };
  const n = projectCount();
  const world = worldFromScene(scene);
  const project = projects[Math.min(projI, Math.max(0, n - 1))] || projects[0] || null;
  const profileTabs = profile?.tabs?.length ? profile.tabs : PROFILE_TABS;
  const profileTabId = profileTabFromScene(scene);
  const liveProfileTab = profileTabId ? profileTabs.find((item) => item.id === profileTabId) : null;
  const profileItems = liveProfileTab?.items || [];
  const pages = project?.pages?.length ? project.pages : [];
  const stageVisible = scene === 0 || stage.id === "arrive" || stage.id === "read" || (stage.id === "leave" && stage.u < 0.55);
  const showHero = scene === 0 && (progress < INTRO_END + 0.04 || stage.id === "intro");
  const showWorld = scene > 0 && stageVisible;
  const imageReveal =
    scene === 0
      ? 1
      : stage.id === "arrive"
        ? stage.u
        : stage.id === "read"
          ? 1
          : stage.id === "leave"
            ? 1 - stage.u
            : 0;
  const textReveal = scene === 0 ? 1 : stage.id === "read" ? Math.min(1, stage.u * 1.4) : stage.id === "leave" ? 1 - stage.u : 0;

  useEffect(() => {
    setPageI(0);
  }, [project?.id]);

  const counterLabel = `${world.no}  ${world.label}`;
  const leverStops = [{ scene: 0, label: "CORE" }, ...WORLDS.map((w, i) => ({ scene: i + 1, label: w.label }))];

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
          <Field className="world-line world-line--tag" value={home.hero?.tagline} canEdit={canEditHome} onSave={(tagline) => home.patchHero({ tagline })} />
          <Field className="world-line" value={home.hero?.line} canEdit={canEditHome} onSave={(line) => home.patchHero({ line })} />
          <button type="button" className="world-explore" onClick={() => goToRef.current(1)}>
            {home.hero?.explore || "EXPLORE"}
          </button>
        </section>
      )}

      {showWorld && world.id === "projects" && project && (
        <section className={`world-stage${canEditHome ? " is-editing" : ""}`} style={{ opacity: Math.max(textReveal, imageReveal * 0.35) }}>
          <Field tag="h2" className="world-stage__title" value={project.title} canEdit={canEditHome} onSave={(title) => home.patchProject(project.id, { title })} />
          <Field className="world-stage__one" value={project.subtitle} canEdit={canEditHome} onSave={(subtitle) => home.patchProject(project.id, { subtitle })} />
          <div className="world-proj-picks">
            {projects.map((p, i) => (
              <button key={p.id} type="button" className={i === projI ? "is-on" : ""} onClick={() => setProjI(i)}>
                {p.no}
              </button>
            ))}
          </div>
          <MediaPages
            pages={pages.length ? pages : [blankPage(0)]}
            index={pageI}
            setIndex={setPageI}
            reveal={imageReveal}
            title={project.title}
            canEdit={canEditHome}
            onPatchCell={(pi, side, fields) => {
              const base = pages.length ? pages : [blankPage(0)];
              home.patchProject(project.id, {
                pages: base.map((pg, i) => (i === pi ? { ...pg, [side]: { ...pg[side], ...fields } } : pg)),
              });
            }}
            onAdd={() => {
              const base = pages.length ? pages : [blankPage(0)];
              const next = [...base, blankPage(base.length)];
              home.patchProject(project.id, { pages: next });
              setPageI(next.length - 1);
            }}
          />
        </section>
      )}

      {showWorld && liveProfileTab && (
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
              layout={liveProfileTab.id}
              canEdit={canEditHome}
              onPatch={(id, fields) => home.patchProfileItem(liveProfileTab.id, id, fields)}
            />
          </div>
        </section>
      )}

      {showWorld && (world.id === "profile" || world.id === "infrastructure" || world.id === "awards") && (
        <section className={`world-stage${canEditHome ? " is-editing" : ""}`} style={{ opacity: Math.max(textReveal, imageReveal * 0.35) }}>
          <h2 className="world-stage__title">{world.label}</h2>
          <Field
            className="world-stage__one"
            value={home.worlds?.[world.id]?.one}
            canEdit={canEditHome}
            onSave={(one) => home.patchWorld(world.id, { one })}
          />
          <div className="world-stage__media world-stage__media--cards" style={{ opacity: imageReveal }}>
            <FileCards
              items={home.worlds?.[world.id]?.items || []}
              layout={world.id === "profile" ? "career" : world.id === "awards" ? "certs" : "experience"}
              canEdit={canEditHome}
              onPatch={(id, fields) => home.patchWorldItem(world.id, id, fields)}
            />
          </div>
        </section>
      )}

      <p className="world-counter" aria-live="polite">
        {counterLabel}
      </p>

      <JourneyLever
        scene={scene}
        stops={leverStops}
        onCommit={(next) => goToRef.current(next)}
      />

      <nav className="world-nav" aria-label="탐험 경로">
          <p className="world-nav__label">EXPLORE</p>
          {WORLDS.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className={scene === i + 1 ? "is-on" : ""}
              onMouseEnter={() => {
                if (!worldState.mobile) worldState.hoverIndex = i;
              }}
              onMouseLeave={() => {
                worldState.hoverIndex = -1;
              }}
              onClick={() => goToRef.current(sceneFromWorld(w.id))}
            >
              <i />
              <span>{w.no}</span>
              <em>{w.label}</em>
            </button>
          ))}
        </nav>
    </main>
  );
}

const Field = memo(function Field({ tag: Tag = "p", className, value, canEdit, onSave, placeholder }) {
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
      data-placeholder={placeholder || "입력"}
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
}, (a, b) => a.value === b.value && a.canEdit === b.canEdit && a.className === b.className && a.tag === b.tag && a.placeholder === b.placeholder);

function JourneyLever({ scene, stops, onCommit }) {
  const track = useRef(null);
  const tween = useRef(null);
  const [drag, setDrag] = useState(false);
  const n = Math.max(1, stops.length - 1);
  const index = Math.max(0, stops.findIndex((stop) => stop.scene === scene));
  const obj = useRef({ t: index / n });
  const [t, setT] = useState(index / n);

  useEffect(() => {
    if (drag) return undefined;
    const to = index / n;
    tween.current?.kill();
    tween.current = gsap.to(obj.current, {
      t: to,
      duration: worldState.reduced ? 0.2 : WARP_SECONDS,
      ease: "power2.out",
      onUpdate: () => setT(obj.current.t),
    });
    return () => tween.current?.kill();
  }, [index, n, drag]);

  const yToT = (clientY) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return obj.current.t;
    return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  };

  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    tween.current?.kill();
    setDrag(true);
    worldState.leverDrag = true;
    const apply = (ev) => {
      const next = yToT(ev.clientY);
      obj.current.t = next;
      setT(next);
    };
    apply(e);
    const up = (ev) => {
      apply(ev);
      setDrag(false);
      worldState.leverDrag = false;
      window.removeEventListener("pointermove", apply);
      window.removeEventListener("pointerup", up);
      const stop = stops[Math.round(obj.current.t * n)];
      if (stop) onCommit(stop.scene);
    };
    window.addEventListener("pointermove", apply);
    window.addEventListener("pointerup", up);
  };

  const pct = t * 100;
  const near = Math.round(t * n);

  return (
    <div className={`world-lever${drag ? " is-drag" : ""}`} ref={track} onPointerDown={start} style={{ "--lever": `${pct}%` }}>
      <i className="world-lever__rail" />
      <i className="world-lever__fill" style={{ height: `${pct}%` }} />
      {stops.map((stop, i) => (
        <span
          key={stop.scene}
          className={`world-lever__tick${i === near ? " is-on" : ""}`}
          style={{ top: `${(i / n) * 100}%` }}
        />
      ))}
      <b className="world-lever__grip" style={{ top: `${pct}%` }} />
      <span className="world-lever__label">{stops[near]?.label}</span>
    </div>
  );
}

function MediaPages({ pages, index, setIndex, reveal, title, canEdit, onPatchCell, onAdd }) {
  const view = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dx = useRef(0);
  const axis = useRef(null);
  const [off, setOff] = useState(0);
  const [dragging, setDragging] = useState(false);

  const down = (e) => {
    if (e.target?.closest?.("[contenteditable='true'], label, input, .world-stage__tabs-add, .world-stage__bar, .is-edit")) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dx.current = 0;
    axis.current = null;
    setDragging(true);
    const move = (ev) => {
      const x = ev.clientX - startX.current;
      const y = ev.clientY - startY.current;
      if (!axis.current) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        axis.current = Math.abs(x) > Math.abs(y) ? "x" : "y";
      }
      if (axis.current !== "x") return;
      dx.current = x;
      setOff(x);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (axis.current === "x") {
        const w = view.current?.clientWidth || 1;
        if (dx.current / w < -0.12) setIndex(Math.min(pages.length - 1, index + 1));
        else if (dx.current / w > 0.12) setIndex(Math.max(0, index - 1));
      }
      dx.current = 0;
      axis.current = null;
      setOff(0);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const w = view.current?.clientWidth || 1;
  const shift = -index * 100 + (off / w) * 100;

  return (
    <>
      <div className={`world-stage__viewport${dragging ? " is-drag" : ""}`} ref={view} onPointerDown={down} style={{ opacity: reveal }}>
        <div className="world-stage__track" style={{ transform: `translate3d(${shift}%, 0, 0)` }}>
          {pages.map((pg, i) => (
            <div className="world-stage__page" key={pg.i ?? i}>
              <div className="world-stage__pair">
                {["left", "right"].map((side) => (
                  <MediaCell
                    key={side}
                    cell={pg[side]}
                    reveal={reveal}
                    alt={`${title} ${pg.name || i + 1} ${side}`}
                    canEdit={canEdit}
                    onPick={async (file) => {
                      if (!file) return;
                      try {
                        const isVideo = file.type.startsWith("video/");
                        const src = isVideo ? await fileToVideoDataUrl(file) : await fileToCompressedDataUrl(file);
                        onPatchCell(i, side, { kind: isVideo ? "video" : "image", src });
                      } catch (err) {
                        window.alert(err.message || "미디어를 넣지 못했습니다.");
                      }
                    }}
                    onCaption={(caption) => onPatchCell(i, side, { caption })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="world-stage__tabs" onPointerDown={down}>
        {pages.map((pg, i) => (
          <span key={pg.i ?? i} className={i === index ? "is-on" : ""}>
            {pg.name || String(i + 1).padStart(2, "0")}
          </span>
        ))}
        {canEdit && (
          <button type="button" className="world-stage__tabs-add" onClick={onAdd}>
            +
          </button>
        )}
      </div>
    </>
  );
}

function MediaCell({ cell, reveal, alt, canEdit, onPick, onCaption }) {
  return (
    <div className="world-stage__cell">
      <div className="world-stage__media">
        <ProjectVisual
          image={cell?.kind === "image" ? cell.src : ""}
          video={cell?.kind === "video" ? cell.src : ""}
          reveal={reveal}
          alt={alt}
          canEdit={canEdit}
          onPick={onPick}
        />
      </div>
      <Field
        className="world-stage__bar"
        value={cell?.caption}
        canEdit={canEdit}
        placeholder="사진·영상 설명"
        onSave={onCaption}
      />
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

function FileCards({ items, layout = "experience", canEdit, onPatch, empty = "—" }) {
  const [open, setOpen] = useState(null);
  if (!items?.length && !canEdit) return <p className="world-empty">{empty}</p>;
  return (
    <>
      <ul className={`world-cards world-cards--${layout}`}>
        {items.map((it) => (
          <li key={it.id}>
            <div
              className="world-card"
              onClick={() => {
                if (!canEdit) setOpen(it);
              }}
              role={canEdit ? undefined : "button"}
            >
              <Field tag="b" value={it.title} canEdit={canEdit} placeholder="제목" onSave={(title) => onPatch(it.id, { title })} />
              <Field tag="span" value={it.subtitle} canEdit={canEdit} placeholder="기간 · 부제" onSave={(subtitle) => onPatch(it.id, { subtitle })} />
              <Field tag="em" value={it.description} canEdit={canEdit} placeholder="설명" onSave={(description) => onPatch(it.id, { description })} />
            </div>
          </li>
        ))}
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
