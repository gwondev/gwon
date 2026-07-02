import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  dedupeEventsBySeries,
  eventSeriesKey,
  expandOccurrences,
  filterTitle,
  ownerLabel,
  normalizeWeekdays,
  WEEKDAY_LABELS,
  REPEAT_FREQS,
  repeatFreqById,
  repeatSummary,
} from "../lib/calendarUtils";
import {
  CALENDAR_THEME_COLORS,
  formatEventTime,
  getThemeById,
} from "../lib/calendarTheme";
import "./ScheduleTab.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const MOCK_OWNERS = [
  { id: 0, name: "이성권", nickname: "이성권", role: "SUPER_ADMIN", calendarThemeColor: "red" },
  { id: 1, name: "이건영", nickname: "이건영", role: "ADMIN", calendarThemeColor: "orange" },
];

const MOCK_EVENTS = [
  {
    id: 1,
    ownerId: 0,
    sharedOwnerIds: [0],
    sharedOwnerNames: ["이성권"],
    ownerThemeColor: "red",
    title: "포트폴리오 점검",
    description: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "14:00",
    endTime: null,
    incomeType: null,
    appointmentType: null,
  },
  {
    id: 2,
    ownerId: 1,
    sharedOwnerIds: [1],
    sharedOwnerNames: ["이건영"],
    ownerThemeColor: "orange",
    title: "팀 미팅",
    description: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: null,
    incomeType: "WORK",
    appointmentType: "MONEY",
  },
];

const FILTER_STORAGE_KEY = "gwon.calendar.filter";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftDateKey(dateKey, delta) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toDateKey(dt);
}

