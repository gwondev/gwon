import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useViewMode } from "../context/ViewModeContext";
import { IconHome } from "./ActionIcons";
import SideDrawer from "./SideDrawer";
import "./TopBar.css";

const VIEWMODE_PATHS = ["/certifications", "/activities"];

export default function TopBar() {
  const { user, isAuthed, isAdmin } = useAuth();
  const { viewAsUser, setViewAsUser } = useViewMode();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const showViewMode = isAdmin && VIEWMODE_PATHS.includes(location.pathname);

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

        {showViewMode && (
          <div className="topbar__viewmode viewmode" role="radiogroup" aria-label="보기 모드">
            <label className={`viewmode__opt ${!viewAsUser ? "is-on" : ""}`}>
              <input
                type="radio"
                name="topbar-viewmode"
                checked={!viewAsUser}
                onChange={() => setViewAsUser(false)}
              />
              <span>관리자</span>
            </label>
            <label className={`viewmode__opt ${viewAsUser ? "is-on" : ""}`}>
              <input
                type="radio"
                name="topbar-viewmode"
                checked={viewAsUser}
                onChange={() => setViewAsUser(true)}
              />
              <span>사용자 시점</span>
            </label>
          </div>
        )}

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
