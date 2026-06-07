import { useState } from "react";
import { Reorder, useDragControls, motion } from "framer-motion";
import FieldGrid, { blankForm } from "./FormFields";
import DetailModal from "./DetailModal";
import { parseMedia } from "../lib/media";

function RecordBody({
  item,
  fields,
  index,
  isAdmin,
  sortable,
  onUpdate,
  onRemove,
  editing,
  setEditing,
  children,
}) {
  const [form, setForm] = useState(() => blankForm(fields));
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const controls = useDragControls();

  const media = parseMedia(item.media);
  const canOpen = media.length > 0 || Boolean(item.description?.trim());

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

  const body = (
    <>
      {isAdmin && !editing && (
        <>
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
        </>
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
      ) : canOpen ? (
        <>
          <div
            className="record__clickable"
            role="button"
            tabIndex={0}
            onClick={() => setDetailOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDetailOpen(true);
              }
            }}
          >
            {children}
            <span className="record__more">
              {media.length > 0 ? `사진 ${media.length}장 · 자세히 보기` : "자세히 보기"}
            </span>
          </div>
          <DetailModal
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            title={item.title}
            media={media}
          >
            {children}
          </DetailModal>
        </>
      ) : (
        children
      )}
    </>
  );

  const className = `record ${editing ? "record--editing" : ""} ${sortable ? "record--sortable" : ""}`;

  if (sortable) {
    return (
      <Reorder.Item
        value={item}
        dragListener={false}
        dragControls={controls}
        className="record-wrap"
        whileDrag={{
          scale: 1.02,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          zIndex: 10,
        }}
      >
        <article className={className}>{body}</article>
      </Reorder.Item>
    );
  }

  return (
    <motion.article
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      {body}
    </motion.article>
  );
}

export default function RecordItem(props) {
  const [editing, setEditing] = useState(false);
  return <RecordBody {...props} editing={editing} setEditing={setEditing} />;
}
