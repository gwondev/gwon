import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  dedupeEventsBySeries,
  effectiveEventTimes,
  eventSeriesKey,
  expandOccurrences,
  isContinuousMultiDay,
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
import { getDayInfo } from "../lib/holidays";
import ScheduleChecklist from "./ScheduleChecklist";
import "./ScheduleTab.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const MOCK_OWNERS = [
  { id: 0, name: "이성권", nickname: "이성권", role: "SUPER_ADMIN", calendarThemeColor: "red" },
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
    appointmentType: null,
  },
  {
    id: 2,
    ownerId: 0,
    title: "팀 미팅",
    description: "",
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: null,
    incomeType: null,
    appointmentType: "DATE",
  },
];

// 'TODO' 는 오른쪽 할 일 목록과 연동되는 내장 키워드. 항상 선택 가능하게 유지한다.
const TODO_KEYWORD = { id: "TODO", emoji: "✅", label: "할 일", color: "red" };

const DEFAULT_KEYWORDS = [
  { ...TODO_KEYWORD },
  { id: "DATE", emoji: "💕", label: "데이트", color: "pink" },
];

function withTodoKeyword(list) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.some((k) => k && k.id === "TODO")) return arr;
  return [{ ...TODO_KEYWORD }, ...arr];
}

const KEYWORDS_STORAGE_KEY = "gwon.calendar.keywords";
const EMOJI_HISTORY_STORAGE_KEY = "gwon.calendar.emojiHistory";

const DEFAULT_EMOJI_HISTORY = [
  "💰", "🍻", "🎓", "💕", "✈️", "🎉", "📚", "🏋️",
  "🎮", "🎬", "🍽️", "☕", "🏠", "💼", "🩺", "🎂",
  "🚗", "🛒", "📅", "⭐", "🎵", "🐶", "🌱", "🧘",
];

const KeywordsContext = createContext([]);

function useKeywords() {
  return useContext(KeywordsContext);
}

function resolveKeywordId(event) {
  return event?.appointmentType || (event?.incomeType ? "MONEY" : "");
}

function keywordOf(keywords, id) {
  return keywords.find((k) => k.id === id) || null;
}

function keywordBadge(keywords, id) {
  const kw = keywordOf(keywords, id);
  if (!kw) return "";
  return kw.emoji ? `${kw.emoji} ${kw.label}` : kw.label;
}

