export function formatShortDateKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [, m, d] = dateKey.split("-");
  return `${m}.${d}~`;
}

export const REPEAT_PRESETS = [
  { id: "1w", weeks: 1, label: "1주" },
  { id: "2w", weeks: 2, label: "2주" },
  { id: "3w", weeks: 3, label: "3주" },
  { id: "4w", weeks: 4, label: "4주" },
  { id: "5w", weeks: 5, label: "5주" },
  { id: "6w", weeks: 6, label: "6주" },
  { id: "7w", weeks: 7, label: "7주" },
  { id: "2m", weeks: 8, label: "2개월" },
  { id: "3m", weeks: 12, label: "3개월" },
  { id: "6m", weeks: 26, label: "6개월" },
  { id: "1y", weeks: 52, label: "1년" },
  { id: "weekly", weeks: 52, label: "매주" },
];

export function repeatPresetFromWeeks(weeks) {
  const v = Math.max(1, Number(weeks) || 1);
  const matching = REPEAT_PRESETS.filter((p) => p.weeks === v);
  if (matching.length === 1) return matching[0].id;
  if (matching.length > 1) return matching.find((p) => p.id === "1y")?.id || matching[0].id;
  let closest = REPEAT_PRESETS[0];
  for (const preset of REPEAT_PRESETS) {
    if (Math.abs(preset.weeks - v) < Math.abs(closest.weeks - v)) closest = preset;
  }
  return closest.id;
}

export function repeatPresetById(id) {
  return REPEAT_PRESETS.find((p) => p.id === id) || REPEAT_PRESETS[0];
}

export function spanDaysLabel(n) {
  const v = Math.max(1, Number(n) || 1);
  return `${v}일간`;
}

export function repeatWeeksLabel(n, presetId) {
  if (presetId) {
    const preset = repeatPresetById(presetId);
    if (preset) return preset.label;
  }
  const v = Math.max(1, Number(n) || 1);
  const preset = REPEAT_PRESETS.find((p) => p.weeks === v && p.id !== "weekly");
  if (preset) return preset.label;
  if (v <= 7) return `${v}주`;
  return `${v}주`;
}

export function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) {
    if (typeof weekdays === "string" && weekdays.trim()) {
      return normalizeWeekdays(weekdays.split(","));
    }
    return [];
  }
  return [...new Set(weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
    (a, b) => a - b
  );
}

function dateKeyOf(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const MAX_EXPAND_DAYS = 800;

function parseDateKey(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function expandEventDates(eventDate, spanDays, repeatWeeks, weekdays, endDate) {
  const start = parseDateKey(eventDate);
  if (!start) return [];
  const weeks = Math.min(Math.max(Number(repeatWeeks) || 1, 1), 52);
  const end = parseDateKey(endDate);
  const dates = new Set();

  const wd = normalizeWeekdays(weekdays);
  if (wd.length) {
    const wdSet = new Set(wd);
    if (end) {
      if (end < start) return [];
      const dt = new Date(start);
      let guard = 0;
      while (dt <= end && guard < MAX_EXPAND_DAYS) {
        if (wdSet.has(dt.getDay())) dates.add(dateKeyOf(dt));
        dt.setDate(dt.getDate() + 1);
        guard += 1;
      }
      return [...dates].sort();
    }
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay());
    for (let w = 0; w < weeks; w++) {
      for (let day = 0; day < 7; day++) {
        const dt = new Date(weekStart);
        dt.setDate(weekStart.getDate() + w * 7 + day);
        if (!wdSet.has(dt.getDay())) continue;
        if (dt < start) continue;
        dates.add(dateKeyOf(dt));
      }
    }
    return [...dates].sort();
  }

  if (end) {
    if (end < start) return [];
    const dt = new Date(start);
    let guard = 0;
    while (dt <= end && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + 1);
      guard += 1;
    }
    return [...dates].sort();
  }

  const span = Math.min(Math.max(Number(spanDays) || 1, 1), 366);
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < span; day++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + day);
      dates.add(dateKeyOf(dt));
    }
  }
  return [...dates].sort();
}

