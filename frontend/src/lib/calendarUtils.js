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

export function ownerLabel(o) {
  return o.nickname || o.name || o.email || `#${o.id}`;
}

export function filterTitle(owners) {
  if (!owners?.length) return "일정";
  if (owners.length === 1) return `${ownerLabel(owners[0])}의 일정`;
  return `${owners.map(ownerLabel).join(", ")}의 일정`;
}

export function eventSeriesKey(ev) {
  return ev.seriesId || `single-${ev.id}`;
}

export function isMultiDayEvent(ev) {
  return (Number(ev?.spanDays) || 1) > 1;
}

// 정렬 우선순위: 1) 1일 이상(멀티데이)  2) 종일  3) 시간 있는 일정
function eventSortRank(ev) {
  if (isMultiDayEvent(ev)) return 0;
  if (!ev.startTime) return 1;
  return 2;
}

/**
 * 연속·반복 일정은 시리즈당 하나만 표시.
 * 멀티데이 일정을 항상 맨 위 같은 줄에 두어, 칸을 넘어가는 띠가 끊기지 않고 이어지게 한다.
 */
export function dedupeEventsBySeries(events) {
  const map = new Map();
  for (const ev of events) {
    const key = eventSeriesKey(ev);
    if (!map.has(key)) map.set(key, ev);
  }
  return [...map.values()].sort((a, b) => {
    const ra = eventSortRank(a);
    const rb = eventSortRank(b);
    if (ra !== rb) return ra - rb;

    // 멀티데이끼리는 모든 칸에서 동일한 줄 순서를 유지해야 띠가 정렬된다.
    if (ra === 0) {
      const da = a.seriesStartDate || a.eventDate;
      const db = b.seriesStartDate || b.eventDate;
      if (da !== db) return da.localeCompare(db);
      return eventSeriesKey(a).localeCompare(eventSeriesKey(b));
    }

    // 종일끼리는 시작일·id 순
    if (ra === 1) {
      const da = a.seriesStartDate || a.eventDate;
      const db = b.seriesStartDate || b.eventDate;
      if (da !== db) return da.localeCompare(db);
      return a.id - b.id;
    }

    // 시간 있는 일정끼리는 시작 시간이 빠른 순
    const t = (a.startTime || "").localeCompare(b.startTime || "");
    if (t !== 0) return t;
    return a.id - b.id;
  });
}
