import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import SideDrawer from "./SideDrawer";
import "./TopBar.css";

export default function TopBar() {
  const { user, isAuthed } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  const greeting = isAuthed
    ? `${user.nickname || user.name || "회원"}님 반갑습니다.`
    : "로그인해주세요";

  return (
    <>
      <header className="topbar">
        <Link to="/" className="topbar__greet" aria-label="홈으로">
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
        </Link>

        <div className="topbar__center">
          {isHome ? (
            <span className="topbar__home topbar__home--active" aria-current="page">
              메인 화면
            </span>
          ) : (
            <Link to="/" className="topbar__home">
              메인 화면
            </Link>
          )}
        </div>

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
