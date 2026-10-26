import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHomeLayout } from "../lib/useHomeLayout.js";
import { filledItems, sectionItems, visibleSections } from "../components/universe/sections.js";
import "./VaultStudio.css";

const FACTS = {
  projects: ["title", "subtitle", "period", "role"],
  credentials: ["title", "issuer", "acquired", "score", "subtitle"],
  awards: ["title", "subtitle", "description"],
  infrastructure: ["title", "subtitle"],
  activities: ["title", "subtitle", "description"],
  career: ["title", "subtitle", "description"],
  profile: ["title", "subtitle", "description"],
};

function bitsOf(item, keys) {
  return keys.map((key) => String(item?.[key] || "").trim()).filter(Boolean);
}

export default function VaultStudio() {
  const { isSuperAdmin } = useAuth();
  const home = useHomeLayout();
  const [copied, setCopied] = useState("");

  const boards = useMemo(() => {
    return visibleSections(home, false)
      .filter((section) => section.id !== "gateway")
      .map((section) => ({
        section,
        items: filledItems(sectionItems(section, home)).map((item) => ({
          id: item.id,
          bits: bitsOf(item, FACTS[section.id] || ["title", "subtitle"]),
        })).filter((item) => item.bits.length),
      }))
      .filter((board) => board.items.length);
  }, [home]);

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied((cur) => (cur === text ? "" : cur)), 900);
    } catch {
      setCopied("");
    }
  };

  return (
    <main className="studio">
      <div className="studio__rows">
        {boards.map(({ section, items }) => (
          <section key={section.id} className="studio__row">
            <h2>
              <b>{section.no}</b>
              {section.ko}
            </h2>
            <div className="studio__items">
              {items.map((item) => (
                <div key={item.id} className="studio__cluster">
                  {item.bits.map((bit, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      className={copied === bit ? "is-copied" : ""}
                      onClick={() => copy(bit)}
                      title="클릭하면 복사"
                    >
                      {bit}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
