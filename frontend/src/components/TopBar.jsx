import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { IconHome } from "./ActionIcons";
import SideDrawer from "./SideDrawer";
import "./TopBar.css";

export default function TopBar() {
  const { user, isAuthed } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const greeting = isAuthed
    ? `${user.nickname || user.name || "회원"}님 반갑습니다.`
    : "로그인해주세요";

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
          <button
            type="button"
            className="topbar__orb topbar__orb--home"
            onClick={() => navigate("/")}
            aria-label="메인 화면"
            title="메인"
          >
            <span className="topbar__orb-sheen" aria-hidden />
            <IconHome />
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
        </div>
      </header>

      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
