import { useState } from "react";
import { motion } from "framer-motion";
import FieldGrid, { blankForm } from "./FormFields";

export default function RecordItem({
  item,
  fields,
  index = 0,
  isAdmin,
  onUpdate,
  onRemove,
  children,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => blankForm(fields));
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setForm(fields.reduce((acc, f) => ({ ...acc, [f.name]: item[f.name] || "" }), {}));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(blankForm(fields));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdate(item.id, form);
      setEditing(false);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  return (
    <motion.article
      className={`record ${editing ? "record--editing" : ""}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      {isAdmin && !editing && (
        <div className="record__actions">
          <button
            type="button"
            className="record__action record__action--edit"
            onClick={startEdit}
            aria-label="수정"
          >
            ✎
          </button>
          <button
            type="button"
            className="record__action record__action--del"
            onClick={() => onRemove(item.id)}
            aria-label="삭제"
          >
            ✕
          </button>
        </div>
      )}

      {editing ? (
        <form className="record__form" onSubmit={submit}>
          <FieldGrid
            fields={fields}
            form={form}
            onChange={handleChange}
            idPrefix={`edit-${item.id}-`}
          />
          <div className="record__edit-actions">
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              취소
            </button>
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      ) : (
        children
      )}
    </motion.article>
  );
}
