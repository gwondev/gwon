import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SECTIONS } from "../lib/sections";
import DrawerChatAdmin from "./DrawerChatAdmin";
import "./SideDrawer.css";

const panel = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { type: "spring", stiffness: 280, damping: 32 } },
  exit: { x: "100%", transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};
const item = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function SideDrawer({ open, onClose }) {
  const { user, isAuthed, isAdmin, localMode, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const [chatAdminOpen, setChatAdminOpen] = useState(false);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const handleGoogle = async (cred) => {
    try {
      const u = await loginWithGoogle(cred.credential);
      onClose();
      if (!u.nickname) navigate("/setup-nickname");
    } catch (e) {
      alert(`로그인에 실패했습니다: ${e.message}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            variants={panel}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-label="메뉴"
          >
            <div className="drawer__head">
              <span className="eyebrow">MENU</span>
              <button className="drawer__close" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </div>

            <motion.nav className="drawer__nav" variants={stagger} initial="hidden" animate="show">
              {SECTIONS.map((s) => (
                <motion.button
                  key={s.key}
                  variants={item}
                  className="drawer__link"
                  onClick={() => go(s.path)}
                >
                  <span className="drawer__link-no">{s.no}</span>
                  <span className="drawer__link-title">{s.title}</span>
                  <span className="drawer__link-arrow">→</span>
                </motion.button>
              ))}
              {isAuthed && !localMode && (
                <motion.button
                  variants={item}
                  className="drawer__link drawer__link--mypage"
                  onClick={() => go("/mypage")}
                >
                  <span className="drawer__link-no">♦</span>
                  <span className="drawer__link-title">마이페이지</span>
                  <span className="drawer__link-arrow">→</span>
                </motion.button>
              )}
              {isAdmin && (
                <motion.button
                  variants={item}
                  className="drawer__link drawer__link--admin"
                  onClick={() => go("/admin")}
                >
                  <span className="drawer__link-no">★</span>
                  <span className="drawer__link-title">관리자 · DB</span>
                  <span className="drawer__link-arrow">→</span>
                </motion.button>
              )}
              {isAdmin && (
                <motion.div variants={item}>
                  <button
                    type="button"
                    className={`drawer__link drawer__link--chat-admin ${chatAdminOpen ? "is-open" : ""}`}
                    onClick={() => setChatAdminOpen((v) => !v)}
                    aria-expanded={chatAdminOpen}
                  >
                    <span className="drawer__link-no">◆</span>
                    <span className="drawer__link-title">AI 챗봇 관리</span>
                    <span className="drawer__link-arrow">{chatAdminOpen ? "−" : "+"}</span>
                  </button>
                  <DrawerChatAdmin open={chatAdminOpen} />
                </motion.div>
              )}
            </motion.nav>

            <motion.div className="drawer__auth" variants={item} initial="hidden" animate="show">
              {localMode ? (
                <div className="drawer__note">
                  <strong>로컬 미리보기 모드</strong>
                  <span>
                    구글 로그인 없이 전체 UI 를 확인하는 모드입니다. 실제 로그인·권한은 서버
                    배포 환경에서 동작합니다.
                  </span>
                </div>
              ) : isAuthed ? (
                <div className="drawer__profile">
                  <div className="drawer__avatar">
                    {(user.nickname || user.name || "?").slice(0, 1)}
                  </div>
                  <div className="drawer__profile-meta">
                    <strong>{user.nickname || user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="drawer__profile-actions">
                    {!user.nickname && (
                      <button className="btn btn-ghost" onClick={() => go("/setup-nickname")}>
                        닉네임 설정
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => { logout(); }}>
                      로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                <div className="drawer__login">
                  <p className="drawer__login-copy">Google 계정으로 시작하기</p>
                  <div className="drawer__gbtn">
                    <GoogleLogin
                      onSuccess={handleGoogle}
                      onError={() => alert("Google 로그인을 완료하지 못했습니다.")}
                      theme="filled_black"
                      shape="pill"
                      text="continue_with"
                      width="280"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
