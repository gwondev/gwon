import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import "./NicknameSetupPage.css";

export default function NicknameSetupPage() {
  const { isAuthed, loading, user, updateNickname } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthed) navigate("/");
  }, [loading, isAuthed, navigate]);

  useEffect(() => {
    if (user?.nickname) setValue(user.nickname);
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 1) return setErr("닉네임을 입력해주세요.");
    setBusy(true);
    setErr(null);
    try {
      await updateNickname(trimmed);
      navigate("/");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition className="page nickname">
      <motion.div
        className="nickname__card"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="eyebrow">WELCOME</span>
        <h1 className="nickname__title">어떻게 불러드릴까요?</h1>
        <p className="lead nickname__lead">
          화면 왼쪽 위에 <b>“OOO님 반갑습니다”</b> 로 표시될 이름이에요.
        </p>

        <form onSubmit={submit} className="nickname__form">
          <div className="field">
            <label htmlFor="nick">닉네임</label>
            <input
              id="nick"
              value={value}
              maxLength={20}
              placeholder="예: 이성권"
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          {err && <p className="nickname__err">{err}</p>}
          <button type="submit" className="btn btn-accent nickname__submit" disabled={busy}>
            {busy ? "저장 중…" : "시작하기"}
          </button>
        </form>
      </motion.div>
    </PageTransition>
  );
}
