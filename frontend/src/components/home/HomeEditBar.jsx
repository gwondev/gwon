import { useState } from "react";
import { fileToCompressedDataUrl } from "../../lib/image";
import { fileToVideoDataUrl } from "../../lib/video";
import { blankProject } from "../../lib/homeLayout.js";
import "./HomeEditBar.css";

export default function HomeEditBar({ home, project, onAdd, onRemove, onPatch }) {
  const { edit, setEdit, dirty, saving, save, reset } = home;
  const [form, setForm] = useState(null);

  return (
    <>
      <div className="world-editbar">
        <button type="button" className={edit ? "is-on" : ""} onClick={() => setEdit((v) => !v)}>
          {edit ? "수정 종료" : "수정모드"}
        </button>
        {edit && (
          <>
            <button type="button" onClick={onAdd}>
              프로젝트 추가
            </button>
            {project && (
              <>
                <button type="button" onClick={() => setForm({ ...project, keywords: (project.keywords || []).join(", "), stack: (project.stack || []).join(", ") })}>
                  이 프로젝트 수정
                </button>
                <button type="button" className="is-danger" onClick={() => onRemove(project.id)}>
                  삭제
                </button>
              </>
            )}
            <button type="button" onClick={reset}>
              기본값
            </button>
            <button type="button" className="is-save" disabled={!dirty || saving} onClick={save}>
              {saving ? "저장…" : dirty ? "저장" : "저장됨"}
            </button>
          </>
        )}
      </div>
      {form && (
        <div className="world-editpop" onClick={() => setForm(null)} role="presentation">
          <form
            className="world-editpop__box"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              onPatch(form.id, {
                ...form,
                keywords: String(form.keywords || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                stack: String(form.stack || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              setForm(null);
            }}
          >
            <strong>프로젝트 수정</strong>
            <label>
              제목
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label>
              부제
              <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </label>
            <label>
              기간
              <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </label>
            <label>
              역할
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </label>
            <label>
              설명
              <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              키워드 (쉼표)
              <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </label>
            <label>
              스택 (쉼표)
              <input value={form.stack} onChange={(e) => setForm({ ...form, stack: e.target.value })} />
            </label>
            <label>
              결과
              <input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
            </label>
            <label className="world-editpop__file">
              사진
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const image = await fileToCompressedDataUrl(file);
                  setForm((f) => ({ ...f, image }));
                }}
              />
            </label>
            <label className="world-editpop__file">
              영상
              <input
                type="file"
                accept="video/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const video = await fileToVideoDataUrl(file);
                  setForm((f) => ({ ...f, video }));
                }}
              />
            </label>
            <div className="world-editpop__acts">
              <button type="button" onClick={() => setForm(null)}>
                취소
              </button>
              <button type="submit" className="is-save">
                적용
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export { blankProject };
