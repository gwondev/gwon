import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  CALENDAR_THEME_COLORS,
  INCOME_OPTIONS,
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
    title: "포트폴리오 점검",
    description: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "14:00",
    endTime: null,
    incomeType: null,
  },
];

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

function ownerLabel(o) {
  return o.nickname || o.name || o.email || `#${o.id}`;
}

function blankForm(dateKey = "") {
  return {
    title: "",
    description: "",
    eventDate: dateKey,
    startTime: "",
    endTime: "",
    incomeType: "",
    repeatWeekly: false,
    repeatWeeks: 4,
  };
}

function expandWeeklyDates(startKey, weeks) {
  if (!startKey || !/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return [];
  const [y, m, d] = startKey.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const count = Math.min(Math.max(Number(weeks) || 1, 1), 52);
  const dates = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i * 7);
    dates.push(toDateKey(dt));
  }
  return dates;
}

export default function ScheduleTab() {
  const { user, token, localMode, isSuperAdmin } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [ownerId, setOwnerId] = useState(user?.id);
  const [owners, setOwners] = useState([]);
  const [events, setEvents] = useState([]);
  const [themeColor, setThemeColor] = useState(user?.calendarThemeColor || null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const theme = getThemeById(themeColor || "red");
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

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

  const loadOwners = useCallback(async () => {
    if (localMode) {
      setOwners(MOCK_OWNERS);
      setOwnerId(user.id);
      return;
    }
    const data = await api("/calendar/owners", { token });
    setOwners(data.items || []);
    setOwnerId(data.selfId);
  }, [token, localMode, user.id]);

  const loadEvents = useCallback(async () => {
    if (localMode) {
      setEvents(MOCK_EVENTS.filter((e) => e.ownerId === (ownerId ?? user.id)));
      return;
    }
    const data = await api(
      `/calendar/events?ownerId=${ownerId}&year=${viewYear}&month=${viewMonth}`,
      { token }
    );
    setEvents(data.items || []);
  }, [token, localMode, ownerId, viewYear, viewMonth, user.id]);

  const loadTheme = useCallback(async () => {
    if (localMode) {
      const owner = MOCK_OWNERS.find((o) => o.id === ownerId) || MOCK_OWNERS[0];
      setThemeColor(owner.calendarThemeColor || "red");
      return;
    }
    const data = await api(`/calendar/theme?ownerId=${ownerId}`, { token });
    setThemeColor(data.themeColor);
    if (!data.themeColor) setThemeOpen(true);
  }, [token, localMode, ownerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadOwners();
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadOwners]);

  useEffect(() => {
    if (ownerId == null) return;
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
  }, [ownerId, viewYear, viewMonth, loadEvents, loadTheme]);

  const shiftMonth = (delta) => {
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

  const saveTheme = async (colorId) => {
    setThemeColor(colorId);
    setThemeOpen(false);
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
    setForm(blankForm(dateKey || toDateKey(today)));
    setAddOpen(true);
  };

  const submitEvent = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setErr("일정명을 입력해주세요.");
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ownerId,
        title,
        description: form.description.trim(),
        eventDate: form.eventDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        incomeType: form.incomeType || null,
        repeatWeekly: form.repeatWeekly,
        repeatWeeks: form.repeatWeekly ? form.repeatWeeks : 1,
      };

      if (localMode) {
        const dates = form.repeatWeekly
          ? expandWeeklyDates(form.eventDate, form.repeatWeeks)
          : [form.eventDate];
        const items = dates.map((eventDate, i) => ({
          id: Date.now() + i,
          ownerId,
          title,
          description: form.description.trim(),
          eventDate,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          incomeType: form.incomeType || null,
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
      setAddOpen(false);
      setForm(blankForm());
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!isSuperAdmin) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    if (localMode) {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      return;
    }
    try {
      await api(`/calendar/events/${id}`, { method: "DELETE", token });
      await loadEvents();
      setDayOpen(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  const monthLabel = `${viewYear}년 ${viewMonth}월`;
  const todayKey = toDateKey(today);

  return (
    <div
      className="schedule"
      style={{ "--cal-accent": theme.accent }}
    >
      <div className="schedule__toolbar">
        <div className="schedule__toolbar-left">
          {isSuperAdmin && owners.length > 1 ? (
            <label className="schedule__owner">
              <span>명의</span>
              <select
                value={ownerId ?? ""}
                onChange={(e) => setOwnerId(Number(e.target.value))}
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {ownerLabel(o)}
                    {o.role === "SUPER_ADMIN" ? " (SUPER)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="schedule__owner-name">{ownerLabel(user)} 일정</span>
          )}
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
                  onAdd={() => openAdd(key)}
                  onExpand={() => setDayOpen({ dateKey: key, events: dayEvents })}
                />
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <EventModal
            title="일정 추가"
            form={form}
            setForm={setForm}
            busy={busy}
            theme={theme}
            onClose={() => setAddOpen(false)}
            onSubmit={submitEvent}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dayOpen && (
          <DayModal
            dateKey={dayOpen.dateKey}
            events={dayOpen.events}
            isSuperAdmin={isSuperAdmin}
            onClose={() => setDayOpen(null)}
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

function EventBubble({ event, showTime, onClick }) {
  const paid = Boolean(event.incomeType);
  return (
    <span className="schedule__bubble" onClick={onClick} role="presentation">
      {paid && <span className="schedule__money" aria-hidden>💰</span>}
      {showTime && event.startTime && (
        <span className="schedule__bubble-time">{formatEventTime(event)}</span>
      )}
      <span className="schedule__bubble-title">{event.title}</span>
    </span>
  );
}

function DayCell({ date, events, isToday, isWeekend, onAdd, onExpand }) {
  const maxVisibleDesktop = 5;
  const maxVisibleMobile = 3;
  const visibleDesktop = events.slice(0, maxVisibleDesktop);
  const hiddenCount = Math.max(0, events.length - maxVisibleDesktop);

  return (
    <button
      type="button"
      className={`schedule__cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""}`}
      onClick={onAdd}
      aria-label={`${date.getDate()}일`}
    >
      <span className="schedule__day-num">{date.getDate()}</span>
      <div className="schedule__bubbles schedule__bubbles--desktop">
        {visibleDesktop.map((ev) => (
          <EventBubble
            key={ev.id}
            event={ev}
            showTime
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          />
        ))}
        {hiddenCount > 0 && (
          <span
            className="schedule__more"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            +{hiddenCount}
          </span>
        )}
      </div>
      <div className="schedule__bubbles schedule__bubbles--mobile">
        {events.slice(0, maxVisibleMobile).map((ev) => (
          <EventBubble
            key={ev.id}
            event={ev}
            showTime={false}
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          />
        ))}
        {events.length > maxVisibleMobile && (
          <span
            className="schedule__more"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            +{events.length - maxVisibleMobile}
          </span>
        )}
      </div>
    </button>
  );
}

function EventModal({ title, form, setForm, busy, theme, onClose, onSubmit }) {
  const repeatDates = useMemo(() => {
    if (!form.repeatWeekly) return form.eventDate ? [form.eventDate] : [];
    return expandWeeklyDates(form.eventDate, form.repeatWeeks);
  }, [form.eventDate, form.repeatWeekly, form.repeatWeeks]);

  const pickerMonth = useMemo(() => {
    if (!form.eventDate) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const [y, m] = form.eventDate.split("-").map(Number);
    return { year: y, month: m };
  }, [form.eventDate]);

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
          <div className="field">
            <label htmlFor="ev-desc">세부설명 (선택)</label>
            <textarea
              id="ev-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="메모"
            />
          </div>
          <div className="field">
            <label htmlFor="ev-date">날짜</label>
            <input
              id="ev-date"
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
              required
            />
          </div>

          <MiniMonthPicker
            year={pickerMonth.year}
            month={pickerMonth.month}
            selectedDates={repeatDates}
            accent={theme.accent}
            onPick={(dateKey) => setForm((f) => ({ ...f, eventDate: dateKey }))}
          />

          <label className="schedule__repeat-check">
            <input
              type="checkbox"
              checked={form.repeatWeekly}
              onChange={(e) =>
                setForm((f) => ({ ...f, repeatWeekly: e.target.checked }))
              }
            />
            매주 반복
          </label>

          {form.repeatWeekly && (
            <div className="schedule__repeat-weeks field">
              <label htmlFor="ev-weeks">반복 주 수</label>
              <input
                id="ev-weeks"
                type="number"
                min={1}
                max={52}
                value={form.repeatWeeks}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    repeatWeeks: Math.min(52, Math.max(1, Number(e.target.value) || 1)),
                  }))
                }
              />
              <p className="schedule__hint">
                시작일 기준 {form.repeatWeeks}주 동안 매주 같은 요일에 등록됩니다.
              </p>
            </div>
          )}

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
          <fieldset className="schedule__income">
            <legend>유형 (선택)</legend>
            <div className="schedule__income-options">
              {INCOME_OPTIONS.map((opt) => (
                <label key={opt.id} className="schedule__income-opt">
                  <input
                    type="radio"
                    name="incomeType"
                    checked={form.incomeType === opt.id}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        incomeType: f.incomeType === opt.id ? "" : opt.id,
                      }))
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
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

function MiniMonthPicker({ year, month, selectedDates, accent, onPick }) {
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const todayKey = toDateKey(new Date());

  return (
    <div className="schedule__mini-cal">
      <p className="schedule__mini-cal-label">
        {year}년 {month}월
      </p>
      <div className="schedule__mini-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="schedule__mini-grid">
        {grid.map((date, idx) => {
          if (!date) {
            return <span key={`e-${idx}`} className="schedule__mini-cell schedule__mini-cell--empty" />;
          }
          const key = toDateKey(date);
          const isSelected = selectedSet.has(key);
          const isStart = key === selectedDates[0];
          return (
            <button
              key={key}
              type="button"
              className={`schedule__mini-cell ${isSelected ? "is-selected" : ""} ${isStart ? "is-start" : ""} ${key === todayKey ? "is-today" : ""}`}
              style={isSelected ? { "--mini-accent": accent } : undefined}
              onClick={() => onPick(key)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayModal({ dateKey, events, isSuperAdmin, onClose, onDelete, onAdd }) {
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
          <button type="button" className="schedule__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="schedule__day-list">
          {events.length === 0 ? (
            <p className="schedule__empty">등록된 일정이 없습니다.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="schedule__day-item">
                <div className="schedule__day-item-main">
                  <strong>
                    {ev.incomeType && <span className="schedule__money">💰</span>}
                    {ev.title}
                  </strong>
                  <span className="schedule__day-item-time">{formatEventTime(ev)}</span>
                  {ev.description && <p>{ev.description}</p>}
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className="schedule__day-del"
                    onClick={() => onDelete(ev.id)}
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="schedule__modal-actions">
          <button type="button" className="btn btn-accent" onClick={onAdd}>
            ＋ 일정 추가
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
