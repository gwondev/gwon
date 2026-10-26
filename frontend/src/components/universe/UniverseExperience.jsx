import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useViewMode } from "../../context/ViewModeContext";
import { useHomeLayout } from "../../lib/useHomeLayout.js";
import { filledItems, sectionItems, visibleSections } from "./sections.js";
import { dispose, getSnapshot, goTo, jump, live, setEnv, setFocus, setSections, step, subscribe } from "./director.js";
import { useUniverseInput } from "./useUniverseInput.js";
import { HeroBlock, ItemsList, ProjectDetail, ProjectPicker, patchOne, sectionOne } from "./content/Panels.jsx";
import Field from "./content/Field.jsx";
import "./UniverseExperience.css";

const UniverseCanvas = lazy(() => import("./scene/UniverseCanvas.jsx"));

function hasWebGL() {
  if (new URLSearchParams(window.location.search).has("lite")) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("[universe] 3D 장면을 띄우지 못해 2D 화면으로 전환합니다.", err);
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export default function UniverseExperience() {
  const { isSuperAdmin } = useAuth();
  const { viewAsUser } = useViewMode();
  const home = useHomeLayout();
  const canEdit = isSuperAdmin && !viewAsUser;
  const mobile = useMedia("(max-width: 767px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [webgl, setWebgl] = useState(() => hasWebGL());
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);

  const sections = useMemo(() => visibleSections(home, canEdit), [home, canEdit]);
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const wanted = useRef(window.location.hash.replace("#", ""));

  useLayoutEffect(() => {
    setEnv({ mobile, reduced });
  }, [mobile, reduced]);

  useLayoutEffect(() => {
    setSections(ids);
    if (wanted.current) {
      const i = ids.indexOf(wanted.current);
      if (i >= 0) {
        jump(i);
        wanted.current = "";
      }
    }
  }, [ids]);

  useEffect(() => {
    const timer = window.setTimeout(() => (wanted.current = ""), 4000);
    return () => {
      window.clearTimeout(timer);
      dispose();
    };
  }, []);

  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const shownIndex = snap.active ? (snap.arriving ? snap.to : snap.from) : snap.index;
  const section = sections[shownIndex] || sections[0];
  const settled = !snap.active;

  const lists = useMemo(() => {
    const out = {};
    sections.forEach((s) => {
      const all = sectionItems(s, home);
      out[s.id] = s.source.kind === "projects" || canEdit ? all : filledItems(all);
    });
    return out;
  }, [sections, home, canEdit]);
  const items = (section && lists[section.id]) || [];
  const projects = home.projects || [];

  const counts = useMemo(
    () => ({
      infrastructureItems: lists.infrastructure || [],
      credentials: lists.credentials?.length || 0,
      activities: lists.activities?.length || 0,
      career: lists.career?.length || 0,
      awards: lists.awards?.length || 0,
    }),
    [lists]
  );

  useUniverseInput(!sheet && !menu);

  useEffect(() => {
    if (!settled) {
      setSheet(false);
      return;
    }
    const id = ids[snap.index];
    const hash = id && id !== "gateway" ? `#${id}` : "";
    if (window.location.hash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
    if (id === "projects" && live.focus < 0 && projects.length) setFocus(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, snap.index]);

  useEffect(() => {
    const onHash = () => {
      const i = live.ids.indexOf(window.location.hash.replace("#", ""));
      if (i >= 0) goTo(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const total = sections.length;
  const isGateway = section?.id === "gateway";
  const isProjects = section?.id === "projects";
  const project = isProjects ? projects[Math.max(0, snap.focus)] || projects[0] : null;
  const one = section ? sectionOne(section, home) : "";
  const tabLabel = section?.source.kind === "tab" ? home.profile?.tabs?.find((t) => t.id === section.source.id)?.label : null;

  const fallback = !webgl;
  const style = { "--uv-color": section?.color, "--uv-accent": section?.accent };

  return (
    <main className={`uv${mobile ? " uv--mobile" : ""}${settled ? " is-settled" : " is-warping"}${snap.arriving ? " is-arriving" : ""}${fallback ? " uv--fallback" : ""}`} style={style}>
      <div className="uv-stage">
        {webgl ? (
          <CanvasBoundary onFail={() => setWebgl(false)}>
            <Suspense fallback={<div className="uv-boot"><span>INITIALIZING</span></div>}>
              <UniverseCanvas ids={ids} projects={projects} counts={counts} mobile={mobile} />
            </Suspense>
          </CanvasBoundary>
        ) : (
          <div className="uv-fallback" aria-hidden="true" />
        )}
      </div>

      <div className="uv-hud" aria-hidden="true">
        <i className="uv-hud__corner uv-hud__corner--tl" />
        <i className="uv-hud__corner uv-hud__corner--tr" />
        <i className="uv-hud__corner uv-hud__corner--bl" />
        <i className="uv-hud__corner uv-hud__corner--br" />
        <div className="uv-hud__telemetry">
          <span>GWON.RUN</span>
          <span className="uv-hud__sep" />
          <span>{settled ? "STABLE ORBIT" : "WARP"}</span>
          <span className="uv-hud__sep" />
          <span>
            SECTOR {section?.no} / {String(total - 1).padStart(2, "0")}
          </span>
        </div>
      </div>

      <p className="uv-sr" aria-live="polite">
        {settled && section ? `${section.label} — ${section.ko}` : ""}
      </p>

      {isGateway && settled && <HeroBlock home={home} canEdit={canEdit} onEnter={() => step(1)} />}

      {!isGateway && section && (
        <header className="uv-title" key={section.id} style={{ "--len": Math.max(6, (tabLabel || section.label).length) }}>
          <p className="uv-title__no">
            <span>{section.no}</span>
            <i />
            <span>{section.world}</span>
          </p>
          {tabLabel && canEdit ? (
            <Field tag="h2" className="uv-title__label" value={tabLabel} canEdit onSave={(label) => home.patchProfileTab(section.source.id, { label })} />
          ) : (
            <h2 className="uv-title__label">{section.label}</h2>
          )}
          <p className="uv-title__ko">{section.ko}</p>
          {section.source.kind !== "projects" && (
            <Field className="uv-title__one" value={one} canEdit={canEdit} placeholder="한 줄 소개" onSave={(v) => patchOne(section, home, v)} />
          )}
          {isProjects && !mobile && <ProjectPicker projects={projects} focus={snap.focus} onPick={setFocus} />}
        </header>
      )}

      {!mobile && !isGateway && section && (
        <aside className="uv-panel" data-ui-scroll aria-label={`${section.ko} 내용`} key={`p-${section.id}`}>
          {isProjects ? (
            <ProjectDetail project={project} home={home} canEdit={canEdit} />
          ) : (
            <ItemsList section={section} home={home} items={items} canEdit={canEdit} focus={snap.focus} onPick={setFocus} />
          )}
        </aside>
      )}

      {!mobile && (
        <nav className="uv-rail" aria-label="섹션 이동">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`uv-rail__stop${i === shownIndex ? " is-on" : ""}${snap.active && i === snap.to ? " is-target" : ""}`}
              onClick={() => goTo(i)}
              aria-current={i === shownIndex ? "step" : undefined}
              aria-label={`${s.no} ${s.label} ${s.ko}`}
            >
              <span className="uv-rail__label">
                <b>{s.no}</b> {s.label}
              </span>
              <i />
            </button>
          ))}
        </nav>
      )}

      {!mobile && (
        <div className="uv-controls">
          <button type="button" onClick={() => step(-1)} disabled={shownIndex <= 0} aria-label="이전 섹션">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <span className="uv-controls__hint">{isGateway ? "SCROLL TO ENTER" : "SCROLL · ↑ ↓"}</span>
          <button type="button" onClick={() => step(1)} disabled={shownIndex >= total - 1} aria-label="다음 섹션">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {mobile && (
        <>
          <div className="uv-m-top">
            <span className="uv-m-top__no">
              {section?.no}
              <em>/{String(total - 1).padStart(2, "0")}</em>
            </span>
            <span className="uv-m-top__label">{section?.label}</span>
            <button type="button" className="uv-m-top__menu" onClick={() => setMenu(true)} aria-label="섹션 목록 열기">
              <i />
              <i />
              <i />
            </button>
          </div>

          {!isGateway && section && (
            <div className="uv-dock">
              {isProjects && (
                <div className="uv-dock__scroll" data-ui-scroll>
                  <ProjectPicker projects={projects} focus={snap.focus} onPick={setFocus} className="uv-picker--row" />
                </div>
              )}
              <div className="uv-dock__row">
                <div className="uv-dock__progress" aria-hidden="true">
                  {sections.map((s, i) => (
                    <i key={s.id} className={i === shownIndex ? "is-on" : ""} />
                  ))}
                </div>
                <button type="button" className="uv-dock__open" onClick={() => setSheet(true)}>
                  {isProjects ? (project?.title || "프로젝트") + " 자세히" : `${section.ko} 보기`}
                  <span aria-hidden="true">↑</span>
                </button>
              </div>
              <p className="uv-dock__hint">위아래로 밀어 이동</p>
            </div>
          )}

          {sheet && section && createPortal(
            <div className="uv-sheet" data-modal role="dialog" aria-modal="true" aria-label={`${section.ko} 내용`} style={style}>
              <button type="button" className="uv-sheet__scrim" onClick={() => setSheet(false)} aria-label="닫기" />
              <div className="uv-sheet__box">
                <div className="uv-sheet__bar">
                  <span>
                    {section.no} · {section.label}
                  </span>
                  <button type="button" onClick={() => setSheet(false)} aria-label="닫기">
                    ✕
                  </button>
                </div>
                <div className="uv-sheet__body" data-ui-scroll>
                  {isProjects ? (
                    <ProjectDetail project={project} home={home} canEdit={canEdit} />
                  ) : (
                    <ItemsList section={section} home={home} items={items} canEdit={canEdit} focus={snap.focus} onPick={setFocus} />
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

          {menu && createPortal(
            <div className="uv-menu" data-modal role="dialog" aria-modal="true" aria-label="섹션 목록" style={style}>
              <div className="uv-menu__head">
                <span>NAVIGATION</span>
                <button type="button" onClick={() => setMenu(false)} aria-label="닫기">
                  ✕
                </button>
              </div>
              <ol>
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={i === shownIndex ? "is-on" : ""}
                      style={{ "--uv-color": s.color }}
                      onClick={() => {
                        setMenu(false);
                        goTo(i);
                      }}
                    >
                      <span className="uv-menu__no">{s.no}</span>
                      <span className="uv-menu__label">{s.label}</span>
                      <span className="uv-menu__world">
                        {s.world} · {s.ko}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>,
            document.body
          )}
        </>
      )}
    </main>
  );
}
