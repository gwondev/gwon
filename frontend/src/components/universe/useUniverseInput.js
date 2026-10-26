import { useEffect } from "react";
import { goTo, live, step } from "./director.js";

const GESTURE_GAP_MS = 80;
const NOTCH_MIN = 18;
const PAD_STREAM_MS = 12;
const PAD_TRIGGER = 6;
const PAD_REPEAT_MS = 90;
const ISOLATED_TICK_MS = 40;
const SWIPE_MIN = 46;
const SWIPE_MAX_MS = 900;
const IGNORE = ".chat-widget, .chat-widget__scrim, .topbar, .side-drawer, .uv-rail, [data-no-nav]";

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
 * 휠 이벤트를 "몇 칸 이동"으로 읽는다. 장치마다 이벤트 수·크기가 달라서 제스처마다 성격을 판별한다.
 *  - notch: 마우스 휠처럼 띄엄띄엄 오는 큰 값(또는 줄/페이지 단위). 한 칸 = 한 이동.
 *  - pad:   트랙패드·고해상도 휠처럼 촘촘한 작은 값의 흐름. 누적이 문턱을 넘으면 한 번 이동하고,
 *           관성 꼬리는 무시하되 손가락으로 다시 밀어 값이 확 커지면 새 이동으로 본다.
 * 한 이벤트는 아무리 커도 최대 한 칸이다. 칸 수는 목적지에 더해질 뿐 애니메이션을 늘리지 않는다.
 */
export function createWheelReader(onStep) {
  const s = { last: -1e9, dir: 0, kind: "", acc: 0, stepped: false, lastStep: -1e9, hist: [], timer: 0 };
  return (px, mode, now) => {
    const abs = Math.abs(px);
    const dir = px > 0 ? 1 : -1;
    const gap = now - s.last;
    let fresh = gap > GESTURE_GAP_MS || dir !== s.dir;
    if (!fresh && s.kind === "pad" && s.stepped && now - s.lastStep > PAD_REPEAT_MS && s.hist.length >= 3) {
      const prev = s.hist.slice(-4);
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      if (abs > Math.max(10, avg * 1.8)) fresh = true;
    }
    if (fresh) {
      s.acc = 0;
      s.stepped = false;
      s.hist.length = 0;
      s.kind = mode !== 0 || abs >= NOTCH_MIN ? "notch" : "pad";
    } else if (s.kind === "notch" && mode === 0 && (abs < NOTCH_MIN || gap < PAD_STREAM_MS)) {
      s.kind = "pad";
      s.stepped = true;
    }
    s.last = now;
    s.dir = dir;
    s.hist.push(abs);
    if (s.hist.length > 8) s.hist.shift();

    if (s.kind === "notch") {
      s.stepped = true;
      s.lastStep = now;
      onStep(dir);
      return;
    }
    if (s.stepped) return;
    s.acc += abs;
    if (s.acc >= PAD_TRIGGER) {
      s.stepped = true;
      s.lastStep = now;
      window.clearTimeout(s.timer);
      onStep(dir);
      return;
    }
    if (fresh) {
      // 맥 마우스처럼 작은 값이 띄엄띄엄 오는 휠: 뒤따르는 흐름이 없으면 한 틱도 한 칸이다.
      const gesture = now;
      window.clearTimeout(s.timer);
      s.timer = window.setTimeout(() => {
        if (s.stepped || s.hist.length > 2 || s.last - gesture > ISOLATED_TICK_MS) return;
        s.stepped = true;
        s.lastStep = gesture;
        onStep(s.dir);
      }, ISOLATED_TICK_MS);
    }
  };
}

export function useUniverseInput(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const readWheel = createWheelReader(step);
    const touch = { y: 0, x: 0, at: 0, skip: false };

    const onWheel = (e) => {
      if (e.ctrlKey) return;
      const target = e.target;
      if (target?.closest?.(IGNORE) || target?.closest?.("[data-modal]")) return;
      if (target?.closest?.("[contenteditable='true']")) return;
      const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!px) return;
      if (canScroll(target, px > 0 ? 1 : -1)) return;
      e.preventDefault();
      readWheel(px, e.deltaMode, e.timeStamp || performance.now());
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
