import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import SideDrawer from "./SideDrawer";
import "./TopBar.css";

export default function TopBar() {
  const { user, isAuthed, localMode } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const greeting = isAuthed
    ? `${user.nickname || user.name || "회원"}님 반갑습니다.`
    : "로그인해주세요";

  // 실제 로그인 상태에서만 마이페이지로 이동, 그 외(로컬/비로그인)는 툴바 열기
  const handleGreetClick = () => {
    if (isAuthed && !localMode) navigate("/mypage");
    else setOpen(true);
  };

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="topbar__greet"
          onClick={handleGreetClick}
          aria-label={isAuthed ? "마이페이지" : "로그인"}
        >
          <motion.span
            key={greeting}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="topbar__greet-text"
          >
            <span className="topbar__dot" aria-hidden />
            {greeting}
          </motion.span>
        </button>

        <button
          className={`hamburger ${open ? "is-open" : ""}`}
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
