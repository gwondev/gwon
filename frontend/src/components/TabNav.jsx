import { useNavigate } from "react-router-dom";
import { SECTIONS } from "../lib/sections";
import "./TabNav.css";

const SHORT_LABELS = {
  techstack: "기술",
  competitions: "공모전",
  projects: "프로젝트",
  activities: "활동",
  certifications: "자격증",
  career: "경력",
};

const NAV = [
  { key: "overview", path: "/overview", title: "전체 포트폴리오 요약", short: "전체" },
  ...SECTIONS.map((s) => ({
    key: s.key,
    path: s.path,
    title: s.title,
    short: SHORT_LABELS[s.key] || s.title,
  })),
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
              s.key === "overview" ? "tabnav__tab--special" : ""
            }`}
            onClick={() => navigate(s.path)}
          >
            <span className="tabnav__label tabnav__label--full">{s.title}</span>
            <span className="tabnav__label tabnav__label--short">{s.short}</span>
          </button>
        );
      })}
    </div>
  );
}
