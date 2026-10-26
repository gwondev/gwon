import gsap from "gsap";

/**
 * 하나뿐인 전환 상태 기계.
 * 휠·터치·키보드·클릭은 모두 step()/goTo() 만 호출하고, 카메라와 장면은 live 를 매 프레임 읽는다.
 * React UI 는 snapshot 을 구독해 장면 상태가 바뀔 때만 다시 그린다.
 */
const DURATION = 1.75;
const DURATION_MOBILE = 1.45;
const DURATION_REDUCED = 0.5;
const QUEUE_GAP_MS = 90;

export const live = {
  ids: ["gateway"],
  index: 0,
  from: 0,
  to: 0,
  t: 1,
  active: false,
  dir: 1,
  reduced: false,
  mobile: false,
  focus: -1,
  focusPoint: null,
  pointerX: 0,
  pointerY: 0,
};

let tween = null;
let pending = null;
let queueTimer = 0;
let snapshot = makeSnapshot();
const listeners = new Set();

function makeSnapshot() {
  return {
    ids: live.ids,
    index: live.index,
    from: live.from,
    to: live.to,
    active: live.active,
    arriving: live.active && live.t >= 0.5,
    focus: live.focus,
    reduced: live.reduced,
    mobile: live.mobile,
  };
}

function emit() {
  snapshot = makeSnapshot();
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot() {
  return snapshot;
}

function clamp(i) {
  return Math.max(0, Math.min(live.ids.length - 1, i));
}

export function setEnv({ reduced, mobile }) {
  let changed = false;
  if (reduced !== undefined && reduced !== live.reduced) {
    live.reduced = reduced;
    changed = true;
  }
  if (mobile !== undefined && mobile !== live.mobile) {
    live.mobile = mobile;
    changed = true;
  }
  if (changed) emit();
}

/** 보이는 섹션 목록이 바뀌어도 지금 보고 있는 섹션을 유지한다. */
export function setSections(ids) {
  if (ids.join("|") === live.ids.join("|")) return;
  const current = live.ids[live.active ? live.to : live.index];
  tween?.kill();
  tween = null;
  pending = null;
  live.ids = ids;
  const keep = ids.indexOf(current);
  live.index = keep >= 0 ? keep : clamp(live.index);
  live.from = live.index;
  live.to = live.index;
  live.t = 1;
  live.active = false;
  emit();
}

/** 전환 없이 바로 섹션에 선다(직접 URL 진입 등). */
export function jump(i) {
  tween?.kill();
  tween = null;
  pending = null;
  live.index = clamp(i);
  live.from = live.index;
  live.to = live.index;
  live.t = 1;
  live.active = false;
  live.focus = -1;
  live.focusPoint = null;
  emit();
}

export function setFocus(i) {
  if (live.focus === i) return;
  live.focus = i;
  emit();
}

export function goTo(target) {
  const i = clamp(target);
  if (live.active) {
    pending = i === live.to ? null : i;
    return;
  }
  if (i === live.index) return;

  live.from = live.index;
  live.to = i;
  live.dir = i > live.index ? 1 : -1;
  live.t = 0;
  live.active = true;
  live.focus = -1;
  live.focusPoint = null;
  emit();

  let half = false;
  const duration = live.reduced ? DURATION_REDUCED : live.mobile ? DURATION_MOBILE : DURATION;
  tween = gsap.to(live, {
    t: 1,
    duration,
    ease: "none",
    onUpdate: () => {
      if (!half && live.t >= 0.5) {
        half = true;
        emit();
      }
    },
    onComplete: () => {
      tween = null;
      live.index = live.to;
      live.from = live.to;
      live.t = 1;
      live.active = false;
      emit();
      if (pending != null) {
        const next = pending;
        pending = null;
        window.clearTimeout(queueTimer);
        queueTimer = window.setTimeout(() => goTo(next), QUEUE_GAP_MS);
      }
    },
  });
}

/** 전환 중에 들어온 한 칸은 하나만 예약된다. */
export function step(dir) {
  if (live.active) {
    if (pending == null) goTo(live.to + dir);
    return;
  }
  goTo(live.index + dir);
}

export function dispose() {
  tween?.kill();
  tween = null;
  pending = null;
  window.clearTimeout(queueTimer);
}

/** 장면 i 가 지금 화면에 있는지, 들어오는 중(enter)인지, 나가는 중(leave)인지. */
export function presence(i) {
  if (!live.active) return { visible: live.index === i, enter: 1, leave: 0 };
  if (live.t < 0.5) return { visible: live.from === i, enter: 1, leave: live.t / 0.5 };
  return { visible: live.to === i, enter: (live.t - 0.5) / 0.5, leave: 0 };
}

export function sectionIndex(id) {
  return live.ids.indexOf(id);
}

if (import.meta.env.DEV) {
  window.__uv = { live, goTo, step, jump, gsap };
}
