import { useState } from "react";
import { fileToCompressedDataUrl } from "../lib/image";
import { fileToVideoDataUrl } from "../lib/video";
import { parseMedia, stringifyMedia, splitTags, isMediaVisible } from "../lib/media";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

function fileToPdfDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF_BYTES) {
      reject(new Error("PDF는 12MB 이하만 업로드할 수 있습니다."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function blankForm(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: f.default ?? "" }), {});
}

const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);

function YmInput({ id, value, onChange }) {
  const [y = "", m = ""] = (value || "").split(".");
  const combine = (ny, nm) => {
    if (!ny && !nm) return onChange("");
    onChange([ny, nm].join("."));
  };
  return (
    <div className="ym-input">
      <input
        id={id}
        inputMode="numeric"
        placeholder="YYYY"
        className="ym-input__y"
        value={y}
        onChange={(e) => combine(digits(e.target.value, 4), m)}
      />
      <span className="ym-input__sep">년</span>
      <input
        inputMode="numeric"
        placeholder="MM"
        className="ym-input__m"
        value={m}
        onChange={(e) => combine(y, digits(e.target.value, 2))}
      />
      <span className="ym-input__sep">월</span>
    </div>
  );
}

function YmdInput({ id, value, onChange }) {
  const [y = "", m = "", d = ""] = (value || "").split(".");
  const combine = (ny, nm, nd) => {
    if (!ny && !nm && !nd) return onChange("");
    onChange([ny, nm, nd].join("."));
  };
  return (
    <div className="ymd-input">
      <input
        id={id}
        inputMode="numeric"
        placeholder="YYYY"
        className="ymd-input__y"
        value={y}
        onChange={(e) => combine(digits(e.target.value, 4), m, d)}
      />
      <span className="ymd-input__sep">년</span>
      <input
        inputMode="numeric"
        placeholder="MM"
        className="ymd-input__md"
        value={m}
        onChange={(e) => combine(y, digits(e.target.value, 2), d)}
      />
      <span className="ymd-input__sep">월</span>
      <input
        inputMode="numeric"
        placeholder="DD"
        className="ymd-input__md"
        value={d}
        onChange={(e) => combine(y, m, digits(e.target.value, 2))}
      />
      <span className="ymd-input__sep">일</span>
    </div>
  );
}

function SelectOther({ id, value, options, onChange }) {
  const preset = options.includes(value);
  const [mode, setMode] = useState(!preset && value ? "other" : "preset");
  const handleSelect = (v) => {
    if (v === "__other") {
      setMode("other");
      onChange("");
    } else {
      setMode("preset");
      onChange(v);
    }
  };
  return (
    <>
      <select
        id={id}
        value={mode === "other" ? "__other" : value}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">선택</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__other">기타 (직접입력)</option>
      </select>
      {mode === "other" && (
        <input
          className="select-other__input"
          placeholder="직접 입력"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}

function PeriodInput({ id, value, onChange }) {
  const [startRaw = "", endRaw = ""] = (value || "").split("~").map((s) => s.trim());
  const combine = (s, e) => {
    if (!s && !e) return onChange("");
    onChange(`${s} ~ ${e}`.trim());
  };
  return (
    <div className="period-input">
      <YmInput id={id} value={startRaw} onChange={(v) => combine(v, endRaw)} />
      <span className="period-input__sep">~</span>
      <YmInput value={endRaw} onChange={(v) => combine(startRaw, v)} />
    </div>
  );
}

// 기간 입력 (시작 ~ 종료, 연·월·일)
function PeriodYmdInput({ id, value, onChange }) {
  const [startRaw = "", endRaw = ""] = (value || "").split("~").map((s) => s.trim());
  const combine = (s, e) => {
    if (!s && !e) return onChange("");
    onChange(`${s} ~ ${e}`.trim());
  };
  return (
    <div className="period-input">
      <YmdInput id={id} value={startRaw} onChange={(v) => combine(v, endRaw)} />
      <span className="period-input__sep">~</span>
      <YmdInput value={endRaw} onChange={(v) => combine(startRaw, v)} />
    </div>
  );
}

function MultiSelect({ value, options, onChange }) {
  const selected = splitTags(value);
  const [custom, setCustom] = useState("");

  const setSelected = (next) => onChange(next.join(", "));

  const toggle = (opt) => {
    if (selected.includes(opt)) setSelected(selected.filter((s) => s !== opt));
    else setSelected([...selected, opt]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !selected.includes(v)) setSelected([...selected, v]);
    setCustom("");
  };

  const extras = selected.filter((s) => !options.includes(s));

  return (
    <div className="multiselect">
      <div className="multiselect__chips">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            className={`multiselect__chip ${selected.includes(o) ? "is-on" : ""}`}
            onClick={() => toggle(o)}
          >
            {o}
          </button>
        ))}
        {extras.map((o) => (
          <button
            type="button"
            key={o}
            className="multiselect__chip is-on multiselect__chip--custom"
            onClick={() => toggle(o)}
          >
            {o} ✕
          </button>
        ))}
      </div>
      <div className="multiselect__add">
        <input
          value={custom}
          placeholder="직접 추가"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" className="multiselect__add-btn" onClick={addCustom}>
          추가
        </button>
      </div>
    </div>
  );
}

function ImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const handleFile = async (fileList) => {
    const file = Array.from(fileList || [])[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      alert(err.message || "이미지를 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="image-field">
      {value ? (
        <div className="image-field__preview">
          <img src={value} alt="" />
          <button
            type="button"
            className="image-field__remove"
            onClick={() => onChange("")}
            aria-label="이미지 제거"
          >
            ✕
          </button>
        </div>
      ) : null}
      <label className="image-field__upload">
        {busy ? "처리 중…" : value ? "이미지 변경" : "＋ 이미지 선택"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            handleFile(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function MediaEditor({ value, onChange }) {
  const list = parseMedia(value);
  const [busy, setBusy] = useState(false);
  const setList = (next) => onChange(stringifyMedia(next));

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const additions = [];
      for (const f of files) {
        if (f.type.startsWith("image/")) {
          const image = await fileToCompressedDataUrl(f);
          additions.push({ image, caption: "", name: "" });
        } else if (f.type.startsWith("video/")) {
          const video = await fileToVideoDataUrl(f);
          additions.push({ video, caption: "", name: "" });
        } else if (f.type === "application/pdf") {
          const pdf = await fileToPdfDataUrl(f);
          additions.push({ pdf, caption: "", name: f.name?.replace(/\.pdf$/i, "") || "" });
        }
      }
      if (!additions.length) {
        alert("사진, 영상, PDF 파일만 추가할 수 있습니다.");
        return;
      }
      setList([...list, ...additions]);
    } catch (err) {
      alert(err.message || "미디어를 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const updateCaption = (i, caption) =>
    setList(list.map((m, j) => (j === i ? { ...m, caption } : m)));
  const updateName = (i, name) =>
    setList(list.map((m, j) => (j === i ? { ...m, name } : m)));
  const updateVisible = (i, visible) =>
    setList(
      list.map((m, j) => {
        if (j !== i) return m;
        if (visible) {
          const { visible: _omit, ...rest } = m;
          return rest;
        }
        return { ...m, visible: false };
      })
    );
  const removeAt = (i) => setList(list.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  return (
    <div className="media-editor">
      <div className="media-editor__items">
        {list.map((m, i) => (
          <div className="media-editor__item" key={i}>
            <div className="media-editor__thumb">
              {!isMediaVisible(m) && <span className="media-editor__hidden-badge">탭 숨김</span>}
              {m.pdf ? (
                <span className="media-editor__pdf-badge">PDF</span>
              ) : m.video ? (
                <video src={m.video} muted playsInline />
              ) : m.image ? (
                <img src={m.image} alt="" />
              ) : (
                <span>미디어 없음</span>
              )}
            </div>
            <div className="media-editor__fields">
              <input
                className="media-editor__name"
                value={m.name || ""}
                placeholder={`이름 (예: 수상사진) · 미입력 시 ${
                  m.pdf ? "PDF" : m.video ? "동영상" : "사진"
                }${i + 1}`}
                onChange={(e) => updateName(i, e.target.value)}
              />
              <textarea
                className="media-editor__caption"
                value={m.caption || ""}
                placeholder="이 사진·영상에 대한 설명 한 줄"
                onChange={(e) => updateCaption(i, e.target.value)}
              />
              <div className="media-editor__visibility" role="radiogroup" aria-label="탭 노출">
                <label className={`media-editor__vis-opt ${isMediaVisible(m) ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name={`media-vis-${i}`}
                    checked={isMediaVisible(m)}
                    onChange={() => updateVisible(i, true)}
                  />
                  <span>탭 표시</span>
                </label>
                <label className={`media-editor__vis-opt ${!isMediaVisible(m) ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name={`media-vis-${i}`}
                    checked={!isMediaVisible(m)}
                    onChange={() => updateVisible(i, false)}
                  />
                  <span>탭 숨김</span>
                </label>
              </div>
              <div className="media-editor__row-actions">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1}
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="media-editor__del"
                  onClick={() => removeAt(i)}
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <label className="media-editor__upload">
        {busy ? "미디어 처리 중…" : "＋ 사진·영상·PDF 추가 (여러 개 가능)"}
        <input
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export default function FieldGrid({ fields, form, onChange, idPrefix = "" }) {
  const set = (name, value) => onChange(name, value);

  return (
    <div className="adder__grid">
      {fields.map((f) => {
        const fid = `${idPrefix}${f.name}`;
        return (
          <div key={f.name} className={`field ${f.span ? "span-2" : ""}`}>
            {f.type === "checkbox" || f.type === "radio" ? (
              <span className="field__label" id={fid}>
                {f.label}
              </span>
            ) : (
              <label htmlFor={fid}>{f.label}</label>
            )}
            {f.hint && <p className="field__hint">{f.hint}</p>}
            {f.type === "period" ? (
              <PeriodInput id={fid} value={form[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.type === "period-ymd" ? (
              <PeriodYmdInput id={fid} value={form[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.type === "ymd" ? (
              <YmdInput id={fid} value={form[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.type === "select-other" ? (
              <SelectOther
                id={fid}
                value={form[f.name]}
                options={f.options}
                onChange={(v) => set(f.name, v)}
              />
            ) : f.type === "textarea" ? (
              <textarea
                id={fid}
                value={form[f.name]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select id={fid} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">선택</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "multiselect" ? (
              <MultiSelect
                value={form[f.name]}
                options={f.options}
                onChange={(v) => set(f.name, v)}
              />
            ) : f.type === "media" ? (
              <MediaEditor value={form[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.type === "image" ? (
              <ImageField value={form[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.type === "checkbox" ? (
              <label className="field-checkbox">
                <input
                  id={fid}
                  type="checkbox"
                  checked={form[f.name] === "1" || form[f.name] === true}
                  onChange={(e) => set(f.name, e.target.checked ? "1" : "0")}
                />
                <span>{f.checkboxLabel || f.label || "선택"}</span>
              </label>
            ) : f.type === "radio" ? (
              <div className="field-radio" role="radiogroup" aria-labelledby={fid}>
                {(f.options || []).map((opt) => (
                  <label key={opt.value} className="field-radio__opt">
                    <input
                      type="radio"
                      name={fid}
                      value={opt.value}
                      checked={String(form[f.name] ?? f.default ?? "1") === String(opt.value)}
                      onChange={() => set(f.name, opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                id={fid}
                type={f.type || "text"}
                value={form[f.name]}
                placeholder={f.placeholder}
                required={f.required}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
