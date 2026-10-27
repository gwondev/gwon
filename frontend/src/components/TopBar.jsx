import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useViewMode } from "../context/ViewModeContext";
import SideDrawer from "./SideDrawer";
import { IconCalendar, IconCoin, IconDatabase, IconHome } from "./ActionIcons";
import "./TopBar.css";

const VIEWMODE_PATHS = ["/certifications", "/activities", "/competitions", "/projects", "/career"];

export default function TopBar() {
  const { user, isAuthed, isAdmin, isSuperAdmin } = useAuth();
  const { viewAsUser, setViewAsUser } = useViewMode();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const showViewMode = isAdmin && VIEWMODE_PATHS.includes(location.pathname);
  const isSchedule = location.pathname === "/schedule";
  const onHome = location.pathname === "/";
  const isStudio = location.pathname === "/studio";
  const onSchedule = location.pathname === "/schedule";
  const onCoin = location.pathname.toLowerCase() === "/binance";
  const isDesk = isSuperAdmin && (isStudio || onSchedule || onCoin);
  const homeEditing = onHome && isSuperAdmin && !viewAsUser;

  const handleHome = () => {
    if (!onHome) {
      navigate("/");
      return;
    }
    if (isSuperAdmin) setViewAsUser((v) => !v);
  };

  useEffect(() => {
    if (isSchedule) {
      setScrolled(false);
      return;
    }
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
      <header className={`topbar ${scrolled ? "is-scrolled" : ""} ${isDesk ? "is-desk" : ""}`}>
        <div className="topbar__left">
          <div className="topbar__adminlinks">
            <button
              type="button"
              className={`topbar__adminlink topbar__home ${onHome ? "is-active" : ""}${homeEditing ? " is-editing" : ""}`}
              onClick={handleHome}
              aria-label="홈"
            >
              {isDesk ? (
                <>
                  <IconHome className="topbar__sym" />홈
                </>
              ) : (
                <IconHome width={15} height={15} />
              )}
            </button>
            {isDesk && (
              <>
                <button type="button" className={`topbar__adminlink${onCoin ? " is-active" : ""}`} onClick={() => navigate("/binance")}>
                  <IconCoin className="topbar__sym" />코인
                </button>
                <button type="button" className={`topbar__adminlink${onSchedule ? " is-active" : ""}`} onClick={() => navigate("/schedule")}>
                  <IconCalendar className="topbar__sym" />일정
                </button>
                <button type="button" className={`topbar__adminlink${isStudio ? " is-active" : ""}`} onClick={() => navigate("/studio")}>
                  <IconDatabase className="topbar__sym" />DB
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

        {!isDesk && (
        <div className="topbar__right">
          <button
            type="button"
            className={`topbar__greet ${location.pathname === "/mypage" ? "is-active" : ""}`}
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
        </div>
        )}
      </header>

      <SideDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
