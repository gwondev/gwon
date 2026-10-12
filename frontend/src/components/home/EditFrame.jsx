import { useRef } from "react";
import { clampBox, UNIT_DEFAULTS } from "../../lib/homeLayout.js";
import { worldState } from "./worldState.js";
import "./EditFrame.css";

const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function EditFrame({
  id,
  box,
  edit,
  label,
  onBox,
  className = "",
  style,
  children,
  allowFocus,
}) {
  const drag = useRef(null);

  const start = (kind, e) => {
    if (!edit || !onBox) return;
    e.preventDefault();
    e.stopPropagation();
    worldState.editDrag = true;
    drag.current = {
      kind,
      x: e.clientX,
      y: e.clientY,
      box: { ...box },
    };
    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      const dx = ((ev.clientX - d.x) / window.innerWidth) * 100;
      const dy = ((ev.clientY - d.y) / window.innerHeight) * 100;
      const next = { ...d.box };
      if (d.kind === "move") {
        next.x += dx;
        next.y += dy;
      } else {
        if (d.kind.includes("e")) next.w += dx;
        if (d.kind.includes("s")) next.h += dy;
        if (d.kind.includes("w")) {
          next.x += dx;
          next.w -= dx;
        }
        if (d.kind.includes("n")) {
          next.y += dy;
          next.h -= dy;
        }
      }
      onBox(clampBox(next, UNIT_DEFAULTS[id] || d.box));
    };
    const up = () => {
      drag.current = null;
      worldState.editDrag = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`edit-frame ${edit ? "is-edit" : ""} ${className}`}
      style={{ ...boxStyleSafe(box), ...style }}
      onPointerDown={edit ? (e) => start("move", e) : undefined}
    >
      {edit && <span className="edit-frame__tag">{label || id}</span>}
      <div className={`edit-frame__body ${allowFocus ? "is-live" : ""}`}>{children}</div>
      {edit &&
        HANDLES.map((h) => (
          <i key={h} className={`edit-frame__h is-${h}`} onPointerDown={(e) => start(h, e)} />
        ))}
    </div>
  );
}

function boxStyleSafe(box) {
  if (!box) return undefined;
  return {
    left: `${box.x}vw`,
    top: `${box.y}vh`,
    width: `${box.w}vw`,
    height: `${box.h}vh`,
  };
}
