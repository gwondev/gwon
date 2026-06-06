import { useState } from "react";

export function blankForm(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {});
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

export default function FieldGrid({ fields, form, onChange, idPrefix = "" }) {
  const set = (name, value) => onChange(name, value);

  return (
    <div className="adder__grid">
      {fields.map((f) => {
        const fid = `${idPrefix}${f.name}`;
        return (
          <div key={f.name} className={`field ${f.span ? "span-2" : ""}`}>
            <label htmlFor={fid}>{f.label}</label>
            {f.type === "period" ? (
              <PeriodInput id={fid} value={form[f.name]} onChange={(v) => set(f.name, v)} />
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
