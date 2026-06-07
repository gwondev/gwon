import { useCallback, useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import SectionLayout from "../components/SectionLayout";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useTechStack } from "../lib/useTechStack";
import StackChip from "../components/StackChip";
import { TECH_STACK_FALLBACK } from "../lib/sections";
import "./TechStackPage.css";

function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyGroup() {
  return { _rid: newRowId(), group: "", items: "" };
}

function toPayload(groups) {
  return groups.map(({ group, items }) => ({ group, items }));
}

function TechStackGroupRow({ group, sortable }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={group}
      dragListener={false}
      dragControls={controls}
      className={`techstack__group${sortable ? " techstack__group--sortable" : ""}`}
    >
      {sortable && (
        <button
          type="button"
          className="record__drag"
          aria-label="순서 변경"
          onPointerDown={(e) => controls.start(e)}
        >
          ⠿
        </button>
      )}
      <span className="techstack__group-name">{group.group}</span>
      <div className="techstack__group-items">
        {group.items.map((it) => (
          <StackChip key={it} item={it} />
        ))}
      </div>
    </Reorder.Item>
  );
}

function DraftRow({ row, onChange, onRemove }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      className="techstack__row techstack__row--sortable"
    >
      <button
        type="button"
        className="record__drag techstack__draft-drag"
        aria-label="순서 변경"
        onPointerDown={(e) => controls.start(e)}
      >
        ⠿
      </button>
      <label className="techstack__label">
        그룹명
        <input
          value={row.group}
          onChange={(e) => onChange({ ...row, group: e.target.value })}
          placeholder="예: IoT"
        />
      </label>
      <label className="techstack__label techstack__label--wide">
        기술 (쉼표 구분)
        <input
          value={row.items}
          onChange={(e) => onChange({ ...row, items: e.target.value })}
          placeholder="예: *MQTT, Arduino, Python"
        />
      </label>
      <button type="button" className="techstack__remove" onClick={onRemove} aria-label="그룹 삭제">
        ✕
      </button>
    </Reorder.Item>
  );
}

export default function TechStackPage() {
  const { isAdmin, token, localMode } = useAuth();
  const { groups, loading, reload } = useTechStack();
  const [ordered, setOrdered] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const reorderTimer = useRef(null);
  const reorderPrev = useRef(null);

  useEffect(() => {
    const list = loading ? TECH_STACK_FALLBACK : groups;
    setOrdered(
      list.map((g, i) => ({
        ...g,
        _rid: `${g.group}-${i}`,
      }))
    );
  }, [groups, loading]);

  useEffect(
    () => () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
    },
    []
  );

  const persistOrder = useCallback(
    (next) => {
      if (localMode) return;
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(async () => {
        try {
          await api("/admin/tech-stack", {
            method: "PUT",
            body: { groups: toPayload(next) },
            token,
          });
          reload();
        } catch (e) {
          if (reorderPrev.current) setOrdered(reorderPrev.current);
          alert(`순서 변경 실패: ${e.message}`);
        }
      }, 350);
    },
    [localMode, reload, token]
  );

  const handleReorder = (next) => {
    reorderPrev.current = ordered;
    setOrdered(next);
    if (isAdmin && !editMode) persistOrder(next);
  };

  const startEdit = useCallback(() => {
    setDraft(
      groups.map((g) => ({
        _rid: newRowId(),
        group: g.group,
        items: g.items.join(", "),
      }))
    );
    setEditMode(true);
    setMsg(null);
  }, [groups]);

  const save = async (e) => {
    e.preventDefault();
    if (localMode) {
      setMsg({ type: "ok", text: "로컬 모드 — 저장은 서버 배포 후 가능합니다." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload = draft
        .map((g) => ({
          group: g.group.trim(),
          items: g.items
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }))
        .filter((g) => g.group && g.items.length);
      await api("/admin/tech-stack", {
        method: "PUT",
        body: { groups: payload },
        token,
      });
      setMsg({ type: "ok", text: "기술스택이 저장되었습니다." });
      setEditMode(false);
      reload();
    } catch (e2) {
      setMsg({ type: "err", text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionLayout active="techstack" title="기술스택" sub="Tech Stack">
      {isAdmin && (
        <div className="techstack__admin-bar">
          {!editMode ? (
            <button type="button" className="btn btn-ghost" onClick={startEdit}>
              수정
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setEditMode(false)}>
              취소
            </button>
          )}
        </div>
      )}

      {!editMode ? (
        <section className="techstack__view">
          {isAdmin && !localMode ? (
            <Reorder.Group axis="y" values={ordered} onReorder={handleReorder} className="techstack__stack">
              {ordered.map((g) => (
                <TechStackGroupRow key={g._rid} group={g} sortable />
              ))}
            </Reorder.Group>
          ) : (
            <div className="techstack__stack">
              {ordered.map((g) => (
                <div className="techstack__group" key={g._rid}>
                  <span className="techstack__group-name">{g.group}</span>
                  <div className="techstack__group-items">
                    {g.items.map((it) => (
                      <StackChip key={it} item={it} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <form className="techstack__form" onSubmit={save}>
          <p className="techstack__hint">
            그룹 이름은 IoT, App, AI, Infra처럼 <strong>분야·프로젝트 유형</strong>으로
            적어주세요. 기술은 쉼표로 구분합니다. 이름 앞에 <strong>*</strong>가 있으면
            강조 표시됩니다. (예: <code>*Docker</code>, MQTT) ⠿ 로 순서를 바꿀 수 있습니다.
          </p>
          <Reorder.Group axis="y" values={draft} onReorder={setDraft} className="techstack__draft-list">
            {draft.map((row) => (
              <DraftRow
                key={row._rid}
                row={row}
                onChange={(next) =>
                  setDraft((prev) => prev.map((r) => (r._rid === row._rid ? next : r)))
                }
                onRemove={() => setDraft((prev) => prev.filter((r) => r._rid !== row._rid))}
              />
            ))}
          </Reorder.Group>
          <button
            type="button"
            className="btn btn-ghost techstack__add"
            onClick={() => setDraft((prev) => [...prev, emptyGroup()])}
          >
            + 그룹 추가
          </button>
          {msg && (
            <p className={`techstack__msg ${msg.type === "err" ? "is-err" : "is-ok"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </form>
      )}
    </SectionLayout>
  );
}
