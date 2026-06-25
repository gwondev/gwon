import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import SideDrawer from "./SideDrawer";
import "./TopBar.css";

const BACK_PATHS = ["/mypage", "/schedule", "/admin"];

export default function TopBar() {
  const { user, isAuthed } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const greeting = isAuthed
    ? `${user.nickname || user.name || "회원"}님 반갑습니다.`
    : "로그인해주세요";

  const showBack = BACK_PATHS.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  const handleGreetClick = () => {
    if (isAuthed) navigate("/mypage");
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

        <div className="topbar__right">
          {showBack && (
            <button type="button" className="page-back topbar__back" onClick={() => navigate("/")}>
              메인 화면
            </button>
          )}
          <button
            className={`hamburger ${open ? "is-open" : ""}`}
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
