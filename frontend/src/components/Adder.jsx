import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

function blank(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {});
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
                    {f.type === "textarea" ? (
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
