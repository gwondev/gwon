import { useEffect, useMemo, useState } from "react";
import { blankPage } from "../../../lib/homeLayout.js";
import { live } from "../director.js";
import Field from "./Field.jsx";
import MediaPages from "./MediaPages.jsx";

export function sectionOne(section, home) {
  const src = section.source.kind === "merged" ? section.source.one : section.source;
  if (src.kind === "tab") return home.profile?.tabs?.find((t) => t.id === src.id)?.one || "";
  if (src.kind === "world") return home.worlds?.[src.id]?.one || "";
  return "";
}

export function patchOne(section, home, one) {
  const src = section.source.kind === "merged" ? section.source.one : section.source;
  if (src.kind === "tab") home.patchProfileTab(src.id, { one });
  else if (src.kind === "world") home.patchWorld(src.id, { one });
}

export function patchItem(section, home, id, fields) {
  const src = section.source;
  if (src.kind === "tab") home.patchProfileItem(src.id, id, fields);
  else if (src.kind === "world") home.patchWorldItem(src.id, id, fields);
}

export function HeroBlock({ home, canEdit, onEnter }) {
  const hero = home.hero || {};
  const title = hero.name || hero.line;
  return (
    <section className={`uv-hero${canEdit ? " is-editing" : ""}`} aria-label="소개">
      <div className="uv-hero__kickrow">
        <Field className="uv-hero__kicker" value={hero.kicker} canEdit={canEdit} placeholder="KICKER" onSave={(kicker) => home.patchHero({ kicker })} />
      </div>
      {canEdit ? (
        <>
          <Field tag="h1" className="uv-hero__title" value={hero.name} canEdit placeholder="이름" onSave={(name) => home.patchHero({ name })} />
          <Field className="uv-hero__line" value={hero.line} canEdit placeholder="한 줄" onSave={(line) => home.patchHero({ line })} />
        </>
      ) : (
        <>
          {title && <h1 className="uv-hero__title">{title}</h1>}
          {hero.name && hero.line && <p className="uv-hero__line">{hero.line}</p>}
        </>
      )}
      <Field className="uv-hero__tagline" value={hero.tagline} canEdit={canEdit} placeholder="태그라인" onSave={(tagline) => home.patchHero({ tagline })} />
      <button type="button" className="uv-enter" onClick={onEnter}>
        <span className="uv-enter__ring" aria-hidden="true" />
        <span className="uv-enter__label">{hero.explore || "EXPLORE"}</span>
        <span className="uv-enter__hint" aria-hidden="true">
          커리어와 기록으로
        </span>
      </button>
    </section>
  );
}

export function ProjectPicker({ projects, focus, onPick, className = "" }) {
  return (
    <div className={`uv-picker ${className}`} role="tablist" aria-label="프로젝트 선택">
      {projects.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={focus === i}
          className={focus === i ? "is-on" : ""}
          onClick={() => onPick(i)}
        >
          <span className="uv-picker__no">{p.no}</span>
          <span className="uv-picker__title">{p.title}</span>
        </button>
      ))}
    </div>
  );
}

