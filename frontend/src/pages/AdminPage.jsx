import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./AdminPage.css";

const ROLES = ["GUEST", "ADMIN"];

export default function AdminPage() {
  const { isAdmin, loading, token, user, localMode } = useAuth();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const load = useCallback(
    async (query = "") => {
      if (localMode) {
        // 로컬 미리보기: 샘플 데이터로 화면만 확인
        setItems([
          { id: 1, name: "이성권", nickname: "이성권", email: "owner@gwon.run", role: "ADMIN" },
          { id: 2, name: "홍길동", nickname: "길동", email: "hong@example.com", role: "GUEST" },
          { id: 3, name: "김철수", nickname: "철수", email: "kim@example.com", role: "GUEST" },
        ]);
        return;
      }
      setBusy(true);
      setErr(null);
      try {
        const data = await api(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
          token,
        });
        setItems(data.items || []);
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
    },
    [token, localMode]
  );

  useEffect(() => {
    if (isAdmin) load("");
  }, [isAdmin, load]);

  const search = (e) => {
    e.preventDefault();
    load(q.trim());
  };

  const changeRole = async (id, role) => {
    if (localMode) {
      setItems((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      return;
    }
    try {
      const data = await api(`/admin/users/${id}/role`, { method: "PUT", body: { role }, token });
      setItems((prev) => prev.map((u) => (u.id === id ? data.item : u)));
    } catch (e) {
      alert(`권한 변경 실패: ${e.message}`);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageTransition className="page admin">
      <motion.header
        className="admin__head"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 className="section-title">회원 관리</h1>
        </div>
        <span className="section__count">{items.length}</span>
      </motion.header>

      <form className="admin__search" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 닉네임 · 이메일로 검색"
        />
        <button type="submit" className="btn btn-accent" disabled={busy}>
          검색
        </button>
        {q && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQ("");
              load("");
            }}
          >
            초기화
          </button>
        )}
      </form>

      {err ? (
        <div className="state">{err}</div>
      ) : busy ? (
        <div className="state">불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className="state">표시할 회원이 없습니다.</div>
      ) : (
        <div className="admin__table">
          <div className="admin__row admin__row--head">
            <span>이름</span>
            <span>닉네임</span>
            <span className="admin__col-email">이메일</span>
            <span>권한</span>
          </div>
          {items.map((u, i) => (
            <motion.div
              key={u.id}
              className="admin__row"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="admin__name">{u.name || "-"}</span>
              <span>{u.nickname || "-"}</span>
              <span className="admin__col-email admin__email">{u.email || "-"}</span>
              <span>
                <select
                  className={`admin__role admin__role--${u.role?.toLowerCase()}`}
                  value={u.role}
                  disabled={u.id === user?.id}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  title={u.id === user?.id ? "본인 권한은 변경할 수 없습니다." : "권한 변경"}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
