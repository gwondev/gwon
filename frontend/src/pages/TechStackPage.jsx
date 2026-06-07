import { useCallback, useState } from "react";
import SectionLayout from "../components/SectionLayout";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useTechStack } from "../lib/useTechStack";
import StackChip from "../components/StackChip";
import { TECH_STACK_FALLBACK } from "../lib/sections";
import "./TechStackPage.css";

function emptyGroup() {
  return { group: "", items: "" };
}

export default function TechStackPage() {
  const { isAdmin, token, localMode } = useAuth();
  const { groups, loading, reload } = useTechStack();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const startEdit = useCallback(() => {
    setDraft(
      groups.map((g) => ({
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

  const display = loading ? TECH_STACK_FALLBACK : groups;

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
          <div className="techstack__stack">
            {display.map((g) => (
              <div className="techstack__group" key={g.group}>
                <span className="techstack__group-name">{g.group}</span>
                <div className="techstack__group-items">
                  {g.items.map((it) => (
                    <StackChip key={it} item={it} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <form className="techstack__form" onSubmit={save}>
          <p className="techstack__hint">
            그룹 이름은 IoT, App, AI, Infra처럼 <strong>분야·프로젝트 유형</strong>으로
            적어주세요. 기술은 쉼표로 구분합니다. 이름 앞에 <strong>*</strong>가 있으면
            강조 표시됩니다. (예: <code>*Docker</code>, MQTT)
          </p>
          {draft.map((g, i) => (
            <div className="techstack__row" key={i}>
              <label className="techstack__label">
                그룹명
                <input
                  value={g.group}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, group: e.target.value } : row))
                    )
                  }
                  placeholder="예: IoT"
                />
              </label>
              <label className="techstack__label techstack__label--wide">
                기술 (쉼표 구분)
                <input
                  value={g.items}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, items: e.target.value } : row))
                    )
                  }
                  placeholder="예: *MQTT, Arduino, Python"
                />
              </label>
              <button
                type="button"
                className="techstack__remove"
                onClick={() => setDraft((prev) => prev.filter((_, j) => j !== i))}
                aria-label="그룹 삭제"
              >
                ✕
              </button>
            </div>
          ))}
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