export const REPEAT_FREQS = [
  { id: "daily", label: "매일", unit: "일" },
  { id: "weekly", label: "매주", unit: "주" },
  { id: "monthly", label: "매월", unit: "개월" },
  { id: "yearly", label: "매년", unit: "년" },
];

export function repeatFreqById(id) {
  return REPEAT_FREQS.find((f) => f.id === id) || REPEAT_FREQS[1];
}

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/**
 * 통합 날짜 생성기.
 * @param {object} spec
 * @param {string} spec.startDate "YYYY-MM-DD" (시작일)
 * @param {string} [spec.endDate] 비반복 연속(종일 여러날/기간) 종료일
 * @param {object|null} [spec.repeat] { freq, interval, weekdays, until }
 * @returns {string[]} 정렬된 날짜키 배열
 */
export function expandOccurrences(spec) {
  const start = parseDateKey(spec?.startDate);
  if (!start) return [];
  const dates = new Set();

  const repeat = spec?.repeat && spec.repeat.freq ? spec.repeat : null;

  // 반복 없음 → (종료일이 있으면) 연속 구간, 아니면 하루
  if (!repeat) {
    const end = parseDateKey(spec?.endDate) || start;
    if (end < start) {
      dates.add(dateKeyOf(start));
      return [...dates];
    }
    const dt = new Date(start);
    let guard = 0;
    while (dt <= end && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + 1);
      guard += 1;
    }
    return [...dates].sort();
  }

  const interval = Math.max(1, Number(repeat.interval) || 1);
  const until = parseDateKey(repeat.until) || start;
  if (until < start) return [dateKeyOf(start)];

  if (repeat.freq === "daily") {
    const dt = new Date(start);
    let guard = 0;
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setDate(dt.getDate() + interval);
      guard += 1;
    }
  } else if (repeat.freq === "weekly") {
    const wd = normalizeWeekdays(repeat.weekdays);
    const wdSet = wd.length ? new Set(wd) : new Set([start.getDay()]);
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay());
    let guard = 0;
    for (let w = 0; guard < MAX_EXPAND_DAYS; w += interval) {
      const base = new Date(weekStart);
      base.setDate(weekStart.getDate() + w * 7);
      if (base > until) break;
      for (let day = 0; day < 7; day++) {
        const dt = new Date(base);
        dt.setDate(base.getDate() + day);
        if (!wdSet.has(dt.getDay())) continue;
        if (dt < start || dt > until) continue;
        dates.add(dateKeyOf(dt));
      }
      guard += 1;
    }
  } else if (repeat.freq === "monthly") {
    let dt = new Date(start);
    let guard = 0;
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt = addMonths(start, (guard + 1) * interval);
      guard += 1;
    }
  } else if (repeat.freq === "yearly") {
    const dt = new Date(start);
    let guard = 0;
    while (dt <= until && guard < MAX_EXPAND_DAYS) {
      dates.add(dateKeyOf(dt));
      dt.setFullYear(dt.getFullYear() + interval);
      guard += 1;
    }
  }
  return [...dates].sort();
}

