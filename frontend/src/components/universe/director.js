import gsap from "gsap";

/**
 * t(0→1) 하나가 카메라·장막·레일을 움직인다. t < 0.5 안으로, t ≥ 0.5 다음 세계에서 빠져나온다.
 * 움직이는 중에 입력이 오면 지금 레일 위치에서 새 목적지로 궤적만 갈아탄다. 순간이동하지 않는다.
 */
const DURATION = 0.52;
const DURATION_MOBILE = 0.46;
const DURATION_REDUCED = 0.26;

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
  pointerOn: false,
  holeX: 0.45,
  holeY: 0,
  /** 화면 NDC(종횡비 보정)로 본 블랙홀 그림자 반경. BlackHole 이 매 프레임 갱신. */
  horizonR: 0.22,
  well: 0,
  /** 경력 및 프로필 섹션에서 펼친 갈래: 0 프로필, 1 경력, 2 기술. 두뇌 장면이 읽는다. */
  brainMode: 0,
};

/**
 * 커서 ↔ 사건의 지평선(검은 원 가장자리) 픽셀 거리로 빛을 정한다.
 * 검은 원에 들어서는 순간 어두워지고(빛 0), 바깥에서는 거리에 따라 세기와 번지는 범위가 매끄럽게 커진다.
 * 세기 = 1 - e^(-거리/GLOW_PX): 1px 3% · 5px 15% · 10px 28% · 20px 49% · 40px 74% · 80px 93%.
 */
const GLOW_PX = 30;
const HALO_MIN_PX = 6;
const HALO_MAX_PX = 96;
const HALO_PX = 46;

export function cursorFromHorizon(width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const aspect = w / h;
  const distNdc = Math.hypot((live.pointerX - live.holeX) * aspect, live.pointerY - live.holeY);
  const horizonNdc = live.horizonR > 1e-4 ? live.horizonR : 0.22;
  const toPx = h * 0.5;
  const distPx = distNdc * toPx;
  const horizonPx = horizonNdc * toPx;
  if (!live.pointerOn || distPx <= horizonPx) {
    return { inside: true, outPx: 0, glow: 0, halo: 0, core: 0.08, dot: 0.7 };
  }
  const outPx = distPx - horizonPx;
  const glow = 1 - Math.exp(-outPx / GLOW_PX);
  return {
    inside: false,
    outPx,
    glow,
    halo: HALO_MIN_PX + (HALO_MAX_PX - HALO_MIN_PX) * (1 - Math.exp(-outPx / HALO_PX)),
    core: 0.35 + 0.65 * glow,
    dot: 1,
  };
}

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
  const base = live.reduced ? DURATION_REDUCED : live.mobile ? DURATION_MOBILE : DURATION;
  const span = Math.abs(live.to - live.from);
  if (span <= 1) return base;
  return Math.max(0.24, base * 0.58);
}

function travelPos() {
  if (!live.active) return live.index;
  return live.from + (live.to - live.from) * live.t;
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
  if (live.rate === 0) return;
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

function retarget(i) {
  const p = travelPos();
  live.target = i;
  live.focus = -1;
  live.focusPoint = null;
  if (Math.abs(p - i) < 0.02) {
    settle(i);
    return;
  }
  live.from = i > p ? Math.floor(p) : Math.ceil(p);
  live.from = clamp(live.from);
  if (live.from === i) {
    settle(i);
    return;
  }
  live.to = i;
  live.dir = i > p ? 1 : -1;
  live.rate = 1;
  live.t = (p - live.from) / (live.to - live.from);
  live.t = Math.min(0.999, Math.max(0, live.t));
  live.active = true;
  live.seq += 1;
  emit();
  startTicker();
}

/** 멈춰 있으면 짧은 전환을 시작한다. 이미 움직이는 중이면 지금 위치에서 그 화면으로 궤적을 잇는다. */
export function goTo(target) {
  const i = clamp(target);
  if (live.active) {
    if (i === live.target) return;
    retarget(i);
    return;
  }
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
}

/** 지금 향하고 있는 목적지에서 한 칸 더. */
export function step(dir) {
  goTo((live.active ? live.target : live.index) + dir);
}

/** 레일을 손가락·마우스로 잡고 있는 동안 위치를 바로 맞춘다. */
export function scrubTo(p) {
  const max = Math.max(0, live.ids.length - 1);
  const x = Math.max(0, Math.min(max, p));
  const a = Math.min(Math.floor(x), max);
  const b = Math.min(a + 1, max);
  const frac = a === b ? 1 : x - a;
  const onStop = frac < 0.02 || frac > 0.98;
  const nextFrom = onStop ? Math.round(x) : a;
  const nextTo = onStop ? nextFrom : b;
  const crossed = live.from !== nextFrom || live.to !== nextTo;
  live.focus = -1;
  live.focusPoint = null;
  live.dir = x >= travelPos() ? 1 : -1;
  if (onStop) {
    if (live.index !== nextFrom || live.active) live.seq += 1;
    settle(nextFrom);
    return;
  }
  stopTicker();
  live.from = nextFrom;
  live.to = nextTo;
  live.index = nextFrom;
  live.target = frac >= 0.5 ? nextTo : nextFrom;
  live.t = frac;
  live.rate = 0;
  live.active = true;
  if (crossed) live.seq += 1;
  emit();
}

/** 레일에서 손을 떼면 가까운 칸으로 붙인다. */
export function releaseScrub() {
  live.rate = 1;
  const p = travelPos();
  const i = clamp(Math.round(p));
  if (Math.abs(p - i) < 0.03) {
    settle(i);
    return;
  }
  goTo(i);
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
  window.__uv = { live, goTo, step, jump, scrubTo, releaseScrub, gsap };
}
