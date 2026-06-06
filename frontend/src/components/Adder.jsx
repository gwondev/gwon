import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import FieldGrid, { blankForm } from "./FormFields";

export default function Adder({ label, fields, onCreate }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => blankForm(fields));
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const handleChange = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate(form);
      setForm(blankForm(fields));
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
              <FieldGrid fields={fields} form={form} onChange={handleChange} />
              <div className="adder__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
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
