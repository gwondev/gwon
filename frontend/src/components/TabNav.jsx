import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SECTIONS } from "../lib/sections";
import "./TabNav.css";

const NAV = [
  { key: "home", path: "/", title: "메인 화면", short: "메인" },
  { key: "overview", path: "/overview", title: "전체 포트폴리오 요약", short: "전체" },
  ...SECTIONS.map((s) => ({ key: s.key, path: s.path, title: s.title, short: s.title })),
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
            <span className="tabnav__label tabnav__label--full">{s.title}</span>
            <span className="tabnav__label tabnav__label--short">{s.short}</span>
          </button>
        );
      })}
    </div>
  );
}
