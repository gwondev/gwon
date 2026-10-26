import { useEffect } from "react";
import { goTo, live, step } from "./director.js";

const WHEEL_TRIGGER = 36;
const WHEEL_GESTURE_IDLE_MS = 220;
const SWIPE_MIN = 52;
const SWIPE_MAX_MS = 900;
const IGNORE = ".chat-widget, .chat-widget__scrim, .topbar, .side-drawer, [data-no-nav]";

function canScroll(el, dir) {
  const box = el?.closest?.("[data-ui-scroll]");
  if (!box || box.scrollHeight <= box.clientHeight + 1) return false;
  if (dir > 0) return box.scrollTop + box.clientHeight < box.scrollHeight - 1;
  return box.scrollTop > 0;
}

function isTyping(el) {
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
}

/**
 * 휠 한 제스처 = 한 섹션. 제스처가 끝날 때까지(입력이 잠깐 멈출 때까지) 나머지 휠은 버린다.
 * 트랙패드 관성처럼 길게 이어지는 입력도 한 번으로 친다.
 */
export function useUniverseInput(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const wheel = { acc: 0, last: 0, locked: false };
    const touch = { y: 0, x: 0, at: 0, skip: false };

    const onWheel = (e) => {
      if (e.ctrlKey) return;
      const target = e.target;
      if (target?.closest?.(IGNORE) || target?.closest?.("[data-modal]")) return;
      if (target?.closest?.("[contenteditable='true']")) return;
      const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      if (!px) return;
      const dir = px > 0 ? 1 : -1;
      if (canScroll(target, dir)) return;
      e.preventDefault();

      const now = performance.now();
      if (now - wheel.last > WHEEL_GESTURE_IDLE_MS) {
        wheel.locked = false;
        wheel.acc = 0;
      }
      wheel.last = now;
      if (wheel.locked) return;
      if (Math.sign(wheel.acc) !== dir) wheel.acc = 0;
      wheel.acc += px;
      if (Math.abs(wheel.acc) < WHEEL_TRIGGER && e.deltaMode === 0) return;
      wheel.locked = true;
      wheel.acc = 0;
      step(dir);
    };

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) {
        touch.skip = true;
        return;
      }
      const target = e.target;
      touch.skip = Boolean(target?.closest?.(`${IGNORE}, [data-ui-scroll], [data-modal], input, textarea, [contenteditable='true']`));
      touch.y = t.clientY;
      touch.x = t.clientX;
      touch.at = performance.now();
    };

    const onTouchEnd = (e) => {
      if (touch.skip) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = touch.y - t.clientY;
      const dx = touch.x - t.clientX;
      if (performance.now() - touch.at > SWIPE_MAX_MS) return;
      if (Math.abs(dy) < SWIPE_MIN || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      step(dy > 0 ? 1 : -1);
    };

    const onKey = (e) => {
      if (isTyping(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (document.querySelector("[data-modal]")) return;
      let handled = true;
      if (e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) step(1);
      else if (e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) step(-1);
      else if (e.key === "Home") goTo(0);
      else if (e.key === "End") goTo(live.ids.length - 1);
      else handled = false;
      if (handled) e.preventDefault();
    };

    const onPointer = (e) => {
      if (e.pointerType !== "mouse") return;
      live.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      live.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [enabled]);
}
