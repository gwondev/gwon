import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
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
  const [, m, d] = dateKey.split("-");
  return `${m}.${d}`;
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

export default function ScheduleChecklist() {
  const { token, localMode } = useAuth();
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
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

  const activeItems = items.filter((it) => !it.done);
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
          body: { text: trimmed, dueDate: dueDate || null },
        });
        setItems((prev) => [...prev, data.item]);
      }
      setText("");
      scrollToBottom();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
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
              <ChecklistItem key={item.id} item={item} onToggle={() => toggleDone(item)} />
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

function ChecklistItem({ item, onToggle }) {
  const [checking, setChecking] = useState(false);

  const handleClick = () => {
    if (checking) return;
    setChecking(true);
    setTimeout(() => onToggle(), 260);
  };

  return (
    <motion.li
      layout
      className="todo__item"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 28, transition: { duration: 0.22, ease: "easeIn" } }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        className={`todo__check ${checking ? "is-checked" : ""}`}
        onClick={handleClick}
        aria-label="완료 처리"
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
        <span className="todo__item-text">{item.text}</span>
        {item.dueDate && <span className="todo__item-date">{formatDateDot(item.dueDate)}</span>}
      </div>
    </motion.li>
  );
}
