import gsap from "gsap";

/**
 * 하나뿐인 전환 상태 기계(목적지 기반).
 * 휠·터치·키보드·클릭은 모두 goTo()/step() 으로 "목적지"만 바꾼다. 애니메이션은 하나뿐이고,
 * 진행값 t(0→1) 하나가 카메라·장면·전환 효과를 모두 움직인다. 한 칸이든 여섯 칸이든 걸리는 시간은 같다.
 *
 *  t < 0.5  지금 세계(from) 안으로 빨려 들어가는 중. 목적지가 바뀌면 to 만 바꾼다(화면은 그대로).
 *  t ≥ 0.5  다음 세계(to) 에서 빠져나오는 중.
 *           장막이 아직 짙을 때(t < SWAP_LATE) 목적지가 바뀌면 장막 뒤에서 세계만 바꿔 끼운다.
 *           그 뒤라면 지금 세계를 출발점으로 삼아 남은 진행을 뒤집어 이어 간다(t → 1 - t).
 *  출발 세계로 되돌아오라는 입력이 들어오면 진행을 거꾸로 돌려 제자리에 내려앉는다.
 *
 * 카메라가 궤적을 갈아탈 때마다 seq 가 올라가고, CameraRig 는 그 순간의 카메라 자세에서
 * 새 궤적으로 부드럽게 합류한다(관성 블렌딩). 따라서 어떤 입력에도 카메라가 순간이동하지 않는다.
 */
const DURATION = 1.25;
const DURATION_MOBILE = 1.1;
const DURATION_REDUCED = 0.45;
const SWAP_LATE = 0.64;

export const live = {
  ids: ["gateway"],
  /** 머물러 있는 섹션(전환 중에는 출발 섹션). */
  index: 0,
  from: 0,
  to: 0,
  /** 입력이 가리키는 최종 목적지. 전환 중이 아니면 index 와 같다. */
  target: 0,
  t: 1,
  /** +1 앞으로 진행, -1 출발 세계로 되감는 중. */
  rate: 1,
  active: false,
  dir: 1,
  /** 카메라가 궤적을 갈아탄 횟수. CameraRig 가 이 값으로 블렌딩을 시작한다. */
  seq: 0,
  reduced: false,
  mobile: false,
  focus: -1,
  focusPoint: null,
  pointerX: 0,
  pointerY: 0,
};

let ticking = false;
let snapshot = makeSnapshot();
const listeners = new Set();

function makeSnapshot() {
  return {
    ids: live.ids,
    index: live.index,
    from: live.from,
    to: live.to,
    target: live.target,
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

function duration() {
  return live.reduced ? DURATION_REDUCED : live.mobile ? DURATION_MOBILE : DURATION;
}

function startTicker() {
  if (ticking) return;
  ticking = true;
  gsap.ticker.add(tick);
}

function stopTicker() {
  if (!ticking) return;
  ticking = false;
  gsap.ticker.remove(tick);
}

function settle(i) {
  stopTicker();
  live.index = i;
  live.from = i;
  live.to = i;
  live.target = i;
  live.t = 1;
  live.rate = 1;
  live.active = false;
  emit();
}

function tick(_time, deltaMs) {
  if (!live.active) {
    stopTicker();
    return;
  }
  const before = live.t;
  live.t += (live.rate * Math.min(deltaMs, 100)) / 1000 / duration();
  if (live.rate > 0 && live.t >= 1) {
    settle(live.to);
    return;
  }
  if (live.rate < 0 && live.t <= 0) {
    settle(live.from);
    return;
  }
  if ((before < 0.5) !== (live.t < 0.5)) emit();
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
  const current = live.ids[live.active ? live.target : live.index];
  live.ids = ids;
  const keep = ids.indexOf(current);
  live.seq += 1;
  settle(keep >= 0 ? keep : clamp(live.index));
}

/** 전환 없이 바로 섹션에 선다(직접 URL 진입 등). */
export function jump(i) {
  live.focus = -1;
  live.focusPoint = null;
  live.seq += 1;
  settle(clamp(i));
}

export function setFocus(i) {
  if (live.focus === i) return;
  live.focus = i;
  emit();
}

/** 목적지를 i 로 바꾼다. 진행 중인 전환은 끊지 않고 그 자리에서 궤적만 바꾼다. */
export function goTo(target) {
  const i = clamp(target);

  if (!live.active) {
    if (i === live.index) return;
    live.from = live.index;
    live.to = i;
    live.target = i;
    live.dir = i > live.index ? 1 : -1;
    live.t = 0;
    live.rate = 1;
    live.active = true;
    live.focus = -1;
    live.focusPoint = null;
    live.seq += 1;
    emit();
    startTicker();
    return;
  }

  if (i === live.target) return;
  live.target = i;

  if (live.t < 0.5) {
    if (i === live.from) {
      live.rate = -1;
    } else {
      live.to = i;
      live.rate = 1;
      live.dir = i > live.from ? 1 : -1;
    }
    emit();
    return;
  }

  if (i === live.to) return;
  if (live.t < SWAP_LATE && i !== live.from) {
    live.to = i;
    live.dir = i > live.from ? 1 : -1;
    live.seq += 1;
    emit();
    return;
  }
  live.from = live.to;
  live.index = live.to;
  live.to = i;
  live.dir = i > live.from ? 1 : -1;
  live.t = Math.min(0.49, 1 - live.t);
  live.rate = 1;
  live.seq += 1;
  emit();
}

/** 지금 향하고 있는 목적지에서 한 칸 더. 연속 입력은 목적지를 계속 밀어낸다. */
export function step(dir) {
  goTo((live.active ? live.target : live.index) + dir);
}

export function dispose() {
  stopTicker();
}

/** 장면 i 가 지금 화면에 있는지, 들어오는 중(enter)인지, 나가는 중(leave)인지. */
export function presence(i) {
  if (!live.active) return { visible: live.index === i, enter: 1, leave: 0 };
  if (live.t < 0.5) return { visible: live.from === i, enter: 1, leave: live.t / 0.5 };
  return { visible: live.to === i, enter: (live.t - 0.5) / 0.5, leave: 0 };
}

/** 관문(블랙홀)으로 빨려 들어가거나 빠져나오는 정도 0..1. 카메라·셰이더·입자가 같은 값을 쓴다. */
export function gatewayPull() {
  if (!live.active || live.reduced) return 0;
  const g = live.ids.indexOf("gateway");
  if (live.t < 0.5 && live.from === g) return Math.pow(live.t / 0.5, 1.6);
  if (live.t >= 0.5 && live.to === g) return Math.pow(1 - (live.t - 0.5) / 0.5, 1.6);
  return 0;
}

export function sectionIndex(id) {
  return live.ids.indexOf(id);
}

if (import.meta.env.DEV) {
  window.__uv = { live, goTo, step, jump, gsap };
}
