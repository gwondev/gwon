import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHomeLayout } from "../lib/useHomeLayout.js";
import { api } from "../lib/api.js";
import { filledItems, sectionItems, visibleSections } from "../components/universe/sections.js";
import "./VaultStudio.css";

export default function VaultStudio() {
  const { isSuperAdmin, token } = useAuth();
  const home = useHomeLayout();
  const [drive, setDrive] = useState(null);
  const [error, setError] = useState("");

  const sections = useMemo(() => visibleSections(home, false).filter((s) => s.id !== "gateway"), [home]);
  const boards = useMemo(
    () =>
      sections.map((section) => ({
        section,
        items: filledItems(sectionItems(section, home)).slice(0, 6),
      })),
    [sections, home]
  );

  useEffect(() => {
    if (!isSuperAdmin || !token) return undefined;
    let alive = true;
    api("/drive/folder", { token })
      .then((data) => {
        if (alive) setDrive(data);
      })
      .catch((err) => {
        if (alive) setError(err.data?.error || err.message || "");
      });
    return () => {
      alive = false;
    };
  }, [isSuperAdmin, token]);

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const files = drive?.children || [];

  return (
    <main className="page studio">
      <header className="studio__head">
        <p>PRIVATE</p>
        <h1>이력 요약</h1>
        <span>Drive에 올려 둔 기록과 포트폴리오 단면을 한 장으로 봅니다.</span>
      </header>

      <section className="studio__drive" aria-label="드라이브">
        <div className="studio__label">
          <b>DRIVE</b>
          <em>{drive?.folder?.name || "ROOT"}</em>
        </div>
        {files.length > 0 ? (
          <ul>
            {files.slice(0, 12).map((file) => (
              <li key={file.id}>
                <strong>{file.name}</strong>
                <span>{file.isFolder ? "FOLDER" : "FILE"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="studio__empty">{error || "연결된 폴더가 비어 있거나, 이 환경에서는 Drive를 열 수 없습니다."}</p>
        )}
      </section>

      <section className="studio__grid" aria-label="이력">
        {boards.map(({ section, items }) => (
          <article key={section.id} style={{ "--c": section.color }}>
            <header>
              <b>{section.no}</b>
              <h2>{section.ko}</h2>
              <span>{items.length}</span>
            </header>
            <ul>
              {items.length === 0 && <li className="is-empty">기록 없음</li>}
              {items.map((it) => (
                <li key={it.id}>
                  <strong>{it.title}</strong>
                  {it.subtitle && <em>{it.subtitle}</em>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
