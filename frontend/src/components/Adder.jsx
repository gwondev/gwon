import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

function blank(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {});
}

const digits = (v, max) => v.replace(/\D/g, "").slice(0, max);

// 연·월 직접 입력 (키보드 숫자만) -> "YYYY.MM"
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

// 연·월·일 직접 입력 (키보드 숫자만, 팝업 없음) -> "YYYY.MM.DD"
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

// 옵션 선택 + "기타(직접입력)"
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

// 기간 입력 (시작 ~ 종료, 연·월 직접 입력)
function PeriodInput({ id, value, onChange }) {
  const [startRaw = "", endRaw = ""] = (value || "").split("~").map((s) => s.trim());
  const combine = (s, e) => {
    if (!s && !e) return onChange("");
    onChange(`${s} ~ ${e}`.trim());
  };
  return (
    <div className="period-input">
      <YmInput
        id={id}
        value={startRaw}
        onChange={(v) => combine(v, endRaw)}
      />
      <span className="period-input__sep">~</span>
      <YmInput
        value={endRaw}
        onChange={(v) => combine(startRaw, v)}
      />
    </div>
  );
}

export default function Adder({ label, fields, onCreate }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => blank(fields));
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate(form);
      setForm(blank(fields));
      setOpen(false);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adder">
      <button className="adder__toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "✕ 닫기" : `＋ ${label}`}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="adder__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <form className="adder__form" onSubmit={submit}>
              <div className="adder__grid">
                {fields.map((f) => (
                  <div
                    key={f.name}
                    className={`field ${f.span ? "span-2" : ""}`}
                  >
                    <label htmlFor={f.name}>{f.label}</label>
                    {f.type === "period" ? (
                      <PeriodInput
                        id={f.name}
                        value={form[f.name]}
                        onChange={(v) => set(f.name, v)}
                      />
                    ) : f.type === "ymd" ? (
                      <YmdInput
                        id={f.name}
                        value={form[f.name]}
                        onChange={(v) => set(f.name, v)}
                      />
                    ) : f.type === "select-other" ? (
                      <SelectOther
                        id={f.name}
                        value={form[f.name]}
                        options={f.options}
                        onChange={(v) => set(f.name, v)}
                      />
                    ) : f.type === "textarea" ? (
                      <textarea
                        id={f.name}
                        value={form[f.name]}
                        placeholder={f.placeholder}
                        onChange={(e) => set(f.name, e.target.value)}
                      />
                    ) : f.type === "select" ? (
                      <select
                        id={f.name}
                        value={form[f.name]}
                        onChange={(e) => set(f.name, e.target.value)}
                      >
                        <option value="">선택</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={f.name}
                        type={f.type || "text"}
                        value={form[f.name]}
                        placeholder={f.placeholder}
                        required={f.required}
                        onChange={(e) => set(f.name, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="adder__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOpen(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-accent" disabled={busy}>
                  {busy ? "저장 중…" : "저장"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