export function repeatSummary(repeat) {
  if (!repeat || !repeat.freq) return "";
  const interval = Math.max(1, Number(repeat.interval) || 1);
  const freq = repeatFreqById(repeat.freq);
  if (repeat.freq === "weekly") {
    const wl = weekdaysLabel(repeat.weekdays);
    const every = interval > 1 ? `${interval}주마다` : "매주";
    return wl ? `${every} ${wl}` : every;
  }
  if (interval > 1) return `${interval}${freq.unit}마다`;
  return freq.label;
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdaysLabel(weekdays) {
  const wd = normalizeWeekdays(weekdays);
  if (!wd.length) return "";
  const set = new Set(wd);
  const isWeekday = [1, 2, 3, 4, 5].every((n) => set.has(n)) && !set.has(0) && !set.has(6);
  const isWeekend = set.has(0) && set.has(6) && set.size === 2;
  if (isWeekday) return "평일";
  if (isWeekend) return "주말";
  if (wd.length === 7) return "매일";
  return wd.map((n) => WEEKDAY_LABELS[n]).join("·");
}

export function eventSeriesKey(ev) {
  return ev.seriesId || `single-${ev.id}`;
}

export function isMultiDayEvent(ev) {
  return (Number(ev?.spanDays) || 1) > 1;
}

function daySpanInclusive(start, end) {
  if (!start || !end) return 1;
  const a = Date.parse(`${start}T00:00:00`);
  const b = Date.parse(`${end}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.round((b - a) / 86400000) + 1;
}

function shiftDateKeyUtil(dateKey, delta) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return dateKeyOf(dt);
}

/** 반복 없는 연속 기간(하루 초과). spanDays·시리즈 시작/끝 모두 본다. */
export function isContinuousMultiDay(ev) {
  if (!ev || ev.repeat?.freq) return false;
  if ((Number(ev.spanDays) || 1) > 1) return true;
  const start = ev.seriesStartDate || ev.eventDate;
  const end = ev.seriesEndDate || ev.eventDate;
  return Boolean(start && end && start !== end);
}

function normalizeEventTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function allDayLinkGroupKey(ev) {
  // 시간 있는 일정(근장 등)은 절대 묶지 않는다. 종일 + 같은 제목만으로 묶는다.
  // (키워드/색이 날짜마다 달라도 14~16 KNR 같은 케이스가 끊기지 않게)
  if (!ev || ev.startTime || ev.repeat?.freq) return null;
  const title = normalizeEventTitle(ev.title);
  if (!title) return null;
  return title;
}

/**
 * 시리즈 ID 없이 날짜마다 따로 저장된 종일 일정도, 제목·키워드가 같고
 * 날짜가 하루씩 이어지면 하나의 다일 띠로 묶는다. (KNR 14~16 같은 경우)
 */
function linkConsecutiveAllDayEvents(events) {
  const list = Array.isArray(events) ? events.map((ev) => ({ ...ev })) : [];
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const ev of list) {
    const gk = allDayLinkGroupKey(ev);
    if (!gk) continue;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(ev);
  }

  for (const items of groups.values()) {
    items.sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)) || (a.id || 0) - (b.id || 0));
    let run = [];
    const flush = () => {
      if (run.length < 2) {
        run = [];
        return;
      }
      // 날짜가 하루씩 연속인 구간만 묶는다.
      let seg = [run[0]];
      const segs = [];
      for (let i = 1; i < run.length; i++) {
        const prev = seg[seg.length - 1].eventDate;
        const cur = run[i].eventDate;
        if (cur === shiftDateKeyUtil(prev, 1)) seg.push(run[i]);
        else {
          if (seg.length >= 2) segs.push(seg);
          seg = [run[i]];
        }
      }
      if (seg.length >= 2) segs.push(seg);

      for (const s of segs) {
        const start = s[0].eventDate;
        const end = s[s.length - 1].eventDate;
        const span = daySpanInclusive(start, end);
        // 이미 서로 다른 진짜 시리즈면 억지로 합치지 않는다.
        const seriesIds = new Set(s.map((ev) => ev.seriesId).filter(Boolean));
        const realSeries = [...seriesIds].filter((id) => !String(id).startsWith("single-"));
        if (realSeries.length > 1) continue;
        const linkId =
          realSeries[0] ||
          `link-${start}-${end}-${String(s[0].title || "")
            .trim()
            .slice(0, 24)}`;
        for (const ev of s) {
          ev.seriesId = linkId;
          ev.seriesStartDate = start;
          ev.seriesEndDate = end;
          ev.spanDays = Math.max(Number(ev.spanDays) || 1, span);
        }
      }
      run = [];
    };

    for (const ev of items) {
      // 같은 날 중복 제목은 런에 하나만
      if (run.length && run[run.length - 1].eventDate === ev.eventDate) continue;
      run.push(ev);
    }
    flush();
  }
  return list;
}

/**
 * 같은 시리즈가 여러 eventDate 에 있으면 시작/끝·spanDays 를 실제 출현으로 보정한다.
 * 시리즈 ID 가 없는 연속 종일도 먼저 묶어 다일로 만든다.
 */
export function enrichSeriesBounds(events) {
  const list = linkConsecutiveAllDayEvents(events);
  /** @type {Map<string, { start: string, end: string, count: number }>} */
  const bounds = new Map();
  for (const ev of list) {
    if (!ev?.eventDate || ev.repeat?.freq) continue;
    const k = eventSeriesKey(ev);
    const d = ev.eventDate;
    const b = bounds.get(k);
    if (!b) bounds.set(k, { start: d, end: d, count: 1 });
    else {
      if (d < b.start) b.start = d;
      if (d > b.end) b.end = d;
      b.count += 1;
    }
  }
  return list.map((ev) => {
    if (!ev?.eventDate || ev.repeat?.freq) return ev;
    const b = bounds.get(eventSeriesKey(ev));
    if (!b || b.count <= 1 || b.start === b.end) {
      // 메타만으로도 다일이면 span 유지
      if (isContinuousMultiDay(ev)) {
        const start = ev.seriesStartDate || ev.eventDate;
        const end = ev.seriesEndDate || ev.eventDate;
        return {
          ...ev,
          seriesStartDate: start,
          seriesEndDate: end,
          spanDays: Math.max(Number(ev.spanDays) || 1, daySpanInclusive(start, end)),
        };
      }
      return ev;
    }
    const span = daySpanInclusive(b.start, b.end);
    return {
      ...ev,
      seriesStartDate: b.start,
      seriesEndDate: b.end,
      spanDays: Math.max(Number(ev.spanDays) || 1, span),
    };
  });
}

/** 월 전체에서 하루 초과 시리즈 키 집합 */
export function collectMultiDaySeriesKeys(events) {
  const keys = new Set();
  const counts = new Map();
  for (const ev of events || []) {
    if (!ev?.eventDate || ev.repeat?.freq) continue;
    const k = eventSeriesKey(ev);
    if (isContinuousMultiDay(ev)) keys.add(k);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const [k, n] of counts) {
    if (n > 1) keys.add(k);
  }
  return keys;
}

/**
 * 연속 다일 일정의 "그날" 실효 시간.
 * DB에는 시리즈 시작/종료 시각을 그대로 두되, 타임라인·하루 보기에서는
 * 첫날 시작 / 중간 종일 / 마지막날 종료로 해석한다.
 */
export function effectiveEventTimes(ev) {
  if (!ev) return { startTime: null, endTime: null };
  const startTime = ev.startTime || null;
  const endTime = ev.endTime || null;
  if (!isContinuousMultiDay(ev) || !startTime) {
    return { startTime, endTime };
  }
  const seriesStart = ev.seriesStartDate || ev.eventDate;
  const seriesEnd = ev.seriesEndDate || ev.eventDate;
  if (ev.eventDate === seriesStart) {
    return { startTime, endTime: null };
  }
  if (ev.eventDate === seriesEnd) {
    return { startTime: "00:00", endTime };
  }
  return { startTime: null, endTime: null };
}

function isMultiForSort(ev, multiKeys) {
  if (!ev) return false;
  if (isContinuousMultiDay(ev)) return true;
  if (multiKeys && multiKeys.has(eventSeriesKey(ev))) return true;
  return false;
}

// 정렬: 연속 다일(하루 초과) → 시간 있는 하루 → 종일.
function eventSortRank(ev, multiKeys) {
  if (isMultiForSort(ev, multiKeys)) return 0;
  if (ev?.startTime) return 1;
  return 2;
}

function compareDayEvents(a, b, multiKeys) {
  const ra = eventSortRank(a, multiKeys);
  const rb = eventSortRank(b, multiKeys);
  if (ra !== rb) return ra - rb;

  if (isMultiForSort(a, multiKeys) && isMultiForSort(b, multiKeys)) {
    const sa = a.seriesStartDate || a.eventDate || "";
    const sb = b.seriesStartDate || b.eventDate || "";
    if (sa !== sb) return sa.localeCompare(sb);
    const spanA = daySpanInclusive(sa, a.seriesEndDate || a.eventDate || sa);
    const spanB = daySpanInclusive(sb, b.seriesEndDate || b.eventDate || sb);
    if (spanA !== spanB) return spanB - spanA; // 더 긴 기간 우선
    return (a.id || 0) - (b.id || 0);
  }

  if (!a.startTime && !b.startTime) {
    const da = a.seriesStartDate || a.eventDate || "";
    const db = b.seriesStartDate || b.eventDate || "";
    if (da !== db) return da.localeCompare(db);
    return (a.id || 0) - (b.id || 0);
  }

  const t = (a.startTime || "").localeCompare(b.startTime || "");
  if (t !== 0) return t;
  return (a.id || 0) - (b.id || 0);
}

/**
 * 연속·반복 일정은 시리즈당 하나만 표시.
 * 연속 다일 → 시간 일정 → 종일 순.
 */
export function dedupeEventsBySeries(events, multiKeys) {
  const map = new Map();
  for (const ev of events) {
    const key = eventSeriesKey(ev);
    if (!map.has(key)) map.set(key, ev);
  }
  const keys = multiKeys || collectMultiDaySeriesKeys(events);
  return [...map.values()].sort((a, b) => compareDayEvents(a, b, keys));
}

/**
 * 월간 그리드를 주(日~土) 단위로 레인 배치한다.
 * 연속 다일(하루 초과) 시리즈는 주 안에서 같은 lane 을 끝까지 써서
 * 하루짜리가 끼어도 띠가 세로로 갈라지지 않는다.
 *
 * @param {(Date|null)[]} grid
 * @param {Record<string, object[]>} eventsByDate
 * @param {number} maxVisible
 * @returns {Map<string, { lanes: (object|null)[], hiddenCount: number }>}
 */
export function packMonthWeekLanes(grid, eventsByDate, maxVisible = 4) {
  const out = new Map();
  const cells = Array.isArray(grid) ? grid : [];
  const byDate = eventsByDate || {};

  // 월 전체 기준으로 다일 판정 (주 끝에 하루만 걸친 14~15 KNR 도 다일로 유지)
  const allEvents = [];
  for (const list of Object.values(byDate)) {
    for (const ev of list || []) allEvents.push(ev);
  }
  const multiKeys = collectMultiDaySeriesKeys(allEvents);

  for (let w = 0; w < cells.length; w += 7) {
    const week = cells.slice(w, w + 7);
    const dateKeys = week.map((d) => (d ? dateKeyOf(d) : null));
    const dayCount = 7;

    /** @type {Map<string, { key: string, event: object, dayIdxs: number[] }>} */
    const presence = new Map();

    for (let di = 0; di < dayCount; di++) {
      const key = dateKeys[di];
      if (!key) continue;
      const unique = dedupeEventsBySeries(byDate[key] || [], multiKeys);
      for (const ev of unique) {
        const sk = eventSeriesKey(ev);
        let seg = presence.get(sk);
        if (!seg) {
          seg = { key: sk, event: ev, dayIdxs: [] };
          presence.set(sk, seg);
        }
        if (!seg.dayIdxs.includes(di)) seg.dayIdxs.push(di);
        // 대표 이벤트는 주에서 가장 이른 날 것으로
        const prev = seg.event.eventDate || "";
        if ((ev.eventDate || "") < prev) seg.event = ev;
      }
    }

    /** @type {Map<string, { key: string, event: object, dayIdxs: number[] }>} */
    const multi = new Map();
    /** @type {Map<number, object[]>} */
    const singles = new Map();

    for (const seg of presence.values()) {
      const ev = seg.event;
      // 전역 다일 키 · 메타 · 주 내 이틀 이상 → 전부 다일 띠
      const asMulti =
        multiKeys.has(seg.key) ||
        isContinuousMultiDay(ev) ||
        (!ev.repeat?.freq && seg.dayIdxs.length > 1);
      if (asMulti) {
        multi.set(seg.key, seg);
      } else {
        for (const di of seg.dayIdxs) {
          if (!singles.has(di)) singles.set(di, []);
          singles.get(di).push(ev);
        }
      }
    }

    const segments = [...multi.values()].sort((a, b) => {
      // 전체 시리즈 길이 우선 (주 안에 하루만 있어도 긴 다일이 위)
      const spanA = daySpanInclusive(
        a.event.seriesStartDate || a.event.eventDate,
        a.event.seriesEndDate || a.event.eventDate
      );
      const spanB = daySpanInclusive(
        b.event.seriesStartDate || b.event.eventDate,
        b.event.seriesEndDate || b.event.eventDate
      );
      if (spanA !== spanB) return spanB - spanA;
      if (b.dayIdxs.length !== a.dayIdxs.length) return b.dayIdxs.length - a.dayIdxs.length;
      const sa = a.event.seriesStartDate || a.event.eventDate || "";
      const sb = b.event.seriesStartDate || b.event.eventDate || "";
      if (sa !== sb) return sa.localeCompare(sb);
      return (a.event.id || 0) - (b.event.id || 0);
    });

    /** @type {boolean[][]} */
    const occupied = [];
    /** @type {Map<string, number>} seriesKey|`d${di}:${sk}` → lane */
    const laneOf = new Map();

    const ensureLane = (lane) => {
      while (occupied.length <= lane) occupied.push(Array(dayCount).fill(false));
    };

    const canPlace = (lane, dayIdxs) => dayIdxs.every((di) => !occupied[lane][di]);

    const place = (lane, dayIdxs, token) => {
      ensureLane(lane);
      for (const di of dayIdxs) occupied[lane][di] = true;
      laneOf.set(token, lane);
    };

    const firstFree = (dayIdxs) => {
      for (let lane = 0; ; lane++) {
        ensureLane(lane);
        if (canPlace(lane, dayIdxs)) return lane;
      }
    };

    for (const seg of segments) {
      const lane = firstFree(seg.dayIdxs);
      place(lane, seg.dayIdxs, seg.key);
    }

    for (let di = 0; di < dayCount; di++) {
      const list = (singles.get(di) || []).slice().sort((a, b) => compareDayEvents(a, b, multiKeys));
      for (const ev of list) {
        const token = `d${di}:${eventSeriesKey(ev)}`;
        const lane = firstFree([di]);
        place(lane, [di], token);
        // 하루 칸 렌더용으로 시리즈키도 같은 날 lane 에 묶어둠
        laneOf.set(`${dateKeys[di]}::${eventSeriesKey(ev)}`, lane);
      }
      for (const seg of segments) {
        if (seg.dayIdxs.includes(di)) {
          laneOf.set(`${dateKeys[di]}::${seg.key}`, laneOf.get(seg.key));
        }
      }
    }

    for (let di = 0; di < dayCount; di++) {
      const dateKey = dateKeys[di];
      if (!dateKey) continue;

      const lanes = Array.from({ length: maxVisible }, () => null);
      let hiddenCount = 0;
      const unique = dedupeEventsBySeries(byDate[dateKey] || [], multiKeys);

      for (const ev of unique) {
        const sk = eventSeriesKey(ev);
        const lane = laneOf.get(`${dateKey}::${sk}`);
        if (lane == null) continue;
        if (lane < maxVisible) {
          lanes[lane] = ev;
        } else {
          hiddenCount += 1;
        }
      }

      out.set(dateKey, { lanes, hiddenCount });
    }
  }

  return out;
}
