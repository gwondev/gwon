import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useViewMode } from "../context/ViewModeContext";
import SideDrawer from "./SideDrawer";
import { IconHome, IconCalendar } from "./ActionIcons";
import "./TopBar.css";

const VIEWMODE_PATHS = ["/certifications", "/activities", "/competitions", "/projects", "/career"];

export default function TopBar() {
  const { user, isAuthed, isAdmin } = useAuth();
  const { viewAsUser, setViewAsUser } = useViewMode();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const showViewMode = isAdmin && VIEWMODE_PATHS.includes(location.pathname);
  const isSchedule = location.pathname === "/schedule";

  useEffect(() => {
    if (isSchedule) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 10);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isSchedule]);

  const greeting = isAuthed
    ? `${user.nickname || user.name || "회원"}님`
    : "로그인";

  const handleGreetClick = () => {
    if (isAuthed) navigate("/mypage");
    else setOpen(true);
  };

  return (
    <>
      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="topbar__left">
          <div className="topbar__adminlinks">
            <button
              type="button"
              className={`topbar__adminlink topbar__home ${location.pathname === "/" ? "is-active" : ""}`}
              onClick={() => navigate("/")}
              aria-label="홈"
              title="홈"
            >
              <IconHome width={15} height={15} />
              <span>HOME</span>
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  className={`topbar__adminlink topbar__b ${location.pathname.toLowerCase() === "/binance" ? "is-active" : ""}`}
                  onClick={() => navigate("/binance")}
                  aria-label="바이낸스"
                  title="바이낸스"
                >
                  B
                </button>
                <button
                  type="button"
                  className={`topbar__adminlink ${location.pathname === "/schedule" ? "is-active" : ""}`}
                  onClick={() => navigate("/schedule")}
                  aria-label="일정"
                  title="일정"
                >
                  <IconCalendar width={16} height={16} />
                  <span>일정</span>
                </button>
              </>
            )}
          </div>
        </div>

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
            className="topbar__greet"
            onClick={handleGreetClick}
            aria-label={isAuthed ? "마이페이지" : "로그인"}
          >
            <motion.span
              key={greeting}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
        </div>
      </header>

      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