export function ProjectDetail({ project, home, canEdit }) {
  if (!project) return null;
  const pages = project.pages?.length ? project.pages : [blankPage(0)];
  const meta = [project.period, project.role].filter(Boolean);
  return (
    <article className="uv-project">
      <header className="uv-project__head">
        <span className="uv-project__no">PROJECT {project.no}</span>
        <Field tag="h2" className="uv-project__title" value={project.title} canEdit={canEdit} placeholder="프로젝트 이름" onSave={(title) => home.patchProject(project.id, { title })} />
        <Field className="uv-project__sub" value={project.subtitle} canEdit={canEdit} placeholder="부제" onSave={(subtitle) => home.patchProject(project.id, { subtitle })} />
        {meta.length > 0 && <p className="uv-project__meta">{meta.join(" · ")}</p>}
      </header>
      <MediaPages
        pages={pages}
        title={project.title}
        canEdit={canEdit}
        onPatchCell={(pi, side, fields) => {
          home.patchProject(project.id, {
            pages: pages.map((pg, i) => (i === pi ? { ...pg, [side]: { ...pg[side], ...fields } } : pg)),
          });
        }}
        onAdd={() => home.patchProject(project.id, { pages: [...pages, blankPage(pages.length)] })}
      />
      <Field className="uv-project__desc" value={project.description} canEdit={canEdit} multiline placeholder="설명" onSave={(description) => home.patchProject(project.id, { description })} />
      {project.result && (
        <p className="uv-project__result">
          <span>RESULT</span>
          {project.result}
        </p>
      )}
      {project.stack?.length > 0 && (
        <ul className="uv-chips" aria-label="사용 기술">
          {project.stack.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ItemsList({ section, home, items, canEdit, focus, onPick }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    setQuery("");
  }, [section.id]);

  const indexed = useMemo(() => items.map((it, i) => ({ it, i })), [items]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? indexed.filter(({ it }) => `${it.title || ""} ${it.subtitle || ""} ${it.description || ""}`.toLowerCase().includes(q))
    : indexed;
  if (!items.length) {
    return (
      <div className="uv-empty">
        <span className="uv-empty__code">NO SIGNAL</span>
        <p>아직 공개된 {section.ko} 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="uv-items-wrap">
      {items.length > 8 && (
        <label className="uv-items__filter" data-no-nav>
          <span>FILTER</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
            aria-label={`${section.ko} 검색`}
          />
        </label>
      )}
      {shown.length === 0 ? (
        <div className="uv-empty">
          <span className="uv-empty__code">NO MATCH</span>
          <p>해당하는 {section.ko}가 없습니다.</p>
        </div>
      ) : (
        <ol className={`uv-items uv-items--${section.id === "credentials" ? "certs" : section.source.layout || "experience"}`}>
          {shown.map(({ it, i }) => {
            const on = focus === i;
            return (
              <li key={it.id} className={on ? "is-on" : ""} style={section.id === "credentials" ? { "--i": i } : undefined}>
                <div
                  className="uv-item"
                  role={canEdit ? undefined : "button"}
                  tabIndex={canEdit ? undefined : 0}
                  aria-expanded={canEdit ? undefined : on}
                  onClick={() => {
                    if (!canEdit) onPick(on ? -1 : i);
                  }}
                  onKeyDown={(e) => {
                    if (canEdit) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onPick(on ? -1 : i);
                    }
                  }}
                >
                  <span className="uv-item__idx">{String(i + 1).padStart(2, "0")}</span>
                  <div className="uv-item__body">
                    <Field tag="b" className="uv-item__title" value={it.title} canEdit={canEdit} placeholder="제목" onSave={(title) => patchItem(section, home, it.id, { title })} />
                    <Field tag="span" className="uv-item__sub" value={it.subtitle} canEdit={canEdit} placeholder="기간 · 부제" onSave={(subtitle) => patchItem(section, home, it.id, { subtitle })} />
                    {section.id === "credentials" && (it.issuer || it.acquired || it.score) && (
                      <span className="uv-item__facts">
                        {it.issuer && <em>{it.issuer}</em>}
                        {it.acquired && <em>{it.acquired}</em>}
                        {it.score && <em>{it.score}</em>}
                      </span>
                    )}
                    {(canEdit || on) && (
                      <Field
                        tag="p"
                        className="uv-item__desc"
                        value={it.description || (canEdit ? "" : "등록된 세부 설명이 없습니다.")}
                        canEdit={canEdit}
                        multiline
                        placeholder="설명"
                        onSave={(description) => patchItem(section, home, it.id, { description })}
                      />
                    )}
                  </div>
                  {canEdit && (
                    <div className="uv-item__actions">
                      <button type="button" className="uv-item__focus" onClick={() => onPick(on ? -1 : i)} aria-label="3D 위치 보기">
                        ◎
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const CAREER_HINTS = ["두뇌 중심부", "신경 경로", "바깥 신경망"];

/**
 * 경력 및 프로필: 프로필 · 경력 · 기술 세 갈래를 탭으로 오간다.
 * 고른 갈래와 항목을 live 에 알려 두뇌 장면이 해당 부위(중심부·경로·바깥 노드)를 밝힌다.
 */
export function CareerPanel({ parts, home, canEdit, focus, onPick }) {
  const [tab, setTab] = useState(live.brainMode || 0);
  useEffect(() => {
    live.brainMode = tab;
  }, [tab]);

  const pick = (i) => {
    if (i === tab) return;
    setTab(i);
    onPick(-1);
  };
  const { part, items } = parts[tab];
  const skillOne = home.worlds?.infrastructure?.one;

  return (
    <div className="uv-career">
      <div className="uv-career__tabs" role="tablist" aria-label="경력 및 프로필 갈래" data-no-nav>
        {parts.map(({ part: pt, items: its }, i) => (
          <button
            key={pt.id}
            type="button"
            role="tab"
            aria-selected={tab === i}
            className={tab === i ? "is-on" : ""}
            onClick={() => pick(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                pick((i + (e.key === "ArrowRight" ? 1 : parts.length - 1)) % parts.length);
              }
            }}
          >
            <span className="uv-career__tab-label">{pt.label}</span>
            <span className="uv-career__tab-ko">
              {pt.ko} <em>{its.length}</em>
            </span>
          </button>
        ))}
      </div>
      <p className="uv-career__hint" aria-hidden="true">
        <i /> {CAREER_HINTS[tab]}
      </p>
      <div className="uv-career__body" key={part.id} role="tabpanel">
        {part.id === "infrastructure" && !canEdit ? (
          <SkillChips items={items} one={skillOne} focus={focus} onPick={onPick} />
        ) : (
          <ItemsList section={part} home={home} items={items} canEdit={canEdit} focus={focus} onPick={onPick} />
        )}
      </div>
    </div>
  );
}

function SkillChips({ items, one, focus, onPick }) {
  if (!items.length) {
    return (
      <div className="uv-empty">
        <span className="uv-empty__code">NO SIGNAL</span>
        <p>아직 공개된 기술 기록이 없습니다.</p>
      </div>
    );
  }
  const on = items[focus];
  const note = on ? [on.subtitle, on.description].map((x) => (x || "").trim()).filter(Boolean).join(" · ") : "";
  return (
    <div className="uv-skills">
      {one && <p className="uv-skills__one">{one}</p>}
      <ul className="uv-skills__chips">
        {items.map((it, i) => (
          <li key={it.id}>
            <button type="button" className={focus === i ? "is-on" : ""} aria-pressed={focus === i} onClick={() => onPick(focus === i ? -1 : i)}>
              {it.title}
            </button>
          </li>
        ))}
      </ul>
      {note && <p className="uv-skills__note">{note}</p>}
    </div>
  );
}
