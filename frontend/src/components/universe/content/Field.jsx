import { memo, useEffect, useLayoutEffect, useRef } from "react";

/** 관리자에게만 그 자리에서 고칠 수 있는 글자. 방문자에게는 평범한 태그다. */
const Field = memo(
  function Field({ tag: Tag = "p", className, value, canEdit, onSave, placeholder, multiline = false }) {
    const ref = useRef(null);
    const saveRef = useRef(onSave);
    useEffect(() => {
      saveRef.current = onSave;
    });

    useLayoutEffect(() => {
      if (ref.current && document.activeElement !== ref.current) {
        const next = value || "";
        if (ref.current.textContent !== next) ref.current.textContent = next;
      }
    }, [value]);

    if (!canEdit) {
      if (!value) return null;
      return <Tag className={className}>{value}</Tag>;
    }

    return (
      <Tag
        ref={ref}
        className={`${className || ""} is-edit`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={placeholder || "입력"}
        onBlur={() => {
          const raw = ref.current?.textContent || "";
          const next = multiline ? raw.trim() : raw.replace(/\s+/g, " ").trim();
          if (next !== (value || "")) saveRef.current(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(multiline && e.shiftKey)) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    );
  },
  (a, b) =>
    a.value === b.value &&
    a.canEdit === b.canEdit &&
    a.className === b.className &&
    a.tag === b.tag &&
    a.placeholder === b.placeholder &&
    a.multiline === b.multiline
);

export default Field;
