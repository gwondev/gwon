import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./AdminPage.css";

const ROLES = ["GUEST", "ADMIN"];

const MOCK_STATS = {
  database: "gwon",
  tables: [
    { key: "users", label: "회원", count: 3 },
    { key: "projects", label: "프로젝트 & 공모전", count: 5 },
    { key: "activities", label: "활동", count: 2 },
    { key: "certifications", label: "자격증", count: 4 },
    { key: "careers", label: "경력", count: 1 },
  ],
  roles: { GUEST: 2, ADMIN: 1 },
  total: 15,
};

const MOCK_USERS = [
  { id: 1, name: "이성권", nickname: "이성권", email: "owner@gwon.run", role: "ADMIN" },
  { id: 2, name: "홍길동", nickname: "길동", email: "hong@example.com", role: "GUEST" },
  { id: 3, name: "김철수", nickname: "철수", email: "kim@example.com", role: "GUEST" },
];

export default function AdminPage() {
  const { isAdmin, loading, token, user, localMode } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const loadStats = useCallback(async () => {
    if (localMode) {
      setStats(MOCK_STATS);
      return;
    }
    try {
      const data = await api("/admin/stats", { token });
      setStats(data);
    } catch (e) {
      setErr(e.message);
    }
  }, [token, localMode]);

  const loadUsers = useCallback(
    async (query = "") => {
      if (localMode) {
        const filtered = query
          ? MOCK_USERS.filter(
              (u) =>
                u.name?.includes(query) ||
                u.nickname?.includes(query) ||
                u.email?.includes(query)
            )
          : MOCK_USERS;
        setItems(filtered);
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
    if (isAdmin) {
      loadStats();
      loadUsers("");
    }
  }, [isAdmin, loadStats, loadUsers]);

  const search = (e) => {
    e.preventDefault();
    loadUsers(q.trim());
  };

  const changeRole = async (id, role) => {
    if (localMode) {
      setItems((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      setStats((prev) => {
        if (!prev) return prev;
        const old = items.find((u) => u.id === id)?.role;
        if (!old || old === role) return prev;
        return {
          ...prev,
          roles: {
            ...prev.roles,
            [old]: Math.max(0, (prev.roles[old] || 0) - 1),
            [role]: (prev.roles[role] || 0) + 1,
          },
        };
      });
      return;
    }
    try {
      const data = await api(`/admin/users/${id}/role`, { method: "PUT", body: { role }, token });
      setItems((prev) => prev.map((u) => (u.id === id ? data.item : u)));
      loadStats();
    } catch (e) {
      alert(`권한 변경 실패: ${e.message}`);
    }
  };

  if (!isAdmin) return null;

  return (
    <PageTransition className="page admin">
      <div className="admin__top">
        <button type="button" className="admin__home" onClick={() => navigate("/")}>
          메인 화면
        </button>
      </div>

      <motion.header
        className="admin__head"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <span className="eyebrow">ADMIN · DATABASE</span>
          <h1 className="section-title">관리자</h1>
          <p className="lead admin__desc">DB 현황 조회와 회원 권한을 관리하는 전용 페이지입니다.</p>
        </div>
        {stats && <span className="admin__db-badge">{stats.database}</span>}
      </motion.header>

      {/* ── DB 요약 ── */}
      <section className="admin__section">
        <h2 className="admin__section-title">DB 요약</h2>
        {stats ? (
          <>
            <div className="admin__stats">
              {stats.tables.map((t, i) => (
                <motion.div
                  key={t.key}
                  className="admin__stat"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="admin__stat-label">{t.label}</span>
                  <span className="admin__stat-count">{t.count}</span>
                  <span className="admin__stat-key">{t.key}</span>
                </motion.div>
              ))}
              <motion.div
                className="admin__stat admin__stat--total"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="admin__stat-label">전체 레코드</span>
                <span className="admin__stat-count">{stats.total}</span>
                <span className="admin__stat-key">total</span>
              </motion.div>
            </div>
            <div className="admin__roles">
              <span className="admin__role-chip admin__role-chip--guest">
                GUEST <b>{stats.roles.GUEST ?? 0}</b>
              </span>
              <span className="admin__role-chip admin__role-chip--admin">
                ADMIN <b>{stats.roles.ADMIN ?? 0}</b>
              </span>
            </div>
          </>
        ) : (
          <div className="state">DB 요약을 불러오는 중…</div>
        )}
      </section>

      {/* ── 회원 관리 ── */}
      <section className="admin__section">
        <div className="admin__section-head">
          <h2 className="admin__section-title">회원 관리</h2>
          <span className="admin__section-count">{items.length}</span>
        </div>

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
                loadUsers("");
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
      </section>
    </PageTransition>
  );
}
