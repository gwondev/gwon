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

  const patchHero = useCallback(
    (fields) => persist({ ...layout, hero: { ...layout.hero, ...fields } }),
    [layout, persist]
  );

  const patchNav = useCallback(
    (fields) => persist({ ...layout, nav: { ...layout.nav, ...fields } }),
    [layout, persist]
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

  const patchProfileTab = useCallback(
    (tabId, fields) => {
      persist({
        ...layout,
        profile: {
          tabs: (layout.profile?.tabs || []).map((tab) => (tab.id === tabId ? { ...tab, ...fields } : tab)),
        },
      });
    },
    [layout, persist]
  );

  const patchProfileItem = useCallback(
    (tabId, itemId, fields) => {
      persist({
        ...layout,
        profile: {
          tabs: (layout.profile?.tabs || []).map((tab) =>
            tab.id === tabId
              ? { ...tab, items: tab.items.map((it) => (it.id === itemId ? { ...it, ...fields } : it)) }
              : tab
          ),
        },
      });
    },
    [layout, persist]
  );

  const patchWorld = useCallback(
    (id, fields) => {
      persist({
        ...layout,
        worlds: {
          ...layout.worlds,
          [id]: { ...layout.worlds?.[id], ...fields },
        },
      });
    },
    [layout, persist]
  );

  const patchWorldItem = useCallback(
    (worldId, itemId, fields) => {
      persist({
        ...layout,
        worlds: {
          ...layout.worlds,
          [worldId]: {
            ...layout.worlds?.[worldId],
            items: (layout.worlds?.[worldId]?.items || []).map((it) => (it.id === itemId ? { ...it, ...fields } : it)),
          },
        },
      });
    },
    [layout, persist]
  );

  const addProfileItem = useCallback(
    (tabId) => {
      persist({
        ...layout,
        profile: {
          tabs: (layout.profile?.tabs || []).map((tab) => {
            if (tab.id !== tabId) return tab;
            const i = tab.items.length;
            return {
              ...tab,
              items: [...tab.items, { i, id: `c-${Date.now()}`, title: "새 항목", subtitle: "", description: "" }],
            };
          }),
        },
      });
    },
    [layout, persist]
  );

  return {
    layout,
    hero: layout.hero,
    nav: layout.nav,
    projects: layout.projects,
    profile: layout.profile,
    worlds: layout.worlds,
    patchHero,
    patchNav,
    patchProject,
    patchProfileTab,
    patchProfileItem,
    patchWorld,
    patchWorldItem,
    addProfileItem,
  };
}
