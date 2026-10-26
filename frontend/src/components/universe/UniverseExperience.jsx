import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useViewMode } from "../../context/ViewModeContext";
import { useHomeLayout } from "../../lib/useHomeLayout.js";
import { filledItems, sectionItems, visibleSections } from "./sections.js";
import { dispose, getSnapshot, goTo, jump, live, releaseScrub, scrubTo, setEnv, setFocus, setSections, step, subscribe } from "./director.js";
import { useUniverseInput } from "./useUniverseInput.js";
import { HeroBlock, ItemsList, ProjectDetail, ProjectPicker, patchOne, sectionOne } from "./content/Panels.jsx";
import Field from "./content/Field.jsx";
import DriveStore from "./drive/DriveStore.jsx";
import SideDrawer from "../SideDrawer";
import "./UniverseExperience.css";

function localCenterY(nav, node) {
  const box = nav.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  const sy = box.height / (nav.offsetHeight || 1);
  return (r.top + r.height / 2 - box.top) / (sy || 1);
}

function RailThumb() {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      const nav = el?.parentElement;
      if (el && nav) {
        const dots = nav.querySelectorAll(".uv-rail__stop i");
        const p = live.active ? live.from + (live.to - live.from) * live.t : live.index;
        if (dots.length) {
          const max = dots.length - 1;
          const i0 = Math.max(0, Math.min(max, Math.floor(p)));
          const i1 = Math.max(0, Math.min(max, i0 + 1));
          const t = i0 === i1 ? 0 : p - Math.floor(p);
          const y = localCenterY(nav, dots[i0]) + (localCenterY(nav, dots[i1]) - localCenterY(nav, dots[i0])) * t;
          el.style.transform = `translateY(${y - el.offsetHeight / 2}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <i className="uv-rail__thumb" ref={ref} aria-hidden="true" />;
}

function indexFromRailY(nav, clientY) {
  const dots = nav.querySelectorAll(".uv-rail__stop i");
  if (!dots.length) return 0;
  const first = dots[0].getBoundingClientRect();
  const last = dots[dots.length - 1].getBoundingClientRect();
  const y0 = first.top + first.height / 2;
  const y1 = last.top + last.height / 2;
  if (Math.abs(y1 - y0) < 1) return 0;
  const t = (clientY - y0) / (y1 - y0);
  return Math.max(0, Math.min(dots.length - 1, t * (dots.length - 1)));
}

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
  const { isSuperAdmin, isAuthed, token } = useAuth();
  const { viewAsUser, setViewAsUser } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const home = useHomeLayout();
  const canEdit = isSuperAdmin && !viewAsUser;
  // 방문자에게는 안 보임. 일반 클릭은 그대로 포커스/펼침. 금고는 아이콘·Alt+클릭만.
  const showVault = isSuperAdmin;
  const narrow = useMedia("(max-width: 767px)");
  const phonePreview = new URLSearchParams(location.search).has("phone");
  const mobile = phonePreview || narrow;
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [webgl, setWebgl] = useState(() => hasWebGL());
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const [vault, setVault] = useState(null);
  const rootRef = useRef(null);
  const railDrag = useRef({ on: false, moved: false, y: 0 });

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
  const heading = snap.active ? snap.target : snap.index;
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

  useUniverseInput(!menu && !vault && !login);

  useEffect(() => {
    if (!settled) return;
    const id = ids[snap.index];
    const hash = id && id !== "gateway" ? `#${id}` : "";
    if (window.location.hash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
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
  const mark = sections[heading] || section;
  const isGateway = section?.id === "gateway";
  const isProjects = section?.id === "projects";
  const project = isProjects ? projects[Math.max(0, snap.focus)] || projects[0] : null;
  const one = section ? sectionOne(section, home) : "";
  const tabLabel = section?.source.kind === "tab" ? home.profile?.tabs?.find((t) => t.id === section.source.id)?.label : null;

  const fallback = !webgl;
  const style = { "--uv-color": section?.color, "--uv-accent": section?.accent };

  const goPage = (path) => {
    setMenu(false);
    if (path === "/" && location.pathname === "/") {
      if (isSuperAdmin) setViewAsUser((v) => !v);
      return;
    }
    navigate(path);
  };

  return (
    <main ref={rootRef} className={`uv${mobile ? " uv--mobile" : ""}${settled ? " is-settled" : " is-warping"}${snap.arriving ? " is-arriving" : ""}${fallback ? " uv--fallback" : ""}${canEdit ? " uv--edit" : ""}`} style={style}>
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
      </div>

      {canEdit && (
        <div className="uv-hud__edit" role="status" data-no-nav>
          <span>EDIT MODE</span>
          <button type="button" onClick={() => setViewAsUser(true)}>
            EXIT
          </button>
        </div>
      )}

      <p className="uv-sr" aria-live="polite">
        {settled && section ? `${section.label} — ${section.ko}` : ""}
      </p>

      {isGateway && settled && (
        <HeroBlock home={home} canEdit={canEdit} onEnter={() => step(1)} showVault={showVault} onOpenVault={setVault} />
      )}

      {!isGateway && section && (
        <header className="uv-title" key={section.id} style={{ "--len": Math.max(6, (tabLabel || section.label).length) }}>
          <p className="uv-title__line">
            <span className="uv-title__no">{section.no}</span> {tabLabel && canEdit ? (
              <Field tag="span" className="uv-title__label" value={tabLabel} canEdit onSave={(label) => home.patchProfileTab(section.source.id, { label })} />
            ) : (
              <span className="uv-title__label">{section.label}</span>
            )}
          </p>
          <p className="uv-title__ko">{section.ko}</p>
          {canEdit && section.source.kind !== "projects" && (
            <Field className="uv-title__one" value={one} canEdit placeholder="한 줄 소개" onSave={(v) => patchOne(section, home, v)} />
          )}
          {isProjects && !mobile && <ProjectPicker projects={projects} focus={snap.focus} onPick={setFocus} />}
        </header>
      )}

      {mobile && mark?.id === "projects" && (
        <div className="uv-picker-bar" data-ui-scroll data-no-nav>
          <ProjectPicker projects={projects} focus={snap.focus} onPick={setFocus} className="uv-picker--row" />
        </div>
      )}

      {!mobile && !isGateway && section && (
        <aside className="uv-panel" data-ui-scroll aria-label={`${section.ko} 내용`} key={`p-${section.id}`}>
          {isProjects ? (
            <ProjectDetail project={project} home={home} canEdit={canEdit} showVault={showVault} onOpenVault={setVault} />
          ) : (
            <ItemsList section={section} home={home} items={items} canEdit={canEdit} focus={snap.focus} onPick={setFocus} showVault={showVault} onOpenVault={setVault} />
          )}
        </aside>
      )}

      <nav
        className="uv-rail"
        aria-label="섹션 이동"
        data-no-nav
        onPointerDown={(e) => {
          if (e.button && e.button !== 0) return;
          railDrag.current = { on: true, moved: false, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = railDrag.current;
          if (!d.on) return;
          if (!d.moved && Math.abs(e.clientY - d.y) < 6) return;
          d.moved = true;
          scrubTo(indexFromRailY(e.currentTarget, e.clientY));
        }}
        onPointerUp={(e) => {
          const d = railDrag.current;
          if (!d.on) return;
          d.on = false;
          if (d.moved) releaseScrub();
        }}
        onPointerCancel={() => {
          if (!railDrag.current.on) return;
          railDrag.current.on = false;
          if (railDrag.current.moved) releaseScrub();
        }}
      >
        <RailThumb />
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`uv-rail__stop${i === (snap.active ? snap.to : snap.index) ? " is-on" : ""}`}
            onClick={() => {
              if (railDrag.current.moved) return;
              goTo(i);
            }}
            aria-current={!snap.active && i === snap.index ? "step" : undefined}
            aria-label={`${s.no} ${s.label} ${s.ko}`}
          >
            <span className="uv-rail__label">
              <b>{s.no}</b> {s.ko}
            </span>
            <i />
          </button>
        ))}
      </nav>

      <div className="uv-arrows">
        {heading > 0 && (
          <button type="button" className="uv-arrows__btn uv-arrows__btn--up" onClick={() => step(-1)} aria-label="이전 섹션">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
        )}
        {heading < total - 1 && (
          <button type="button" className="uv-arrows__btn uv-arrows__btn--down" onClick={() => step(1)} aria-label="다음 섹션">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {mark && (
        <button
          type="button"
          className="uv-mark"
          onClick={() => setMenu(true)}
          aria-label={`${mark.no} ${mark.label} ${mark.ko}, 메뉴 열기`}
        >
          <b>{mark.no}</b>
          <span>{mark.label}</span>
        </button>
      )}

      <button type="button" className="uv-burger" onClick={() => setMenu(true)} aria-label="메뉴 열기">
        <i />
        <i />
        <i />
      </button>

      {mobile && !isGateway && section && (
        <div className="uv-dock">
          <div className="uv-dock__peek" data-ui-scroll aria-label={`${section.ko} 내용`}>
            {isProjects ? (
              <ProjectDetail project={project} home={home} canEdit={canEdit} showVault={showVault} onOpenVault={setVault} />
            ) : (
              <ItemsList section={section} home={home} items={items} canEdit={canEdit} focus={snap.focus} onPick={setFocus} showVault={showVault} onOpenVault={setVault} />
            )}
          </div>
        </div>
      )}

      {menu && createPortal(
        <div className="uv-menu" data-modal role="dialog" aria-modal="true" aria-label="메뉴" style={style}>
          <div className="uv-menu__head">
            <span>MENU</span>
            <div className="uv-menu__head-acts">
              {isSuperAdmin && (
                <button type="button" className="uv-menu__ghost" onClick={() => goPage("/")}>
                  {viewAsUser ? "EDIT" : "VIEW"}
                </button>
              )}
              {!isAuthed && (
                <button
                  type="button"
                  className="uv-menu__ghost"
                  onClick={() => {
                    setMenu(false);
                    setLogin(true);
                  }}
                >
                  LOGIN
                </button>
              )}
              <button type="button" onClick={() => setMenu(false)} aria-label="닫기">
                ✕
              </button>
            </div>
          </div>
          <div className="uv-menu__cards">
            <button type="button" className={location.pathname === "/schedule" ? "is-on" : ""} onClick={() => goPage("/schedule")}>
              <span className="uv-menu__emoji" aria-hidden="true">📅</span>
              <span className="uv-menu__card-label">일정</span>
            </button>
            <button type="button" className={location.pathname.toLowerCase() === "/binance" ? "is-on" : ""} onClick={() => goPage("/binance")}>
              <span className="uv-menu__emoji" aria-hidden="true">📈</span>
              <span className="uv-menu__card-label">바이낸스</span>
            </button>
            <button type="button" className={location.pathname === "/admin" ? "is-on" : ""} onClick={() => goPage("/admin")}>
              <span className="uv-menu__emoji" aria-hidden="true">⚙️</span>
              <span className="uv-menu__card-label">관리자페이지</span>
              <span className="uv-menu__card-sub">계정 · 회원 · DS</span>
            </button>
            <button type="button" className={location.pathname === "/ai" ? "is-on" : ""} onClick={() => goPage("/ai")}>
              <span className="uv-menu__emoji" aria-hidden="true">✦</span>
              <span className="uv-menu__card-label">AI 챗봇</span>
              <span className="uv-menu__card-sub">개설 예정</span>
            </button>
          </div>
          <p className="uv-menu__group">JOURNEY</p>
          <ol className="uv-menu__secs">
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
                  <span className="uv-menu__head-line">
                    <span className="uv-menu__no">{s.no}</span>
                    <span className="uv-menu__world">{s.ko}</span>
                  </span>
                  <span className="uv-menu__label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>,
        phonePreview && rootRef.current ? rootRef.current : document.body
      )}

      <SideDrawer open={login} onClose={() => setLogin(false)} />

      {isSuperAdmin && (
        <DriveStore
          open={Boolean(vault)}
          onClose={() => setVault(null)}
          contentKind={vault?.contentKind}
          contentId={vault?.contentId}
          contentTitle={vault?.title}
          token={token}
        />
      )}
    </main>
  );
}
