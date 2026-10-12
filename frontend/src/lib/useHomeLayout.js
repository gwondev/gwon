import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import { mergeHomeLayout, readStoredLayout, writeStoredLayout } from "./homeLayout.js";
import { journeyCount, makePlanetPos, setLiveProjects } from "./journey.js";
import { worldState } from "../components/home/worldState.js";

function syncProjects(projects) {
  setLiveProjects(projects);
  worldState.liveProjects = projects;
  worldState.planets = makePlanetPos(journeyCount());
}

export function useHomeLayout() {
  const { token } = useAuth();
  const [layout, setLayout] = useState(() => readStoredLayout());
  const loaded = useRef(false);

  useEffect(() => {
    syncProjects(layout.projects);
  }, [layout.projects]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api("/portfolio/home-layout")
      .then((data) => {
        const next = mergeHomeLayout(data?.layout);
        setLayout(next);
        writeStoredLayout(next);
        syncProjects(next.projects);
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(
    async (next) => {
      const merged = mergeHomeLayout(next);
      setLayout(merged);
      writeStoredLayout(merged);
      syncProjects(merged.projects);
      if (!token) return merged;
      try {
        const data = await api("/admin/home-layout", {
          method: "PUT",
          body: { layout: merged },
          token,
        });
        const saved = mergeHomeLayout(data?.layout || merged);
        setLayout(saved);
        writeStoredLayout(saved);
        syncProjects(saved.projects);
        return saved;
      } catch {
        return merged;
      }
    },
    [token]
  );

  const patchProject = useCallback(
    (id, fields) => {
      persist({
        ...layout,
        projects: layout.projects.map((p) => (p.id === id ? { ...p, ...fields } : p)),
      });
    },
    [layout, persist]
  );

  return {
    projects: layout.projects,
    profile: layout.profile,
    patchProject,
  };
}
