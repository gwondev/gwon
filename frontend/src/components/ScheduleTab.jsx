import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  expandEventDates,
  filterTitle,
  formatShortDateKey,
  jointOwnerTitle,
  ownerLabel,
  repeatWeeksLabel,
  spanDaysLabel,
} from "../lib/calendarUtils";
import {
  CALENDAR_THEME_COLORS,
  COIN_ICON,
  INCOME_OPTIONS,
  formatEventTime,
  getEventTheme,
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
    coOwnerIds: [],
    ownerThemeColor: "red",
    title: "포트폴리오 점검",
    description: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "14:00",
    endTime: null,
    incomeType: null,
  },
  {
    id: 2,
    ownerId: 1,
    coOwnerIds: [0],
    ownerThemeColor: "orange",
    title: "팀 미팅",
    description: "공동 일정 예시",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: null,
    incomeType: "WORK",
  },
];

const FILTER_STORAGE_KEY = "gwon.calendar.filter";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function blankForm(dateKey = "", selfId = null) {
  return {
    ownerIds: selfId != null ? [selfId] : [],
    title: "",
    description: "",
    eventDate: dateKey,
    startTime: "",
    endTime: "",
    earnsMoney: false,
    incomeType: "",
    spanDays: 1,
    repeatWeeks: 1,
  };
}

function formFromEvent(ev, selfId) {
  const ownerIds = [ev.ownerId, ...(ev.coOwnerIds || [])].filter(
    (id, idx, arr) => id != null && arr.indexOf(id) === idx
  );
  return {
    ownerIds: ownerIds.length ? ownerIds : selfId != null ? [selfId] : [],
    title: ev.title || "",
    description: ev.description || "",
    eventDate: ev.eventDate,
    startTime: ev.startTime || "",
    endTime: ev.endTime || "",
    earnsMoney: Boolean(ev.incomeType),
    incomeType: ev.incomeType || "",
  };
}

function eventMatchesOwners(ev, ownerIds) {
  const ids = [ev.ownerId, ...(ev.coOwnerIds || [])];
  return ids.some((id) => ownerIds.includes(id));
}

function enrichEvent(ev, owners) {
  const owner = owners.find((o) => o.id === ev.ownerId);
  const coOwnerIds = ev.coOwnerIds || [];
  const coNames = coOwnerIds
    .map((id) => owners.find((o) => o.id === id))
    .filter(Boolean)
    .map(ownerLabel);
  const primaryName = ev.ownerName || (owner ? ownerLabel(owner) : null);
  const ownerName = coNames.length ? `${primaryName} · ${coNames.join(" · ")}` : primaryName;
  return {
    ...ev,
    coOwnerIds,
    ownerThemeColor: ev.ownerThemeColor || owner?.calendarThemeColor || "red",
    ownerName,
    isJoint: coOwnerIds.length > 0,
  };
}

