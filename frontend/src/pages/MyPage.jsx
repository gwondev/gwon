import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/calendarTheme";
import "./MyPage.css";

export default function MyPage() {
  const { user, isAuthed, loading, isSuperAdmin, updateNickname, logout } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthed) navigate("/");
  }, [loading, isAuthed, navigate]);

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname);
  }, [user]);

  if (!isAuthed || !user) return null;

  const saveNickname = async (e) => {
    e.preventDefault();
    const v = nickname.trim();
    if (!v) return setMsg({ type: "err", text: "닉네임을 입력해주세요." });
    setBusy(true);
    setMsg(null);
    try {
      await updateNickname(v);
      setMsg({ type: "ok", text: "닉네임이 저장되었습니다." });
    } catch (e2) {
      setMsg({ type: "err", text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  const roleClass = user.role?.toLowerCase().replace("_", "-");

  return (
    <PageTransition className="page mypage">
      <motion.header
        className="mypage__head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="eyebrow">MY PAGE</span>
        <h1 className="section-title">마이페이지</h1>
      </motion.header>

      <motion.section
        className="mypage__card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mypage__profile">
          <div className="mypage__avatar">
            {(user.nickname || user.name || "?").slice(0, 1)}
          </div>
          <div className="mypage__profile-meta">
            <strong>{user.nickname || user.name}</strong>
            <span>{user.email}</span>
          </div>
          <span className={`mypage__role mypage__role--${roleClass}`}>{user.role}</span>
        </div>

        <dl className="mypage__info">
          <div>
            <dt>이름</dt>
            <dd>{user.name || "—"}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{user.email || "—"}</dd>
          </div>
          <div>
            <dt>권한</dt>
            <dd>{roleLabel(user.role)}</dd>
          </div>
        </dl>

        <form className="mypage__form" onSubmit={saveNickname}>
          <div className="field">
            <label htmlFor="nick">닉네임</label>
            <input
              id="nick"
              value={nickname}
              maxLength={20}
              placeholder="예: 이성권"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          {msg && (
            <p className={`mypage__msg ${msg.type === "err" ? "is-err" : "is-ok"}`}>
              {msg.text}
            </p>
          )}
          <div className="mypage__actions">
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {busy ? "저장 중…" : "닉네임 저장"}
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/admin")}
              >
                  ADMIN 페이지
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              로그아웃
            </button>
          </div>
        </form>
      </motion.section>
    </PageTransition>
  );
}