function timeToMinute(v) {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

function formatDateDot(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [, m, d] = dateKey.split("-");
  return `${m}.${d}`;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month - 1, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function blankForm(dateKey = "", ownerId = null) {
  const start = dateKey || "";
  return {
    ownerIds: ownerId != null ? [ownerId] : [],
    title: "",
    description: "",
    eventDate: start,
    allDay: false,
    startTime: "09:00",
    endTime: "18:00",
    endDate: start,
    appointmentType: "",
    locationName: "",
    locationLat: null,
    locationLng: null,
    repeatOn: false,
    repeatFreq: "weekly",
    repeatInterval: 1,
    weekdays: [],
    repeatUntil: start,
  };
}

function formFromEvent(ev) {
  const start = ev.seriesStartDate || ev.eventDate;
  const repeat = ev.repeat && ev.repeat.freq ? ev.repeat : null;
  const allDay = !ev.startTime;
  return {
    ownerIds: ev.sharedOwnerIds?.length ? [...ev.sharedOwnerIds] : [ev.ownerId],
    title: ev.title || "",
    description: ev.description || "",
    eventDate: start,
    allDay,
    startTime: ev.startTime || "09:00",
    endTime: ev.endTime || "18:00",
    endDate: repeat ? start : (ev.seriesEndDate || ev.eventDate || start),
    appointmentType: ev.appointmentType || (ev.incomeType ? "MONEY" : ""),
    locationName: ev.locationName || "",
    locationLat: ev.locationLat ?? null,
    locationLng: ev.locationLng ?? null,
    repeatOn: !!repeat,
    repeatFreq: repeat?.freq || "weekly",
    repeatInterval: repeat?.interval || 1,
    weekdays: normalizeWeekdays(repeat?.weekdays),
    repeatUntil: repeat?.until || ev.seriesEndDate || start,
  };
}

function enrichEvent(ev, owners) {
  const owner = owners.find((o) => o.id === ev.ownerId);
  const sharedOwnerIds = ev.sharedOwnerIds?.length ? ev.sharedOwnerIds : [ev.ownerId];
  const sharedOwnerNames = ev.sharedOwnerNames?.length
    ? ev.sharedOwnerNames
    : sharedOwnerIds
      .map((id) => owners.find((o) => o.id === id))
      .filter(Boolean)
      .map((o) => ownerLabel(o));
  return {
    ...ev,
    sharedOwnerIds,
    sharedOwnerNames,
    ownerThemeColor: owner?.calendarThemeColor || ev.ownerThemeColor || "red",
    ownerName: ev.ownerName || (owner ? ownerLabel(owner) : null),
  };
}

export default function ScheduleTab() {
  const { user, token, localMode, isSuperAdmin, isCalendarAdmin } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [owners, setOwners] = useState([]);
  const [selfId, setSelfId] = useState(user?.id);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState([]);
  const [events, setEvents] = useState([]);
  const [themeColor, setThemeColor] = useState(user?.calendarThemeColor || null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [dayOpen, setDayOpen] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [monthDir, setMonthDir] = useState(0);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSeriesKeys, setSelectedSeriesKeys] = useState(() => new Set());
  const touchStartRef = useRef(null);

  const theme = getThemeById(themeColor || "red");
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const themeOwners = useMemo(() => {
    const sid = selfId ?? user?.id;
    if (isSuperAdmin) return owners;
    return owners.filter((o) => o.id === sid);
  }, [owners, selfId, user?.id, isSuperAdmin]);

  const displayEvents = useMemo(
    () => events.map((e) => enrichEvent(e, owners)),
    [events, owners]
  );

  const selectedOwners = useMemo(
    () => owners.filter((o) => selectedOwnerIds.includes(o.id)),
    [owners, selectedOwnerIds]
  );

  const headerTitle = useMemo(() => filterTitle(selectedOwners), [selectedOwners]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of displayEvents) {
      if (!map[ev.eventDate]) map[ev.eventDate] = [];
      map[ev.eventDate].push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a.startTime && !b.startTime) return -1;
        if (!a.startTime && b.startTime) return 1;
        if (!a.startTime && !b.startTime) return a.id - b.id;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return map;
  }, [displayEvents]);

  const seriesDateSet = useMemo(() => {
    const set = new Set();
    for (const ev of displayEvents) {
      // 반복 일정은 칸마다 개별 표시(띠로 잇지 않음). 비반복 연속 구간만 띠로 연결
      if (ev.repeat?.freq) continue;
      set.add(`${eventSeriesKey(ev)}::${ev.eventDate}`);
    }
    return set;
  }, [displayEvents]);

  const loadOwners = useCallback(async () => {
    if (localMode) {
      setOwners(MOCK_OWNERS);
      setSelfId(user.id);
      return MOCK_OWNERS;
    }
    const data = await api("/calendar/owners", { token });
    setOwners(data.items || []);
    setSelfId(data.selfId);
    return data.items || [];
  }, [token, localMode, user.id]);

  const loadFilter = useCallback(
    async (ownerList, defaultSelfId) => {
      if (localMode) {
        try {
          const raw = localStorage.getItem(FILTER_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
              return parsed.filter((id) => ownerList.some((o) => o.id === id));
            }
          }
        } catch {
          /* ignore */
        }
        return ownerList.map((o) => o.id);
      }

      const data = await api("/calendar/filter", { token });
      if (data.ownerIds?.length) {
        return data.ownerIds.filter((id) => ownerList.some((o) => o.id === id));
      }
      return [defaultSelfId];
    },
    [token, localMode]
  );

  const saveFilter = useCallback(
    async (ids) => {
      if (localMode) {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(ids));
        return;
      }
      await api("/calendar/filter", {
        method: "PUT",
        token,
        body: { ownerIds: ids },
      });
    },
    [token, localMode]
  );

  const loadEvents = useCallback(async () => {
    if (!selectedOwnerIds.length) {
      setEvents([]);
      return;
    }
    if (localMode) {
      setEvents(
        MOCK_EVENTS.filter((e) => selectedOwnerIds.includes(e.ownerId)).map((e) =>
          enrichEvent(e, MOCK_OWNERS)
        )
      );
      return;
    }
    const data = await api(
      `/calendar/events?ownerIds=${selectedOwnerIds.join(",")}&year=${viewYear}&month=${viewMonth}`,
      { token }
    );
    const items = data.items || [];
    // 진단 로그: 캘린더가 비어 보일 때 원인 파악용 (브라우저 콘솔에서 확인)
    console.log(
      `[calendar] loadEvents ${viewYear}-${viewMonth} ` +
        `selected=[${selectedOwnerIds.join(",")}] resolved=[${(data.ownerIds || []).join(",")}] ` +
        `received=${items.length} dates=[${items.map((e) => e.eventDate).join(",")}]`
    );
    setEvents(items.map((e) => enrichEvent(e, owners)));
  }, [token, localMode, selectedOwnerIds, viewYear, viewMonth, owners]);

  useEffect(() => {
    if (!owners.length) return;
    const sid = selfId ?? user.id;
    const self = owners.find((o) => o.id === sid);
    if (self) {
      setThemeColor(self.calendarThemeColor || null);
      if (!self.calendarThemeColor && isCalendarAdmin) setThemeOpen(true);
    }
  }, [owners, selfId, user.id, isCalendarAdmin]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const ownerList = await loadOwners();
        // 저장된 필터가 없으면 "달력을 보는 본인" 일정을 기본으로 보여준다.
        const ids = await loadFilter(ownerList, user.id);
        if (alive) setSelectedOwnerIds(ids.length ? ids : [user.id]);
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadOwners, loadFilter, user.id]);

  useEffect(() => {
    if (!selectedOwnerIds.length) return;
    let alive = true;
    (async () => {
      setErr(null);
      try {
        await loadEvents();
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedOwnerIds, viewYear, viewMonth, loadEvents]);

  const shiftMonth = (delta) => {
    setMonthDir(delta > 0 ? 1 : -1);
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const toggleOwnerFilter = async (ownerId) => {
    let next;
    if (selectedOwnerIds.includes(ownerId)) {
      if (selectedOwnerIds.length <= 1) return;
      next = selectedOwnerIds.filter((id) => id !== ownerId);
    } else {
      next = [...selectedOwnerIds, ownerId].sort((a, b) => a - b);
    }
    setSelectedOwnerIds(next);
    try {
      await saveFilter(next);
    } catch (e) {
      setErr(e.message);
    }
  };

  const saveTheme = async (ownerId, colorId) => {
    const sid = selfId ?? user.id;
    setOwners((prev) =>
      prev.map((o) => (o.id === ownerId ? { ...o, calendarThemeColor: colorId } : o))
    );
    if (ownerId === sid) setThemeColor(colorId);
    if (localMode) return;
    try {
      await api("/calendar/theme", {
        method: "PUT",
        token,
        body: { themeColor: colorId, ownerId },
      });
    } catch (e) {
      setErr(e.message);
    }
  };

  const openAdd = (dateKey) => {
    const defaultOwner = selfId ?? user.id;
    setEditId(null);
    setForm(blankForm(dateKey || toDateKey(today), defaultOwner));
    setAddOpen(true);
  };

  const openEdit = (ev) => {
    setDayOpen(null);
    setEditId(ev.id);
    setForm(formFromEvent(ev));
    setAddOpen(true);
  };

  const closeModal = () => {
    setAddOpen(false);
    setEditId(null);
    setForm(blankForm());
  };

  const submitEvent = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setErr("일정명을 입력해주세요.");
    setBusy(true);
    setErr(null);

    const allDay = form.allDay;
    const startTime = allDay ? null : (form.startTime || null);
    const endTime = allDay ? null : (form.endTime || null);
    const repeat = form.repeatOn
      ? {
          freq: form.repeatFreq,
          interval: Math.max(1, Number(form.repeatInterval) || 1),
          weekdays: form.repeatFreq === "weekly" ? normalizeWeekdays(form.weekdays) : [],
          until: form.repeatUntil || null,
        }
      : null;
    const endDate = repeat ? null : (form.endDate || null);
    const sameDay = !form.endDate || form.endDate === form.eventDate;

    try {
      if (!allDay && !repeat && sameDay && startTime && endTime && timeToMinute(endTime) <= timeToMinute(startTime)) {
        setErr("종료 시간은 시작 시간보다 뒤로 설정해주세요.");
        setBusy(false);
        return;
      }
      if (editId != null) {
        const payload = {
          title,
          description: form.description.trim(),
          eventDate: form.eventDate,
          startTime,
          endTime,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          ownerIds: form.ownerIds,
          endDate,
          repeat,
        };
        if (localMode) {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === editId
                ? { ...ev, ...payload, startTime, endTime, weekdays: repeat?.weekdays || [] }
                : ev
            )
          );
        } else {
          await api(`/calendar/events/${editId}`, {
            method: "PUT",
            token,
            body: payload,
          });
          await loadEvents();
        }
      } else {
        const ownerIds = form.ownerIds?.length ? form.ownerIds : [selfId];
        const payload = {
          ownerIds,
          title,
          description: form.description.trim(),
          eventDate: form.eventDate,
          startTime,
          endTime,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          endDate,
          repeat,
        };

        if (localMode) {
          const dates = expandOccurrences({ startDate: form.eventDate, endDate, repeat });
          const owner = owners.find((o) => o.id === ownerIds[0]) || owners[0];
          const sharedOwners = owners.filter((o) => ownerIds.includes(o.id));
          const sharedOwnerNames = sharedOwners.map((o) => ownerLabel(o));
          const seriesId = `local-${Date.now()}`;
          const seriesStartDate = dates[0];
          const seriesEndDate = dates[dates.length - 1];
          const items = dates.map((eventDate, i) => ({
            id: Date.now() + i,
            ownerId: ownerIds[0],
            sharedOwnerIds: ownerIds,
            sharedOwnerNames,
            ownerThemeColor: ownerIds.length > 1 ? "shared-gray" : (owner?.calendarThemeColor || "red"),
            ownerName: owner ? ownerLabel(owner) : null,
            seriesId,
            seriesStartDate,
            seriesEndDate,
            spanDays: dates.length,
            weekdays: repeat?.weekdays || [],
            repeat,
            title,
            description: form.description.trim(),
            eventDate,
            startTime,
            endTime,
            incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
            appointmentType: form.appointmentType || null,
          }));
          setEvents((prev) => [...prev, ...items]);
        } else {
          await api("/calendar/events", {
            method: "POST",
            token,
            body: payload,
          });
          await loadEvents();
        }
      }
      closeModal();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const canManageEvent = useCallback(
    (ev) => {
      if (!ev) return false;
      const uid = selfId ?? user?.id;
      if (ev.ownerId === uid) return true;
      if (ev.sharedOwnerIds?.includes(uid)) return true;
      if (isCalendarAdmin) return true;
      return false;
    },
    [selfId, user?.id, isCalendarAdmin]
  );

  const deleteEvent = async (id) => {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    const target = displayEvents.find((ev) => ev.id === id);
    const seriesKey = target ? eventSeriesKey(target) : null;
    if (localMode) {
      setEvents((prev) =>
        prev.filter((ev) => (seriesKey ? eventSeriesKey(ev) !== seriesKey : ev.id !== id))
      );
      setDayOpen(null);
      closeModal();
      return;
    }
    try {
      await api(`/calendar/events/${id}`, { method: "DELETE", token });
      await loadEvents();
      setDayOpen(null);
      closeModal();
    } catch (e) {
      setErr(e.message);
    }
  };

  const toggleSeriesSelection = (ev) => {
    if (!canManageEvent(ev)) return;
    const key = eventSeriesKey(ev);
    setSelectedSeriesKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDeleteModeClick = async () => {
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedSeriesKeys(new Set());
      setDayOpen(null);
      closeModal();
      return;
    }

    if (selectedSeriesKeys.size === 0) {
      setDeleteMode(false);
      return;
    }

    const count = selectedSeriesKeys.size;
    if (!window.confirm(`선택한 ${count}개 일정을 삭제할까요?`)) return;

    const idsToDelete = [];
    for (const key of selectedSeriesKeys) {
      const ev = displayEvents.find((item) => eventSeriesKey(item) === key);
      if (ev) idsToDelete.push(ev.id);
    }

    if (localMode) {
      setEvents((prev) => prev.filter((ev) => !selectedSeriesKeys.has(eventSeriesKey(ev))));
      setDeleteMode(false);
      setSelectedSeriesKeys(new Set());
      return;
    }

    try {
      setBusy(true);
      await Promise.all(
        idsToDelete.map((id) => api(`/calendar/events/${id}`, { method: "DELETE", token }))
      );
      await loadEvents();
      setDeleteMode(false);
      setSelectedSeriesKeys(new Set());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const monthLabel = `${viewYear}년 ${viewMonth}월`;
  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const todayKey = toDateKey(today);
  const canPickOwner = isCalendarAdmin && owners.length > 1;

  return (
    <div className="schedule" style={{ "--cal-accent": theme.accent }}>
      <div className="schedule__toolbar">
        <div className="schedule__toolbar-left">
          <button
            type="button"
            className="schedule__title-btn"
            onClick={() => canPickOwner && setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
          >
            <span className="schedule__title-dots" aria-hidden>
              {selectedOwners.map((o) => (
                <span
                  key={o.id}
                  className="schedule__title-dot"
                  style={{ background: getThemeById(o.calendarThemeColor || "red").accent }}
                />
              ))}
            </span>
            <span className="schedule__owner-name">{headerTitle}</span>
            {canPickOwner && <span className="schedule__title-caret">{filterOpen ? "▴" : "▾"}</span>}
          </button>
        </div>

        <div className="schedule__toolbar-right">
          <button
            type="button"
            className="schedule__theme-btn"
            onClick={() => setThemeOpen((v) => !v)}
            aria-label="테마 변경"
          >
            <span className="schedule__theme-dot" style={{ background: theme.accent }} />
            테마 변경
          </button>
          {isCalendarAdmin && (
            <button
              type="button"
              className={`schedule__bulk-delete-btn ${deleteMode ? "is-active" : ""}`}
              onClick={handleDeleteModeClick}
              disabled={busy}
            >
              {deleteMode
                ? selectedSeriesKeys.size > 0
                  ? `${selectedSeriesKeys.size}개 삭제`
                  : "선택 취소"
                : "일정삭제"}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {filterOpen && canPickOwner && (
          <motion.div
            className="schedule__filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="schedule__filter-label">보기 대상 (눌러서 선택/해제)</p>
            <div className="schedule__filter-chips">
              {owners.map((o) => {
                const active = selectedOwnerIds.includes(o.id);
                const chipTheme = getThemeById(o.calendarThemeColor || "red");
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`schedule__filter-chip ${active ? "is-active" : ""}`}
                    style={{ "--chip-accent": chipTheme.accent }}
                    onClick={() => toggleOwnerFilter(o.id)}
                  >
                    {ownerLabel(o)}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {themeOpen && themeOwners.length > 0 && (
          <motion.div
            className="schedule__theme-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {themeOwners.map((owner) => (
              <div key={owner.id} className="schedule__theme-owner">
                <p className="schedule__theme-label">
                  {isSuperAdmin && themeOwners.length > 1
                    ? `${ownerLabel(owner)} 테마`
                    : "테마 색상"}
                </p>
                <div className="schedule__theme-swatches">
                  {CALENDAR_THEME_COLORS.map((c) => (
                    <button
                      key={`${owner.id}-${c.id}`}
                      type="button"
                      className={`schedule__swatch ${owner.calendarThemeColor === c.id ? "is-active" : ""}`}
                      style={{ "--swatch": c.accent }}
                      onClick={() => saveTheme(owner.id, c.id)}
                      title={c.label}
                      aria-label={`${ownerLabel(owner)} ${c.label}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="schedule__nav">
        <button type="button" className="schedule__nav-btn" onClick={() => shiftMonth(-1)} aria-label="이전 달">
          ‹
        </button>
        <h3 className="schedule__month">{monthLabel}</h3>
        <button type="button" className="schedule__nav-btn" onClick={() => shiftMonth(1)} aria-label="다음 달">
          ›
        </button>
      </div>

      {err && <p className="schedule__err">{err}</p>}
      {loading ? (
        <div className="state">일정을 불러오는 중…</div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthKey}
            className="schedule__calendar"
            initial={{ x: monthDir >= 0 ? 80 : -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: monthDir >= 0 ? -80 : 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = touchStartRef.current;
              touchStartRef.current = null;
              if (!start) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) shiftMonth(-1);
                else shiftMonth(1);
              }
            }}
          >
            <div className="schedule__weekdays">
              {WEEKDAYS.map((d) => (
                <span key={d} className="schedule__weekday">
                  {d}
                </span>
              ))}
            </div>
            <div className="schedule__grid">
              {grid.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="schedule__cell schedule__cell--empty" />;
                }
                const key = toDateKey(date);
                const dayEvents = eventsByDate[key] || [];
                const isToday = key === todayKey;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                return (
                  <DayCell
                    key={key}
                    date={date}
                    events={dayEvents}
                    isToday={isToday}
                    isWeekend={isWeekend}
                    dateKey={key}
                    seriesDateSet={seriesDateSet}
                    deleteMode={deleteMode}
                    selectedSeriesKeys={selectedSeriesKeys}
                    canManageEvent={canManageEvent}
                    onToggleSelect={toggleSeriesSelection}
                    onOpenDay={() => {
                      if (deleteMode) return;
                      setDayOpen({ dateKey: key, events: dedupeEventsBySeries(dayEvents) });
                    }}
                  />
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {addOpen && (
          <EventModal
            title={editId != null ? "일정 수정" : "일정 추가"}
            form={form}
            setForm={setForm}
            busy={busy}
            isEdit={editId != null}
            owners={owners}
            canPickOwner={canPickOwner}
            onClose={closeModal}
            onSubmit={submitEvent}
            onDelete={editId != null ? () => deleteEvent(editId) : null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dayOpen && (
          <DayModal
            dateKey={dayOpen.dateKey}
            events={dayOpen.events}
            owners={owners}
            selectedOwners={selectedOwners}
            onClose={() => setDayOpen(null)}
            onEdit={openEdit}
            onDelete={deleteEvent}
            onAdd={() => {
              setDayOpen(null);
              openAdd(dayOpen.dateKey);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EventBubble({
  event,
  showTime,
  showLabel = true,
  onClick,
  connectedPrev,
  connectedNext,
  deleteMode,
  selected,
  selectable,
}) {
  const isShared = (event.sharedOwnerIds?.length || 1) > 1;
  const bubbleTheme = isShared
    ? { accent: "#9ca3af" }
    : getThemeById(event.ownerThemeColor || "red");
  const isMoney = event.appointmentType === "MONEY" || (!event.appointmentType && Boolean(event.incomeType));
  const isDrink = event.appointmentType === "DRINK";
  const isAllDay = !event.startTime;
  const showCheck = deleteMode && selectable && showLabel;
  return (
    <span
      className={`schedule__bubble ${connectedPrev ? "is-cont-prev" : ""} ${connectedNext ? "is-cont-next" : ""} ${isAllDay ? "is-all-day" : ""} ${deleteMode && selected ? "is-pick-selected" : ""} ${showCheck ? "is-pickable" : ""} ${showLabel ? "" : "is-continuation"}`}
      style={{ "--cal-accent": bubbleTheme.accent }}
      onClick={onClick}
      role="presentation"
    >
      {showCheck && (
        <span className={`schedule__bubble-check ${selected ? "is-checked" : ""}`} aria-hidden>
          {selected ? "✓" : ""}
        </span>
      )}
      {showLabel && isMoney && <span className="schedule__money-icon" aria-hidden>₩</span>}
      {showLabel && isDrink && <span className="schedule__drink-icon" aria-hidden>🍺</span>}
      {showLabel && <span className="schedule__bubble-title">{event.title}</span>}
      {showLabel && showTime && event.startTime && (
        <span className="schedule__bubble-time">{formatEventTime(event)}</span>
      )}
    </span>
  );
}

function DayCell({
  date,
  dateKey,
  events,
  isToday,
  isWeekend,
  onOpenDay,
  seriesDateSet,
  deleteMode,
  selectedSeriesKeys,
  canManageEvent,
  onToggleSelect,
}) {
  const maxVisible = 4;
  const uniqueEvents = dedupeEventsBySeries(events);
  const visible = uniqueEvents.slice(0, maxVisible);
  const hiddenCount = Math.max(0, uniqueEvents.length - maxVisible);

  return (
    <button
      type="button"
      className={`schedule__cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""} ${deleteMode ? "is-delete-mode" : ""}`}
      onClick={onOpenDay}
      aria-label={`${date.getDate()}일`}
    >
      <span className="schedule__day-num">{date.getDate()}</span>
      <div className="schedule__bubbles">
        {visible.map((ev) => {
          const seriesKey = eventSeriesKey(ev);
          const isDiscrete = !!ev.repeat?.freq;
          const prev = !isDiscrete && seriesDateSet.has(`${seriesKey}::${shiftDateKey(dateKey, -1)}`);
          const next = !isDiscrete && seriesDateSet.has(`${seriesKey}::${shiftDateKey(dateKey, 1)}`);
          const selectable = canManageEvent(ev);
          const selected = selectedSeriesKeys.has(seriesKey);
          // 띠가 이어지는 중간 칸에서는 라벨을 숨기고, 주(週)의 첫 칸(일요일)에서만 다시 보여준다.
          const showLabel = isDiscrete ? true : (!prev || date.getDay() === 0);
          return (
            <EventBubble
              key={seriesKey}
              event={ev}
              showTime
              showLabel={showLabel}
              connectedPrev={prev}
              connectedNext={next}
              deleteMode={deleteMode}
              selected={selected}
              selectable={selectable}
              onClick={(e) => {
                e.stopPropagation();
                if (deleteMode) {
                  if (selectable) onToggleSelect(ev);
                  return;
                }
                onOpenDay();
              }}
            />
          );
        })}
        {hiddenCount > 0 && (
          <span
            className="schedule__more"
            onClick={(e) => {
              e.stopPropagation();
              if (!deleteMode) onOpenDay();
            }}
          >
            +{hiddenCount}
          </span>
        )}
      </div>
    </button>
  );
}

function AutoGrowTextarea({ id, value, onChange, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={2}
      className="schedule__desc-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}

function shortenLocationName(name) {
  if (!name) return "";
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const WHEEL_ITEM_H = 34;

function rangeArr(start, end) {
  const out = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

function parseFormDate(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function WheelColumn({ items, value, onChange, ariaLabel, suffix }) {
  const ref = useRef(null);
  const settleRef = useRef(null);
  const idx = Math.max(0, items.findIndex((it) => String(it.value) === String(value)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = idx * WHEEL_ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [idx]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const i = Math.min(Math.max(Math.round(el.scrollTop / WHEEL_ITEM_H), 0), items.length - 1);
      const target = i * WHEEL_ITEM_H;
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target, behavior: "smooth" });
      const v = items[i]?.value;
      if (v != null && String(v) !== String(value)) onChange(v);
    }, 110);
  };

  return (
    <div className="wheel">
      <div className="wheel__scroll" ref={ref} onScroll={handleScroll} role="listbox" aria-label={ariaLabel}>
        <div className="wheel__pad" />
        {items.map((it) => (
          <button
            type="button"
            key={it.value}
            className={`wheel__item ${String(it.value) === String(value) ? "is-sel" : ""}`}
            onClick={() => onChange(it.value)}
          >
            {it.label}
          </button>
        ))}
        <div className="wheel__pad" />
      </div>
      <div className="wheel__center" aria-hidden />
      {suffix && <span className="wheel__suffix" aria-hidden>{suffix}</span>}
    </div>
  );
}

function DateWheel({ value, min, onChange }) {
  const cur = parseFormDate(value) || parseFormDate(min) || new Date();
  const yy = cur.getFullYear();
  const mm = cur.getMonth() + 1;
  const dd = cur.getDate();
  const minY = parseFormDate(min)?.getFullYear() ?? yy;
  const loY = Math.min(yy, minY);
  const years = rangeArr(loY, loY + 6);
  const daysInMonth = new Date(yy, mm, 0).getDate();

  const build = (ny, nm, nd) => {
    const dim = new Date(ny, nm, 0).getDate();
    const day = Math.min(nd, dim);
    let key = `${ny}-${pad2(nm)}-${pad2(day)}`;
    if (min && key < min) key = min;
    onChange(key);
  };

  return (
    <div className="wheel-group">
      <WheelColumn
        ariaLabel="년"
        suffix="년"
        items={years.map((v) => ({ value: v, label: `${v}` }))}
        value={yy}
        onChange={(v) => build(Number(v), mm, dd)}
      />
      <WheelColumn
        ariaLabel="월"
        suffix="월"
        items={rangeArr(1, 13).map((v) => ({ value: v, label: `${v}` }))}
        value={mm}
        onChange={(v) => build(yy, Number(v), dd)}
      />
      <WheelColumn
        ariaLabel="일"
        suffix="일"
        items={rangeArr(1, daysInMonth + 1).map((v) => ({ value: v, label: `${v}` }))}
        value={dd}
        onChange={(v) => build(yy, mm, Number(v))}
      />
    </div>
  );
}

function TimeWheel({ value, onChange }) {
  const [h, mi] = /^\d{2}:\d{2}$/.test(value || "") ? value.split(":").map(Number) : [9, 0];
  const mins = rangeArr(0, 12).map((i) => i * 5);
  const safeMi = mins.includes(mi) ? mi : Math.min(55, Math.round(mi / 5) * 5);
  const build = (nh, nm) => onChange(`${pad2(nh)}:${pad2(nm)}`);
  return (
    <div className="wheel-group">
      <WheelColumn
        ariaLabel="시"
        suffix="시"
        items={rangeArr(0, 24).map((v) => ({ value: v, label: pad2(v) }))}
        value={h}
        onChange={(v) => build(Number(v), safeMi)}
      />
      <WheelColumn
        ariaLabel="분"
        suffix="분"
        items={mins.map((v) => ({ value: v, label: pad2(v) }))}
        value={safeMi}
        onChange={(v) => build(h, Number(v))}
      />
    </div>
  );
}

function EventModal({
  title,
  form,
  setForm,
  busy,
  isEdit,
  owners,
  canPickOwner,
  onClose,
  onSubmit,
  onDelete,
}) {
  const isWeekly = form.repeatFreq === "weekly";

  const toggleAllDay = useCallback(() => {
    setForm((f) => ({ ...f, allDay: !f.allDay }));
  }, [setForm]);

  const toggleWeekday = useCallback(
    (n) => {
      setForm((f) => {
        const set = new Set(f.weekdays || []);
        if (set.has(n)) set.delete(n);
        else set.add(n);
        return { ...f, weekdays: [...set].sort((a, b) => a - b) };
      });
    },
    [setForm]
  );

  const setWeekdayPreset = useCallback(
    (arr) => setForm((f) => ({ ...f, weekdays: arr })),
    [setForm]
  );

  const setInterval = useCallback(
    (delta) =>
      setForm((f) => ({
        ...f,
        repeatInterval: Math.min(99, Math.max(1, (Number(f.repeatInterval) || 1) + delta)),
      })),
    [setForm]
  );

  const repeat = form.repeatOn
    ? {
        freq: form.repeatFreq,
        interval: form.repeatInterval,
        weekdays: isWeekly ? form.weekdays : [],
        until: form.repeatUntil,
      }
    : null;

  const previewDates = useMemo(
    () =>
      expandOccurrences({
        startDate: form.eventDate,
        endDate: form.repeatOn ? null : (form.endDate || form.eventDate),
        repeat,
      }),
    [form.eventDate, form.endDate, form.repeatOn, form.repeatFreq, form.repeatInterval, form.weekdays, form.repeatUntil]
  );

  const freqUnit = repeatFreqById(form.repeatFreq).unit;

  return (
    <motion.div
      className="schedule__overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="schedule__modal"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schedule__modal-head">
          <h3>{title}</h3>
          <button type="button" className="schedule__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <form className="schedule__form" onSubmit={onSubmit}>
          {canPickOwner && (
            <div className="field">
              <label>명의 (공동명의 가능)</label>
              <div className="schedule__coowners-selected">
                {form.ownerIds.map((id) => {
                  const owner = owners.find((o) => o.id === id);
                  if (!owner) return null;
                  return (
                    <span key={id} className="schedule__coowner-pill">
                      {ownerLabel(owner)}
                    </span>
                  );
                })}
              </div>
              <div className="schedule__coowners-buttons">
                {owners.map((o) => {
                  const active = form.ownerIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`schedule__coowner-btn ${active ? "is-active" : ""}`}
                      onClick={() =>
                        setForm((f) => {
                          const has = f.ownerIds.includes(o.id);
                          if (has && f.ownerIds.length === 1) return f;
                          const next = has
                            ? f.ownerIds.filter((id) => id !== o.id)
                            : [...f.ownerIds, o.id];
                          return { ...f, ownerIds: next };
                        })
                      }
                    >
                      {active ? "✓ " : "+ "}
                      {ownerLabel(o)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="ev-title">일정명</label>
            <input
              id="ev-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="일정 제목"
              required
            />
          </div>

          <div className="field schedule__field-desc">
            <label htmlFor="ev-desc">세부설명 (선택)</label>
            <AutoGrowTextarea
              id="ev-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="메모"
            />
          </div>

          <div className="schedule__allday-row">
            <button
              type="button"
              className={`schedule__allday-btn ${form.allDay ? "is-active" : ""}`}
              onClick={toggleAllDay}
              aria-pressed={form.allDay}
            >
              <span className="schedule__allday-check" aria-hidden>{form.allDay ? "✓" : ""}</span>
              종일
            </button>
            <span className="schedule__allday-start">{formatDateDot(form.eventDate)} 시작</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {form.allDay ? (
              <motion.div
                key="allday"
                className="schedule__when"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="schedule__when-block">
                  <span className="schedule__when-label">종료 날짜</span>
                  <DateWheel
                    value={form.endDate}
                    min={form.eventDate}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="timed"
                className="schedule__when"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="schedule__when-block">
                  <span className="schedule__when-label">시작 시간</span>
                  <TimeWheel value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
                </div>
                <div className="schedule__when-block">
                  <span className="schedule__when-label">종료 날짜</span>
                  <DateWheel
                    value={form.endDate}
                    min={form.eventDate}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                  />
                </div>
                <div className="schedule__when-block">
                  <span className="schedule__when-label">종료 시간</span>
                  <TimeWheel value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!form.repeatOn && (
            <p className="schedule__hint">
              {form.endDate && form.endDate !== form.eventDate
                ? `${formatDateDot(form.eventDate)} ~ ${formatDateDot(form.endDate)} · 총 ${previewDates.length}일`
                : `${formatDateDot(form.eventDate)} 하루 일정`}
            </p>
          )}

          <button
            type="button"
            className={`schedule__repeat-toggle ${form.repeatOn ? "is-active" : ""}`}
            onClick={() => setForm((f) => ({ ...f, repeatOn: !f.repeatOn }))}
            aria-pressed={form.repeatOn}
          >
            🔁 반복인가요?
          </button>

          <AnimatePresence initial={false}>
            {form.repeatOn && (
              <motion.div
                key="repeat"
                className="schedule__repeat-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="schedule__freq-row">
                  {REPEAT_FREQS.map((fq) => (
                    <button
                      key={fq.id}
                      type="button"
                      className={`schedule__freq-btn ${form.repeatFreq === fq.id ? "is-active" : ""}`}
                      onClick={() => setForm((f) => ({ ...f, repeatFreq: fq.id }))}
                    >
                      {fq.label}
                    </button>
                  ))}
                </div>

                <div className="schedule__interval-row">
                  <span className="schedule__interval-label">간격</span>
                  <div className="schedule__stepper">
                    <button type="button" onClick={() => setInterval(-1)} aria-label="간격 감소">−</button>
                    <span className="schedule__stepper-val">
                      {form.repeatInterval}
                      {freqUnit}
                    </span>
                    <button type="button" onClick={() => setInterval(1)} aria-label="간격 증가">＋</button>
                  </div>
                  <span className="schedule__interval-suffix">마다</span>
                </div>

                {isWeekly && (
                  <div className="schedule__weekday-row">
                    <div className="schedule__weekday-toggles">
                      {WEEKDAY_LABELS.map((label, n) => {
                        const active = form.weekdays?.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            className={`schedule__weekday-btn ${active ? "is-active" : ""} ${n === 0 ? "is-sun" : ""} ${n === 6 ? "is-sat" : ""}`}
                            onClick={() => toggleWeekday(n)}
                            aria-pressed={active}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="schedule__weekday-presets">
                      <button type="button" className="schedule__weekday-preset" onClick={() => setWeekdayPreset([1, 2, 3, 4, 5])}>평일</button>
                      <button type="button" className="schedule__weekday-preset" onClick={() => setWeekdayPreset([0, 6])}>주말</button>
                      <button type="button" className="schedule__weekday-preset" onClick={() => setWeekdayPreset([0, 1, 2, 3, 4, 5, 6])}>매일</button>
                    </div>
                  </div>
                )}

                <div className="schedule__when-block schedule__repeat-until">
                  <span className="schedule__when-label">반복 종료일</span>
                  <DateWheel
                    value={form.repeatUntil}
                    min={form.eventDate}
                    onChange={(v) => setForm((f) => ({ ...f, repeatUntil: v }))}
                  />
                </div>

                <p className="schedule__hint">
                  {repeatSummary(repeat)} · ~{form.repeatUntil ? formatDateDot(form.repeatUntil) : "?"} · 총 {previewDates.length}회
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="field">
            <label>세부사항 선택</label>
            <div className="schedule__detail-choice">
              <button
                type="button"
                className={`schedule__detail-btn ${form.appointmentType === "MONEY" ? "is-active" : ""}`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    appointmentType: f.appointmentType === "MONEY" ? "" : "MONEY",
                  }))
                }
              >
                돈을 벌러가나요?
              </button>
              <button
                type="button"
                className={`schedule__detail-btn ${form.appointmentType === "DRINK" ? "is-active" : ""}`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    appointmentType: f.appointmentType === "DRINK" ? "" : "DRINK",
                  }))
                }
              >
                술약속인가요?
              </button>
            </div>
          </div>

          <div className="schedule__modal-actions">
            {onDelete && (
              <button type="button" className="btn btn-ghost schedule__del-btn" onClick={onDelete}>
                삭제
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function eventIsShared(ev) {
  return (ev.sharedOwnerIds?.length || 1) > 1;
}

function eventAccent(ev) {
  return eventIsShared(ev) ? "#9ca3af" : getThemeById(ev.ownerThemeColor || "red").accent;
}

function sortDayEvents(list) {
  return [...list].sort((a, b) => {
    if (a.startTime && !b.startTime) return 1;
    if (!a.startTime && b.startTime) return -1;
    if (!a.startTime && !b.startTime) return a.id - b.id;
    return a.startTime.localeCompare(b.startTime);
  });
}

// 하루 일정을 공통(공동명의) / 개인별로 나눈다.
function buildDayColumns(events, selectedOwners) {
  const shared = [];
  const soloByOwner = new Map();
  for (const ev of events) {
    if (eventIsShared(ev)) {
      shared.push(ev);
      continue;
    }
    const oid = ev.ownerId;
    if (!soloByOwner.has(oid)) soloByOwner.set(oid, []);
    soloByOwner.get(oid).push(ev);
  }

  const columns = [];
  if (shared.length) {
    const names = [...new Set(shared.flatMap((e) => e.sharedOwnerNames || []))];
    columns.push({
      key: "shared",
      label: names.length ? names.join("+") : "공통일정",
      accent: "#9ca3af",
      events: sortDayEvents(shared),
    });
  }
  for (const o of selectedOwners) {
    const list = soloByOwner.get(o.id) || [];
    columns.push({
      key: `owner-${o.id}`,
      label: ownerLabel(o),
      accent: getThemeById(o.calendarThemeColor || "red").accent,
      events: sortDayEvents(list),
    });
  }
  return columns;
}

function DayEventCard({ ev, onEdit, onDelete, showOwner }) {
  const isMoney = ev.appointmentType === "MONEY" || (!ev.appointmentType && ev.incomeType);
  return (
    <div className="schedule__day-item">
      <span className="schedule__day-item-dot" style={{ background: eventAccent(ev) }} aria-hidden />
      <div className="schedule__day-item-main">
        <strong>
          {isMoney && <span className="schedule__money-icon">₩</span>}
          {ev.appointmentType === "DRINK" && <span className="schedule__drink-icon">🍺</span>}
          <span className="schedule__day-item-title-text">{ev.title}</span>
          <span className="schedule__day-item-title-time">{formatEventTime(ev)}</span>
        </strong>
        <span className="schedule__day-item-range">
          {formatDateDot(ev.seriesStartDate || ev.eventDate)} ~{" "}
          {formatDateDot(ev.seriesEndDate || ev.eventDate)}
        </span>
        {ev.sharedOwnerNames?.length > 1 && (
          <span className="schedule__day-item-shared">함께: {ev.sharedOwnerNames.join(", ")}</span>
        )}
        {showOwner && ev.ownerName && (
          <span className="schedule__day-item-owner">{ev.ownerName}</span>
        )}
        {ev.locationName && ev.locationLat != null && ev.locationLng != null && (
          <a
            className="schedule__day-item-location"
            href={mapsLink(ev.locationLat, ev.locationLng)}
            target="_blank"
            rel="noreferrer"
            title={ev.locationName}
          >
            📍 {shortenLocationName(ev.locationName)}
          </a>
        )}
        {ev.description && (
          <p className="schedule__day-item-desc" title={ev.description}>
            {ev.description}
          </p>
        )}
      </div>
      <div className="schedule__day-item-actions">
        <button type="button" className="btn btn-ghost schedule__day-edit-btn" onClick={() => onEdit(ev)}>
          수정
        </button>
        <button type="button" className="btn btn-ghost schedule__day-delete-btn" onClick={() => onDelete(ev.id)}>
          삭제
        </button>
      </div>
    </div>
  );
}

const TIMELINE_SLOT_H = 40;
const TIMELINE_HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIMELINE_HEIGHT_KEY = "gwon.calendar.timelineHeight";

function defaultTimelineHeight() {
  if (typeof window === "undefined") return 420;
  return Math.round(window.innerHeight * 0.52);
}

function clampTimelineHeight(h) {
  const max = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.85) : 900;
  return Math.min(Math.max(h, 180), max);
}

function TimelineBlock({ ev }) {
  const startMin = timeToMinute(ev.startTime);
  const endMinRaw = ev.endTime ? timeToMinute(ev.endTime) : null;
  const start = startMin ?? 0;
  const end = endMinRaw != null && endMinRaw > start ? endMinRaw : start + 60;
  const top = (start / 60) * TIMELINE_SLOT_H;
  const height = Math.max(((end - start) / 60) * TIMELINE_SLOT_H - 2, 22);
  const isMoney = ev.appointmentType === "MONEY" || (!ev.appointmentType && ev.incomeType);
  return (
    <div
      className="schedule__tl-block"
      style={{ top: `${top}px`, height: `${height}px`, "--tl-accent": eventAccent(ev) }}
      title={`${ev.title} ${formatEventTime(ev)}`}
    >
      <span className="schedule__tl-block-title">
        {isMoney && "₩"}
        {ev.appointmentType === "DRINK" && "🍺"}
        {ev.title}
      </span>
      <span className="schedule__tl-block-time">{formatEventTime(ev)}</span>
    </div>
  );
}

function DayTimeline({ columns }) {
  const scrollRef = useRef(null);
  const [height, setHeight] = useState(() => {
    const saved = Number(localStorage.getItem(TIMELINE_HEIGHT_KEY));
    return saved > 0 ? clampTimelineHeight(saved) : defaultTimelineHeight();
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * TIMELINE_SLOT_H;
  }, []);

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = scrollRef.current ? scrollRef.current.offsetHeight : height;
      const onMove = (ev) => {
        const next = clampTimelineHeight(startH + (ev.clientY - startY));
        setHeight(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (scrollRef.current) {
          localStorage.setItem(TIMELINE_HEIGHT_KEY, String(scrollRef.current.offsetHeight));
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [height]
  );

  if (!columns.length) {
    return <p className="schedule__empty">표시할 대상이 없습니다.</p>;
  }

  const anyAllDay = columns.some((c) => c.events.some((e) => !e.startTime));

  return (
    <div className="schedule__timeline">
      <div className="schedule__tl-head">
        <div className="schedule__tl-hour-gutter" />
        {columns.map((col) => (
          <div
            key={col.key}
            className="schedule__tl-colhead"
            style={{ "--tl-accent": col.accent }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {anyAllDay && (
        <div className="schedule__tl-allday">
          <div className="schedule__tl-hour-gutter schedule__tl-allday-label">종일</div>
          {columns.map((col) => (
            <div key={col.key} className="schedule__tl-allday-cell">
              {col.events
                .filter((e) => !e.startTime)
                .map((ev) => (
                  <span
                    key={eventSeriesKey(ev)}
                    className="schedule__tl-allday-chip"
                    style={{ "--tl-accent": eventAccent(ev) }}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="schedule__tl-scroll" ref={scrollRef} style={{ height: `${height}px` }}>
        <div className="schedule__tl-body" style={{ height: `${24 * TIMELINE_SLOT_H}px` }}>
          <div className="schedule__tl-hours">
            {TIMELINE_HOURS.map((h) => (
              <div key={h} className="schedule__tl-hour" style={{ height: `${TIMELINE_SLOT_H}px` }}>
                <span>{String(h).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
          {columns.map((col) => (
            <div key={col.key} className="schedule__tl-col">
              {TIMELINE_HOURS.map((h) => (
                <div
                  key={h}
                  className="schedule__tl-slot"
                  style={{ height: `${TIMELINE_SLOT_H}px` }}
                />
              ))}
              {col.events
                .filter((e) => e.startTime)
                .map((ev) => (
                  <TimelineBlock key={eventSeriesKey(ev)} ev={ev} />
                ))}
            </div>
          ))}
        </div>
      </div>
      <div
        className="schedule__tl-resize"
        onPointerDown={startResize}
        role="separator"
        aria-label="타임라인 높이 조절"
        title="드래그해서 높이 조절"
      >
        <span className="schedule__tl-resize-grip" aria-hidden />
      </div>
    </div>
  );
}

function DayModal({ dateKey, events, owners, selectedOwners, onClose, onEdit, onDelete, onAdd }) {
  const [y, m, d] = dateKey.split("-");
  const [viewMode, setViewMode] = useState("grouped");

  const uniqueEvents = useMemo(() => dedupeEventsBySeries(events), [events]);
  const fallbackOwners = selectedOwners?.length ? selectedOwners : owners || [];
  const columns = useMemo(
    () => buildDayColumns(uniqueEvents, fallbackOwners),
    [uniqueEvents, fallbackOwners]
  );
  const showOwnerName = fallbackOwners.length > 1;

  return (
    <motion.div
      className="schedule__overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`schedule__modal schedule__modal--day ${viewMode === "timeline" ? "schedule__modal--timeline" : ""}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schedule__modal-head">
          <h3>
            {y}년 {Number(m)}월 {Number(d)}일
          </h3>
          <div className="schedule__modal-head-actions">
            <button type="button" className="btn btn-accent schedule__day-add-top" onClick={onAdd}>
              ＋ 일정 추가
            </button>
            <button type="button" className="schedule__close" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
        </div>

        <div className="schedule__day-viewtoggle">
          <button
            type="button"
            className={`schedule__viewtoggle-btn ${viewMode === "grouped" ? "is-active" : ""}`}
            onClick={() => setViewMode("grouped")}
          >
            목록보기
          </button>
          <button
            type="button"
            className={`schedule__viewtoggle-btn ${viewMode === "timeline" ? "is-active" : ""}`}
            onClick={() => setViewMode("timeline")}
          >
            막대바로보기
          </button>
        </div>

        {uniqueEvents.length === 0 ? (
          <div className="schedule__day-list">
            <p className="schedule__empty">등록된 일정이 없습니다.</p>
          </div>
        ) : viewMode === "timeline" ? (
          <DayTimeline columns={columns} />
        ) : (
          <div className="schedule__day-groups">
            {columns.map((col) => (
              <section key={col.key} className="schedule__day-group">
                <header className="schedule__day-group-head">
                  <span
                    className="schedule__day-group-dot"
                    style={{ background: col.accent }}
                    aria-hidden
                  />
                  <span className="schedule__day-group-name">{col.label}</span>
                  <span className="schedule__day-group-count">{col.events.length}</span>
                </header>
                {col.events.length === 0 ? (
                  <p className="schedule__day-group-empty">일정 없음</p>
                ) : (
                  <div className="schedule__day-list">
                    {col.events.map((ev) => (
                      <DayEventCard
                        key={eventSeriesKey(ev)}
                        ev={ev}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        showOwner={showOwnerName && col.key === "shared"}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
