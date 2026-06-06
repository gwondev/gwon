import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SECTIONS } from "../lib/sections";
import "./TabNav.css";

export default function TabNav({ active }) {
  const navigate = useNavigate();

  return (
    <div className="tabnav" role="tablist">
      {SECTIONS.map((s) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            role="tab"
            aria-selected={isActive}
            className={`tabnav__tab ${isActive ? "is-active" : ""}`}
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
