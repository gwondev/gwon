import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import {
  HOME_LAYOUT_DEFAULT,
  mergeHomeLayout,
  readStoredLayout,
  writeStoredLayout,
} from "./homeLayout.js";
import { makePlanetPos, setLiveProjects } from "./journey.js";
import { worldState } from "../components/home/worldState.js";

export function useHomeLayout() {
  const { token } = useAuth();
  const [layout, setLayout] = useState(() => readStoredLayout());
  const [saved, setSaved] = useState(() => readStoredLayout());
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    setLiveProjects(layout.projects);
    worldState.liveProjects = layout.projects;
    worldState.planets = makePlanetPos(layout.projects.length);
  }, [layout.projects]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api("/portfolio/home-layout")
      .then((data) => {
        const next = mergeHomeLayout(data?.layout);
        setLayout(next);
        setSaved(next);
        writeStoredLayout(next);
        setLiveProjects(next.projects);
      })
      .catch(() => {});
  }, []);

  const dirty = useMemo(() => JSON.stringify(layout) !== JSON.stringify(saved), [layout, saved]);

  const commit = useCallback((next) => {
    writeStoredLayout(next);
    setLiveProjects(next.projects);
    worldState.liveProjects = next.projects;
    worldState.planets = makePlanetPos(next.projects.length);
    return next;
  }, []);

  const setUnit = useCallback((id, box) => {
    setLayout((prev) => commit({ ...prev, units: { ...prev.units, [id]: box } }));
  }, [commit]);

  const setMedia = useCallback((projectId, box) => {
    setLayout((prev) => commit({ ...prev, media: { ...prev.media, [projectId]: box } }));
  }, [commit]);

  const setProjects = useCallback((projects) => {
    setLayout((prev) => commit({ ...prev, projects }));
  }, [commit]);

  const save = useCallback(async () => {
    setSaving(true);
    writeStoredLayout(layout);
    if (!token) {
      setSaved(layout);
      setSaving(false);
      return;
    }
    try {
      const data = await api("/admin/home-layout", {
        method: "PUT",
        body: { layout },
        token,
      });
      const next = mergeHomeLayout(data?.layout || layout);
      setLayout(next);
      setSaved(next);
      writeStoredLayout(next);
      setLiveProjects(next.projects);
    } catch {
      setSaved(layout);
    } finally {
      setSaving(false);
    }
  }, [layout, token]);

  const reset = useCallback(() => {
    const next = mergeHomeLayout(HOME_LAYOUT_DEFAULT);
    setLayout(next);
    writeStoredLayout(next);
    setLiveProjects(next.projects);
  }, []);

  return { layout, edit, setEdit, dirty, saving, setUnit, setMedia, setProjects, save, reset };
}
