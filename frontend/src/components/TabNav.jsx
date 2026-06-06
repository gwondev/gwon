import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SECTIONS } from "../lib/sections";
import "./TabNav.css";

// 메인 화면 + 한번에 보기 + 4개 섹션을 한 줄 툴바로
const NAV = [
  { key: "home", path: "/", title: "메인 화면" },
  { key: "overview", path: "/overview", title: "한번에 보기" },
  ...SECTIONS.map((s) => ({ key: s.key, path: s.path, title: s.title })),
];

export default function TabNav({ active }) {
  const navigate = useNavigate();

  return (
    <div className="tabnav" role="tablist">
      {NAV.map((s) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            role="tab"
            aria-selected={isActive}
            className={`tabnav__tab ${isActive ? "is-active" : ""} ${
              s.key === "home" || s.key === "overview" ? "tabnav__tab--special" : ""
            }`}
            onClick={() => navigate(s.path)}
          >
            {isActive && (
              <motion.span
                layoutId="tabnav-pill"
                className="tabnav__pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="tabnav__label">{s.title}</span>
          </button>
        );
      })}
    </div>
  );
}
