import { useEffect, useRef, useState } from "react";
import { fileToCompressedDataUrl } from "../../../lib/image.js";
import { fileToVideoDataUrl } from "../../../lib/video.js";
import Field from "./Field.jsx";

/**
 * 프로젝트 사진·영상 페이지. 한 페이지에 좌우 두 칸, 좌우로 넘긴다.
 * 관리자는 칸마다 사진·영상을 넣고 설명을 고칠 수 있다.
 */
export default function MediaPages({ pages, title, canEdit, onPatchCell, onAdd }) {
  const [index, setIndex] = useState(0);
  const view = useRef(null);
  const start = useRef({ x: 0, y: 0, axis: null, dx: 0 });
  const [off, setOff] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [title]);

  const count = pages.length;
  const hasMedia = pages.some((pg) => pg.left?.src || pg.right?.src);
  if (!hasMedia && !canEdit) return null;

  const down = (e) => {
    if (e.target?.closest?.("[contenteditable='true'], label, input, button")) return;
    start.current = { x: e.clientX, y: e.clientY, axis: null, dx: 0 };
    setDragging(true);
    const move = (ev) => {
      const s = start.current;
      const x = ev.clientX - s.x;
      const y = ev.clientY - s.y;
      if (!s.axis) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        s.axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
      }
      if (s.axis !== "x") return;
      s.dx = x;
      setOff(x / (view.current?.clientWidth || 1));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const s = start.current;
      if (s.axis === "x") {
        const w = view.current?.clientWidth || 1;
        if (s.dx / w < -0.12) setIndex((i) => Math.min(count - 1, i + 1));
        else if (s.dx / w > 0.12) setIndex((i) => Math.max(0, i - 1));
      }
      setOff(0);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const shift = -index * 100 + off * 100;

  return (
    <div className="uv-media" data-no-swipe>
      <div className={`uv-media__viewport${dragging ? " is-drag" : ""}`} ref={view} onPointerDown={down}>
        <div className="uv-media__track" style={{ transform: `translate3d(${shift}%, 0, 0)` }}>
          {pages.map((pg, i) => (
            <div className="uv-media__page" key={pg.i ?? i}>
              {["left", "right"].map((side) => (
                <MediaCell
                  key={side}
                  cell={pg[side]}
                  active={i === index}
                  alt={`${title} ${pg.name || i + 1}`}
                  canEdit={canEdit}
                  onPick={async (file) => {
                    if (!file) return;
                    try {
                      const isVideo = file.type.startsWith("video/");
                      const src = isVideo ? await fileToVideoDataUrl(file) : await fileToCompressedDataUrl(file);
                      onPatchCell(i, side, { kind: isVideo ? "video" : "image", src });
                    } catch (err) {
                      window.alert(err.message || "미디어를 넣지 못했습니다.");
                    }
                  }}
                  onCaption={(caption) => onPatchCell(i, side, { caption })}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {(count > 1 || canEdit) && (
        <div className="uv-media__tabs">
          {pages.map((pg, i) => (
            <button key={pg.i ?? i} type="button" className={i === index ? "is-on" : ""} onClick={() => setIndex(i)}>
              {pg.name || String(i + 1).padStart(2, "0")}
            </button>
          ))}
          {canEdit && (
            <button
              type="button"
              className="uv-media__add"
              onClick={() => {
                onAdd();
                setIndex(count);
              }}
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MediaCell({ cell, active, alt, canEdit, onPick, onCaption }) {
  const [play, setPlay] = useState(false);
  const [broken, setBroken] = useState(false);
  const isVideo = cell?.kind === "video" && cell?.src;
  const isImage = cell?.kind === "image" && cell?.src && !broken;

  useEffect(() => setBroken(false), [cell?.src]);

  useEffect(() => {
    if (!isVideo || !active) {
      setPlay(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setPlay(true), 380);
    return () => window.clearTimeout(timer);
  }, [isVideo, active]);

  if (!isVideo && !isImage && !canEdit) return null;

  return (
    <figure className="uv-media__cell">
      <div className="uv-media__frame">
        {isVideo && play && <video src={cell.src} autoPlay muted loop playsInline />}
        {isImage && <img src={cell.src} alt={alt} loading="lazy" onError={() => setBroken(true)} />}
        {((!isVideo && !isImage) || (isVideo && !play)) && <div className="uv-media__void" />}
        {canEdit && (
          <label className="uv-media__upload">
            {cell?.src ? "사진·영상 바꾸기" : "사진·영상 넣기"}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(e) => {
                onPick?.(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <Field tag="figcaption" className="uv-media__caption" value={cell?.caption} canEdit={canEdit} placeholder="사진·영상 설명" onSave={onCaption} />
    </figure>
  );
}
