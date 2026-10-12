import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { mergeHomeLayout, readStoredLayout, writeStoredLayout } from "./homeLayout.js";
import { journeyCount, makePlanetPos, setLiveProjects } from "./journey.js";
import { worldState } from "../components/home/worldState.js";

export function useHomeLayout() {
  const [projects, setProjects] = useState(() => readStoredLayout().projects);
  const loaded = useRef(false);

  useEffect(() => {
    setLiveProjects(projects);
    worldState.liveProjects = projects;
    worldState.planets = makePlanetPos(journeyCount());
  }, [projects]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api("/portfolio/home-layout")
      .then((data) => {
        const next = mergeHomeLayout(data?.layout);
        setProjects(next.projects);
        writeStoredLayout(next);
        setLiveProjects(next.projects);
      })
      .catch(() => {});
  }, []);

  return { projects };
}