export default function ScheduleTab() {
  const { user, token, localMode, isSuperAdmin } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [monthDirection, setMonthDirection] = useState(0);
  const [owners, setOwners] = useState([]);
  const [selfId, setSelfId] = useState(user?.id);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState([]);
  const [events, setEvents] = useState([]);
  const [themeColor, setThemeColor] = useState(user?.calendarThemeColor || null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const theme = getThemeById(themeColor || "red");
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedOwners = useMemo(
    () => owners.filter((o) => selectedOwnerIds.includes(o.id)),
    [owners, selectedOwnerIds]
  );

  const headerTitle = useMemo(() => filterTitle(selectedOwners), [selectedOwners]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!map[ev.eventDate]) map[ev.eventDate] = [];
      map[ev.eventDate].push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (!a.startTime && b.startTime) return -1;
        if (a.startTime && !b.startTime) return 1;
        if (!a.startTime && !b.startTime) return a.id - b.id;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return map;
  }, [events]);

  const dayEvents = dayOpen ? eventsByDate[dayOpen.dateKey] || [] : [];

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
        MOCK_EVENTS.filter((e) => eventMatchesOwners(e, selectedOwnerIds)).map((e) =>
          enrichEvent(e, MOCK_OWNERS)
        )
      );
      return;
    }
    const data = await api(
      `/calendar/events?ownerIds=${selectedOwnerIds.join(",")}&year=${viewYear}&month=${viewMonth}`,
      { token }
    );
    setEvents((data.items || []).map((e) => enrichEvent(e, owners)));
  }, [token, localMode, selectedOwnerIds, viewYear, viewMonth, owners]);

  const loadTheme = useCallback(async () => {
    const themeOwnerId = selfId ?? user.id;
    if (localMode) {
      const owner = MOCK_OWNERS.find((o) => o.id === themeOwnerId) || MOCK_OWNERS[0];
      setThemeColor(owner.calendarThemeColor || "red");
      return;
    }
    const data = await api(`/calendar/theme?ownerId=${themeOwnerId}`, { token });
    setThemeColor(data.themeColor);
    if (!data.themeColor) setThemeOpen(true);
  }, [token, localMode, selfId, user.id]);

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
        await Promise.all([loadEvents(), loadTheme()]);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedOwnerIds, viewYear, viewMonth, loadEvents, loadTheme]);

  const shiftMonth = (delta) => {
    setMonthDirection(delta);
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

  const saveTheme = async (colorId) => {
    setThemeColor(colorId);
    setThemeOpen(false);
    if (localMode) return;
    try {
      await api("/calendar/theme", {
        method: "PUT",
        token,
        body: { themeColor: colorId, ownerId: selfId },
      });
    } catch (e) {
      setErr(e.message);
    }
  };

  const openAdd = (dateKey) => {
    const defaultSelf = selfId ?? user.id;
    setForm(blankForm(dateKey || toDateKey(today), defaultSelf));
    setAddOpen(true);
  };

  const closeAddModal = () => {
    setAddOpen(false);
    setForm(blankForm());
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setErr("일정명을 입력해주세요.");
    if (form.earnsMoney && !form.incomeType) {
      return setErr("유형을 선택해주세요.");
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ownerIds: form.ownerIds.length ? form.ownerIds : [selfId ?? user.id],
        title,
        description: form.description.trim(),
        eventDate: form.eventDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        incomeType: form.earnsMoney ? form.incomeType || null : null,
        spanDays: form.spanDays,
        repeatWeeks: form.repeatWeeks,
      };

      if (localMode) {
        const dates = expandEventDates(form.eventDate, form.spanDays, form.repeatWeeks);
        const primaryOwner = owners.find((o) => o.id === payload.ownerIds[0]) || owners[0];
        const coOwnerIds = payload.ownerIds.slice(1);
        const items = dates.map((eventDate, i) => ({
          id: Date.now() + i,
          ownerId: payload.ownerIds[0],
          coOwnerIds,
          ownerThemeColor: primaryOwner?.calendarThemeColor || "red",
          title,
          description: form.description.trim(),
          eventDate,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          incomeType: payload.incomeType,
        }));
        setEvents((prev) => [...prev, ...items.map((item) => enrichEvent(item, owners))]);
      } else {
        await api("/calendar/events", {
          method: "POST",
          token,
          body: payload,
        });
        await loadEvents();
      }
      closeAddModal();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id, editForm) => {
    const title = editForm.title.trim();
    if (!title) return setErr("일정명을 입력해주세요.");
    if (editForm.earnsMoney && !editForm.incomeType) {
      return setErr("유형을 선택해주세요.");
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ownerIds: editForm.ownerIds.length ? editForm.ownerIds : [selfId ?? user.id],
        title,
        description: editForm.description.trim(),
        eventDate: editForm.eventDate,
        startTime: editForm.startTime || null,
        endTime: editForm.endTime || null,
        incomeType: editForm.earnsMoney ? editForm.incomeType || null : null,
      };

      if (localMode) {
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === id
              ? enrichEvent(
                  {
                    ...ev,
                    ownerId: payload.ownerIds[0],
                    coOwnerIds: payload.ownerIds.slice(1),
                    ...payload,
                  },
                  owners
                )
              : ev
          )
        );
      } else {
        await api(`/calendar/events/${id}`, {
          method: "PUT",
          token,
          body: payload,
        });
        await loadEvents();
      }
    } catch (e) {
      setErr(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    if (localMode) {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      return;
    }
    try {
      await api(`/calendar/events/${id}`, { method: "DELETE", token });
      await loadEvents();
    } catch (e) {
      setErr(e.message);
    }
  };

  const monthLabel = `${viewYear}년 ${viewMonth}월`;
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
            <span className="schedule__owner-name">{headerTitle}</span>
            {canPickOwner && <span className="schedule__title-caret">{filterOpen ? "▴" : "▾"}</span>}
          </button>
        </div>

        <div className="schedule__toolbar-right">
          <button
            type="button"
            className="schedule__theme-btn"
            onClick={() => setThemeOpen((v) => !v)}
            aria-label="테마 색상"
          >
            <span className="schedule__theme-dot" style={{ background: theme.accent }} />
            테마
          </button>
          <button type="button" className="btn btn-accent schedule__add-btn" onClick={() => openAdd(todayKey)}>
            ＋ 추가
          </button>
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
        {themeOpen && (
          <motion.div
            className="schedule__theme-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="schedule__theme-label">달력 테마 색상</p>
            <div className="schedule__theme-swatches">
              {CALENDAR_THEME_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`schedule__swatch ${themeColor === c.id ? "is-active" : ""}`}
                  style={{ "--swatch": c.accent }}
                  onClick={() => saveTheme(c.id)}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
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
        <div className="schedule__calendar">
          <div className="schedule__weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d} className="schedule__weekday">
                {d}
              </span>
            ))}
          </div>
          <div className="schedule__calendar-viewport">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${viewYear}-${viewMonth}`}
                className="schedule__calendar-swipe"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.14}
                onDragEnd={(_, info) => {
                  if (info.offset.x <= -72) shiftMonth(1);
                  else if (info.offset.x >= 72) shiftMonth(-1);
                }}
                initial={{
                  opacity: 0,
                  x: monthDirection > 0 ? 72 : monthDirection < 0 ? -72 : 0,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: monthDirection > 0 ? -72 : monthDirection < 0 ? 72 : 0,
                }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="schedule__grid">
                  {grid.map((date, idx) => {
                    if (!date) {
                      return <div key={`empty-${idx}`} className="schedule__cell schedule__cell--empty" />;
                    }
                    const key = toDateKey(date);
                    const cellEvents = eventsByDate[key] || [];
                    const isToday = key === todayKey;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <DayCell
                        key={key}
                        date={date}
                        events={cellEvents}
                        owners={owners}
                        isToday={isToday}
                        isWeekend={isWeekend}
                        onOpenDay={() => setDayOpen({ dateKey: key })}
                      />
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <EventModal
            form={form}
            setForm={setForm}
            busy={busy}
            owners={owners}
            selfId={selfId ?? user.id}
            onClose={closeAddModal}
            onSubmit={submitAdd}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dayOpen && (
          <DayModal
            dateKey={dayOpen.dateKey}
            events={dayEvents}
            owners={owners}
            selfId={selfId ?? user.id}
            busy={busy}
            onClose={() => setDayOpen(null)}
            onSave={saveEdit}
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

function EventBubble({ event, owners, showTime }) {
  const eventTheme = getEventTheme(event, owners);
  const paid = Boolean(event.incomeType);
  const style = eventTheme.isJoint
    ? {
        "--cal-accent": eventTheme.accent,
        background: eventTheme.gradient,
        borderImage: `${eventTheme.borderGradient} 1`,
      }
    : { "--cal-accent": eventTheme.accent };

  return (
    <span
      className={`schedule__bubble ${eventTheme.isJoint ? "schedule__bubble--joint" : ""}`}
      style={style}
      role="presentation"
    >
      {paid && <span className="schedule__coin" aria-hidden>{COIN_ICON}</span>}
      {showTime && event.startTime && (
        <span className="schedule__bubble-time">{formatEventTime(event)}</span>
      )}
      <span className="schedule__bubble-title">{event.title}</span>
    </span>
  );
}

function DayCell({ date, events, owners, isToday, isWeekend, onOpenDay }) {
  const maxVisibleDesktop = 5;
  const maxVisibleMobile = 3;
  const visibleDesktop = events.slice(0, maxVisibleDesktop);
  const hiddenCount = Math.max(0, events.length - maxVisibleDesktop);

  return (
    <button
      type="button"
      className={`schedule__cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""}`}
      onClick={onOpenDay}
      aria-label={`${date.getDate()}일`}
    >
      <span className="schedule__day-num">{date.getDate()}</span>
      <div className="schedule__bubbles schedule__bubbles--desktop">
        {visibleDesktop.map((ev) => (
          <EventBubble key={ev.id} event={ev} owners={owners} showTime />
        ))}
        {hiddenCount > 0 && <span className="schedule__more">+{hiddenCount}</span>}
      </div>
      <div className="schedule__bubbles schedule__bubbles--mobile">
        {events.slice(0, maxVisibleMobile).map((ev) => (
          <EventBubble key={ev.id} event={ev} owners={owners} showTime={false} />
        ))}
        {events.length > maxVisibleMobile && (
          <span className="schedule__more">+{events.length - maxVisibleMobile}</span>
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

function OwnerPicker({ ownerIds, owners, selfId, onChange }) {
  const available = owners.filter((o) => !ownerIds.includes(o.id));

  const removeOwner = (id) => {
    if (id === selfId && ownerIds.length === 1) return;
    const next = ownerIds.filter((oid) => oid !== id);
    if (!next.includes(selfId)) next.unshift(selfId);
    onChange(next);
  };

  const addOwner = (id) => {
    if (ownerIds.includes(id)) return;
    onChange([...ownerIds, id]);
  };

  return (
    <div className="schedule__joint-owners">
      <p className="schedule__joint-label">{jointOwnerTitle(ownerIds, owners)}</p>
      <div className="schedule__joint-selected">
        {ownerIds.map((id) => {
          const owner = owners.find((o) => o.id === id);
          if (!owner) return null;
          const chipTheme = getThemeById(owner.calendarThemeColor || "red");
          const isSelf = id === selfId;
          return (
            <button
              key={id}
              type="button"
              className={`schedule__joint-chip ${isSelf ? "is-self" : ""}`}
              style={{ "--chip-accent": chipTheme.accent }}
              onClick={() => !isSelf && removeOwner(id)}
              disabled={isSelf}
            >
              {ownerLabel(owner)}
              {!isSelf && <span aria-hidden> ✕</span>}
            </button>
          );
        })}
      </div>
      {available.length > 0 && (
        <div className="schedule__joint-add">
          <span className="schedule__joint-add-label">함께하는 사람</span>
          <div className="schedule__joint-add-list">
            {available.map((o) => {
              const chipTheme = getThemeById(o.calendarThemeColor || "red");
              return (
                <button
                  key={o.id}
                  type="button"
                  className="schedule__joint-add-btn"
                  style={{ "--chip-accent": chipTheme.accent }}
                  onClick={() => addOwner(o.id)}
                >
                  ＋ {ownerLabel(o)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EarnMoneyField({ earnsMoney, incomeType, onChangeEarns, onChangeType }) {
  return (
    <div className="schedule__earn-field">
      <div className="schedule__earn-head">
        <span>돈을 벌러 가나요?</span>
        <div className="schedule__yesno">
          <button
            type="button"
            className={`schedule__yesno-btn ${!earnsMoney ? "is-active" : ""}`}
            onClick={() => onChangeEarns(false)}
          >
            NO
          </button>
          <button
            type="button"
            className={`schedule__yesno-btn ${earnsMoney ? "is-active" : ""}`}
            onClick={() => onChangeEarns(true)}
          >
            YES
          </button>
        </div>
      </div>
      {earnsMoney && (
        <div className="schedule__income-types">
          {INCOME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`schedule__income-btn ${incomeType === opt.id ? "is-active" : ""}`}
              onClick={() => onChangeType(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EventModal({ form, setForm, busy, owners, selfId, onClose, onSubmit }) {
  const spanOptions = useMemo(
    () => Array.from({ length: MAX_SPAN_DAYS }, (_, i) => i + 1),
    []
  );
  const weekOptions = useMemo(
    () => Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1),
    []
  );

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
          <h3>일정 추가</h3>
          <button type="button" className="schedule__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <form className="schedule__form" onSubmit={onSubmit}>
          <OwnerPicker
            ownerIds={form.ownerIds}
            owners={owners}
            selfId={selfId}
            onChange={(ownerIds) => setForm((f) => ({ ...f, ownerIds }))}
          />

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
              onChange={(e) => setForm((f) => ({ ...f, spanDays: Number(e.target.value) }))}
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
              onChange={(e) => setForm((f) => ({ ...f, repeatWeeks: Number(e.target.value) }))}
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

          <div className="schedule__time-row">
            <div className="field">
              <label htmlFor="ev-start">시작 (선택)</label>
              <input
                id="ev-start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-end">종료 (선택)</label>
              <input
                id="ev-end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <p className="schedule__hint">시간을 비우면 종일 일정으로 저장됩니다.</p>

          <EarnMoneyField
            earnsMoney={form.earnsMoney}
            incomeType={form.incomeType}
            onChangeEarns={(earnsMoney) =>
              setForm((f) => ({
                ...f,
                earnsMoney,
                incomeType: earnsMoney ? f.incomeType : "",
              }))
            }
            onChangeType={(incomeType) => setForm((f) => ({ ...f, incomeType }))}
          />

          <div className="schedule__modal-actions">
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

function DayModal({ dateKey, events, owners, selfId, busy, onClose, onSave, onDelete, onAdd }) {
  const [y, m, d] = dateKey.split("-");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blankForm);

  const startEdit = (ev) => {
    setEditingId(ev.id);
    setEditForm(formFromEvent(ev, selfId));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(blankForm());
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      await onSave(editingId, editForm);
      cancelEdit();
    } catch {
      /* error surfaced by parent */
    }
  };

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
            events.map((ev) => {
              const eventTheme = getEventTheme(ev, owners);
              const isEditing = editingId === ev.id;

              if (isEditing) {
                return (
                  <form key={ev.id} className="schedule__day-edit" onSubmit={submitEdit}>
                    <OwnerPicker
                      ownerIds={editForm.ownerIds}
                      owners={owners}
                      selfId={selfId}
                      onChange={(ownerIds) => setEditForm((f) => ({ ...f, ownerIds }))}
                    />
                    <div className="field">
                      <label>일정명</label>
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="field schedule__field-desc">
                      <label>세부설명</label>
                      <AutoGrowTextarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="메모"
                      />
                    </div>
                    <div className="schedule__time-row">
                      <div className="field">
                        <label>시작</label>
                        <input
                          type="time"
                          value={editForm.startTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label>종료</label>
                        <input
                          type="time"
                          value={editForm.endTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                        />
                      </div>
                    </div>
                    <EarnMoneyField
                      earnsMoney={editForm.earnsMoney}
                      incomeType={editForm.incomeType}
                      onChangeEarns={(earnsMoney) =>
                        setEditForm((f) => ({
                          ...f,
                          earnsMoney,
                          incomeType: earnsMoney ? f.incomeType : "",
                        }))
                      }
                      onChangeType={(incomeType) => setEditForm((f) => ({ ...f, incomeType }))}
                    />
                    <div className="schedule__day-edit-actions">
                      <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                        취소
                      </button>
                      <button type="submit" className="btn btn-accent" disabled={busy}>
                        {busy ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={ev.id}
                  className={`schedule__day-item ${eventTheme.isJoint ? "schedule__day-item--joint" : ""}`}
                  style={
                    eventTheme.isJoint
                      ? {
                          borderImage: `${eventTheme.borderGradient} 1`,
                          background: `linear-gradient(120deg, color-mix(in srgb, ${eventTheme.accent} 10%, transparent), rgba(255,255,255,0.03))`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`schedule__day-item-dot ${eventTheme.isJoint ? "schedule__day-item-dot--joint" : ""}`}
                    style={
                      eventTheme.isJoint
                        ? { background: eventTheme.borderGradient }
                        : { background: eventTheme.accent }
                    }
                    aria-hidden
                  />
                  <div className="schedule__day-item-main">
                    <strong>
                      {ev.incomeType && <span className="schedule__coin">{COIN_ICON}</span>}
                      {ev.title}
                    </strong>
                    {ev.ownerName && (
                      <span className="schedule__day-item-owner">
                        {ev.isJoint ? `${ev.ownerName} · 공동명의` : ev.ownerName}
                      </span>
                    )}
                    <span className="schedule__day-item-time">{formatEventTime(ev)}</span>
                    {ev.description && <p>{ev.description}</p>}
                  </div>
                  <div className="schedule__day-item-actions">
                    <button type="button" className="btn btn-ghost schedule__day-edit-btn" onClick={() => startEdit(ev)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost schedule__day-delete-btn"
                      onClick={() => onDelete(ev.id)}
                    >
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
