import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getThemeById } from "../lib/calendarTheme";
import "./ScheduleChecklist.css";

const STORAGE_KEY = "gwon.todos.v1";
const RETENTION_DAYS = 30;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateDot(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [y, m, d] = dateKey.split("-");
  return `${y.slice(2)}.${m}.${d}`;
}

function loadLocalItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return parsed.filter((it) => !it.done || !it.doneAt || new Date(it.doneAt).getTime() >= cutoff);
  } catch {
    return [];
  }
}

function saveLocalItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export default function ScheduleChecklist({ ownerId, calendarVersion = 0, onCalendarChanged }) {
  const { token, localMode } = useAuth();
  const [items, setItems] = useState([]);
  // 왼쪽 달력의 'TODO' 키워드 일정들 (마감기한이 엄격한 항목)
  const [calItems, setCalItems] = useState([]);
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (localMode) {
      setItems(loadLocalItems());
      return;
    }
    const data = await api("/todos", { token });
    setItems(data.items || []);
  }, [token, localMode]);

  const loadCalItems = useCallback(async () => {
    if (localMode || !ownerId) {
      setCalItems([]);
      return;
    }
    const data = await api(`/calendar/todo-events?ownerIds=${ownerId}`, { token });
    setCalItems(data.items || []);
  }, [token, localMode, ownerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // 달력 이벤트가 바뀔 때마다(calendarVersion) 달력 TODO도 다시 불러온다
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadCalItems();
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadCalItems, calendarVersion]);

  // 직접 입력한 할 일(미완료) + 달력의 TODO 일정을 한 목록으로 합쳐 마감일 순 정렬
  const activeItems = [
    ...items.filter((it) => !it.done).map((it) => ({ ...it, source: "todo" })),
    ...calItems.map((it) => ({ ...it, source: "calendar" })),
  ].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const doneItems = items
    .filter((it) => it.done)
    .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    const trimmedDesc = description.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      if (localMode) {
        const next = [
          ...items,
          {
            id: `local-${Date.now()}`,
            text: trimmed,
            description: trimmedDesc,
            dueDate: dueDate || null,
            done: false,
            doneAt: null,
          },
        ];
        setItems(next);
        saveLocalItems(next);
      } else {
        const data = await api("/todos", {
          method: "POST",
          token,
          body: { text: trimmed, description: trimmedDesc, dueDate: dueDate || null },
        });
        setItems((prev) => [...prev, data.item]);
      }
      setText("");
      setDescription("");
      scrollToBottom();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item) => {
    if (localMode) {
      const next = items.filter((it) => it.id !== item.id);
      setItems(next);
      saveLocalItems(next);
      return;
    }

    setItems((prev) => prev.filter((it) => it.id !== item.id));
    try {
      await api(`/todos/${item.id}`, { method: "DELETE", token });
    } catch (e) {
      setErr(e.message);
      await load();
    }
  };

  // 달력 TODO 항목 삭제 → 왼쪽 본 캘린더의 해당 일정도 함께 삭제
  const deleteCalendarItem = async (item) => {
    setCalItems((prev) => prev.filter((it) => it.id !== item.id));
    if (localMode) return;
    try {
      await api(`/calendar/events/${item.id}`, { method: "DELETE", token });
      onCalendarChanged?.();
    } catch (e) {
      setErr(e.message);
      await loadCalItems();
    }
  };

  const toggleDone = async (item) => {
    const done = !item.done;
    const doneAt = done ? new Date().toISOString() : null;

    if (localMode) {
      const next = items.map((it) => (it.id === item.id ? { ...it, done, doneAt } : it));
      setItems(next);
      saveLocalItems(next);
      return;
    }

    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, done, doneAt } : it)));
    try {
      const data = await api(`/todos/${item.id}/toggle`, {
        method: "PUT",
        token,
        body: { done },
      });
      setItems((prev) => prev.map((it) => (it.id === item.id ? data.item : it)));
    } catch (e) {
      setErr(e.message);
      await load();
    }
  };

  return (
    <div className="todo">
      <div className="todo__head">
        <p className="todo__title">할 일</p>
        <button
          type="button"
          className={`todo__done-toggle ${showDone ? "is-active" : ""}`}
          onClick={() => setShowDone((v) => !v)}
        >
          완료 {doneItems.length > 0 ? doneItems.length : ""}
        </button>
      </div>

      {err && <p className="todo__err">{err}</p>}

      <AnimatePresence>
        {showDone && (
          <motion.div
            className="todo__done-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {doneItems.length === 0 ? (
              <p className="todo__done-empty">최근 30일간 완료한 항목이 없습니다.</p>
            ) : (
              <ul className="todo__done-list">
                {doneItems.map((it) => (
                  <li key={it.id} className="todo__done-item">
                    <span className="todo__done-item-text">{it.text}</span>
                    {it.dueDate && <span className="todo__done-item-date">{formatDateDot(it.dueDate)}</span>}
                    <button
                      type="button"
                      className="todo__done-item-delete"
                      onClick={() => deleteItem(it)}
                      aria-label="완료 항목 삭제"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="todo__list" ref={listRef}>
        <AnimatePresence initial={false}>
          {activeItems.length === 0 ? (
            <motion.li
              key="empty"
              className="todo__empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              할 일을 추가해보세요.
            </motion.li>
          ) : (
            activeItems.map((item) => (
              <ChecklistItem
                key={`${item.source}-${item.id}`}
                item={item}
                onAction={() =>
                  item.source === "calendar" ? deleteCalendarItem(item) : toggleDone(item)
                }
              />
            ))
          )}
        </AnimatePresence>
      </ul>

      <form className="todo__add" onSubmit={handleAdd}>
        <input
          type="text"
          className="todo__add-input"
          placeholder="할 일을 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <textarea
          className="todo__add-desc"
          placeholder="세부설명 (선택)"
          rows={1}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        <div className="todo__add-row">
          <input
            type="date"
            className="todo__add-date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button type="submit" className="todo__add-btn" disabled={busy || !text.trim()}>
            ADD
          </button>
        </div>
      </form>
    </div>
  );
}

function ChecklistItem({ item, onAction }) {
  const [checking, setChecking] = useState(false);
  const isCal = item.source === "calendar";

  const handleClick = () => {
    if (checking) return;
    if (isCal && !window.confirm("이 TODO를 삭제할까요? 왼쪽 달력의 일정도 함께 삭제됩니다.")) {
      return;
    }
    setChecking(true);
    setTimeout(() => onAction(), 260);
  };

  const hasDesc = Boolean(item.description && item.description.trim());
  // 달력 TODO는 일정에 지정된 키워드/테마 색을 그대로 사용
  const accent = isCal ? getThemeById(item.themeColor).accent : null;

  return (
    <motion.li
      layout
      className={`todo__item ${isCal ? "todo__item--cal" : ""}`}
      style={isCal ? { "--todo-accent": accent } : undefined}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 28, transition: { duration: 0.22, ease: "easeIn" } }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        className={`todo__check ${checking ? "is-checked" : ""}`}
        onClick={handleClick}
        aria-label={isCal ? "달력 일정 삭제" : "완료 처리"}
      >
        {checking && (
          <motion.span
            className="todo__check-mark"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            ✕
          </motion.span>
        )}
      </button>
      <div className="todo__item-body">
        {item.dueDate && <span className="todo__item-date">{formatDateDot(item.dueDate)}</span>}
        <span className="todo__item-text">
          {isCal && (
            <span className="todo__item-cal-badge" title="달력 일정">
              📅
            </span>
          )}
          {item.text}
        </span>
      </div>
      {hasDesc && <DetailButton description={item.description} />}
    </motion.li>
  );
}

function DetailButton({ description }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="todo__detail" ref={wrapRef}>
      <button
        type="button"
        className={`todo__detail-btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="세부설명 보기"
        aria-expanded={open}
      >
        i
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="todo__detail-pop"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -3, transition: { duration: 0.14 } }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {description}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
