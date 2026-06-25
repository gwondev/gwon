import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  dedupeEventsBySeries,
  eventSeriesKey,
  expandEventDates,
  filterTitle,
  formatShortDateKey,
  ownerLabel,
  repeatWeeksLabel,
  spanDaysLabel,
} from "../lib/calendarUtils";
import {
  CALENDAR_THEME_COLORS,
  formatEventTime,
  getThemeById,
} from "../lib/calendarTheme";
import "./ScheduleTab.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_SPAN_DAYS = 14;
const MAX_REPEAT_WEEKS = 12;

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
  return {
    ownerIds: ownerId != null ? [ownerId] : [],
    title: "",
    description: "",
    eventDate: dateKey,
    startTime: "",
    endTime: "",
    appointmentType: "",
    locationName: "",
    locationLat: null,
    locationLng: null,
    spanDays: 1,
    repeatWeeks: 1,
  };
}

function formFromEvent(ev) {
  return {
    ownerIds: ev.sharedOwnerIds?.length ? [...ev.sharedOwnerIds] : [ev.ownerId],
    title: ev.title || "",
    description: ev.description || "",
    eventDate: ev.seriesStartDate || ev.eventDate,
    startTime: ev.startTime || "",
    endTime: ev.endTime || "",
    appointmentType: ev.appointmentType || (ev.incomeType ? "MONEY" : ""),
    locationName: ev.locationName || "",
    locationLat: ev.locationLat ?? null,
    locationLng: ev.locationLng ?? null,
    spanDays: ev.spanDays || 1,
    repeatWeeks: ev.repeatWeeks || 1,
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
      set.add(`${ev.seriesId}::${ev.eventDate}`);
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
        const ids = await loadFilter(ownerList, ownerList[0]?.id ?? user.id);
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
    try {
      if (form.startTime && form.endTime && timeToMinute(form.endTime) <= timeToMinute(form.startTime)) {
        setErr("종료 시간은 시작 시간보다 뒤로 설정해주세요.");
        setBusy(false);
        return;
      }
      if (editId != null) {
        const payload = {
          title,
          description: form.description.trim(),
          eventDate: form.eventDate,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          locationName: form.locationName?.trim() || null,
          locationLat: form.locationLat,
          locationLng: form.locationLng,
          ownerIds: form.ownerIds,
          spanDays: form.spanDays,
          repeatWeeks: form.repeatWeeks,
        };
        if (localMode) {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === editId
                ? {
                    ...ev,
                    ...payload,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                  }
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
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          locationName: form.locationName?.trim() || null,
          locationLat: form.locationLat,
          locationLng: form.locationLng,
          spanDays: form.spanDays,
          repeatWeeks: form.repeatWeeks,
        };

        if (localMode) {
          const dates = expandEventDates(form.eventDate, form.spanDays, form.repeatWeeks);
          const owner = owners.find((o) => o.id === ownerIds[0]) || owners[0];
          const sharedOwners = owners.filter((o) => ownerIds.includes(o.id));
          const sharedOwnerNames = sharedOwners.map((o) => ownerLabel(o));
          const items = dates.map((eventDate, i) => ({
            id: Date.now() + i,
            ownerId: ownerIds[0],
            sharedOwnerIds: ownerIds,
            sharedOwnerNames,
            ownerThemeColor: ownerIds.length > 1 ? "shared-gray" : (owner?.calendarThemeColor || "red"),
            ownerName: owner ? ownerLabel(owner) : null,
            title,
            description: form.description.trim(),
            eventDate,
            startTime: form.startTime || null,
            endTime: form.endTime || null,
            incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
            appointmentType: form.appointmentType || null,
            locationName: form.locationName?.trim() || null,
            locationLat: form.locationLat,
            locationLng: form.locationLng,
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
      if (isSuperAdmin) return true;
      return false;
    },
    [selfId, user?.id, isSuperAdmin]
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
  const canPickOwner = isSuperAdmin && owners.length > 1;

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
  return (
    <span
      className={`schedule__bubble ${connectedPrev ? "is-cont-prev" : ""} ${connectedNext ? "is-cont-next" : ""} ${isAllDay ? "is-all-day" : ""} ${deleteMode && selected ? "is-pick-selected" : ""} ${deleteMode && selectable ? "is-pickable" : ""}`}
      style={{ "--cal-accent": bubbleTheme.accent }}
      onClick={onClick}
      role="presentation"
    >
      {deleteMode && selectable && (
        <span className={`schedule__bubble-check ${selected ? "is-checked" : ""}`} aria-hidden>
          {selected ? "✓" : ""}
        </span>
      )}
      {isMoney && <span className="schedule__money-icon" aria-hidden>₩</span>}
      {isDrink && <span className="schedule__drink-icon" aria-hidden>🍺</span>}
      <span className="schedule__bubble-title">{event.title}</span>
      {showTime && event.startTime && (
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
  const maxVisible = 5;
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
          const prev = seriesDateSet.has(`${ev.seriesId}::${shiftDateKey(dateKey, -1)}`);
          const next = seriesDateSet.has(`${ev.seriesId}::${shiftDateKey(dateKey, 1)}`);
          const seriesKey = eventSeriesKey(ev);
          const selectable = canManageEvent(ev);
          const selected = selectedSeriesKeys.has(seriesKey);
          return (
            <EventBubble
              key={seriesKey}
              event={ev}
              showTime
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

function LocationPicker({ value, onChange }) {
  const { token, localMode } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const runSearch = useCallback(
    async (q) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        if (localMode) {
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("format", "json");
          url.searchParams.set("q", trimmed);
          url.searchParams.set("limit", "6");
          url.searchParams.set("countrycodes", "kr");
          const resp = await fetch(url, { headers: { Accept: "application/json" } });
          const data = await resp.json();
          setResults(
            (Array.isArray(data) ? data : []).map((row) => ({
              name: row.display_name,
              lat: Number(row.lat),
              lng: Number(row.lon),
            }))
          );
        } else {
          const data = await api(`/calendar/places?q=${encodeURIComponent(trimmed)}`, { token });
          setResults(data.items || []);
        }
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [token, localMode]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim() || value?.locationName) {
      setResults([]);
      return undefined;
    }
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, value?.locationName, runSearch]);

  const clearLocation = () => {
    onChange({ locationName: "", locationLat: null, locationLng: null });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const pickLocation = (item) => {
    onChange({
      locationName: item.name,
      locationLat: item.lat,
      locationLng: item.lng,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  if (value?.locationName && value.locationLat != null && value.locationLng != null) {
    return (
      <div className="field schedule__location-field">
        <label>모임 위치</label>
        <div className="schedule__location-selected">
          <span className="schedule__location-pin" aria-hidden>
            📍
          </span>
          <span className="schedule__location-name" title={value.locationName}>
            {shortenLocationName(value.locationName)}
          </span>
          <button type="button" className="schedule__location-clear" onClick={clearLocation} aria-label="위치 삭제">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="field schedule__location-field" ref={wrapRef}>
      <label htmlFor="ev-location">모임 위치 (선택)</label>
      <div className="schedule__location-search">
        <span className="schedule__location-pin" aria-hidden>
          📍
        </span>
        <input
          id="ev-location"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="장소 검색"
          autoComplete="off"
        />
        {searching && <span className="schedule__location-loading">…</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="schedule__location-results">
          {results.map((item, idx) => (
            <li key={`${item.lat}-${item.lng}-${idx}`}>
              <button type="button" onClick={() => pickLocation(item)}>
                {shortenLocationName(item.name)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MobileTimePicker({ label, value, onChange }) {
  const [hourRaw, minuteRaw] = /^\d{2}:\d{2}$/.test(value || "") ? value.split(":") : ["09", "00"];
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutes = useMemo(
    () => Array.from({ length: 6 }, (_, i) => String(i * 10).padStart(2, "0")),
    []
  );
  const safeMinute = minutes.includes(minuteRaw) ? minuteRaw : "00";

  return (
    <div className="field">
      <label>{label}</label>
      <div className="schedule__time-scroll-wrap">
        <select
          className="schedule__time-scroll"
          value={hourRaw}
          onChange={(e) => onChange(`${e.target.value}:${safeMinute}`)}
          aria-label={`${label} 시`}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}시
            </option>
          ))}
        </select>
        <span className="schedule__time-colon">:</span>
        <select
          className="schedule__time-scroll"
          value={safeMinute}
          onChange={(e) => onChange(`${hourRaw}:${e.target.value}`)}
          aria-label={`${label} 분`}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m}분
            </option>
          ))}
        </select>
      </div>
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
  const spanOptions = useMemo(
    () => Array.from({ length: MAX_SPAN_DAYS }, (_, i) => i + 1),
    []
  );
  const weekOptions = useMemo(
    () => Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1),
    []
  );
  const [quickPreset, setQuickPreset] = useState(null);

  const applyQuickDuration = useCallback(
    (hours) => {
      const start = /^\d{2}:\d{2}$/.test(form.startTime || "") ? form.startTime : "09:00";
      const startMinute = timeToMinute(start);
      const endMinute = startMinute + hours * 60;
      const endHour = Math.floor((endMinute % (24 * 60)) / 60);
      const endMin = endMinute % 60;
      const end = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
      setForm((f) => ({ ...f, startTime: start, endTime: end }));
      setQuickPreset(String(hours));
    },
    [form.startTime, setForm]
  );

  const applyAllDay = useCallback(() => {
    setForm((f) => ({ ...f, startTime: "", endTime: "" }));
    setQuickPreset("ALL_DAY");
  }, [setForm]);

  const handleStartTimeChange = useCallback(
    (v) => {
      setForm((f) => ({ ...f, startTime: v }));
      setQuickPreset(null);
    },
    [setForm]
  );

  const handleEndTimeChange = useCallback(
    (v) => {
      setForm((f) => ({ ...f, endTime: v }));
      setQuickPreset(null);
    },
    [setForm]
  );

  useEffect(() => {
    if (!form.startTime && !form.endTime) {
      setQuickPreset("ALL_DAY");
      return;
    }
    if (!form.startTime || !form.endTime) {
      setQuickPreset(null);
      return;
    }
    const s = timeToMinute(form.startTime);
    const e = timeToMinute(form.endTime);
    if (s == null || e == null || e <= s) {
      setQuickPreset(null);
      return;
    }
    const diff = e - s;
    if (diff % 60 !== 0) {
      setQuickPreset(null);
      return;
    }
    const h = diff / 60;
    if (h >= 1 && h <= 4) setQuickPreset(String(h));
    else setQuickPreset(null);
  }, [form.startTime, form.endTime]);

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

          <div className="schedule__date-row">
            <span className="schedule__date-display">{formatShortDateKey(form.eventDate)}</span>
            <select
              className="schedule__duration-select"
              value={form.spanDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, spanDays: Number(e.target.value) }))
              }
              aria-label="기간"
            >
              {spanOptions.map((n) => (
                <option key={n} value={n}>
                  {spanDaysLabel(n)}
                </option>
              ))}
            </select>
            <select
              className="schedule__duration-select"
              value={form.repeatWeeks}
              onChange={(e) =>
                setForm((f) => ({ ...f, repeatWeeks: Number(e.target.value) }))
              }
              aria-label="주 반복"
            >
              {weekOptions.map((n) => (
                <option key={n} value={n}>
                  {repeatWeeksLabel(n)}
                </option>
              ))}
            </select>
          </div>

          <p className="schedule__hint">
            {form.spanDays}일간 · {repeatWeeksLabel(form.repeatWeeks)} 동일 패턴으로 등록됩니다.
          </p>

          <div className="schedule__time-quick-row">
            {[1, 2, 3, 4].map((h) => (
              <button
                key={h}
                type="button"
                className={`schedule__time-quick-btn ${quickPreset === String(h) ? "is-active" : ""}`}
                onClick={() => applyQuickDuration(h)}
              >
                {h}시간
              </button>
            ))}
            <button
              type="button"
              className={`schedule__time-quick-btn ${quickPreset === "ALL_DAY" ? "is-active" : ""}`}
              onClick={applyAllDay}
            >
              종일
            </button>
          </div>
          {quickPreset !== "ALL_DAY" && (
            <div className="schedule__time-row">
              <MobileTimePicker
                label="시작 (선택)"
                value={form.startTime}
                onChange={handleStartTimeChange}
              />
              <MobileTimePicker
                label="종료 (선택)"
                value={form.endTime}
                onChange={handleEndTimeChange}
              />
            </div>
          )}
          <LocationPicker
            value={{
              locationName: form.locationName,
              locationLat: form.locationLat,
              locationLng: form.locationLng,
            }}
            onChange={(loc) => setForm((f) => ({ ...f, ...loc }))}
          />
          <p className="schedule__hint">시간을 비우면 종일 일정으로 저장됩니다.</p>

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

function DayModal({ dateKey, events, onClose, onEdit, onDelete, onAdd }) {
  const [y, m, d] = dateKey.split("-");
  return (
    <motion.div
      className="schedule__overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="schedule__modal schedule__modal--day"
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
        <div className="schedule__day-list">
          {events.length === 0 ? (
            <p className="schedule__empty">등록된 일정이 없습니다.</p>
          ) : (
            dedupeEventsBySeries(events).map((ev) => {
              const isShared = (ev.sharedOwnerIds?.length || 1) > 1;
              const bubbleTheme = isShared
                ? { accent: "#9ca3af" }
                : getThemeById(ev.ownerThemeColor || "red");
              return (
                <div key={eventSeriesKey(ev)} className="schedule__day-item">
                  <span
                    className="schedule__day-item-dot"
                    style={{ background: bubbleTheme.accent }}
                    aria-hidden
                  />
                  <div className="schedule__day-item-main">
                    <strong>
                      {(ev.appointmentType === "MONEY" || (!ev.appointmentType && ev.incomeType)) && (
                        <span className="schedule__money-icon">₩</span>
                      )}
                      {ev.appointmentType === "DRINK" && <span className="schedule__drink-icon">🍺</span>}
                      <span className="schedule__day-item-title-text">{ev.title}</span>
                      <span className="schedule__day-item-title-time">{formatEventTime(ev)}</span>
                    </strong>
                    <span className="schedule__day-item-range">
                      {formatDateDot(ev.seriesStartDate || ev.eventDate)} ~{" "}
                      {formatDateDot(ev.seriesEndDate || ev.eventDate)}
                    </span>
                    {ev.sharedOwnerNames?.length > 1 && (
                      <span className="schedule__day-item-shared">
                        함께: {ev.sharedOwnerNames.join(", ")}
                      </span>
                    )}
                    {ev.ownerName && selectedOwnersCount(events) > 1 && (
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
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function selectedOwnersCount(events) {
  return new Set(events.map((e) => e.ownerId)).size;
}