function makeKeywordId() {
  return `KW${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

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

function minuteToTime(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function dayDiff(fromKey, toKey) {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// 저장 전에 날짜·시간 순서를 검사한다. 문제가 없으면 null.
function formRangeError(form) {
  if (!DATE_KEY_RE.test(form.eventDate || "")) return "시작 날짜를 선택해주세요.";
  if (form.repeatOn) {
    if (form.repeatUntil && form.repeatUntil < form.eventDate) {
      return "반복 종료일은 시작 날짜와 같거나 이후여야 합니다.";
    }
    return null;
  }
  if (form.endDate && form.endDate < form.eventDate) {
    return "종료 날짜는 시작 날짜와 같거나 이후여야 합니다.";
  }
  const sameDay = !form.endDate || form.endDate === form.eventDate;
  if (!form.allDay && sameDay) {
    const s = timeToMinute(form.startTime);
    const e = timeToMinute(form.endTime);
    if (s != null && e != null && e <= s) return "종료 시간은 시작 시간보다 뒤로 설정해주세요.";
  }
  return null;
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

function blankForm(dateKey = "") {
  const start = dateKey || "";
  return {
    title: "",
    description: "",
    eventDate: start,
    allDay: false,
    startTime: "09:00",
    endTime: "18:00",
    endDate: start,
    appointmentType: "",
    themeColor: "gray",
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
    title: ev.title || "",
    description: ev.description || "",
    eventDate: start,
    allDay,
    startTime: ev.startTime || "09:00",
    endTime: ev.endTime || "18:00",
    endDate: repeat ? start : (ev.seriesEndDate || ev.eventDate || start),
    appointmentType: ev.appointmentType || (ev.incomeType ? "MONEY" : ""),
    themeColor: ev.themeColor || "gray",
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

function enrichEvent(ev) {
  return {
    ...ev,
    themeColor: ev.themeColor || "gray",
  };
}

export default function ScheduleTab() {
  const { user, token, localMode } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [owners, setOwners] = useState([]);
  const [events, setEvents] = useState([]);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [emojiHistory, setEmojiHistory] = useState(DEFAULT_EMOJI_HISTORY);
  const [themeColor, setThemeColor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [dayOpen, setDayOpen] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [monthDir, setMonthDir] = useState(0);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSeriesKeys, setSelectedSeriesKeys] = useState(() => new Set());
  // 이벤트가 갱신될 때마다 오른쪽 할 일 목록(달력 TODO)도 다시 불러오게 하는 신호
  const [calVersion, setCalVersion] = useState(0);
  const touchStartRef = useRef(null);

  const theme = getThemeById(themeColor || "red");
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // 이건 이성권 개인 캘린더다. 로그인한 관리자가 누구든 모든 일정은 항상 이 한 사람 것으로 저장한다.
  const ownerId = useMemo(() => {
    const superAdmin = owners.find((o) => o.role === "SUPER_ADMIN");
    return superAdmin?.id ?? owners[0]?.id ?? user.id;
  }, [owners, user.id]);

  const displayEvents = useMemo(() => events.map((e) => enrichEvent(e)), [events]);

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
      return MOCK_OWNERS;
    }
    const data = await api("/calendar/owners", { token });
    setOwners(data.items || []);
    return data.items || [];
  }, [token, localMode]);

  const loadEvents = useCallback(async () => {
    if (localMode) {
      setEvents(MOCK_EVENTS.map((e) => enrichEvent(e)));
      setCalVersion((v) => v + 1);
      return;
    }
    const data = await api(
      `/calendar/events?ownerIds=${ownerId}&year=${viewYear}&month=${viewMonth}`,
      { token }
    );
    setEvents((data.items || []).map((e) => enrichEvent(e)));
    setCalVersion((v) => v + 1);
  }, [token, localMode, ownerId, viewYear, viewMonth]);

  const loadKeywords = useCallback(async () => {
    if (localMode) {
      try {
        const raw = localStorage.getItem(KEYWORDS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        setKeywords(withTodoKeyword(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_KEYWORDS));
      } catch {
        setKeywords(withTodoKeyword(DEFAULT_KEYWORDS));
      }
      return;
    }
    const data = await api("/calendar/keywords", { token });
    setKeywords(withTodoKeyword(data.items?.length ? data.items : DEFAULT_KEYWORDS));
  }, [token, localMode]);

  const saveKeywords = useCallback(
    async (items) => {
      const withTodo = withTodoKeyword(items);
      setKeywords(withTodo);
      if (localMode) {
        localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(withTodo));
        return;
      }
      const data = await api("/calendar/keywords", {
        method: "PUT",
        token,
        body: { items: withTodo },
      });
      setKeywords(withTodoKeyword(data.items || withTodo));
    },
    [token, localMode]
  );

  const loadEmojiHistory = useCallback(async () => {
    if (localMode) {
      try {
        const raw = localStorage.getItem(EMOJI_HISTORY_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        setEmojiHistory(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_EMOJI_HISTORY);
      } catch {
        setEmojiHistory(DEFAULT_EMOJI_HISTORY);
      }
      return;
    }
    const data = await api("/calendar/emoji-history", { token });
    setEmojiHistory(data.items?.length ? data.items : DEFAULT_EMOJI_HISTORY);
  }, [token, localMode]);

  const registerEmoji = useCallback(
    (emoji) => {
      const trimmed = (emoji || "").trim();
      if (!trimmed) return;
      setEmojiHistory((prev) => {
        if (prev.includes(trimmed)) return prev;
        const next = [...prev, trimmed];
        if (localMode) {
          localStorage.setItem(EMOJI_HISTORY_STORAGE_KEY, JSON.stringify(next));
        } else {
          api("/calendar/emoji-history", { method: "PUT", token, body: { items: next } }).catch(() => {});
        }
        return next;
      });
    },
    [token, localMode]
  );

  useEffect(() => {
    const owner = owners.find((o) => o.id === ownerId);
    if (owner) setThemeColor(owner.calendarThemeColor || null);
  }, [owners, ownerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        await Promise.all([loadOwners(), loadKeywords(), loadEmojiHistory()]);
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadOwners, loadKeywords, loadEmojiHistory]);

  useEffect(() => {
    if (!ownerId) return;
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
  }, [ownerId, viewYear, viewMonth, loadEvents]);

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

  const openAdd = (dateKey) => {
    setEditId(null);
    setForm(blankForm(dateKey || toDateKey(today)));
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
    const rangeError = formRangeError(form);
    if (rangeError) return setErr(rangeError);
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

    try {
      if (editId != null) {
        const payload = {
          title,
          description: form.description.trim(),
          eventDate: form.eventDate,
          startTime,
          endTime,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          themeColor: form.themeColor || "gray",
          ownerIds: [ownerId],
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
        const payload = {
          ownerIds: [ownerId],
          title,
          description: form.description.trim(),
          eventDate: form.eventDate,
          startTime,
          endTime,
          incomeType: form.appointmentType === "MONEY" ? "WORK" : null,
          appointmentType: form.appointmentType || null,
          themeColor: form.themeColor || "gray",
          endDate,
          repeat,
        };

        if (localMode) {
          const dates = expandOccurrences({ startDate: form.eventDate, endDate, repeat });
          const seriesId = `local-${Date.now()}`;
          const seriesStartDate = dates[0];
          const seriesEndDate = dates[dates.length - 1];
          const items = dates.map((eventDate, i) => ({
            id: Date.now() + i,
            ownerId,
            themeColor: form.themeColor || "gray",
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

  return (
    <KeywordsContext.Provider value={keywords}>
    <div className="schedule" style={{ "--cal-accent": theme.accent }}>
      <div className="schedule__layout">
      <div className="schedule__calendar-col">
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
                const isSunday = date.getDay() === 0;
                const isSaturday = date.getDay() === 6;
                const isWeekend = isSunday || isSaturday;

                return (
                  <DayCell
                    key={key}
                    date={date}
                    events={dayEvents}
                    isToday={isToday}
                    isWeekend={isWeekend}
                    isSunday={isSunday}
                    isSaturday={isSaturday}
                    dateKey={key}
                    seriesDateSet={seriesDateSet}
                    deleteMode={deleteMode}
                    selectedSeriesKeys={selectedSeriesKeys}
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
      </div>

      <ScheduleChecklist
        ownerId={ownerId}
        calendarVersion={calVersion}
        onCalendarChanged={loadEvents}
      />
      </div>

      <AnimatePresence>
        {addOpen && (
          <EventModal
            title={editId != null ? "일정 수정" : "일정 추가"}
            form={form}
            setForm={setForm}
            busy={busy}
            isEdit={editId != null}
            onClose={closeModal}
            onSubmit={submitEvent}
            onDelete={editId != null ? () => deleteEvent(editId) : null}
            onSaveKeywords={saveKeywords}
            emojiHistory={emojiHistory}
            onUseEmoji={registerEmoji}
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
    </KeywordsContext.Provider>
  );
}

function EventTitleDisplay({ event, className = "" }) {
  const keywords = useKeywords();
  const kw = keywordOf(keywords, resolveKeywordId(event));
  return (
    <span className={className}>
      {kw?.emoji && <span className="schedule__title-emoji">{kw.emoji}</span>}
      {event.title}
    </span>
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
  const keywords = useKeywords();
  const bubbleTheme = getThemeById(eventThemeColorId(event, keywords));
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
      {showLabel && (
        <span className="schedule__bubble-title">
          <EventTitleDisplay event={event} />
        </span>
      )}
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
  isSunday,
  isSaturday,
  onOpenDay,
  seriesDateSet,
  deleteMode,
  selectedSeriesKeys,
  onToggleSelect,
}) {
  const maxVisible = 4;
  const uniqueEvents = dedupeEventsBySeries(events);
  const visible = uniqueEvents.slice(0, maxVisible);
  const hiddenCount = Math.max(0, uniqueEvents.length - maxVisible);
  const { holidayNames, minorNames } = getDayInfo(dateKey);
  const isHolidayDay = holidayNames.length > 0;
  const holidayLabel = holidayNames.join(", ");
  const minorLabel = minorNames.join(", ");

  return (
    <button
      type="button"
      className={`schedule__cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""} ${deleteMode ? "is-delete-mode" : ""}`}
      onClick={onOpenDay}
      aria-label={`${date.getDate()}일${holidayLabel ? `, ${holidayLabel}` : ""}`}
    >
      <div className="schedule__day-row">
        <span
          className={`schedule__day-num ${isSunday ? "is-sunday" : ""} ${isSaturday ? "is-saturday" : ""} ${isHolidayDay ? "is-holiday" : ""}`}
        >
          {date.getDate()}
        </span>
        {holidayLabel && (
          <span className="schedule__day-label schedule__day-label--holiday" title={holidayLabel}>
            {holidayLabel}
          </span>
        )}
        {!holidayLabel && minorLabel && (
          <span className="schedule__day-label schedule__day-label--minor" title={minorLabel}>
            {minorLabel}
          </span>
        )}
      </div>
      <div className="schedule__bubbles">
        {visible.map((ev) => {
          const seriesKey = eventSeriesKey(ev);
          const isDiscrete = !!ev.repeat?.freq;
          const prev = !isDiscrete && seriesDateSet.has(`${seriesKey}::${shiftDateKey(dateKey, -1)}`);
          const next = !isDiscrete && seriesDateSet.has(`${seriesKey}::${shiftDateKey(dateKey, 1)}`);
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
              selectable
              onClick={(e) => {
                e.stopPropagation();
                if (deleteMode) {
                  onToggleSelect(ev);
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

const CAL_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function MiniCalendar({ value, min, onChange }) {
  const sel = parseFormDate(value);
  const base = sel || parseFormDate(min) || new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [dir, setDir] = useState(0);

  const goMonth = (delta) => {
    setDir(delta);
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selKey = value;

  return (
    <div className="minical">
      <div className="minical__head">
        <button type="button" className="minical__nav" onClick={() => goMonth(-1)} aria-label="이전 달">‹</button>
        <span className="minical__title">{view.y}년 {view.m + 1}월</span>
        <button type="button" className="minical__nav" onClick={() => goMonth(1)} aria-label="다음 달">›</button>
      </div>
      <div className="minical__dow">
        {CAL_WEEKDAYS.map((w, i) => (
          <span key={w} className={`minical__dow-cell ${i === 0 ? "is-sun" : ""} ${i === 6 ? "is-sat" : ""}`}>{w}</span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${view.y}-${view.m}`}
          className="minical__grid"
          initial={{ opacity: 0, x: dir >= 0 ? 22 : -22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir >= 0 ? -22 : 22 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {cells.map((d, i) => {
            if (d == null) return <span key={`e${i}`} className="minical__cell is-empty" />;
            const key = `${view.y}-${pad2(view.m + 1)}-${pad2(d)}`;
            const dow = (firstDow + d - 1) % 7;
            const disabled = min && key < min;
            const isSel = key === selKey;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                className={`minical__cell ${isSel ? "is-sel" : ""} ${dow === 0 ? "is-sun" : ""} ${dow === 6 ? "is-sat" : ""}`}
                onClick={() => onChange(key)}
              >
                {d}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DateField({ value, min, onChange, placeholder = "날짜 선택" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="datefield">
      <button
        type="button"
        className={`datefield__btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value ? formatDateDot(value) : placeholder}</span>
        <span className="datefield__chevron" aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="datefield__pop"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <MiniCalendar
              value={value}
              min={min}
              onChange={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimeSelect({ value, onChange }) {
  const [h, mi] = /^\d{2}:\d{2}$/.test(value || "") ? value.split(":").map(Number) : [9, 0];
  const mins = rangeArr(0, 12).map((i) => i * 5);
  const safeMi = mins.includes(mi) ? mi : Math.min(55, Math.round(mi / 5) * 5);
  const build = (nh, nm) => onChange(`${pad2(nh)}:${pad2(nm)}`);
  return (
    <div className="timesel">
      <select className="timesel__sel" value={h} onChange={(e) => build(Number(e.target.value), safeMi)} aria-label="시">
        {rangeArr(0, 24).map((v) => (
          <option key={v} value={v}>{pad2(v)}시</option>
        ))}
      </select>
      <select className="timesel__sel" value={safeMi} onChange={(e) => build(h, Number(e.target.value))} aria-label="분">
        {mins.map((v) => (
          <option key={v} value={v}>{pad2(v)}분</option>
        ))}
      </select>
    </div>
  );
}

function KeywordColorPopup({ color, onPick }) {
  const isHex = /^#/.test(color || "");
  return (
    <motion.div
      className="schedule__kw-colorpop"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="schedule__kw-colorpop-swatches">
        <button
          type="button"
          className={`schedule__kw-manager-nocolor ${!color ? "is-active" : ""}`}
          onClick={() => onPick(null)}
          title="색 지정 안 함"
          aria-label="색 지정 안 함"
        />
        {CALENDAR_THEME_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`schedule__swatch schedule__swatch--sm ${color === c.id ? "is-active" : ""}`}
            style={{ "--swatch": c.accent }}
            onClick={() => onPick(c.id)}
            title={c.label}
            aria-label={c.label}
          />
        ))}
      </div>
      <label className="schedule__kw-colorpop-custom">
        <input
          type="color"
          value={isHex ? color : "#888888"}
          onChange={(e) => onPick(e.target.value)}
        />
        <span>직접 고르기</span>
      </label>
    </motion.div>
  );
}

function EmojiPickerPopup({ emoji, emojiHistory, onPick }) {
  const [customEmoji, setCustomEmoji] = useState("");

  const applyCustom = () => {
    const v = customEmoji.trim();
    if (!v) return;
    onPick(v);
    setCustomEmoji("");
  };

  return (
    <motion.div
      className="schedule__kw-emojipop"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="schedule__kw-emojipop-custom">
        <input
          type="text"
          value={customEmoji}
          onChange={(e) => setCustomEmoji(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyCustom();
            }
          }}
          placeholder="이모지를 직접 입력"
          maxLength={8}
        />
        <button type="button" onClick={applyCustom} disabled={!customEmoji.trim()}>
          적용
        </button>
      </div>
      <p className="schedule__kw-emojipop-label">이모지 목록</p>
      <div className="schedule__kw-emojipop-grid">
        {emojiHistory.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            className={`schedule__kw-emoji-opt ${emoji === e ? "is-active" : ""}`}
            onClick={() => onPick(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function KeywordEditRow({ keyword, emojiHistory, onUseEmoji, onDone, onCancel, onDelete }) {
  const [draft, setDraft] = useState(keyword);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const colorTheme = draft.color ? getThemeById(draft.color) : null;

  const handleConfirm = async () => {
    const label = draft.label.trim();
    if (!label) {
      setErr("키워드 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onDone({ ...draft, label, emoji: draft.emoji.trim() });
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div
      className="schedule__kw-edit-row"
      onKeyDown={(e) => {
        // 이 편집 UI는 상위 일정 등록 <form> 안에 있으므로, Enter 로 그 폼이
        // 실수로 제출/닫히지 않게 막는다.
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <div className="schedule__kw-edit-main">
        <button
          type="button"
          className="schedule__kw-edit-emoji-btn"
          onClick={() => {
            setEmojiOpen((v) => !v);
            setColorOpen(false);
          }}
        >
          {draft.emoji || "🙂"}
        </button>
        <input
          className="schedule__kw-edit-label"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="키워드 이름을 입력하세요"
          maxLength={60}
          autoFocus
        />
        <button
          type="button"
          className="schedule__kw-edit-color-btn"
          onClick={() => {
            setColorOpen((v) => !v);
            setEmojiOpen(false);
          }}
        >
          <span
            className="schedule__kw-edit-color-dot"
            style={{ background: colorTheme ? colorTheme.accent : "transparent" }}
            aria-hidden
          />
          색
        </button>
        <button
          type="button"
          className="schedule__kw-edit-remove"
          onClick={onDelete}
          aria-label="키워드 삭제"
        >
          ✕
        </button>
      </div>
      <AnimatePresence initial={false}>
        {emojiOpen && (
          <EmojiPickerPopup
            emoji={draft.emoji}
            emojiHistory={emojiHistory}
            onPick={(e) => {
              setDraft((d) => ({ ...d, emoji: e }));
              setEmojiOpen(false);
              onUseEmoji?.(e);
            }}
          />
        )}
        {colorOpen && (
          <KeywordColorPopup
            color={draft.color}
            onPick={(c) => {
              setDraft((d) => ({ ...d, color: c }));
              setColorOpen(false);
            }}
          />
        )}
      </AnimatePresence>
      {err && <p className="schedule__err-inline">{err}</p>}
      <div className="schedule__kw-edit-actions">
        <button type="button" className="schedule__kw-edit-cancel" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className="btn btn-accent schedule__kw-edit-confirm"
          onClick={handleConfirm}
          disabled={saving}
        >
          {saving ? "저장 중…" : "완료"}
        </button>
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
  onClose,
  onSubmit,
  onDelete,
  onSaveKeywords,
  emojiHistory,
  onUseEmoji,
}) {
  const keywords = useKeywords();
  const [kwManageOpen, setKwManageOpen] = useState(false);
  const [editingKwId, setEditingKwId] = useState(null);
  const [pendingNewKw, setPendingNewKw] = useState(null);
  const isWeekly = form.repeatFreq === "weekly";

  const startEditKeyword = (id) => {
    setPendingNewKw(null);
    setEditingKwId(id);
  };

  const cancelEditKeyword = () => {
    setEditingKwId(null);
    setPendingNewKw(null);
  };

  const startAddKeyword = () => {
    const draft = { id: makeKeywordId(), emoji: "", label: "", color: null };
    setPendingNewKw(draft);
    setEditingKwId(draft.id);
  };

  const confirmEditKeyword = async (updated) => {
    const exists = keywords.some((k) => k.id === updated.id);
    const next = exists
      ? keywords.map((k) => (k.id === updated.id ? updated : k))
      : [...keywords, updated];
    await onSaveKeywords(next);
    setEditingKwId(null);
    setPendingNewKw(null);
  };

  const deleteKeyword = async (id) => {
    const next = keywords.filter((k) => k.id !== id);
    await onSaveKeywords(next);
    setEditingKwId(null);
    setPendingNewKw(null);
    setForm((f) => (f.appointmentType === id ? { ...f, appointmentType: "" } : f));
  };

  const toggleAllDay = useCallback(() => {
    setForm((f) => ({ ...f, allDay: !f.allDay }));
  }, [setForm]);

  // 시작 날짜를 옮기면 기존 기간(일수)을 유지한 채 종료 날짜도 같이 옮기고,
  // 반복 종료일이 시작 날짜보다 앞서게 되면 시작 날짜로 당긴다.
  const changeStartDate = useCallback(
    (v) => {
      setForm((f) => {
        const span = f.eventDate && f.endDate ? Math.max(0, dayDiff(f.eventDate, f.endDate)) : 0;
        return {
          ...f,
          eventDate: v,
          endDate: shiftDateKey(v, span),
          repeatUntil: !f.repeatUntil || f.repeatUntil < v ? v : f.repeatUntil,
        };
      });
    },
    [setForm]
  );

  const changeEndDate = useCallback(
    (v) => setForm((f) => ({ ...f, endDate: v < f.eventDate ? f.eventDate : v })),
    [setForm]
  );

  // 같은 날 일정에서 시작 시간을 종료 시간 이후로 옮기면, 기존 길이를 유지하도록 종료 시간을 민다.
  const changeStartTime = useCallback(
    (v) => {
      setForm((f) => {
        const sameDay = !f.endDate || f.endDate === f.eventDate;
        const newStart = timeToMinute(v);
        const oldStart = timeToMinute(f.startTime);
        const oldEnd = timeToMinute(f.endTime);
        if (!sameDay || newStart == null || oldEnd == null || oldEnd > newStart) {
          return { ...f, startTime: v };
        }
        const duration = oldStart != null && oldEnd > oldStart ? oldEnd - oldStart : 60;
        const newEnd = Math.min(newStart + duration, 23 * 60 + 55);
        return { ...f, startTime: v, endTime: newEnd > newStart ? minuteToTime(newEnd) : f.endTime };
      });
    },
    [setForm]
  );

  const rangeError = formRangeError(form);

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
          </div>

          <div className="schedule__when-block schedule__when-block--wide">
            <span className="schedule__when-label">시작 날짜</span>
            <DateField value={form.eventDate} onChange={changeStartDate} />
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
                  <DateField
                    value={form.endDate}
                    min={form.eventDate}
                    onChange={changeEndDate}
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
                <div className="schedule__when-block schedule__when-block--wide">
                  <span className="schedule__when-label">종료 날짜</span>
                  <DateField
                    value={form.endDate}
                    min={form.eventDate}
                    onChange={changeEndDate}
                  />
                </div>
                <div className="schedule__when-times">
                  <div className="schedule__when-block">
                    <span className="schedule__when-label">시작 시간</span>
                    <TimeSelect value={form.startTime} onChange={changeStartTime} />
                  </div>
                  <div className="schedule__when-block">
                    <span className="schedule__when-label">종료 시간</span>
                    <TimeSelect value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!form.repeatOn && (
            <p className="schedule__hint">
              {form.endDate && form.endDate !== form.eventDate
                ? form.allDay
                  ? `${formatDateDot(form.eventDate)} ~ ${formatDateDot(form.endDate)} · 총 ${previewDates.length}일 종일`
                  : `${formatDateDot(form.eventDate)} ${form.startTime || "09:00"} ~ ${formatDateDot(form.endDate)} ${form.endTime || "18:00"} · 연속 ${previewDates.length}일`
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
                  <DateField
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
            <div className="schedule__field-head">
              <label>키워드 선택</label>
              <button
                type="button"
                className={`schedule__kw-manage-toggle ${kwManageOpen ? "is-active" : ""}`}
                onClick={() => {
                  setKwManageOpen((v) => !v);
                  cancelEditKeyword();
                }}
              >
                {kwManageOpen ? "완료" : "키워드 관리"}
              </button>
            </div>
            <div className="schedule__detail-choice">
              {keywords.length === 0 && !pendingNewKw && (
                <p className="schedule__hint">등록된 키워드가 없습니다. "키워드 관리"에서 추가해보세요.</p>
              )}
              {keywords.map((k) =>
                kwManageOpen && editingKwId === k.id ? (
                  <KeywordEditRow
                    key={k.id}
                    keyword={k}
                    emojiHistory={emojiHistory}
                    onUseEmoji={onUseEmoji}
                    onDone={confirmEditKeyword}
                    onCancel={cancelEditKeyword}
                    onDelete={() => deleteKeyword(k.id)}
                  />
                ) : (
                  <button
                    key={k.id}
                    type="button"
                    className={`schedule__detail-btn ${form.appointmentType === k.id ? "is-active" : ""}`}
                    style={
                      form.appointmentType === k.id && k.color
                        ? { "--detail-accent": getThemeById(k.color).accent }
                        : undefined
                    }
                    onClick={() => {
                      if (kwManageOpen) {
                        startEditKeyword(k.id);
                        return;
                      }
                      setForm((f) => {
                        const turningOn = f.appointmentType !== k.id;
                        return {
                          ...f,
                          appointmentType: turningOn ? k.id : "",
                          themeColor: turningOn && k.color ? k.color : f.themeColor,
                        };
                      });
                    }}
                  >
                    {k.emoji ? `${k.emoji} ` : ""}
                    {k.label}
                  </button>
                )
              )}
              {pendingNewKw && (
                <KeywordEditRow
                  keyword={pendingNewKw}
                  emojiHistory={emojiHistory}
                  onUseEmoji={onUseEmoji}
                  onDone={confirmEditKeyword}
                  onCancel={cancelEditKeyword}
                  onDelete={cancelEditKeyword}
                />
              )}
              {kwManageOpen && !pendingNewKw && (
                <button type="button" className="schedule__kw-add-btn" onClick={startAddKeyword}>
                  + 새 키워드
                </button>
              )}
            </div>
          </div>

          {rangeError && <p className="schedule__err-inline">{rangeError}</p>}

          <div className="schedule__modal-actions">
            {onDelete && (
              <button type="button" className="btn btn-ghost schedule__del-btn" onClick={onDelete}>
                삭제
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-accent" disabled={busy || !!rangeError}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// 키워드에 색이 지정돼 있으면 그 색이 우선한다(키워드 색 변경 시 연결된 모든 일정에 즉시 반영).
// 키워드가 없거나 색이 지정 안 된 키워드면, 그 일정에 저장된 색(themeColor)으로 대체한다.
function eventThemeColorId(ev, keywords) {
  const kw = keywordOf(keywords, resolveKeywordId(ev));
  return kw?.color || ev.themeColor || "gray";
}

function eventAccent(ev, keywords) {
  return getThemeById(eventThemeColorId(ev, keywords)).accent;
}

function sortDayEvents(list) {
  return [...list].sort((a, b) => {
    if (a.startTime && !b.startTime) return 1;
    if (!a.startTime && b.startTime) return -1;
    if (!a.startTime && !b.startTime) return a.id - b.id;
    return a.startTime.localeCompare(b.startTime);
  });
}

function DayEventCard({ ev, onEdit, onDelete }) {
  const keywords = useKeywords();
  const keyword = keywordBadge(keywords, resolveKeywordId(ev));
  return (
    <div className="schedule__day-item">
      <span className="schedule__day-item-dot" style={{ background: eventAccent(ev, keywords) }} aria-hidden />
      <div className="schedule__day-item-main">
        <strong>
          <span className="schedule__day-item-title-text">
            <EventTitleDisplay event={ev} />
          </span>
          <span className="schedule__day-item-title-time">
            {formatEventTime(ev, { continuousSpan: true })}
          </span>
        </strong>
        <span className="schedule__day-item-range">
          {formatDateDot(ev.seriesStartDate || ev.eventDate)} ~{" "}
          {formatDateDot(ev.seriesEndDate || ev.eventDate)}
        </span>
        {keyword && <span className="schedule__day-item-keyword">{keyword}</span>}
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

const TIMELINE_HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimelineBlock({ ev, slotH }) {
  const keywords = useKeywords();
  const kw = keywordOf(keywords, resolveKeywordId(ev));
  const { startTime, endTime } = effectiveEventTimes(ev);
  const startMin = timeToMinute(startTime);
  const endMinRaw = endTime ? timeToMinute(endTime) : null;
  const start = startMin ?? 0;
  const continuous = isContinuousMultiDay(ev);
  const end =
    endMinRaw != null && endMinRaw > start
      ? endMinRaw
      : continuous && !endTime
        ? 24 * 60
        : start + 60;
  const top = (start / 60) * slotH;
  const height = Math.max(((end - start) / 60) * slotH - 2, 15);
  // 칸이 낮으면 글자가 겹치므로 폰트를 줄이고, 아주 낮으면 제목만 표시
  const tiny = height < 28;
  const compact = height < 46;
  const timeLabel = formatEventTime(
    { ...ev, startTime: ev.startTime, endTime: ev.endTime },
    { continuousSpan: continuous }
  );
  return (
    <div
      className={`schedule__tl-block ${compact ? "is-compact" : ""} ${tiny ? "is-tiny" : ""}`}
      style={{ top: `${top}px`, height: `${height}px`, "--tl-accent": eventAccent(ev, keywords) }}
      title={`${kw?.emoji ? `${kw.emoji} ` : ""}${ev.title} ${timeLabel}`}
    >
      <span className="schedule__tl-block-title">
        <EventTitleDisplay event={ev} />
      </span>
      {!tiny && <span className="schedule__tl-block-time">{timeLabel}</span>}
    </div>
  );
}

function DayTimeline({ events, expanded, onToggleExpand }) {
  const keywords = useKeywords();
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mobile = vw < 640;
  const slotH = mobile ? 20 : 30;

  if (!events.length) {
    return <p className="schedule__empty">표시할 일정이 없습니다.</p>;
  }

  const anyAllDay = events.some((e) => !effectiveEventTimes(e).startTime);

  return (
    <div className="schedule__timeline">
      <div className="schedule__tl-frame">
        {anyAllDay && (
          <div className="schedule__tl-allday">
            <div className="schedule__tl-hour-gutter schedule__tl-allday-label">종일</div>
            <div className="schedule__tl-allday-cell">
              {events
                .filter((e) => !effectiveEventTimes(e).startTime)
                .map((ev) => (
                  <span
                    key={eventSeriesKey(ev)}
                    className="schedule__tl-allday-chip"
                    style={{ "--tl-accent": eventAccent(ev, keywords) }}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="schedule__tl-body" style={{ height: `${24 * slotH}px` }}>
          <div className="schedule__tl-hours">
            {TIMELINE_HOURS.map((h) => (
              <div key={h} className="schedule__tl-hour" style={{ height: `${slotH}px` }}>
                <span>{String(h).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
          <div className="schedule__tl-col">
            {TIMELINE_HOURS.map((h) => (
              <div key={h} className="schedule__tl-slot" style={{ height: `${slotH}px` }} />
            ))}
            {events
              .filter((e) => effectiveEventTimes(e).startTime)
              .map((ev) => (
                <TimelineBlock key={eventSeriesKey(ev)} ev={ev} slotH={slotH} />
              ))}
          </div>
        </div>

        <button
          type="button"
          className="schedule__tl-expand"
          onClick={onToggleExpand}
        >
          {expanded ? "－ 창 줄이기" : "＋ 창 키우기"}
        </button>
      </div>
    </div>
  );
}

function DayModal({ dateKey, events, onClose, onEdit, onDelete, onAdd }) {
  const [y, m, d] = dateKey.split("-");
  const [viewMode, setViewMode] = useState("grouped");
  const [tlExpanded, setTlExpanded] = useState(false);

  const uniqueEvents = useMemo(
    () => sortDayEvents(dedupeEventsBySeries(events)),
    [events]
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
        className={`schedule__modal schedule__modal--day ${viewMode === "timeline" ? "schedule__modal--timeline" : ""} ${viewMode === "timeline" && tlExpanded ? "is-expanded" : ""}`}
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
          <DayTimeline
            events={uniqueEvents}
            expanded={tlExpanded}
            onToggleExpand={() => setTlExpanded((v) => !v)}
          />
        ) : (
          <div className="schedule__day-list">
            {uniqueEvents.map((ev) => (
              <DayEventCard key={eventSeriesKey(ev)} ev={ev} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
